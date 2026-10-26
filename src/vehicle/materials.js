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
    headlight: new THREE.MeshPhysicalMaterial({ color: 0xe8eef5, roughness: 0.05, metalness: 0.4, emissive: 0xfff6e0, emissiveIntensity: 0.15 }),
    taillight: new THREE.MeshPhysicalMaterial({ color: 0x9a0c12, roughness: 0.15, emissive: 0x500006, emissiveIntensity: 0.4 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x1a1b1d, roughness: 0.92 }),
    rim: new THREE.MeshStandardMaterial({ color: 0xc4c8cc, roughness: 0.28, metalness: 0.85 }),
    disc: new THREE.MeshStandardMaterial({ color: 0x8d9196, roughness: 0.45, metalness: 0.9 }),
    caliper: new THREE.MeshStandardMaterial({ color: 0x3a3c40, roughness: 0.5, metalness: 0.4 }),
  };
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
