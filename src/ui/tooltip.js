import { esc } from './dom.js';

export function createTooltip(container) {
  const tip = document.createElement('div');
  tip.className = 'tooltip';
  container.appendChild(tip);
  return {
    show(text, hint, ev) {
      tip.innerHTML = `<strong>${esc(text)}</strong>${hint ? `<span>${esc(hint)}</span>` : ''}`;
      const r = container.getBoundingClientRect();
      const x = Math.min(ev.clientX - r.left + 14, r.width - 220);
      const y = Math.max(ev.clientY - r.top - 44, 8);
      tip.style.transform = `translate(${x}px, ${y}px)`;
      tip.classList.add('show');
    },
    hide() {
      tip.classList.remove('show');
    },
  };
}
