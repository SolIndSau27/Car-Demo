/** Cálculos de llanta. Funciones puras (sin Three.js) para poder probarlas en Node. */

const RE = /^(\d{3})\/(\d{2})R(\d{2})$/i;

export function parseTireSize(medida) {
  const m = RE.exec(String(medida).trim());
  if (!m) return null;
  const ancho = Number(m[1]);
  const perfil = Number(m[2]);
  const rin = Number(m[3]);
  const flancoMm = (ancho * perfil) / 100;
  const diametroMm = rin * 25.4 + 2 * flancoMm;
  return { medida: `${ancho}/${perfil}R${rin}`, ancho, perfil, rin, flancoMm, diametroMm };
}

/** Diferencia de diámetro total en % respecto a la medida de referencia. */
export function diameterDiffPct(medida, referencia) {
  const a = parseTireSize(medida);
  const b = parseTireSize(referencia);
  if (!a || !b) return 0;
  return ((a.diametroMm - b.diametroMm) / b.diametroMm) * 100;
}

/** Cuánto marca el velocímetro cuando realmente vas a 100 km/h. */
export function speedoAt100(medida, referencia) {
  const a = parseTireSize(medida);
  const b = parseTireSize(referencia);
  if (!a || !b) return 100;
  return (100 * b.diametroMm) / a.diametroMm;
}

export function compatibleTires(vehicle, rinDiametro) {
  return vehicle.llantas.compatibles[String(rinDiametro)] ?? [];
}

export function tireInfo(vehicle, medida) {
  const parsed = parseTireSize(medida);
  if (!parsed) return null;
  const ref = vehicle.llantas.referencia;
  const lista = compatibleTires(vehicle, parsed.rin);
  const datos = lista.find((t) => t.medida === parsed.medida) ?? {};
  const fabrica = vehicle.llantas.fabrica.find((f) => f.medida === parsed.medida);
  const diff = diameterDiffPct(parsed.medida, ref);
  return {
    ...parsed,
    ...datos,
    fabrica: fabrica?.version ?? null,
    referencia: ref,
    diffPct: diff,
    excedeTolerancia: Math.abs(diff) > vehicle.llantas.tolerancia_pct,
    velocimetroA100: speedoAt100(parsed.medida, ref),
  };
}
