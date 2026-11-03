// Dispersión y burbujas: relación entre dos variables numéricas, con tamaño
// opcional (área proporcional), escalas log y línea de tendencia.
import { el, g, text, tip, dotLayer } from '../svg.js';
import { measure } from '../text.js';
import { makeFormat } from '../format.js';
import { niceDomain, niceStep, linear, log, logDomain } from '../scale.js';
import { colorMap } from '../theme.js';
import { ensureData, requireField, uniq, num, fieldsOf, fieldKind, humanize } from '../data.js';
import { gridY, gridX, ticksWidth, refLinesY, refLinesX, yAxisMargin, yAxisTop, yGrid, yTickLabels } from '../axes.js';
import { createFrame, SIZES } from '../frame.js';

export function scatter(spec, theme) {
  const data = ensureData(spec);
  const fields = fieldsOf(data);
  const numeric = fields.filter((f) => fieldKind(data, f) === 'number' || fieldKind(data, f) === 'year');
  const x = spec.x || numeric[0];
  const y = spec.y || numeric.find((f) => f !== x);
  const size = spec.size;
  const series = spec.series ?? spec.hue ?? spec.color;
  const labelF = spec.label ?? fields.find((f) => fieldKind(data, f) === 'category' && f !== series);
  requireField(data, x, 'x');
  requireField(data, y, 'y');
  if (size) requireField(data, size, 'size');
  if (series) requireField(data, series, 'series');
  const locale = spec.locale || 'es';

  const pts = data
    .map((r) => ({ r, x: num(r[x]), y: num(r[y]), s: size ? num(r[size]) : 1, k: series ? String(r[series]) : '', name: labelF ? String(r[labelF] ?? '') : '' }))
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  const keys = series ? uniq(pts.map((p) => p.k)) : [''];
  const cmap = colorMap(keys, theme, spec.colors);
  const hl = spec.highlight === undefined ? null : new Set([].concat(spec.highlight).map(String));
  const focus = (p) => !hl || hl.has(p.name) || hl.has(p.k);
  const colorOf = (p) => (!focus(p) ? theme.dim : series ? cmap.get(p.k) : theme.categorical[0]);

  const fx = makeFormat(spec.xFormat, locale, pts.map((p) => p.x));
  const fy = makeFormat(spec.yFormat ?? spec.format, locale, pts.map((p) => p.y));
  const fs = size ? makeFormat(spec.sizeFormat, locale, pts.map((p) => p.s)) : null;

  const legend = series && keys.length > 1 && spec.legend !== false ? keys.map((k) => ({ label: k, color: cmap.get(k) })) : [];
  const frame = createFrame(spec, theme, { height: 460 });
  const area = frame.layout(legend);

  const xLog = spec.xScale === 'log', yLog = spec.yScale === 'log';
  const ex = [Math.min(...pts.map((p) => p.x)), Math.max(...pts.map((p) => p.x))];
  const ey = [Math.min(...pts.map((p) => p.y)), Math.max(...pts.map((p) => p.y))];
  if (spec.xDomain) ex.splice(0, 2, ...spec.xDomain);
  if (spec.yDomain) ey.splice(0, 2, ...spec.yDomain);
  const dx = xLog ? logDomain(...ex) : spec.xDomain ? { min: ex[0], max: ex[1], step: niceStep(ex[1] - ex[0], Math.max(3, Math.round(area.w / 110))) } : niceDomain(ex[0], ex[1], Math.max(3, Math.round(area.w / 110)));
  const dy = yLog ? logDomain(...ey) : spec.yDomain ? { min: ey[0], max: ey[1], step: niceStep(ey[1] - ey[0], Math.max(3, Math.round(area.h / 70))) } : niceDomain(ey[0], ey[1], Math.max(3, Math.round(area.h / 70)));
  if (spec._domains) { spec._domains.x = [dx.min, dx.max]; spec._domains.y = [dy.min, dy.max]; }
  const ytf = yLog ? fy : fy.tick(dy.step);
  const xtf = xLog ? fx : fx.tick(dx.step);
  const yTicks = (yLog ? log(dy.min, dy.max, 0, 1) : linear(dy.min, dy.max, 0, 1)).ticks(dy.step);
  const leftM = yAxisMargin(yTicks, ytf, theme);
  const top = area.y + 18 + yAxisTop(theme);
  const inner = { x: area.x + leftM, y: top, w: area.w - leftM - 8, h: area.y + area.h - top - 44 };
  const maxS = Math.max(...pts.map((p) => p.s));
  const rMax = spec.maxRadius ?? Math.min(30, Math.max(12, Math.sqrt((inner.w * inner.h) / Math.max(1, pts.length)) / 3));
  // Las burbujas no se salen del área: margen interno del radio máximo.
  const bp = size ? rMax * 0.75 : 6;
  const xS = (xLog ? log : linear)(dx.min, dx.max, inner.x + bp, inner.x + inner.w - bp);
  const yS = (yLog ? log : linear)(dy.min, dy.max, inner.y + inner.h - bp, inner.y + bp);
  const rOf = (p) => (size ? Math.max(2.5, Math.sqrt(Math.max(0, p.s) / (maxS || 1)) * rMax) : spec.radius ?? (pts.length > 300 ? 3 : 5));

  const body = [];
  body.push(yGrid(yS.ticks(dy.step), yS, inner, theme, { baseline: NaN }));
  body.push(gridX(xS.ticks(dx.step), xS, inner, theme, xtf, { baseline: NaN }));
  body.push(el('line', { x1: inner.x, x2: inner.x + inner.w, y1: inner.y + inner.h + 0.5, y2: inner.y + inner.h + 0.5, stroke: theme.axis }));
  // Títulos de ejes: horizontales, nunca rotados.
  body.push(text(area.x, area.y + 10, spec.yLabel ?? humanize(y), { fill: theme.lede, fontSize: SIZES.axis, fontWeight: 500 }));
  body.push(text(inner.x + inner.w, inner.y + inner.h + 40, spec.xLabel ?? humanize(x), { fill: theme.lede, fontSize: SIZES.axis, fontWeight: 500, textAnchor: 'end' }));

  // Tendencia lineal (mínimos cuadrados)
  if (spec.trend) {
    const tx = pts.map((p) => (xLog ? Math.log10(p.x) : p.x)), ty = pts.map((p) => (yLog ? Math.log10(p.y) : p.y));
    const n = tx.length, mx = tx.reduce((a, b) => a + b, 0) / n, my = ty.reduce((a, b) => a + b, 0) / n;
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < n; i++) { sxy += (tx[i] - mx) * (ty[i] - my); sxx += (tx[i] - mx) ** 2; syy += (ty[i] - my) ** 2; }
    const b = sxy / (sxx || 1), a = my - b * mx;
    const r2v = sxx && syy ? (sxy * sxy) / (sxx * syy) : 0;
    const lx0 = xLog ? Math.log10(dx.min) : dx.min, lx1 = xLog ? Math.log10(dx.max) : dx.max;
    const P = (lx) => [xS(xLog ? 10 ** lx : lx), yS(yLog ? 10 ** (a + b * lx) : a + b * lx)];
    const [ax, ay] = P(lx0), [bx, by] = P(lx1);
    body.push(el('clipPath', { id: 'pa-clip-trend' }, el('rect', { x: inner.x, y: inner.y, width: inner.w, height: inner.h })));
    body.push(el('line', { x1: ax, y1: ay, x2: bx, y2: by, stroke: theme.ink, strokeWidth: 1.5, opacity: 0.55, clipPath: 'url(#pa-clip-trend)' }));
    body.push(text(inner.x + inner.w - 4, inner.y + 12, `R² = ${r2v.toFixed(2).replace('.', String(locale).startsWith('en') ? '.' : ',')}`, { fill: theme.lede, fontSize: 11.5, textAnchor: 'end', stroke: theme.surface, strokeWidth: 3, paintOrder: 'stroke' }));
  }
  body.push(refLinesY(spec.refLines || [], yS, inner, theme, fy));
  body.push(refLinesX(spec.refLines || [], xS, inner, theme, fx));

  // Burbujas grandes debajo, chicas arriba; anillo del color de fondo.
  const sorted = [...pts].sort((a, b) => (focus(a) - focus(b)) || b.s - a.s);
  const circles = sorted.map((p) => {
    const lines = [p.name || '', `${humanize(x)}: ${fx(p.x)}`, `${humanize(y)}: ${fy(p.y)}`];
    if (size) lines.push(`${humanize(size)}: ${fs(p.s)}`);
    if (series) lines.splice(1, 0, p.k);
    return { class: 'pa-m', cx: xS(p.x), cy: yS(p.y), r: rOf(p), fill: colorOf(p), fillOpacity: size ? 0.78 : 0.9, stroke: theme.surface, strokeWidth: size ? 1.5 : pts.length > 400 ? 1 : 2, 'data-tip': tip(...lines) };
  });
  body.push(dotLayer(circles));

  body.push(yTickLabels(yS.ticks(dy.step), yS, inner, theme, ytf));

  // Etiquetas selectivas: las que pide el agente o las N mayores.
  if (labelF && spec.labels !== false) {
    let chosen;
    if (Array.isArray(spec.labels)) chosen = pts.filter((p) => spec.labels.map(String).includes(p.name));
    else {
      const n = typeof spec.labels === 'number' ? spec.labels : hl ? 0 : Math.min(6, pts.length);
      chosen = [...pts].sort((a, b) => (size ? b.s - a.s : b.y - a.y)).slice(0, n);
      if (hl) chosen = chosen.concat(pts.filter((p) => hl.has(p.name)));
    }
    const placed = [];
    for (const p of chosen) {
      if (!p.name) continue;
      const w = measure(p.name, 12, 500);
      const r = rOf(p);
      let lx = xS(p.x) + r + 4, ly = yS(p.y) + 4, anchor = 'start';
      if (lx + w > inner.x + inner.w) { lx = xS(p.x) - r - 4; anchor = 'end'; }
      const box = anchor === 'start' ? [lx, ly - 11, lx + w, ly + 3] : [lx - w, ly - 11, lx, ly + 3];
      if (placed.some((b) => !(box[2] < b[0] || box[0] > b[2] || box[3] < b[1] || box[1] > b[3]))) continue;
      placed.push(box);
      body.push(el('text', { x: lx, y: ly, fill: theme.ink, fontSize: 12, fontWeight: 500, textAnchor: anchor, stroke: theme.surface, strokeWidth: 3, paintOrder: 'stroke', strokeLinejoin: 'round' }, p.name.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])));
    }
  }

  const en = String(locale).startsWith('en');
  const desc = en
    ? `Scatter plot of ${humanize(y)} vs ${humanize(x)} with ${pts.length} points.`
    : `Gráfico de dispersión de ${humanize(y)} versus ${humanize(x)} con ${pts.length} puntos.`;
  return frame.finish(g({}, body), { desc, type: size ? 'bubble' : 'scatter' });
}
