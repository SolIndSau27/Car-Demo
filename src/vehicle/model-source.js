import * as THREE from 'three';
import { buildProceduralCar, buildInnerParts } from './procedural-car.js';

/**
 * Fuente del modelo 3D. Contrato: un objeto { nodes } donde cada clave es el id de la pieza
 * (los mismos ids de vehicle.piezas_carroceria y del archivo de partes del motor).
 *
 * - 'procedural': geometría construida con Three.js (fase 1).
 * - 'glb': archivo con licencia o generado por IA y preparado con tools/prepare-model;
 *   sus nodos deben llamarse igual que los ids.
 */
export async function loadVehicleModel(vehicle, mats) {
  if (vehicle.modelo.tipo === 'glb' && vehicle.modelo.glb_url) {
    try {
      return await loadGlb(vehicle, mats);
    } catch (err) {
      console.warn('[KarDmo] no se pudo cargar el .glb; uso el modelo procedural.', err);
    }
  }
  return { ...buildProceduralCar(vehicle, mats), capabilities: { fascia: true, fender: true, aleron: true } };
}

async function loadGlb(vehicle, mats) {
  // Import dinámico: el cargador solo se descarga si de verdad hay un .glb.
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const gltf = await new GLTFLoader().loadAsync(vehicle.modelo.glb_url);
  const ids = new Set(vehicle.piezas_carroceria.map((p) => p.id));
  const nodes = {};
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((o) => {
    if (ids.has(o.name) && !nodes[o.name]) nodes[o.name] = o;
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    // Convención de materiales (la genera tools/prepare-model/prepare_model.py).
    const name = o.material?.name;
    if (name === 'pintura') {
      if (o.material.map) enablePaintMask(mats.paint, o.material.map);
      o.material = mats.paint;
    } else if (name === 'vidrio') o.material = mats.glass;
    else if (name === 'negro') o.material = mats.trim;
  });
  // Las mallas de IA son de una sola cara: agregamos la cara interior oscura (se ve al abrir).
  const backs = [];
  gltf.scene.traverse((o) => {
    if (o.isMesh && o.material !== mats.glass) backs.push(o);
  });
  backs.forEach((o) => {
    const b = new THREE.Mesh(o.geometry, mats.backside);
    b.userData.noHighlight = true;
    o.add(b);
  });
  // Los nodos deben quedar en coordenadas del carro (sin transformaciones heredadas).
  Object.values(nodes).forEach((n) => {
    n.removeFromParent();
    n.updateMatrixWorld(true);
  });
  const carroceria = nodes.carroceria ?? new THREE.Group();
  carroceria.name = 'carroceria';
  // El .glb es la piel: agregamos interior, motor, cajuela y forros desde el modelo procedural.
  const inner = buildInnerParts(vehicle, mats);
  carroceria.add(inner.group);
  nodes.carroceria = carroceria;
  nodes.escape = inner.escape;
  nodes.aleron = new THREE.Group();
  nodes.extensiones_traseras = new THREE.Group();
  return { nodes, ctx: inner.ctx, capabilities: { fascia: false, fender: false, aleron: true } };
}

/**
 * Pintura sobre textura de IA: el alfa de la textura marca las zonas pintadas. Ahí se usa el
 * color del configurador con el sombreado de la textura; el resto conserva la textura original.
 */
function enablePaintMask(paint, map) {
  map.colorSpace = THREE.SRGBColorSpace;
  paint.map = map;
  paint.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `#ifdef USE_MAP
        vec4 texel = texture2D( map, vMapUv );
        float lum = dot( texel.rgb, vec3( 0.299, 0.587, 0.114 ) );
        vec3 painted = diffuse * clamp( lum * 2.2, 0.35, 1.25 );
        diffuseColor.rgb = mix( texel.rgb, painted, texel.a );
        diffuseColor.a = opacity;
      #endif`,
    );
  };
  paint.needsUpdate = true;
}
