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

/** Dominio "bonito": extremos redondeados al paso de las marcas. */
export function niceDomain(min, max, count = 5) {
  if (min === max) {
    if (min === 0) return { min: 0, max: 1, step: 0.2 };
    const pad = Math.abs(min) * 0.1;
    min -= pad;
    max += pad;
  }
  let step = niceStep(max - min, count);
  let lo = Math.floor(min / step + 1e-9) * step;
  let hi = Math.ceil(max / step - 1e-9) * step;
  step = niceStep(hi - lo, count);
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
    const st = step || niceStep(d1 - d0, 5);
    const start = Math.ceil(Math.min(d0, d1) / st - 1e-9) * st;
    for (let v = start; v <= Math.max(d0, d1) + st * 1e-9; v += st) out.push(Math.abs(v) < st * 1e-9 ? 0 : +v.toPrecision(12));
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
  return s;
}

/** Dominio log ajustado a la secuencia 1-2-5 (sin décadas vacías). */
export function logDomain(min, max) {
  const steps = [1, 2, 5, 10];
  const down = (v) => { const e = Math.floor(Math.log10(v)); const m = v / 10 ** e; const k = [...steps].reverse().find((s) => s <= m + 1e-9) || 1; return k * 10 ** e; };
  const up = (v) => { const e = Math.floor(Math.log10(v)); const m = v / 10 ** e; const k = steps.find((s) => s >= m - 1e-9) || 10; return k * 10 ** e; };
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

const DAY = 864e5;
const UNITS = [
  ['day', 1, DAY],
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
];

/** Marcas de tiempo legibles: elige la unidad que da ≤ `count` marcas. */
export function timeTicks(t0, t1, count = 6, locale = 'es') {
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
  } else {
    cur = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    if (cur < t0) cur += DAY;
    while (cur <= t1) {
      out.push(cur);
      cur += every * DAY;
    }
  }
  const label = (t, i) => {
    const dt = new Date(t);
    if (unit === 'year') return formatDate(t, 'year', locale);
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
  if (ds.every((d) => d.getUTCMonth() === 0 && d.getUTCDate() === 1)) return 'year';
  if (ds.every((d) => d.getUTCDate() === 1)) return 'month';
  return 'day';
}
