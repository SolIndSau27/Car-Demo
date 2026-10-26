import affiliates from '../data/affiliates.json';

const env = import.meta.env ?? {};

export const AFFILIATE_NOTICE = affiliates.aviso;

/** Sustituye {placeholders} (ej. {medida}, {diametro}) en un texto. */
export function fillTemplate(text, vars = {}) {
  return String(text).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
}

/**
 * Única función que arma un link de afiliado.
 * Usa el tag del producto si existe; si no, el de .env según la tienda.
 */
export function buildAffiliateUrl(producto, vars = {}) {
  const tienda = affiliates.tiendas[producto.tienda];
  const enQuery = producto.url_base.includes('?');
  const safeVars = Object.fromEntries(
    Object.entries(vars).map(([k, v]) => [k, enQuery ? encodeURIComponent(v) : String(v).replace(/[\s/]+/g, '-')]),
  );
  const url = new URL(fillTemplate(producto.url_base, safeVars));
  const tag = producto.tag_afiliado || (tienda && env[tienda.env]) || '';
  if (tienda && tag) url.searchParams.set(tienda.param, tag);
  return url.toString();
}

export function storeName(tiendaId) {
  return affiliates.tiendas[tiendaId]?.nombre ?? tiendaId;
}

/** Devuelve la entrada de affiliates.json de una pieza, con textos ya rellenados. */
export function getAffiliateEntry(piezaId, vars = {}) {
  const entry = affiliates.piezas[piezaId];
  if (!entry) return null;
  return {
    id: piezaId,
    ...entry,
    titulo: fillTemplate(entry.titulo, vars),
    productos: (entry.productos ?? []).map((p) => ({
      ...p,
      titulo: fillTemplate(p.titulo, vars),
      url: buildAffiliateUrl(p, vars),
      tiendaNombre: storeName(p.tienda),
    })),
  };
}

/** Precio aproximado más bajo de una pieza (para la lista de compras). */
export function approxPrice(piezaId) {
  const entry = affiliates.piezas[piezaId];
  if (!entry) return 0;
  if (entry.precio_aprox_mxn) return entry.precio_aprox_mxn;
  const precios = (entry.productos ?? []).map((p) => p.precio_aprox_mxn).filter(Boolean);
  return precios.length ? Math.min(...precios) : 0;
}
