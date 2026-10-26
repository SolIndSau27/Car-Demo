import * as THREE from 'three';
import { arc, shape, extrudeZ, mesh, box, v2 } from './geometry.js';
import { createBodySurface } from './body-surface.js';
import { parseTireSize } from '../configurator/tires.js';

/**
 * Carro procedural: todos los paneles son regiones de una sola superficie lofteada
 * (ver body-surface.js), con proporciones de sedán fastback tomadas de vehicle.silueta.
 * +x = frente, +y = arriba, +z = lado derecho, piso en y = 0.
 * Devuelve nodos con los mismos ids que tendría un .glb (ver model-source.js).
 */
export function buildProceduralCar(vehicle, mats) {
  const ctx = createContext(vehicle, mats);
  const { sil } = ctx;
  const nodes = {};
  const V = sil.ventanas;

  // ---------- Carrocería fija ----------
  const carroceria = new THREE.Group();
  for (const s of [-1, 1]) {
    // Costado trasero con arco de rueda.
    carroceria.add(ctx.panel({ x0: sil.fascia_trasera_x, x1: -0.97, t0: ctx.archT, t1: 4, side: s, nx: 80 }, mats.paint));
    // Faldón (estribo) oscuro entre arcos.
    carroceria.add(ctx.panel({ x0: ctx.xr + ctx.ra, x1: ctx.xf - ctx.ra, t0: 0.55, t1: 1.12, side: s }, mats.trim));
    // Invernadero: cristal de cuarto, pilares, molduras y riel de techo.
    carroceria.add(ctx.panel({ x0: V.cuarto[0], x1: V.cuarto[1], t0: 4.08, t1: 5.86, side: s }, mats.glass, false));
    carroceria.add(ctx.panel({ x0: V.cuarto[1], x1: sil.puerta_trasera.x_atras - 0.004, t0: 4.08, t1: 5.86, side: s }, mats.trim));
    carroceria.add(ctx.panel({ x0: sil.medallon.x_base, x1: V.cuarto[0], t0: 4.0, t1: 5.86, side: s }, mats.paint));
    carroceria.add(ctx.panel({ x0: V.cuarto[0] - 0.04, x1: sil.puerta_trasera.x_atras - 0.004, t0: 4.0, t1: 4.08, side: s }, mats.chrome));
    carroceria.add(ctx.panel({ x0: V.cuarto[0] - 0.04, x1: sil.parabrisas.x_base, t0: 5.86, t1: 5.96, side: s, nx: 90 }, mats.chrome));
    carroceria.add(ctx.panel({ x0: sil.medallon.x_base, x1: sil.parabrisas.x_base, t0: 5.96, t1: 6.15, side: s, nx: 90 }, mats.paint));
    carroceria.add(ctx.panel({ x0: sil.medallon.x_base, x1: V.cuarto[0] - 0.04, t0: 5.86, t1: 5.96, side: s }, mats.paint));
    // Parabrisas, techo, medallón y escudo del cofre (cowl).
    carroceria.add(ctx.panel({ x0: sil.parabrisas.x_techo, x1: sil.parabrisas.x_base, t0: 6.15, t1: 7, side: s }, mats.glass, false));
    carroceria.add(ctx.panel({ x0: sil.medallon.x_techo, x1: sil.parabrisas.x_techo, t0: 6.15, t1: 7, side: s }, mats.paint));
    carroceria.add(ctx.panel({ x0: sil.medallon.x_base, x1: sil.medallon.x_techo, t0: 6.15, t1: 7, side: s }, mats.glass, false));
    carroceria.add(ctx.panel({ x0: sil.parabrisas.x_base, x1: sil.cofre.x_atras - 0.004, t0: 4.0, t1: 7, side: s, nx: 2 }, mats.trim));
    carroceria.add(archLiner(ctx, ctx.xf, s), archLiner(ctx, ctx.xr, s));
  }
  carroceria.add(rearEnd(ctx), underbody(ctx), engineBay(ctx), interior(ctx), trunkBox(ctx), sharkFin(ctx));
  nodes.carroceria = carroceria;

  // ---------- Puertas ----------
  nodes.puerta_del_izq = door(ctx, -1, true);
  nodes.puerta_del_der = door(ctx, 1, true);
  nodes.puerta_tras_izq = door(ctx, -1, false);
  nodes.puerta_tras_der = door(ctx, 1, false);

  // ---------- Cofre y cajuela ----------
  const cofre = new THREE.Group();
  for (const s of [-1, 1]) cofre.add(ctx.panel({ x0: sil.cofre.x_atras, x1: sil.cofre.x_frente, t0: 4.0, t1: 7, side: s, nx: 40 }, mats.paint));
  nodes.cofre = cofre;
  const cajuela = new THREE.Group();
  for (const s of [-1, 1]) {
    cajuela.add(ctx.panel({ x0: sil.cajuela.x_atras, x1: sil.cajuela.x_frente, t0: 4.0, t1: 7, side: s, nx: 26 }, mats.paint));
    // Parte de la calavera que va en la tapa.
    cajuela.add(ctx.panel({ x0: sil.cajuela.x_atras, x1: -2.2, t0: 4.0, t1: 4.55, side: s }, mats.taillight, false));
  }
  nodes.cajuela = cajuela;
  nodes.escape = exhaust(ctx);

  // Contenedores para piezas intercambiables (los llena body-variants.js).
  for (const id of ['fascia_delantera', 'salpicadera_izq', 'salpicadera_der', 'extensiones_traseras', 'aleron']) {
    nodes[id] = new THREE.Group();
  }

  Object.entries(nodes).forEach(([id, n]) => {
    n.name = id;
    n.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
  });
  return { nodes, ctx };
}

/**
 * Piezas internas para usar dentro de un modelo .glb (que normalmente es solo la piel exterior):
 * compartimento del motor, interior, cajuela, forros de arcos, piso y escape.
 */
export function buildInnerParts(vehicle, mats) {
  const ctx = createContext(vehicle, mats);
  const g = new THREE.Group();
  g.name = 'interiores';
  for (const s of [-1, 1]) g.add(archLiner(ctx, ctx.xf, s), archLiner(ctx, ctx.xr, s));
  g.add(underbody(ctx), engineBay(ctx), interior(ctx), trunkBox(ctx));
  return { group: g, escape: exhaust(ctx), ctx };
}

export function createContext(vehicle, mats) {
  const sil = vehicle.silueta;
  const dims = vehicle.dimensiones;
  const surf = createBodySurface(sil);
  const xf = dims.eje_delantero_x;
  const xr = xf - dims.distancia_ejes_m;
  const ra = dims.radio_arco_m;
  const cy = parseTireSize(vehicle.llantas.referencia).diametroMm / 2000;

  /** Altura del borde inferior del panel: arco de rueda o estribo. */
  const archY = (x) => {
    for (const ax of [xf, xr]) {
      const dx = x - ax;
      if (Math.abs(dx) < ra) return cy + Math.sqrt(ra * ra - dx * dx) + 0.004;
    }
    return 0;
  };
  const archT = (x) => {
    const y = archY(x);
    return y ? surf.tForY(x, y) : 1.0;
  };

  /**
   * Panel de carrocería: región de la superficie con su material. Con back=true agrega
   * la cara interior oscura (se ve al abrir puertas, cofre o cajuela).
   */
  function panel(opts, material, back = true) {
    const g = new THREE.Group();
    const geo = surf.patch(opts);
    g.add(mesh(geo, material));
    if (back) {
      const b = new THREE.Mesh(geo, mats.backside);
      b.userData.noHighlight = true;
      g.add(b);
    }
    return g;
  }

  /** Figura plana sobre la tapa de un extremo (parrilla, placa…): puntos (z, y). */
  function capShape(points, x, facing, material, holes = []) {
    const shp = shape(points.map(([z, y]) => v2(z, y)), holes.map((h) => h.map(([z, y]) => v2(z, y))));
    const geo = new THREE.ShapeGeometry(shp);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setXYZ(i, x, p.getY(i), p.getX(i));
    geo.computeVertexNormals();
    if (Math.sign(geo.attributes.normal.getX(0)) !== facing) {
      const idx = geo.index;
      for (let i = 0; i < idx.count; i += 3) {
        const a = idx.getX(i + 1);
        idx.setX(i + 1, idx.getX(i + 2));
        idx.setX(i + 2, a);
      }
      geo.computeVertexNormals();
    }
    return mesh(geo, material);
  }

  return { vehicle, sil, dims, mats, surf, xf, xr, ra, cy, archT, panel, capShape };
}

function door(ctx, s, front) {
  const { sil, mats, surf } = ctx;
  const d = front ? sil.puerta_delantera : sil.puerta_trasera;
  const [w0, w1] = front ? sil.ventanas.delantera : sil.ventanas.trasera;
  const xa = d.x_atras;
  const xf = d.x_frente;
  const g = new THREE.Group();
  g.add(ctx.panel({ x0: xa, x1: xf, t0: 1.12, t1: 4.0, side: s, nx: 34 }, mats.paint));
  g.add(ctx.panel({ x0: xa, x1: xf, t0: 4.0, t1: 4.08, side: s }, mats.chrome));
  g.add(ctx.panel({ x0: w0, x1: Math.min(w1, xf), t0: 4.08, t1: 5.86, side: s, nx: 30 }, mats.glass, false));
  // Pilares negros (marco de la puerta).
  if (w0 > xa) g.add(ctx.panel({ x0: xa, x1: w0, t0: 4.08, t1: 5.86, side: s }, mats.trim));
  if (w1 < xf) g.add(ctx.panel({ x0: w1, x1: xf, t0: 4.08, t1: 5.86, side: s }, mats.trim));
  // Panel interior.
  g.add(mesh(surf.patch({ x0: xa + 0.03, x1: xf - 0.03, t0: 1.2, t1: 3.95, side: s, out: -0.05 }), mats.doorCard));
  // Manija cromada.
  const handle = mesh(new THREE.CapsuleGeometry(0.012, 0.11, 4, 8), mats.chrome);
  handle.rotation.z = Math.PI / 2;
  handle.position.copy(surf.point(xa + 0.22, 3.72, s, 0.008));
  g.add(handle);
  if (front) {
    // Espejo montado en la puerta.
    const mirror = new THREE.Group();
    const housing = mesh(new THREE.SphereGeometry(0.1, 20, 14), mats.paint);
    housing.scale.set(0.55, 0.62, 1.0);
    housing.position.set(-0.02, 0.06, s * 0.1);
    const arm = box(0.07, 0.035, 0.08, mats.trim, [0.0, 0.01, s * 0.03]);
    const glass = mesh(new THREE.CircleGeometry(0.075, 20), mats.mirror);
    glass.scale.set(1.3, 0.75, 1);
    glass.rotation.y = -Math.PI / 2;
    glass.position.set(-0.075, 0.06, s * 0.1);
    mirror.add(housing, arm, glass);
    mirror.position.copy(surf.point(xf - 0.12, 4.05, s));
    g.add(mirror);
  }
  return g;
}

function rearEnd(ctx) {
  const { sil, mats, surf, panel, capShape } = ctx;
  const g = new THREE.Group();
  const xt = sil.trasera_x;
  for (const s of [-1, 1]) {
    g.add(panel({ x0: xt, x1: sil.fascia_trasera_x, t0: 0.4, t1: 4.0, side: s, nx: 16 }, mats.paint));
    g.add(panel({ x0: xt, x1: sil.cajuela.x_atras - 0.004, t0: 4.0, t1: 7, side: s, nx: 2 }, mats.paint));
    // Calaveras horizontales que envuelven el costado.
    const span = (x) => Math.min(1, Math.max(0, (x + 2.42) / 0.42));
    g.add(panel({ x0: -2.425, x1: -1.98, t0: (x) => 3.1 + 0.62 * span(x) ** 1.4, t1: 3.995, side: s, nx: 20 }, mats.taillight, false));
    // Reflejante inferior.
    g.add(panel({ x0: -2.42, x1: -2.3, t0: 1.4, t1: 1.75, side: s }, mats.reflector, false));
  }
  g.add(mesh(surf.cap(xt, -1, 0.4), mats.paint));
  // Zona de placa en blanco, moldura cromada y difusor.
  g.add(capShape([[-0.27, 0.48], [0.27, 0.48], [0.27, 0.64], [-0.27, 0.64]], xt - 0.003, -1, mats.trim));
  g.add(capShape([[-0.36, 0.69], [0.36, 0.69], [0.36, 0.705], [-0.36, 0.705]], xt - 0.004, -1, mats.chrome));
  g.add(capShape([[-0.62, 0.3], [0.62, 0.3], [0.55, 0.38], [-0.55, 0.38]], xt - 0.003, -1, mats.trim));
  return g;
}

function underbody(ctx) {
  const floor = box(4.0, 0.03, 1.5, ctx.mats.trim, [0, 0.21, 0]);
  floor.userData.noHighlight = true;
  return floor;
}

function archLiner(ctx, x, s) {
  const { ra, cy } = ctx;
  const outer = arc(x, cy, ra, -0.05, Math.PI + 0.05, 24);
  const inner = arc(x, cy, ra + 0.012, Math.PI + 0.05, -0.05, 24);
  const g = mesh(extrudeZ(shape([...outer, ...inner]), s * 0.5, s * 0.93), ctx.mats.inner);
  g.userData.noHighlight = true;
  return g;
}

function engineBay(ctx) {
  const { mats, surf, sil } = ctx;
  const g = new THREE.Group();
  const x0 = sil.cofre.x_atras;
  const x1 = sil.fascia_delantera_x;
  g.add(box(x1 - x0, 0.02, 1.5, mats.inner, [(x0 + x1) / 2, 0.19, 0]));
  g.add(box(0.03, 0.7, 1.5, mats.inner, [x0 - 0.01, 0.58, 0]));
  g.add(box(0.05, 0.42, 1.36, mats.inner, [x1 - 0.02, 0.48, 0]));
  g.add(box(0.03, 0.34, 1.16, mats.trim, [x1 - 0.06, 0.48, 0]));
  for (const s of [-1, 1]) {
    // Faldones internos bajo el borde del cofre.
    const pts = [v2(x0, 0.22), v2(x1, 0.22)];
    for (let i = 0; i <= 10; i++) {
      const x = x1 - ((x1 - x0) * i) / 10;
      pts.push(v2(x, surf.yBelt(x) - 0.05));
    }
    g.add(mesh(extrudeZ(shape(pts), s * 0.74, s * 0.755), mats.inner));
    const tower = mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.3, 16), mats.inner);
    tower.position.set(ctx.xf, 0.6, s * 0.64);
    g.add(tower);
  }
  g.add(box(0.2, 0.17, 0.26, mats.trim, [1.78, 0.5, -0.52]));
  const pos = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.02, 10), mats.red);
  pos.position.set(1.83, 0.595, -0.46);
  g.add(pos);
  const res = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.1, 14), mats.reservoir);
  res.position.set(1.12, 0.62, 0.52);
  g.add(res);
  g.traverse((o) => (o.userData.noHighlight = true));
  return g;
}

function interior(ctx) {
  const { mats } = ctx;
  const g = new THREE.Group();
  g.add(box(2.0, 0.03, 1.6, mats.interior, [0, 0.27, 0]));
  const dash = shape([v2(0.97, 0.66), v2(0.97, 0.9), v2(0.8, 0.95), v2(0.62, 0.91), v2(0.57, 0.77), v2(0.68, 0.66)]);
  g.add(mesh(extrudeZ(dash, -0.8, 0.8), mats.interior));
  // Volante (lado izquierdo, -z).
  const wheel = new THREE.Group();
  const rim = mesh(new THREE.TorusGeometry(0.18, 0.02, 10, 32), mats.trim);
  rim.rotation.y = Math.PI / 2;
  const hub = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 16), mats.trim);
  hub.rotation.z = Math.PI / 2;
  wheel.add(rim, hub);
  wheel.position.set(0.5, 0.85, -0.37);
  wheel.rotation.z = 0.38;
  g.add(wheel);
  for (const z of [-0.37, 0.37]) {
    g.add(box(0.5, 0.12, 0.5, mats.seat, [0.15, 0.46, z]));
    const back = box(0.12, 0.62, 0.5, mats.seat, [-0.14, 0.79, z]);
    back.rotation.z = 0.2;
    g.add(back);
    g.add(box(0.1, 0.15, 0.26, mats.seat, [-0.23, 1.17, z]));
  }
  g.add(box(0.6, 0.2, 0.22, mats.interior, [0.35, 0.4, 0]));
  g.add(box(0.5, 0.13, 1.36, mats.seat, [-0.65, 0.46, 0]));
  const rb = box(0.12, 0.54, 1.36, mats.seat, [-0.97, 0.76, 0]);
  rb.rotation.z = 0.24;
  g.add(rb);
  g.add(box(0.6, 0.02, 1.4, mats.interior, [-1.38, 1.0, 0]));
  for (const s of [-1, 1]) g.add(box(0.05, 0.7, 0.04, mats.inner, [-0.016, 0.62, s * 0.86]));
  g.traverse((o) => (o.userData.noHighlight = true));
  return g;
}

function trunkBox(ctx) {
  const g = new THREE.Group();
  g.add(box(0.62, 0.02, 1.4, ctx.mats.interior, [-2.05, 0.45, 0]));
  g.add(box(0.02, 0.56, 1.4, ctx.mats.interior, [-1.74, 0.73, 0]));
  g.add(box(0.02, 0.45, 1.4, ctx.mats.inner, [-2.36, 0.68, 0]));
  g.traverse((o) => (o.userData.noHighlight = true));
  return g;
}

function sharkFin(ctx) {
  const x = -0.95;
  const y = ctx.surf.yTop(x);
  const fin = shape([v2(x + 0.09, y - 0.005), v2(x - 0.07, y - 0.005), v2(x - 0.065, y + 0.055), v2(x - 0.04, y + 0.06)]);
  return mesh(extrudeZ(fin, -0.03, 0.03), ctx.mats.paint);
}

function exhaust(ctx) {
  const { mats } = ctx;
  const g = new THREE.Group();
  const pipe = mesh(new THREE.CylinderGeometry(0.03, 0.03, 3.2, 10), mats.disc);
  pipe.rotation.z = Math.PI / 2;
  pipe.position.set(-0.7, 0.2, 0.3);
  g.add(pipe);
  const stock = new THREE.Group();
  stock.name = 'escape_original';
  const tip = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.14, 14), mats.chrome);
  tip.rotation.z = Math.PI / 2;
  tip.position.set(-2.36, 0.24, 0.45);
  stock.add(tip, box(0.4, 0.12, 0.3, mats.disc, [-2.05, 0.22, 0.4]));
  const dual = new THREE.Group();
  dual.name = 'escape_doble';
  dual.visible = false;
  dual.add(box(0.45, 0.14, 1.0, mats.disc, [-2.05, 0.23, 0]));
  for (const s of [-1, 1]) {
    const t = mesh(new THREE.CylinderGeometry(0.048, 0.042, 0.2, 18, 1, true), mats.chrome);
    t.rotation.z = Math.PI / 2;
    t.position.set(-2.38, 0.29, s * 0.52);
    const inner = mesh(new THREE.CircleGeometry(0.04, 18), mats.trim);
    inner.rotation.y = -Math.PI / 2;
    inner.position.set(-2.42, 0.29, s * 0.52);
    dual.add(t, inner);
  }
  g.add(stock, dual);
  g.traverse((o) => (o.userData.noHighlight = true));
  return g;
}
