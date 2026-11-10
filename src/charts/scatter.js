// Dispersión y burbujas: relación entre dos variables numéricas, con tamaño
// opcional (área proporcional), escalas log y línea de tendencia.
import { tipper } from '../tooltip.js';
import { el, g, text, tip, dotLayer } from '../svg.js';
import { measure } from '../text.js';
import { makeFormat } from '../format.js';
import { niceDomain, niceStep, linear, log, logDomain } from '../scale.js';
import { colorMap } from '../theme.js';
import { ensureData, requireField, uniq, num, fieldsOf, fieldKind, humanize, PlotError } from '../data.js';
import { gridY, gridX, ticksWidth, refLinesY, refLinesX, yAxisMargin, yAxisTop, yGrid, yTickLabels, quietCorner, isInside } from '../axes.js';
import { createFrame, SIZES, hash } from '../frame.js';
import { extent } from '../stats.js';
import { ctx } from '../context.js';

/** Muestra pareja de ~n filas (inferir tipos de campo sin recorrer 50 mil filas). */
const sampleRows = (data, n = 200) => (data.length <= n ? data : Array.from({ length: n }, (_, i) => data[Math.floor((i * (data.length - 1)) / (n - 1))]));

export function scatter(spec, theme) {
  const data = ensureData(spec);
  const fields = fieldsOf(data);
  const sample = sampleRows(data);
  const kinds = new Map();
  const kindOf = (f) => { if (!kinds.has(f)) kinds.set(f, fieldKind(sample, f)); return kinds.get(f); };
  const numeric = spec.x && spec.y ? [] : fields.filter((f) => kindOf(f) === 'number' || kindOf(f) === 'year');
  const x = spec.x || numeric[0];
  const y = spec.y || numeric.find((f) => f !== x);
  const size = spec.size;
  const series = spec.series ?? spec.hue ?? spec.color;
  const labelF = spec.label ?? fields.find((f) => kindOf(f) === 'category' && f !== series);
  requireField(data, x, 'x');
  requireField(data, y, 'y');
  if (size) requireField(data, size, 'size');
  if (series) requireField(data, series, 'series');
  const locale = spec.locale || 'es';
  const en = String(locale).startsWith('en');
  const xLog = spec.xScale === 'log', yLog = spec.yScale === 'log';

  // En escala log, los valores ≤ 0 no tienen posición: se omiten.
  const pts = data
    .map((r) => ({ r, x: num(r[x]), y: num(r[y]), s: size ? num(r[size]) : 1, k: series ? String(r[series]) : '', name: labelF ? String(r[labelF] ?? '') : '' }))
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y) && (!xLog || p.x > 0) && (!yLog || p.y > 0));
  if (!pts.length) {
    const which = !data.some((r) => Number.isFinite(num(r[x]))) ? x : y;
    const logNote = xLog || yLog ? (en ? ' (on a log scale only values > 0 count)' : ' (en escala log solo cuentan valores > 0)') : '';
    throw new PlotError(
      en ? `No points to plot: \`${which}\` has no numeric values${logNote}.` : `No hay puntos para graficar: \`${which}\` no tiene valores numéricos${logNote}.`,
      en ? `Use numeric fields for x and y, e.g. x: "gdp", y: "life_expectancy". Fields: ${fields.join(', ')}.` : `Usa campos numéricos en x e y, p. ej. x: "pib", y: "esperanza_vida". Campos: ${fields.join(', ')}.`
    );
  }
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

  const ex = extent(pts.map((p) => p.x));
  const ey = extent(pts.map((p) => p.y));
  if (spec.xDomain) ex.splice(0, 2, ...spec.xDomain);
  if (spec.yDomain) ey.splice(0, 2, ...spec.yDomain);
  const dx = xLog ? logDomain(...ex) : spec.xDomain ? { min: ex[0], max: ex[1], step: niceStep(ex[1] - ex[0], Math.max(3, Math.round(area.w / 110))) } : niceDomain(ex[0], ex[1], Math.max(3, Math.round(area.w / 110)));
  const dy = yLog ? logDomain(...ey) : spec.yDomain ? { min: ey[0], max: ey[1], step: niceStep(ey[1] - ey[0], Math.max(3, Math.round(area.h / 70))) } : niceDomain(ey[0], ey[1], Math.max(3, Math.round(area.h / 70)));
  if (spec._domains) { spec._domains.x = [dx.min, dx.max]; spec._domains.y = [dy.min, dy.max]; }
  const yTicks = (yLog ? log(dy.min, dy.max, 0, 1) : linear(dy.min, dy.max, 0, 1)).ticks(dy.step);
  const ytf = yLog ? fy : fy.tick(dy.step, yTicks);
  const xtf = xLog ? fx : fx.tick(dx.step, linear(dx.min, dx.max, 0, 1).ticks(dx.step));
  const leftM = yAxisMargin(yTicks, ytf, theme);
  const top = area.y + 18 + yAxisTop(theme);
  const inner = { x: area.x + leftM, y: top, w: area.w - leftM - 8, h: area.y + area.h - top - 44 };
  const maxS = extent(pts.map((p) => p.s))[1];
  const rMax = spec.maxRadius ?? Math.min(30, Math.max(12, Math.sqrt((inner.w * inner.h) / Math.max(1, pts.length)) / 3));
  // Las burbujas no se salen del área: margen interno del radio máximo.
  const bp = size ? rMax * 0.75 : 6;
  const yS = (yLog ? log : linear)(dy.min, dy.max, inner.y + inner.h - bp, inner.y + bp);
  const rOf = (p) => (size ? Math.max(2.5, Math.sqrt(Math.max(0, p.s) / (maxS || 1)) * rMax) : spec.radius ?? (pts.length > 300 ? 3 : 5));
  // Eje y por dentro: si un punto pegado a la izquierda choca con una etiqueta
  // de marca, el rango x arranca pasado la etiqueta más ancha.
  let xPad = 0;
  if (isInside(theme, undefined) && !spec.xDomain) {
    const axisSize = SIZES.axis;
    const kk = 5 * Math.max(1, ctx.textScale * 0.8);
    const yT = yS.ticks(dy.step);
    const boxes = yT.map((t) => { const base = Math.round(yS(t)) + 0.5 - kk; return { w: ticksWidth([t], ytf, theme.type?.axis ?? axisSize), y0: base - (theme.type?.axis ?? axisSize) * 0.75, y1: base + 1 }; });
    const xS0 = (xLog ? log : linear)(dx.min, dx.max, inner.x + bp, inner.x + inner.w - bp);
    const wMax = Math.max(0, ...boxes.map((b) => b.w));
    for (const p of pts) {
      const r = rOf(p), px = xS0(p.x);
      if (px - r > inner.x + wMax + 1) continue;
      const py = yS(p.y);
      if (boxes.some((b) => px - r < inner.x + b.w + 1 && py + r > b.y0 && py - r < b.y1)) { xPad = Math.min(Math.max(0, wMax + 6 - bp + r), inner.w * 0.2); if (xPad >= inner.w * 0.2) break; }
    }
  }
  const xS = (xLog ? log : linear)(dx.min, dx.max, inner.x + bp + xPad, inner.x + inner.w - bp);

  const body = [];
  body.push(yGrid(yS.ticks(dy.step), yS, inner, theme, { baseline: NaN }));
  body.push(gridX(xS.ticks(dx.step), xS, inner, theme, xtf, { baseline: NaN }));
  body.push(el('line', { x1: inner.x, x2: inner.x + inner.w, y1: inner.y + inner.h + 0.5, y2: inner.y + inner.h + 0.5, stroke: theme.axis }));
  // Títulos de ejes: horizontales, nunca rotados.
  body.push(text(area.x, area.y + 10, spec.yLabel ?? humanize(y), { fill: theme.lede, fontSize: SIZES.axis, fontWeight: 500 }));
  body.push(text(inner.x + inner.w, inner.y + inner.h + 40, spec.xLabel ?? humanize(x), { fill: theme.lede, fontSize: SIZES.axis, fontWeight: 500, textAnchor: 'end' }));

  const taken = []; // zonas ocupadas por rótulos (R²), para la clave de tamaños
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
    // id único por gráfico: varios SVG en una página no comparten el recorte.
    const clipId = 'pa-clip-trend-' + Math.abs(hash(String(spec.title) + x + y + inner.w + pts.length)).toString(36);
    body.push(el('clipPath', { id: clipId }, el('rect', { x: inner.x, y: inner.y, width: inner.w, height: inner.h })));
    body.push(el('line', { x1: ax, y1: ay, x2: bx, y2: by, stroke: theme.ink, strokeWidth: 1.5, opacity: 0.55, clipPath: `url(#${clipId})` }));
    const r2s = `R² = ${r2v.toFixed(2).replace('.', String(locale).startsWith('en') ? '.' : ',')}`;
    const occ = pts.map((p) => [xS(p.x), yS(p.y)]);
    for (let i = 0; i <= 24; i++) occ.push([ax + ((bx - ax) * i) / 24, ay + ((by - ay) * i) / 24]);
    const qc = quietCorner(occ, inner, measure(r2s, 11.5) + 4, 16);
    const r2w = measure(r2s, 11.5) + 4, r2x0 = qc.anchor === 'end' ? qc.x - r2w : qc.x;
    for (let i = 0; i <= 8; i++) for (const dy of [-12, -6, 0]) taken.push([r2x0 + (r2w * i) / 8, qc.y + dy]);
    body.push(text(qc.x, qc.y, r2s, { fill: theme.lede, fontSize: 11.5, textAnchor: qc.anchor, stroke: theme.surface, strokeWidth: 3, paintOrder: 'stroke' }));
  }
  body.push(refLinesY(spec.refLines || [], yS, inner, theme, fy));
  body.push(refLinesX(spec.refLines || [], xS, inner, theme, fx));

  // Burbujas grandes debajo, chicas arriba; anillo del color de fondo.
  const sorted = [...pts].sort((a, b) => (focus(a) - focus(b)) || b.s - a.s);
  // Tooltips: la capa densa guarda a lo más MAX_TIPS; no se arman los que se descartan.
  const MAX_TIPS = 20000;
  const hx = humanize(x), hy = humanize(y), hs = size ? humanize(size) : '';
  // Con xDomain/yDomain, los puntos fuera del rango no se dibujan fuera del área.
  const vis = (p) => { const cx = xS(p.x), cy = yS(p.y); return cx >= inner.x - 1 && cx <= inner.x + inner.w + 1 && cy >= inner.y - 1 && cy <= inner.y + inner.h + 1; };
  const TT = tipper(spec, null, locale);
  const circles = sorted.filter(vis).map((p, i) => {
    let t = '';
    if (i < MAX_TIPS || sorted.length <= 1500) {
      const lines = [p.name || '', `${hx}: ${fx(p.x)}`, `${hy}: ${fy(p.y)}`];
      if (size) lines.push(`${hs}: ${fs(p.s)}`);
      if (series) lines.splice(1, 0, p.k);
      t = TT([p.r], ...lines);
    }
    // `hollow: "campo"` (o `filled`): un punto hueco es el mismo color en el borde,
    // con el fondo adentro — una segunda codificación sin un segundo color.
    const hollow = spec.hollow ? !!p.r[spec.hollow] : spec.filled ? !p.r[spec.filled] : false;
    if (hollow) return { class: 'pa-m', cx: xS(p.x), cy: yS(p.y), r: Math.max(2, rOf(p) - 0.75), fill: theme.surface, fillOpacity: 1, stroke: colorOf(p), strokeWidth: 1.5, 'data-tip': t, 'data-href': spec.href ? p.r[spec.href] : undefined };
    return { class: 'pa-m', cx: xS(p.x), cy: yS(p.y), r: rOf(p), fill: colorOf(p), fillOpacity: size ? 0.78 : 0.9, stroke: theme.surface, strokeWidth: size ? 1.5 : pts.length > 400 ? 1 : 2, 'data-tip': t, 'data-href': spec.href ? p.r[spec.href] : undefined };
  });
  body.push(dotLayer(circles, { maxTips: MAX_TIPS }));

  // Clave de tamaños (burbujas): 2–3 círculos de referencia anidados en una esquina libre.
  if (size && spec.sizeKey !== false && maxS > 0) {
    const nice = (v) => { const e = 10 ** Math.floor(Math.log10(v)); const m = v / e; return (m >= 5 ? 5 : m >= 2 ? 2 : 1) * e; };
    const v1 = nice(maxS);
    const vals = [v1, nice(v1 / 4), nice(v1 / 16)].filter((v, i, a) => a.indexOf(v) === i && Math.sqrt(v / maxS) * rMax >= 4);
    if (vals.length >= 2) {
      const radii = vals.map((v) => Math.sqrt(v / maxS) * rMax);
      const R = radii[0];
      const labs = vals.map((v) => fs(v));
      const lw = Math.max(...labs.map((l) => measure(l, 10.5)));
      const kw = 2 * R + 8 + lw, kh = 2 * R + 16;
      const occ = sorted.map((p) => [xS(p.x), yS(p.y)]);
      // Lo ya ocupado (R²) pesa como muchos puntos: la clave nunca lo tapa.
      for (const q of taken) for (let i = 0; i < 50; i++) occ.push(q);
      const qc = quietCorner(occ, inner, kw, kh);
      const left = qc.anchor === 'end' ? qc.x - kw : qc.x;
      const y0 = qc.y - kh + 3; // borde superior de la caja elegida
      const cx = left + R, cy0 = y0 + kh - 1;
      const parts = [text(left, y0 + 10, hs, { fill: theme.muted, fontSize: 10.5, fontWeight: 500 })];
      let prevY = -Infinity;
      radii.forEach((r, i) => {
        const top = cy0 - 2 * r;
        const ly = Math.max(top, prevY + 11); // rótulos separados aunque los círculos se acerquen
        prevY = ly;
        parts.push(el('circle', { cx, cy: cy0 - r, r, fill: 'none', stroke: theme.muted, strokeWidth: 1, opacity: 0.8 }));
        parts.push(el('path', { d: `M${cx.toFixed(1)},${top.toFixed(1)}H${(cx + R + 1).toFixed(1)}L${(cx + R + 4).toFixed(1)},${ly.toFixed(1)}`, fill: 'none', stroke: theme.muted, strokeWidth: 0.75, opacity: 0.6 }));
        parts.push(text(cx + R + 6, ly + 3.5, labs[i], { fill: theme.muted, fontSize: 10.5 }));
      });
      body.push(g({ class: 'pa-sizekey' }, parts));
    }
  }

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
      if (!p.name || !vis(p)) continue;
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

  const desc = en
    ? `Scatter plot of ${humanize(y)} vs ${humanize(x)} with ${pts.length} points.`
    : `Gráfico de dispersión de ${humanize(y)} versus ${humanize(x)} con ${pts.length} puntos.`;
  return frame.finish(g({}, body), { desc, type: size ? 'bubble' : 'scatter' });
}
