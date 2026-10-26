import { esc } from './dom.js';
import { compatibleTires, tireInfo } from '../configurator/tires.js';

/**
 * Panel "Mi versión". Emite cambios con onChange(patch) y pide fichas con onKnow(itemKey).
 */
export function createConfiguratorPanel(root, { vehicle, onChange, onKnow }) {
  let cfg = null;

  root.addEventListener('click', (ev) => {
    const t = ev.target.closest('button');
    if (!t || !root.contains(t)) return;
    const d = t.dataset;
    if (d.know) return onKnow(d.know);
    if (d.color) return onChange({ c: d.color, f: d.finish || cfg.f });
    if (d.finish) return onChange({ f: d.finish });
    if (d.rd) return onChange({ rd: Number(d.rd) });
    if (d.rs) return onChange({ rs: Number(d.rs) });
    if (d.rc) return onChange({ rc: d.rc });
    if (d.tire) return onChange({ t: d.tire });
    if (d.fa) return onChange({ fa: d.fa });
    if (d.fe) return onChange({ fe: d.fe });
    if (d.al) return onChange({ al: d.al });
    if (d.susp !== undefined) return onChange({ s: Number(d.susp) });
    if (d.upgrade) {
      const u = new Set(cfg.u);
      u.has(d.upgrade) ? u.delete(d.upgrade) : u.add(d.upgrade);
      return onChange({ u: [...u] });
    }
  });
  root.addEventListener('input', (ev) => {
    if (ev.target.matches('[data-free-color]')) onChange({ c: ev.target.value });
  });

  const pressed = (b) => `aria-pressed="${b ? 'true' : 'false'}"`;
  const head = (title, know, label = 'Lo que necesitas saber') =>
    `<div class="section-head"><h3>${esc(title)}</h3>${know ? `<button class="link-btn" data-know="${esc(know)}">${label} →</button>` : ''}</div>`;
  const option = (attr, value, active, title, desc, know) => `
    <div class="row" style="margin:0">
      <button class="option" data-${attr}="${esc(value)}" ${pressed(active)}>
        <span class="check">${active ? '✓' : ''}</span>
        <span class="txt"><strong>${esc(title)}</strong>${desc ? `<span>${esc(desc)}</span>` : ''}</span>
      </button>
      ${know ? `<button class="info-btn" data-know="${esc(know)}" aria-label="Ficha de ${esc(title)}">Ficha</button>` : ''}
    </div>`;

  function render() {
    const v = vehicle;
    const t = tireInfo(v, cfg.t);
    const alturaMm = (t.diametroMm - tireInfo(v, v.llantas.referencia).diametroMm) / 2;
    const free = !v.colores_fabrica.lista.some((c) => c.hex.toLowerCase() === cfg.c.toLowerCase());

    root.innerHTML = `
      <section class="section">
        ${head('Color', 'pintura')}
        <div class="swatches">
          ${v.colores_fabrica.lista
            .map((c) => `<button class="swatch" title="${esc(c.nombre)}" aria-label="${esc(c.nombre)}" style="background:${c.hex}" data-color="${c.hex}" data-finish="${c.acabado}" ${pressed(c.hex.toLowerCase() === cfg.c.toLowerCase())}></button>`)
            .join('')}
          <label class="swatch-free" title="Color libre" style="${free ? `box-shadow:0 0 0 2px var(--brand)` : ''}">
            <input type="color" data-free-color value="${esc(cfg.c)}" aria-label="Elegir color libre">
          </label>
        </div>
        <div class="row"><label>Acabado</label><div class="chips">
          ${Object.entries(v.acabados).map(([id, a]) => `<button class="chip" data-finish="${id}" ${pressed(cfg.f === id)}>${esc(a.nombre)}</button>`).join('')}
        </div></div>
        <p class="muted small">${esc(v.colores_fabrica.nota)}</p>
      </section>

      <section class="section">
        ${head('Rines', 'rin')}
        <div class="row"><label>Diámetro</label><div class="chips">
          ${v.rines.diametros.map((d) => `<button class="chip" data-rd="${d}" ${pressed(cfg.rd === d)}>${d}"</button>`).join('')}
        </div></div>
        <div class="row"><label>Rayos</label><div class="chips">
          ${v.rines.rayos.map((r) => `<button class="chip" data-rs="${r}" ${pressed(cfg.rs === r)}>${r}</button>`).join('')}
        </div></div>
        <div class="row"><label>Color</label><div class="swatches">
          ${v.rines.colores.map((c) => `<button class="swatch" title="${esc(c.nombre)}" aria-label="${esc(c.nombre)}" style="background:${c.hex}" data-rc="${c.hex}" ${pressed(cfg.rc === c.hex)}></button>`).join('')}
        </div></div>
      </section>

      <section class="section">
        ${head('Llantas', 'llanta')}
        <p class="muted small" style="margin-top:0">Medidas compatibles con rin de ${cfg.rd}":</p>
        <div class="chips">
          ${compatibleTires(v, cfg.rd)
            .map((x) => {
              const fab = v.llantas.fabrica.find((f) => f.medida === x.medida);
              return `<button class="chip" data-tire="${esc(x.medida)}" ${pressed(cfg.t === x.medida)}>${esc(x.medida)}${fab ? ' <small>· fábrica</small>' : ''}</button>`;
            })
            .join('')}
        </div>
        <div class="tire-box">
          <div class="big">${esc(t.medida)} <span class="muted small">${t.indice_carga ?? ''}${esc(t.indice_velocidad ?? '')}</span></div>
          <div>Diámetro total: <strong>${t.diametroMm.toFixed(0)} mm</strong> · costado ${t.flancoMm.toFixed(0)} mm</div>
          <div>Altura del carro: <strong>${alturaMm >= 0 ? '+' : ''}${alturaMm.toFixed(1)} mm</strong> vs. ${esc(v.llantas.referencia)}</div>
          ${
            t.excedeTolerancia
              ? `<div class="alert warn">⚠️ Difiere ${Math.abs(t.diffPct).toFixed(1)}% del diámetro original (más de ${v.llantas.tolerancia_pct}%): afecta velocímetro. A 100 km/h reales marcaría ≈ ${t.velocimetroA100.toFixed(0)} km/h.</div>`
              : `<div class="alert ok">✓ ${t.diffPct >= 0 ? '+' : ''}${t.diffPct.toFixed(1)}% vs. original: dentro de tolerancia.</div>`
          }
          <button class="btn small block" style="margin-top:8px" data-know="llanta">Ver medida, relacionadas y dónde comprar</button>
        </div>
      </section>

      <section class="section">
        ${head('Carrocería')}
        <p class="muted small" style="margin:0 0 6px">Fascia delantera</p>
        <div class="option-list">${v.carroceria.fascia.map((o) => option('fa', o.id, cfg.fa === o.id, o.nombre, o.descripcion, `fascia_${o.id}`)).join('')}</div>
        <p class="muted small" style="margin:12px 0 6px">Salpicaderas (fenders)</p>
        <div class="option-list">${v.carroceria.fender.map((o) => option('fe', o.id, cfg.fe === o.id, o.nombre, o.descripcion, `fender_${o.id}`)).join('')}</div>
        <p class="muted small" style="margin:12px 0 6px">Alerón</p>
        <div class="option-list">${v.carroceria.aleron.map((o) => option('al', o.id, cfg.al === o.id, o.nombre, o.descripcion, o.id === 'ninguno' ? null : `aleron_${o.id}`)).join('')}</div>
      </section>

      <section class="section">
        ${head('Suspensión')}
        <div class="option-list">${v.suspension.map((o) => option('susp', o.valor, cfg.s === o.valor, o.nombre, '', o.valor ? `suspension_${o.valor}` : null)).join('')}</div>
      </section>

      <section class="section">
        ${head('Mejoras de motor y accesorios')}
        <div class="option-list">${v.mejoras.map((o) => option('upgrade', o.id, cfg.u.includes(o.id), o.nombre, o.categoria, o.id)).join('')}</div>
      </section>`;
  }

  return {
    update(next) {
      cfg = next;
      // No re-dibujar mientras el usuario arrastra el selector de color libre.
      if (document.activeElement?.matches?.('[data-free-color]') && root.contains(document.activeElement)) return;
      const top = root.scrollTop;
      render();
      root.scrollTop = top;
    },
  };
}
