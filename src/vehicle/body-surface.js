import * as THREE from 'three';
import { interp } from './geometry.js';

/**
 * Superficie de carrocería "lofteada": para cada x hay una sección transversal curva
 * definida por 8 puntos de control (lado derecho, z >= 0):
 *
 *   t=0 centro inferior · 1 estribo · 2 costado bajo · 3 hombro (lo más ancho)
 *   t=4 cintura / borde del cofre · 5 media ventana · 6 borde del techo · 7 centro superior
 *
 * Cada panel (puerta, cofre, cristal…) es una región [x0,x1] × [t0,t1] de esta misma
 * superficie, así todas las líneas de corte coinciden. Los perfiles salen del JSON (silueta).
 */
export function createBodySurface(sil) {
  const yTop = smoothProfile(sil.centro);
  const yBelt = smoothProfile(sil.cintura);
  const wMax = smoothProfile(sil.media_anchura);
  const yRock = smoothProfile(sil.estribo);
  const crown = sil.corona ?? 0.045;

  function controlPoints(x) {
    const wM = wMax(x);
    const yT = yTop(x);
    const yB = Math.min(yBelt(x), yT - 0.004);
    const yR = yRock(x);
    const yE = Math.min(Math.max(yT - crown, yB + 0.012), yT - 0.002);
    const gh = THREE.MathUtils.clamp((yE - yB) / 0.3, 0, 1);
    const wE = wM * (0.9 - 0.16 * gh);
    const yS = yR + 0.13 + (yB - yR - 0.13) * 0.7;
    return [
      [0, yR - 0.05],
      [wM * 0.93, yR],
      [wM * 0.99, yR + 0.13],
      [wM, yS],
      [wM * 0.975, yB],
      [(wM * 0.975 + wE) / 2 + 0.014 * gh, (yB + yE) / 2],
      [wE, yE],
      [0, yT],
    ];
  }

  /** Punto (z, y) de la sección en x para el parámetro t ∈ [0, 7] (Catmull-Rom). */
  function section(x, t, cp = controlPoints(x)) {
    const P = (i) => {
      if (i < 0) return [-cp[1][0], cp[1][1]];
      if (i > 7) return [-cp[6][0], cp[6][1]];
      return cp[i];
    };
    t = Number.isFinite(t) ? Math.min(Math.max(t, 0), 7) : 0;
    const i = Math.min(Math.floor(t), 6);
    const u = t - i;
    const p0 = P(i - 1);
    const p1 = P(i);
    const p2 = P(i + 1);
    const p3 = P(i + 2);
    const cr = (a, b, c, d) =>
      0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (-a + 3 * b - 3 * c + d) * u * u * u);
    return { z: Math.max(0, cr(p0[0], p1[0], p2[0], p3[0])), y: cr(p0[1], p1[1], p2[1], p3[1]) };
  }

  /** t del costado (entre tMin y tMax) donde la sección alcanza la altura y. */
  function tForY(x, y, tMin = 0.9, tMax = 3.98) {
    const cp = controlPoints(x);
    if (section(x, tMin, cp).y >= y) return tMin;
    if (section(x, tMax, cp).y <= y) return tMax;
    let a = tMin;
    let b = tMax;
    for (let k = 0; k < 24; k++) {
      const m = (a + b) / 2;
      if (section(x, m, cp).y < y) a = m;
      else b = m;
    }
    return (a + b) / 2;
  }

  /** Punto 3D en la superficie. side = +1 (derecha) o -1 (izquierda). */
  function point(x, t, side = 1, out = 0) {
    const p = section(x, t);
    const v = new THREE.Vector3(x, p.y, side * (p.z + out));
    return v;
  }

  /**
   * Malla de una región de la superficie. t0/t1 pueden ser números o funciones de x.
   * Devuelve la geometría del lado indicado, con normales hacia afuera.
   */
  function patch({ x0, x1, t0, t1, side = 1, nx, nt, out = 0 }) {
    const T0 = typeof t0 === 'function' ? t0 : () => t0;
    const T1 = typeof t1 === 'function' ? t1 : () => t1;
    nx = nx ?? Math.max(2, Math.ceil(Math.abs(x1 - x0) / 0.03));
    nt = nt ?? Math.max(2, Math.ceil(Math.abs(T1((x0 + x1) / 2) - T0((x0 + x1) / 2)) * 7));
    const pos = [];
    const uv = [];
    for (let i = 0; i <= nx; i++) {
      const x = x0 + ((x1 - x0) * i) / nx;
      const cp = controlPoints(x);
      const ta = T0(x);
      const tb = T1(x);
      for (let j = 0; j <= nt; j++) {
        const t = ta + ((tb - ta) * j) / nt;
        const p = section(x, t, cp);
        pos.push(x, p.y, side * (p.z + out));
        uv.push(i / nx, j / nt);
      }
    }
    const idx = [];
    const row = nt + 1;
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nt; j++) {
        const a = i * row + j;
        const b = a + row;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    orientOutward(g);
    return g;
  }

  /** Tapa plana del extremo (nariz o cola) en x, con ambas mitades. */
  function cap(x, facing = 1, tMin = 0, n = 48) {
    const cp = controlPoints(x);
    const half = [];
    for (let k = 0; k <= n; k++) half.push(section(x, tMin + ((7 - tMin) * k) / n, cp));
    const ring = [...half.map((p) => [p.z, p.y]), ...half.slice(1, -1).reverse().map((p) => [-p.z, p.y])];
    const shape = new THREE.Shape(ring.map(([z, y]) => new THREE.Vector2(z, y)));
    const g = new THREE.ShapeGeometry(shape);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const z = p.getX(i);
      const y = p.getY(i);
      p.setXYZ(i, x, y, z);
    }
    g.computeVertexNormals();
    const n0 = new THREE.Vector3().fromBufferAttribute(g.attributes.normal, 0);
    if (Math.sign(n0.x) !== facing) flip(g);
    return g;
  }

  return { section, point, patch, cap, tForY, controlPoints, yTop, yBelt, wMax, yRock };
}

/** Perfil suave a partir de puntos [[x, y], ...] (Catmull-Rom muestreado). */
export function smoothProfile(points) {
  const sorted = [...points].sort((a, b) => a[0] - b[0]);
  const curve = new THREE.SplineCurve(sorted.map(([x, y]) => new THREE.Vector2(x, y)));
  const dense = curve.getPoints(sorted.length * 40).map((p) => [p.x, p.y]);
  return (x) => interp(dense, x);
}

function orientOutward(g) {
  // La normal debe apuntar lejos del eje central del carro (x, 0.75, 0).
  const p = g.attributes.position;
  const n = g.attributes.normal;
  let score = 0;
  const step = Math.max(1, Math.floor(p.count / 40));
  for (let i = 0; i < p.count; i += step) {
    const dy = p.getY(i) - 0.75;
    score += n.getY(i) * dy + n.getZ(i) * p.getZ(i);
  }
  if (score < 0) flip(g);
}

function flip(g) {
  const idx = g.index;
  if (idx) {
    for (let i = 0; i < idx.count; i += 3) {
      const a = idx.getX(i + 1);
      idx.setX(i + 1, idx.getX(i + 2));
      idx.setX(i + 2, a);
    }
    idx.needsUpdate = true;
  }
  const n = g.attributes.normal;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
  n.needsUpdate = true;
}
