// El riel: una fila de una distribución en una línea. Lo comparten la columna
// `range` de las tablas y el tipo `rail` (una marca suelta para una celda HTML).
//
//   mínimo ───────[ banda | mediana ]──────── máximo
//                         ●  valor de la fila    ┃ referencias
//
// La escala va de punta a punta de lo dibujado, salvo que se recorte: con
// `clip` a [mínimo, máximo] y con `domain` a lo que se le dé (p. ej. p5–p95).
// Lo que cae fuera de una escala recortada no la estira: el valor se dibuja
// como un chevrón en el extremo y una referencia como un chevrón abierto, y
// el tooltip lo dice. Una fila sin mínimo y máximo no tiene riel: no se dibuja
// un punto solo que parezca un rango.
import { el } from './svg.js';
import { num } from './data.js';

const F = Number.isFinite;

/**
 * Un extremo del riel: el nombre de un campo de la fila o un número fijo.
 * Devuelve (fila) → número (NaN si no hay).
 */
export const railAccessor = (k) => (typeof k === 'string' ? (r) => num(r?.[k]) : F(+k) && k !== null && k !== undefined && typeof k !== 'boolean' ? () => +k : () => NaN);

/**
 * Las referencias de un riel: `refs: [{ value | field, label, color }]` más la
 * `ref` suelta de siempre (que va primero, con `refLabel`).
 */
export function railRefs(spec) {
  const out = [];
  if (spec.ref !== undefined && spec.ref !== null) out.push({ get: railAccessor(spec.ref), label: spec.refLabel, color: undefined });
  for (const r of [].concat(spec.refs ?? [])) {
    if (r === null || r === undefined) continue;
    if (typeof r !== 'object') { out.push({ get: railAccessor(r), label: undefined }); continue; }
    out.push({ get: railAccessor(r.field ?? r.value), label: r.label, color: r.color });
  }
  return out;
}

/** Accesores de un riel a partir de su spec (columna de tabla o tipo `rail`). */
export function railAccessors(spec) {
  const band = Array.isArray(spec.band) ? spec.band : [];
  const dom = Array.isArray(spec.domain) ? spec.domain : null;
  return {
    min: railAccessor(spec.min), max: railAccessor(spec.max), lo: railAccessor(band[0]), hi: railAccessor(band[1]),
    median: railAccessor(spec.median), refs: railRefs(spec),
    domain: dom ? [railAccessor(dom[0]), railAccessor(dom[1])] : null,
  };
}

/** Los valores de una fila: { min, max, lo, hi, median, refs: [{ v, label, color }], domain }. */
export function railValues(acc, r) {
  const d = acc.domain ? [acc.domain[0](r), acc.domain[1](r)] : null;
  return {
    min: acc.min(r), max: acc.max(r), lo: acc.lo(r), hi: acc.hi(r), median: acc.median(r),
    refs: acc.refs.map((x) => ({ v: x.get(r), label: textOf(x.label, r), color: x.color })),
    domain: d && F(d[0]) && F(d[1]) && d[1] > d[0] ? d : null,
  };
}

/** Un rótulo: texto, el nombre de un campo de la fila que lo trae, o una función (fila) → texto. */
export function textOf(t, r) {
  if (t === undefined || t === null) return undefined;
  if (typeof t === 'function') return t(r);
  const s = String(t);
  if (r && Object.prototype.hasOwnProperty.call(r, s) && r[s] !== null && r[s] !== undefined && r[s] !== '') return String(r[s]);
  return s;
}

/** Todo lo dibujable de una fila, para la extensión de la escala. */
export const railExtent = (v, vals) => [v, vals.min, vals.max, vals.lo, vals.hi, vals.median, ...vals.refs.map((x) => x.v)].filter(F);

/**
 * Las marcas del riel. `x0` y `w`: dónde va la pista; `my`: su línea media;
 * `[a, b]`: la escala; `clipped`: lo de fuera se marca con un chevrón.
 * `track`: dibujar la pista entera de a a b cuando no hay mínimo y máximo.
 * Devuelve { out: [svg], past: -1 | 0 | 1 } (por dónde se sale el valor).
 */
export function railMarks({ v, vals, a, b, x0, w, my, clipped = false, track = false, theme, colors = {}, dot, muted, sizes = {} }) {
  const span = b - a || 1;
  const X = (t) => x0 + ((t - a) / span) * w;
  const C = (t) => (clipped ? Math.min(b, Math.max(a, t)) : t);
  const out = [];
  const S = { rail: 2, band: 4, median: 6, ref: 8, dot: 4.5, ...sizes };
  const railC = colors.rail ?? theme.axis, bandC = colors.band ?? theme.tint2, medC = colors.median ?? theme.lede;
  if (F(vals.min) && F(vals.max)) out.push(el('line', { x1: X(C(vals.min)), x2: X(C(vals.max)), y1: my, y2: my, stroke: railC, strokeWidth: S.rail, strokeLinecap: 'round' }));
  else if (track) out.push(el('line', { x1: X(a), x2: X(b), y1: my, y2: my, stroke: railC, strokeWidth: S.rail, strokeLinecap: 'round' }));
  if (F(vals.lo) && F(vals.hi)) {
    const l = C(Math.min(vals.lo, vals.hi)), h = C(Math.max(vals.lo, vals.hi));
    if (!(clipped && l === h && (l === a || l === b))) out.push(el('rect', { x: X(l), y: my - S.band, width: Math.max(1.5, Math.abs(X(h) - X(l))), height: S.band * 2, rx: 2, fill: bandC }));
  }
  const inside = (t) => !clipped || (t >= a && t <= b);
  if (F(vals.median) && inside(vals.median)) out.push(el('line', { x1: X(vals.median), x2: X(vals.median), y1: my - S.median, y2: my + S.median, stroke: medC, strokeWidth: 1.5 }));
  for (const ref of vals.refs) {
    if (!F(ref.v)) continue;
    const rc = ref.color ?? colors.ref ?? theme.ink;
    if (inside(ref.v)) out.push(el('line', { x1: X(ref.v), x2: X(ref.v), y1: my - S.ref, y2: my + S.ref, stroke: rc, strokeWidth: 2, strokeLinecap: 'round' }));
    else {
      // Una referencia fuera de la escala: un chevrón abierto en ese extremo.
      const e = ref.v > b ? x0 + w + 2 : x0 - 2, k = ref.v > b ? -1 : 1;
      out.push(el('path', { d: `M${r1(e + k * 5)},${r1(my - S.ref + 2)}L${r1(e)},${r1(my)}L${r1(e + k * 5)},${r1(my + S.ref - 2)}`, fill: 'none', stroke: rc, strokeWidth: 1.75, strokeLinecap: 'round', strokeLinejoin: 'round' }));
    }
  }
  let past = 0;
  if (F(v)) {
    const fill = dot;
    if (inside(v)) out.push(el('circle', { cx: X(v), cy: my, r: S.dot, fill, stroke: theme.surface, strokeWidth: 1.5 }));
    else {
      // Pasado el extremo: un chevrón que apunta hacia afuera, no un punto en
      // el último píxel (que se leería «en el máximo» y no «más allá»).
      past = v > b ? 1 : -1;
      const e = past > 0 ? x0 + w + 2 : x0 - 2, k = -past;
      const hh = Math.min(5, S.dot + 0.5);
      out.push(el('path', { d: `M${r1(e)},${r1(my)}L${r1(e + k * 7)},${r1(my - hh)}L${r1(e + k * 7)},${r1(my + hh)}Z`, fill, stroke: theme.surface, strokeWidth: 1, strokeLinejoin: 'round' }));
    }
  }
  return { out, past, muted };
}

const r1 = (n) => Math.round(n * 10) / 10;

/**
 * El texto del tooltip: el valor, el rango (o sus dos extremos con nombre), la
 * banda, la mediana, cada referencia con su rótulo y, si se recortó, la
 * escala. Lo que cae fuera de ella lo dice.
 */
export function railTip({ en, label, s, fr, vals, labels = {}, past = 0, scale = null, row }) {
  const off = en ? 'beyond the scale' : 'fuera de la escala';
  const parts = [`${label}: ${s}${past ? ` (${off})` : ''}`];
  const minL = textOf(labels.min, row), maxL = textOf(labels.max, row);
  if (F(vals.min) && F(vals.max)) {
    if (minL !== undefined || maxL !== undefined) {
      parts.push(`${minL ?? (en ? 'Lowest' : 'Mínimo')}: ${fr(vals.min)}`);
      parts.push(`${maxL ?? (en ? 'Highest' : 'Máximo')}: ${fr(vals.max)}`);
    } else parts.push(`${en ? 'Range' : 'Rango'}: ${fr(vals.min)}–${fr(vals.max)}`);
  }
  if (F(vals.lo) && F(vals.hi)) parts.push(`${textOf(labels.band, row) ?? (en ? 'Middle half' : 'Mitad central')}: ${fr(vals.lo)}–${fr(vals.hi)}`);
  if (F(vals.median)) parts.push(`${textOf(labels.median, row) ?? (en ? 'Median' : 'Mediana')}: ${fr(vals.median)}`);
  for (const ref of vals.refs) {
    if (!F(ref.v)) continue;
    const out = scale && (ref.v < scale[0] || ref.v > scale[1]);
    parts.push(`${ref.label ?? (en ? 'Reference' : 'Referencia')}: ${fr(ref.v)}${out ? ` (${off})` : ''}`);
  }
  if (scale && labels.domain !== undefined && labels.domain !== null) parts.push(`${textOf(labels.domain, row)}: ${fr(scale[0])}–${fr(scale[1])}`);
  return parts.join('\n');
}
