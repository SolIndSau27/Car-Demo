/**
 * Codifica la configuración en la URL (#c=...) como base64url de un JSON corto.
 * Sin dependencias del navegador más allá de btoa/atob/TextEncoder, para poder probarlo en Node.
 */
const PARAM = 'c';

export function encodeConfig(config) {
  const bytes = new TextEncoder().encode(JSON.stringify(config));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeConfig(code) {
  try {
    const b64 = code.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
    const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
    const obj = JSON.parse(new TextDecoder().decode(bytes));
    return obj && typeof obj === 'object' ? obj : null;
  } catch {
    return null;
  }
}

export function buildShareUrl(config, base = window.location.href) {
  const url = new URL(base);
  url.hash = `${PARAM}=${encodeConfig(config)}`;
  return url.toString();
}

export function readConfigFromUrl(href = window.location.href) {
  const hash = new URL(href).hash.slice(1);
  const code = new URLSearchParams(hash).get(PARAM);
  return code ? decodeConfig(code) : null;
}

export function clearConfigFromUrl() {
  history.replaceState(null, '', window.location.pathname + window.location.search);
}
