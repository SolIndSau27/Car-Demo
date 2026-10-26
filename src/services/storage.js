/**
 * Garage local (fase 1). La forma de los datos es la misma que usará la API en fase 2:
 * { id, nombre, vehiculo, config, actualizado }.
 */
const GARAGE_KEY = 'kardmo.garage';
const CURRENT_KEY = 'kardmo.actual';

function read(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function listCars() {
  return read(GARAGE_KEY, []);
}

export function saveCar({ id, nombre, config }) {
  const cars = listCars();
  const car = {
    id: id || `car_${Date.now().toString(36)}`,
    nombre: nombre || 'Mi carro',
    vehiculo: config.v,
    config,
    actualizado: new Date().toISOString(),
  };
  const i = cars.findIndex((c) => c.id === car.id);
  if (i >= 0) cars[i] = car;
  else cars.unshift(car);
  write(GARAGE_KEY, cars);
  return car;
}

export function deleteCar(id) {
  write(GARAGE_KEY, listCars().filter((c) => c.id !== id));
}

/** Configuración en curso (se guarda sola en cada cambio). */
export function saveCurrent(config, carId = null) {
  write(CURRENT_KEY, { config, carId });
}

export function loadCurrent() {
  return read(CURRENT_KEY, null);
}
