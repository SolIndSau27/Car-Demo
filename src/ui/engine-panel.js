import { esc } from './dom.js';
import { guideButtons } from './guide-card.js';

/** Pestaña "Motor": acciones + lista de piezas. Clic en una pieza = la cámara vuela a ella. */
export function createEnginePanel(root, { engineData, guides = [], onPart, onGuide, onAction }) {
  const groups = new Map();
  engineData.piezas.forEach((p) => {
    if (!groups.has(p.categoria)) groups.set(p.categoria, []);
    groups.get(p.categoria).push(p);
  });

  root.innerHTML = `
    <section class="section" style="padding-top:0">
      <div class="section-head"><h3>${esc(engineData.nombre)}</h3></div>
      <p class="muted small" style="margin-top:0">${engineData.piezas.length} piezas con ficha. Toca una para verla en 3D.</p>
      <div class="engine-actions" data-engine-actions></div>
    </section>
    <section class="section">
      <input class="parts-search" type="search" placeholder="¿Qué quieres hacer? (ej. cambiar bujías)" aria-label="Buscar pieza o guía">
      <div class="parts-group" data-group data-guides>
        <h4>¿Qué quieres hacer?</h4>
        ${guideButtons(guides)}
      </div>
      <div data-list>
        ${[...groups.entries()]
          .map(
            ([cat, list]) => `<div class="parts-group" data-group>
              <h4>${esc(cat)}</h4>
              ${list
                .map(
                  (p) => `<button class="part-item" data-part="${esc(p.id)}" data-search="${esc(normalize(p.nombre + ' ' + p.categoria))}">
                    <span>${esc(p.nombre)}</span>${p.cantidad > 1 ? `<small>×${p.cantidad}</small>` : ''}</button>`,
                )
                .join('')}
            </div>`,
          )
          .join('')}
      </div>
    </section>`;

  const actions = root.querySelector('[data-engine-actions]');
  const search = root.querySelector('.parts-search');
  search.addEventListener('input', () => {
    const q = normalize(search.value);
    // Busca por palabras sueltas: "quiero cambiar bujias" encuentra la guía y la pieza.
    const words = q.split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));
    const match = (txt) => !words.length || words.some((w) => txt.includes(w.replace(/s$/, '')));
    root.querySelectorAll('[data-search]').forEach((b) => (b.hidden = !match(b.dataset.search)));
    root.querySelectorAll('[data-group]').forEach((g) => (g.hidden = ![...g.querySelectorAll('[data-search]')].some((b) => !b.hidden)));
  });
  root.addEventListener('click', (ev) => {
    const guide = ev.target.closest('[data-guide]');
    if (guide) return onGuide(guide.dataset.guide);
    const part = ev.target.closest('[data-part]');
    if (part) return onPart(part.dataset.part);
    const act = ev.target.closest('[data-action]');
    if (act && actions.contains(act)) onAction(act.dataset.action);
  });

  return {
    setState({ engine, xray, busy }) {
      const out = engine !== 'instalado';
      actions.innerHTML = `
        <button class="btn ${out ? '' : 'primary'} small" data-action="engine" ${busy ? 'disabled' : ''}>${out ? '⬇️ Regresar motor' : '⬆️ Sacar motor'}</button>
        <button class="btn small ${engine === 'explosionado' ? 'primary' : ''}" data-action="explode" ${!out || busy ? 'disabled' : ''}>💥 Vista explosionada</button>
        <button class="btn small ${xray ? 'primary' : ''}" data-action="xray">🩻 Rayos X</button>`;
    },
    setCurrent(id) {
      root.querySelectorAll('[data-part]').forEach((b) => b.setAttribute('aria-current', String(b.dataset.part === id)));
    },
  };
}

const STOP = new Set(['quiero', 'como', 'cambiar', 'cambio', 'las', 'los', 'del', 'una', 'uno', 'para', 'hacer', 'mis', 'mi']);

function normalize(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}
