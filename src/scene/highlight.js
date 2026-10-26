import * as THREE from 'three';

/**
 * Resaltado por intercambio de material (sin post-proceso, rápido en celular).
 * Cada malla puede estar en 'hover' y/o 'select'; 'select' gana.
 */
const COLORS = { hover: new THREE.Color(0x2a6cff), select: new THREE.Color(0xff7a1a) };
const original = new WeakMap(); // mesh -> material original
const cache = new WeakMap(); // material original -> { hover, select }
const states = new WeakMap(); // mesh -> Set de estados

function variant(mat, kind) {
  let entry = cache.get(mat);
  if (!entry) cache.set(mat, (entry = {}));
  if (!entry[kind]) {
    const m = mat.clone();
    if ('emissive' in m) {
      m.emissive = COLORS[kind].clone();
      m.emissiveIntensity = kind === 'select' ? 0.55 : 0.35;
    } else if (m.color) {
      m.color = m.color.clone().lerp(COLORS[kind], 0.5);
    }
    entry[kind] = m;
  }
  // Mantener sincronizados color/opacidad si cambiaron en el original (ej. pintura).
  const v = entry[kind];
  if (mat.color && v.color) v.color.copy(mat.color);
  v.opacity = mat.opacity;
  v.transparent = mat.transparent;
  v.visible = mat.visible;
  return v;
}

function apply(mesh) {
  const set = states.get(mesh);
  const base = original.get(mesh) ?? mesh.material;
  if (!set || set.size === 0) {
    if (original.has(mesh)) {
      mesh.material = original.get(mesh);
      original.delete(mesh);
    }
    return;
  }
  if (!original.has(mesh)) original.set(mesh, mesh.material);
  const kind = set.has('select') ? 'select' : 'hover';
  mesh.material = Array.isArray(base) ? base.map((m) => variant(m, kind)) : variant(base, kind);
}

export function setHighlight(root, kind, on) {
  if (!root) return;
  root.traverse((o) => {
    if (!o.isMesh || o.userData.noHighlight) return;
    let set = states.get(o);
    if (!set) states.set(o, (set = new Set()));
    if (on) set.add(kind);
    else set.delete(kind);
    apply(o);
  });
}

/** Material "real" de una malla aunque esté resaltada. */
export function baseMaterial(mesh) {
  return original.get(mesh) ?? mesh.material;
}

/** Reemplaza el material base de una malla respetando el resaltado activo. */
export function setBaseMaterial(mesh, material) {
  if (original.has(mesh)) {
    original.set(mesh, material);
    apply(mesh);
  } else {
    mesh.material = material;
  }
}
