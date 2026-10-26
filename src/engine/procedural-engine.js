import * as THREE from 'three';

/**
 * Motor 2.4L 4 en línea transversal, construido con primitivas.
 * Coordenadas locales: x = hacia el frente del carro, y = arriba, z = a lo largo del cigüeñal.
 * Cada pieza del JSON se construye con el builder del mismo id. Para un .glb basta con nombrar
 * los nodos igual que los ids y saltarse este archivo.
 */
const CYL = [-0.165, -0.055, 0.055, 0.165];

function engineMaterials() {
  const std = (color, roughness, metalness, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
  return {
    iron: std(0x6d7176, 0.6, 0.6),
    alu: std(0xb7bbc0, 0.38, 0.75),
    steel: std(0x9ea3a8, 0.3, 0.9),
    dark: std(0x2a2c30, 0.55, 0.3),
    plastic: std(0x1c1e21, 0.7, 0.05),
    cover: std(0x34373c, 0.45, 0.4),
    rubber: std(0x151515, 0.9, 0),
    heat: std(0x7f5c45, 0.45, 0.7),
    ceramic: std(0xf0efe9, 0.4, 0),
    copper: std(0xb87333, 0.35, 0.8),
    filter: std(0x1f5fbf, 0.5, 0.2),
    red: std(0xb3261e, 0.5, 0.2),
  };
}

function m(geo, mat, pos = [0, 0, 0], rot = [0, 0, 0]) {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.fromArray(pos);
  mesh.rotation.set(rot[0], rot[1], rot[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
const B = (x, y, z) => new THREE.BoxGeometry(x, y, z);
/** Cilindro con eje en z. */
const CZ = (r, l, seg = 24, r2 = r) => new THREE.CylinderGeometry(r, r2, l, seg).rotateX(Math.PI / 2);
/** Cilindro con eje en y. */
const CY = (r, h, seg = 20, r2 = r) => new THREE.CylinderGeometry(r, r2, h, seg);

const BUILDERS = {
  monoblock: (M) => {
    const g = [m(B(0.3, 0.24, 0.46), M.iron, [0, 0.22, 0])];
    for (const z of CYL) g.push(m(CZ(0.012, 0.03), M.iron, [0.152, 0.2, z]));
    return g;
  },
  cabeza: (M) => [m(B(0.29, 0.1, 0.47), M.alu, [0, 0.39, 0])],
  tapa_punterias: (M) => {
    const g = [m(B(0.22, 0.055, 0.44), M.cover, [0, 0.4675, 0])];
    for (let i = 0; i < 6; i++) g.push(m(B(0.2, 0.006, 0.01), M.cover, [0, 0.497, -0.18 + i * 0.072]));
    return g;
  },
  bobinas: (M) =>
    CYL.map((z) => {
      const grp = new THREE.Group();
      grp.add(m(CY(0.02, 0.09), M.plastic, [0, 0.53, z]), m(B(0.05, 0.03, 0.035), M.plastic, [0.02, 0.585, z]));
      return grp;
    }),
  bujias: (M) =>
    CYL.map((z) => {
      const grp = new THREE.Group();
      grp.add(m(CY(0.008, 0.05), M.ceramic, [0, 0.43, z]), m(CY(0.011, 0.016, 6), M.steel, [0, 0.4, z]), m(CY(0.005, 0.02), M.steel, [0, 0.382, z]));
      return grp;
    }),
  arboles_levas: (M) =>
    [-0.055, 0.055].map((x) => {
      const grp = new THREE.Group();
      grp.add(m(CZ(0.013, 0.47), M.steel, [x, 0.425, 0]), m(CZ(0.045, 0.012, 28), M.steel, [x, 0.425, 0.245]));
      for (const z of CYL) for (const dz of [-0.022, 0.022]) grp.add(m(B(0.034, 0.024, 0.012), M.steel, [x, 0.425, z + dz], [0, 0, z * 9 + dz * 30]));
      return grp;
    }),
  valvulas: (M) => {
    const grp = new THREE.Group();
    for (const z of CYL)
      for (const x of [-0.05, 0.05])
        for (const dz of [-0.022, 0.022]) {
          grp.add(m(CY(0.004, 0.085, 8), M.steel, [x, 0.375, z + dz]), m(CY(0.014, 0.004, 16), M.steel, [x, 0.333, z + dz]), m(CY(0.01, 0.03, 10), M.copper, [x, 0.4, z + dz]));
        }
    return [grp];
  },
  pistones: (M) =>
    CYL.map((z) => {
      const grp = new THREE.Group();
      grp.add(m(CY(0.042, 0.06, 28), M.alu, [0, 0.3, z]), m(CY(0.0425, 0.004, 28), M.dark, [0, 0.318, z]), m(CZ(0.01, 0.07, 10), M.steel, [0, 0.29, z]));
      return grp;
    }),
  bielas: (M) =>
    CYL.map((z) => {
      const grp = new THREE.Group();
      grp.add(m(B(0.022, 0.13, 0.018), M.steel, [0, 0.215, z]), m(CZ(0.026, 0.024, 18), M.steel, [0, 0.15, z]));
      return grp;
    }),
  ciguenal: (M) => {
    const g = [m(CZ(0.02, 0.54), M.steel, [0, 0.12, 0])];
    for (const z of CYL) for (const dz of [-0.03, 0.03]) g.push(m(B(0.08, 0.06, 0.018), M.steel, [0, 0.105, z + dz]));
    g.push(m(CZ(0.06, 0.02, 32), M.steel, [0, 0.12, -0.26]));
    return g;
  },
  cadena_distribucion: (M) => {
    const chain = m(new THREE.TorusGeometry(0.07, 0.007, 6, 48), M.steel, [0, 0.27, 0.252]);
    chain.scale.y = 2.15;
    return [chain, m(CZ(0.025, 0.012), M.steel, [0, 0.12, 0.252]), m(B(0.02, 0.09, 0.014), M.dark, [-0.075, 0.27, 0.252])];
  },
  bomba_aceite: (M) => [m(B(0.08, 0.055, 0.07), M.steel, [0.07, 0.06, 0.17]), m(CY(0.012, 0.06), M.steel, [0.07, 0.03, 0.12])],
  carter: (M) => [m(B(0.3, 0.1, 0.46), M.alu, [0, 0.05, 0]), m(CY(0.012, 0.012, 6), M.steel, [0.06, -0.006, 0.1])],
  bomba_agua: (M) => [m(CZ(0.045, 0.04), M.alu, [0.1, 0.22, 0.255]), m(CZ(0.042, 0.022, 28), M.steel, [0.1, 0.22, 0.285])],
  termostato: (M) => [m(CY(0.03, 0.05), M.alu, [0.06, 0.4, -0.255]), m(CZ(0.016, 0.07), M.rubber, [0.06, 0.4, -0.31])],
  multiple_admision: (M) => {
    const g = [m(B(0.07, 0.13, 0.42), M.plastic, [0.275, 0.36, 0])];
    for (const z of CYL) g.push(m(B(0.13, 0.04, 0.05), M.plastic, [0.205, 0.415, z], [0, 0, -0.25]));
    return g;
  },
  cuerpo_aceleracion: (M) => [m(CZ(0.036, 0.06, 28), M.alu, [0.275, 0.37, -0.24]), m(B(0.04, 0.05, 0.03), M.plastic, [0.3, 0.42, -0.24])],
  inyectores: (M) => {
    const g = CYL.map((z) => m(CY(0.009, 0.07, 12), M.steel, [0.165, 0.35, z], [0, 0, 0.9]));
    g.push(m(CZ(0.012, 0.44), M.steel, [0.19, 0.37, 0]));
    return g;
  },
  bomba_alta_presion: (M) => [m(CY(0.03, 0.07, 22), M.alu, [-0.14, 0.47, -0.2]), m(CY(0.012, 0.02), M.steel, [-0.14, 0.515, -0.2])],
  alternador: (M) => [m(CZ(0.06, 0.1, 28), M.alu, [0.17, 0.3, 0.21]), m(CZ(0.026, 0.024, 20), M.steel, [0.17, 0.3, 0.282]), m(CZ(0.05, 0.012, 28), M.dark, [0.17, 0.3, 0.155])],
  marcha: (M) => [m(CZ(0.042, 0.15, 24), M.dark, [-0.13, 0.13, -0.29]), m(CZ(0.022, 0.1), M.steel, [-0.13, 0.19, -0.29]), m(B(0.02, 0.02, 0.03), M.red, [-0.13, 0.218, -0.27])],
  compresor_ac: (M) => [m(CZ(0.055, 0.12, 28), M.alu, [0.15, 0.07, 0.205]), m(CZ(0.05, 0.026, 28), M.steel, [0.15, 0.07, 0.282])],
  banda_accesorios: (M) => {
    const z = 0.287;
    const pts = [
      [-0.072, 0.12], [-0.06, 0.19], [0.02, 0.335], [0.08, 0.335], [0.17, 0.328], [0.198, 0.3],
      [0.15, 0.26], [0.14, 0.22], [0.205, 0.07], [0.15, 0.018], [0.07, 0.04], [0.0, 0.048],
    ].map(([x, y]) => new THREE.Vector3(x, y, z));
    const curve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.3);
    return [
      m(new THREE.TubeGeometry(curve, 120, 0.006, 6, true), M.rubber),
      m(CZ(0.07, 0.024, 32), M.steel, [0, 0.12, z]),
      m(CZ(0.03, 0.02, 20), M.steel, [0.05, 0.3, z]),
    ];
  },
  filtro_aceite: (M) => [m(CY(0.038, 0.09, 24), M.filter, [0.2, 0.15, -0.08], [0, 0, Math.PI / 2])],
  filtro_aire: (M) => [
    m(B(0.26, 0.12, 0.22), M.plastic, [0.0, 0.42, -0.42]),
    m(B(0.27, 0.015, 0.23), M.dark, [0.0, 0.485, -0.42]),
    m(CZ(0.04, 0.16), M.rubber, [0.2, 0.39, -0.31], [0, -0.5, 0]),
  ],
  sensor_oxigeno: (M) => [m(CY(0.01, 0.06, 12), M.steel, [-0.25, 0.24, 0.03], [0, 0, 0.6]), m(CY(0.004, 0.08, 6), M.plastic, [-0.29, 0.27, 0.03], [0, 0, 0.6])],
  multiple_escape: (M) => {
    const g = CYL.map((z) => m(B(0.09, 0.04, 0.045), M.heat, [-0.19, 0.39, z], [0, 0, 0.35]));
    g.push(m(CY(0.042, 0.2, 22), M.heat, [-0.245, 0.29, 0.03]), m(B(0.012, 0.13, 0.44), M.alu, [-0.272, 0.39, 0]));
    return g;
  },
};

/** Construye el motor. Devuelve el grupo raíz y un mapa id -> grupo de la pieza. */
export function buildProceduralEngine(partsData) {
  const M = engineMaterials();
  const root = new THREE.Group();
  root.name = 'motor';
  const parts = new Map();
  for (const def of partsData.piezas) {
    const builder = BUILDERS[def.id];
    if (!builder) {
      console.warn('[MiNave] pieza sin geometría procedural:', def.id);
      continue;
    }
    const g = new THREE.Group();
    g.name = def.id;
    builder(M).forEach((o) => g.add(o));
    root.add(g);
    parts.set(def.id, g);
  }
  return { root, parts };
}
