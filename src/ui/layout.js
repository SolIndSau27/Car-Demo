import { esc } from './dom.js';

/** Estructura base de la app. Devuelve referencias a sus zonas. */
export function renderLayout(root, vehicle) {
  root.innerHTML = `
    <header class="topbar">
      <div class="brand"><span class="mark" aria-hidden="true">▲</span>MiNave</div>
      <div class="compat"><strong id="car-name"></strong><small>${esc(vehicle.compatibilidad)}</small></div>
      <nav class="top-actions" aria-label="Acciones">
        <button data-action="save" title="Guardar mi carro">💾 <span>Guardar</span></button>
        <button data-action="garage" title="Mis carros">🚗 <span>Mis carros</span></button>
        <button data-action="share" title="Compartir">🔗 <span>Compartir</span></button>
        <button data-action="cart" class="primary" title="Mi lista de compras">🛒 <span>Lista</span> <b class="badge" id="cart-count">0</b></button>
      </nav>
    </header>
    <main class="layout">
      <section class="viewport" id="viewport" aria-label="Visor 3D">
        <div class="loading" id="loading">Cargando tu carro…</div>
        <p class="hint">Arrastra para girar · rueda o pellizco para zoom · toca una pieza</p>
        <div class="toolbar" id="toolbar" role="toolbar" aria-label="Acciones del visor"></div>
      </section>
      <aside class="panel" id="panel">
        <div class="tabs" role="tablist">
          <button role="tab" data-tab="config" aria-selected="true">Mi versión</button>
          <button role="tab" data-tab="engine" aria-selected="false">Motor</button>
          <button role="tab" data-tab="data" aria-selected="false">Datos</button>
        </div>
        <div class="tab-body" data-tabpanel="config"></div>
        <div class="tab-body" data-tabpanel="engine" hidden></div>
        <div class="tab-body" data-tabpanel="data" hidden></div>
      </aside>
      <aside class="drawer" id="drawer" aria-hidden="true">
        <div class="drawer-grip"></div>
        <button class="icon-btn drawer-close" data-drawer-close aria-label="Cerrar ficha">✕</button>
        <div class="drawer-body"></div>
      </aside>
    </main>`;

  const q = (s) => root.querySelector(s);
  const tabs = root.querySelectorAll('[data-tab]');
  const panels = root.querySelectorAll('[data-tabpanel]');
  function showTab(name) {
    tabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === name)));
    panels.forEach((p) => (p.hidden = p.dataset.tabpanel !== name));
  }
  tabs.forEach((t) => t.addEventListener('click', () => showTab(t.dataset.tab)));

  const drawer = q('#drawer');
  const drawerBody = drawer.querySelector('.drawer-body');
  const listeners = new Set();
  const drawerApi = {
    open(content) {
      drawerBody.innerHTML = content;
      drawerBody.scrollTop = 0;
      drawer.classList.add('open');
      drawer.setAttribute('aria-hidden', 'false');
    },
    close() {
      drawer.classList.remove('open');
      drawer.setAttribute('aria-hidden', 'true');
      listeners.forEach((fn) => fn());
    },
    onClose: (fn) => listeners.add(fn),
    body: drawerBody,
    get isOpen() {
      return drawer.classList.contains('open');
    },
  };
  drawer.querySelector('[data-drawer-close]').addEventListener('click', () => drawerApi.close());
  document.addEventListener('keydown', (e) => e.key === 'Escape' && !document.querySelector('.modal') && drawerApi.close());

  return {
    viewport: q('#viewport'),
    loading: q('#loading'),
    toolbar: q('#toolbar'),
    topActions: q('.top-actions'),
    carName: q('#car-name'),
    cartCount: q('#cart-count'),
    tab: { config: q('[data-tabpanel="config"]'), engine: q('[data-tabpanel="engine"]'), data: q('[data-tabpanel="data"]') },
    showTab,
    drawer: drawerApi,
  };
}
