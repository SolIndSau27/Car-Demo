const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escapa texto para insertarlo en HTML (los nombres de carro los escribe el usuario). */
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

export const money = (n) =>
  n ? n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }) : '—';

export function html(strings, ...values) {
  return strings.reduce((out, s, i) => out + s + (i < values.length ? values[i] ?? '' : ''), '');
}

export function el(tag, attrs = {}, inner = '') {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
  node.innerHTML = inner;
  return node;
}

/** Delegación de eventos: on(root, 'click', '[data-action]', fn) */
export function on(root, type, selector, fn) {
  root.addEventListener(type, (ev) => {
    const target = ev.target.closest(selector);
    if (target && root.contains(target)) fn(ev, target);
  });
}

export const VERIFY_NOTE = (texto = 'Verifica en tu manual de propietario') =>
  `<p class="verify">⚠️ ${esc(texto)}</p>`;
