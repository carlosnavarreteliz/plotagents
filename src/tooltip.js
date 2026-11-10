// `tooltip`: lo que dice cada marca al pasar el cursor, más allá de su valor.
//
//   tooltip: ['region', 'share']                       // líneas «Campo: valor» de la fila
//   tooltip: { title: 'name', fields: [...], text: 'note', replace: true }
//   tooltip: { omit: ['Escala'] }                      // quita una línea de las de siempre, por su nombre
//   tooltip: (d) => ({ title: d.title, lines: [...d.lines, 'otra línea'] })   // sólo JS
//   tooltip: false                                     // sin tooltips
//
// Cada marca sabe qué filas la forman (una barra: las de su categoría y serie;
// un punto de una línea: las de su x). `fields` lee de la primera; `text` es un
// campo con texto ya escrito (puede traer saltos de línea) que va tal cual.
// Sin `tooltip`, todo queda como antes: el valor por omisión no cambia nada.

import { tip } from './svg.js';
import { makeFormat } from './format.js';
import { num } from './data.js';

const humanize = (f) => String(f).replace(/[_-]+/g, ' ').replace(/^./, (c) => c.toUpperCase());

function normalize(t) {
  if (t === undefined || t === null || t === true) return null;
  if (t === false) return { off: true };
  if (typeof t === 'function') return { fn: t };
  if (typeof t === 'string') return { fields: [t] };
  if (Array.isArray(t)) return { fields: t };
  if (typeof t === 'object') return { ...t, fields: t.fields ? [].concat(t.fields) : [] };
  return null;
}

/**
 * El armador de tooltips de un gráfico. `data` son sus filas.
 * Devuelve `T(match, title, ...lines)` → el texto de `data-tip` (o undefined).
 * `match` es `{ campo: valor }` (las filas de la marca) o una lista de filas.
 */
export function tipper(spec, data, locale) {
  const o = normalize(spec.tooltip);
  if (!o) return (match, ...lines) => tip(...lines);
  if (o.off) return () => undefined;
  const index = new Map();
  const rowsOf = (match) => {
    if (Array.isArray(match)) return match;
    if (!match || !Array.isArray(data)) return [];
    const keys = Object.keys(match).filter((k) => k && match[k] !== undefined && match[k] !== null);
    if (!keys.length) return [];
    const sig = keys.join('\u0000');
    if (!index.has(sig)) {
      const m = new Map();
      for (const r of data) {
        const k = keys.map((f) => String(r[f])).join('\u0000');
        if (!m.has(k)) m.set(k, []);
        m.get(k).push(r);
      }
      index.set(sig, m);
    }
    return index.get(sig).get(keys.map((f) => String(match[f])).join('\u0000')) || [];
  };
  // `omit`: nombres de líneas de las de siempre que no van. Una línea «Escala:
  // 0–40» se llama «Escala» (lo que va antes de los dos puntos); también vale
  // la línea entera o, desde JS, una RegExp.
  const omit = o.omit === undefined || o.omit === null ? [] : [].concat(o.omit);
  const dropped = (l) => omit.some((p) => (p instanceof RegExp ? p.test(l) : l === String(p) || l.startsWith(String(p) + ':')));
  const fmts = new Map();
  const fmtField = (f, fmt) => {
    if (!fmts.has(f)) fmts.set(f, makeFormat(fmt ?? spec.format, locale, (data || []).map((r) => num(r[f])).filter(Number.isFinite)));
    return fmts.get(f);
  };
  const show = (v, f, fmt) => {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'number' && Number.isFinite(v)) return fmtField(f, fmt)(v);
    return String(v);
  };
  return (match, title, ...lines) => {
    const rows = rowsOf(match);
    const base = lines.filter((l) => l !== undefined && l !== null && l !== '' && !(omit.length && dropped(String(l))));
    if (o.fn) {
      const out = o.fn({ title, lines: base, rows, row: rows[0], match: Array.isArray(match) ? undefined : match });
      if (out === null || out === undefined || out === false) return undefined;
      if (typeof out === 'string') return out;
      if (Array.isArray(out)) return tip(...out.map(String));
      return tip(out.title ?? title, ...[].concat(out.lines ?? []).map(String));
    }
    // Una marca hecha de varias filas (un grupo del treemap, un año con varias
    // series) muestra un campo sólo si todas las que lo traen dicen lo mismo.
    const one = (f) => {
      const vs = [...new Set(rows.map((r) => r[f]).filter((v) => v !== undefined && v !== null && v !== '').map((v) => (typeof v === 'number' ? v : String(v))))];
      return vs.length === 1 ? vs[0] : undefined;
    };
    const head = o.title ? show(one(o.title), o.title) ?? title : title;
    const extra = [];
    for (const f of o.fields) {
      const spec1 = typeof f === 'string' ? { field: f } : f;
      const v = show(one(spec1.field), spec1.field, spec1.format);
      if (v !== null) extra.push(`${spec1.label ?? humanize(spec1.field)}: ${v}`);
    }
    const tx = o.text ? one(o.text) : undefined;
    if (tx !== undefined) extra.push(...String(tx).split('\n'));
    return tip(head, ...(o.replace ? [] : base), ...extra);
  };
}
