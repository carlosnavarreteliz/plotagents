// Dot plot (Wilkinson): un punto por observación, apilados por tramo.
//
// Como un histograma, pero cada cosa sigue siendo una: se puede señalar con el
// mouse, nombrar (`label`) y destacar (`highlight`: ese punto con un anillo y
// los demás aclarados). `x` numérico se agrupa en tramos de ancho `bin` (o
// `bins` tramos); `x` categórico apila por categoría. `ticks: [[valor, rótulo],
// …]` pone marcas propias en el eje (p. ej. los tramos de ingreso que publica
// la fuente) en vez de las automáticas.
import { tipper } from '../tooltip.js';
import { el, g, text, tip } from '../svg.js';
import { measure } from '../text.js';
import { makeFormat } from '../format.js';
import { colorMap, readable } from '../theme.js';
import { niceDomain, linear } from '../scale.js';
import { ensureData, requireField, uniq, num, fieldsOf, fieldKind, PlotError } from '../data.js';
import { createFrame } from '../frame.js';
import { xLabels } from '../axes.js';
import { langOf } from '../i18n.js';

export function dotplot(spec, theme) {
  const locale = spec.locale || 'es';
  const en = langOf(locale) === 'en';
  const data = ensureData(spec);
  const fields = fieldsOf(data);
  const x = spec.x ?? spec.value ?? fields.find((f) => fieldKind(data, f) === 'number') ?? fields[0];
  requireField(data, x, 'x');
  const series = spec.series ?? spec.hue ?? null;
  if (series) requireField(data, series, 'series');
  const labelF = typeof spec.label === 'string' ? spec.label : null;
  if (labelF) requireField(data, labelF, 'label');
  const categorical = fieldKind(data, x) === 'category';

  const keys = series ? uniq(data.map((r) => String(r[series]))) : [];
  const cmap = colorMap(keys, theme, spec.colors);
  const colorOf = (r) => (series ? cmap.get(String(r[series])) : spec.colors?.[String(r[labelF])] ?? theme.categorical[0]);
  const hl = spec.highlight === undefined || spec.highlight === null ? null : new Set([].concat(spec.highlight).map(String));
  const isHL = (r) => !!hl && labelF && hl.has(String(r[labelF]));

  // Tramos.
  let rows = data.filter((r) => (categorical ? r[x] !== null && r[x] !== undefined && r[x] !== '' : Number.isFinite(num(r[x]))));
  if (!rows.length) throw new PlotError(en ? `"${x}" has no values to plot.` : `"${x}" no tiene valores para dibujar.`, en ? 'Check the field name.' : 'Revisa el nombre del campo.');
  const vals = categorical ? [] : rows.map((r) => num(r[x]));
  const fmt = makeFormat(spec.format, locale, vals);
  let bins, binOf, center, lo = 0, w = 1;
  if (categorical) {
    bins = uniq(rows.map((r) => String(r[x])));
    binOf = (r) => bins.indexOf(String(r[x]));
  } else {
    lo = Math.min(...vals);
    const hi = Math.max(...vals);
    w = +(spec.bin ?? spec.binWidth) || (hi - lo) / Math.max(1, Math.round(spec.bins ?? 30)) || 1;
    // Origen redondo: los tramos caen en múltiplos del ancho.
    lo = Math.floor(lo / w) * w;
    const nb = Math.max(1, Math.floor((hi - lo) / w) + 1);
    bins = Array.from({ length: nb }, (_, i) => i);
    binOf = (r) => Math.min(nb - 1, Math.floor((num(r[x]) - lo) / w + 1e-9));
  }
  center = (i) => (categorical ? i : lo + (i + 0.5) * w);

  // Pilas: en cada tramo, por serie y luego por valor (misma entrada, mismo dibujo).
  const stacks = bins.map(() => []);
  for (const r of rows) stacks[binOf(r)].push(r);
  for (const st of stacks) st.sort((a, b) => (series ? keys.indexOf(String(a[series])) - keys.indexOf(String(b[series])) : 0) || (categorical ? 0 : num(a[x]) - num(b[x])) || String(a[labelF] ?? '').localeCompare(String(b[labelF] ?? '')));
  const maxStack = Math.max(...stacks.map((s) => s.length));

  // Líneas de referencia (sólo con x numérico): un valor fijo o un campo de los
  // datos —todas las filas deben decir lo mismo; en facetas, el de cada panel—.
  // Una referencia que no es un punto más: no se apila ni entra a los tramos.
  const refs = categorical ? [] : [].concat(spec.refLines ?? []).filter((r) => r && typeof r === 'object').map((r) => {
    const raw = r.x ?? r.value;
    let v = NaN;
    if (typeof raw === 'string' && data.length && raw in data[0]) {
      const vs = uniq(data.map((d) => num(d[raw])).filter(Number.isFinite));
      if (vs.length === 1) v = vs[0];
    } else v = num(raw);
    return { ...r, v };
  }).filter((r) => Number.isFinite(r.v));
  const refTop = refs.some((r) => r.label) ? 18 : 0;

  // Marco.
  const legend = keys.length > 1 && spec.legend !== false ? keys.map((k) => ({ label: k, color: cmap.get(k), shape: 'circle' })) : [];
  const frame = createFrame(spec, theme, { height: 260 });
  const area = frame.layout(legend);
  const axisH = 26;
  const inner = { x: area.x + 6, y: area.y, w: area.w - 12, h: area.h - axisH };

  // Escala x: con marcas propias, el dominio las incluye.
  const custom = Array.isArray(spec.ticks) ? spec.ticks.map((t) => (Array.isArray(t) ? [num(t[0]), String(t[1] ?? fmt(num(t[0])))] : [num(t), fmt(num(t))])).filter(([v]) => Number.isFinite(v)) : null;
  let xs, binPx;
  if (categorical) {
    binPx = inner.w / bins.length;
    xs = (i) => inner.x + binPx * (i + 0.5);
  } else {
    let d0 = lo, d1 = lo + bins.length * w;
    if (custom) for (const [v] of custom) { d0 = Math.min(d0, v); d1 = Math.max(d1, v); }
    for (const r of refs) { d0 = Math.min(d0, r.v); d1 = Math.max(d1, r.v); }
    const sc = linear(d0, d1, inner.x, inner.x + inner.w);
    xs = (i) => sc(center(i));
    xs.value = sc;
    binPx = Math.abs(sc(lo + w) - sc(lo));
  }
  const maxD = spec.dotSize ?? 14;
  let d = Math.max(2, Math.min(binPx, maxD));
  if (spec.height !== undefined) d = Math.max(2, Math.min(d, (inner.h - refTop) / maxStack));
  else { inner.h = maxStack * d + 4 + (hl && labelF ? 20 : 0) + refTop; frame.setHeight(inner.y + inner.h + axisH + frame.chrome); }
  const base = inner.y + inner.h;
  const r = Math.max(1, d / 2 - (d > 6 ? 0.75 : 0.25));

  const body = [];
  // Eje.
  body.push(el('line', { x1: inner.x - 6, x2: inner.x + inner.w + 6, y1: base + 0.5, y2: base + 0.5, stroke: theme.axis, strokeWidth: 1, shapeRendering: 'crispEdges' }));
  if (categorical) {
    body.push(xLabels(bins.map((b, i) => ({ pos: xs(i), label: b })), inner, theme, { y: base + 18 }));
  } else if (custom) {
    body.push(xLabels(custom.map(([v, l]) => ({ pos: xs.value(v), label: l })), inner, theme, { y: base + 18 }));
    for (const [v] of custom) body.push(el('line', { x1: xs.value(v), x2: xs.value(v), y1: base, y2: base + 5, stroke: theme.axis, strokeWidth: 1 }));
  } else {
    const nd = niceDomain(lo, lo + bins.length * w, Math.max(3, Math.round(inner.w / 110)));
    const tks = [];
    for (let t = nd.min; t <= nd.max + 1e-9; t += nd.step) if (t >= lo - 1e-9 && t <= lo + bins.length * w + 1e-9) tks.push(t);
    const tf = fmt.tick ? fmt.tick(nd.step, tks) : fmt;
    body.push(xLabels(tks.map((t) => ({ pos: xs.value(t), label: tf(t) })), inner, theme, { y: base + 18 }));
  }

  // Puntos: los destacados al final, encima.
  const TT = tipper(spec, null, spec.locale || 'es');
  const marks = [], top = [];
  stacks.forEach((st, i) => st.forEach((row, k) => {
    const c = colorOf(row);
    const cx = xs(i), cy = base - (k + 0.5) * d;
    const on = isHL(row);
    const lines = [
      labelF ? String(row[labelF]) : (categorical ? String(row[x]) : fmt(num(row[x]))),
      labelF ? `${spec.xLabel ?? x}: ${categorical ? String(row[x]) : fmt(num(row[x]))}` : '',
      series ? `${series}: ${row[series]}` : '',
    ];
    const dot = el('circle', { cx, cy, r: on ? r + 1 : r, fill: c, fillOpacity: hl && !on ? 0.3 : theme.marks?.dotOpacity ?? 0.9, stroke: on ? theme.ink : null, strokeWidth: on ? 1.75 : null });
    (on ? top : marks).push(g({ class: 'pa-m', 'data-tip': TT([row], ...lines), 'data-color': c }, [dot]));
    if (on && labelF) {
      const t = String(row[labelF]);
      const tx = Math.min(inner.x + inner.w - measure(t, 12, 600), Math.max(inner.x, cx - measure(t, 12, 600) / 2));
      // El nombre va sobre la pila entera, no encima de los puntos de arriba.
      top.push(text(tx, base - st.length * d - 6, t, { fill: readable(c, theme), fontSize: 12, fontWeight: 600 }));
    }
  }));
  if (refs.length) {
    // Detrás de los puntos: la línea; encima de todo, el rótulo (sin salirse del área).
    const lines = [], labels = [];
    for (const r of refs) {
      const px = Math.round(xs.value(r.v)) + 0.5;
      const lab = r.label ? (r.showValue === false ? String(r.label) : `${r.label} · ${fmt(r.v)}`) : '';
      const tipTxt = tip(r.label ? String(r.label) : '', fmt(r.v));
      lines.push(g({ class: 'pa-ref', 'data-tip': tipTxt }, [
        el('line', { x1: px, x2: px, y1: inner.y + (lab ? 16 : 0), y2: base, stroke: r.color || theme.ink, strokeWidth: 1.25, opacity: 0.7 }),
        el('line', { x1: px, x2: px, y1: inner.y + (lab ? 16 : 0), y2: base, stroke: 'transparent', strokeWidth: 8 }),
      ]));
      if (lab) {
        const w = measure(lab, 11.5, 500);
        const anchor = px - w / 2 < inner.x ? 'start' : px + w / 2 > inner.x + inner.w ? 'end' : 'middle';
        const tx = anchor === 'start' ? Math.max(inner.x, px - 4) : anchor === 'end' ? Math.min(inner.x + inner.w, px + 4) : px;
        labels.push(text(tx, inner.y + 11, lab, { fill: theme.ink, fontSize: 11.5, fontWeight: 500, textAnchor: anchor, 'data-tip': tipTxt }));
      }
    }
    body.push(g({ class: 'pa-refs' }, lines));
    body.push(...marks, ...top);
    body.push(g({ class: 'pa-refs' }, labels));
  } else body.push(...marks, ...top);

  const big = stacks.reduce((b, s, i) => (s.length > stacks[b].length ? i : b), 0);
  const where = categorical ? bins[big] : `${fmt(lo + big * w)}–${fmt(lo + (big + 1) * w)}`;
  const desc = en
    ? `Dot plot of ${rows.length} observations of ${x}. Most in ${where} (${stacks[big].length}).`
    : `Gráfico de puntos de ${rows.length} observaciones de ${x}. La mayoría en ${where} (${stacks[big].length}).`;
  return frame.finish(body, { desc, type: 'dotplot' });
}
