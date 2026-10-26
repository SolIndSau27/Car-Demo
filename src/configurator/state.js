import { compatibleTires } from './tires.js';

/**
 * Estado del configurador. Claves cortas porque viaja en la URL de compartir:
 *  v: vehículo, c: color, f: acabado, rd/rs/rc: rin (diámetro, rayos, color),
 *  t: medida de llanta, fa/fe/al: fascia/fender/alerón, s: suspensión (mm),
 *  u: mejoras, l: piezas extra agregadas a la lista, n: nombre.
 */
export function defaultConfig(vehicle) {
  const color = vehicle.colores_fabrica.lista[4] ?? vehicle.colores_fabrica.lista[0];
  return {
    v: vehicle.id,
    n: vehicle.nombre_corto,
    c: color.hex,
    f: color.acabado,
    rd: 17,
    rs: 5,
    rc: vehicle.rines.colores[0].hex,
    t: vehicle.llantas.referencia,
    fa: 'estandar',
    fe: 'estandar',
    al: 'ninguno',
    s: 0,
    u: [],
    l: [],
  };
}

const HEX = /^#[0-9a-f]{6}$/i;

/** Acepta cualquier objeto (URL, localStorage) y devuelve una config válida. */
export function normalizeConfig(vehicle, input) {
  const d = defaultConfig(vehicle);
  const i = input && typeof input === 'object' ? input : {};
  const ids = (arr) => arr.map((x) => x.id);
  const pick = (val, allowed, def) => (allowed.includes(val) ? val : def);
  const cfg = {
    v: vehicle.id,
    n: typeof i.n === 'string' && i.n.trim() ? i.n.trim().slice(0, 40) : d.n,
    c: HEX.test(i.c) ? i.c : d.c,
    f: pick(i.f, Object.keys(vehicle.acabados), d.f),
    rd: pick(Number(i.rd), vehicle.rines.diametros, d.rd),
    rs: pick(Number(i.rs), vehicle.rines.rayos, d.rs),
    rc: HEX.test(i.rc) ? i.rc : d.rc,
    t: i.t,
    fa: pick(i.fa, ids(vehicle.carroceria.fascia), d.fa),
    fe: pick(i.fe, ids(vehicle.carroceria.fender), d.fe),
    al: pick(i.al, ids(vehicle.carroceria.aleron), d.al),
    s: pick(Number(i.s), vehicle.suspension.map((x) => x.valor), d.s),
    u: Array.isArray(i.u) ? i.u.filter((id) => vehicle.mejoras.some((m) => m.id === id)) : [],
    l: Array.isArray(i.l) ? [...new Set(i.l.filter((x) => typeof x === 'string'))].slice(0, 100) : [],
  };
  const llantas = compatibleTires(vehicle, cfg.rd).map((t) => t.medida);
  if (!llantas.includes(cfg.t)) cfg.t = llantas[0];
  return cfg;
}

/** Store mínimo con suscripción. */
export function createStore(vehicle, initial) {
  let state = normalizeConfig(vehicle, initial);
  const listeners = new Set();
  return {
    get: () => state,
    set(patch) {
      const prev = state;
      const next = normalizeConfig(vehicle, { ...state, ...patch });
      // Si cambió el rin, la llanta pasa a la primera compatible (salvo que también la mandaran).
      if (patch.rd !== undefined && patch.rd !== prev.rd && patch.t === undefined) {
        next.t = compatibleTires(vehicle, next.rd)[0].medida;
      }
      state = next;
      listeners.forEach((fn) => fn(state, prev));
    },
    replace(cfg) {
      const prev = state;
      state = normalizeConfig(vehicle, cfg);
      listeners.forEach((fn) => fn(state, prev));
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
