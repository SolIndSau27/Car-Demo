import { openModal } from './modal.js';
import { esc, money } from './dom.js';
import { affiliateNotice } from './buy-buttons.js';
import { AFFILIATE_NOTICE } from '../services/affiliates.js';

export function saveDialog({ defaultName, onSave }) {
  const m = openModal({
    title: 'Guardar mi carro',
    body: `<label class="field">Nombre
      <input type="text" maxlength="40" value="${esc(defaultName)}" data-name></label>
      <p class="muted small">Se guarda en este navegador. Con una cuenta (próximamente) lo verás en todos tus dispositivos.</p>`,
    actions: `<button class="btn" data-close>Cancelar</button><button class="btn primary" data-save>Guardar</button>`,
  });
  const input = m.el.querySelector('[data-name]');
  input.select();
  const save = () => {
    onSave(input.value.trim() || defaultName);
    m.close();
  };
  m.el.querySelector('[data-save]').addEventListener('click', save);
  input.addEventListener('keydown', (e) => e.key === 'Enter' && save());
}

export function garageDialog({ cars, currentId, onLoad, onDelete, onNew }) {
  const render = (list) =>
    list.length
      ? list
          .map(
            (c) => `<div class="garage-item">
          <span class="dot" style="background:${esc(c.config.c)}"></span>
          <div class="txt"><strong>${esc(c.nombre)}${c.id === currentId ? ' <span class="tag-ex">abierto</span>' : ''}</strong>
            <span class="muted small">Rin ${esc(c.config.rd)}" · ${esc(c.config.t)} · ${new Date(c.actualizado).toLocaleDateString('es-MX')}</span></div>
          <button class="btn small" data-load="${esc(c.id)}">Abrir</button>
          <button class="icon-btn" data-del="${esc(c.id)}" aria-label="Borrar ${esc(c.nombre)}">🗑</button>
        </div>`,
          )
          .join('')
      : '<p class="muted">Aún no guardas ningún carro. Usa “Guardar” para tenerlo aquí.</p>';
  const m = openModal({
    title: 'Mis carros',
    body: `<div data-list>${render(cars)}</div>`,
    actions: `<button class="btn" data-new>+ Empezar uno nuevo</button><button class="btn primary" data-close>Listo</button>`,
  });
  m.el.addEventListener('click', (e) => {
    const load = e.target.closest('[data-load]');
    const del = e.target.closest('[data-del]');
    if (load) {
      onLoad(load.dataset.load);
      m.close();
    } else if (del) {
      m.el.querySelector('[data-list]').innerHTML = render(onDelete(del.dataset.del));
    } else if (e.target.closest('[data-new]')) {
      onNew();
      m.close();
    }
  });
}

export function shareDialog({ url }) {
  const m = openModal({
    title: 'Compartir mi carro',
    body: `<p class="muted small" style="margin-top:0">Quien abra este link verá tu carro con la misma configuración.</p>
      <label class="field">Link<input type="text" readonly value="${esc(url)}" data-url></label>`,
    actions: `${navigator.share ? '<button class="btn" data-native>Compartir…</button>' : ''}<button class="btn primary" data-copy>Copiar link</button>`,
  });
  const input = m.el.querySelector('[data-url]');
  input.addEventListener('focus', () => input.select());
  m.el.querySelector('[data-copy]').addEventListener('click', async (e) => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      input.select();
      document.execCommand?.('copy');
    }
    e.target.textContent = '✓ Copiado';
  });
  m.el.querySelector('[data-native]')?.addEventListener('click', () => navigator.share({ title: 'Mi carro en MiNave', url }).catch(() => {}));
}

export function cartDialog({ list, carName, onRemove, onQuote }) {
  const body = list.items.length
    ? `${list.items
        .map(
          (it) => `<div class="cart-row">
        <div class="txt"><strong>${esc(it.titulo)}</strong>${it.cantidad > 1 ? ` <span class="muted">×${it.cantidad}</span>` : ''}<br>
          <span class="muted small">${esc(it.motivo)}</span>
          <div class="buy-links">${(it.entry.productos ?? [])
            .map(
              (p) => `<a class="buy-link ${esc(p.tienda)}" href="${esc(p.url)}" target="_blank" rel="noopener sponsored" title="${esc(AFFILIATE_NOTICE)}"
                data-track-pieza="${esc(it.id)}" data-track-tienda="${esc(p.tienda)}">${esc(p.tiendaNombre)}</a>`,
            )
            .join('')}${it.entry.tipo === 'servicio' ? '<span class="muted small">Servicio de taller</span>' : ''}</div>
        </div>
        <div style="text-align:right"><div class="price">${money(it.subtotal)}</div>
          ${it.auto ? '' : `<button class="link-btn" data-remove="${esc(it.id)}">Quitar</button>`}</div>
      </div>`,
        )
        .join('')}
      <div class="cart-total"><span>Total aproximado</span><span>${money(list.total)}</span></div>
      ${affiliateNotice()}`
    : '<p class="muted">Tu lista está vacía. Cambia rines, llantas o agrega piezas desde sus fichas.</p>';
  const m = openModal({
    title: `Mi lista de compras · ${carName}`,
    body,
    actions: list.items.length
      ? `<button class="btn" data-quote title="Fase 2">🔧 Cotizar instalación</button><button class="btn primary" data-close>Listo</button>`
      : `<button class="btn primary" data-close>Listo</button>`,
  });
  m.el.addEventListener('click', (e) => {
    const r = e.target.closest('[data-remove]');
    if (r) {
      onRemove(r.dataset.remove);
      m.close();
    }
    if (e.target.closest('[data-quote]')) onQuote();
  });
  return m;
}
