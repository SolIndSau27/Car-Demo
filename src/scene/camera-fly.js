import * as THREE from 'three';
import gsap from 'gsap';

const box = new THREE.Box3();
const size = new THREE.Vector3();
const center = new THREE.Vector3();

/** Vuela la cámara para encuadrar un objeto (o lista de objetos). */
export function flyToObject(stage, objects, { padding = 2.6, minDist = 0.55, duration = 1.1, dir: fixedDir = null } = {}) {
  const list = Array.isArray(objects) ? objects : [objects];
  box.makeEmpty();
  list.forEach((o) => box.expandByObject(o));
  if (box.isEmpty()) return Promise.resolve();
  box.getCenter(center);
  box.getSize(size);
  const radius = Math.max(size.length() / 2, 0.05);
  const dist = Math.max(radius * padding, minDist);
  const { camera, controls } = stage;
  const dir = fixedDir ? new THREE.Vector3(...fixedDir) : camera.position.clone().sub(controls.target);
  dir.normalize();
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
    tl.to(camera.position, { x: position.x, y: position.y, z: position.z, duration, ease: 'power2.inOut', overwrite: true }, 0);
    tl.to(controls.target, { x: target.x, y: target.y, z: target.z, duration, ease: 'power2.inOut', overwrite: true }, 0);
  });
}

const HOME_DIR = new THREE.Vector3(5.4, 1.8, 5.2);
const HOME_TARGET = new THREE.Vector3(0.1, 0.6, 0);

/** Vista inicial; en pantallas angostas (celular vertical) la cámara se aleja para que quepa el carro. */
export function homeView(aspect = 1.6) {
  const k = aspect < 1.3 ? Math.min(1.3 / aspect, 2.2) : 1;
  return { position: HOME_TARGET.clone().addScaledVector(HOME_DIR, k), target: HOME_TARGET.clone() };
}
