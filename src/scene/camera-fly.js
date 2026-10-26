import * as THREE from 'three';
import gsap from 'gsap';

const box = new THREE.Box3();
const size = new THREE.Vector3();
const center = new THREE.Vector3();

/** Vuela la cámara para encuadrar un objeto (o lista de objetos). */
export function flyToObject(stage, objects, { padding = 2.6, minDist = 0.55, duration = 1.1 } = {}) {
  const list = Array.isArray(objects) ? objects : [objects];
  box.makeEmpty();
  list.forEach((o) => box.expandByObject(o));
  if (box.isEmpty()) return Promise.resolve();
  box.getCenter(center);
  box.getSize(size);
  const radius = Math.max(size.length() / 2, 0.05);
  const dist = Math.max(radius * padding, minDist);
  const { camera, controls } = stage;
  const dir = camera.position.clone().sub(controls.target).normalize();
  if (dir.y < 0.25) dir.y = 0.25;
  dir.normalize();
  const to = center.clone().addScaledVector(dir, dist);
  to.y = Math.max(to.y, 0.15);
  return flyTo(stage, to, center, duration);
}

export function flyTo(stage, position, target, duration = 1.1) {
  const { camera, controls } = stage;
  return new Promise((resolve) => {
    const tl = gsap.timeline({ onComplete: resolve });
    tl.to(camera.position, { x: position.x, y: position.y, z: position.z, duration, ease: 'power2.inOut' }, 0);
    tl.to(controls.target, { x: target.x, y: target.y, z: target.z, duration, ease: 'power2.inOut' }, 0);
  });
}

export const HOME_VIEW = {
  position: new THREE.Vector3(5.6, 2.4, 5.2),
  target: new THREE.Vector3(0.2, 0.6, 0),
};
