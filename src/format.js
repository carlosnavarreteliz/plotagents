// Formato de números y fechas. Por defecto en español de Chile:
// punto de miles, coma decimal y porcentaje pegado al número (56,1%).

const SEP = {
  es: { group: '.', dec: ',' },
  en: { group: ',', dec: '.' },
};

const COMPACT = {
  es: [[1e12, ' B'], [1e6, ' M'], [1e3, ' mil']],
  en: [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']],
};

export const MONTHS = {
  es: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

const loc = (l) => (l && String(l).toLowerCase().startsWith('en') ? 'en' : 'es');

/** Número con separadores. `decimals` fijo; `trim` quita ceros finales. */
export function formatNumber(v, decimals = 0, locale = 'es', trim = false) {
  if (v === null || v === undefined || Number.isNaN(v)) return '';
  if (!Number.isFinite(v)) return v > 0 ? '∞' : '-∞';
  const { group, dec } = SEP[loc(locale)];
  const neg = v < 0;
  let [int, frac = ''] = Math.abs(v).toFixed(Math.max(0, Math.min(20, Math.round(+decimals) || 0))).split('.');
  int = int.replace(/\B(?=(\d{3})+(?!\d))/g, group);
  if (trim) frac = frac.replace(/0+$/, '');
  const out = frac ? int + dec + frac : int;
  return (neg && /[1-9]/.test(out) ? '−' : '') + out;
}

/** Decimales "inteligentes" según la magnitud. */
export function smartDecimals(v) {
  const a = Math.abs(v);
  if (a === 0 || !Number.isFinite(a) || a >= 100) return 0;
  if (a >= 10) return 1;
  if (a >= 1) return 2;
  // Bajo 1: tres cifras significativas (0,123 · 0,00012), nunca "0".
  return Math.min(20, 2 - Math.floor(Math.log10(a)));
}

export function formatCompact(v, locale = 'es', decimals) {
  const l = loc(locale);
  const a = Math.abs(v);
  for (const [n, suf] of COMPACT[l]) {
    if (a >= n) {
      const s = v / n;
      const d = decimals ?? (Math.abs(s) < 10 ? 1 : 0);
      return formatNumber(s, d, l, decimals === undefined) + suf;
    }
  }
  return formatNumber(v, decimals ?? smartDecimals(v), l, decimals === undefined);
}

const isYearLike = (vals) =>
  vals.length > 0 && vals.every((v) => Number.isInteger(v) && v >= 1000 && v <= 2999);

/**
 * Crea un formateador de valores a partir de la opción `format` del spec.
 *   'number' | 'compact' | 'percent' | 'currency' | 'integer' | 'year'
 *   { type, prefix, suffix, decimals, currency }
 * `values` permite autodetectar (p. ej. porcentajes ya multiplicados por 100).
 */
export function makeFormat(fmt, locale = 'es', values = []) {
  const o = typeof fmt === 'string' ? { type: fmt } : { ...(fmt || {}) };
  const l = loc(locale);
  const nums = values.filter((v) => Number.isFinite(v));
  const max = nums.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
  let type = o.type;
  if (!type) type = isYearLike(nums) ? 'year' : max >= 1e5 ? 'compact' : 'number';
  const pre = o.prefix ?? (type === 'currency' ? currencyPrefix(o.currency, l) : '');
  const suf = o.suffix ?? '';
  const d = o.decimals;

  let core;
  switch (type) {
    case 'year':
      core = (v) => String(Math.round(v));
      break;
    case 'integer':
      core = (v) => formatNumber(v, 0, l);
      break;
    case 'percent': {
      const scale = o.scale ?? (max > 1.5 ? 1 : 100); // 0,25 → 25%; 25 → 25%
      core = (v) => formatNumber(v * scale, d ?? smartDecimals(v * scale), l, d === undefined) + '%';
      break;
    }
    case 'compact':
      core = (v) => formatCompact(v, l, d);
      break;
    case 'currency':
      core = (v) => (max >= 1e6 ? formatCompact(v, l, d) : formatNumber(v, d ?? (max >= 100 || nums.every(Number.isInteger) ? 0 : 2), l));
      break;
    default:
      core = (v) => formatNumber(v, d ?? smartDecimals(v), l, d === undefined);
  }
  const f = (v) => {
    if (v === null || v === undefined || Number.isNaN(v)) return '';
    const s = core(v);
    if (pre && s.startsWith('−')) return '−' + pre + s.slice(1) + suf;
    return pre + s + suf;
  };
  f.type = type;
  // `ticks` (opcional): las marcas del eje, o la mayor |marca|. Fija una sola
  // unidad compacta para todo el eje (sin "500 M" junto a "1.000,0 M").
  f.tick = (step, ticks) => tickFormat(step, o, type, l, pre, suf, max, d, ticks);
  return f;
}

function currencyPrefix(cur, l) {
  if (!cur) return '$';
  const c = String(cur).toUpperCase();
  return { USD: 'US$', CLP: '$', EUR: '€', UF: 'UF ', GBP: '£', PEN: 'S/ ', MXN: 'MX$', BRL: 'R$' }[c] || c + ' ';
}

/** Formateador de marcas de eje: decimales según el paso, nunca ruido. */
function tickFormat(step, o, type, l, pre, suf, max, dFixed, ticks) {
  // Decimales mínimos para escribir el paso exacto (2,5 → 1; 0,25 → 2).
  const decFor = (s) => {
    const a = Math.abs(s) || 1;
    let d = Math.max(0, -Math.floor(Math.log10(a) + 1e-9));
    while (d < 6 && Math.abs(Math.round(a * 10 ** d) - a * 10 ** d) > 1e-6 * 10 ** d) d++;
    return Math.min(6, d);
  };
  let core;
  if (type === 'year') core = (v) => String(Math.round(v));
  else if (type === 'percent') {
    const scale = o.scale ?? (max > 1.5 ? 1 : 100);
    core = (v) => formatNumber(v * scale, decFor(step * scale), l) + '%';
  } else if (type === 'compact' || max >= 1e4 && type !== 'integer') {
    // Una sola unidad por eje, la de la mayor marca, entre las que tiene el idioma
    // (en español no hay "mil millones": 1.000 M). Sin ceros finales.
    let top;
    if (Array.isArray(ticks)) top = ticks.reduce((m, t) => (Number.isFinite(t) ? Math.max(m, Math.abs(t)) : m), 0);
    else if (Number.isFinite(ticks)) top = Math.abs(ticks);
    else top = step > 0 ? Math.ceil(max / step - 1e-9) * step : max;
    const [unit, sufx] = COMPACT[l].find(([n]) => top >= n) || [1, ''];
    core = unit === 1
      ? (v) => formatNumber(v, decFor(step), l)
      : (v) => formatNumber(v / unit, decFor(step / unit), l, true) + sufx;
  } else core = (v) => formatNumber(v, dFixed ?? decFor(step), l);
  return (v) => {
    if (v === 0 && dFixed === undefined && type !== 'year') return pre + '0' + (type === 'percent' ? '%' : '') + suf;
    const s = core(v);
    if (pre && s.startsWith('−')) return '−' + pre + s.slice(1) + suf;
    return pre + s + suf;
  };
}

// ---------------------------------------------------------------------------
// Fechas

const ISO = /^(\d{4})-(\d{2})(?:-(\d{2}))?(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:[.,](\d+))?)?\s*(Z|[+-]\d{2}(?::?\d{2})?)?)?/i;

/**
 * Convierte Date | 'YYYY-MM' | 'YYYY-MM-DD' | ISO a milisegundos (UTC).
 * Sin zona horaria, la hora se toma tal cual (como UTC); con `Z` o `±hh:mm`
 * se respeta el desfase, así datos con zonas distintas se ordenan bien.
 */
export function parseDate(v) {
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'string') {
    const m = ISO.exec(v.trim());
    if (m) {
      const ms = m[7] ? Math.round(+('0.' + m[7]) * 1000) : 0;
      let t = Date.UTC(+m[1], +m[2] - 1, +(m[3] || 1), +(m[4] || 0), +(m[5] || 0), +(m[6] || 0), ms);
      const z = m[8];
      if (z && z.toUpperCase() !== 'Z') {
        const sign = z[0] === '-' ? -1 : 1;
        const hh = +z.slice(1, 3), mm = +(z.slice(1).replace(':', '').slice(2, 4) || 0);
        t -= sign * (hh * 60 + mm) * 6e4;
      }
      return t;
    }
  }
  return NaN;
}

export const isDateLike = (v) => v instanceof Date || (typeof v === 'string' && ISO.test(v.trim()));

/**
 * Fecha legible. `unit`: 'year' | 'quarter' | 'month' | 'day' | 'hour' | 'minute'.
 * En 'hour'/'minute', `withYear`: true → fecha completa + "HH:mm";
 * 'day' → fecha sin año + hora; false → solo "HH:mm".
 */
export function formatDate(ms, unit, locale = 'es', withYear = true) {
  const d = new Date(ms);
  const l = loc(locale);
  const y = d.getUTCFullYear();
  const m = MONTHS[l][d.getUTCMonth()];
  if (unit === 'hour' || unit === 'minute') {
    const hm = String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0');
    if (withYear === false) return hm;
    return formatDate(ms, 'day', l, withYear !== 'day') + ' ' + hm;
  }
  if (unit === 'year') return String(y);
  if (unit === 'quarter') return `T${Math.floor(d.getUTCMonth() / 3) + 1}${withYear ? ' ' + y : ''}`.replace('T', l === 'en' ? 'Q' : 'T');
  if (unit === 'month') return withYear ? `${m} ${y}` : m;
  const day = d.getUTCDate();
  return l === 'en' ? `${m} ${day}${withYear ? ', ' + y : ''}` : `${day} ${m}${withYear ? ' ' + y : ''}`;
}
