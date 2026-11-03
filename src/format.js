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
  let [int, frac = ''] = Math.abs(v).toFixed(Math.max(0, decimals)).split('.');
  int = int.replace(/\B(?=(\d{3})+(?!\d))/g, group);
  if (trim) frac = frac.replace(/0+$/, '');
  const out = frac ? int + dec + frac : int;
  return (neg && /[1-9]/.test(out) ? '−' : '') + out;
}

/** Decimales "inteligentes" según la magnitud. */
export function smartDecimals(v) {
  const a = Math.abs(v);
  if (a === 0 || a >= 100) return 0;
  if (a >= 10) return 1;
  if (a >= 1) return 2;
  return Math.min(4, 1 - Math.floor(Math.log10(a)) + 1);
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
  f.tick = (step) => tickFormat(step, o, type, l, pre, suf, max, d);
  return f;
}

function currencyPrefix(cur, l) {
  if (!cur) return '$';
  const c = String(cur).toUpperCase();
  return { USD: 'US$', CLP: '$', EUR: '€', UF: 'UF ', GBP: '£', PEN: 'S/ ', MXN: 'MX$', BRL: 'R$' }[c] || c + ' ';
}

/** Formateador de marcas de eje: decimales según el paso, nunca ruido. */
function tickFormat(step, o, type, l, pre, suf, max, dFixed) {
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
    core = (v) => {
      const a = Math.abs(v);
      const unit = a >= 1e12 ? 1e12 : a >= 1e9 ? 1e9 : a >= 1e6 ? 1e6 : a >= 1e3 ? 1e3 : 1;
      if (unit === 1) return formatNumber(v, decFor(step), l);
      return formatCompact(v, l, decFor(step / unit));
    };
  } else core = (v) => formatNumber(v, dFixed ?? decFor(step), l);
  return (v) => {
    const s = core(v);
    if (pre && s.startsWith('−')) return '−' + pre + s.slice(1) + suf;
    return pre + s + suf;
  };
}

// ---------------------------------------------------------------------------
// Fechas

const ISO = /^(\d{4})-(\d{2})(?:-(\d{2}))?(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/;

/** Convierte Date | 'YYYY-MM' | 'YYYY-MM-DD' | ISO a milisegundos (UTC). */
export function parseDate(v) {
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'string') {
    const m = ISO.exec(v.trim());
    if (m) return Date.UTC(+m[1], +m[2] - 1, +(m[3] || 1), +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
  }
  return NaN;
}

export const isDateLike = (v) => v instanceof Date || (typeof v === 'string' && ISO.test(v.trim()));

export function formatDate(ms, unit, locale = 'es', withYear = true) {
  const d = new Date(ms);
  const l = loc(locale);
  const y = d.getUTCFullYear();
  const m = MONTHS[l][d.getUTCMonth()];
  if (unit === 'year') return String(y);
  if (unit === 'quarter') return `T${Math.floor(d.getUTCMonth() / 3) + 1}${withYear ? ' ' + y : ''}`.replace('T', l === 'en' ? 'Q' : 'T');
  if (unit === 'month') return withYear ? `${m} ${y}` : m;
  const day = d.getUTCDate();
  return l === 'en' ? `${m} ${day}${withYear ? ', ' + y : ''}` : `${day} ${m}${withYear ? ' ' + y : ''}`;
}
