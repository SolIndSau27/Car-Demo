import * as THREE from 'three';
import { setHighlight } from './highlight.js';

/**
 * Hover + clic/tap sobre objetos 3D.
 * resolve(objeto) devuelve { root, info } o null; root es lo que se resalta.
 */
export function createPicker(stage, { getTargets, resolve, onHover, onClick }) {
  const { renderer, camera } = stage;
  const el = renderer.domElement;
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let hovered = null;
  let down = null;
  let pendingMove = null;

  function hit(clientX, clientY) {
    const r = el.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(getTargets(), true);
    for (const h of hits) {
      if (!isVisible(h.object)) continue;
      const res = resolve(h.object);
      if (res) return res;
    }
    return null;
  }

  function setHovered(res, ev) {
    const root = res?.root ?? null;
    if (hovered?.root !== root) {
      if (hovered) setHighlight(hovered.root, 'hover', false);
      if (root) setHighlight(root, 'hover', true);
    }
    hovered = res;
    el.style.cursor = res ? 'pointer' : 'grab';
    onHover?.(res, ev);
  }

  el.addEventListener('pointermove', (ev) => {
    if (ev.pointerType !== 'mouse') return;
    pendingMove = ev;
    requestAnimationFrame(() => {
      if (!pendingMove) return;
      const e = pendingMove;
      pendingMove = null;
      if (down && e.buttons) return; // arrastrando la cámara
      setHovered(hit(e.clientX, e.clientY), e);
    });
  });
  el.addEventListener('pointerleave', () => setHovered(null, null));
  el.addEventListener('pointerdown', (ev) => {
    down = { x: ev.clientX, y: ev.clientY, t: performance.now() };
  });
  el.addEventListener('pointerup', (ev) => {
    if (!down) return;
    const moved = Math.hypot(ev.clientX - down.x, ev.clientY - down.y);
    const dt = performance.now() - down.t;
    down = null;
    if (moved > 6 || dt > 600) return;
    const res = hit(ev.clientX, ev.clientY);
    if (ev.pointerType !== 'mouse') {
      // En táctil no hay hover: resaltamos brevemente lo tocado.
      setHovered(res, ev);
      setTimeout(() => hovered === res && setHovered(null, null), 1200);
    }
    if (res) onClick?.(res, ev);
  });

  return {
    refresh() {
      if (hovered) setHighlight(hovered.root, 'hover', true);
    },
    clear: () => setHovered(null, null),
  };
}

function isVisible(o) {
  for (let p = o; p; p = p.parent) if (!p.visible) return false;
  const m = o.material;
  return !(m && !Array.isArray(m) && m.visible === false);
}
