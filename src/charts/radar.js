// Radar (araña): perfil de una o más series en varios ejes comparables.
// Formato largo { eje, valor, serie } o ancho (una fila por serie + `axes`).
import { el, g, text, tip } from '../svg.js';
import { measure, wrap } from '../text.js';
import { makeFormat } from '../format.js';
import { niceDomain, niceStep, linear } from '../scale.js';
import { colorMap } from '../theme.js';
import { ensureData, requireField, uniq, num, fieldsOf, fieldKind, humanize, aggregate } from '../data.js';
import { createFrame } from '../frame.js';

export function radar(spec, theme) {
  const data = ensureData(spec);
  const fields = fieldsOf(data);
  const kinds = Object.fromEntries(fields.map((f) => [f, fieldKind(data, f)]));
  const locale = spec.locale || 'es';
  const en = String(locale).startsWith('en');
  let series = spec.hue ?? spec.series ?? (typeof spec.color === 'string' && !spec.color.startsWith('#') ? spec.color : undefined);
  let axes, seriesKeys;
  const values = new Map(); // serie → Map(eje → valor)

  if (Array.isArray(spec.axes) && spec.axes.length) {
    // Formato ancho: cada fila es una serie; las columnas `axes` son los ejes.
    axes = spec.axes.map(String);
    axes.forEach((a) => requireField(data, a, 'axes'));
    const labelF = spec.label ?? series ?? fields.find((f) => kinds[f] === 'category' && !axes.includes(f));
    if (labelF) requireField(data, labelF, 'label');
    seriesKeys = data.map((r, i) => (labelF ? String(r[labelF]) : `${en ? 'Series' : 'Serie'} ${i + 1}`));
    data.forEach((r, i) => values.set(seriesKeys[i], new Map(axes.map((a) => [a, num(r[a])]))));
    series = labelF;
  } else {
    const axisF = spec.axis ?? spec.x ?? fields.find((f) => kinds[f] === 'category' && f !== series);
    const valueF = spec.value ?? spec.y ?? fields.find((f) => kinds[f] === 'number' && f !== series);
    requireField(data, axisF, 'axis (x)');
    requireField(data, valueF, 'value (y)');
    if (series) requireField(data, series, 'series');
    axes = uniq(data.map((r) => String(r[axisF])));
    seriesKeys = series ? uniq(data.map((r) => String(r[series]))) : [humanize(valueF)];
    const acc = new Map();
    for (const r of data) {
      const s = series ? String(r[series]) : seriesKeys[0];
      const k = s + '\u0000' + String(r[axisF]);
      if (!acc.has(k)) acc.set(k, []);
      acc.get(k).push(num(r[valueF]));
    }
    for (const s of seriesKeys) values.set(s, new Map(axes.map((a) => [a, aggregate(acc.get(s + '\u0000' + a) || [], spec.aggregate || 'mean')])));
  }
  const n = axes.length;
  const raw = [...values.values()].flatMap((m) => [...m.values()]).filter(Number.isFinite);
  const fmt = makeFormat(spec.format, locale, raw);

  // Normalización por eje (cada eje a 0–1 según su máximo).
  const axisMax = new Map(axes.map((a) => [a, Math.max(...seriesKeys.map((s) => values.get(s).get(a)).filter(Number.isFinite), 0)]));
  const norm = !!spec.normalize;
  const val = (s, a) => { const v = values.get(s).get(a); return norm ? v / (axisMax.get(a) || 1) : v; };
  const vals = seriesKeys.flatMap((s) => axes.map((a) => val(s, a))).filter(Number.isFinite);
  let dom;
  if (spec.domain || spec.valueDomain || spec.yDomain) { const d = spec.domain || spec.valueDomain || spec.yDomain; dom = { min: d[0], max: d[1], step: niceStep(d[1] - d[0], 5) }; }
  else if (norm) dom = { min: 0, max: 1, step: 0.25 };
  else dom = niceDomain(Math.min(0, ...vals), Math.max(...vals), 4);
  const rings = linear(dom.min, dom.max, 0, 1).ticks(dom.step).filter((t) => t > dom.min + 1e-9 && t <= dom.max + 1e-9);
  if (!rings.length || Math.abs(rings[rings.length - 1] - dom.max) > 1e-9) rings.push(dom.max);
  const ringFmt = norm ? (v) => Math.round(v * 100) + '%' : fmt.tick(dom.step);

  // Colores y foco
  const cmap = colorMap(seriesKeys, theme, spec.colors);
  const hl = spec.highlight === undefined ? null : new Set([].concat(spec.highlight).map(String));
  const focus = (s) => !hl || hl.has(s);
  const colorOf = (s) => (focus(s) ? (seriesKeys.length === 1 ? cmap.get(s) || theme.categorical[0] : cmap.get(s)) : theme.dim);
  const legend = seriesKeys.length > 1 ? seriesKeys.map((s) => ({ label: s, color: colorOf(s), shape: 'square' })) : [];

  const frame = createFrame(spec, theme);
  let area = frame.layout(spec.legend === false ? [] : legend);

  // Etiquetas de eje: ancho máximo y alto (hasta 2 líneas).
  const ls = (theme.type?.label ?? 12) + 0.5;
  const maxLabelW = Math.min(130, Math.max(60, area.w * 0.2));
  const labelLines = axes.map((a) => wrap(a, maxLabelW, ls, 500, 2));
  const labW = Math.max(...labelLines.map((ls2) => Math.max(...ls2.map((l) => measure(l, ls, 500)))));
  const labH = ls * 1.25 * Math.max(...labelLines.map((l) => l.length));
  const gapL = 10;
  let R = Math.min((area.w - 2 * (labW + gapL)) / 2, (area.h - 2 * (labH + gapL)) / 2);
  if (spec.height === undefined) {
    R = Math.max(60, Math.min((area.w - 2 * (labW + gapL)) / 2, spec.maxRadius ?? 210));
    frame.setHeight(area.y + 2 * (R + labH + gapL) + 4 + frame.chrome);
    area = { ...area, h: frame.bottom - area.y };
  }
  R = Math.max(40, R);
  const cx = area.x + area.w / 2;
  const cy = area.y + area.h / 2;
  const ang = (i) => -Math.PI / 2 + (2 * Math.PI * i) / n;
  const rOf = (v) => Math.max(0, ((v - dom.min) / (dom.max - dom.min || 1)) * R);
  const pt = (i, r) => [cx + r * Math.cos(ang(i)), cy + r * Math.sin(ang(i))];
  const shape = spec.grid === 'circle' ? 'circle' : 'polygon';
  const ringPath = (r) => (shape === 'circle' ? null : 'M' + axes.map((_, i) => pt(i, r).map((v) => v.toFixed(2)).join(',')).join('L') + 'Z');

  const body = [];
  // Rejilla: anillos y radios, recesivos.
  rings.forEach((t, k) => {
    const r = rOf(t);
    const outer = k === rings.length - 1;
    const attrs = { fill: 'none', stroke: outer ? theme.axis : theme.grid, strokeWidth: 1 };
    body.push(shape === 'circle' ? el('circle', { cx, cy, r, ...attrs }) : el('path', { d: ringPath(r), ...attrs, strokeLinejoin: 'round' }));
  });
  axes.forEach((_, i) => { const [x, y] = pt(i, R); body.push(el('line', { x1: cx, y1: cy, x2: x, y2: y, stroke: theme.grid, strokeWidth: 1 })); });

  // Series: el foco se dibuja al final (encima).
  const order = [...seriesKeys].sort((a, b) => (focus(a) ? 1 : 0) - (focus(b) ? 1 : 0));
  const op = theme.marks?.bandOpacity ?? 0.16;
  const lw = theme.marks?.lineWidth ?? 2;
  for (const s of order) {
    const c = colorOf(s);
    const verts = axes.map((a, i) => { const v = val(s, a); return Number.isFinite(v) ? pt(i, rOf(v)) : [cx, cy]; });
    const d = 'M' + verts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join('L') + 'Z';
    const top = axes.map((a) => [a, values.get(s).get(a)]).filter(([, v]) => Number.isFinite(v)).sort((p, q) => (norm ? q[1] / (axisMax.get(q[0]) || 1) - p[1] / (axisMax.get(p[0]) || 1) : q[1] - p[1]));
    const parts = [el('path', { d, fill: c, fillOpacity: focus(s) ? op : op * 0.5, stroke: c, strokeWidth: focus(s) ? lw : 1.25, strokeLinejoin: 'round' })];
    if (focus(s)) verts.forEach(([x, y], i) => {
      const v = values.get(s).get(axes[i]);
      parts.push(el('circle', { cx: x, cy: y, r: (theme.marks?.pointRadius ?? 4) - 0.5, fill: c, stroke: theme.surface, strokeWidth: theme.marks?.ring ?? 2, 'data-tip': tip(s, `${axes[i]}: ${Number.isFinite(v) ? fmt(v) : '—'}`) }));
    });
    body.push(g({ class: 'pa-m', 'data-series': s, 'data-tip': tip(s, ...top.slice(0, 6).map(([a, v]) => `${a}: ${fmt(v)}`)) }, parts));
  }

  // Valores de los anillos sobre el primer radio (arriba), con halo.
  rings.forEach((t) => {
    const r = rOf(t);
    body.push(text(cx + 4, cy - r - 3, ringFmt(t), { fill: theme.muted, fontSize: (theme.type?.axis ?? 11.5) - 1, stroke: theme.surface, strokeWidth: 3, paintOrder: 'stroke', strokeLinejoin: 'round' }));
  });

  // Etiquetas de eje fuera del círculo, ancladas según el ángulo.
  axes.forEach((a, i) => {
    const t = ang(i);
    const cos = Math.cos(t), sin = Math.sin(t);
    const [x, y] = pt(i, R + gapL);
    const anchor = cos > 0.25 ? 'start' : cos < -0.25 ? 'end' : 'middle';
    const lines = labelLines[i];
    const lh = ls * 1.25;
    const total = lines.length * lh;
    const y0 = sin < -0.25 ? y - total + ls * 0.85 : sin > 0.25 ? y + ls * 0.85 : y - total / 2 + ls * 0.85;
    lines.forEach((l, k) => body.push(text(x, y0 + k * lh, l, { fill: theme.ink, fontSize: ls, fontWeight: 500, textAnchor: anchor })));
  });

  // Descripción: fortaleza de cada serie.
  const parts = seriesKeys.slice(0, 5).map((s) => {
    const best = axes.map((a) => [a, val(s, a)]).filter(([, v]) => Number.isFinite(v)).sort((p, q) => q[1] - p[1]);
    if (!best.length) return '';
    const b = best[0], w = best[best.length - 1];
    return en ? `${s}: strongest on ${b[0]}, weakest on ${w[0]}.` : `${s}: más alto en ${b[0]}, más bajo en ${w[0]}.`;
  });
  const warn = seriesKeys.length > 4 ? (en ? ' More than 4 series overlap; consider highlight.' : ' Más de 4 series se superponen; considera highlight.') : '';
  const desc = (en ? `Radar chart with ${n} axes and ${seriesKeys.length} series${norm ? ' (each axis normalized to its maximum)' : ''}. ` : `Gráfico de radar con ${n} ejes y ${seriesKeys.length} series${norm ? ' (cada eje normalizado a su máximo)' : ''}. `) + parts.join(' ') + warn;
  return frame.finish(body, { desc, type: 'radar' });
}
