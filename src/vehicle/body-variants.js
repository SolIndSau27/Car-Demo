import * as THREE from 'three';
import { arc, sample, shape, extrudeZ, mesh, box, v2 } from './geometry.js';

/**
 * Geometrías intercambiables de carrocería (fascia, salpicaderas, alerón).
 * Cada builder devuelve un Group en coordenadas del carro; el ensamblado lo coloca en su contenedor.
 */

export function buildFrontFascia(variant, ctx) {
  const { mats } = ctx;
  const g = new THREE.Group();
  const pts = [
    [2.05, 0.25], [2.32, 0.26], [2.41, 0.33], [2.435, 0.47], [2.43, 0.6], [2.39, 0.69], [2.27, 0.752], [2.05, 0.768],
  ].map(([x, y]) => v2(x, y));
  g.add(ctx.body(shape(pts), -0.935, 0.935, mats.paint, 16));

  // Faros: siguen la pendiente superior de la fascia.
  const hl = shape([v2(2.25, 0.758), v2(2.385, 0.702), v2(2.405, 0.672), v2(2.37, 0.664), v2(2.24, 0.735)]);
  for (const s of [-1, 1]) {
    const m = ctx.body(hl, s * 0.42, s * 0.9, mats.headlight);
    m.name = 'faro';
    g.add(m);
  }

  // Parrilla (sin emblema).
  const grilleShape = shape([v2(2.415, 0.49), v2(2.445, 0.49), v2(2.44, 0.655), v2(2.405, 0.66)]);
  g.add(ctx.body(grilleShape, -0.4, 0.4, mats.trim));

  if (variant === 'deportiva') {
    // Toma inferior grande, tomas laterales y splitter.
    g.add(ctx.body(shape([v2(2.4, 0.27), v2(2.43, 0.27), v2(2.445, 0.45), v2(2.42, 0.45)]), -0.62, 0.62, mats.trim));
    for (const s of [-1, 1]) {
      g.add(ctx.body(shape([v2(2.37, 0.3), v2(2.425, 0.32), v2(2.44, 0.5), v2(2.39, 0.5)]), s * 0.66, s * 0.84, mats.trim));
    }
    g.add(ctx.body(shape([v2(2.2, 0.215), v2(2.5, 0.215), v2(2.5, 0.235), v2(2.2, 0.245)]), -0.8, 0.8, mats.trim));
    for (let i = 0; i < 3; i++) g.add(box(0.012, 0.012, 0.74, mats.paint, [2.446, 0.53 + i * 0.045, 0]));
  } else if (variant === 'touring') {
    g.add(ctx.body(shape([v2(2.405, 0.3), v2(2.43, 0.3), v2(2.44, 0.42), v2(2.415, 0.42)]), -0.48, 0.48, mats.trim));
    for (let i = 0; i < 3; i++) g.add(box(0.014, 0.018, 0.76, mats.chrome, [2.448, 0.52 + i * 0.05, 0]));
    for (const s of [-1, 1]) {
      const fog = mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 20), mats.headlight);
      fog.rotation.z = Math.PI / 2;
      fog.position.set(2.405, 0.37, s * 0.66);
      const ring = mesh(new THREE.TorusGeometry(0.05, 0.008, 8, 24), mats.chrome);
      ring.rotation.y = Math.PI / 2;
      ring.position.set(2.42, 0.37, s * 0.66);
      g.add(fog, ring);
    }
  } else {
    g.add(ctx.body(shape([v2(2.405, 0.3), v2(2.43, 0.3), v2(2.44, 0.42), v2(2.415, 0.42)]), -0.5, 0.5, mats.trim));
    for (let i = 0; i < 3; i++) g.add(box(0.01, 0.012, 0.76, mats.disc, [2.446, 0.52 + i * 0.05, 0]));
  }
  return g;
}

/** Salpicadera delantera (lado s = -1 izq, +1 der). */
export function buildFender(variant, s, ctx) {
  const { xf, ra, cy, hoodY, mats } = ctx;
  const g = new THREE.Group();
  const pts = [
    v2(0.985, 0.28),
    ...sample(hoodY, 0.985, 2.1, 10),
    v2(2.1, 0.3),
    v2(xf + ra, 0.3),
    ...arc(xf, cy, ra, 0, Math.PI, 20),
    v2(xf - ra, 0.28),
  ];
  g.add(ctx.body(shape(pts), s * 0.8, s * 0.93, mats.paint));
  if (variant === 'ensanchado') g.add(archFlare(ctx, xf, s));
  if (variant === 'ventilado') {
    const vent = shape([v2(1.0, 0.6), v2(1.2, 0.6), v2(1.24, 0.7), v2(1.04, 0.7)]);
    g.add(ctx.body(vent, s * 0.925, s * 0.945, mats.trim));
    for (let i = 0; i < 3; i++) {
      const y = 0.62 + i * 0.03;
      const slat = shape([v2(1.01 + i * 0.012, y), v2(1.21 + i * 0.012, y), v2(1.215 + i * 0.012, y + 0.012), v2(1.015 + i * 0.012, y + 0.012)]);
      g.add(ctx.body(slat, s * 0.94, s * 0.95, mats.chrome));
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
  const outer = arc(x, cy, ra + 0.055, -0.08, Math.PI + 0.08, 22);
  const inner = arc(x, cy, ra - 0.005, Math.PI + 0.08, -0.08, 22);
  return ctx.body(shape([...outer, ...inner]), s * 0.9, s * 0.975, ctx.mats.trim);
}

export function buildSpoiler(variant, ctx) {
  const { mats, sil } = ctx;
  const k = sil.cajuela;
  const g = new THREE.Group();
  if (variant === 'labio') {
    const lip = shape([v2(k.x_atras + 0.1, k.y_atras + 0.005), v2(k.x_atras - 0.01, k.y_atras - 0.005), v2(k.x_atras - 0.02, k.y_atras + 0.035)]);
    g.add(ctx.body(lip, -0.7, 0.7, mats.paint));
  } else if (variant === 'ala') {
    const y = 1.17;
    const wing = shape([v2(-2.06, y), v2(-2.2, y + 0.025), v2(-2.33, y + 0.03), v2(-2.34, y + 0.005), v2(-2.2, y - 0.012)]);
    g.add(mesh(extrudeZ(wing, -0.74, 0.74), mats.paint));
    for (const s of [-1, 1]) {
      const post = box(0.06, 0.16, 0.02, mats.trim, [-2.2, y - 0.08, s * 0.5]);
      g.add(post);
      const plate = box(0.3, 0.07, 0.008, mats.trim, [-2.2, y + 0.01, s * 0.745]);
      g.add(plate);
    }
  }
  return g;
}
