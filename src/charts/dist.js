// Distribuciones al estilo seaborn: histograma (histplot), densidad (kdeplot)
// y distribución acumulada (ecdfplot). Ejes recesivos, marcas finas y color
// por grupo (`hue`) en orden fijo.
import { el, g, text, tip, barPath } from '../svg.js';
import { measure } from '../text.js';
import { makeFormat, formatNumber } from '../format.js';
import { niceDomain, niceStep, linear, log, logDomain, intStep } from '../scale.js';
import { colorMap, halo } from '../theme.js';
import { ensureData, requireField, num, fieldsOf, fieldKind, uniq, humanize, PlotError } from '../data.js';
import { yAxisMargin, yAxisTop, yGrid, yTickLabels, gridX, ticksWidth } from '../axes.js';
import { createFrame, hash as hashStr } from '../frame.js';
import { ctx } from '../context.js';
import { histogram as binValues, kde as kdeEst, scottBandwidth, ecdf as ecdfEst, quantile, finite, median, extent } from '../stats.js';

// ── Utilidades compartidas (también las usa regplot.js) ───────────────────

const EN = (spec) => String(spec.locale || 'es').startsWith('en');

/** Error con pista cuando el campo no tiene ningún número graficable. */
function noNumbers(field, en, isLog) {
  const logNote = isLog ? (en ? ' (on a log scale only values > 0 count)' : ' (en escala log solo cuentan valores > 0)') : '';
  return en
    ? new PlotError(`No numeric values in \`${field}\`${logNote}.`, `\`${field}\` must hold numbers (empty, null and text values are skipped), or pick another field with x: "field".`)
    : new PlotError(`No hay valores numéricos en \`${field}\`${logNote}.`, `\`${field}\` debe tener números (se omiten vacíos, nulos y textos), o elige otro campo con x: "campo".`);
}

/** Campo de grupo: `hue` (seaborn), `series` o `color` (si no es un hex). */
export function hueField(spec) {
  const h = spec.hue ?? spec.series ?? (typeof spec.color === 'string' && !spec.color.startsWith('#') ? spec.color : undefined);
  return h || null;
}

/** Agrupa valores numéricos de `field` por grupo. Devuelve [{ key, values }]. */
export function groupValues(data, field, hue) {
  const keys = hue ? uniq(data.map((r) => String(r[hue]))) : [''];
  const m = new Map(keys.map((k) => [k, []]));
  for (const r of data) {
    const v = num(r[field]);
    if (!Number.isFinite(v)) continue;
    m.get(hue ? String(r[hue]) : '').push(v);
  }
  return keys.map((k) => ({ key: k, values: m.get(k) })).filter((gr) => gr.values.length);
}

/**
 * Dominio de un eje numérico (lineal o log), con override `[min, max]`.
 * Devuelve { min, max, step, isLog, ticks, scale(r0, r1) }.
 */
export function axisDomain(values, { domain, type, count = 5, zero = false, nice = true, integer = false } = {}) {
  const fin = finite(values);
  if (type === 'log') {
    const pos = fin.filter((v) => v > 0);
    const d = domain ? { min: domain[0], max: domain[1] } : logDomain(...extent(pos));
    const ticks = log(d.min, d.max, 0, 1).ticks();
    return { min: d.min, max: d.max, step: null, isLog: true, ticks, scale: (r0, r1) => log(d.min, d.max, r0, r1) };
  }
  let [lo, hi] = fin.length ? extent(fin) : [0, 1];
  if (zero) { lo = Math.min(0, lo); hi = Math.max(0, hi); }
  let d;
  if (domain) {
    const step = niceStep(domain[1] - domain[0], count);
    d = { min: domain[0], max: domain[1], step };
  } else if (nice === 'tight') {
    // Ajustado a los datos (+4%): aprovecha el espacio en dispersión y regresión.
    const span = hi - lo || Math.abs(hi) || 1;
    const a = zero && lo >= 0 ? Math.max(0, lo - span * 0.04) : lo - span * 0.04;
    d = { min: a, max: hi + span * 0.04, step: niceStep(span * 1.08, count) };
  } else if (!nice) {
    d = { min: lo, max: hi === lo ? lo + 1 : hi, step: niceStep((hi === lo ? 1 : hi - lo), count) };
  } else d = niceDomain(lo, hi, count, { integer });
  // Sin pasos de 2,5: con decimales redondeados se leen mal (2,5 → "3").
  const mag = 10 ** Math.floor(Math.log10(d.step));
  if (Math.abs(d.step / mag - 2.5) < 1e-9) d.step = 2 * mag;
  // Conteos: paso entero (nunca marcas en 0,5).
  if (integer) d.step = intStep(d.step);
  const ticks = linear(d.min, d.max, 0, 1).ticks(d.step);
  return { min: d.min, max: d.max, step: d.step, isLog: false, ticks, scale: (r0, r1) => linear(d.min, d.max, r0, r1) };
}

/** Formateador de marcas para un eje (lineal o log). */
export const tickFmt = (fmt, ax) => (ax.isLog ? fmt : fmt.tick(ax.step, ax.ticks));

/** Títulos de eje horizontales: y arriba a la izquierda, x abajo a la derecha. */
export function axisTitles(body, theme, area, inner, { x, y }) {
  const size = theme.type?.axis ?? 11.5;
  if (y) body.push(text(area.x, area.y + 10, y, { fill: theme.lede, fontSize: size + 0.5, fontWeight: 500 }));
  if (x) body.push(text(inner.x + inner.w, inner.y + inner.h + 22 + 16 * ctx.textScale, x, { fill: theme.lede, fontSize: size + 0.5, fontWeight: 500, textAnchor: 'end' }));
}

/** Escala log10 → valor, para bins en espacio logarítmico. */
const T = (isLog) => (isLog ? { f: (v) => Math.log10(v), inv: (t) => 10 ** t } : { f: (v) => v, inv: (t) => t });


function rangeLabel(a, b, fx) {
  return `${fx(a)} – ${fx(b)}`;
}

// ── histplot ───────────────────────────────────────────────────────────────

/**
 * Histograma. Opciones: x (o y para horizontal), hue, bins, binWidth,
 * stat ('count' | 'percent' | 'density' | 'probability'), kde, multiple
 * ('layer' | 'stack' | 'dodge' | 'fill'), element ('bars' | 'step'),
 * cumulative, commonNorm (true), xScale 'log', xDomain, yDomain.
 */
export function hist(spec, theme) {
  const data = ensureData(spec);
  const fields = fieldsOf(data);
  const horizontal = !spec.x && !!spec.y;
  const field = spec.x ?? spec.y ?? fields.find((f) => fieldKind(data, f) === 'number');
  requireField(data, field, horizontal ? 'y' : 'x');
  const hue = hueField(spec);
  if (hue) requireField(data, hue, 'hue');
  const en = EN(spec);
  const locale = spec.locale || 'es';
  const isLog = (horizontal ? spec.yScale : spec.xScale) === 'log';
  const tr = T(isLog);
  // Sin valores > 0 en log, un grupo queda vacío: fuera (leyenda fantasma y 0/0 al normalizar).
  const groups = groupValues(data, field, hue).map((gr) => ({ ...gr, values: isLog ? gr.values.filter((v) => v > 0) : gr.values })).filter((gr) => gr.values.length);
  const all = groups.flatMap((gr) => gr.values);
  if (!all.length) throw noNumbers(field, en, isLog);
  const N = all.length;
  const stat = spec.stat || 'count';
  const multiple = groups.length > 1 ? spec.multiple || 'layer' : 'layer';
  const commonNorm = spec.commonNorm ?? spec.common_norm ?? true;

  // Bins compartidos (en espacio log si corresponde).
  const dom = spec[horizontal ? 'yDomain' : 'xDomain'];
  const tAll = all.map(tr.f);
  const edges0 = binValues(tAll, { bins: spec.bins, binWidth: spec.binWidth && !isLog ? spec.binWidth : undefined, domain: dom ? dom.map(tr.f) : undefined });
  const bins = edges0.map((b) => ({ t0: b.x0, t1: b.x1, x0: tr.inv(b.x0), x1: tr.inv(b.x1) }));
  const step = bins.length ? bins[0].t1 - bins[0].t0 : 1;
  const start = bins[0].t0;
  const counts = groups.map((gr) => {
    const c = new Array(bins.length).fill(0);
    for (const v of gr.values) {
      let i = Math.floor((tr.f(v) - start) / step + 1e-9);
      if (i === bins.length) i = bins.length - 1;
      if (i >= 0 && i < bins.length) c[i]++;
    }
    return c;
  });
  // Estadístico
  const norm = (gi) => (commonNorm ? N : groups[gi].values.length);
  let H = counts.map((c, gi) => c.map((n) => {
    if (stat === 'percent') return (n / norm(gi)) * 100;
    if (stat === 'probability' || stat === 'proportion') return n / norm(gi);
    if (stat === 'density') return n / (norm(gi) * step);
    return n;
  }));
  if (spec.cumulative) H = H.map((h) => { let acc = 0; return h.map((v) => (acc += stat === 'density' ? v * step : v)); });

  // Apilado / relleno
  const K = groups.length;
  const base = H.map((h) => h.map(() => 0));
  if (multiple === 'stack' || multiple === 'fill') {
    for (let i = 0; i < bins.length; i++) {
      let acc = 0;
      const tot = H.reduce((a, h) => a + h[i], 0) || 1;
      for (let gi = 0; gi < K; gi++) {
        const v = multiple === 'fill' ? H[gi][i] / tot : H[gi][i];
        base[gi][i] = acc;
        acc += v;
        H[gi][i] = acc;
      }
    }
  }
  const tops = H.flat();
  const statLabel = {
    count: en ? 'Count' : 'Frecuencia', percent: en ? 'Percent' : 'Porcentaje', density: en ? 'Density' : 'Densidad',
    probability: en ? 'Probability' : 'Proporción', proportion: en ? 'Proportion' : 'Proporción',
  }[stat] || stat;
  const fy = multiple === 'fill' ? makeFormat({ type: 'percent', scale: 100 }, locale) : stat === 'percent' ? makeFormat({ type: 'percent', scale: 1 }, locale) : makeFormat(spec.yFormat ?? (stat === 'count' ? 'integer' : undefined), locale, tops);
  const fx = makeFormat(spec.xFormat ?? spec.format, locale, all);

  // KDE superpuesta (en la escala del estadístico)
  const kdes = spec.kde && multiple !== 'fill' && !spec.cumulative
    ? groups.map((gr, gi) => {
        const share = gr.values.length / norm(gi);
        const scale = stat === 'count' ? gr.values.length * step : stat === 'percent' ? share * step * 100 : stat === 'density' ? share : share * step;
        return kdeEst(gr.values.map(tr.f), { adjust: spec.bwAdjust ?? 1, extent: [bins[0].t0, bins[bins.length - 1].t1], gridSize: 140 }).map(([t, d]) => [t, d * scale]);
      })
    : null;
  if (kdes && multiple === 'stack') {
    for (let i = 0; i < kdes[0].length; i++) { let acc = 0; for (const k of kdes) { acc += k[i][1]; k[i][1] = acc; } }
  }
  const kdeMax = kdes ? extent(kdes.flatMap((k) => k.map((p) => p[1])))[1] : 0;

  const cmap = colorMap(groups.map((gr) => gr.key), theme, spec.colors);
  const single = K === 1;
  const colorOf = (gi) => (single ? (spec.colors && spec.colors[groups[0].key]) || theme.categorical[0] : cmap.get(groups[gi].key));
  const legend = !single && spec.legend !== false ? groups.map((gr) => ({ label: gr.key, color: cmap.get(gr.key), shape: 'square' })) : [];

  const frame = createFrame(spec, theme, { height: 400 });
  const area = frame.layout(legend);
  const body = [];
  const M = theme.marks || {};
  const vMax = Math.max(extent(tops)[1], kdeMax);
  const valueOverride = horizontal ? spec.xDomain : spec.yDomain;
  const vAx = axisDomain([0, vMax], { domain: multiple === 'fill' ? [0, 1] : valueOverride, count: Math.max(3, Math.round((horizontal ? area.w / 110 : area.h / 64))), zero: true, integer: stat === 'count' && multiple !== 'fill' });
  const binDom = dom ? [dom[0], dom[1]] : [bins[0].x0, bins[bins.length - 1].x1];
  const clipId = 'pa-clip-h' + Math.abs(hashStr((spec.title || '') + field + area.w)).toString(36);
  const writeDomains = (bin, val) => { if (spec._domains && typeof spec._domains === 'object') { spec._domains[horizontal ? 'y' : 'x'] = bin; spec._domains[horizontal ? 'x' : 'y'] = val; } };

  if (!horizontal) {
    const ticksF = tickFmt(fy, vAx);
    const leftM = yAxisMargin(vAx.ticks, ticksF, theme, false);
    const top = (spec.yLabel !== false ? 18 : 0) + yAxisTop(theme, false);
    const inner = { x: area.x + leftM, y: area.y + top, w: area.w - leftM - 4, h: area.h - top - 44 };
    const yS = vAx.scale(inner.y + inner.h, inner.y);
    const bAx = axisDomain(binDom, { type: isLog ? 'log' : undefined, domain: binDom, count: Math.max(3, Math.round(inner.w / 90)) });
    const xS = bAx.scale(inner.x, inner.x + inner.w);
    writeDomains([bAx.min, bAx.max], [vAx.min, vAx.max]);
    body.push(el('clipPath', { id: clipId }, el('rect', { x: inner.x, y: inner.y - 2, width: inner.w, height: inner.h + 2 })));
    body.push(yGrid(vAx.ticks, yS, inner, theme));
    body.push(g({ clipPath: `url(#${clipId})` }, drawBins({ bins, H, base, K, multiple, element: spec.element, xS, yS, theme, M, colorOf, single, inner, groups, fy, fx, stat, horizontal: false, statLabel })));
    if (kdes) kdes.forEach((k, gi) => body.push(el('path', { d: k.map(([t, d], i) => `${i ? 'L' : 'M'}${xS(tr.inv(t)).toFixed(2)},${yS(d).toFixed(2)}`).join(''), fill: 'none', stroke: single ? theme.ink : colorOf(gi), strokeWidth: M.lineWidth ?? 2, strokeLinejoin: 'round', strokeLinecap: 'round', opacity: single ? 0.8 : 1 })));
    body.push(el('line', { x1: inner.x, x2: inner.x + inner.w, y1: Math.round(yS(0)) + 0.5, y2: Math.round(yS(0)) + 0.5, stroke: theme.axis, strokeWidth: 1 }));
    body.push(gridX(isLog ? bAx.ticks : bAx.ticks, xS, inner, theme, tickFmt(fx, bAx), { lines: false }));
    body.push(yTickLabels(vAx.ticks, yS, inner, theme, ticksF, { inside: false }));
    axisTitles(body, theme, area, inner, { x: spec.xLabel ?? humanize(field), y: spec.yLabel === false ? null : spec.yLabel ?? (multiple === 'fill' ? (en ? 'Share' : 'Proporción') : statLabel) });
  } else {
    const binTicks = axisDomain(binDom, { type: isLog ? 'log' : undefined, domain: binDom, count: Math.max(3, Math.round(area.h / 60)) });
    const bf = tickFmt(fx, binTicks);
    const leftM = ticksWidth(binTicks.ticks, bf, theme.type?.axis) + 10;
    const top = spec.yLabel !== false ? 22 : 6;
    const inner = { x: area.x + leftM, y: area.y + top, w: area.w - leftM - 8, h: area.h - top - 44 };
    const yS = binTicks.scale(inner.y + inner.h, inner.y);
    const xS = vAx.scale(inner.x, inner.x + inner.w);
    writeDomains([binTicks.min, binTicks.max], [vAx.min, vAx.max]);
    body.push(el('clipPath', { id: clipId }, el('rect', { x: inner.x, y: inner.y, width: inner.w + 2, height: inner.h })));
    body.push(gridX(vAx.ticks, xS, inner, theme, tickFmt(fy, vAx), { lines: true }));
    body.push(drawBins({ bins, H, base, K, multiple, element: spec.element, xS, yS, theme, M, colorOf, single, inner, groups, fy, fx, stat, horizontal: true, statLabel }));
    if (kdes) kdes.forEach((k, gi) => body.push(el('path', { d: k.map(([t, d], i) => `${i ? 'L' : 'M'}${xS(d).toFixed(2)},${yS(tr.inv(t)).toFixed(2)}`).join(''), fill: 'none', stroke: single ? theme.ink : colorOf(gi), strokeWidth: M.lineWidth ?? 2, strokeLinejoin: 'round', opacity: single ? 0.8 : 1 })));
    body.push(el('line', { x1: Math.round(xS(0)) + 0.5, x2: Math.round(xS(0)) + 0.5, y1: inner.y, y2: inner.y + inner.h, stroke: theme.axis, strokeWidth: 1 }));
    body.push(g({ class: 'pa-axis' }, binTicks.ticks.map((t) => text(inner.x - 8, yS(t) + 4, bf(t), { fill: theme.muted, fontSize: theme.type?.axis ?? 11.5, textAnchor: 'end' }))));
    axisTitles(body, theme, area, inner, { y: spec.yLabel === false ? null : spec.yLabel ?? humanize(field), x: spec.xLabel ?? statLabel });
  }

  const sorted = [...all].sort((a, b) => a - b);
  const allCounts = bins.map((_, i) => counts.reduce((a, c) => a + c[i], 0));
  const mi = allCounts.indexOf(Math.max(...allCounts));
  const what = humanize(field).toLowerCase();
  const desc = en
    ? `Histogram of ${what} with ${N} observations${K > 1 ? ` in ${K} groups` : ''}. Median ${fx(quantile(sorted, 0.5))}; the most frequent range is ${rangeLabel(bins[mi].x0, bins[mi].x1, fx)}.`
    : `Histograma de ${what} con ${formatNumber(N, 0, locale)} observaciones${K > 1 ? ` en ${K} grupos` : ''}. Mediana ${fx(quantile(sorted, 0.5))}; el rango más frecuente es ${rangeLabel(bins[mi].x0, bins[mi].x1, fx)}.`;
  return frame.finish(body, { desc, type: 'hist' });
}

function drawBins({ bins, H, base, K, multiple, element, xS, yS, theme, M, colorOf, single, inner, groups, fy, fx, stat, horizontal, statLabel }) {
  const out = [];
  const layered = multiple === 'layer' && K > 1;
  const op = layered ? 0.55 : 1;
  if (element === 'step') {
    // Escalones: contorno + lavado de color.
    for (let gi = 0; gi < K; gi++) {
      const c = colorOf(gi);
      const pts = [];
      bins.forEach((b, i) => {
        if (!horizontal) { pts.push([xS(b.x0), yS(H[gi][i])], [xS(b.x1), yS(H[gi][i])]); }
        else { pts.push([xS(H[gi][i]), yS(b.x0)], [xS(H[gi][i]), yS(b.x1)]); }
      });
      const line = pts.map(([a, b], i) => `${i ? 'L' : 'M'}${a.toFixed(2)},${b.toFixed(2)}`).join('');
      const baseline = bins.map((b, i) => (!horizontal ? [[xS(b.x1), yS(base[gi][i])], [xS(b.x0), yS(base[gi][i])]] : [[xS(base[gi][i]), yS(b.x1)], [xS(base[gi][i]), yS(b.x0)]])).reverse().flat();
      const area = line + 'L' + baseline.map(([a, b]) => `${a.toFixed(2)},${b.toFixed(2)}`).join('L') + 'Z';
      out.push(g({ class: 'pa-m', 'data-tip': tip(groups[gi].key || statLabel, `n = ${groups[gi].values.length}`) }, [
        el('path', { d: area, fill: c, fillOpacity: (M.areaOpacity ?? 0.12) * 1.6 }),
        el('path', { d: line, fill: 'none', stroke: c, strokeWidth: M.lineWidth ?? 2, strokeLinejoin: 'round' }),
      ]));
    }
    return g({}, out);
  }
  bins.forEach((b, i) => {
    const p0 = !horizontal ? xS(b.x0) : yS(b.x1);
    const p1 = !horizontal ? xS(b.x1) : yS(b.x0);
    const full = p1 - p0;
    const gap = full > 8 ? (M.gap ?? 2) : full > 3 ? 1 : 0;
    const groupTip = tip(rangeLabel(b.x0, b.x1, fx), ...groups.map((gr, gi) => {
      const v = multiple === 'stack' || multiple === 'fill' ? H[gi][i] - base[gi][i] : H[gi][i];
      return `${gr.key ? gr.key + ': ' : ''}${fy(v)}`;
    }));
    const parts = [];
    for (let gi = 0; gi < K; gi++) {
      let a0 = p0 + gap / 2, a1 = p1 - gap / 2;
      if (multiple === 'dodge' && K > 1) { const w = (a1 - a0) / K; a0 = a0 + gi * w; a1 = a0 + w - (w > 4 ? 1 : 0); }
      const v1 = H[gi][i], v0 = base[gi][i];
      if (!(v1 - v0 > 0) && multiple !== 'layer') continue;
      if (!(v1 > 0)) continue;
      const isTop = multiple !== 'stack' && multiple !== 'fill' ? true : gi === K - 1 || H.slice(gi + 1).every((h, k) => !(h[i] - base[gi + 1 + k][i] > 0));
      const radius = Math.min(M.barRadius ?? 4, 2.5);
      let d;
      if (!horizontal) {
        const ya = yS(v1), yb = yS(v0) - (v0 > 0 ? 1 : 0);
        d = barPath(a0, ya, Math.max(0, a1 - a0), Math.max(0, yb - ya), 'up', isTop ? radius : 0);
      } else {
        const xa = xS(v0) + (v0 > 0 ? 1 : 0), xb = xS(v1);
        d = barPath(xa, a0, Math.max(0, xb - xa), Math.max(0, a1 - a0), 'right', isTop ? radius : 0);
      }
      if (d) parts.push(el('path', { d, fill: colorOf(gi), fillOpacity: op }));
    }
    const hit = !horizontal
      ? el('rect', { x: p0, y: inner.y, width: Math.max(0, full), height: inner.h, fill: 'transparent' })
      : el('rect', { x: inner.x, y: p0, width: inner.w, height: Math.max(0, full), fill: 'transparent' });
    out.push(g({ class: 'pa-m', 'data-tip': groupTip }, [hit, ...parts]));
  });
  return g({}, out);
}

// ── kdeplot ────────────────────────────────────────────────────────────────

/**
 * Densidad por kernel. Opciones: x, hue, fill (true), multiple ('layer' |
 * 'stack' | 'fill'), bwAdjust, cut (3), clip [a,b], cumulative, commonNorm,
 * rug, labels ('auto' rotula el pico de cada grupo), xScale 'log', xDomain, yDomain.
 */
export function kde(spec, theme) {
  const data = ensureData(spec);
  const fields = fieldsOf(data);
  const field = spec.x ?? spec.y ?? fields.find((f) => fieldKind(data, f) === 'number');
  requireField(data, field, 'x');
  const hue = hueField(spec);
  if (hue) requireField(data, hue, 'hue');
  const en = EN(spec);
  const locale = spec.locale || 'es';
  const isLog = spec.xScale === 'log';
  const tr = T(isLog);
  const groups0 = groupValues(data, field, hue).map((gr) => ({ ...gr, values: isLog ? gr.values.filter((v) => v > 0) : gr.values }));
  if (!groups0.some((gr) => gr.values.length)) throw noNumbers(field, en, isLog);
  const groups = groups0.filter((gr) => gr.values.length > 1);
  if (!groups.length) return emptyChart(spec, theme, en);
  const all = groups.flatMap((gr) => gr.values);
  const N = all.length;
  const K = groups.length;
  const multiple = K > 1 ? spec.multiple || 'layer' : 'layer';
  // Acumulada: cada grupo llega a 100% (salvo que se pida normalización común).
  const commonNorm = spec.commonNorm ?? spec.common_norm ?? !spec.cumulative;
  const cut = spec.cut ?? 3;
  const adjust = spec.bwAdjust ?? spec.bw_adjust ?? 1;
  // Grilla común
  const bws = groups.map((gr) => scottBandwidth(gr.values.map(tr.f)) * adjust);
  const ext = groups.map((gr) => extent(gr.values.map(tr.f)));
  let lo = Math.min(...ext.map((e, i) => e[0] - cut * bws[i]));
  let hi = Math.max(...ext.map((e, i) => e[1] + cut * bws[i]));
  if (spec.clip) { lo = Math.max(lo, tr.f(spec.clip[0])); hi = Math.min(hi, tr.f(spec.clip[1])); }
  if (spec.xDomain) { lo = tr.f(spec.xDomain[0]); hi = tr.f(spec.xDomain[1]); }
  const G = 200;
  let curves = groups.map((gr, i) => {
    const share = commonNorm ? gr.values.length / N : 1;
    return kdeEst(gr.values.map(tr.f), { bandwidth: bws[i], extent: [lo, hi], gridSize: G }).map(([t, d]) => [t, d * share]);
  });
  if (spec.cumulative) {
    curves = curves.map((c) => { let acc = 0; return c.map(([t, d], i) => { if (i) acc += ((d + c[i - 1][1]) / 2) * (t - c[i - 1][0]); return [t, acc]; }); });
  }
  const base = curves.map((c) => c.map(() => 0));
  if (multiple === 'stack' || multiple === 'fill') {
    for (let i = 0; i < G; i++) {
      let acc = 0;
      const tot = curves.reduce((a, c) => a + c[i][1], 0) || 1;
      for (let k = 0; k < K; k++) {
        const v = multiple === 'fill' ? curves[k][i][1] / tot : curves[k][i][1];
        base[k][i] = acc; acc += v; curves[k][i] = [curves[k][i][0], acc];
      }
    }
  }
  const yMax = extent(curves.flatMap((c) => c.map((p) => p[1])))[1];
  const cmap = colorMap(groups.map((gr) => gr.key), theme, spec.colors);
  const hl = spec.highlight === undefined ? null : new Set([].concat(spec.highlight).map(String));
  const colorOf = (k) => (hl && !hl.has(groups[k].key) ? theme.dim : K === 1 ? (spec.colors && spec.colors[groups[0].key]) || theme.categorical[0] : cmap.get(groups[k].key));
  const legend = K > 1 && spec.legend !== false ? groups.map((gr, k) => ({ label: gr.key, color: colorOf(k), shape: spec.fill === false ? 'line' : 'square' })) : [];

  const frame = createFrame(spec, theme, { height: 380 });
  const area = frame.layout(legend);
  const M = theme.marks || {};
  const fx = makeFormat(spec.xFormat ?? spec.format, locale, all);
  const fy = multiple === 'fill' || spec.cumulative ? makeFormat({ type: 'percent', scale: 100 }, locale) : makeFormat(spec.yFormat, locale, [yMax]);
  const vAx = axisDomain([0, yMax], { domain: multiple === 'fill' ? [0, 1] : spec.yDomain, zero: true, count: Math.max(3, Math.round(area.h / 70)) });
  const ticksF = tickFmt(fy, vAx);
  const rugH = spec.rug ? 10 : 0;
  // Con relleno al 100% el área cubre todo: etiquetas del eje y por fuera.
  const insideY = multiple === 'fill' ? false : undefined;
  const top = 18 + yAxisTop(theme, insideY);
  const leftM = yAxisMargin(vAx.ticks, ticksF, theme, insideY);
  const inner = { x: area.x + leftM, y: area.y + top, w: area.w - leftM - 4, h: area.h - top - 44 - rugH };
  const yS = vAx.scale(inner.y + inner.h, inner.y);
  const xDomVals = [tr.inv(lo), tr.inv(hi)];
  const xAx = axisDomain(xDomVals, { type: isLog ? 'log' : undefined, domain: xDomVals, count: Math.max(3, Math.round(inner.w / 90)) });
  const xS = xAx.scale(inner.x, inner.x + inner.w);
  const P = ([t, d]) => `${xS(tr.inv(t)).toFixed(2)},${yS(d).toFixed(2)}`;
  if (spec._domains && typeof spec._domains === 'object') { spec._domains.x = [xAx.min, xAx.max]; spec._domains.y = [vAx.min, vAx.max]; }

  const body = [];
  body.push(yGrid(vAx.ticks, yS, inner, theme));
  const stacked = multiple === 'stack' || multiple === 'fill';
  const order = stacked ? [...groups.keys()].reverse() : [...groups.keys()].sort((a, b) => (hl ? (hl.has(groups[a].key) ? 1 : 0) - (hl.has(groups[b].key) ? 1 : 0) : 0));
  for (const k of order) {
    const c = curves[k];
    const color = colorOf(k);
    const top = 'M' + c.map(P).join('L');
    const parts = [];
    if (spec.fill !== false || stacked) {
      const bottom = base[k].map((b, i) => [c[i][0], b]).reverse().map(P).join('L');
      parts.push(el('path', { d: top + 'L' + bottom + 'Z', fill: color, fillOpacity: stacked ? 0.85 : (M.areaOpacity ?? 0.12) * 1.5, stroke: stacked ? theme.surface : 'none', strokeWidth: stacked ? 1.5 : 0 }));
    }
    if (!stacked) parts.push(el('path', { d: top, fill: 'none', stroke: color, strokeWidth: M.lineWidth ?? 2, strokeLinejoin: 'round', strokeLinecap: 'round' }));
    const vs = [...groups[k].values].sort((a, b) => a - b);
    body.push(g({ class: 'pa-m', 'data-tip': tip(groups[k].key || humanize(field), `n = ${formatNumber(vs.length, 0, locale)}`, `${en ? 'Median' : 'Mediana'}: ${fx(quantile(vs, 0.5))}`, `P25–P75: ${fx(quantile(vs, 0.25))} – ${fx(quantile(vs, 0.75))}`) }, parts));
  }
  body.push(el('line', { x1: inner.x, x2: inner.x + inner.w, y1: Math.round(yS(0)) + 0.5, y2: Math.round(yS(0)) + 0.5, stroke: theme.axis, strokeWidth: 1 }));
  if (spec.rug) {
    const ry = inner.y + inner.h + 3;
    groups.forEach((gr, k) => {
      const d = gr.values.slice(0, 2000).map((v) => xS(v)).filter((px) => px >= inner.x && px <= inner.x + inner.w).map((px) => `M${px.toFixed(1)},${ry}v${rugH - 3}`).join('');
      if (d) body.push(el('path', { d, stroke: colorOf(k), strokeWidth: 1, opacity: 0.45 }));
    });
  }
  // Etiqueta en el pico de cada grupo (si no chocan); la leyenda queda igual.
  if (K > 1 && !stacked && !spec.cumulative && spec.labels !== false) {
    const boxes = [];
    const labs = [];
    for (let k = 0; k < K; k++) {
      if (hl && !hl.has(groups[k].key)) continue;
      const c = curves[k];
      let pi = 0;
      for (let i = 1; i < c.length; i++) if (c[i][1] > c[pi][1]) pi = i;
      const px = xS(tr.inv(c[pi][0])), py = yS(c[pi][1]) - 8;
      const w = measure(groups[k].key, 12, 600);
      const box = [px - w / 2, py - 12, px + w / 2, py + 2];
      if (box[0] < inner.x || box[2] > inner.x + inner.w || box[1] < area.y + 14) continue;
      if (boxes.some((b) => !(box[2] < b[0] || box[0] > b[2] || box[3] < b[1] || box[1] > b[3]))) continue;
      boxes.push(box);
      labs.push(text(px, py, groups[k].key, { fill: theme.ink, fontSize: 12, fontWeight: 600, textAnchor: 'middle', ...halo(theme) }));
    }
    body.push(g({ class: 'pa-peaks' }, labs));
  }
  body.push(gridX(xAx.ticks, xS, { ...inner, h: inner.h + rugH }, theme, tickFmt(fx, xAx), { lines: false }));
  // Los valores de densidad no dicen nada al lector: se ocultan salvo que se pidan.
  const showY = spec.yTicks ?? (spec.cumulative || multiple === 'fill');
  if (showY) body.push(yTickLabels(vAx.ticks, yS, inner, theme, ticksF, { inside: insideY }));
  axisTitles(body, theme, area, { ...inner, h: inner.h + rugH }, { x: spec.xLabel ?? humanize(field), y: spec.yLabel === false ? null : spec.yLabel ?? (spec.cumulative ? (en ? 'Cumulative share' : 'Proporción acumulada') : multiple === 'fill' ? (en ? 'Share' : 'Proporción') : en ? 'Density' : 'Densidad') });

  const what = humanize(field).toLowerCase();
  const meds = groups.map((gr) => `${gr.key ? gr.key + ' ' : ''}${fx(median(gr.values))}`).join(', ');
  const desc = en ? `Density plot of ${what} (${N} observations). Median: ${meds}.` : `Gráfico de densidad de ${what} (${formatNumber(N, 0, locale)} observaciones). Mediana: ${meds}.`;
  return frame.finish(body, { desc, type: 'kde' });
}

// ── ecdfplot ───────────────────────────────────────────────────────────────

/** Distribución acumulada empírica. Opciones: x, hue, complementary, xScale 'log', xDomain. */
export function ecdf(spec, theme) {
  const data = ensureData(spec);
  const fields = fieldsOf(data);
  const field = spec.x ?? spec.y ?? fields.find((f) => fieldKind(data, f) === 'number');
  requireField(data, field, 'x');
  const hue = hueField(spec);
  if (hue) requireField(data, hue, 'hue');
  const en = EN(spec);
  const locale = spec.locale || 'es';
  const isLog = spec.xScale === 'log';
  const groups = groupValues(data, field, hue).map((gr) => ({ ...gr, values: isLog ? gr.values.filter((v) => v > 0) : gr.values })).filter((gr) => gr.values.length);
  if (!groups.length) throw noNumbers(field, en, isLog);
  const all = groups.flatMap((gr) => gr.values);
  const K = groups.length;
  const cmap = colorMap(groups.map((gr) => gr.key), theme, spec.colors);
  const hl = spec.highlight === undefined ? null : new Set([].concat(spec.highlight).map(String));
  const colorOf = (k) => (hl && !hl.has(groups[k].key) ? theme.dim : K === 1 ? theme.categorical[0] : cmap.get(groups[k].key));
  const legend = K > 1 && spec.legend !== false ? groups.map((gr, k) => ({ label: gr.key, color: colorOf(k), shape: 'line' })) : [];
  const frame = createFrame(spec, theme, { height: 380 });
  const area = frame.layout(legend);
  const M = theme.marks || {};
  const fx = makeFormat(spec.xFormat ?? spec.format, locale, all);
  const fy = makeFormat({ type: 'percent', scale: 100 }, locale);
  const vAx = axisDomain([0, 1], { domain: [0, 1], count: 4 });
  const ticksF = (v) => fy(v);
  const top = 18 + yAxisTop(theme);
  const inner = { x: area.x + yAxisMargin(vAx.ticks, ticksF, theme), y: area.y + top, w: 0, h: area.h - top - 44 };
  inner.w = area.x + area.w - inner.x - 4;
  const yS = vAx.scale(inner.y + inner.h, inner.y);
  const xAx = axisDomain(all, { type: isLog ? 'log' : undefined, domain: spec.xDomain, count: Math.max(3, Math.round(inner.w / 90)) });
  const xS = xAx.scale(inner.x, inner.x + inner.w);
  if (spec._domains && typeof spec._domains === 'object') { spec._domains.x = [xAx.min, xAx.max]; spec._domains.y = [0, 1]; }
  const body = [yGrid(vAx.ticks, yS, inner, theme)];
  // Mediana como referencia discreta.
  const py50 = Math.round(yS(0.5)) + 0.5;
  body.push(el('line', { x1: inner.x, x2: inner.x + inner.w, y1: py50, y2: py50, stroke: theme.axis, strokeWidth: 1 }));
  const order = [...groups.keys()].sort((a, b) => (hl ? (hl.has(groups[a].key) ? 1 : 0) - (hl.has(groups[b].key) ? 1 : 0) : 0));
  for (const k of order) {
    const pts = ecdfEst(groups[k].values);
    const comp = !!spec.complementary;
    const Y = (p) => (comp ? 1 - p : p);
    let d = `M${xS(Math.max(xAx.min, pts[0][0])).toFixed(2)},${yS(Y(0)).toFixed(2)}`;
    // Escalones a menos de medio píxel se funden en uno (50 mil valores → ~1 por columna).
    let prev = 0, colX = NaN, colP0 = 0, colP1 = 0;
    const flush = () => { if (Number.isFinite(colX)) { const px = colX.toFixed(2); d += `L${px},${yS(Y(colP0)).toFixed(2)}L${px},${yS(Y(colP1)).toFixed(2)}`; } };
    for (const [x, p] of pts) {
      const fx0 = xS(Math.min(xAx.max, Math.max(xAx.min, x)));
      if (Number.isFinite(colX) && Math.abs(fx0 - colX) < 0.5) colP1 = p;
      else { flush(); colX = fx0; colP0 = prev; colP1 = p; }
      prev = p;
    }
    flush();
    d += `L${xS(xAx.max).toFixed(2)},${yS(Y(1)).toFixed(2)}`;
    const vs = [...groups[k].values].sort((a, b) => a - b);
    body.push(g({ class: 'pa-m', 'data-tip': tip(groups[k].key || humanize(field), `P25: ${fx(quantile(vs, 0.25))}`, `${en ? 'Median' : 'Mediana'}: ${fx(quantile(vs, 0.5))}`, `P75: ${fx(quantile(vs, 0.75))}`, `P90: ${fx(quantile(vs, 0.9))}`) }, [
      el('path', { d, fill: 'none', stroke: 'transparent', strokeWidth: 12 }),
      el('path', { d, fill: 'none', stroke: colorOf(k), strokeWidth: hl && hl.has(groups[k].key) ? (M.lineWidth ?? 2) + 0.75 : M.lineWidth ?? 2, strokeLinejoin: 'round' }),
    ]));
  }
  body.push(text(inner.x + inner.w, py50 - 5, en ? 'Median' : 'Mediana', { fill: theme.muted, fontSize: theme.type?.axis ?? 11.5, textAnchor: 'end', ...halo(theme) }));
  body.push(el('line', { x1: inner.x, x2: inner.x + inner.w, y1: inner.y + inner.h + 0.5, y2: inner.y + inner.h + 0.5, stroke: theme.axis }));
  body.push(gridX(xAx.ticks, xS, inner, theme, tickFmt(fx, xAx), { lines: false }));
  body.push(yTickLabels(vAx.ticks, yS, inner, theme, ticksF));
  axisTitles(body, theme, area, inner, { x: spec.xLabel ?? humanize(field), y: spec.yLabel === false ? null : spec.yLabel ?? (spec.complementary ? (en ? 'Share above' : 'Proporción sobre el valor') : en ? 'Cumulative share' : 'Proporción acumulada') });
  const what = humanize(field).toLowerCase();
  const meds = groups.map((gr) => `${gr.key ? gr.key + ' ' : ''}${fx(median(gr.values))}`).join(', ');
  const desc = en ? `Empirical cumulative distribution of ${what}. Median: ${meds}.` : `Distribución acumulada empírica de ${what}. Mediana: ${meds}.`;
  return frame.finish(body, { desc, type: 'ecdf' });
}

function emptyChart(spec, theme, en) {
  const frame = createFrame(spec, theme, { height: 200 });
  const area = frame.layout([]);
  return frame.finish([text(area.x, area.y + 20, en ? 'No numeric values to plot.' : 'No hay valores numéricos para graficar.', { fill: theme.lede, fontSize: 13 })], { desc: en ? 'Empty chart.' : 'Gráfico vacío.', type: 'empty' });
}

