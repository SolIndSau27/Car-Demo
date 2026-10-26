import * as THREE from 'three';
import { parseTireSize } from '../configurator/tires.js';

/** Rin paramétrico + llanta. Eje de giro en z; la cara exterior mira a +z. */
export function buildWheel({ rd, rs, medida }, mats) {
  const tire = parseTireSize(medida);
  const R = tire.diametroMm / 2000;
  const rimR = (rd * 25.4) / 2000;
  const w = tire.ancho / 1000;
  const g = new THREE.Group();

  // Llanta (perfil revolucionado).
  const h = w / 2;
  const prof = [
    [rimR, -h + 0.012], [rimR + 0.012, -h], [R - 0.035, -h - 0.004], [R - 0.01, -h + 0.012], [R, -h + 0.035],
    [R, h - 0.035], [R - 0.01, h - 0.012], [R - 0.035, h + 0.004], [rimR + 0.012, h], [rimR, h - 0.012],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const tireGeo = new THREE.LatheGeometry(prof, 56);
  tireGeo.rotateX(Math.PI / 2);
  g.add(part(tireGeo, mats.rubber));

  // Barril, ceja y cara del rin.
  const barrel = new THREE.CylinderGeometry(rimR * 0.985, rimR * 0.985, w * 0.86, 48, 1, true);
  barrel.rotateX(Math.PI / 2);
  g.add(part(barrel, mats.rimInside ?? mats.rim));
  const lip = part(new THREE.TorusGeometry(rimR * 0.975, 0.011, 8, 56), mats.rim);
  lip.position.z = h * 0.86;
  g.add(lip);

  const face = h * 0.62;
  const spokeW = { 5: 0.058, 6: 0.048, 7: 0.042, 10: 0.024 }[rs] ?? 0.04;
  const len = rimR * 0.95 - 0.07;
  for (let i = 0; i < rs; i++) {
    const a = (i / rs) * Math.PI * 2;
    const sp = part(new THREE.BoxGeometry(len, spokeW, 0.028), mats.rim);
    sp.position.set(Math.cos(a) * (0.07 + len / 2), Math.sin(a) * (0.07 + len / 2), face);
    sp.rotation.z = a;
    g.add(sp);
    if (rs <= 6) {
      // Rayo doble para que los rines de pocos rayos no se vean vacíos.
      const sp2 = sp.clone();
      sp2.scale.set(0.9, 0.45, 0.8);
      sp2.position.set(Math.cos(a + 0.18) * (0.07 + len / 2), Math.sin(a + 0.18) * (0.07 + len / 2), face - 0.004);
      sp2.rotation.z = a + 0.1;
      g.add(sp2);
    }
  }
  const hub = new THREE.CylinderGeometry(0.078, 0.082, 0.04, 28);
  hub.rotateX(Math.PI / 2);
  const hubM = part(hub, mats.rim);
  hubM.position.z = face;
  g.add(hubM);
  const cap = new THREE.CylinderGeometry(0.03, 0.03, 0.012, 20);
  cap.rotateX(Math.PI / 2);
  const capM = part(cap, mats.trim);
  capM.position.z = face + 0.022;
  g.add(capM);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    const nut = new THREE.CylinderGeometry(0.009, 0.009, 0.016, 6);
    nut.rotateX(Math.PI / 2);
    const n = part(nut, mats.chrome);
    n.position.set(Math.cos(a) * 0.055, Math.sin(a) * 0.055, face + 0.02);
    g.add(n);
  }

  // Disco y caliper (detrás de los rayos).
  const disc = new THREE.CylinderGeometry(rimR * 0.8, rimR * 0.8, 0.026, 40);
  disc.rotateX(Math.PI / 2);
  g.add(part(disc, mats.disc));
  const cal = part(new THREE.BoxGeometry(0.1, 0.16, 0.07), mats.caliper);
  cal.position.set(-rimR * 0.62, rimR * 0.36, 0.01);
  cal.rotation.z = 0.5;
  g.add(cal);

  g.userData.radius = R;
  return g;
}

function part(geo, mat) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Las 4 ruedas. Se reconstruyen solo si cambia rin o llanta. */
export function createWheelSet(vehicle, mats) {
  const d = vehicle.dimensiones;
  const xf = d.eje_delantero_x;
  const xr = xf - d.distancia_ejes_m;
  const group = new THREE.Group();
  group.name = 'ruedas';
  const mounts = [];
  for (const [x, s, eje] of [[xf, -1, 'del'], [xf, 1, 'del'], [xr, -1, 'tras'], [xr, 1, 'tras']]) {
    const m = new THREE.Group();
    m.name = `rueda_${eje}_${s < 0 ? 'izq' : 'der'}`;
    m.userData.side = s;
    m.position.set(x, 0.33, s * d.media_trocha_m);
    if (s < 0) m.rotation.y = Math.PI;
    group.add(m);
    mounts.push(m);
  }
  let key = '';
  let radius = 0.33;
  return {
    group,
    mounts,
    get radius() {
      return radius;
    },
    update(cfg) {
      mats.rim.color.set(cfg.rc);
      const k = `${cfg.rd}|${cfg.rs}|${cfg.t}`;
      if (k === key) return false;
      key = k;
      mounts.forEach((m) => {
        m.children.forEach((c) => c.traverse((o) => o.geometry?.dispose()));
        m.clear();
        const w = buildWheel({ rd: cfg.rd, rs: cfg.rs, medida: cfg.t }, mats);
        radius = w.userData.radius;
        m.add(w);
      });
      return true;
    },
  };
}
