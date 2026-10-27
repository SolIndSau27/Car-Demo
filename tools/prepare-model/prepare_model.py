"""
KarDmo · Preparación automática de un modelo 3D de carro (p. ej. generado por IA con
Hunyuan3D / TRELLIS) para usarlo en la app.

Qué hace, sin intervención manual:
  1. Importa .glb/.gltf/.obj/.ply/.stl y une todas las mallas.
  2. Orienta: eje largo a lo largo de X, frente hacia +X (detecta el cofre: es más bajo que la cajuela).
  3. Escala a las medidas reales del JSON del vehículo (largo, ancho sin espejos, alto) y lo pone en el piso.
  4. Detecta los ejes por las huellas de las llantas y quita las ruedas de la IA (la app pone sus rines paramétricos).
  5. Separa puertas, cofre y cajuela por las líneas de corte de la silueta del JSON.
  6. Asigna materiales: 'pintura', 'vidrio' y 'negro'. Si hay textura, calcula una máscara de pintura en el canal
     alfa para que el configurador pueda cambiar el color.
  7. Reduce polígonos si hace falta y exporta un .glb con los nodos nombrados como los ids de la app.

Uso (Blender como librería: pip install bpy):
  python tools/prepare-model/prepare_model.py --input modelo_ia.glb \\
      --vehicle src/data/vehicles/sonata-2016.json --output public/models/sonata-2016.glb

  o con Blender instalado:
  blender -b -P tools/prepare-model/prepare_model.py -- --input ... --vehicle ... --output ...

Opciones útiles: --front +x|-x (si la detección del frente falla), --uniform (conserva proporciones de la IA),
--max-faces N, --keep-wheels.
"""

import argparse
import json
import math
import os
import sys

import bpy  # noqa: I001 (bpy debe ir antes de bmesh)
import bmesh
import numpy as np
from mathutils import Matrix, Vector

# ---------------------------------------------------------------------------------------------
# Utilidades de perfiles (las mismas definiciones que usa la app en body-surface.js)
# ---------------------------------------------------------------------------------------------


def interp(points, x):
    pts = sorted(points, key=lambda p: p[0])
    if x <= pts[0][0]:
        return pts[0][1]
    if x >= pts[-1][0]:
        return pts[-1][1]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        if x <= x1:
            return y0 + (x - x0) / (x1 - x0) * (y1 - y0)
    return pts[-1][1]


class Silhouette:
    def __init__(self, sil):
        self.sil = sil
        self.crown = sil.get("corona", 0.045)

    def top(self, x):
        return interp(self.sil["centro"], x)

    def belt(self, x):
        return min(interp(self.sil["cintura"], x), self.top(x) - 0.004)

    def edge(self, x):
        return min(max(self.top(x) - self.crown, self.belt(x) + 0.012), self.top(x) - 0.002)

    def half_width(self, x):
        return interp(self.sil["media_anchura"], x)


# ---------------------------------------------------------------------------------------------
# Escena
# ---------------------------------------------------------------------------------------------


def log(msg):
    print(f"[prepare_model] {msg}", flush=True)


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def import_model(path):
    ext = os.path.splitext(path)[1].lower()
    if ext in (".glb", ".gltf"):
        bpy.ops.import_scene.gltf(filepath=path)
    elif ext == ".obj":
        bpy.ops.wm.obj_import(filepath=path)
    elif ext == ".ply":
        bpy.ops.wm.ply_import(filepath=path)
    elif ext == ".stl":
        bpy.ops.wm.stl_import(filepath=path)
    else:
        raise SystemExit(f"Formato no soportado: {ext}")
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    if not meshes:
        raise SystemExit("El archivo no tiene mallas.")
    # Aplica transformaciones y une todo en un solo objeto.
    for o in bpy.context.scene.objects:
        o.select_set(o.type == "MESH")
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if len(meshes) > 1:
        bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    for o in list(bpy.context.scene.objects):
        if o != obj:
            bpy.data.objects.remove(o, do_unlink=True)
    obj.name = "carroceria"
    obj.data.name = "carroceria"
    return obj


def coords(obj):
    v = np.empty(len(obj.data.vertices) * 3, dtype=np.float64)
    obj.data.vertices.foreach_get("co", v)
    return v.reshape(-1, 3)


def apply_matrix(obj, m):
    obj.data.transform(m)
    obj.data.update()


# ---------------------------------------------------------------------------------------------
# 2-3. Orientación y escala
# ---------------------------------------------------------------------------------------------


def orient(obj, front_hint, up_hint="auto", flip_up=False):
    co = coords(obj)
    ext = co.max(0) - co.min(0)
    # Eje vertical: el que se indique o, si no, el más corto de los dos que no son el largo
    # (en un auto el alto es menor que el ancho). STL/OBJ de IA suelen venir con Y hacia arriba.
    axes = "xyz"
    if up_hint != "auto":
        up = axes.index(up_hint)
    else:
        long_ax = int(np.argmax(ext))
        others = [i for i in range(3) if i != long_ax]
        up = min(others, key=lambda i: ext[i])
    if up != 2:
        # Lleva el eje 'up' a Z.
        # +Y -> +Z (giro de +90° en X) o +X -> +Z (giro de -90° en Y).
        rot = Matrix.Rotation(math.radians(90), 4, "X") if up == 1 else Matrix.Rotation(math.radians(-90), 4, "Y")
        apply_matrix(obj, rot)
        log(f"Eje vertical era {axes[up].upper()}: rotado para dejarlo en Z.")
    if flip_up:
        apply_matrix(obj, Matrix.Rotation(math.radians(180), 4, "X"))
        log("Volteado de cabeza por --flip-up.")
    if up != 2 or flip_up:
        co = coords(obj)
        ext = co.max(0) - co.min(0)
    if ext[1] > ext[0]:
        apply_matrix(obj, Matrix.Rotation(math.radians(90), 4, "Z"))
        log("Eje largo estaba en Y: rotado 90°.")
        co = coords(obj)
    # Centra para medir.
    c = (co.max(0) + co.min(0)) / 2
    apply_matrix(obj, Matrix.Translation(Vector((-c[0], -c[1], -co[:, 2].min()))))
    co = coords(obj)
    L = co[:, 0].max() - co[:, 0].min()
    H = co[:, 2].max()

    if front_hint in ("+x", "-x"):
        front_pos = front_hint == "+x"
        log(f"Frente indicado manualmente: {front_hint}")
    else:
        # El cofre (frente) es más bajo que la cajuela/medallón en un sedán.
        def top_near(sign):
            xs = co[:, 0] * sign
            band = (xs > L * 0.2) & (xs < L * 0.38)
            return np.percentile(co[band, 2], 95) if band.any() else 0

        hp, hn = top_near(1), top_near(-1)
        front_pos = hp <= hn
        diff = abs(hp - hn) / max(H, 1e-6)
        log(f"Altura cerca de +X: {hp:.3f}, cerca de -X: {hn:.3f} → frente en {'+X' if front_pos else '-X'}")
        if diff < 0.03:
            log("AVISO: la detección del frente es dudosa; usa --front +x o --front -x si sale al revés.")
    if not front_pos:
        apply_matrix(obj, Matrix.Rotation(math.radians(180), 4, "Z"))


def remove_ground_plate(obj):
    """Algunas IA agregan una placa plana bajo el carro: se eliminan caras horizontales pegadas al piso."""
    co = coords(obj)
    zmin, zmax = co[:, 2].min(), co[:, 2].max()
    tol = (zmax - zmin) * 0.012
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    doomed = [f for f in bm.faces if abs(f.normal.z) > 0.9 and all(v.co.z < zmin + tol for v in f.verts)]
    if doomed:
        bmesh.ops.delete(bm, geom=doomed, context="FACES")
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
        bm.to_mesh(obj.data)
        log(f"Placa del piso eliminada ({len(doomed)} caras).")
    bm.free()


def fit_dimensions(obj, dims, uniform):
    co = coords(obj)
    L = co[:, 0].max() - co[:, 0].min()
    H = co[:, 2].max() - co[:, 2].min()
    # Ancho de carrocería sin espejos: mide abajo de la altura de los espejos.
    low = co[:, 2] < co[:, 2].min() + H * 0.6
    W = 2 * np.percentile(np.abs(co[low, 1]), 99.5)
    sx = dims["largo_m"] / L
    sy = dims["ancho_m"] / W
    sz = dims["alto_m"] / H
    log(f"Medidas de la IA: largo {L:.3f}, ancho {W:.3f}, alto {H:.3f} (unidades del archivo)")
    if uniform:
        sy = sz = sx
        log(f"Escala uniforme por largo: {sx:.4f}")
    else:
        spread = max(sx, sy, sz) / min(sx, sy, sz)
        log(f"Escala por eje: x {sx:.4f}, y {sy:.4f}, z {sz:.4f} (diferencia {100 * (spread - 1):.1f}%)")
        if spread > 1.08:
            log("AVISO: las proporciones de la IA difieren más de 8% de las reales; revisa la forma.")
    apply_matrix(obj, Matrix.Diagonal((sx, sy, sz, 1)))
    co = coords(obj)
    c = (co.max(0) + co.min(0)) / 2
    apply_matrix(obj, Matrix.Translation(Vector((-c[0], -c[1], -co[:, 2].min()))))
    return {"escala": [sx, sy, sz]}


# ---------------------------------------------------------------------------------------------
# 4. Ruedas
# ---------------------------------------------------------------------------------------------


def detect_axles(obj, dims):
    co = coords(obj)
    contact = co[co[:, 2] < 0.03]
    expected_f = dims["eje_delantero_x"]
    expected_r = expected_f - dims["distancia_ejes_m"]
    if len(contact) < 10:
        log("AVISO: no encontré huellas de llantas; uso los ejes del JSON.")
        return expected_f, expected_r, False
    f = contact[contact[:, 0] > 0][:, 0]
    r = contact[contact[:, 0] < 0][:, 0]
    if len(f) < 5 or len(r) < 5:
        return expected_f, expected_r, False
    xf, xr = float(np.median(f)), float(np.median(r))
    wb = xf - xr
    log(f"Ejes detectados: delantero x={xf:.3f}, trasero x={xr:.3f}, distancia {wb:.3f} m (real {dims['distancia_ejes_m']} m)")
    if abs(wb - dims["distancia_ejes_m"]) / dims["distancia_ejes_m"] > 0.03:
        log("AVISO: la distancia entre ejes de la IA difiere más de 3% de la real.")
    return xf, xr, True


def remove_wheels(obj, axles, tire_r, track):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    r2 = (tire_r * 1.04) ** 2
    doomed = []
    for v in bm.verts:
        x, y, z = v.co
        if abs(y) < track - 0.24:
            continue
        for ax in axles:
            if (x - ax) ** 2 + (z - tire_r) ** 2 < r2:
                doomed.append(v)
                break
    bmesh.ops.delete(bm, geom=doomed, context="VERTS")
    bm.to_mesh(obj.data)
    bm.free()
    log(f"Ruedas de la IA eliminadas ({len(doomed)} vértices).")


# ---------------------------------------------------------------------------------------------
# 5-6. Paneles y materiales
# ---------------------------------------------------------------------------------------------

DOORS = {
    "puerta_del_der": ("puerta_delantera", 1),
    "puerta_del_izq": ("puerta_delantera", -1),
    "puerta_tras_der": ("puerta_trasera", 1),
    "puerta_tras_izq": ("puerta_trasera", -1),
}


def classify_part(silh, sil, c, n):
    """Pieza de una cara según su centro c y normal n (coordenadas Blender: X frente, Z arriba, -Y derecha)."""
    x, z = c.x, c.z
    side = 1 if -c.y > 0 else -1
    lat = abs(n.y)
    belt = silh.belt(x)
    cof, caj = sil["cofre"], sil["cajuela"]
    if cof["x_atras"] <= x <= cof["x_frente"] and z >= belt - 0.012 and n.z > 0.3:
        return "cofre"
    if caj["x_atras"] <= x <= caj["x_frente"] and z >= belt - 0.012 and n.z > 0.15:
        return "cajuela"
    if lat > 0.3 and 0.24 < z < silh.edge(x) - 0.004:
        for name, (key, s) in DOORS.items():
            d = sil[key]
            if s == side and d["x_atras"] <= x <= d["x_frente"]:
                return name
    return "carroceria"


def classify_material(silh, sil, c, n):
    x, z = c.x, c.z
    lat = abs(n.y)
    belt = silh.belt(x)
    edge = silh.edge(x)
    if z < 0.19 or n.z < -0.65:
        return "negro"
    v = sil["ventanas"]
    if lat > 0.3 and belt + 0.015 < z < edge - 0.015:
        for a, b in v.values():
            if a <= x <= b:
                return "vidrio"
    inner = abs(c.y) < silh.half_width(x) * 0.62
    pb, md = sil["parabrisas"], sil["medallon"]
    if inner and n.z > 0.25 and z > belt + 0.03:
        if pb["x_techo"] <= x <= pb["x_base"] or md["x_base"] <= x <= md["x_techo"]:
            return "vidrio"
    return "pintura"


def build_materials(src_image):
    mats = {}
    for name, color, rough, metal in (("pintura", (0.12, 0.18, 0.33, 1), 0.3, 0.6), ("vidrio", (0.1, 0.13, 0.17, 1), 0.05, 0.2), ("negro", (0.02, 0.02, 0.025, 1), 0.6, 0.1)):
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        bsdf = m.node_tree.nodes.get("Principled BSDF")
        bsdf.inputs["Base Color"].default_value = color
        bsdf.inputs["Roughness"].default_value = rough
        bsdf.inputs["Metallic"].default_value = metal
        if name == "pintura" and src_image is not None:
            tex = m.node_tree.nodes.new("ShaderNodeTexImage")
            tex.image = src_image
            m.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
        mats[name] = m
    return mats


def find_texture(obj):
    for slot in obj.material_slots:
        m = slot.material
        if not m or not m.use_nodes:
            continue
        for node in m.node_tree.nodes:
            if node.type == "TEX_IMAGE" and node.image is not None:
                return node.image
    return None


def paint_mask(obj, image, mat_index_paint):
    """Escribe en el alfa de la textura una máscara de las zonas pintadas (para recolorear en la app)."""
    w, h = image.size
    if not w or not h:
        return None
    px = np.empty(w * h * 4, dtype=np.float32)
    image.pixels.foreach_get(px)
    px = px.reshape(h, w, 4)
    # Color de referencia: muestras en el centro de los costados (puertas).
    uv_layer = obj.data.uv_layers.active
    if uv_layer is None:
        return None
    samples = []
    for poly in obj.data.polygons:
        if poly.material_index != mat_index_paint:
            continue
        cz = poly.center.z
        if abs(poly.normal.y) > 0.7 and 0.45 < cz < 0.85:
            for li in poly.loop_indices:
                u, v = uv_layer.data[li].uv
                samples.append(px[min(h - 1, max(0, int(v * h))), min(w - 1, max(0, int(u * w))), :3])
    if len(samples) < 20:
        log("AVISO: pocas muestras de pintura; no se generó máscara.")
        return None
    ref = np.median(np.array(samples), axis=0)
    rgb = px[:, :, :3]
    mx, mn = rgb.max(2), rgb.min(2)
    sat = np.where(mx > 1e-4, (mx - mn) / np.maximum(mx, 1e-4), 0)
    rmx, rmn = ref.max(), ref.min()
    rsat = (rmx - rmn) / max(rmx, 1e-4)
    if rsat < 0.15:
        mask = (sat < 0.22) & (np.abs(mx - rmx) < 0.35)
    else:
        def hue(c):
            r, g, b = c[..., 0], c[..., 1], c[..., 2]
            m_ = np.maximum(np.maximum(r, g), b)
            n_ = np.minimum(np.minimum(r, g), b)
            d = np.maximum(m_ - n_, 1e-4)
            hh = np.where(m_ == r, ((g - b) / d) % 6, np.where(m_ == g, (b - r) / d + 2, (r - g) / d + 4))
            return hh / 6

        dh = np.abs(hue(rgb) - hue(ref[None, None, :]))
        dh = np.minimum(dh, 1 - dh)
        mask = (dh < 0.07) & (sat > rsat * 0.45)
    px[:, :, 3] = mask.astype(np.float32)
    out = bpy.data.images.new(image.name + "_pintura", w, h, alpha=True)
    out.pixels.foreach_set(px.ravel())
    out.file_format = "PNG"
    out.pack()
    log(f"Máscara de pintura: {100 * mask.mean():.1f}% de la textura (color de referencia {np.round(ref, 3).tolist()}).")
    return out


def split_parts(obj, sil, image):
    silh = Silhouette(sil)
    me = obj.data
    mats = build_materials(image)
    me.materials.clear()
    names = ["pintura", "vidrio", "negro"]
    for n in names:
        me.materials.append(mats[n])
    part_of = []
    mw = obj.matrix_world
    for poly in me.polygons:
        c = mw @ poly.center
        n = (mw.to_3x3() @ poly.normal).normalized()
        poly.material_index = names.index(classify_material(silh, sil, c, n))
        part_of.append(classify_part(silh, sil, c, n))

    if image is not None:
        masked = paint_mask(obj, image, names.index("pintura"))
        if masked is not None:
            tex = mats["pintura"].node_tree.nodes.get("Image Texture")
            tex.image = masked

    counts = {}
    for p in part_of:
        counts[p] = counts.get(p, 0) + 1
    log("Caras por pieza: " + ", ".join(f"{k}={v}" for k, v in sorted(counts.items())))

    # Separa cada pieza en su propio objeto (atributo por cara: no depende del orden de las caras).
    codes = {name: i for i, name in enumerate(sorted(counts))}
    attr = me.attributes.new("parte", "INT", "FACE")
    attr.data.foreach_set("value", [codes[p] for p in part_of])
    parts = {"carroceria": obj}
    for name in [p for p in sorted(counts) if p != "carroceria"]:
        bpy.context.view_layer.objects.active = obj
        for o in bpy.context.scene.objects:
            o.select_set(o == obj)
        vals = [0] * len(obj.data.polygons)
        obj.data.attributes["parte"].data.foreach_get("value", vals)
        obj.data.polygons.foreach_set("select", [v == codes[name] for v in vals])
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_mode(type="FACE")
        bpy.ops.object.mode_set(mode="OBJECT")
        obj.data.polygons.foreach_set("select", [v == codes[name] for v in vals])
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.separate(type="SELECTED")
        bpy.ops.object.mode_set(mode="OBJECT")
        new = [o for o in bpy.context.selected_objects if o != obj][0]
        new.name = name
        new.data.name = name
        parts[name] = new
    for o in parts.values():
        if "parte" in o.data.attributes:
            o.data.attributes.remove(o.data.attributes["parte"])
    return parts, counts


def decimate(obj, max_faces):
    n = len(obj.data.polygons)
    if n <= max_faces:
        return
    ratio = max_faces / n
    mod = obj.modifiers.new("decimar", "DECIMATE")
    mod.ratio = ratio
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)
    log(f"Polígonos: {n} → {len(obj.data.polygons)}")


def export(path):
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    for o in bpy.context.scene.objects:
        o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", export_yup=True, export_apply=True, use_selection=False)
    log(f"Exportado: {path} ({os.path.getsize(path) / 1e6:.1f} MB)")


# ---------------------------------------------------------------------------------------------


def main(argv):
    p = argparse.ArgumentParser(description="Prepara un modelo 3D de carro para KarDmo.")
    p.add_argument("--input", required=True)
    p.add_argument("--vehicle", required=True, help="JSON del vehículo (silueta, dimensiones, llantas)")
    p.add_argument("--output", required=True)
    p.add_argument("--front", choices=["+x", "-x", "auto"], default="auto")
    p.add_argument("--up", choices=["x", "y", "z", "auto"], default="auto", help="eje vertical del archivo de entrada")
    p.add_argument("--flip-up", action="store_true", help="si el modelo sale de cabeza")
    p.add_argument("--uniform", action="store_true", help="escala uniforme (conserva proporciones de la IA)")
    p.add_argument("--keep-wheels", action="store_true")
    p.add_argument("--max-faces", type=int, default=250000)
    p.add_argument("--report", default=None, help="ruta del reporte JSON (por omisión junto al .glb)")
    a = p.parse_args(argv)

    with open(a.vehicle, encoding="utf-8") as f:
        vehicle = json.load(f)
    dims = vehicle["dimensiones"]
    sil = vehicle["silueta"]
    ref = vehicle["llantas"]["referencia"]
    ancho, perfil, rin = int(ref[:3]), int(ref[4:6]), int(ref[7:9])
    tire_r = (rin * 25.4 + 2 * ancho * perfil / 100) / 2000

    reset_scene()
    obj = import_model(a.input)
    image = find_texture(obj)
    log(f"Importado: {len(obj.data.polygons)} caras, textura: {image.name if image else 'no'}")
    orient(obj, a.front, a.up, a.flip_up)
    remove_ground_plate(obj)
    report = {"entrada": os.path.basename(a.input)}
    report.update(fit_dimensions(obj, dims, a.uniform))
    xf, xr, found = detect_axles(obj, dims)
    report["ejes_detectados"] = {"delantero_x": xf, "trasero_x": xr, "distancia": xf - xr, "detectados": found}
    if not a.keep_wheels:
        remove_wheels(obj, (xf, xr), tire_r, dims["media_trocha_m"])
    decimate(obj, a.max_faces)
    parts, counts = split_parts(obj, sil, image)
    report["caras_por_pieza"] = counts
    missing = [n for n in ["cofre", "cajuela", *DOORS] if n not in parts]
    if missing:
        log("AVISO: no se encontraron caras para: " + ", ".join(missing) + " (revisa la silueta en el editor de vistas).")
    report["faltantes"] = missing
    export(a.output)
    rpath = a.report or os.path.splitext(a.output)[0] + ".reporte.json"
    with open(rpath, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    log(f"Reporte: {rpath}")


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else sys.argv[1:]
    main(argv)
