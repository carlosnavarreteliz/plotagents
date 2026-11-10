// Escalas: lineal, logarítmica, de bandas y de tiempo (sin dependencias).
import { formatDate } from './format.js';

export function niceStep(span, count = 5) {
  if (!(span > 0)) return 1;
  const raw = span / Math.max(1, count);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const n = raw / mag;
  const f = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return f * mag;
}

/** Paso entero (1, 2, 5, 10, 20, 25…): nunca < 1 ni 2,5. */
export const intStep = (step) => (!(step >= 1) ? 1 : Math.abs(step - 2.5) < 1e-9 ? 2 : step);

/**
 * Dominio "bonito": extremos redondeados al paso de las marcas.
 * `integer: true` (valores enteros, como conteos) garantiza paso ≥ 1 y sin 2,5
 * (como `minInterval: 1` de ECharts): nunca marcas en 0,5.
 */
export function niceDomain(min, max, count = 5, { integer = false } = {}) {
  const st = (span) => (integer ? intStep(niceStep(span, count)) : niceStep(span, count));
  // Sin valores finitos (todo nulo o texto): dominio [0, 1] en vez de un bucle infinito.
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    if (Number.isFinite(min)) max = min;
    else if (Number.isFinite(max)) min = max;
    else return integer ? { min: 0, max: 1, step: 1 } : { min: 0, max: 1, step: 0.2 };
  }
  if (min > max) [min, max] = [max, min];
  if (min === max) {
    if (min === 0) return integer ? { min: 0, max: 1, step: 1 } : { min: 0, max: 1, step: 0.2 };
    const pad = integer ? 0.5 : Math.abs(min) * 0.1;
    min -= pad;
    max += pad;
  }
  let step = st(max - min);
  let lo = Math.floor(min / step + 1e-9) * step;
  let hi = Math.ceil(max / step - 1e-9) * step;
  step = st(hi - lo);
  lo = Math.floor(min / step + 1e-9) * step;
  hi = Math.ceil(max / step - 1e-9) * step;
  return { min: lo, max: hi, step };
}

export function linear(d0, d1, r0, r1) {
  const k = d1 === d0 ? 0 : (r1 - r0) / (d1 - d0);
  const s = (v) => r0 + (v - d0) * k;
  s.invert = (p) => (k === 0 ? d0 : d0 + (p - r0) / k);
  s.domain = [d0, d1];
  s.range = [r0, r1];
  s.ticks = (step) => {
    const out = [];
    if (!Number.isFinite(d0) || !Number.isFinite(d1)) return out;
    let st = step > 0 && Number.isFinite(step) ? step : niceStep(Math.abs(d1 - d0), 5);
    const lo = Math.min(d0, d1), hi = Math.max(d0, d1);
    // Nunca más de ~1000 marcas (paso diminuto frente al dominio, o paso que no avanza).
    if ((hi - lo) / st > 1000) st = niceStep(hi - lo, 5);
    const start = Math.ceil(lo / st - 1e-9) * st;
    if (start + st === start) return [lo];
    for (let i = 0, v = start; v <= hi + st * 1e-9 && i <= 1000; i++, v = start + i * st) out.push(Math.abs(v) < st * 1e-9 ? 0 : +v.toPrecision(12));
    return out;
  };
  return s;
}

export function log(d0, d1, r0, r1) {
  const lo = Math.log10(Math.max(d0, 1e-12));
  const hi = Math.log10(Math.max(d1, 1e-12));
  const inner = linear(lo, hi, r0, r1);
  const s = (v) => inner(Math.log10(Math.max(v, 1e-12)));
  s.invert = (p) => 10 ** inner.invert(p);
  s.domain = [d0, d1];
  s.range = [r0, r1];
  // Marcas 1-2-5 cuando hay pocas décadas; solo potencias de 10 si hay muchas.
  s.ticks = (max = 7) => {
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [];
    const cap = Number.isInteger(max) && max >= 2 ? max : 7;
    const gen = (mult) => {
      const out = [];
      for (let e = Math.floor(lo) - 1; e <= Math.ceil(hi); e++)
        for (const k of mult) {
          const v = +(k * 10 ** e).toPrecision(12);
          if (v >= d0 * 0.999 && v <= d1 * 1.001) out.push(v);
        }
      return out;
    };
    for (const mult of [[1, 2, 5], [1, 3], [1]]) {
      const t = gen(mult);
      if (t.length <= cap) { const dense = gen([1, 2, 3, 5]); return t.length < 4 && dense.length <= cap ? dense : t; }
    }
    const t = gen([1]);
    const every = Math.ceil(t.length / cap);
    return t.filter((_, i) => i % every === 0);
  };
  // Rango estrecho (120–180 → solo "100, 200"): marcas lineales dentro del dominio.
  const logTicks = s.ticks;
  s.ticks = (max = 7) => {
    const t = logTicks(max);
    if (t.length >= 3 || !(d1 > d0)) return t;
    const st = niceStep(d1 - d0, 5);
    const lin = linear(d0, d1, 0, 1).ticks(st).filter((v) => v > 0);
    return lin.length > t.length ? lin : t;
  };
  return s;
}

/** Dominio log ajustado a la secuencia 1-2-5 (sin décadas vacías). */
export function logDomain(min, max) {
  const steps = [1, 2, 5, 10];
  const down = (v) => { const e = Math.floor(Math.log10(v)); const m = v / 10 ** e; const k = [...steps].reverse().find((s) => s <= m + 1e-9) || 1; return k * 10 ** e; };
  const up = (v) => { const e = Math.floor(Math.log10(v)); const m = v / 10 ** e; const k = steps.find((s) => s >= m - 1e-9) || 10; return k * 10 ** e; };
  if (!Number.isFinite(min) || !(min > 0)) min = Number.isFinite(max) && max > 0 ? max / 10 : 1;
  if (!Number.isFinite(max) || !(max > 0)) max = min * 10;
  const lo = down(Math.max(min, 1e-12)), hi = up(Math.max(max, 1e-12));
  return { min: lo, max: hi === lo ? lo * 10 : hi };
}

/** Escala de bandas para categorías. */
export function band(domain, r0, r1, { inner = 0.3, outer = 0.15 } = {}) {
  const n = domain.length;
  const step = (r1 - r0) / Math.max(1, n - inner + outer * 2);
  const bw = step * (1 - inner);
  const start = r0 + step * outer;
  const idx = new Map(domain.map((d, i) => [d, i]));
  const s = (v) => start + (idx.get(v) ?? 0) * step;
  s.bandwidth = bw;
  s.step = step;
  s.domain = domain;
  s.center = (v) => s(v) + bw / 2;
  return s;
}

// ---------------------------------------------------------------------------
// Tiempo

const MIN = 6e4, HOUR = 36e5, DAY = 864e5;
const UNITS = [
  ['minute', 1, MIN],
  ['minute', 5, 5 * MIN],
  ['minute', 15, 15 * MIN],
  ['minute', 30, 30 * MIN],
  ['hour', 1, HOUR],
  ['hour', 3, 3 * HOUR],
  ['hour', 6, 6 * HOUR],
  ['hour', 12, 12 * HOUR],
  ['day', 1, DAY],
  ['day', 2, 2 * DAY],
  ['day', 3, 3 * DAY],
  ['day', 7, 7 * DAY],
  ['month', 1, 30.44 * DAY],
  ['month', 3, 91.3 * DAY],
  ['month', 6, 182.6 * DAY],
  ['year', 1, 365.25 * DAY],
  ['year', 2, 730.5 * DAY],
  ['year', 5, 1826 * DAY],
  ['year', 10, 3652 * DAY],
  ['year', 25, 9131 * DAY],
  ['year', 50, 18262 * DAY],
  ['year', 100, 36525 * DAY],
  ['year', 250, 91312 * DAY],
  ['year', 500, 182625 * DAY],
];

/** Marcas de tiempo legibles: elige la unidad que da ≤ `count` marcas. */
export function timeTicks(t0, t1, count = 6, locale = 'es') {
  if (!Number.isFinite(t0) || !Number.isFinite(t1)) return { ticks: [], unit: 'day', every: 1 };
  const span = Math.max(1, t1 - t0);
  let [unit, every] = UNITS.find(([, , ms]) => span / ms <= count) || UNITS[UNITS.length - 1];
  const out = [];
  const d = new Date(t0);
  let cur;
  if (unit === 'year') {
    const y = Math.ceil(d.getUTCFullYear() / every) * every;
    cur = Date.UTC(y, 0, 1);
    if (cur < t0) cur = Date.UTC(y + every, 0, 1);
    while (cur <= t1) {
      out.push(cur);
      cur = Date.UTC(new Date(cur).getUTCFullYear() + every, 0, 1);
    }
  } else if (unit === 'month') {
    let y = d.getUTCFullYear(), m = Math.ceil(d.getUTCMonth() / every) * every;
    cur = Date.UTC(y, m, 1);
    if (cur < t0) cur = Date.UTC(y, m + every, 1);
    while (cur <= t1) {
      out.push(cur);
      const c = new Date(cur);
      cur = Date.UTC(c.getUTCFullYear(), c.getUTCMonth() + every, 1);
    }
  } else if (unit === 'hour' || unit === 'minute') {
    // Múltiplos exactos del paso en UTC (las horas 1/3/6/12 dividen el día).
    const ms = every * (unit === 'hour' ? HOUR : MIN);
    cur = Math.ceil(t0 / ms - 1e-9) * ms;
    while (cur <= t1) {
      out.push(cur);
      cur += ms;
    }
  } else {
    cur = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    if (cur < t0) cur += DAY;
    while (cur <= t1) {
      out.push(cur);
      cur += every * DAY;
    }
  }
  const dayOf = (t) => Math.floor(t / DAY);
  const label = (t, i) => {
    const dt = new Date(t);
    if (unit === 'year') return formatDate(t, 'year', locale);
    // Hora "HH:mm"; la fecha solo cuando cambia el día (a medianoche, solo la fecha).
    if (unit === 'hour' || unit === 'minute') {
      const newDay = i === 0 || dayOf(out[i - 1]) !== dayOf(t);
      if (!newDay) return formatDate(t, unit, locale, false);
      const prevY = i > 0 ? new Date(out[i - 1]).getUTCFullYear() : null;
      const date = formatDate(t, 'day', locale, i > 0 && prevY !== dt.getUTCFullYear());
      return t % DAY === 0 && i > 0 ? date : `${date} ${formatDate(t, unit, locale, false)}`;
    }
    if (unit === 'month') {
      const first = i === 0 || dt.getUTCMonth() < every;
      if (every === 3) return formatDate(t, 'quarter', locale, first);
      return formatDate(t, 'month', locale, first);
    }
    const prev = i > 0 ? new Date(out[i - 1]) : null;
    return formatDate(t, 'day', locale, !prev || prev.getUTCFullYear() !== dt.getUTCFullYear());
  };
  return { ticks: out.map((t, i) => ({ value: t, label: label(t, i) })), unit, every };
}

/** Unidad natural de una serie de fechas (para tooltips). */
export function dateUnit(times) {
  const ds = times.map((t) => new Date(t));
  if (ds.some((d) => d.getUTCSeconds() || d.getUTCMinutes())) return 'minute';
  if (ds.some((d) => d.getUTCHours())) return 'hour';
  if (ds.every((d) => d.getUTCMonth() === 0 && d.getUTCDate() === 1)) return 'year';
  if (ds.every((d) => d.getUTCDate() === 1)) return 'month';
  return 'day';
}

/** Mitad de la unidad natural (para centrar una sola fecha en el eje). */
export function halfUnit(unit) {
  return { minute: MIN / 2, hour: HOUR / 2, day: DAY / 2, month: 15 * DAY, year: 182.6 * DAY }[unit] ?? DAY / 2;
}
