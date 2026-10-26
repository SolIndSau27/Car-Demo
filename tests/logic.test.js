import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseTireSize, diameterDiffPct, tireInfo, compatibleTires } from '../src/configurator/tires.js';
import { encodeConfig, decodeConfig, buildShareUrl, readConfigFromUrl } from '../src/services/share-url.js';
import { defaultConfig, normalizeConfig, createStore } from '../src/configurator/state.js';

const vehicle = JSON.parse(readFileSync(new URL('../src/data/vehicles/sonata-2016.json', import.meta.url)));
const engine = JSON.parse(readFileSync(new URL('../src/data/parts/engine-2.4-gdi.json', import.meta.url)));
const affiliates = JSON.parse(readFileSync(new URL('../src/data/affiliates.json', import.meta.url)));

test('parseTireSize calcula diámetro total', () => {
  const t = parseTireSize('215/55R17');
  assert.equal(t.ancho, 215);
  assert.equal(t.perfil, 55);
  assert.equal(t.rin, 17);
  assert.ok(Math.abs(t.diametroMm - 668.3) < 0.1);
  assert.equal(parseTireSize('no es llanta'), null);
});

test('las medidas de fábrica están dentro de ±3%', () => {
  for (const f of vehicle.llantas.fabrica) {
    assert.ok(Math.abs(diameterDiffPct(f.medida, vehicle.llantas.referencia)) < 3, f.medida);
  }
});

test('tireInfo marca las medidas fuera de tolerancia', () => {
  assert.equal(tireInfo(vehicle, '235/45R17').excedeTolerancia, true);
  assert.equal(tireInfo(vehicle, '225/50R17').excedeTolerancia, false);
});

test('cada rin tiene medidas compatibles del mismo diámetro', () => {
  for (const d of vehicle.rines.diametros) {
    const lista = compatibleTires(vehicle, d);
    assert.ok(lista.length > 0);
    lista.forEach((t) => assert.equal(parseTireSize(t.medida).rin, d));
  }
});

test('el link de compartir conserva la configuración (incluye acentos)', () => {
  const cfg = { ...defaultConfig(vehicle), n: 'Mi Sonata ñandú', rd: 19, t: '245/35R19', u: ['faros_led'] };
  assert.deepEqual(decodeConfig(encodeConfig(cfg)), cfg);
  const url = buildShareUrl(cfg, 'https://minave.mx/app/?x=1');
  assert.deepEqual(readConfigFromUrl(url), cfg);
  assert.equal(decodeConfig('%%%basura'), null);
});

test('normalizeConfig corrige valores inválidos y llantas incompatibles', () => {
  const cfg = normalizeConfig(vehicle, { c: 'rojo', rd: 18, t: '215/55R17', s: -999, u: ['nada', 'faros_led'], fa: 'x' });
  assert.equal(cfg.c, defaultConfig(vehicle).c);
  assert.equal(cfg.rd, 18);
  assert.equal(cfg.t, '235/45R18');
  assert.equal(cfg.s, 0);
  assert.equal(cfg.fa, 'estandar');
  assert.deepEqual(cfg.u, ['faros_led']);
});

test('el store cambia la llanta al cambiar el rin', () => {
  const store = createStore(vehicle, defaultConfig(vehicle));
  store.set({ rd: 16 });
  assert.equal(store.get().t, '205/65R16');
});

test('datos: al menos 25 piezas de motor, todas con ficha completa y link de compra', () => {
  assert.ok(engine.piezas.length >= 25);
  for (const p of engine.piezas) {
    for (const k of ['nombre', 'funcion', 'como_funciona', 'sintomas', 'explosion']) assert.ok(p[k], `${p.id}.${k}`);
    assert.ok(affiliates.piezas[p.id], `afiliado de ${p.id}`);
  }
});

test('datos: todo lo relacionado en las fichas existe en affiliates.json', () => {
  for (const [id, f] of Object.entries(vehicle.fichas)) {
    if (id === 'nota') continue;
    (f.relacionadas ?? []).forEach((r) => assert.ok(affiliates.piezas[r], `${id} -> ${r}`));
  }
  for (const m of vehicle.mejoras) assert.ok(vehicle.fichas[m.id] && affiliates.piezas[m.id], m.id);
});
