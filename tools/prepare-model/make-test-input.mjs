/**
 * Genera una malla de prueba para prepare_model.py a partir del carro procedural:
 * todo unido en un .obj, sin nombres ni materiales, girado 90°, con el frente al revés
 * y a otra escala, como llegaría de una IA de imagen a 3D.
 *   node tools/prepare-model/make-test-input.mjs salida.obj
 */
import { readFileSync, writeFileSync } from 'node:fs';
import * as THREE from 'three';
import { buildProceduralCar } from '../../src/vehicle/procedural-car.js';
import { createMaterials } from '../../src/vehicle/materials.js';
import { buildFrontFascia, buildFender, buildRearFlares } from '../../src/vehicle/body-variants.js';
import { buildWheel } from '../../src/vehicle/wheels.js';

const vehicle = JSON.parse(readFileSync(new URL('../../src/data/vehicles/sonata-2016.json', import.meta.url)));
const mats = createMaterials();
const { nodes, ctx } = buildProceduralCar(vehicle, mats);
const root = new THREE.Group();
// Solo la piel exterior (como un escaneo/IA): sin interior, motor ni piezas ocultas.
const skinMats = new Set([mats.paint, mats.glass, mats.trim, mats.chrome, mats.headlight, mats.taillight, mats.grille]);
Object.entries(nodes).forEach(([id, n]) => root.add(n));
nodes.fascia_delantera.add(buildFrontFascia('estandar', ctx));
nodes.salpicadera_izq.add(buildFender('estandar', -1, ctx));
nodes.salpicadera_der.add(buildFender('estandar', 1, ctx));
nodes.extensiones_traseras.add(buildRearFlares('estandar', ctx));
const d = vehicle.dimensiones;
for (const [x, s] of [[d.eje_delantero_x, 1], [d.eje_delantero_x, -1], [d.eje_delantero_x - d.distancia_ejes_m, 1], [d.eje_delantero_x - d.distancia_ejes_m, -1]]) {
  const w = buildWheel({ rd: 17, rs: 5, medida: vehicle.llantas.referencia }, mats);
  w.position.set(x, w.userData.radius, s * d.media_trocha_m);
  if (s < 0) w.rotation.y = Math.PI;
  root.add(w);
}
// "Desordena": gira 90° sobre el eje vertical (largo en Z, frente hacia -Z) y escala.
root.rotation.y = Math.PI / 2;
root.scale.setScalar(0.37);
root.updateMatrixWorld(true);

let out = '# malla de prueba KarDmo\n';
let base = 1;
root.traverse((o) => {
  if (!o.isMesh || !(skinMats.has(o.material) || o.material === mats.rubber || o.material === mats.rim)) return;
  const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry;
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld);
    out += `v ${v.x.toFixed(5)} ${v.y.toFixed(5)} ${v.z.toFixed(5)}\n`;
  }
  for (let i = 0; i < p.count; i += 3) out += `f ${base + i} ${base + i + 1} ${base + i + 2}\n`;
  base += p.count;
});
writeFileSync(process.argv[2] ?? 'prueba.obj', out);
console.log('vértices', base - 1);
