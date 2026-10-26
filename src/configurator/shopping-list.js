import { defaultConfig } from './state.js';
import { getAffiliateEntry, approxPrice } from '../services/affiliates.js';

/**
 * "Mi lista de compras": piezas que implica la configuración + las que el usuario agregó.
 * Devuelve [{ id, titulo, motivo, cantidad, precioUnit, subtotal, entry, auto }] y el total.
 */
export function buildShoppingList(vehicle, cfg) {
  const def = defaultConfig(vehicle);
  const vars = { medida: cfg.t, diametro: cfg.rd };
  const items = new Map();
  const add = (id, motivo, cantidad = 1, auto = true) => {
    if (!items.has(id) && getAffiliateEntry(id)) items.set(id, { id, motivo, cantidad, auto });
  };

  const rinCambio = cfg.rd !== def.rd || cfg.rs !== def.rs || cfg.rc !== def.rc;
  const llantaCambio = cfg.t !== vehicle.llantas.referencia;
  if (rinCambio) add('rin', `Rines de ${cfg.rd}" con ${cfg.rs} rayos`);
  if (llantaCambio) add('llanta', `Llantas ${cfg.t}`, 4);
  if (rinCambio) add('birlos', 'Recomendado al cambiar rines');
  if (cfg.fa !== 'estandar') add(`fascia_${cfg.fa}`, 'Fascia elegida');
  if (cfg.fe !== 'estandar') add(`fender_${cfg.fe}`, 'Salpicaderas elegidas', cfg.fe === 'ventilado' ? 2 : 1);
  if (cfg.al !== 'ninguno') add(`aleron_${cfg.al}`, 'Alerón elegido');
  if (cfg.s === -30) add('resortes_cortos', 'Suspensión -30 mm');
  if (cfg.s === -50) add('coilovers', 'Suspensión -50 mm');
  cfg.u.forEach((id) => add(id, 'Mejora elegida'));
  const fabrica = vehicle.colores_fabrica.lista.find((c) => c.hex.toLowerCase() === cfg.c.toLowerCase());
  if (!fabrica || cfg.f !== fabrica.acabado) add('vinil_wrap', 'Para el color o acabado elegido');
  if (rinCambio || llantaCambio || cfg.s !== 0) add('alineacion_balanceo', 'Después de cambiar rines, llantas o suspensión');
  cfg.l.forEach((id) => add(id, 'Agregado por ti', 1, false));

  const list = [...items.values()].map((it) => {
    const entry = getAffiliateEntry(it.id, vars);
    const precioUnit = approxPrice(it.id);
    return { ...it, entry, titulo: entry.titulo, precioUnit, subtotal: precioUnit * it.cantidad };
  });
  return { items: list, total: list.reduce((s, it) => s + it.subtotal, 0), vars };
}
