import gsap from 'gsap';
import vehicle from './data/vehicles/sonata-2016.json';
import engineData from './data/parts/engine-2.4-gdi.json';
import guidesData from './data/guides/engine-2.4-gdi.json';
import { createStage } from './scene/stage.js';
import { createPicker } from './scene/picking.js';
import { setHighlight } from './scene/highlight.js';
import { flyTo, flyToObject, homeView } from './scene/camera-fly.js';
import { createCar } from './vehicle/car.js';
import { buildProceduralEngine } from './engine/procedural-engine.js';
import { createEngineController } from './engine/engine-controller.js';
import { createStore, defaultConfig } from './configurator/state.js';
import { buildShoppingList } from './configurator/shopping-list.js';
import { renderLayout } from './ui/layout.js';
import { createTooltip } from './ui/tooltip.js';
import { createToolbar } from './ui/toolbar.js';
import { createConfiguratorPanel } from './ui/configurator-panel.js';
import { createEnginePanel } from './ui/engine-panel.js';
import { renderDataPanel } from './ui/data-panel.js';
import { partCard, engineCard } from './ui/part-card.js';
import { knowCard, itemKeyFor } from './ui/know-card.js';
import { guideCard } from './ui/guide-card.js';
import { saveDialog, garageDialog, shareDialog, cartDialog } from './ui/dialogs.js';
import { toast } from './ui/toast.js';
import { on } from './ui/dom.js';
import { trackClick } from './services/tracking.js';
import { listCars, saveCar, deleteCar, saveCurrent, loadCurrent } from './services/storage.js';
import { buildShareUrl, readConfigFromUrl, clearConfigFromUrl } from './services/share-url.js';

const DOORS = ['puerta_del_izq', 'puerta_del_der', 'puerta_tras_izq', 'puerta_tras_der'];

export async function startApp(rootEl) {
  const ui = renderLayout(rootEl, vehicle);
  const stage = createStage(ui.viewport);
  const goHome = (d = 1.1) => {
    const h = homeView(stage.camera.aspect);
    return flyTo(stage, h.position, h.target, d);
  };
  {
    const h = homeView(stage.camera.aspect);
    stage.camera.position.copy(h.position);
    stage.controls.target.copy(h.target);
  }

  // ---------- Modelo 3D ----------
  const car = await createCar(vehicle);
  stage.scene.add(car.root);
  const engine = buildProceduralEngine(engineData);
  car.engineMount.add(engine.root);
  const partDefs = new Map(engineData.piezas.map((p) => [p.id, p]));
  engine.root.userData.pick = { id: 'motor', kind: 'engine', label: 'Motor 2.4L GDI' };
  engine.parts.forEach((g, id) => (g.userData.pick = { id, kind: 'engine-part', label: partDefs.get(id).nombre }));
  const ctl = createEngineController({
    root: engine.root,
    parts: engine.parts,
    partsData: engineData,
    montaje: vehicle.motor_montaje,
    openHood: () => car.setOpen('cofre', true),
  });

  // ---------- Configuración inicial: link compartido > última sesión > fábrica ----------
  const fromUrl = readConfigFromUrl();
  const saved = loadCurrent();
  let carId = fromUrl ? null : (saved?.carId ?? null);
  const store = createStore(vehicle, fromUrl ?? saved?.config ?? defaultConfig(vehicle));
  if (fromUrl) {
    clearConfigFromUrl();
    saveCurrent(store.get(), null);
  }
  car.applyConfig(store.get(), { animate: false });

  // ---------- Ficha lateral ----------
  let drawerState = null;
  let selected = null;
  const shopping = () => buildShoppingList(vehicle, store.get());
  const inList = (id) => shopping().items.some((i) => i.id === id);

  /** Resalta una pieza o varias (lista). */
  function select(obj) {
    const list = (o) => (Array.isArray(o) ? o : o ? [o] : []);
    list(selected).forEach((o) => setHighlight(o, 'select', false));
    selected = list(obj).length ? obj : null;
    list(obj).forEach((o) => setHighlight(o, 'select', true));
  }
  const guidesFor = (partId) => guidesData.guias.filter((g) => g.piezas.includes(partId));

  function renderDrawer() {
    if (!drawerState) return;
    const s = drawerState;
    if (s.type === 'know') ui.drawer.open(knowCard(s.key, { vehicle, cfg: store.get(), inList }));
    else if (s.type === 'part') ui.drawer.open(partCard(partDefs.get(s.id), { engineName: 'Motor 2.4L GDI', inList, guides: guidesFor(s.id) }));
    else if (s.type === 'engine') ui.drawer.open(engineCard(engineData, vehicle, guidesData.guias));
    else if (s.type === 'guide') ui.drawer.open(guideCard(guide.def, guide.step, { inList }));
  }
  const wide = () => window.matchMedia('(min-width: 761px)').matches;
  function openDrawer(state) {
    if (state.type !== 'guide') endGuide();
    drawerState = state;
    stage.setInsetRight(wide() ? 392 : 0);
    renderDrawer();
  }
  const openKnow = (key) => key && openDrawer({ type: 'know', key });
  ui.drawer.onClose(() => {
    drawerState = null;
    stage.setInsetRight(0);
    endGuide();
    select(null);
    enginePanel.setCurrent(null);
  });

  // ---------- Guías paso a paso (motor instalado, cofre abierto) ----------
  let guide = null;
  async function startGuide(id) {
    const def = guidesData.guias.find((g) => g.id === id);
    if (!def || ctl.busy) return;
    guide = { def, step: 0 };
    openDrawer({ type: 'guide' });
    if (ctl.state !== 'instalado') {
      const p = ctl.install();
      refreshToolbar();
      await p;
    }
    await car.setOpen('cofre', true);
    refreshToolbar();
    showGuideStep(0);
  }
  function showGuideStep(i) {
    if (!guide) return;
    const n = guide.def.pasos.length;
    guide.step = Math.max(0, Math.min(n, i));
    const paso = guide.step ? guide.def.pasos[guide.step - 1] : null;
    ctl.setPose(paso?.mover ?? {});
    ctl.setXray(Boolean(paso?.rayosX));
    car.setGhost(Boolean(paso?.vista));
    const foco = (paso?.foco ?? guide.def.piezas).map((pid) => engine.parts.get(pid)).filter(Boolean);
    select(foco);
    renderDrawer();
    if (foco.length) flyToObject(stage, foco, { padding: 3.2, minDist: 0.9, dir: paso?.vista ?? [0.45, 1, 0.35] });
  }
  function endGuide() {
    if (!guide) return;
    guide = null;
    ctl.setPose({});
    ctl.setXray(false);
    car.setGhost(false);
    select(null);
  }

  // ---------- Motor ----------
  async function engineToggle() {
    if (ctl.busy) return;
    endGuide();
    if (ctl.state === 'instalado') {
      const p = ctl.extract();
      refreshToolbar();
      await p;
      flyToObject(stage, engine.root, { padding: 2.4, minDist: 1.4 });
      toast('Motor fuera. Prueba la vista explosionada o toca una pieza.');
    } else {
      select(null);
      if (drawerState?.type === 'part') ui.drawer.close();
      const p = ctl.install();
      refreshToolbar();
      goHome(1.2);
      await p;
    }
  }
  async function explodeToggle() {
    if (ctl.busy || ctl.state === 'instalado') return;
    const p = ctl.explode(ctl.state !== 'explosionado');
    refreshToolbar();
    await p;
    if (!selected) flyToObject(stage, engine.root, { padding: 2.2, minDist: 1.4 });
  }
  async function focusPart(id) {
    const part = engine.parts.get(id);
    if (!part || ctl.busy) return;
    endGuide();
    openDrawer({ type: 'part', id });
    enginePanel.setCurrent(id);
    if (ctl.state === 'instalado') {
      const p = ctl.extract();
      refreshToolbar();
      await p;
    }
    if (ctl.isInternal(id) && ctl.state !== 'explosionado') {
      const p = ctl.explode(true);
      refreshToolbar();
      await p;
    }
    select(part);
    flyToObject(stage, part, { padding: 3.4, minDist: 0.55 });
  }

  // ---------- Barra de acciones ----------
  const toolbar = createToolbar(ui.toolbar, handleAction);
  function viewState() {
    return {
      doors: DOORS.some((d) => car.isOpen(d)),
      hood: car.isOpen('cofre'),
      trunk: car.isOpen('cajuela'),
      engine: ctl.state,
      xray: ctl.xray,
      busy: ctl.busy,
    };
  }
  function refreshToolbar() {
    const s = viewState();
    toolbar.render(s);
    enginePanel.setState(s);
  }
  async function handleAction(action) {
    switch (action) {
      case 'doors': {
        const open = !DOORS.some((d) => car.isOpen(d));
        const p = Promise.all(DOORS.map((d) => car.setOpen(d, open)));
        refreshToolbar();
        await p;
        break;
      }
      case 'hood':
      case 'trunk': {
        const id = action === 'hood' ? 'cofre' : 'cajuela';
        if (id === 'cofre' && car.isOpen('cofre') && ctl.state === 'instalado' && ctl.busy) return;
        const p = car.toggle(id);
        refreshToolbar();
        await p;
        break;
      }
      case 'engine':
        await engineToggle();
        break;
      case 'explode':
        await explodeToggle();
        break;
      case 'xray':
        ctl.setXray(!ctl.xray);
        break;
      case 'home':
        await goHome();
        break;
    }
    refreshToolbar();
  }
  ctl.onChange(refreshToolbar);

  // ---------- Paneles ----------
  const configPanel = createConfiguratorPanel(ui.tab.config, {
    vehicle,
    onChange: (patch) => store.set(patch),
    onKnow: openKnow,
  });
  const enginePanel = createEnginePanel(ui.tab.engine, {
    engineData,
    onPart: focusPart,
    onGuide: startGuide,
    guides: guidesData.guias,
    onAction: handleAction,
  });
  renderDataPanel(ui.tab.data, vehicle);

  // ---------- 3D: hover y clic ----------
  const tooltip = createTooltip(ui.viewport);
  const hints = {
    door: (id) => (car.isOpen(id) ? 'Clic para cerrar' : 'Clic para abrir'),
    hood: (id) => (car.isOpen(id) ? 'Clic para cerrar' : 'Clic para abrir'),
    trunk: (id) => (car.isOpen(id) ? 'Clic para cerrar' : 'Clic para abrir'),
    engine: () => 'Clic para ver el motor',
    'engine-part': () => 'Clic para ver su ficha',
    wheel: () => 'Clic: rines y llantas',
    fascia: () => 'Clic: lo que necesitas saber',
    fender: () => 'Clic: lo que necesitas saber',
    aleron: () => 'Clic: lo que necesitas saber',
    body: () => 'Clic: color y pintura',
  };
  createPicker(stage, {
    getTargets: () => [car.root],
    resolve(obj) {
      let first = null;
      for (let o = obj; o; o = o.parent) {
        if (o === engine.root && ctl.state === 'instalado') return { root: o, info: o.userData.pick };
        if (!first && o.userData.pick) first = o;
      }
      return first ? { root: first, info: first.userData.pick } : null;
    },
    onHover(res, ev) {
      if (!res || !ev) return tooltip.hide();
      tooltip.show(res.info.label, hints[res.info.kind]?.(res.info.id), ev);
    },
    async onClick(res) {
      tooltip.hide();
      const { id, kind } = res.info;
      const cfg = store.get();
      if (kind === 'door' || kind === 'hood' || kind === 'trunk') {
        const p = car.toggle(id);
        refreshToolbar();
        await p;
        refreshToolbar();
      } else if (kind === 'engine') openDrawer({ type: 'engine' });
      else if (kind === 'engine-part') focusPart(id);
      else if (kind === 'wheel') {
        ui.showTab('config');
        openKnow('llanta');
      } else if (kind === 'body') openKnow('pintura');
      else openKnow(itemKeyFor(kind, cfg));
    },
  });

  // ---------- Clics en fichas, modales y links de afiliado ----------
  on(ui.drawer.body, 'click', '[data-action], [data-goto-tab], [data-list-toggle], [data-guide], [data-guide-nav], [data-guide-step]', (ev, t) => {
    if (t.dataset.guide) return startGuide(t.dataset.guide);
    if (t.dataset.guideStep) return showGuideStep(Number(t.dataset.guideStep));
    if (t.dataset.guideNav) {
      const nav = t.dataset.guideNav;
      if (nav === 'done') {
        toast('¡Listo! Guía terminada.');
        return ui.drawer.close();
      }
      return showGuideStep(guide.step + (nav === 'next' ? 1 : -1));
    }
    if (t.dataset.gotoTab) return ui.showTab(t.dataset.gotoTab);
    if (t.dataset.listToggle) return toggleList(t.dataset.listToggle);
    if (t.dataset.action === 'show-buy') {
      const sec = ui.drawer.body.querySelector('[data-buy]');
      sec.hidden = false;
      sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    handleAction(t.dataset.action);
    if (t.dataset.action === 'engine') ui.drawer.close();
  });
  const track = (ev) => {
    const a = ev.target.closest('[data-track-pieza]');
    if (a) trackClick(a.dataset.trackPieza, a.dataset.trackTienda, { vehiculo: vehicle.id });
  };
  document.addEventListener('click', track);
  document.addEventListener('auxclick', track);

  function toggleList(id) {
    const cfg = store.get();
    if (cfg.l.includes(id)) {
      store.set({ l: cfg.l.filter((x) => x !== id) });
      toast('Quitado de tu lista');
    } else if (inList(id)) {
      toast('Ya está en tu lista por tu configuración');
    } else {
      store.set({ l: [...cfg.l, id] });
      toast('Agregado a tu lista de compras');
    }
  }

  // ---------- Barra superior ----------
  function openCart() {
    const cfg = store.get();
    cartDialog({
      list: shopping(),
      carName: cfg.n,
      onRemove: (id) => {
        store.set({ l: store.get().l.filter((x) => x !== id) });
        openCart();
      },
      onQuote: () => toast('Próximamente: cotiza la instalación con talleres de tu ciudad (empezando por Chihuahua).', 3800),
    });
  }
  on(ui.topActions, 'click', '[data-action]', (ev, t) => {
    const cfg = store.get();
    if (t.dataset.action === 'save') {
      saveDialog({
        defaultName: cfg.n,
        onSave: (nombre) => {
          store.set({ n: nombre });
          const saved = saveCar({ id: carId, nombre, config: store.get() });
          carId = saved.id;
          saveCurrent(store.get(), carId);
          toast(`Guardado: ${nombre}`);
        },
      });
    } else if (t.dataset.action === 'garage') {
      garageDialog({
        cars: listCars(),
        currentId: carId,
        onLoad: (id) => {
          const found = listCars().find((c) => c.id === id);
          if (!found) return;
          carId = found.id;
          store.replace({ ...found.config, n: found.nombre });
          toast(`Abriste: ${found.nombre}`);
        },
        onDelete: (id) => {
          deleteCar(id);
          if (id === carId) carId = null;
          return listCars();
        },
        onNew: () => {
          carId = null;
          store.replace(defaultConfig(vehicle));
          toast('Carro nuevo con configuración de fábrica');
        },
      });
    } else if (t.dataset.action === 'share') {
      shareDialog({ url: buildShareUrl(store.get()) });
    } else if (t.dataset.action === 'cart') {
      openCart();
    }
  });

  // ---------- Reacción a cambios de configuración ----------
  function refreshChrome(cfg) {
    ui.carName.textContent = cfg.n;
    ui.cartCount.textContent = String(shopping().items.length);
  }
  store.subscribe((cfg) => {
    car.applyConfig(cfg);
    saveCurrent(cfg, carId);
    configPanel.update(cfg);
    refreshChrome(cfg);
    if (drawerState) renderDrawer();
  });

  configPanel.update(store.get());
  refreshChrome(store.get());
  refreshToolbar();
  requestAnimationFrame(() => {
    ui.loading.classList.add('done');
    window.__ready = true;
  });
  if (fromUrl) toast(`Abriste un carro compartido: ${store.get().n}`);

  if (import.meta.env.DEV) window.__kardmo = { gsap, stage, car, ctl, store, engine, focusPart, handleAction, startGuide, showGuideStep };
}
