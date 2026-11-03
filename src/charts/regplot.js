// Regresión al estilo seaborn: regplot / lmplot (puntos + ajuste + banda de
// confianza), residplot (residuos) y jointplot (dispersión con marginales).
import { el, g, text, tip, esc, barPath, dotLayer } from '../svg.js';
import { measure } from '../text.js';
import { makeFormat, formatNumber } from '../format.js';
import { colorMap } from '../theme.js';
import { ensureData, requireField, num, fieldsOf, fieldKind, uniq, humanize } from '../data.js';
import { yAxisMargin, yAxisTop, yGrid, yTickLabels, gridX } from '../axes.js';
import { createFrame } from '../frame.js';
import { polyfit, lowess, histogram, kde as kdeEst } from '../stats.js';
import { hueField, axisDomain, tickFmt, axisTitles } from './dist.js';

const EN = (spec) => String(spec.locale || 'es').startsWith('en');
const halo = (theme) => ({ stroke: theme.surface, strokeWidth: 3, paintOrder: 'stroke', strokeLinejoin: 'round' });
const dec = (v, locale, d = 2) => formatNumber(v, d, locale);

/** Lee puntos (x, y, grupo, nombre) válidos para escalas log si corresponde. */
function readPoints(spec, data, { needY = true } = {}) {
  const fields = fieldsOf(data);
  const numeric = fields.filter((f) => ['number', 'year'].includes(fieldKind(data, f)));
  const x = spec.x || numeric[0];
  const y = spec.y || numeric.find((f) => f !== x);
  requireField(data, x, 'x');
  if (needY) requireField(data, y, 'y');
  const hue = hueField(spec);
  if (hue) requireField(data, hue, 'hue');
  const labelF = spec.label ?? null;
  if (labelF) requireField(data, labelF, 'label');
  const xLog = spec.xScale === 'log' || (spec.logx && spec.xScale === undefined);
  const yLog = spec.yScale === 'log';
  const pts = data
    .map((r) => ({ x: num(r[x]), y: num(r[y]), k: hue ? String(r[hue]) : '', name: labelF ? String(r[labelF] ?? '') : '' }))
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y) && (!xLog || p.x > 0) && (!yLog || p.y > 0));
  const keys = hue ? uniq(pts.map((p) => p.k)) : [''];
  return { x, y, hue, labelF, pts, keys, xLog, yLog };
}

/** Ajuste de un grupo: devuelve { line: [[x,y]], band: [[x,lo,hi]] | null, r2, n }. */
function fitGroup(gp, spec, { xLog, xMin, xMax, steps = 90 }) {
  const fx = (v) => (spec.logx ? Math.log10(v) : v);
  const xs = gp.map((p) => fx(p.x)), ys = gp.map((p) => p.y);
  const lo = spec.truncate === false ? xMin : Math.min(...gp.map((p) => p.x));
  const hi = spec.truncate === false ? xMax : Math.max(...gp.map((p) => p.x));
  const grid = Array.from({ length: steps }, (_, i) => {
    const t = i / (steps - 1);
    return xLog ? 10 ** (Math.log10(lo) + (Math.log10(hi) - Math.log10(lo)) * t) : lo + (hi - lo) * t;
  });
  if (spec.lowess) {
    const lw = lowess(xs, ys, { frac: spec.frac ?? 2 / 3 });
    const pts = lw.map(([t, v]) => [spec.logx ? 10 ** t : t, v]);
    return { line: pts, band: null, r2: null, n: gp.length };
  }
  const fit = polyfit(xs, ys, { order: spec.order ?? 1, level: (spec.ci ?? 95) / 100 });
  const line = grid.map((v) => [v, fit.predict(fx(v))]);
  const band = spec.ci === false || spec.ci === null || gp.length < (spec.order ?? 1) + 3 ? null : grid.map((v) => [v, ...fit.band(fx(v))]);
  return { line, band, r2: fit.r2, n: fit.n, fit };
}

// ── regplot / lmplot ───────────────────────────────────────────────────────

/**
 * Dispersión con recta (o polinomio / LOWESS) ajustada y banda de confianza.
 * Opciones: x, y, hue, ci (95 | false), order, lowess, logx, truncate (true),
 * scatter (true), annotate, label + labels, xScale/yScale 'log', xDomain, yDomain.
 */
export function regplot(spec, theme) {
  const data = ensureData(spec);
  const P = readPoints(spec, data);
  const { pts, keys, xLog, yLog } = P;
  const en = EN(spec);
  const locale = spec.locale || 'es';
  const K = keys.length;
  const cmap = colorMap(keys, theme, spec.colors);
  const hl = spec.highlight === undefined ? null : new Set([].concat(spec.highlight).map(String));
  const focusKey = (k) => !hl || hl.has(k);
  const colorOf = (k) => (!focusKey(k) ? theme.dim : K === 1 ? (spec.colors && spec.colors[k]) || theme.categorical[0] : cmap.get(k));
  const legend = K > 1 && spec.legend !== false ? keys.map((k) => ({ label: k, color: colorOf(k) })) : [];
  const frame = createFrame(spec, theme, { height: 440 });
  const area = frame.layout(legend);
  const M = theme.marks || {};

  const xAx0 = axisDomain(pts.map((p) => p.x), { type: xLog ? 'log' : undefined, domain: spec.xDomain, nice: 'tight', count: Math.max(3, Math.round(area.w / 110)) });
  const fits = keys.map((k) => fitGroup(pts.filter((p) => p.k === k), spec, { xLog, xMin: xAx0.min, xMax: xAx0.max }));
  const yVals = pts.map((p) => p.y).concat(fits.flatMap((f) => f.line.map((q) => q[1])));
  const fx = makeFormat(spec.xFormat, locale, pts.map((p) => p.x));
  const fy = makeFormat(spec.yFormat ?? spec.format, locale, pts.map((p) => p.y));
  const yAx = axisDomain(yVals.filter((v) => !yLog || v > 0), { type: yLog ? 'log' : undefined, domain: spec.yDomain, nice: 'tight', count: Math.max(3, Math.round(area.h / 64)) });
  const yt = tickFmt(fy, yAx);
  const leftM = yAxisMargin(yAx.ticks, yt, theme);

  // Etiquetas al final de cada recta cuando hay grupos.
  const endLabels = K > 1 && spec.labels !== false && spec.endLabels !== false;
  const endText = (k, f) => (spec.annotate && f.r2 !== null ? `${k} · R² ${dec(f.r2, locale)}` : k);
  const endW = endLabels ? Math.max(...keys.map((k, i) => measure(endText(k, fits[i]), 12, 600))) + 12 : 0;
  const top = 18 + yAxisTop(theme);
  const r = spec.radius ?? (pts.length > 400 ? 2.5 : pts.length > 120 ? 3.25 : M.pointRadius ?? 4);
  const inner = { x: area.x + leftM, y: area.y + top, w: area.w - leftM - endW - 4, h: area.h - top - 44 };
  const pad = r + 2;
  const xS = xAx0.scale(inner.x + pad, inner.x + inner.w - pad);
  const yS = yAx.scale(inner.y + inner.h - pad, inner.y + pad);
  if (spec._domains && typeof spec._domains === 'object') { spec._domains.x = [xAx0.min, xAx0.max]; spec._domains.y = [yAx.min, yAx.max]; }
  const clipId = 'pa-clip-reg-' + Math.abs(hashStr((spec.title || '') + inner.w + K)).toString(36);

  const body = [];
  body.push(el('clipPath', { id: clipId }, el('rect', { x: inner.x, y: inner.y, width: inner.w, height: inner.h })));
  body.push(yGrid(yAx.ticks, yS, inner, theme, { baseline: NaN }));
  body.push(el('line', { x1: inner.x, x2: inner.x + inner.w, y1: inner.y + inner.h + 0.5, y2: inner.y + inner.h + 0.5, stroke: theme.axis }));

  const L = (arr) => arr.map(([a, b], i) => `${i ? 'L' : 'M'}${xS(a).toFixed(2)},${yS(Math.max(yLog ? 1e-12 : -Infinity, b)).toFixed(2)}`).join('');
  // Bandas primero, luego puntos, luego rectas encima.
  keys.forEach((k, i) => {
    const f = fits[i];
    if (!f.band || !focusKey(k)) return;
    const upper = f.band.map(([x, , hi]) => [x, hi]);
    const lower = f.band.map(([x, lo]) => [x, lo]).reverse();
    body.push(el('path', { d: L(upper) + 'L' + L(lower).slice(1) + 'Z', fill: colorOf(k), fillOpacity: M.bandOpacity ?? 0.16, clipPath: `url(#${clipId})` }));
  });
  if (spec.scatter !== false) {
    const order = [...pts].sort((a, b) => (focusKey(a.k) ? 1 : 0) - (focusKey(b.k) ? 1 : 0));
    const dots = order.map((p) => ({
      class: 'pa-m', cx: xS(p.x), cy: yS(p.y), r, fill: colorOf(p.k), fillOpacity: K === 1 ? (M.dotOpacity ?? 0.85) * 0.75 : M.dotOpacity ?? 0.85,
      stroke: pts.length > 400 ? 'none' : theme.surface, strokeWidth: 1.25,
      'data-tip': tip(p.name || p.k || '', `${humanize(P.x)}: ${fx(p.x)}`, `${humanize(P.y)}: ${fy(p.y)}`, p.name && p.k ? p.k : ''),
    }));
    body.push(g({ class: 'pa-points' }, dotLayer(dots)));
  }
  const ends = [];
  keys.forEach((k, i) => {
    const f = fits[i];
    const c = K === 1 && spec.scatter !== false ? theme.ink : colorOf(k);
    const stats = f.r2 !== null ? `R² = ${dec(f.r2, locale)} · n = ${formatNumber(f.n, 0, locale)}` : `n = ${formatNumber(f.n, 0, locale)}`;
    body.push(g({ class: 'pa-m', 'data-tip': tip(k || (en ? 'Fit' : 'Ajuste'), spec.lowess ? 'LOWESS' : (spec.order ?? 1) > 1 ? (en ? `Polynomial (order ${spec.order})` : `Polinomio (orden ${spec.order})`) : en ? 'Linear fit' : 'Ajuste lineal', stats) }, [
      el('path', { d: L(f.line), fill: 'none', stroke: 'transparent', strokeWidth: 12, clipPath: `url(#${clipId})` }),
      el('path', { d: L(f.line), fill: 'none', stroke: c, strokeWidth: focusKey(k) ? (M.lineWidth ?? 2) + 0.25 : 1.5, strokeLinecap: 'round', strokeLinejoin: 'round', opacity: K === 1 ? 0.9 : 1, clipPath: `url(#${clipId})` }),
    ]));
    const last = f.line[f.line.length - 1];
    if (endLabels && focusKey(k)) ends.push({ k, y: yS(last[1]), y0: yS(last[1]), x: xS(last[0]) + 8, t: endText(k, f) });
  });
  // Etiquetas finales: separación mínima de 14 px, con línea guía si se mueven.
  ends.sort((a, b) => a.y - b.y);
  for (let it = 0; it < 30; it++) for (let i = 1; i < ends.length; i++) { const d = ends[i].y - ends[i - 1].y; if (d < 14) { const s = (14 - d) / 2; ends[i].y += s; ends[i - 1].y -= s; } }
  for (const e of ends) {
    const lx = inner.x + inner.w + 6;
    if (Math.abs(e.y - e.y0) > 2 || e.x < lx - 10) body.push(el('path', { d: `M${(e.x - 6).toFixed(1)},${e.y0.toFixed(1)}L${(lx - 2).toFixed(1)},${e.y.toFixed(1)}`, stroke: theme.muted, strokeWidth: 0.75, fill: 'none' }));
    body.push(text(lx, e.y + 4, e.t, { fill: theme.ink, fontSize: 12, fontWeight: 600 }));
  }
  // Rótulos de puntos seleccionados.
  body.push(pointLabels(pts, spec, xS, yS, r, inner, theme, P));
  // Resumen discreto (un solo grupo).
  if (spec.annotate && K === 1 && fits[0].r2 !== null) {
    const s = `R² = ${dec(fits[0].r2, locale)} · n = ${formatNumber(fits[0].n, 0, locale)}`;
    body.push(text(inner.x + inner.w - 4, inner.y + 12, s, { fill: theme.lede, fontSize: 12, textAnchor: 'end', ...halo(theme) }));
  }
  body.push(gridX(xAx0.ticks, xS, inner, theme, tickFmt(fx, xAx0), { lines: false }));
  body.push(yTickLabels(yAx.ticks, yS, inner, theme, yt));
  axisTitles(body, theme, area, inner, { x: spec.xLabel ?? humanize(P.x), y: spec.yLabel === false ? null : spec.yLabel ?? humanize(P.y) });

  const desc = describeFits(keys, fits, P, en, locale, spec);
  return frame.finish(body, { desc, type: 'regplot' });
}

function describeFits(keys, fits, P, en, locale, spec) {
  const what = `${humanize(P.y).toLowerCase()} ${en ? 'vs' : 'versus'} ${humanize(P.x).toLowerCase()}`;
  const parts = keys.map((k, i) => {
    const f = fits[i];
    const first = f.line[0][1], last = f.line[f.line.length - 1][1];
    const dir = last > first ? (en ? 'rises' : 'sube') : (en ? 'falls' : 'baja');
    const r2 = f.r2 !== null ? `, R² ${dec(f.r2, locale)}` : '';
    return `${k ? k + ': ' : ''}${en ? 'the fit' : 'el ajuste'} ${dir}${r2}`;
  });
  const kind = spec.lowess ? 'LOWESS' : (spec.order ?? 1) > 1 ? (en ? 'polynomial' : 'polinomial') : en ? 'linear' : 'lineal';
  return en
    ? `Regression plot of ${what} with ${P.pts.length} points and a ${kind} fit. ${parts.join('; ')}.`
    : `Gráfico de regresión de ${what} con ${formatNumber(P.pts.length, 0, locale)} puntos y ajuste ${kind}. ${parts.join('; ')}.`;
}

function pointLabels(pts, spec, xS, yS, r, inner, theme, P) {
  if (!P.labelF || spec.labels === false || spec.labels === undefined) return '';
  let chosen;
  if (Array.isArray(spec.labels)) chosen = pts.filter((p) => spec.labels.map(String).includes(p.name));
  else if (typeof spec.labels === 'number') chosen = [...pts].sort((a, b) => b.y - a.y).slice(0, spec.labels);
  else return '';
  const placed = [];
  const out = [];
  for (const p of chosen) {
    if (!p.name) continue;
    const w = measure(p.name, 12, 500);
    let lx = xS(p.x) + r + 4, anchor = 'start';
    const ly = yS(p.y) + 4;
    if (lx + w > inner.x + inner.w) { lx = xS(p.x) - r - 4; anchor = 'end'; }
    const box = anchor === 'start' ? [lx, ly - 11, lx + w, ly + 3] : [lx - w, ly - 11, lx, ly + 3];
    if (placed.some((b) => !(box[2] < b[0] || box[0] > b[2] || box[3] < b[1] || box[1] > b[3]))) continue;
    placed.push(box);
    out.push(el('text', { x: lx, y: ly, fill: theme.ink, fontSize: 12, fontWeight: 500, textAnchor: anchor, ...halo(theme) }, esc(p.name)));
  }
  return g({ class: 'pa-labels' }, out);
}

// ── residplot ──────────────────────────────────────────────────────────────

/** Residuos de la regresión versus x, con línea en cero y suavizado opcional (lowess: true). */
export function residplot(spec, theme) {
  const data = ensureData(spec);
  const P = readPoints(spec, data);
  const en = EN(spec);
  const locale = spec.locale || 'es';
  const fxv = (v) => (spec.logx ? Math.log10(v) : v);
  const fit = polyfit(P.pts.map((p) => fxv(p.x)), P.pts.map((p) => p.y), { order: spec.order ?? 1 });
  const res = P.pts.map((p) => ({ ...p, r: p.y - fit.predict(fxv(p.x)) }));
  const frame = createFrame(spec, theme, { height: 340 });
  const area = frame.layout([]);
  const M = theme.marks || {};
  const fx = makeFormat(spec.xFormat, locale, res.map((p) => p.x));
  const fy = makeFormat(spec.yFormat ?? spec.format, locale, res.map((p) => p.r));
  const lim = Math.max(...res.map((p) => Math.abs(p.r))) || 1;
  const yAx = axisDomain([-lim, lim], { domain: spec.yDomain, count: Math.max(3, Math.round(area.h / 60)) });
  const yt = tickFmt(fy, yAx);
  const top = 18 + yAxisTop(theme);
  const inner = { x: area.x + yAxisMargin(yAx.ticks, yt, theme), y: area.y + top, w: 0, h: area.h - top - 44 };
  inner.w = area.x + area.w - inner.x - 4;
  const r = res.length > 300 ? 2.5 : M.pointRadius ?? 4;
  const xAx = axisDomain(res.map((p) => p.x), { type: P.xLog ? 'log' : undefined, domain: spec.xDomain, nice: 'tight', count: Math.max(3, Math.round(inner.w / 90)) });
  const xS = xAx.scale(inner.x + r + 2, inner.x + inner.w - r - 2);
  const yS = yAx.scale(inner.y + inner.h, inner.y);
  if (spec._domains && typeof spec._domains === 'object') { spec._domains.x = [xAx.min, xAx.max]; spec._domains.y = [yAx.min, yAx.max]; }
  const body = [yGrid(yAx.ticks, yS, inner, theme, { baseline: NaN })];
  const y0 = Math.round(yS(0)) + 0.5;
  body.push(el('line', { x1: inner.x, x2: inner.x + inner.w, y1: y0, y2: y0, stroke: theme.ink, strokeWidth: 1.25, opacity: 0.6 }));
  body.push(g({}, dotLayer(res.map((p) => ({ class: 'pa-m', cx: xS(p.x), cy: yS(p.r), r, fill: theme.categorical[0], fillOpacity: (M.dotOpacity ?? 0.85) * 0.8, stroke: theme.surface, strokeWidth: 1.25, 'data-tip': tip(p.name, `${humanize(P.x)}: ${fx(p.x)}`, `${en ? 'Residual' : 'Residuo'}: ${fy(p.r)}`) })))));
  if (spec.lowess) {
    const lw = lowess(res.map((p) => p.x), res.map((p) => p.r));
    body.push(el('path', { d: lw.map(([a, b], i) => `${i ? 'L' : 'M'}${xS(a).toFixed(2)},${yS(b).toFixed(2)}`).join(''), fill: 'none', stroke: theme.categorical[1], strokeWidth: M.lineWidth ?? 2 }));
  }
  body.push(gridX(xAx.ticks, xS, inner, theme, tickFmt(fx, xAx), { lines: false }));
  body.push(yTickLabels(yAx.ticks, yS, inner, theme, yt));
  axisTitles(body, theme, area, inner, { x: spec.xLabel ?? humanize(P.x), y: spec.yLabel === false ? null : spec.yLabel ?? (en ? 'Residual' : 'Residuo') });
  const sdv = Math.sqrt(res.reduce((a, p) => a + p.r * p.r, 0) / Math.max(1, res.length - 2));
  const desc = en ? `Residuals of ${humanize(P.y)} on ${humanize(P.x)} (${res.length} points). Residual standard error ${fy(sdv)}.` : `Residuos de ${humanize(P.y).toLowerCase()} sobre ${humanize(P.x).toLowerCase()} (${formatNumber(res.length, 0, locale)} puntos). Error estándar residual ${fy(sdv)}.`;
  return frame.finish(body, { desc, type: 'residplot' });
}

// ── jointplot ──────────────────────────────────────────────────────────────

/**
 * Dispersión central con distribuciones marginales arriba (x) y a la derecha (y).
 * Opciones: x, y, hue, kind ('scatter' | 'reg'), marginal ('hist' | 'kde'),
 * bins, ci, order, xScale/yScale 'log', xDomain, yDomain, label + labels.
 */
export function jointplot(spec, theme) {
  const data = ensureData(spec);
  const P = readPoints(spec, data);
  const { pts, keys, xLog, yLog } = P;
  const en = EN(spec);
  const locale = spec.locale || 'es';
  const K = keys.length;
  const cmap = colorMap(keys, theme, spec.colors);
  const colorOf = (k) => (K === 1 ? (spec.colors && spec.colors[k]) || theme.categorical[0] : cmap.get(k));
  const legend = K > 1 && spec.legend !== false ? keys.map((k) => ({ label: k, color: colorOf(k) })) : [];
  const frame = createFrame(spec, theme, { height: 520 });
  const area = frame.layout(legend);
  const M = theme.marks || {};
  const fx = makeFormat(spec.xFormat, locale, pts.map((p) => p.x));
  const fy = makeFormat(spec.yFormat ?? spec.format, locale, pts.map((p) => p.y));
  const xAx = axisDomain(pts.map((p) => p.x), { type: xLog ? 'log' : undefined, domain: spec.xDomain, nice: 'tight', count: Math.max(3, Math.round(area.w / 120)) });
  const yAx = axisDomain(pts.map((p) => p.y), { type: yLog ? 'log' : undefined, domain: spec.yDomain, nice: 'tight', count: Math.max(3, Math.round(area.h / 80)) });
  const yt = tickFmt(fy, yAx);
  const mH = Math.max(44, Math.min(90, area.h * 0.17));
  const gap = 6;
  const leftM = yAxisMargin(yAx.ticks, yt, theme);
  const topGap = gap + yAxisTop(theme);
  const inner = { x: area.x + leftM, y: area.y + 18 + mH + topGap, w: 0, h: 0 };
  inner.w = area.x + area.w - inner.x - mH - gap;
  inner.h = area.y + area.h - 44 - inner.y;
  const r = spec.radius ?? (pts.length > 400 ? 2.5 : pts.length > 120 ? 3.25 : M.pointRadius ?? 4);
  const xS = xAx.scale(inner.x + r + 2, inner.x + inner.w - r - 2);
  const yS = yAx.scale(inner.y + inner.h - r - 2, inner.y + r + 2);
  if (spec._domains && typeof spec._domains === 'object') { spec._domains.x = [xAx.min, xAx.max]; spec._domains.y = [yAx.min, yAx.max]; }
  const body = [yGrid(yAx.ticks, yS, inner, theme, { baseline: NaN })];
  body.push(el('line', { x1: inner.x, x2: inner.x + inner.w, y1: inner.y + inner.h + 0.5, y2: inner.y + inner.h + 0.5, stroke: theme.axis }));

  // Marginales: comparten bins / grilla en el espacio de la escala.
  const tx = (v) => (xLog ? Math.log10(v) : v), ty = (v) => (yLog ? Math.log10(v) : v);
  const ix = (t) => (xLog ? 10 ** t : t), iy = (t) => (yLog ? 10 ** t : t);
  const marginal = spec.marginal || 'hist';
  const groups = keys.map((k) => pts.filter((p) => p.k === k));
  const topBox = { x: inner.x, y: inner.y - topGap - mH, w: inner.w, h: mH };
  const rightBox = { x: inner.x + inner.w + gap, y: inner.y, w: mH, h: inner.h };
  const op = K > 1 ? 0.55 : 0.85;
  if (marginal === 'kde') {
    const ex = [tx(xAx.min), tx(xAx.max)], ey = [ty(yAx.min), ty(yAx.max)];
    const kx = groups.map((gp) => (gp.length > 1 ? kdeEst(gp.map((p) => tx(p.x)), { extent: ex, gridSize: 120 }).map(([t, d]) => [t, (d * gp.length) / pts.length]) : []));
    const ky = groups.map((gp) => (gp.length > 1 ? kdeEst(gp.map((p) => ty(p.y)), { extent: ey, gridSize: 120 }).map(([t, d]) => [t, (d * gp.length) / pts.length]) : []));
    const mx = Math.max(...kx.flat().map((p) => p[1]), 1e-12), my = Math.max(...ky.flat().map((p) => p[1]), 1e-12);
    kx.forEach((c, i) => {
      if (!c.length) return;
      const pth = c.map(([t, d], j) => `${j ? 'L' : 'M'}${xS(ix(t)).toFixed(2)},${(topBox.y + topBox.h - (d / mx) * topBox.h).toFixed(2)}`).join('');
      body.push(el('path', { d: `${pth}L${xS(ix(c[c.length - 1][0])).toFixed(2)},${topBox.y + topBox.h}L${xS(ix(c[0][0])).toFixed(2)},${topBox.y + topBox.h}Z`, fill: colorOf(keys[i]), fillOpacity: (M.areaOpacity ?? 0.12) * 1.5 }));
      body.push(el('path', { d: pth, fill: 'none', stroke: colorOf(keys[i]), strokeWidth: 1.75 }));
    });
    ky.forEach((c, i) => {
      if (!c.length) return;
      const pth = c.map(([t, d], j) => `${j ? 'L' : 'M'}${(rightBox.x + (d / my) * rightBox.w).toFixed(2)},${yS(iy(t)).toFixed(2)}`).join('');
      body.push(el('path', { d: `${pth}L${rightBox.x},${yS(iy(c[c.length - 1][0])).toFixed(2)}L${rightBox.x},${yS(iy(c[0][0])).toFixed(2)}Z`, fill: colorOf(keys[i]), fillOpacity: (M.areaOpacity ?? 0.12) * 1.5 }));
      body.push(el('path', { d: pth, fill: 'none', stroke: colorOf(keys[i]), strokeWidth: 1.75 }));
    });
  } else {
    // Bins exactos dentro del dominio del eje (cantidad según Freedman–Diaconis).
    const nb = (vs) => spec.bins ?? Math.max(8, Math.min(30, histogram(vs).length));
    const vx = pts.map((p) => tx(p.x)), vy = pts.map((p) => ty(p.y));
    const bx = histogram(vx, { bins: nb(vx), domain: [tx(xAx.min), tx(xAx.max)] });
    const by = histogram(vy, { bins: nb(vy), domain: [ty(yAx.min), ty(yAx.max)] });
    const countIn = (gp, bins, f, sel) => bins.map((b, i) => gp.filter((p) => { const t = f(sel(p)); return t >= b.x0 && (t < b.x1 || (i === bins.length - 1 && t <= b.x1)); }).length);
    const cx = groups.map((gp) => countIn(gp, bx, tx, (p) => p.x));
    const cy = groups.map((gp) => countIn(gp, by, ty, (p) => p.y));
    const mx = Math.max(...cx.flat(), 1), my = Math.max(...cy.flat(), 1);
    groups.forEach((gp, gi) => {
      const c = colorOf(keys[gi]);
      bx.forEach((b, i) => {
        const a0 = xS(ix(b.x0)) + 1, a1 = xS(ix(b.x1)) - 1;
        const h = (cx[gi][i] / mx) * topBox.h;
        if (h <= 0 || a1 <= a0) return;
        body.push(el('path', { class: 'pa-m', d: barPath(a0, topBox.y + topBox.h - h, a1 - a0, h, 'up', 2), fill: c, fillOpacity: op, 'data-tip': tip(`${fx(ix(b.x0))} – ${fx(ix(b.x1))}`, `${keys[gi] ? keys[gi] + ': ' : ''}${cx[gi][i]}`) }));
      });
      by.forEach((b, i) => {
        const a0 = yS(iy(b.x1)) + 1, a1 = yS(iy(b.x0)) - 1;
        const w = (cy[gi][i] / my) * rightBox.w;
        if (w <= 0 || a1 <= a0) return;
        body.push(el('path', { class: 'pa-m', d: barPath(rightBox.x, a0, w, a1 - a0, 'right', 2), fill: c, fillOpacity: op, 'data-tip': tip(`${fy(iy(b.x0))} – ${fy(iy(b.x1))}`, `${keys[gi] ? keys[gi] + ': ' : ''}${cy[gi][i]}`) }));
      });
    });
  }
  body.push(el('line', { x1: topBox.x, x2: topBox.x + topBox.w, y1: topBox.y + topBox.h + 0.5, y2: topBox.y + topBox.h + 0.5, stroke: theme.axis }));
  body.push(el('line', { x1: rightBox.x - 0.5, x2: rightBox.x - 0.5, y1: rightBox.y, y2: rightBox.y + rightBox.h, stroke: theme.axis }));

  // Ajuste opcional (kind: 'reg').
  if (spec.kind === 'reg') {
    keys.forEach((k, i) => {
      const f = fitGroup(groups[i], spec, { xLog, xMin: xAx.min, xMax: xAx.max });
      const L = (arr) => arr.map(([a, b], j) => `${j ? 'L' : 'M'}${xS(a).toFixed(2)},${yS(b).toFixed(2)}`).join('');
      if (f.band) body.push(el('path', { d: L(f.band.map(([x, , hi]) => [x, hi])) + 'L' + L(f.band.map(([x, lo]) => [x, lo]).reverse()).slice(1) + 'Z', fill: colorOf(k), fillOpacity: M.bandOpacity ?? 0.16 }));
      body.push(el('path', { d: L(f.line), fill: 'none', stroke: K === 1 ? theme.ink : colorOf(k), strokeWidth: M.lineWidth ?? 2, opacity: 0.9 }));
    });
  }
  body.push(g({}, dotLayer(pts.map((p) => ({ class: 'pa-m', cx: xS(p.x), cy: yS(p.y), r, fill: colorOf(p.k), fillOpacity: M.dotOpacity ?? 0.85, stroke: pts.length > 400 ? 'none' : theme.surface, strokeWidth: 1.25, 'data-tip': tip(p.name || p.k, `${humanize(P.x)}: ${fx(p.x)}`, `${humanize(P.y)}: ${fy(p.y)}`, p.name && p.k ? p.k : '') })))));
  body.push(pointLabels(pts, spec, xS, yS, r, inner, theme, P));
  body.push(gridX(xAx.ticks, xS, inner, theme, tickFmt(fx, xAx), { lines: false }));
  body.push(yTickLabels(yAx.ticks, yS, inner, theme, yt));
  axisTitles(body, theme, area, inner, { x: spec.xLabel ?? humanize(P.x), y: spec.yLabel === false ? null : spec.yLabel ?? humanize(P.y) });
  const fit = polyfit(pts.map((p) => tx(p.x)), pts.map((p) => p.y));
  const desc = en
    ? `Joint plot of ${humanize(P.y)} vs ${humanize(P.x)} with marginal distributions (${pts.length} points, R² ${dec(fit.r2, locale)}).`
    : `Gráfico conjunto de ${humanize(P.y).toLowerCase()} versus ${humanize(P.x).toLowerCase()} con distribuciones marginales (${formatNumber(pts.length, 0, locale)} puntos, R² ${dec(fit.r2, locale)}).`;
  return frame.finish(body, { desc, type: 'jointplot' });
}

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}
