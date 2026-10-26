import * as THREE from 'three';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Utilidades de geometría procedural (perfiles laterales extruidos a lo ancho). */

export const v2 = (x, y) => new THREE.Vector2(x, y);

/** Interpola y en una polilínea [[x,y],...] (x en cualquier orden). */
export function interp(points, x) {
  const pts = [...points].sort((a, b) => a[0] - b[0]);
  if (x <= pts[0][0]) return pts[0][1];
  if (x >= pts[pts.length - 1][0]) return pts[pts.length - 1][1];
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    if (x <= x1) {
      const [x0, y0] = pts[i - 1];
      return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return pts[pts.length - 1][1];
}

/** Puntos de un arco (centro, radio, ángulo inicial y final en radianes). */
export function arc(cx, cy, r, a0, a1, n = 18) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    out.push(v2(cx + r * Math.cos(a), cy + r * Math.sin(a)));
  }
  return out;
}

/** Muestrea una función y(x) entre x0 y x1. */
export function sample(fn, x0, x1, n = 12) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    out.push(v2(x, fn(x)));
  }
  return out;
}

export function shape(points, holes = []) {
  const s = new THREE.Shape(points.map((p) => (p.isVector2 ? p : v2(p[0], p[1]))));
  holes.forEach((h) => s.holes.push(new THREE.Path(h.map((p) => (p.isVector2 ? p : v2(p[0], p[1]))))));
  return s;
}

/** Extruye un perfil XY a lo ancho (eje z) entre z0 y z1. */
export function extrudeZ(shp, z0, z1, curveSegments = 12) {
  const g = new THREE.ExtrudeGeometry(shp, { depth: Math.abs(z1 - z0), bevelEnabled: false, curveSegments });
  g.translate(0, 0, Math.min(z0, z1));
  return g;
}

/** Perfil "tira": una polilínea con grosor hacia abajo (para techo, cofre, cristales). */
export function strip(points, thick, dir = [0, -1]) {
  const top = points.map((p) => (p.isVector2 ? p : v2(p[0], p[1])));
  const bottom = top.map((p) => v2(p.x + dir[0] * thick, p.y + dir[1] * thick)).reverse();
  return shape([...top, ...bottom]);
}

/** Curva cuadrática suave entre a y b con un abombado perpendicular. */
export function bulge(a, b, amount, n = 10) {
  const out = [];
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const c = [mx - (dy / len) * amount, my + (dx / len) * amount];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = (1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t ** 2 * b[0];
    const y = (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t ** 2 * b[1];
    out.push(v2(x, y));
  }
  return out;
}

/**
 * Da forma de carro a una geometría en coordenadas del carro:
 * estrecha z según la altura (caída de los costados y del techo) y en la nariz/cola.
 */
export function makeBodyShaper(sil) {
  const belt = 0.97;
  const roofTop = 1.46;
  const front = sil.frente_x;
  const rear = sil.trasera_x;
  return function factor(x, y) {
    let f = 1;
    if (y > belt) f *= 1 - 0.2 * Math.min(1, (y - belt) / (roofTop - belt));
    if (y < 0.38) f *= 0.95 + 0.05 * Math.max(0, (y - 0.2) / 0.18);
    if (y > 0.82 && y <= belt) f *= 1 - 0.012 * ((y - 0.82) / (belt - 0.82));
    const xf = front - 0.55;
    if (x > xf) f *= 1 - 0.13 * ((x - xf) / (front - xf)) ** 2;
    const xr = rear + 0.5;
    if (x < xr) f *= 1 - 0.09 * ((xr - x) / (xr - rear)) ** 2;
    return f;
  };
}

/** Aplica el estrechamiento a una geometría y recalcula normales suaves con aristas marcadas. */
export function shapeBody(geometry, factor, crease = Math.PI / 5) {
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    pos.setZ(i, pos.getZ(i) * factor(x, y));
  }
  pos.needsUpdate = true;
  return toCreasedNormals(geometry, crease);
}

export function mesh(geometry, material, name) {
  const m = new THREE.Mesh(geometry, material);
  if (name) m.name = name;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function box(sx, sy, sz, material, [x, y, z] = [0, 0, 0]) {
  const m = mesh(new THREE.BoxGeometry(sx, sy, sz), material);
  m.position.set(x, y, z);
  return m;
}
