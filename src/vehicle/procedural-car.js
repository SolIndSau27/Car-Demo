import * as THREE from 'three';
import { interp, arc, sample, shape, extrudeZ, strip, bulge, makeBodyShaper, shapeBody, mesh, box, v2 } from './geometry.js';
import { parseTireSize } from '../configurator/tires.js';

/**
 * Construye el carro procedural a partir de la "silueta" del JSON del vehículo.
 * Todo se modela en coordenadas del carro: +x frente, +y arriba, +z lado derecho, piso en y = 0.
 * Devuelve nodos con los mismos nombres que tendría un .glb (ver model-source.js).
 */
export function buildProceduralCar(vehicle, mats) {
  const ctx = createContext(vehicle, mats);
  const nodes = {};

  // Carrocería fija: costados traseros, techo, cristales, piso, interiores.
  const carroceria = new THREE.Group();
  carroceria.name = 'carroceria';
  for (const s of [-1, 1]) {
    carroceria.add(quarterPanel(ctx, s), sideFrame(ctx, s), rocker(ctx, s), quarterGlass(ctx, s));
    carroceria.add(archLiner(ctx, ctx.xf, s), archLiner(ctx, ctx.xr, s));
  }
  carroceria.add(roof(ctx), windshield(ctx), rearGlass(ctx), rearFascia(ctx), underbody(ctx));
  carroceria.add(engineBay(ctx), interior(ctx), trunkBox(ctx));
  nodes.carroceria = carroceria;

  // Puertas.
  const sp = vehicle.silueta;
  nodes.puerta_del_izq = door(ctx, sp.puerta_delantera, -1, true);
  nodes.puerta_del_der = door(ctx, sp.puerta_delantera, 1, true);
  nodes.puerta_tras_izq = door(ctx, sp.puerta_trasera, -1, false);
  nodes.puerta_tras_der = door(ctx, sp.puerta_trasera, 1, false);

  nodes.cofre = hood(ctx);
  nodes.cajuela = trunkLid(ctx);
  nodes.escape = exhaust(ctx);

  // Contenedores para piezas intercambiables (las llena body-variants.js).
  for (const id of ['fascia_delantera', 'salpicadera_izq', 'salpicadera_der', 'extensiones_traseras', 'aleron']) {
    const g = new THREE.Group();
    g.name = id;
    nodes[id] = g;
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

function createContext(vehicle, mats) {
  const sil = vehicle.silueta;
  const dims = vehicle.dimensiones;
  const F = makeBodyShaper(sil);
  const xf = dims.eje_delantero_x;
  const xr = xf - dims.distancia_ejes_m;
  const ra = dims.radio_arco_m;
  const cy = parseTireSize(vehicle.llantas.referencia).diametroMm / 2000;
  const belt = (x) => interp(sil.cintura, x);
  const roofY = (x) => interp(sil.techo, x);
  const c = sil.cofre;
  const hoodY = (x) => {
    const t = THREE.MathUtils.clamp((x - c.x_atras) / (c.x_frente - c.x_atras), 0, 1);
    return c.y_atras + (c.y_frente - c.y_atras) * t ** 1.35 + 0.018 * Math.sin(Math.PI * t);
  };
  const k = sil.cajuela;
  const trunkY = (x) => {
    const t = THREE.MathUtils.clamp((x - k.x_frente) / (k.x_atras - k.x_frente), 0, 1);
    return k.y_frente + (k.y_atras - k.y_frente) * t ** 1.6 + 0.01 * Math.sin(Math.PI * t);
  };
  /** Extruye un perfil a lo ancho y le da forma de carrocería. */
  const body = (shp, z0, z1, material, segs = 12) => mesh(shapeBody(extrudeZ(shp, z0, z1, segs), F), material);
  /** z de la superficie exterior en (x, y) para colocar detalles (manijas, espejos). */
  const surfaceZ = (x, y, s, z = 0.93) => s * z * F(x, y);
  return { vehicle, sil, dims, F, mats, xf, xr, ra, cy, belt, roofY, hoodY, trunkY, body, surfaceZ };
}

/** Polígono de ventana entre x0 < x1, debajo del techo y arriba de la cintura. */
export function windowPolygon(ctx, x0, x1, n = 10) {
  const { belt, roofY } = ctx;
  const pts = [v2(x0, belt(x0) + 0.02), v2(x1, belt(x1) + 0.02)];
  for (let i = 0; i <= n; i++) {
    const x = x1 - ((x1 - x0) * i) / n;
    pts.push(v2(x, Math.max(roofY(x) - 0.055, belt(x) + 0.032)));
  }
  return pts;
}

const WINDOWS = {
  delantera: [0.035, 0.83],
  trasera: [-0.89, -0.105],
  cuarto: [-1.5, -0.99],
};

function quarterPanel(ctx, s) {
  const { xr, ra, cy, belt, trunkY } = ctx;
  const xEnd = -2.2;
  const pts = [
    v2(-0.965, 0.28),
    ...sample(belt, -0.965, -1.72, 6),
    ...sample(trunkY, -1.72, xEnd, 6).slice(1),
    v2(xEnd, 0.3),
    v2(xr - ra, 0.3),
    ...arc(xr, cy, ra, Math.PI, 0, 20),
    v2(xr + ra, 0.28),
  ];
  return ctx.body(shape(pts), s * 0.8, s * 0.93, ctx.mats.paint);
}

function sideFrame(ctx, s) {
  const { belt, roofY } = ctx;
  const x0 = -1.72;
  const x1 = 0.975;
  const outline = [...sample(belt, x1, x0, 10), ...sample(roofY, x0, x1, 28).slice(1, -1)];
  const holes = Object.values(WINDOWS).map(([a, b]) => windowPolygon(ctx, a, b));
  return ctx.body(shape(outline, holes), s * 0.9, s * 0.925, ctx.mats.paint, 24);
}

function quarterGlass(ctx, s) {
  const [a, b] = WINDOWS.cuarto;
  return ctx.body(shape(windowPolygon(ctx, a - 0.01, b + 0.01)), s * 0.893, s * 0.9, ctx.mats.glass);
}

function rocker(ctx, s) {
  const { xf, xr, ra } = ctx;
  const pts = [v2(xr + ra, 0.2), v2(xf - ra, 0.2), v2(xf - ra, 0.285), v2(xr + ra, 0.285)];
  return ctx.body(shape(pts), s * 0.82, s * 0.925, ctx.mats.trim);
}

function archLiner(ctx, x, s) {
  const { ra, cy } = ctx;
  const outer = arc(x, cy, ra, 0, Math.PI, 20);
  const inner = arc(x, cy, ra + 0.012, Math.PI, 0, 20);
  const g = mesh(extrudeZ(shape([...outer, ...inner]), s * 0.55, s * 0.9), ctx.mats.inner);
  g.userData.noHighlight = true;
  return g;
}

function roof(ctx) {
  const pts = sample(ctx.roofY, 0.06, -0.88, 18);
  return ctx.body(strip(pts, 0.025), -0.925, 0.925, ctx.mats.paint);
}

function windshield(ctx) {
  const pts = bulge([0.985, 0.952], [0.06, 1.415], -0.02, 12);
  return ctx.body(strip(pts, 0.012), -0.915, 0.915, ctx.mats.glass);
}

function rearGlass(ctx) {
  const pts = bulge([-0.88, 1.418], [-1.72, 1.03], -0.035, 12);
  return ctx.body(strip(pts, 0.012), -0.915, 0.915, ctx.mats.glass);
}

function rearFascia(ctx) {
  const g = new THREE.Group();
  const pts = [
    [-2.15, 0.25], [-2.36, 0.27], [-2.42, 0.36], [-2.432, 0.55], [-2.42, 0.68], [-2.4, 0.8], [-2.34, 0.9], [-2.15, 0.93],
  ].map(([x, y]) => v2(x, y));
  g.add(ctx.body(shape(pts), -0.935, 0.935, ctx.mats.paint));
  // Calaveras (sin logos ni letras).
  const tl = shape([v2(-2.3, 0.79), v2(-2.407, 0.79), v2(-2.346, 0.895), v2(-2.3, 0.895)]);
  for (const s of [-1, 1]) g.add(ctx.body(tl, s * 0.5, s * 0.9, ctx.mats.taillight));
  // Zona de placa (en blanco) y difusor.
  g.add(box(0.01, 0.15, 0.5, ctx.mats.trim, [-2.437, 0.56, 0]));
  const dif = shape([v2(-2.2, 0.24), v2(-2.37, 0.26), v2(-2.41, 0.33), v2(-2.2, 0.3)]);
  g.add(ctx.body(dif, -0.7, 0.7, ctx.mats.trim));
  return g;
}

function underbody(ctx) {
  const g = new THREE.Group();
  const floor = box(4.1, 0.03, 1.6, ctx.mats.trim, [0, 0.205, 0]);
  floor.userData.noHighlight = true;
  g.add(floor);
  return g;
}

function engineBay(ctx) {
  const { mats, hoodY } = ctx;
  const g = new THREE.Group();
  g.add(box(1.08, 0.02, 1.56, mats.inner, [1.53, 0.23, 0]));
  // Muro de fuego y soporte de radiador.
  g.add(box(0.03, 0.64, 1.56, mats.inner, [0.975, 0.62, 0]));
  g.add(box(0.05, 0.42, 1.4, mats.inner, [2.04, 0.53, 0]));
  const rad = box(0.03, 0.36, 1.2, mats.trim, [2.0, 0.53, 0]);
  g.add(rad);
  // Faldones internos (tapan los arcos vistos desde arriba).
  for (const s of [-1, 1]) {
    const pts = [v2(0.99, 0.3), v2(2.06, 0.3), ...sample((x) => hoodY(x) - 0.06, 2.06, 0.99, 8)];
    const apron = mesh(extrudeZ(shape(pts), s * 0.775, s * 0.79), mats.inner);
    g.add(apron);
    // Torres de suspensión.
    const tower = mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.3, 16), mats.inner);
    tower.position.set(ctx.xf, 0.62, s * 0.68);
    g.add(tower);
  }
  // Batería y depósitos.
  g.add(box(0.2, 0.17, 0.26, mats.trim, [1.75, 0.5, -0.56]));
  const pos = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.02, 10), new THREE.MeshStandardMaterial({ color: 0xb3261e }));
  pos.position.set(1.8, 0.595, -0.5);
  g.add(pos);
  const res = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.1, 14), new THREE.MeshStandardMaterial({ color: 0xd9d4c5, roughness: 0.6 }));
  res.position.set(1.12, 0.66, 0.55);
  g.add(res);
  g.traverse((o) => (o.userData.noHighlight = true));
  return g;
}

function interior(ctx) {
  const { mats } = ctx;
  const g = new THREE.Group();
  g.add(box(2.0, 0.03, 1.62, mats.interior, [0, 0.27, 0]));
  const dash = shape([v2(0.97, 0.68), v2(0.97, 0.93), v2(0.8, 0.975), v2(0.62, 0.93), v2(0.57, 0.78), v2(0.68, 0.68)]);
  g.add(ctx.body(dash, -0.82, 0.82, mats.interior));
  // Volante (lado izquierdo, -z).
  const wheel = new THREE.Group();
  const rimT = mesh(new THREE.TorusGeometry(0.18, 0.02, 10, 32), mats.trim);
  rimT.rotation.y = Math.PI / 2;
  wheel.add(rimT);
  const hub = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 16), mats.trim);
  hub.rotation.z = Math.PI / 2;
  wheel.add(hub);
  wheel.position.set(0.5, 0.86, -0.37);
  wheel.rotation.z = 0.38;
  g.add(wheel);
  for (const z of [-0.37, 0.37]) {
    g.add(box(0.5, 0.12, 0.5, mats.seat, [0.15, 0.47, z]));
    const back = box(0.12, 0.64, 0.5, mats.seat, [-0.14, 0.8, z]);
    back.rotation.z = 0.18;
    g.add(back);
    g.add(box(0.1, 0.16, 0.26, mats.seat, [-0.22, 1.2, z]));
  }
  g.add(box(0.6, 0.2, 0.22, mats.interior, [0.35, 0.4, 0]));
  g.add(box(0.5, 0.13, 1.36, mats.seat, [-0.65, 0.47, 0]));
  const rb = box(0.12, 0.56, 1.36, mats.seat, [-0.97, 0.78, 0]);
  rb.rotation.z = 0.22;
  g.add(rb);
  g.add(box(0.7, 0.02, 1.5, mats.interior, [-1.38, 1.0, 0]));
  // Poste B interior (tapa el hueco entre puertas).
  for (const s of [-1, 1]) g.add(box(0.05, 0.7, 0.04, mats.inner, [-0.02, 0.62, s * 0.86]));
  g.traverse((o) => (o.userData.noHighlight = true));
  return g;
}

function trunkBox(ctx) {
  const g = new THREE.Group();
  g.add(box(0.62, 0.02, 1.5, ctx.mats.interior, [-2.03, 0.45, 0]));
  g.add(box(0.02, 0.56, 1.5, ctx.mats.interior, [-1.72, 0.73, 0]));
  g.add(box(0.02, 0.45, 1.5, ctx.mats.inner, [-2.33, 0.68, 0]));
  g.traverse((o) => (o.userData.noHighlight = true));
  return g;
}

function door(ctx, def, s, front) {
  const { belt, mats } = ctx;
  const xa = def.x_frente;
  const xb = def.x_atras;
  const g = new THREE.Group();
  const outline = [v2(xa, 0.285), ...sample(belt, xa, xb, 8), v2(xb, 0.285)];
  g.add(ctx.body(shape(outline), s * 0.862, s * 0.93, mats.paint));
  // Panel interior.
  const inset = [v2(xa - 0.03, 0.33), ...sample((x) => belt(x) - 0.02, xa - 0.03, xb + 0.03, 6), v2(xb + 0.03, 0.33)];
  g.add(ctx.body(shape(inset), s * 0.845, s * 0.863, mats.interior));
  // Cristal.
  const [a, b] = front ? WINDOWS.delantera : WINDOWS.trasera;
  g.add(ctx.body(shape(windowPolygon(ctx, a - 0.012, b + 0.012)), s * 0.893, s * 0.9, mats.glass));
  // Manija.
  const hx = xb + 0.2;
  const handle = box(0.13, 0.025, 0.02, mats.chrome, [hx, 0.86, ctx.surfaceZ(hx, 0.86, s, 0.937)]);
  g.add(handle);
  if (front) {
    const mirror = new THREE.Group();
    const housing = box(0.09, 0.1, 0.17, mats.paint, [0, 0, s * 0.08]);
    const arm = box(0.05, 0.04, 0.08, mats.trim, [0.0, -0.02, s * 0.0]);
    const glass = box(0.005, 0.085, 0.15, mats.glass, [-0.047, 0, s * 0.08]);
    mirror.add(housing, arm, glass);
    mirror.position.set(0.8, 1.02, ctx.surfaceZ(0.8, 1.0, s, 0.93));
    g.add(mirror);
  }
  return g;
}

function hood(ctx) {
  const { hoodY, sil } = ctx;
  const c = sil.cofre;
  const pts = sample(hoodY, c.x_atras + 0.005, c.x_frente - 0.01, 16);
  pts.push(v2(c.x_frente + 0.01, hoodY(c.x_frente) - 0.025));
  const g = new THREE.Group();
  g.add(ctx.body(strip(pts, 0.03), -0.795, 0.795, ctx.mats.paint));
  // Refuerzo interior visible al abrir.
  const under = mesh(new THREE.BoxGeometry(1.0, 0.01, 1.3), ctx.mats.inner);
  under.position.set((c.x_atras + c.x_frente) / 2, hoodY((c.x_atras + c.x_frente) / 2) - 0.038, 0);
  under.rotation.z = Math.atan2(c.y_frente - c.y_atras, c.x_frente - c.x_atras);
  under.userData.noHighlight = true;
  g.add(under);
  return g;
}

function trunkLid(ctx) {
  const { trunkY, sil } = ctx;
  const k = sil.cajuela;
  const g = new THREE.Group();
  g.add(ctx.body(strip(sample(trunkY, k.x_frente, k.x_atras, 12), 0.03), -0.79, 0.79, ctx.mats.paint));
  const lip = shape([v2(k.x_atras + 0.005, k.y_atras + 0.002), v2(k.x_atras - 0.025, k.y_atras - 0.01), v2(k.x_atras - 0.03, 0.925), v2(k.x_atras + 0.002, 0.925)]);
  g.add(ctx.body(lip, -0.79, 0.79, ctx.mats.paint));
  // Panel de placa trasera vacío (sin logos).
  g.add(box(0.008, 0.06, 0.6, ctx.mats.trim, [k.x_atras - 0.03, 0.955, 0]));
  return g;
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
  tip.position.set(-2.36, 0.22, 0.45);
  stock.add(tip, box(0.4, 0.12, 0.3, mats.disc, [-2.05, 0.22, 0.4]));
  const dual = new THREE.Group();
  dual.name = 'escape_doble';
  dual.visible = false;
  dual.add(box(0.45, 0.14, 1.0, mats.disc, [-2.05, 0.23, 0]));
  for (const s of [-1, 1]) {
    const t = mesh(new THREE.CylinderGeometry(0.048, 0.042, 0.2, 18, 1, true), mats.chrome);
    t.rotation.z = Math.PI / 2;
    t.position.set(-2.36, 0.25, s * 0.55);
    const inner = mesh(new THREE.CircleGeometry(0.04, 18), mats.trim);
    inner.rotation.y = -Math.PI / 2;
    inner.position.set(-2.4, 0.25, s * 0.55);
    dual.add(t, inner);
  }
  g.add(stock, dual);
  g.traverse((o) => (o.userData.noHighlight = true));
  return g;
}
