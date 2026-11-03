// Líneas y áreas: series de tiempo, índices base 100, bandas de confianza
// (seaborn lineplot), escala log y áreas apiladas.
// Etiquetas SIEMPRE al final de cada línea: si chocan se separan y una línea
// guía fina las une con su punto. El eje y va por dentro para ganar ancho.
import { el, g, text, tip } from '../svg.js';
import { measure, truncate } from '../text.js';
import { makeFormat, formatDate, parseDate } from '../format.js';
import { niceDomain, linear, log, logDomain, timeTicks, dateUnit, niceStep } from '../scale.js';
import { colorMap, readable } from '../theme.js';
import { ensureData, inferXY, requireField, melt, uniq, aggregate, num, fieldKind, xValue, humanize } from '../data.js';
import { xLabels, refLinesY, yAxisMargin, yAxisTop, yGrid, yTickLabels } from '../axes.js';
import { createFrame } from '../frame.js';
import { ctx } from '../context.js';
import { meanCI, mean, sd } from '../stats.js';
import { hash } from '../frame.js';

export function prepareLine(spec) {
  let data = ensureData(spec);
  let series = spec.series ?? spec.hue ?? spec.color;
  let y = spec.y;
  if (Array.isArray(y)) {
    if (y.length > 1) {
      data = melt(data, spec.x, y, '__series', '__value', spec.labelsFor || {});
      series = '__series';
      y = '__value';
    } else y = y[0];
  }
  const inf = inferXY({ ...spec, y }, data);
  const x = inf.x;
  y = y || inf.y;
  requireField(data, x, 'x');
  requireField(data, y, 'y');
  if (series) requireField(data, series, 'series');
  const kind = fieldKind(data, x);
  const cats = kind === 'category' ? uniq(data.map((r) => String(r[x]))) : null;
  const seriesKeys = series ? uniq(data.map((r) => String(r[series]))) : [humanize(y) || 'Serie'];

  // Rango visible (slider temporal): filtra antes de calcular escalas.
  const range = spec.xRange;
  const rv = (v) => (v === undefined || v === null ? null : kind === 'date' ? parseDate(v) : kind === 'category' ? cats.indexOf(String(v)) : num(v));
  const [r0, r1] = range ? [rv(range[0]), rv(range[1])] : [null, null];

  const map = new Map(seriesKeys.map((s) => [s, new Map()]));
  for (const r of data) {
    const s = series ? String(r[series]) : seriesKeys[0];
    const xv = kind === 'category' ? cats.indexOf(String(r[x])) : xValue(r[x], kind);
    if (!Number.isFinite(xv)) continue;
    if (r0 !== null && Number.isFinite(r0) && xv < r0) continue;
    if (r1 !== null && Number.isFinite(r1) && xv > r1) continue;
    const m = map.get(s);
    if (!m.has(xv)) m.set(xv, []);
    m.get(xv).push(num(r[y]));
  }
  // Estimador: suma por defecto; con `ci`/`errorbar` → media ± intervalo (seaborn).
  const errorbar = spec.errorbar ?? (spec.ci === true || typeof spec.ci === 'number' ? 'ci' : null);
  const how = spec.aggregate ?? spec.estimator ?? (errorbar ? 'mean' : 'sum');
  const level = typeof spec.ci === 'number' ? (spec.ci > 1 ? spec.ci / 100 : spec.ci) : 0.95;
  let lines = seriesKeys.map((s) => ({
    key: s,
    points: [...map.get(s).entries()]
      .map(([xv, ys]) => {
        const v = ys.filter(Number.isFinite);
        const p = { x: xv, y: aggregate(v, how), n: v.length };
        if (errorbar && v.length > 1) {
          if (errorbar === 'sd') { const m = mean(v), d = sd(v); p.lo = m - d; p.hi = m + d; }
          else if (errorbar === 'se') { const m = mean(v), d = sd(v) / Math.sqrt(v.length); p.lo = m - d; p.hi = m + d; }
          else [p.lo, p.hi] = meanCI(v, level);
        }
        return p;
      })
      .sort((a, b) => a.x - b.x),
  }));
  if (spec.index) {
    lines = lines.map((l) => {
      const base = l.points.find((p) => Number.isFinite(p.y) && p.y !== 0)?.y;
      const k = base ? 100 / base : NaN;
      return { ...l, points: l.points.map((p) => ({ ...p, raw: p.y, y: p.y * k, lo: p.lo * k, hi: p.hi * k })) };
    });
  }
  return { data, x, y, series, seriesKeys, lines, kind, cats, errorbar };
}

export function line(spec, theme, variant = 'line') {
  const m = prepareLine(spec);
  const locale = spec.locale || 'es';
  const M = theme.marks || {};
  const isArea = variant === 'area' || spec.area === true;
  const multi = m.lines.length > 1;
  const stack = isArea && multi && spec.stack !== false;
  const pct = stack && (spec.stack === 'percent' || spec.normalize);
  const xsAll = uniq(m.lines.flatMap((l) => l.points.map((p) => p.x))).sort((a, b) => a - b);
  if (!xsAll.length) return createFrame(spec, theme).finish([], { desc: '', type: variant });

  // Apilado (áreas), opcionalmente al 100%.
  if (stack) {
    const tot = new Map(xsAll.map((xv) => [xv, 0]));
    for (const l of m.lines) for (const p of l.points) if (Number.isFinite(p.y)) tot.set(p.x, tot.get(p.x) + p.y);
    const base = new Map(xsAll.map((xv) => [xv, 0]));
    for (const l of m.lines) {
      const byX = new Map(l.points.map((p) => [p.x, p.y]));
      l.points = xsAll.map((xv) => {
        let v = Number.isFinite(byX.get(xv)) ? byX.get(xv) : 0;
        if (pct) v = tot.get(xv) ? v / tot.get(xv) : 0;
        const y0 = base.get(xv);
        base.set(xv, y0 + v);
        return { x: xv, y: y0 + v, y0, v };
      });
    }
  }

  const allY = m.lines.flatMap((l) => l.points.flatMap((p) => [p.y, p.lo, p.hi])).filter(Number.isFinite);
  const rawY = m.lines.flatMap((l) => l.points.map((p) => p.v ?? p.y)).filter(Number.isFinite);
  const fmt = pct
    ? makeFormat({ type: 'percent', scale: 100, decimals: spec.format?.decimals }, locale)
    : spec.index ? makeFormat({ type: 'number', decimals: spec.format?.decimals ?? 0 }, locale) : makeFormat(spec.format, locale, rawY);
  let ymin = Math.min(...allY), ymax = Math.max(...allY);
  const refs = spec.refLines || [];
  for (const r of refs) if (r.y !== undefined) { ymin = Math.min(ymin, r.y); ymax = Math.max(ymax, r.y); }
  const yLog = spec.yScale === 'log' && ymin > 0;
  const zero = !yLog && (spec.zero ?? (isArea || (ymin >= 0 && ymin <= ymax * 0.45) || (ymax <= 0 && ymax >= ymin * 0.45)));
  if (zero) { ymin = Math.min(0, ymin); ymax = Math.max(0, ymax); }
  if (spec.yDomain) [ymin, ymax] = spec.yDomain;

  // Colores y foco
  const cmap = colorMap(m.seriesKeys, theme, spec.colors);
  const hl = spec.highlight === undefined ? null : new Set([].concat(spec.highlight).map(String));
  const focus = (k) => !hl || hl.has(k);
  const colorOf = (k) => (focus(k) ? (!multi ? (spec.colors?.[k] || theme.categorical[0]) : cmap.get(k)) : theme.dim);

  // Etiquetas al final: siempre, salvo `labels: false`. Si hay demasiadas para
  // el alto disponible, se rotulan las de mayor valor final y la leyenda cubre el resto.
  const labelMode = spec.labels ?? 'auto';
  const lastOf = (l) => [...l.points].reverse().find((p) => Number.isFinite(p.y));
  const labelSize = theme.type?.label ?? 12;
  const endText = (l) => {
    const last = lastOf(l);
    if (!last) return null;
    const val = fmt(stack ? last.v : last.y);
    return multi ? { name: truncate(l.key, 132, labelSize), val } : { name: '', val };
  };

  const frame = createFrame(spec, theme);
  const want = labelMode !== false;
  // Leyenda solo si alguna serie queda sin etiqueta final.
  const provisionalH = frame.bottom - frame.top - 40;
  const maxLabels = Math.max(1, Math.floor(provisionalH / (labelSize * ctx.textScale + 3)));
  const labeled = want ? m.lines.filter((l) => focus(l.key)).sort((a, b) => (lastOf(b)?.y ?? -Infinity) - (lastOf(a)?.y ?? -Infinity)).slice(0, maxLabels) : [];
  const allLabeled = labeled.length === m.lines.filter((l) => focus(l.key)).length;
  const needLegend = multi && (!want || !allLabeled || spec.legend === true) && spec.legend !== false;
  const legend = needLegend ? m.seriesKeys.map((s) => ({ label: s, color: colorOf(s), shape: isArea ? 'square' : 'line' })) : [];
  const area = frame.layout(legend);

  const endW = labeled.length
    ? Math.max(...labeled.map((l) => { const t = endText(l); return t ? measure(t.val, labelSize, 600) + (t.name ? measure(t.name, labelSize, 500) * 1.04 + 6 * ctx.textScale : 0) : 0; })) + 22
    : 10;

  // Escala y
  const nd = yLog ? logDomain(ymin, ymax) : spec.yDomain ? { min: ymin, max: ymax, step: niceStep(ymax - ymin, Math.max(3, Math.round(area.h / 64))) } : niceDomain(ymin, ymax, Math.max(3, Math.round(area.h / 64)));
  const tickF = yLog ? (v) => fmt.tick(v)(v) : fmt.tick(nd.step);
  const yTicksArr = (yLog ? log(nd.min, nd.max, 0, 1) : linear(nd.min, nd.max, 0, 1)).ticks(nd.step);
  const inside = stack ? false : spec.axisInside;
  const leftM = yAxisMargin(yTicksArr, tickF, theme, inside);
  const yTop = area.y + yAxisTop(theme, inside) + (spec.yLabel ? 16 : 0);
  const inner = { x: area.x + leftM, y: yTop, w: Math.max(80, area.w - leftM - endW), h: area.y + area.h - yTop - 24 * ctx.textScale - (spec.xLabel ? 16 * ctx.textScale : 0) };
  const yS = (yLog ? log : linear)(nd.min, nd.max, inner.y + inner.h, inner.y);

  // Escala x
  let x0 = xsAll[0], x1 = xsAll[xsAll.length - 1];
  if (spec.xDomain) [x0, x1] = spec.xDomain.map((v) => (typeof v === 'number' ? v : m.kind === 'date' ? parseDate(v) : num(v)));
  if (spec._domains) { spec._domains.y = [nd.min, nd.max]; spec._domains.x = [x0, x1]; }
  const xLog = spec.xScale === 'log' && x0 > 0;
  const xS = (xLog ? log : linear)(x0, x1 === x0 ? x0 + 1 : x1, inner.x, inner.x + inner.w);
  const xFmt = (xv) => {
    if (m.kind === 'date') return formatDate(xv, dateUnit(xsAll), locale);
    if (m.kind === 'category') return m.cats[xv];
    if (m.kind === 'year') return String(xv);
    return makeFormat(spec.xFormat, locale, xsAll)(xv);
  };
  let xItems;
  if (m.kind === 'date') {
    xItems = timeTicks(x0, x1, Math.max(2, Math.floor(inner.w / 86)), locale).ticks.map((t) => ({ pos: xS(t.value), label: t.label }));
  } else if (m.kind === 'category') {
    xItems = m.cats.map((c, i) => ({ pos: xS(i), label: c })).filter((it, i) => xsAll.includes(i));
  } else if (xLog) {
    xItems = xS.ticks().map((t) => ({ pos: xS(t), label: makeFormat(spec.xFormat, locale, xsAll).tick(t)(t) }));
  } else {
    let st = niceStep(x1 - x0, Math.max(2, Math.floor(inner.w / 78)));
    const ints = xsAll.every(Number.isInteger);
    if (m.kind === 'year' || ints) st = Math.max(1, Math.round(st));
    const tf = m.kind === 'year' ? (v) => String(v) : makeFormat(spec.xFormat ?? (ints ? 'integer' : undefined), locale, xsAll).tick(st);
    xItems = xS.ticks(st).map((t) => ({ pos: xS(t), label: tf(t) }));
  }

  const body = [];
  const yTicks = yS.ticks(nd.step);
  body.push(yGrid(yTicks, yS, inner, theme, { baseline: zero ? 0 : NaN }));
  if (spec.yLabel) body.push(text(area.x, area.y + 10, spec.yLabel, { fill: theme.lede, fontSize: theme.type?.axis ?? 12, fontWeight: 500 }));
  body.push(xLabels(xItems, inner, theme, { y: inner.y + inner.h + 18, size: theme.type?.axis }));
  if (spec.xLabel) body.push(text(inner.x + inner.w, inner.y + inner.h + 36, spec.xLabel, { fill: theme.lede, fontSize: theme.type?.axis ?? 12, fontWeight: 500, textAnchor: 'end' }));

  // Anotaciones verticales (eventos)
  for (const a of spec.annotations || []) {
    const xv = m.kind === 'category' ? m.cats.indexOf(String(a.x)) : xValue(a.x, m.kind);
    if (!Number.isFinite(xv) || xv < x0 || xv > x1) continue;
    const px = Math.round(xS(xv)) + 0.5;
    body.push(el('line', { x1: px, x2: px, y1: inner.y, y2: inner.y + inner.h, stroke: theme.muted, strokeWidth: 1, opacity: 0.8 }));
    if (a.label) {
      const w = measure(a.label, 11.5, 500);
      const right = px + 5 + w > inner.x + inner.w;
      // A la izquierda de la línea si no cabe a la derecha, sin salirse del área.
      const ax = right ? Math.max(px - 5, area.x + w) : px + 5;
      body.push(text(ax, inner.y + 4, a.label, { fill: theme.lede, fontSize: 11.5, fontWeight: 500, textAnchor: right ? 'end' : 'start', stroke: theme.surface, strokeWidth: 3, paintOrder: 'stroke', strokeLinejoin: 'round' }));
    }
  }

  // Trazos
  const ordered = [...m.lines].sort((a, b) => (focus(a.key) ? 1 : 0) - (focus(b.key) ? 1 : 0));
  const showDots = spec.points ?? spec.markers ?? (m.lines.every((l) => l.points.length <= 12) && m.lines.length <= 3 && !isArea);
  const curve = spec.curve === 'smooth' ? monotonePath : spec.curve === 'step' ? stepPath : linearPath;
  const drawOrder = stack ? [...m.lines].reverse() : ordered;
  const lw = M.lineWidth ?? 2.25;
  const gid = 'pa-grad-' + Math.abs(hash(String(spec.title) + m.y + inner.w)).toString(36);
  let defs = '';
  const washSingle = !multi && !isArea && spec.fill !== false && !m.errorbar && zero;
  for (const l of drawOrder) {
    const c = colorOf(l.key);
    const segs = splitGaps(l.points, xS, yS);
    if (!segs.length) continue;
    const parts = [];
    // Banda de confianza (seaborn): antes de la línea, mismo tono.
    if (m.errorbar && !stack) {
      const bpts = l.points.filter((p) => Number.isFinite(p.lo) && Number.isFinite(p.hi));
      if (bpts.length > 1) {
        const up = bpts.map((p) => [xS(p.x), yS(p.hi)]);
        const dn = bpts.map((p) => [xS(p.x), yS(p.lo)]).reverse();
        parts.push(el('path', { d: curve(up) + 'L' + dn.map(([a, b]) => `${a.toFixed(2)},${b.toFixed(2)}`).join('L') + 'Z', fill: c, fillOpacity: focus(l.key) ? M.bandOpacity ?? 0.16 : 0.06, stroke: 'none' }));
      }
    }
    if (isArea || washSingle) {
      if (washSingle) {
        defs += el('linearGradient', { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 }, [el('stop', { offset: '0%', stopColor: c, stopOpacity: 0.22 }), el('stop', { offset: '100%', stopColor: c, stopOpacity: 0 })]);
      }
      for (const sgm of segs) {
        const top = curve(sgm.map(([a, b]) => [a, b]));
        const base0 = yS(Math.max(nd.min, 0));
        const bottom = stack ? sgm.map(([a, , p]) => [a, yS(p.y0)]).reverse() : [[sgm[sgm.length - 1][0], base0], [sgm[0][0], base0]];
        const d = top + 'L' + bottom.map(([a, b]) => `${a.toFixed(2)},${b.toFixed(2)}`).join('L') + 'Z';
        parts.push(el('path', { d, fill: washSingle ? `url(#${gid})` : c, fillOpacity: washSingle ? 1 : stack ? 0.9 : M.areaOpacity ?? 0.12, stroke: stack ? theme.surface : 'none', strokeWidth: stack ? 1.5 : 0 }));
      }
    }
    if (!stack) for (const sgm of segs) parts.push(el('path', { d: curve(sgm.map(([a, b]) => [a, b])), fill: 'none', stroke: c, strokeWidth: focus(l.key) ? (hl ? lw + 0.75 : lw) : 1.5, strokeLinejoin: 'round', strokeLinecap: 'round' }));
    const pts = segs.flat();
    if (showDots && focus(l.key) && !stack) for (const [a, b] of pts) parts.push(el('circle', { cx: a, cy: b, r: (M.pointRadius ?? 4) - 0.5, fill: c, stroke: theme.surface, strokeWidth: M.ring ?? 2 }));
    if (focus(l.key) && !stack) {
      const [a, b] = pts[pts.length - 1];
      parts.push(el('circle', { cx: a, cy: b, r: (M.pointRadius ?? 4) + 0.5, fill: c, stroke: theme.surface, strokeWidth: M.ring ?? 2 }));
    }
    body.push(g({ class: 'pa-m', 'data-series': l.key }, parts));
  }

  body.push(refLinesY(refs, yS, inner, theme, fmt));
  body.push(yTickLabels(yTicks, yS, inner, theme, tickF, { inside }));

  // Etiquetas finales con separación vertical y líneas guía.
  if (labeled.length) {
    const lh = labelSize * ctx.textScale + 3;
    const labs = labeled.map((l) => {
      const last = lastOf(l);
      const t = endText(l);
      const yy = stack ? yS((last.y + last.y0) / 2) : yS(last.y);
      return { ...t, key: l.key, y: yy, y0: yy, px: xS(last.x), color: colorOf(l.key) };
    }).sort((a, b) => a.y0 - b.y0);
    dodge(labs, lh, inner.y + lh / 2 - 4, inner.y + inner.h + 4);
    const anyMoved = labs.some((lb) => Math.abs(lb.y - lb.y0) > 1.5);
    const lx = inner.x + inner.w + (anyMoved || stack ? 16 : 9);
    for (const lb of labs) {
      const tparts = [];
      if (Math.abs(lb.y - lb.y0) > 1.5 || stack) {
        const sx = lb.px + (stack ? 2 : 7);
        tparts.push(el('path', { d: `M${sx.toFixed(1)},${lb.y0.toFixed(1)}L${(lx - 9).toFixed(1)},${lb.y0.toFixed(1)}L${(lx - 4).toFixed(1)},${lb.y.toFixed(1)}`, fill: 'none', stroke: stack ? theme.muted : lb.color, strokeWidth: 1, opacity: 0.7 }));
      }
      if (lb.name) {
        // La etiqueta lleva el color de su línea (versión legible), así se conecta sin leyenda.
        const tc = readable(lb.color, theme);
        tparts.push(text(lx, lb.y + 4, lb.name, { fill: tc, fontSize: labelSize, fontWeight: 500 }));
        tparts.push(text(lx + measure(lb.name, labelSize, 500) * 1.04 + 6 * ctx.textScale, lb.y + 4, lb.val, { fill: tc, fontSize: labelSize, fontWeight: 700 }));
      } else tparts.push(text(lx, lb.y + 4.5, lb.val, { fill: readable(lb.color, theme), fontSize: labelSize + 0.5, fontWeight: 700 }));
      body.push(g({ class: 'pa-endlabel' }, tparts));
    }
  }

  // Capa de interacción: crosshair con todos los valores en ese x.
  const cross = xsAll.map((xv) => ({
    x: +xS(xv).toFixed(1),
    t: xFmt(xv),
    v: m.lines.filter((l) => focus(l.key)).map((l) => {
      const p = l.points.find((q) => q.x === xv);
      if (!p || !Number.isFinite(p.y)) return null;
      const extra = Number.isFinite(p.lo) ? ` (${fmt(p.lo)}–${fmt(p.hi)})` : '';
      return [multi ? l.key : m.seriesKeys[0], colorOf(l.key), +yS(p.y).toFixed(1), fmt(stack ? p.v : p.y) + extra];
    }).filter(Boolean),
  }));
  body.push(el('rect', { class: 'pa-cross', x: inner.x - 4, y: inner.y, width: inner.w + 8, height: inner.h, fill: 'transparent', 'data-cross': JSON.stringify(cross), 'data-y0': inner.y, 'data-y1': inner.y + inner.h }));

  const desc = describeLine(m, fmt, xFmt, locale);
  return frame.finish(body, { desc, type: isArea ? 'area' : 'line', defs });
}

/** Separa etiquetas en 1D: empuja hacia abajo y, si se pasan, hacia arriba. */
function dodge(labs, h, top, bottom) {
  for (let i = 0; i < labs.length; i++) labs[i].y = Math.max(labs[i].y0, i ? labs[i - 1].y + h : top);
  for (let i = labs.length - 1; i >= 0; i--) {
    const lim = i === labs.length - 1 ? bottom : labs[i + 1].y - h;
    if (labs[i].y > lim) labs[i].y = lim;
  }
  for (let i = 0; i < labs.length; i++) if (labs[i].y < top + i * h) labs[i].y = top + i * h;
}

function splitGaps(points, xS, yS) {
  const segs = [];
  let cur = [];
  for (const p of points) {
    if (Number.isFinite(p.y)) cur.push([xS(p.x), yS(p.y), p]);
    else if (cur.length) { segs.push(cur); cur = []; }
  }
  if (cur.length) segs.push(cur);
  return segs;
}

const f2 = (n) => n.toFixed(2);
function linearPath(pts) {
  return pts.map(([x, y], i) => (i ? 'L' : 'M') + f2(x) + ',' + f2(y)).join('');
}
function stepPath(pts) {
  return pts.map(([x, y], i) => (i ? `H${f2(x)}V${f2(y)}` : `M${f2(x)},${f2(y)}`)).join('');
}

/** Curva monótona (no inventa máximos ni mínimos entre puntos). */
function monotonePath(pts) {
  const n = pts.length;
  if (n < 3) return linearPath(pts);
  const dx = [], dy = [], s = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1][0] - pts[i][0]);
    dy.push(pts[i + 1][1] - pts[i][1]);
    s.push(dy[i] / (dx[i] || 1));
  }
  const t = [s[0]];
  for (let i = 1; i < n - 1; i++) t.push(s[i - 1] * s[i] <= 0 ? 0 : (3 * (dx[i - 1] + dx[i])) / ((2 * dx[i] + dx[i - 1]) / s[i - 1] + (dx[i] + 2 * dx[i - 1]) / s[i]));
  t.push(s[n - 2]);
  let d = 'M' + f2(pts[0][0]) + ',' + f2(pts[0][1]);
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += `C${f2(pts[i][0] + h)},${f2(pts[i][1] + h * t[i])} ${f2(pts[i + 1][0] - h)},${f2(pts[i + 1][1] - h * t[i + 1])} ${f2(pts[i + 1][0])},${f2(pts[i + 1][1])}`;
  }
  return d;
}

export function describeLine(m, fmt, xFmt, locale = 'es') {
  const en = String(locale).startsWith('en');
  const parts = m.lines.slice(0, 6).map((l) => {
    const pts = l.points.filter((p) => Number.isFinite(p.v ?? p.y));
    if (pts.length < 2) return '';
    const a = pts[0], b = pts[pts.length - 1];
    const va = a.v ?? a.y, vb = b.v ?? b.y;
    const ch = va !== 0 ? ((vb - va) / Math.abs(va)) * 100 : null;
    const chs = ch === null || fmt.type === 'percent' ? '' : ` (${ch >= 0 ? '+' : ''}${Math.round(ch)}%)`;
    const max = pts.reduce((p, q) => ((q.v ?? q.y) > (p.v ?? p.y) ? q : p));
    return en
      ? `${l.key}: from ${fmt(va)} (${xFmt(a.x)}) to ${fmt(vb)} (${xFmt(b.x)})${chs}, peak ${fmt(max.v ?? max.y)} in ${xFmt(max.x)}.`
      : `${l.key}: de ${fmt(va)} (${xFmt(a.x)}) a ${fmt(vb)} (${xFmt(b.x)})${chs}, máximo ${fmt(max.v ?? max.y)} en ${xFmt(max.x)}.`;
  });
  return (en ? 'Line chart. ' : 'Gráfico de líneas. ') + parts.filter(Boolean).join(' ');
}
