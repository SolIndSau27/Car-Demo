import { esc, VERIFY_NOTE } from './dom.js';
import { buyBlock } from './buy-buttons.js';

/** Lista de guías como botones (para fichas y la pestaña Motor). */
export function guideButtons(guides) {
  if (!guides.length) return '';
  return `<div class="guide-list">${guides
    .map(
      (g) => `<button class="guide-btn" data-guide="${esc(g.id)}" data-search="${esc(normalize(g.titulo + ' ' + g.piezas.join(' ')))}">
        <span class="ico">🔧</span><span class="txt"><strong>${esc(g.titulo)}</strong><small>${esc(g.dificultad)} · ${esc(g.tiempo)}</small></span><span aria-hidden="true">›</span>
      </button>`,
    )
    .join('')}</div>`;
}

/**
 * Ficha de guía. step 0 = "Antes de empezar" (herramientas, especificaciones, refacciones);
 * step 1..n = pasos con el 3D sincronizado.
 */
export function guideCard(guide, step, { inList }) {
  const n = guide.pasos.length;
  const dots = Array.from({ length: n + 1 }, (_, i) => `<button class="step-dot" data-guide-step="${i}" aria-current="${i === step}" aria-label="${i === 0 ? 'Antes de empezar' : `Paso ${i}`}">${i === 0 ? '★' : i}</button>`).join('');
  const head = `<div class="card-kicker">Guía paso a paso · ${esc(guide.dificultad)} · ${esc(guide.tiempo)}</div>
    <h2 class="card-title">${esc(guide.titulo)}</h2>
    <nav class="steps" aria-label="Pasos">${dots}</nav>`;

  if (step === 0) {
    return `<article class="card">${head}
      <p>${esc(guide.cuando)}</p>
      <h4>Herramientas</h4>
      <ul>${guide.herramientas.map((h) => `<li>${esc(h.nombre)}</li>`).join('')}</ul>
      ${
        guide.especificaciones.length
          ? `<h4>Especificaciones</h4><ul class="spec-list">${guide.especificaciones
              .map((e) => `<li><span>${esc(e.dato)}</span><span>${esc(e.valor)}${e.verificado ? '' : ' <span class="tag-ex">sin verificar</span>'}</span></li>`)
              .join('')}</ul>`
          : ''
      }
      ${VERIFY_NOTE()}
      <div class="card-actions"><button class="btn primary block" data-guide-nav="next">Empezar: paso 1 de ${n} →</button></div>
      <h4>Qué comprar</h4>
      ${guide.refacciones.map((id) => buyBlock(id, { inList: inList(id) })).join('')}
      ${guide.herramientas.filter((h) => h.afiliado).map((h) => buyBlock(h.afiliado, { inList: inList(h.afiliado) })).join('')}
    </article>`;
  }

  const p = guide.pasos[step - 1];
  const last = step === n;
  return `<article class="card">${head}
    <div class="step-box">
      <div class="step-num">Paso ${step} de ${n}</div>
      <h3>${esc(p.titulo)}</h3>
      <p>${esc(p.texto)}</p>
      ${p.advertencia ? `<div class="alert warn">⚠️ ${esc(p.advertencia)}</div>` : ''}
      ${p.rayosX ? '<p class="muted small">Vista con rayos X para ver las piezas dentro de la cabeza.</p>' : ''}
    </div>
    <div class="card-actions guide-nav">
      <button class="btn" data-guide-nav="prev">← Anterior</button>
      ${last ? '<button class="btn primary" data-guide-nav="done">✓ Terminé</button>' : '<button class="btn primary" data-guide-nav="next">Siguiente →</button>'}
    </div>
    ${last ? `<h4>Qué comprar</h4>${guide.refacciones.map((id) => buyBlock(id, { inList: inList(id) })).join('')}` : ''}
    ${VERIFY_NOTE('Especificaciones sin verificar: confírmalas en tu manual de servicio')}
  </article>`;
}

export function normalize(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}
