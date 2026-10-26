import { apiEnabled, apiPost } from './api.js';

const KEY = 'kardmo.clicks';
const MAX = 500;

/**
 * Registra un clic de compra. Fase 1: consola + localStorage.
 * Fase 2: si VITE_API_URL está definido, también se manda a la API.
 */
export function trackClick(pieza, tienda, extra = {}) {
  const evento = { pieza, tienda, ts: new Date().toISOString(), ...extra };
  console.info('[KarDmo] clic afiliado', evento);
  try {
    const lista = JSON.parse(localStorage.getItem(KEY) || '[]');
    lista.push(evento);
    localStorage.setItem(KEY, JSON.stringify(lista.slice(-MAX)));
  } catch {
    /* almacenamiento no disponible: solo consola */
  }
  if (apiEnabled()) apiPost('clicks.php', evento, { beacon: true });
  return evento;
}

export function getClicks() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}
