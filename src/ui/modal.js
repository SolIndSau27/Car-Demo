import { esc } from './dom.js';

/** Modal genérico. Devuelve { el, close }. */
export function openModal({ title, body, actions = '' , onClose }) {
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  wrap.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <header class="modal-head"><h2>${esc(title)}</h2><button class="icon-btn" data-close aria-label="Cerrar">✕</button></header>
      <div class="modal-body">${body}</div>
      ${actions ? `<footer class="modal-foot">${actions}</footer>` : ''}
    </div>`;
  document.body.appendChild(wrap);
  const close = () => {
    wrap.remove();
    document.removeEventListener('keydown', onKey);
    onClose?.();
  };
  const onKey = (e) => e.key === 'Escape' && close();
  document.addEventListener('keydown', onKey);
  wrap.addEventListener('click', (e) => {
    if (e.target === wrap || e.target.closest('[data-close]')) close();
  });
  wrap.querySelector('input, button:not([data-close])')?.focus();
  return { el: wrap, close };
}
