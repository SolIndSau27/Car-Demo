import * as THREE from 'three';

export function createMaterials() {
  return {
    paint: new THREE.MeshPhysicalMaterial({ color: 0x1d2f55, roughness: 0.3, metalness: 0.7, clearcoat: 1, clearcoatRoughness: 0.08 }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0x1a2430, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.42, depthWrite: false, side: THREE.DoubleSide,
    }),
    trim: new THREE.MeshStandardMaterial({ color: 0x16181b, roughness: 0.55, metalness: 0.2 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xdfe3e8, roughness: 0.12, metalness: 1 }),
    interior: new THREE.MeshStandardMaterial({ color: 0x2c2e33, roughness: 0.85 }),
    seat: new THREE.MeshStandardMaterial({ color: 0x3a3d44, roughness: 0.9 }),
    inner: new THREE.MeshStandardMaterial({ color: 0x24272b, roughness: 0.8, side: THREE.DoubleSide }),
    headlight: overlay(new THREE.MeshPhysicalMaterial({ color: 0x9eabba, roughness: 0.08, metalness: 0.85, clearcoat: 1, emissive: 0xfff6e0, emissiveIntensity: 0.08 })),
    taillight: overlay(new THREE.MeshPhysicalMaterial({ color: 0x8e0a12, roughness: 0.12, clearcoat: 1, emissive: 0x4a0006, emissiveIntensity: 0.5 })),
    backside: new THREE.MeshStandardMaterial({ color: 0x2a2d31, roughness: 0.8, side: THREE.BackSide }),
    doorCard: new THREE.MeshStandardMaterial({ color: 0x33363c, roughness: 0.85, side: THREE.DoubleSide }),
    mirror: new THREE.MeshStandardMaterial({ color: 0xaab4c0, roughness: 0.05, metalness: 1 }),
    reflector: overlay(new THREE.MeshStandardMaterial({ color: 0x7a0a0e, roughness: 0.3 })),
    red: new THREE.MeshStandardMaterial({ color: 0xb3261e, roughness: 0.5 }),
    reservoir: new THREE.MeshStandardMaterial({ color: 0xd9d4c5, roughness: 0.6 }),
    grille: new THREE.MeshStandardMaterial({ color: 0x0d0e10, roughness: 0.4, metalness: 0.5, side: THREE.DoubleSide }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x1a1b1d, roughness: 0.92 }),
    rim: new THREE.MeshStandardMaterial({ color: 0xc4c8cc, roughness: 0.28, metalness: 0.85 }),
    disc: new THREE.MeshStandardMaterial({ color: 0x8d9196, roughness: 0.45, metalness: 0.9 }),
    caliper: new THREE.MeshStandardMaterial({ color: 0x3a3c40, roughness: 0.5, metalness: 0.4 }),
  };
}

/** Material que se dibuja encima de la carrocería sin parpadeo (faros, calaveras). */
function overlay(m) {
  m.polygonOffset = true;
  m.polygonOffsetFactor = -2;
  m.polygonOffsetUnits = -2;
  return m;
}

/** Aplica color + acabado (brillante / mate / metálico) a la pintura. */
export function applyPaint(paint, hex, acabado) {
  paint.color.set(hex);
  paint.roughness = acabado.roughness;
  paint.metalness = acabado.metalness;
  paint.clearcoat = acabado.clearcoat;
  paint.clearcoatRoughness = acabado.clearcoatRoughness;
  paint.needsUpdate = true;
}
