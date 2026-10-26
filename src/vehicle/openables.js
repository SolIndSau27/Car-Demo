import * as THREE from 'three';
import gsap from 'gsap';

/**
 * Envuelve un nodo en un pivote para que gire sobre su bisagra.
 * pivote(posición) -> interior(-posición) -> nodo en coordenadas del carro.
 */
export function makeHinged(node, def) {
  const pivot = new THREE.Group();
  pivot.name = `${node.name}_pivote`;
  pivot.position.fromArray(def.pivote);
  const inner = new THREE.Group();
  inner.position.fromArray(def.pivote).multiplyScalar(-1);
  pivot.add(inner);
  inner.add(node);
  pivot.userData.hinge = { axis: def.eje, angle: THREE.MathUtils.degToRad(def.angulo), open: false };
  return pivot;
}

export function isOpen(pivot) {
  return pivot.userData.hinge.open;
}

export function setOpen(pivot, open, duration = 0.9) {
  const h = pivot.userData.hinge;
  h.open = open;
  return new Promise((resolve) => {
    gsap.to(pivot.rotation, {
      [h.axis]: open ? h.angle : 0,
      duration,
      ease: open ? 'power2.out' : 'power2.inOut',
      overwrite: true,
      onComplete: resolve,
    });
  });
}

export function toggle(pivot) {
  return setOpen(pivot, !isOpen(pivot));
}
