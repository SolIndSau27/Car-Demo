import { esc, VERIFY_NOTE } from './dom.js';
import { buyBlock } from './buy-buttons.js';
import { guideButtons } from './guide-card.js';

/** Ficha de una pieza del motor. */
export function partCard(def, { engineName, inList, guides = [] }) {
  const qty = def.cantidad > 1 ? ` <small class="muted">×${def.cantidad}</small>` : '';
  return `<article class="card">
    <div class="card-kicker">${esc(engineName)} · ${esc(def.categoria)}</div>
    <h2 class="card-title">${esc(def.nombre)}${qty}</h2>
    <h4>Para qué sirve</h4><p>${esc(def.funcion)}</p>
    <h4>Cómo funciona</h4><p>${esc(def.como_funciona)}</p>
    <h4>Síntomas cuando falla</h4>
    <ul>${def.sintomas.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
    ${def.mantenimiento ? `<h4>Mantenimiento</h4><p>${esc(def.mantenimiento)}</p>` : ''}
    ${guides.length ? `<h4>Cómo hacerlo</h4>${guideButtons(guides)}` : ''}
    ${VERIFY_NOTE()}
    <div class="card-actions">
      <button class="btn primary" data-action="show-buy">🛒 Ver dónde comprar</button>
    </div>
    <section data-buy hidden>
      <h4>Dónde comprar</h4>
      ${buyBlock(def.id, { inList: inList(def.id) })}
    </section>
  </article>`;
}

/** Ficha del motor completo cuando está instalado. */
export function engineCard(engineData, vehicle, guides = []) {
  return `<article class="card">
    <div class="card-kicker">Motor</div>
    <h2 class="card-title">${esc(engineData.nombre)}</h2>
    <p>${esc(engineData.piezas.length)} piezas con ficha. Sácalo del carro para separarlo y ver cada pieza.</p>
    <ul class="spec-list">
      <li><span>Aceite</span><span>${esc(vehicle.aceite_motor.viscosidad)}</span></li>
      <li><span>Capacidad</span><span>${esc(vehicle.aceite_motor.capacidad)}</span></li>
      <li><span>Cambio</span><span>${esc(vehicle.aceite_motor.intervalo)}</span></li>
    </ul>
    ${VERIFY_NOTE()}
    <div class="card-actions">
      <button class="btn primary" data-action="engine">⬆️ Sacar motor</button>
      <button class="btn" data-goto-tab="engine">Ver lista de piezas</button>
    </div>
    <h4>¿Qué quieres hacer?</h4>
    ${guideButtons(guides)}
  </article>`;
}
