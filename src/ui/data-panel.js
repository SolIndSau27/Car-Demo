import { esc, VERIFY_NOTE } from './dom.js';
import { parseTireSize } from '../configurator/tires.js';

/** Pestaña "Datos": datos técnicos, todos marcados como no verificados. */
export function renderDataPanel(root, vehicle) {
  const v = vehicle;
  const flag = (obj) => (obj?.verificado ? '<span class="tag-ex" style="background:#e8f6ee;color:#138a52">verificado</span>' : '<span class="tag-ex">sin verificar</span>');
  root.innerHTML = `
    <section class="section" style="padding-top:0">
      <div class="section-head"><h3>Aceite de motor</h3>${flag(v.aceite_motor)}</div>
      <table class="data">
        <tr><th>Viscosidad</th><td>${esc(v.aceite_motor.viscosidad)}</td></tr>
        <tr><th>Capacidad</th><td>${esc(v.aceite_motor.capacidad)}</td></tr>
        <tr><th>Intervalo</th><td>${esc(v.aceite_motor.intervalo)}</td></tr>
      </table>
      ${VERIFY_NOTE()}
    </section>

    <section class="section">
      <div class="section-head"><h3>Llantas de fábrica</h3>${flag({ verificado: false })}</div>
      <table class="data">
        <tr><th>Versión</th><th>Medida</th><th>Diámetro</th></tr>
        ${v.llantas.fabrica
          .map((f) => `<tr><td>${esc(f.version)}</td><td>${esc(f.medida)}</td><td>${parseTireSize(f.medida).diametroMm.toFixed(0)} mm</td></tr>`)
          .join('')}
      </table>
      <p class="muted small">Presión: ${esc(v.llantas.presion.valor)}. ${esc(v.llantas.presion.nota)}</p>
      ${VERIFY_NOTE()}
    </section>

    <section class="section">
      <div class="section-head"><h3>Rines</h3>${flag(v.rines.especificacion)}</div>
      <table class="data">
        <tr><th>Barrenación</th><td>${esc(v.rines.especificacion.barrenacion)}</td></tr>
        <tr><th>Centro</th><td>${esc(v.rines.especificacion.centro)}</td></tr>
        <tr><th>Offset</th><td>${esc(v.rines.especificacion.offset)}</td></tr>
        <tr><th>Tuercas</th><td>${esc(v.rines.especificacion.birlo)}</td></tr>
        <tr><th>Torque</th><td>${esc(v.rines.especificacion.torque_tuercas)}</td></tr>
      </table>
      ${VERIFY_NOTE()}
    </section>

    <section class="section">
      <div class="section-head"><h3>Fusibles</h3>${flag(v.fusibles)}</div>
      <p class="verify">⚠️ ${esc(v.fusibles.nota)} Verifica en tu manual de propietario.</p>
      ${v.fusibles.cajas
        .map(
          (c) => `<h4 style="margin:12px 0 2px;font-size:14px">${esc(c.nombre)}</h4>
          <p class="muted small" style="margin:0 0 6px">${esc(c.ubicacion)}</p>
          <table class="data"><tr><th>N.º</th><th>Amp.</th><th>Circuito</th></tr>
          ${c.fusibles.map((f) => `<tr><td>${esc(f.numero)}</td><td>${esc(f.amperaje)} A</td><td>${esc(f.circuito)}${f.ejemplo ? ' <span class="tag-ex">ejemplo</span>' : ''}</td></tr>`).join('')}
          </table>`,
        )
        .join('')}
    </section>

    <section class="section">
      <div class="section-head"><h3>Dimensiones</h3>${flag(v.dimensiones)}</div>
      <table class="data">
        <tr><th>Largo</th><td>${v.dimensiones.largo_m} m</td></tr>
        <tr><th>Ancho</th><td>${v.dimensiones.ancho_m} m</td></tr>
        <tr><th>Alto</th><td>${v.dimensiones.alto_m} m</td></tr>
        <tr><th>Distancia entre ejes</th><td>${v.dimensiones.distancia_ejes_m} m</td></tr>
      </table>
      ${VERIFY_NOTE()}
    </section>`;
}
