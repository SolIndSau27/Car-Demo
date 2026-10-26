/** Barra de acciones sobre el visor 3D. */
export function createToolbar(root, onAction) {
  root.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-action]');
    if (b && !b.disabled) onAction(b.dataset.action);
  });
  const btn = (action, ico, label, { on = false, disabled = false, cta = false } = {}) =>
    `<button class="tool ${on ? 'on' : ''} ${cta ? 'cta' : ''}" data-action="${action}" ${disabled ? 'disabled' : ''} aria-pressed="${on}"><span class="ico">${ico}</span>${label}</button>`;
  return {
    render(s) {
      const out = s.engine !== 'instalado';
      root.innerHTML = [
        btn('doors', '🚪', s.doors ? 'Cerrar puertas' : 'Puertas', { on: s.doors }),
        btn('hood', '🔧', 'Cofre', { on: s.hood }),
        btn('trunk', '🧳', 'Cajuela', { on: s.trunk }),
        btn('engine', out ? '⬇️' : '⬆️', out ? 'Regresar motor' : 'Sacar motor', { cta: !out, disabled: s.busy }),
        btn('explode', '💥', 'Explosionar', { on: s.engine === 'explosionado', disabled: !out || s.busy }),
        btn('xray', '🩻', 'Rayos X', { on: s.xray }),
        btn('home', '🎯', 'Vista inicial'),
        s.editor ? btn('editor', '📐', 'Editor de vistas') : '',
      ].join('');
    },
  };
}
