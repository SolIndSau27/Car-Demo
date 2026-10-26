import { getAffiliateEntry, AFFILIATE_NOTICE } from '../services/affiliates.js';
import { esc, money } from './dom.js';

/**
 * Bloque de compra de una pieza. Los clics se rastrean por delegación
 * (atributos data-track-*) desde app.js -> trackClick().
 */
export function buyBlock(piezaId, { vars = {}, inList = false, showAdd = true } = {}) {
  const entry = getAffiliateEntry(piezaId, vars);
  if (!entry) return '';
  if (entry.tipo === 'servicio') {
    return `<div class="buy service">
      <div class="buy-title">${esc(entry.titulo)} <small>≈ ${money(entry.precio_aprox_mxn)}</small></div>
      <p class="muted small" style="margin:6px 0 0">${esc(entry.nota ?? 'Servicio de taller.')}</p>
    </div>`;
  }
  const precio = Math.min(...entry.productos.map((p) => p.precio_aprox_mxn || Infinity));
  const links = entry.productos
    .map(
      (p) => `<a class="buy-link ${esc(p.tienda)}" href="${esc(p.url)}" target="_blank" rel="noopener sponsored"
        title="${esc(AFFILIATE_NOTICE)}" data-track-pieza="${esc(piezaId)}" data-track-tienda="${esc(p.tienda)}">${esc(p.tiendaNombre)}</a>`,
    )
    .join('');
  const add = showAdd
    ? `<button class="buy-add" data-list-toggle="${esc(piezaId)}">${inList ? '✓ En mi lista' : '+ Agregar a mi lista'}</button>`
    : '';
  return `<div class="buy">
    <div class="buy-title">${esc(entry.titulo)} <small>≈ ${money(precio === Infinity ? 0 : precio)}</small></div>
    <div class="buy-links">${links}${add}</div>
    ${affiliateNotice()}
  </div>`;
}

export const affiliateNotice = () => `<p class="aff-notice">ⓘ ${esc(AFFILIATE_NOTICE)}. Precio aproximado.</p>`;
