// Preparación de datos: validación con mensajes útiles para agentes,
// inferencia de campos, formato ancho → largo y agregación.
import { isDateLike, parseDate } from './format.js';

export class PlotError extends Error {
  constructor(message, hint) {
    super(hint ? `${message}\n→ ${hint}` : message);
    this.name = 'PlotError';
    this.hint = hint;
  }
}

/** Convierte a número de forma tolerante ("1.234,5", "12%", "$ 3.000"). */
export function num(v) {
  if (typeof v === 'number') return v;
  if (v === null || v === undefined || v === '' || typeof v === 'boolean') return NaN;
  let s = String(v).trim().replace(/[\s$€£%]|US\$|CLP|UF/g, '').replace('−', '-');
  const hasC = s.includes(','), hasD = s.includes('.');
  if (hasC && hasD) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (hasC) s = /,\d{3}(?!\d)/.test(s) && !/,\d{1,2}$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
  else if (hasD && /^\-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

export function fieldsOf(data) {
  const set = new Set();
  for (const row of data.slice(0, 50)) if (row && typeof row === 'object') Object.keys(row).forEach((k) => set.add(k));
  return [...set];
}

export function ensureData(spec) {
  let data = spec.data;
  if (!Array.isArray(data)) {
    if (data && typeof data === 'object') {
      // { "Biobío": 10, "Ñuble": 5 } → filas
      data = Object.entries(data).map(([k, v]) => ({ label: k, value: v }));
    } else throw new PlotError('`data` debe ser un arreglo de objetos (filas).', 'Ejemplo: data: [{ region: "Biobío", ventas: 120 }]');
  }
  if (data.length && typeof data[0] !== 'object') {
    data = data.map((v, i) => ({ index: i + 1, value: v }));
  }
  return data.filter((r) => r && typeof r === 'object');
}

export function requireField(data, field, role) {
  if (field === undefined || field === null) return;
  const fields = fieldsOf(data);
  if (!fields.includes(field)) {
    throw new PlotError(
      `El campo "${field}" (${role}) no existe en los datos.`,
      `Campos disponibles: ${fields.map((f) => `"${f}"`).join(', ') || '(ninguno)'}`
    );
  }
}

const isNumericField = (data, f) => {
  let n = 0, ok = 0;
  for (const r of data.slice(0, 200)) {
    const v = r[f];
    if (v === null || v === undefined || v === '') continue;
    n++;
    if (typeof v === 'number' || (typeof v === 'string' && !isDateLike(v) && Number.isFinite(num(v)))) ok++;
  }
  return n > 0 && ok / n > 0.9;
};

export const fieldKind = (data, f) => {
  const vals = data.map((r) => r[f]).filter((v) => v !== null && v !== undefined && v !== '');
  if (!vals.length) return 'empty';
  if (vals.every((v) => isDateLike(v))) return 'date';
  if (isNumericField(data, f)) {
    const ns = vals.map(num);
    if (ns.every((v) => Number.isInteger(v) && v >= 1000 && v <= 2999)) return 'year';
    return 'number';
  }
  return 'category';
};

/** Elige x / y si el agente no los indicó. */
export function inferXY(spec, data) {
  const fields = fieldsOf(data);
  const kinds = Object.fromEntries(fields.map((f) => [f, fieldKind(data, f)]));
  let { x, y } = spec;
  const nums = fields.filter((f) => kinds[f] === 'number');
  if (!x) x = fields.find((f) => kinds[f] === 'date' || kinds[f] === 'year') || fields.find((f) => kinds[f] === 'category') || fields.find((f) => f !== y);
  if (!y) y = nums.find((f) => f !== x) || fields.find((f) => f !== x);
  return { x, y, kinds };
}

/**
 * y: ['ventas', 'costos'] → formato largo con un campo de serie.
 * Así los agentes pueden pasar tablas anchas sin transformarlas.
 */
export function melt(data, x, ys, seriesName = '__series', valueName = '__value', labels = {}) {
  const out = [];
  for (const r of data) for (const f of ys) out.push({ ...r, [x]: r[x], [seriesName]: labels[f] || humanize(f), [valueName]: r[f] });
  return out;
}

export function uniq(arr) {
  const seen = new Set();
  const out = [];
  for (const v of arr) {
    const k = v instanceof Date ? v.getTime() : v;
    if (!seen.has(k)) { seen.add(k); out.push(v); }
  }
  return out;
}

export function aggregate(values, how = 'sum') {
  const v = values.filter((n) => Number.isFinite(n));
  if (!v.length) return NaN;
  switch (how) {
    case 'mean': case 'avg': return v.reduce((a, b) => a + b, 0) / v.length;
    case 'max': return Math.max(...v);
    case 'min': return Math.min(...v);
    case 'count': return v.length;
    case 'last': return v[v.length - 1];
    case 'first': return v[0];
    default: return v.reduce((a, b) => a + b, 0);
  }
}

/** Valor de x normalizado: fecha → ms, año → número, si no, texto. */
export function xValue(v, kind) {
  if (kind === 'date') return parseDate(v);
  if (kind === 'year' || kind === 'number') return num(v);
  return v === null || v === undefined ? '' : String(v);
}

export const humanize = (f) =>
  String(f ?? '')
    .replace(/^__.*/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^\w/, (c) => c.toUpperCase());
