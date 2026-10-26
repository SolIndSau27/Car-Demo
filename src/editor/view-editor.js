import * as THREE from 'three';
import { createBodySurface, smoothProfile } from '../vehicle/body-surface.js';
import { saveImage, loadImage, deleteImage, loadCalibrations, saveCalibration, OVERRIDE_KEY } from './ref-store.js';
import { esc } from '../ui/dom.js';

/**
 * Editor de vistas: cámaras ortogonales (lado, frente, atrás, arriba) con la imagen de
 * referencia de fondo, calibrada a escala real, y puntos arrastrables sobre los perfiles
 * de la silueta. El resultado se exporta al JSON del vehículo.
 */
const VIEWS = {
  lado: {
    label: 'Lado',
    pos: [0, 0.75, 20],
    up: [0, 1, 0],
    target: [0, 0.75, 0],
    halfH: 1.1,
    halfW: 2.95,
    plane: [0, 0, -1.6],
    calib: ['la punta DELANTERA del carro', 'la punta TRASERA del carro', 'el PISO (parte baja de una llanta)'],
  },
  frente: {
    label: 'Frente',
    pos: [20, 0.75, 0],
    up: [0, 1, 0],
    target: [0, 0.75, 0],
    halfH: 1.0,
    halfW: 1.25,
    plane: [-3, 0, 0],
    calib: ['el extremo IZQUIERDO de la carrocería (sin espejo)', 'el extremo DERECHO de la carrocería (sin espejo)', 'el PISO'],
  },
  atras: {
    label: 'Atrás',
    pos: [-20, 0.75, 0],
    up: [0, 1, 0],
    target: [0, 0.75, 0],
    halfH: 1.0,
    halfW: 1.25,
    plane: [3, 0, 0],
    calib: ['el extremo IZQUIERDO de la carrocería (sin espejo)', 'el extremo DERECHO de la carrocería (sin espejo)', 'el PISO'],
  },
  arriba: {
    label: 'Arriba',
    pos: [0, 20, 0],
    up: [0, 0, -1],
    target: [0, 0, 0],
    halfH: 1.2,
    halfW: 2.95,
    plane: [0, -0.05, 0],
    calib: ['la punta DELANTERA', 'la punta TRASERA', 'el costado de ARRIBA en la imagen (lo más ancho, sin espejo)', 'el costado de ABAJO en la imagen'],
  },
};

const PROFILES = {
  centro: { label: 'Techo / cofre / cajuela', color: 0xe5383b, view: 'lado' },
  cintura: { label: 'Cintura (borde de ventanas)', color: 0x2a6cff, view: 'lado' },
  estribo: { label: 'Estribo (parte baja)', color: 0x2a9d8f, view: 'lado' },
  media_anchura: { label: 'Ancho (vista superior)', color: 0xf77f00, view: 'arriba' },
};
const HANDLE_Z = 1.25; // los puntos de la vista lateral flotan frente al carro
const HANDLE_Y = 1.75; // los de la vista superior, arriba del techo

const SECTION_SLIDERS = [
  ['caida_techo', 'Caída del techo hacia los lados', 0, 0.35, 0.005],
  ['ancho_borde', 'Ancho del borde de cofre/cajuela', 0.7, 1, 0.005],
  ['entrada_cintura', 'Ancho en la cintura', 0.85, 1, 0.005],
  ['altura_hombro', 'Altura del punto más ancho', 0, 1, 0.01],
  ['entrada_estribo', 'Ancho en el estribo', 0.8, 1, 0.005],
];
const SECTION_DEFAULTS = { ancho_borde: 0.9, caida_techo: 0.16, altura_hombro: 0.7, entrada_cintura: 0.975, entrada_estribo: 0.93 };

export function createViewEditor({ stage, car, vehicle, viewport, onClose }) {
  const sil = structuredClone(vehicle.silueta);
  sil.seccion = { ...SECTION_DEFAULTS, ...(sil.seccion ?? {}) };
  const dims = vehicle.dimensiones;
  let frontAxle = dims.eje_delantero_x;
  let view = 'lado';

  const root = new THREE.Group();
  root.name = 'editor_vistas';
  stage.scene.add(root);

  // ---------- Cámara ortogonal ----------
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  let aspect = 1;
  const offResize = stage.onResize((w, h) => {
    aspect = w / h;
    updateFrustum();
  });
  function updateFrustum() {
    const hh = Math.max(VIEWS[view].halfH, VIEWS[view].halfW / aspect);
    cam.left = -hh * aspect;
    cam.right = hh * aspect;
    cam.top = hh;
    cam.bottom = -hh;
    cam.updateProjectionMatrix();
  }
  function setView(v) {
    view = v;
    const V = VIEWS[v];
    cam.position.fromArray(V.pos);
    cam.up.fromArray(V.up);
    cam.zoom = 1;
    cam.lookAt(new THREE.Vector3(...V.target));
    updateFrustum();
    refs.forEach((r, k) => (r.mesh.visible = k === v));
    handles.visible = v === 'lado' || v === 'arriba';
    rebuildOverlays();
    renderPanel();
  }

  // ---------- Vista previa de la carrocería ----------
  const previewMat = new THREE.MeshStandardMaterial({ color: 0x7d8fb3, roughness: 0.5, metalness: 0.1, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide });
  const preview = new THREE.Group();
  root.add(preview);
  let rebuildQueued = false;
  function queueRebuild() {
    if (rebuildQueued) return;
    rebuildQueued = true;
    requestAnimationFrame(() => {
      rebuildQueued = false;
      rebuildPreview();
      rebuildOverlays();
    });
  }
  function rebuildPreview() {
    preview.children.forEach((c) => c.geometry.dispose());
    preview.clear();
    const surf = createBodySurface(sil);
    for (const s of [-1, 1]) preview.add(new THREE.Mesh(surf.patch({ x0: sil.trasera_x, x1: sil.frente_x, t0: 0.4, t1: 7, side: s, nx: 140, nt: 42 }), previewMat));
    preview.add(new THREE.Mesh(surf.cap(sil.frente_x, 1, 0.4), previewMat), new THREE.Mesh(surf.cap(sil.trasera_x, -1, 0.4), previewMat));
    car.wheels.group.position.x = frontAxle - dims.eje_delantero_x;
  }

  // ---------- Perfiles, puntos y líneas ----------
  const handles = new THREE.Group();
  const overlays = new THREE.Group();
  root.add(handles, overlays);
  const handleGeo = new THREE.SphereGeometry(1, 16, 12);
  function lineMat(color) {
    return new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true });
  }
  function rebuildOverlays() {
    [handles, overlays].forEach((g) => {
      g.children.forEach((c) => c.geometry !== handleGeo && c.geometry.dispose());
      g.clear();
    });
    const r = 0.022 / cam.zoom;
    if (view === 'lado' || view === 'arriba') {
      for (const [key, P] of Object.entries(PROFILES)) {
        if (P.view !== view) continue;
        const fn = smoothProfile(sil[key]);
        const pts = [];
        for (let i = 0; i <= 200; i++) {
          const x = sil.trasera_x + ((sil.frente_x - sil.trasera_x) * i) / 200;
          pts.push(toWorld(key, x, fn(x)));
        }
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat(P.color));
        line.renderOrder = 10;
        overlays.add(line);
        if (key === 'media_anchura') {
          const mirror = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.map((p) => new THREE.Vector3(p.x, p.y, -p.z))), lineMat(P.color));
          mirror.renderOrder = 10;
          overlays.add(mirror);
        }
        sil[key].forEach((pt, i) => {
          const h = new THREE.Mesh(handleGeo, new THREE.MeshBasicMaterial({ color: P.color, depthTest: false }));
          h.scale.setScalar(r);
          h.position.copy(toWorld(key, pt[0], pt[1]));
          h.renderOrder = 11;
          h.userData = { key, i };
          handles.add(h);
        });
      }
      if (view === 'lado') {
        // Ejes de las ruedas (se mueven juntos, respetando la distancia entre ejes).
        const cy = car.wheels.radius;
        for (const ax of [frontAxle, frontAxle - dims.distancia_ejes_m]) {
          const circle = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(Array.from({ length: 49 }, (_, k) => new THREE.Vector3(ax + dims.radio_arco_m * Math.cos((k / 48) * Math.PI * 2), cy + dims.radio_arco_m * Math.sin((k / 48) * Math.PI * 2), HANDLE_Z))),
            lineMat(0x6c757d),
          );
          overlays.add(circle);
        }
        const h = new THREE.Mesh(handleGeo, new THREE.MeshBasicMaterial({ color: 0x343a40, depthTest: false }));
        h.scale.setScalar(r * 1.3);
        h.position.set(frontAxle, car.wheels.radius, HANDLE_Z);
        h.renderOrder = 11;
        h.userData = { key: 'eje' };
        handles.add(h);
      }
    } else {
      // Frente / atrás: contorno de la sección más ancha.
      const surf = createBodySurface(sil);
      const xs = [];
      for (let x = sil.trasera_x; x <= sil.frente_x; x += 0.05) xs.push(x);
      const xMax = xs.reduce((a, x) => (surf.wMax(x) > surf.wMax(a) ? x : a), 0);
      const xPlane = view === 'frente' ? 2.7 : -2.7;
      for (const s of [-1, 1]) {
        const pts = [];
        for (let k = 0; k <= 70; k++) {
          const p = surf.section(xMax, (k / 70) * 7);
          pts.push(new THREE.Vector3(xPlane, p.y, s * p.z));
        }
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat(0xe5383b));
        line.renderOrder = 10;
        overlays.add(line);
      }
    }
  }
  function toWorld(key, a, b) {
    return key === 'media_anchura' ? new THREE.Vector3(a, HANDLE_Y, b) : new THREE.Vector3(a, b, HANDLE_Z);
  }
  function fromWorld(key, p) {
    return key === 'media_anchura' ? [p.x, Math.max(0.2, p.z)] : [p.x, Math.max(0, p.y)];
  }

  // ---------- Imágenes de referencia ----------
  const refs = new Map(); // view -> { mesh, W, H, url }
  const calibs = loadCalibrations();
  function mappingFor(v, W, H) {
    const c = calibs[v];
    if (c) return c;
    // Sin calibrar: centrada y con 2.4 m de alto (o 5.5 m de ancho en las vistas largas).
    const s = v === 'lado' || v === 'arriba' ? 5.6 / W : 2.4 / H;
    const P = VIEWS[v].plane;
    const center = v === 'arriba' ? [0, P[1], 0] : v === 'lado' ? [0, 0.8, P[2]] : [P[0], 0.8, 0];
    const U = v === 'lado' || v === 'arriba' ? [s, 0, 0] : v === 'frente' ? [0, 0, -s] : [0, 0, s];
    const V = v === 'arriba' ? [0, 0, s] : [0, -s, 0];
    const O = center.map((c0, i) => c0 - U[i] * (W / 2) - V[i] * (H / 2));
    return { O, U, V };
  }
  function pixelToWorld({ O, U, V }, px, py) {
    return new THREE.Vector3(O[0] + U[0] * px + V[0] * py, O[1] + U[1] * px + V[1] * py, O[2] + U[2] * px + V[2] * py);
  }
  function buildRefMesh(v, tex, W, H) {
    const m = mappingFor(v, W, H);
    const c = [pixelToWorld(m, 0, 0), pixelToWorld(m, W, 0), pixelToWorld(m, 0, H), pixelToWorld(m, W, H)];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(c.flatMap((p) => [p.x, p.y, p.z]), 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 0, 0, 1, 0], 2));
    g.setIndex([0, 2, 1, 2, 3, 1]);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false });
    const mesh = new THREE.Mesh(g, mat);
    mesh.renderOrder = -1;
    mesh.visible = v === view;
    return mesh;
  }
  async function setImage(v, blob) {
    const old = refs.get(v);
    if (old) {
      root.remove(old.mesh);
      old.mesh.geometry.dispose();
      old.mesh.material.map.dispose();
      URL.revokeObjectURL(old.url);
      refs.delete(v);
    }
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const tex = await new THREE.TextureLoader().loadAsync(url);
    tex.colorSpace = THREE.SRGBColorSpace;
    const W = tex.image.width;
    const H = tex.image.height;
    const mesh = buildRefMesh(v, tex, W, H);
    root.add(mesh);
    refs.set(v, { mesh, W, H, url, tex });
  }
  function rebuildRef(v) {
    const r = refs.get(v);
    if (!r) return;
    const opacity = r.mesh.material.opacity;
    root.remove(r.mesh);
    r.mesh.geometry.dispose();
    r.mesh = buildRefMesh(v, r.tex, r.W, r.H);
    r.mesh.material.opacity = opacity;
    root.add(r.mesh);
  }

  // ---------- Calibración ----------
  let calib = null; // { clicks: [[px, py], ...] }
  const markers = new THREE.Group();
  root.add(markers);
  function computeCalibration(v, clicks) {
    const L = sil.frente_x;
    const T = sil.trasera_x;
    if (v === 'lado' || v === 'arriba') {
      const [F, R] = clicks;
      const sx = (T - L) / (R[0] - F[0]);
      const s = Math.abs(sx);
      if (v === 'lado') {
        const G = clicks[2];
        return { O: [L - F[0] * sx, G[1] * s, VIEWS.lado.plane[2]], U: [sx, 0, 0], V: [0, -s, 0] };
      }
      const pyC = (clicks[2][1] + clicks[3][1]) / 2;
      return { O: [L - F[0] * sx, VIEWS.arriba.plane[1], -pyC * s], U: [sx, 0, 0], V: [0, 0, s] };
    }
    const [A, B, G] = clicks;
    const s = dims.ancho_m / Math.abs(B[0] - A[0]);
    const pxC = (A[0] + B[0]) / 2;
    const xPlane = VIEWS[v].plane[0];
    return v === 'frente'
      ? { O: [xPlane, G[1] * s, pxC * s], U: [0, 0, -s], V: [0, -s, 0] }
      : { O: [xPlane, G[1] * s, -pxC * s], U: [0, 0, s], V: [0, -s, 0] };
  }

  // ---------- Interacción ----------
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let drag = null;
  let pan = null;
  function setRay(ev) {
    const r = stage.renderer.domElement.getBoundingClientRect();
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, cam);
  }
  function planeHit(key) {
    const plane = key === 'media_anchura' ? new THREE.Plane(new THREE.Vector3(0, 1, 0), -HANDLE_Y) : new THREE.Plane(new THREE.Vector3(0, 0, 1), -HANDLE_Z);
    return ray.ray.intersectPlane(plane, new THREE.Vector3());
  }
  const canvas = stage.renderer.domElement;
  const stop = (ev) => {
    if (ev.target === canvas) ev.stopPropagation();
  };
  function onDown(ev) {
    if (ev.target !== canvas) return;
    ev.stopPropagation();
    setRay(ev);
    if (calib) {
      const r = refs.get(view);
      const hit = r && ray.intersectObject(r.mesh)[0];
      if (!hit) return;
      calib.clicks.push([hit.uv.x * r.W, (1 - hit.uv.y) * r.H]);
      const mk = new THREE.Mesh(handleGeo, new THREE.MeshBasicMaterial({ color: 0xff00aa, depthTest: false }));
      mk.scale.setScalar(0.03 / cam.zoom);
      mk.position.copy(hit.point);
      mk.renderOrder = 12;
      markers.add(mk);
      if (calib.clicks.length === VIEWS[view].calib.length) {
        calibs[view] = computeCalibration(view, calib.clicks);
        saveCalibration(view, calibs[view]);
        calib = null;
        markers.clear();
        rebuildRef(view);
      }
      renderPanel();
      return;
    }
    const h = ray.intersectObjects(handles.children)[0];
    if (h) {
      const { key, i } = h.object.userData;
      if (ev.altKey && key !== 'eje' && sil[key].length > 3) {
        sil[key].splice(i, 1);
        queueRebuild();
        return;
      }
      drag = { key, i };
      canvas.setPointerCapture(ev.pointerId);
      return;
    }
    pan = { x: ev.clientX, y: ev.clientY, pos: cam.position.clone() };
    canvas.setPointerCapture(ev.pointerId);
  }
  function onMove(ev) {
    if (ev.target !== canvas) return;
    ev.stopPropagation();
    if (drag) {
      setRay(ev);
      const p = planeHit(drag.key === 'eje' ? 'centro' : drag.key);
      if (!p) return;
      if (drag.key === 'eje') frontAxle = Math.round(p.x * 1000) / 1000;
      else sil[drag.key][drag.i] = fromWorld(drag.key, p).map((n) => Math.round(n * 1000) / 1000);
      queueRebuild();
    } else if (pan) {
      const r = canvas.getBoundingClientRect();
      const k = (cam.top - cam.bottom) / cam.zoom / r.height;
      const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
      const up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
      cam.position.copy(pan.pos).addScaledVector(right, -(ev.clientX - pan.x) * k).addScaledVector(up, (ev.clientY - pan.y) * k);
    }
  }
  function onUp(ev) {
    if (ev.target !== canvas) return;
    ev.stopPropagation();
    if (drag) renderPanel();
    drag = null;
    pan = null;
  }
  function onWheel(ev) {
    if (ev.target !== canvas) return;
    ev.preventDefault();
    ev.stopPropagation();
    cam.zoom = THREE.MathUtils.clamp(cam.zoom * (ev.deltaY < 0 ? 1.12 : 1 / 1.12), 0.3, 25);
    cam.updateProjectionMatrix();
    rebuildOverlays();
  }
  function onDbl(ev) {
    if (ev.target !== canvas || !(view === 'lado' || view === 'arriba')) return;
    ev.stopPropagation();
    setRay(ev);
    // Agrega un punto al perfil más cercano de esta vista.
    let best = null;
    for (const [key, P] of Object.entries(PROFILES)) {
      if (P.view !== view) continue;
      const p = planeHit(key);
      if (!p) continue;
      const [x, y] = fromWorld(key, p);
      const d = Math.abs(smoothProfile(sil[key])(x) - y);
      if (!best || d < best.d) best = { key, x, y, d };
    }
    if (best && best.d < 0.12) {
      sil[best.key].push([Math.round(best.x * 1000) / 1000, Math.round(best.y * 1000) / 1000]);
      sil[best.key].sort((a, b) => b[0] - a[0]);
      queueRebuild();
    }
  }
  viewport.addEventListener('pointerdown', onDown, true);
  viewport.addEventListener('pointermove', onMove, true);
  viewport.addEventListener('pointerup', onUp, true);
  viewport.addEventListener('wheel', onWheel, { capture: true, passive: false });
  viewport.addEventListener('dblclick', onDbl, true);
  viewport.addEventListener('click', stop, true);

  // ---------- Panel ----------
  const panel = document.createElement('div');
  panel.className = 'editor-panel';
  document.body.appendChild(panel);
  const file = document.createElement('input');
  file.type = 'file';
  file.accept = 'image/*';
  file.hidden = true;
  panel.after(file);

  function renderPanel() {
    const r = refs.get(view);
    const V = VIEWS[view];
    const calibrated = Boolean(calibs[view]);
    panel.innerHTML = `
      <header><strong>Editor de vistas</strong><button class="icon-btn" data-ed="close" aria-label="Cerrar editor">✕</button></header>
      <div class="chips">${Object.entries(VIEWS)
        .map(([k, v]) => `<button class="chip" data-view="${k}" aria-pressed="${k === view}">${v.label}${refs.has(k) ? ' 🖼' : ''}</button>`)
        .join('')}</div>
      <section>
        <h4>Imagen de referencia (${esc(V.label)})</h4>
        <div class="row-btns">
          <button class="btn small" data-ed="load">${r ? 'Cambiar imagen' : 'Cargar imagen'}</button>
          ${r ? '<button class="btn small" data-ed="remove">Quitar</button>' : ''}
          ${r ? `<button class="btn small ${calib ? 'primary' : ''}" data-ed="calib">${calib ? 'Cancelar' : calibrated ? 'Recalibrar' : 'Calibrar'}</button>` : ''}
        </div>
        ${r ? `<label class="slider">Opacidad <input type="range" min="0" max="1" step="0.05" value="${r.mesh.material.opacity}" data-ed="opacity"></label>` : ''}
        ${
          calib
            ? `<p class="callout">Haz clic en ${esc(V.calib[calib.clicks.length])} (${calib.clicks.length + 1}/${V.calib.length}).</p>`
            : r
              ? `<p class="muted small">${calibrated ? '✓ Calibrada a escala real.' : 'Sin calibrar: haz clic en Calibrar para ponerla a escala real.'}</p>`
              : '<p class="muted small">Carga un plano o una foto recta (sin perspectiva) de esta vista.</p>'
        }
      </section>
      ${
        view === 'lado' || view === 'arriba'
          ? `<section><h4>Perfiles</h4><ul class="legend">${Object.entries(PROFILES)
              .filter(([, P]) => P.view === view)
              .map(([, P]) => `<li><span style="background:#${P.color.toString(16).padStart(6, '0')}"></span>${esc(P.label)}</li>`)
              .join('')}${view === 'lado' ? '<li><span style="background:#343a40"></span>Eje delantero (arrastra en horizontal)</li>' : ''}</ul>
              <p class="muted small">Arrastra los puntos. Doble clic sobre una línea: agrega punto. Alt + clic: borra punto. Rueda: zoom. Arrastra el fondo: mover.</p></section>`
          : `<section><h4>Forma de la sección</h4>${SECTION_SLIDERS.map(
              ([k, label, min, max, step]) => `<label class="slider">${esc(label)} <input type="range" min="${min}" max="${max}" step="${step}" value="${sil.seccion[k]}" data-sec="${k}"></label>`,
            ).join('')}
            <label class="slider">Corona del techo (curvatura central) <input type="range" min="0.01" max="0.1" step="0.002" value="${sil.corona ?? 0.045}" data-sec="corona"></label></section>`
      }
      <footer>
        <button class="btn small" data-ed="export">Exportar JSON</button>
        <button class="btn small" data-ed="reset">Restablecer</button>
        <button class="btn small primary" data-ed="apply">Aplicar al carro</button>
      </footer>`;
  }
  panel.addEventListener('click', async (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.dataset.view) return setView(b.dataset.view);
    const a = b.dataset.ed;
    if (a === 'close') return close();
    if (a === 'load') return file.click();
    if (a === 'remove') {
      await deleteImage(view);
      saveCalibration(view, null);
      delete calibs[view];
      await setImage(view, null);
      return renderPanel();
    }
    if (a === 'calib') {
      calib = calib ? null : { clicks: [] };
      markers.clear();
      return renderPanel();
    }
    if (a === 'export') return exportJson();
    if (a === 'reset') {
      localStorage.removeItem(OVERRIDE_KEY);
      location.reload();
    }
    if (a === 'apply') {
      localStorage.setItem(OVERRIDE_KEY, JSON.stringify({ silueta: sil, eje_delantero_x: frontAxle }));
      location.reload();
    }
  });
  panel.addEventListener('input', (ev) => {
    const t = ev.target;
    if (t.dataset.ed === 'opacity') {
      const r = refs.get(view);
      if (r) r.mesh.material.opacity = Number(t.value);
    }
    if (t.dataset.sec) {
      if (t.dataset.sec === 'corona') sil.corona = Number(t.value);
      else sil.seccion[t.dataset.sec] = Number(t.value);
      queueRebuild();
    }
  });
  file.addEventListener('change', async () => {
    const f = file.files[0];
    file.value = '';
    if (!f) return;
    await saveImage(view, f);
    saveCalibration(view, null);
    delete calibs[view];
    await setImage(view, f);
    calib = { clicks: [] };
    renderPanel();
  });

  function exportJson() {
    const out = { silueta: sil, dimensiones: { eje_delantero_x: frontAxle } };
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${vehicle.id}-silueta.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ---------- Abrir / cerrar ----------
  const prev = { floor: stage.floor.visible, grid: stage.grid.visible, fog: stage.scene.fog };
  car.body.visible = false;
  stage.floor.visible = false;
  stage.grid.visible = false;
  stage.scene.fog = null;
  stage.setActiveCamera(cam);
  Promise.all(Object.keys(VIEWS).map(async (v) => setImage(v, await loadImage(v)))).then(() => setView(view));
  rebuildPreview();
  setView('lado');

  function close() {
    viewport.removeEventListener('pointerdown', onDown, true);
    viewport.removeEventListener('pointermove', onMove, true);
    viewport.removeEventListener('pointerup', onUp, true);
    viewport.removeEventListener('wheel', onWheel, { capture: true });
    viewport.removeEventListener('dblclick', onDbl, true);
    viewport.removeEventListener('click', stop, true);
    offResize();
    refs.forEach((r) => URL.revokeObjectURL(r.url));
    stage.scene.remove(root);
    panel.remove();
    file.remove();
    car.body.visible = true;
    car.wheels.group.position.x = 0;
    stage.floor.visible = prev.floor;
    stage.grid.visible = prev.grid;
    stage.scene.fog = prev.fog;
    stage.setActiveCamera(null);
    onClose?.();
  }
  return { close, setView, get silueta() { return sil; } };
}
