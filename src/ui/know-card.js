import { esc, VERIFY_NOTE } from './dom.js';
import { buyBlock } from './buy-buttons.js';
import { tireInfo } from '../configurator/tires.js';
import { getAffiliateEntry } from '../services/affiliates.js';

/** Busca un fusible en la estructura del JSON. */
export function findFuse(vehicle, ref) {
  if (!ref) return null;
  const caja = vehicle.fusibles.cajas.find((c) => c.id === ref.caja);
  const f = caja?.fusibles.find((x) => x.numero === ref.numero);
  return f ? { ...f, caja, nota: ref.nota } : null;
}

/** Clave de ficha según la elección actual (ej. 'fascia_deportiva', 'suspension_-30'). */
export function itemKeyFor(kind, cfg) {
  return {
    fascia: `fascia_${cfg.fa}`,
    fender: `fender_${cfg.fe}`,
    aleron: cfg.al === 'ninguno' ? null : `aleron_${cfg.al}`,
    suspension: cfg.s ? `suspension_${cfg.s}` : null,
  }[kind];
}

const spec = (rows) =>
  `<ul class="spec-list">${rows
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `<li><span>${esc(k)}</span><span>${esc(v)}</span></li>`)
    .join('')}</ul>`;

/**
 * Ficha "Lo que necesitas saber" de un elemento elegido en el configurador:
 * especificación, piezas relacionadas, fusible, recomendaciones/advertencias y compra.
 */
export function knowCard(itemKey, { vehicle, cfg, inList }) {
  const f = vehicle.fichas[itemKey] ?? {};
  let titulo = f.titulo ?? itemKey;
  let specHtml = '';
  let alertHtml = '';
  let vars = {};
  let main = getAffiliateEntry(itemKey) ? itemKey : null;

  if (itemKey === 'llanta') {
    const t = tireInfo(vehicle, cfg.t);
    vars = { medida: t.medida };
    main = 'llanta';
    titulo = `Llantas ${t.medida}`;
    specHtml = spec([
      ['Medida', t.medida],
      ['Ancho', `${t.ancho} mm`],
      ['Perfil (altura del costado)', `${t.perfil}% → ${t.flancoMm.toFixed(0)} mm`],
      ['Rin', `${t.rin}"`],
      ['Diámetro total', `${t.diametroMm.toFixed(0)} mm`],
      ['Índice de carga', t.indice_carga],
      ['Índice de velocidad', t.indice_velocidad],
      ['Vs. medida de referencia', `${t.diffPct >= 0 ? '+' : ''}${t.diffPct.toFixed(1)}% (${t.referencia})`],
      ['De fábrica en', t.fabrica ?? 'No es medida de fábrica'],
      ['Presión', vehicle.llantas.presion.valor],
    ]);
    alertHtml = t.excedeTolerancia
      ? `<div class="alert warn">⚠️ Esta medida difiere ${Math.abs(t.diffPct).toFixed(1)}% del diámetro original (más de ${vehicle.llantas.tolerancia_pct}%). A 100 km/h reales tu velocímetro marcaría ≈ ${t.velocimetroA100.toFixed(0)} km/h.</div>`
      : `<div class="alert ok">✓ Diámetro dentro de ±${vehicle.llantas.tolerancia_pct}% del original: el velocímetro no se ve afectado de forma notable.</div>`;
  } else if (itemKey === 'rin') {
    const e = vehicle.rines.especificacion;
    const color = vehicle.rines.colores.find((c) => c.hex === cfg.rc)?.nombre ?? cfg.rc;
    vars = { diametro: cfg.rd };
    main = 'rin';
    titulo = `Rines de ${cfg.rd}" · ${cfg.rs} rayos`;
    specHtml = spec([
      ['Diámetro', `${cfg.rd}"`],
      ['Rayos', cfg.rs],
      ['Color', color],
      ['Barrenación', e.barrenacion],
      ['Centro', e.centro],
      ['Offset', e.offset],
      ['Tuercas', e.birlo],
      ['Torque de tuercas', e.torque_tuercas],
    ]);
  } else if (itemKey === 'pintura') {
    const fab = vehicle.colores_fabrica.lista.find((c) => c.hex.toLowerCase() === cfg.c.toLowerCase());
    specHtml = spec([
      ['Color', fab ? `${fab.nombre} (paleta de fábrica)` : `Personalizado ${cfg.c.toUpperCase()}`],
      ['Acabado', vehicle.acabados[cfg.f].nombre],
    ]);
  }

  const especificacion = f.especificacion?.length ? `<ul>${f.especificacion.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>` : '';
  const fuse = findFuse(vehicle, f.fusible);
  const fuseHtml = fuse
    ? `<h4>Fusible del circuito</h4>
       <div class="fuse"><strong>${esc(fuse.numero)} · ${esc(fuse.amperaje)} A</strong> — ${esc(fuse.circuito)}<br>
       <span class="muted small">${esc(fuse.caja.nombre)} · ${esc(fuse.caja.ubicacion)}</span>
       ${fuse.ejemplo ? ' <span class="tag-ex">dato de ejemplo</span>' : ''}
       ${fuse.nota ? `<br><span class="small">${esc(fuse.nota)}</span>` : ''}</div>`
    : '';
  const relacionadas = (f.relacionadas ?? []).filter((id) => id !== main);
  const list = (title, items) => (items?.length ? `<h4>${title}</h4><ul>${items.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>` : '');

  return `<article class="card">
    <div class="card-kicker">Lo que necesitas saber</div>
    <h2 class="card-title">${esc(titulo)}</h2>
    ${specHtml || especificacion ? `<h4>Especificación para tu carro</h4>${specHtml}${especificacion}` : ''}
    ${alertHtml}
    ${VERIFY_NOTE()}
    ${main ? `<h4>Comprar</h4>${buyBlock(main, { vars, inList: inList(main) })}` : ''}
    ${relacionadas.length ? `<h4>Piezas y servicios relacionados</h4>${relacionadas.map((id) => buyBlock(id, { vars, inList: inList(id) })).join('')}` : ''}
    ${fuseHtml}
    ${list('Recomendaciones', f.recomendaciones)}
    ${list('Advertencias', f.advertencias)}
  </article>`;
}
