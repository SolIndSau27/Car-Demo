import * as THREE from 'three';
import gsap from 'gsap';

/**
 * Estados del motor: 'instalado' -> 'fuera' -> 'explosionado'.
 * Mueve el motor completo (sacar/instalar) y cada pieza por su vector de explosión del JSON.
 */
export function createEngineController({ root, parts, partsData, montaje, openHood }) {
  const defs = new Map(partsData.piezas.map((p) => [p.id, p]));
  const base = new Map();
  parts.forEach((g, id) => base.set(id, g.position.clone()));
  const installed = new THREE.Vector3().fromArray(montaje.posicion);
  const outside = new THREE.Vector3().fromArray(montaje.posicion_fuera);
  root.position.copy(installed);

  let state = 'instalado';
  let busy = false;
  let xray = false;
  const listeners = new Set();
  const emit = () => listeners.forEach((fn) => fn(state));

  // Las piezas "carcasa" se hacen translúcidas en modo rayos X.
  const casing = ['monoblock', 'cabeza', 'tapa_punterias', 'carter'];
  const casingMats = [];
  casing.forEach((id) =>
    parts.get(id)?.traverse((o) => {
      if (o.isMesh) {
        o.material = o.material.clone();
        casingMats.push(o.material);
      }
    }),
  );

  function tweenPos(obj, to, duration, ease = 'power2.inOut') {
    return new Promise((resolve) => gsap.to(obj.position, { x: to.x, y: to.y, z: to.z, duration, ease, overwrite: true, onComplete: resolve }));
  }

  async function run(fn) {
    if (busy) return;
    busy = true;
    try {
      await fn();
    } finally {
      busy = false;
      emit();
    }
  }

  function explodeTo(factor, duration = 1.1) {
    const jobs = [];
    parts.forEach((g, id) => {
      const v = defs.get(id)?.explosion ?? [0, 0, 0];
      const to = base.get(id).clone().add(new THREE.Vector3(v[0], v[1], v[2]).multiplyScalar(factor));
      jobs.push(tweenPos(g, to, duration, 'power3.inOut'));
    });
    return Promise.all(jobs);
  }

  const api = {
    get state() {
      return state;
    },
    get busy() {
      return busy;
    },
    get xray() {
      return xray;
    },
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    extract: () =>
      run(async () => {
        if (state !== 'instalado') return;
        await openHood();
        const up = installed.clone();
        up.y = montaje.altura_extraccion;
        await tweenPos(root, up, 1.0);
        const over = outside.clone();
        over.y = montaje.altura_extraccion;
        await tweenPos(root, over, 0.9);
        await tweenPos(root, outside, 0.7, 'power2.out');
        state = 'fuera';
      }),
    install: () =>
      run(async () => {
        if (state === 'instalado') return;
        if (state === 'explosionado') await explodeTo(0, 0.8);
        await openHood();
        const over = outside.clone();
        over.y = montaje.altura_extraccion;
        await tweenPos(root, over, 0.6);
        const up = installed.clone();
        up.y = montaje.altura_extraccion;
        await tweenPos(root, up, 0.9);
        await tweenPos(root, installed, 0.9, 'power2.out');
        state = 'instalado';
      }),
    explode: (on) =>
      run(async () => {
        if (state === 'instalado') return;
        await explodeTo(on ? 1 : 0);
        state = on ? 'explosionado' : 'fuera';
      }),
    setXray(on) {
      xray = on;
      casingMats.forEach((mat) => {
        mat.transparent = on;
        mat.opacity = on ? 0.18 : 1;
        mat.depthWrite = !on;
        mat.needsUpdate = true;
      });
      emit();
    },
    isInternal: (id) => Boolean(defs.get(id)?.interna),
  };
  return api;
}
