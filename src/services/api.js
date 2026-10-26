/**
 * Cliente de la API (fase 2: PHP + MySQL en hosting compartido).
 * En fase 1 VITE_API_URL está vacío y nada de esto se usa.
 */
const BASE = (import.meta.env?.VITE_API_URL || '').replace(/\/$/, '');

export function apiEnabled() {
  return Boolean(BASE);
}

export async function apiPost(path, body, { beacon = false } = {}) {
  if (!BASE) return null;
  const url = `${BASE}/${path}`;
  const data = JSON.stringify(body);
  if (beacon && navigator.sendBeacon) {
    return navigator.sendBeacon(url, new Blob([data], { type: 'application/json' }));
  }
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: data, credentials: 'include' });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export async function apiGet(path) {
  if (!BASE) return null;
  const res = await fetch(`${BASE}/${path}`, { credentials: 'include' });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}
