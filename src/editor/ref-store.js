/**
 * Imágenes de referencia del editor de vistas (IndexedDB: pueden pesar varios MB)
 * y su calibración (localStorage). Todo se queda en este navegador: los planos con
 * derechos de autor nunca se publican con la app.
 */
const DB = 'kardmo-referencias';
const STORE = 'imagenes';
const CALIB_KEY = 'kardmo.editor.calibracion';

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
  });
}

export const saveImage = (view, blob) => tx('readwrite', (s) => s.put(blob, view)).catch(() => null);
export const loadImage = (view) => tx('readonly', (s) => s.get(view)).catch(() => null);
export const deleteImage = (view) => tx('readwrite', (s) => s.delete(view)).catch(() => null);

export function loadCalibrations() {
  try {
    return JSON.parse(localStorage.getItem(CALIB_KEY) || '{}');
  } catch {
    return {};
  }
}

export function saveCalibration(view, calib) {
  const all = loadCalibrations();
  if (calib) all[view] = calib;
  else delete all[view];
  try {
    localStorage.setItem(CALIB_KEY, JSON.stringify(all));
  } catch {
    /* sin almacenamiento */
  }
}

export const OVERRIDE_KEY = 'kardmo.editor.silueta';

/** Aplica la silueta guardada por el editor (solo en desarrollo o con ?editor en la URL). */
export function applyEditorOverride(vehicle) {
  try {
    const o = JSON.parse(localStorage.getItem(OVERRIDE_KEY) || 'null');
    if (!o?.silueta) return false;
    vehicle.silueta = o.silueta;
    if (o.eje_delantero_x) vehicle.dimensiones.eje_delantero_x = o.eje_delantero_x;
    return true;
  } catch {
    return false;
  }
}
