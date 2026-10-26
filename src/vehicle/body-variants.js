import * as THREE from 'three';
import { arc, shape, extrudeZ, mesh, box, v2 } from './geometry.js';

/**
 * Geometrías intercambiables de carrocería (fascia, salpicaderas, alerón).
 * Cada builder devuelve un Group en coordenadas del carro; el ensamblado lo coloca en su contenedor.
 * Las piezas base son regiones de la superficie lofteada (ctx.surf); los detalles van encima.
 */

const lerp = (a, b, k) => a + (b - a) * k;

/** Parrilla hexagonal grande (puntos z, y sobre la tapa frontal). */
const HEX = [[-0.4, 0.64], [0.4, 0.64], [0.48, 0.53], [0.38, 0.4], [-0.38, 0.4], [-0.48, 0.53]];
const grow = (pts, k) => pts.map(([z, y]) => [z * k, 0.52 + (y - 0.52) * k]);

export function buildFrontFascia(variant, ctx) {
  const { mats, sil, surf, panel, capShape } = ctx;
  const xt = sil.frente_x;
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    g.add(panel({ x0: sil.fascia_delantera_x, x1: xt, t0: 0.4, t1: 4.0, side: s, nx: 16 }, mats.paint));
    g.add(panel({ x0: sil.cofre.x_frente + 0.004, x1: xt, t0: 4.0, t1: 7, side: s, nx: 8 }, mats.paint));
    // Faros afilados que suben hacia la salpicadera.
    const k = (x) => Math.min(1, (xt - 0.015 - x) / 0.5);
    const headA = panel({ x0: 1.93, x1: xt - 0.015, t0: (x) => lerp(3.22, 3.86, k(x) ** 0.8), t1: 3.995, side: s, nx: 26 }, mats.headlight, false);
    const headB = panel({ x0: sil.cofre.x_frente + 0.01, x1: xt - 0.015, t0: 4.0, t1: (x) => lerp(4.95, 4.05, (xt - x) / 0.24), side: s, nx: 8 }, mats.headlight, false);
    headA.name = headB.name = 'faro';
    g.add(headA, headB);
  }
  g.add(mesh(surf.cap(xt, 1, 0.4), mats.paint));

  const x = xt + 0.002;
  // Parrilla: fondo oscuro + marco cromado (sin emblema).
  g.add(capShape(HEX, x, 1, mats.grille));
  g.add(capShape(grow(HEX, 1.07), x + 0.001, 1, mats.chrome, [HEX.slice().reverse()]));

  if (variant === 'deportiva') {
    g.add(capShape([[-0.5, 0.385], [0.5, 0.385], [0.42, 0.28], [-0.42, 0.28]], x, 1, mats.grille));
    for (const s of [-1, 1]) g.add(capShape([[s * 0.47, 0.42], [s * 0.55, 0.42], [s * 0.55, 0.29], [s * 0.5, 0.29]], x, 1, mats.grille));
    g.add(box(0.22, 0.018, 1.1, mats.trim, [xt - 0.06, 0.255, 0]));
    for (let i = 0; i < 4; i++) {
      const y = 0.43 + i * 0.05;
      const w = 0.4 + (i === 1 || i === 2 ? 0.06 : 0.02);
      g.add(capShape([[-w, y], [w, y], [w, y + 0.008], [-w, y + 0.008]], x + 0.002, 1, mats.trim));
    }
  } else if (variant === 'touring') {
    g.add(capShape([[-0.4, 0.37], [0.4, 0.37], [0.34, 0.3], [-0.34, 0.3]], x, 1, mats.grille));
    for (let i = 0; i < 3; i++) {
      const y = 0.45 + i * 0.06;
      g.add(capShape([[-0.42, y], [0.42, y], [0.42, y + 0.016], [-0.42, y + 0.016]], x + 0.002, 1, mats.chrome));
    }
    for (const s of [-1, 1]) {
      const fog = mesh(new THREE.CircleGeometry(0.042, 24), mats.headlight);
      fog.rotation.y = Math.PI / 2;
      fog.position.set(x + 0.002, 0.335, s * 0.48);
      const ring = mesh(new THREE.TorusGeometry(0.05, 0.007, 8, 28), mats.chrome);
      ring.rotation.y = Math.PI / 2;
      ring.position.set(x + 0.003, 0.335, s * 0.48);
      g.add(fog, ring);
    }
  } else {
    g.add(capShape([[-0.4, 0.37], [0.4, 0.37], [0.34, 0.3], [-0.34, 0.3]], x, 1, mats.grille));
    for (let i = 0; i < 4; i++) {
      const y = 0.43 + i * 0.05;
      const w = 0.4 + (i === 1 || i === 2 ? 0.06 : 0.02);
      g.add(capShape([[-w, y], [w, y], [w, y + 0.01], [-w, y + 0.01]], x + 0.002, 1, mats.chrome));
    }
    for (const s of [-1, 1]) g.add(capShape([[s * 0.46, 0.39], [s * 0.54, 0.4], [s * 0.54, 0.31], [s * 0.47, 0.3]], x, 1, mats.grille));
  }
  return g;
}

/** Salpicadera delantera (lado s = -1 izq, +1 der). */
export function buildFender(variant, s, ctx) {
  const { mats, sil, panel } = ctx;
  const g = new THREE.Group();
  g.add(panel({ x0: sil.puerta_delantera.x_frente + 0.004, x1: sil.fascia_delantera_x, t0: ctx.archT, t1: 4.0, side: s, nx: 70 }, mats.paint));
  if (variant === 'ensanchado') g.add(archFlare(ctx, ctx.xf, s));
  if (variant === 'ventilado') {
    g.add(panel({ x0: 1.0, x1: 1.2, t0: 3.15, t1: 3.5, side: s, out: 0.004 }, mats.grille, false));
    for (let i = 0; i < 3; i++) {
      const t = 3.2 + i * 0.1;
      g.add(panel({ x0: 1.005, x1: 1.195, t0: t, t1: t + 0.03, side: s, out: 0.007 }, mats.chrome, false));
    }
  }
  return g;
}

export function buildRearFlares(variant, ctx) {
  const g = new THREE.Group();
  if (variant === 'ensanchado') for (const s of [-1, 1]) g.add(archFlare(ctx, ctx.xr, s));
  return g;
}

function archFlare(ctx, x, s) {
  const { ra, cy } = ctx;
  const outer = arc(x, cy, ra + 0.055, -0.06, Math.PI + 0.06, 24);
  const inner = arc(x, cy, ra - 0.004, Math.PI + 0.06, -0.06, 24);
  return mesh(extrudeZ(shape([...outer, ...inner]), s * 0.86, s * 0.975), ctx.mats.trim);
}

export function buildSpoiler(variant, ctx) {
  const { mats, surf, sil } = ctx;
  const xr = sil.cajuela.x_atras;
  const g = new THREE.Group();
  if (variant === 'labio') {
    const lip = shape([v2(xr + 0.12, surf.yTop(xr + 0.12) - 0.004), v2(xr - 0.005, surf.yTop(xr) - 0.004), v2(xr - 0.01, surf.yTop(xr) + 0.035)]);
    g.add(mesh(extrudeZ(lip, -0.66, 0.66), mats.paint));
  } else if (variant === 'ala') {
    const y = 1.19;
    const wing = shape([v2(-2.08, y), v2(-2.2, y + 0.025), v2(-2.36, y + 0.03), v2(-2.37, y + 0.005), v2(-2.2, y - 0.012)]);
    g.add(mesh(extrudeZ(wing, -0.72, 0.72), mats.paint));
    for (const s of [-1, 1]) {
      const yb = surf.yTop(-2.22);
      g.add(box(0.06, y - yb, 0.02, mats.trim, [-2.22, (y + yb) / 2, s * 0.5]));
      g.add(box(0.3, 0.07, 0.008, mats.trim, [-2.22, y + 0.01, s * 0.725]));
    }
  }
  return g;
}
