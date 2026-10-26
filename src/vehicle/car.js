import * as THREE from 'three';
import gsap from 'gsap';
import { createMaterials, applyPaint } from './materials.js';
import { loadVehicleModel } from './model-source.js';
import { makeHinged, setOpen, toggle, isOpen } from './openables.js';
import { buildFrontFascia, buildFender, buildRearFlares, buildSpoiler } from './body-variants.js';
import { createWheelSet } from './wheels.js';
import { parseTireSize } from '../configurator/tires.js';

const OPENABLE_KIND = { puerta: 'door', cofre: 'hood', cajuela: 'trunk' };

/**
 * Ensambla el carro: modelo (procedural o .glb) + bisagras + ruedas + piezas intercambiables.
 * Expone applyConfig() para que el configurador lo actualice en tiempo real.
 */
export async function createCar(vehicle) {
  const mats = createMaterials();
  const { nodes, ctx, capabilities = {} } = await loadVehicleModel(vehicle, mats);
  const labels = Object.fromEntries(vehicle.piezas_carroceria.map((p) => [p.id, p]));

  const root = new THREE.Group();
  root.name = 'vehiculo';
  const body = new THREE.Group();
  body.name = 'cuerpo';
  root.add(body);

  const pickables = [];
  const tag = (obj, id, kind) => {
    obj.userData.pick = { id, kind, label: labels[id]?.nombre ?? id };
    pickables.push(obj);
  };

  // Bisagras.
  const openables = {};
  for (const [id, def] of Object.entries(vehicle.articulaciones)) {
    if (id === 'nota' || !nodes[id]) continue;
    const pivot = makeHinged(nodes[id], def);
    body.add(pivot);
    openables[id] = pivot;
    tag(pivot, id, OPENABLE_KIND[labels[id]?.tipo] ?? 'door');
  }

  body.add(nodes.carroceria);
  tag(nodes.carroceria, 'carroceria', 'body');
  if (nodes.escape) body.add(nodes.escape);

  // Contenedores intercambiables. Con un .glb solo aplica el alerón (fascia y fenders son del modelo).
  const slots = {};
  if (ctx) {
    if (capabilities.fascia) {
      slots.fascia = nodes.fascia_delantera;
      body.add(slots.fascia);
      tag(slots.fascia, 'fascia_delantera', 'fascia');
    }
    if (capabilities.fender) {
      slots.fenderL = nodes.salpicadera_izq;
      slots.fenderR = nodes.salpicadera_der;
      slots.flares = nodes.extensiones_traseras;
      body.add(slots.fenderL, slots.fenderR, slots.flares);
      tag(slots.fenderL, 'salpicadera_izq', 'fender');
      tag(slots.fenderR, 'salpicadera_der', 'fender');
    }
    if (capabilities.aleron) {
      slots.aleron = nodes.aleron;
      // El alerón va dentro de la cajuela para abrir con ella.
      (openables.cajuela?.children[0] ?? body).add(slots.aleron);
      tag(slots.aleron, 'aleron', 'aleron');
    }
  }

  // Montaje del motor (el motor se agrega desde main).
  const engineMount = new THREE.Group();
  engineMount.name = 'montaje_motor';
  body.add(engineMount);

  const wheels = createWheelSet(vehicle, mats);
  root.add(wheels.group);
  wheels.mounts.forEach((m) => tag(m, 'rueda', 'wheel'));

  const refRadius = parseTireSize(vehicle.llantas.referencia).diametroMm / 2000;
  const current = {};

  function setSlot(slot, build) {
    if (!slot) return;
    slot.children.forEach((c) => c.traverse((o) => o.geometry?.dispose()));
    slot.clear();
    const g = build();
    g.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    slot.add(g);
  }

  function applyConfig(cfg, { animate = true } = {}) {
    applyPaint(mats.paint, cfg.c, vehicle.acabados[cfg.f]);
    wheels.update(cfg);
    const R = wheels.radius;
    wheels.mounts.forEach((m) => (m.position.y = R));
    const bodyY = R - refRadius + cfg.s / 1000;
    if (animate) gsap.to(body.position, { y: bodyY, duration: 0.6, ease: 'power2.out', overwrite: true });
    else body.position.y = bodyY;

    if (ctx) {
      if (current.fa !== cfg.fa) setSlot(slots.fascia, () => buildFrontFascia(cfg.fa, ctx));
      if (current.fe !== cfg.fe) {
        setSlot(slots.fenderL, () => buildFender(cfg.fe, -1, ctx));
        setSlot(slots.fenderR, () => buildFender(cfg.fe, 1, ctx));
        setSlot(slots.flares, () => buildRearFlares(cfg.fe, ctx));
      }
      if (current.al !== cfg.al) setSlot(slots.aleron, () => buildSpoiler(cfg.al, ctx));
    }

    // Mejoras con efecto visual.
    const u = new Set(cfg.u);
    if (nodes.escape) {
      nodes.escape.getObjectByName('escape_original').visible = !u.has('escape_cat_back');
      nodes.escape.getObjectByName('escape_doble').visible = u.has('escape_cat_back');
    }
    mats.headlight.emissive.set(u.has('faros_led') ? 0xe6f0ff : 0xfff6e0);
    mats.headlight.emissiveIntensity = u.has('faros_led') ? 1.2 : 0.15;
    Object.assign(current, cfg);
  }

  // Carrocería translúcida (para ver el motor desde ángulos tapados en las guías).
  const ghostState = new Map();
  function setGhost(on) {
    for (const m of Object.values(mats)) {
      if (!ghostState.has(m)) ghostState.set(m, { transparent: m.transparent, opacity: m.opacity, depthWrite: m.depthWrite });
      const o = ghostState.get(m);
      m.transparent = on || o.transparent;
      m.opacity = on ? Math.min(o.opacity, 0.12) : o.opacity;
      m.depthWrite = on ? false : o.depthWrite;
      m.needsUpdate = true;
    }
  }

  return {
    capabilities,
    setGhost,
    root,
    body,
    mats,
    nodes,
    openables,
    pickables,
    engineMount,
    wheels,
    applyConfig,
    toggle: (id) => openables[id] && toggle(openables[id]),
    setOpen: (id, open) => (openables[id] ? setOpen(openables[id], open) : Promise.resolve()),
    isOpen: (id) => Boolean(openables[id] && isOpen(openables[id])),
  };
}
