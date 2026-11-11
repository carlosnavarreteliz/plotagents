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
  // Solo símbolos ("%", "$", " ") no es el 0; y nada de "0x10" ni "Infinity".
  if (!/^[+-]?(\d[\d.,]*|[.,]\d[\d.,]*)(e[+-]?\d+)?$/i.test(s)) return NaN;
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

// ── Formas compactas de `data` ─────────────────────────────────────────────
// Filas como objetos repiten cada nombre de campo en cada fila. Para tablas
// grandes (y para el costo en tokens de un agente) se aceptan también:
//   columnas:          { region: ["Biobío", "Ñuble"], ventas: [1240, 830] }
//   encabezado + filas: [["region", "ventas"], ["Biobío", 1240], ["Ñuble", 830]]
//                      { columns: ["region", "ventas"], rows: [["Biobío", 1240], …] }
//   texto CSV / TSV:   "region,ventas\nBiobío,1240\nÑuble,830"
// Todas se convierten a filas una sola vez (se recuerda por objeto).
const ROWS = new WeakMap();
// `r["__proto__"] = v` cambiaría el prototipo de la fila: ese nombre de campo se descarta.
const safeKey = (k) => k !== '__proto__';
let lastText = null, lastTextRows = null;

/** Convierte cualquier forma aceptada de `data` a filas; lo demás vuelve tal cual. */
export function toRows(data) {
  if (data === null || data === undefined) return data;
  if (typeof data === 'string') {
    if (data === lastText) return lastTextRows;
    const rows = parseDelimited(data);
    if (!rows) return data;
    lastText = data; lastTextRows = rows;
    return rows;
  }
  if (typeof data !== 'object') return data;
  const hit = ROWS.get(data);
  if (hit) return hit;
  let out = null;
  const isHeader = (h) => Array.isArray(h) && h.length > 0 && h.every((c) => typeof c === 'string');
  if (Array.isArray(data)) {
    if (data.length && isHeader(data[0]) && data.every(Array.isArray)) out = fromMatrix(data[0], data, 1);
  } else {
    const cols = data.columns ?? data.fields ?? data.header;
    const body = data.rows ?? data.values ?? data.data;
    if (isHeader(cols) && Array.isArray(body) && body.every(Array.isArray)) out = fromMatrix(cols, body, 0);
    else {
      const keys = Object.keys(data);
      if (keys.length && keys.every((k) => Array.isArray(data[k]))) {
        let n = 0;
        const ks = keys.filter(safeKey);
        for (const k of ks) if (data[k].length > n) n = data[k].length;
        out = new Array(n);
        for (let i = 0; i < n; i++) {
          const r = {};
          for (const k of ks) { const v = data[k][i]; if (v !== undefined) r[k] = v; }
          out[i] = r;
        }
      }
    }
  }
  if (out) ROWS.set(data, out);
  return out ?? data;
}

function fromMatrix(head, body, from) {
  const out = new Array(Math.max(0, body.length - from));
  for (let i = from; i < body.length; i++) {
    const row = body[i], r = {};
    for (let j = 0; j < head.length; j++) { const v = row[j]; if (v !== undefined && safeKey(head[j])) r[head[j]] = v; }
    out[i - from] = r;
  }
  return out;
}

const PLAIN_NUM = /^-?(0|[1-9]\d*)(\.\d+)?([eE][-+]?\d+)?$/;

/** CSV / TSV / «;» con comillas dobles. Devuelve null si no parece una tabla. */
function parseDelimited(text) {
  const src = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').replace(/\n+$/, '');
  const nl = src.indexOf('\n');
  if (nl < 0) return null;
  const first = src.slice(0, nl);
  const count = (c) => first.split(c).length - 1;
  const delim = ['\t', ';', ',', '|'].map((c) => [c, count(c)]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (q) {
      if (ch === '"') { if (src[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if (ch === '"' && cell === '') q = true;
    else if (ch === delim) { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  row.push(cell); rows.push(row);
  const head = rows[0].map((h) => h.trim());
  if (!head.length || head.some((h) => h === '')) return null;
  const cellValue = (v) => {
    const t = v.trim();
    if (t === '') return null;
    return PLAIN_NUM.test(t) ? Number(t) : t;
  };
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i];
    if (cells.length === 1 && cells[0].trim() === '') continue;
    const r = {};
    for (let j = 0; j < head.length; j++) if (safeKey(head[j])) r[head[j]] = j < cells.length ? cellValue(cells[j]) : null;
    out.push(r);
  }
  return out;
}

/**
 * Filas → encabezado + filas ([["campo", …], [v, …], …]) para incrustar datos en
 * una página: los nombres de campo van una vez. Solo si todas las filas tienen
 * los mismos campos (si no, vuelven tal cual).
 */
export function packTable(rows) {
  if (!Array.isArray(rows) || rows.length < 2) return rows;
  const r0 = rows[0];
  if (!r0 || typeof r0 !== 'object' || Array.isArray(r0)) return rows;
  const keys = Object.keys(r0);
  if (!keys.length) return rows;
  const out = [keys];
  for (const r of rows) {
    if (!r || typeof r !== 'object' || Array.isArray(r)) return rows;
    let n = 0;
    for (const k in r) { n++; if (!(k in r0)) return rows; }
    if (n !== keys.length) return rows;
    const vals = new Array(keys.length);
    for (let j = 0; j < keys.length; j++) { const v = r[keys[j]]; if (v === undefined) return rows; vals[j] = v; }
    out.push(vals);
  }
  return out;
}

/** Lo que `highlight` destaca, como Set de textos (null si no hay). */
export const highlightSet = (spec) => (spec.highlight === undefined ? null : new Set([].concat(spec.highlight).map(String)));

export function ensureData(spec) {
  let data = toRows(spec.data);
  if (!Array.isArray(data)) {
    if (data && typeof data === 'object') {
      // { "Biobío": 10, "Ñuble": 5 } → filas
      data = Object.entries(data).map(([k, v]) => ({ label: k, value: v }));
    } else throw new PlotError('`data` debe ser una tabla: filas, columnas o CSV.', 'Ejemplos: [{ region: "Biobío", ventas: 120 }] · { region: ["Biobío"], ventas: [120] } · [["region", "ventas"], ["Biobío", 120]] · "region,ventas\\nBiobío,120"');
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
    case 'max': return v.reduce((a, b) => (b > a ? b : a), -Infinity); // sin spread: no desborda con 150 mil filas
    case 'min': return v.reduce((a, b) => (b < a ? b : a), Infinity);
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
