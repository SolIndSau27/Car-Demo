import * as THREE from 'three';
import { buildProceduralCar } from './procedural-car.js';

/**
 * Fuente del modelo 3D. Contrato: un objeto { nodes } donde cada clave es el id de la pieza
 * (los mismos ids de vehicle.piezas_carroceria y del archivo de partes del motor).
 *
 * - 'procedural': geometría construida con Three.js (fase 1).
 * - 'glb': archivo con licencia; sus nodos deben llamarse igual que los ids.
 */
export async function loadVehicleModel(vehicle, mats) {
  if (vehicle.modelo.tipo === 'glb' && vehicle.modelo.glb_url) {
    return loadGlb(vehicle, mats);
  }
  return buildProceduralCar(vehicle, mats);
}

async function loadGlb(vehicle, mats) {
  // Import dinámico: el cargador solo se descarga si de verdad hay un .glb.
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const gltf = await new GLTFLoader().loadAsync(vehicle.modelo.glb_url);
  const nodes = {};
  const ids = vehicle.piezas_carroceria.map((p) => p.id);
  gltf.scene.traverse((o) => {
    if (ids.includes(o.name) && !nodes[o.name]) nodes[o.name] = o;
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      // Convención: materiales llamados "pintura" usan la pintura del configurador.
      if (o.material?.name === 'pintura') o.material = mats.paint;
    }
  });
  const rest = new THREE.Group();
  rest.name = 'carroceria';
  [...gltf.scene.children].forEach((c) => {
    if (!Object.values(nodes).includes(c)) rest.add(c);
  });
  nodes.carroceria ??= rest;
  return { nodes, ctx: null };
}
