// Líneas y áreas: series de tiempo, índices base 100, áreas apiladas.
// Etiquetas directas al final de cada línea cuando caben; leyenda siempre
// presente con 2+ series; crosshair + tooltip al pasar el mouse.
import { el, g, text, tip, esc } from '../svg.js';
import { measure, truncate } from '../text.js';
import { makeFormat, formatDate } from '../format.js';
import { niceDomain, linear, log, logDomain, timeTicks, dateUnit, niceStep } from '../scale.js';
import { colorMap } from '../theme.js';
import { ensureData, inferXY, requireField, melt, uniq, aggregate, num, fieldKind, xValue, humanize } from '../data.js';
import { gridY, xLabels, ticksWidth, refLinesY } from '../axes.js';
import { createFrame, SIZES } from '../frame.js';

export function prepareLine(spec) {
  let data = ensureData(spec);
  let series = spec.series ?? spec.color;
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
  const how = spec.aggregate || 'sum';
  const map = new Map(seriesKeys.map((s) => [s, new Map()]));
  for (const r of data) {
    const s = series ? String(r[series]) : seriesKeys[0];
    const xv = kind === 'category' ? cats.indexOf(String(r[x])) : xValue(r[x], kind);
    if (!Number.isFinite(xv)) continue;
    const yv = num(r[y]);
    const m = map.get(s);
    if (!m.has(xv)) m.set(xv, []);
    m.get(xv).push(yv);
  }
  let lines = seriesKeys.map((s) => ({
    key: s,
    points: [...map.get(s).entries()].map(([xv, ys]) => ({ x: xv, y: aggregate(ys, how) })).sort((a, b) => a.x - b.x),
  }));
  if (spec.index) {
    lines = lines.map((l) => {
      const base = l.points.find((p) => Number.isFinite(p.y) && p.y !== 0)?.y;
      return { ...l, points: l.points.map((p) => ({ ...p, raw: p.y, y: base ? (p.y / base) * 100 : NaN })) };
    });
  }
  return { data, x, y, series, seriesKeys, lines, kind, cats };
}

export function line(spec, theme, variant = 'line') {
  const m = prepareLine(spec);
  const locale = spec.locale || 'es';
  const en = String(locale).startsWith('en');
  const isArea = variant === 'area' || spec.area === true;
  const multi = m.lines.length > 1;
  const stack = isArea && multi && spec.stack !== false;
  const xsAll = uniq(m.lines.flatMap((l) => l.points.map((p) => p.x))).sort((a, b) => a - b);

  // Apilado (áreas)
  if (stack) {
    const base = new Map(xsAll.map((xv) => [xv, 0]));
    for (const l of m.lines) {
      const byX = new Map(l.points.map((p) => [p.x, p.y]));
      l.points = xsAll.map((xv) => {
        const v = Number.isFinite(byX.get(xv)) ? byX.get(xv) : 0;
        const y0 = base.get(xv);
        base.set(xv, y0 + v);
        return { x: xv, y: y0 + v, y0, v };
      });
    }
  }

  const allY = m.lines.flatMap((l) => l.points.map((p) => p.y)).filter(Number.isFinite);
  const rawY = m.lines.flatMap((l) => l.points.map((p) => p.v ?? p.y)).filter(Number.isFinite);
  const fmt = spec.index ? makeFormat({ type: 'number', decimals: spec.format?.decimals ?? 0 }, locale) : makeFormat(spec.format, locale, rawY);
  let ymin = Math.min(...allY), ymax = Math.max(...allY);
  const refs = spec.refLines || [];
  for (const r of refs) if (r.y !== undefined) { ymin = Math.min(ymin, r.y); ymax = Math.max(ymax, r.y); }
  const zero = spec.zero ?? (isArea || (ymin >= 0 && ymin <= ymax * 0.45) || (ymax <= 0 && ymax >= ymin * 0.45));
  if (zero) { ymin = Math.min(0, ymin); ymax = Math.max(0, ymax); }

  // Colores y foco
  const cmap = colorMap(m.seriesKeys, theme, spec.colors);
  const hl = spec.highlight === undefined ? null : new Set([].concat(spec.highlight).map(String));
  const focus = (k) => !hl || hl.has(k);
  const colorOf = (k) => (focus(k) ? (hl && !multi ? theme.categorical[0] : cmap.get(k)) : theme.dim);

  const legend = multi ? m.seriesKeys.map((s) => ({ label: s, color: colorOf(s), shape: isArea ? 'square' : 'line' })) : [];
  const frame = createFrame(spec, theme, { height: 400 });
  const area = frame.layout(legend);

  // Etiquetas directas al final
  const labelMode = spec.labels ?? 'auto';
  const labeled = m.lines.filter((l) => focus(l.key));
  const wantEnd = labelMode !== false && (labelMode === true || labeled.length <= 4);
  const endText = (l) => {
    const last = [...l.points].reverse().find((p) => Number.isFinite(p.y));
    if (!last) return null;
    const val = fmt(stack ? last.v : last.y);
    return multi ? { name: truncate(l.key, 120, 12), val } : { name: '', val };
  };
  const endW = wantEnd ? Math.max(0, ...labeled.map((l) => { const t = endText(l); return t ? measure(t.val, 12, 600) + (t.name ? measure(t.name, 12) + 7 : 0) : 0; })) + 14 : 10;

  // Escala y
  const yLog = spec.yScale === 'log' && ymin > 0;
  const nd = yLog ? logDomain(ymin, ymax) : niceDomain(ymin, ymax, Math.max(3, Math.round(area.h / 64)));
  const tickF = yLog ? fmt : fmt.tick(nd.step);
  const yTop = area.y + (spec.yLabel ? 22 : 6);
  const yTicksTmp = yLog ? log(nd.min, nd.max, 0, 1).ticks() : linear(nd.min, nd.max, 0, 1).ticks(nd.step);
  const leftM = ticksWidth(yTicksTmp, tickF) + 10;
  const inner = { x: area.x + leftM, y: yTop, w: area.w - leftM - endW, h: area.y + area.h - yTop - 26 };
  const yS = yLog ? log(nd.min, nd.max, inner.y + inner.h, inner.y) : linear(nd.min, nd.max, inner.y + inner.h, inner.y);

  // Escala x
  const x0 = xsAll[0], x1 = xsAll[xsAll.length - 1];
  const xS = linear(x0, x1 === x0 ? x0 + 1 : x1, inner.x, inner.x + inner.w);
  let xItems;
  const xFmt = (xv) => {
    if (m.kind === 'date') return formatDate(xv, dateUnit(xsAll), locale);
    if (m.kind === 'category') return m.cats[xv];
    if (m.kind === 'year') return String(xv);
    return makeFormat(spec.xFormat, locale, xsAll)(xv);
  };
  if (m.kind === 'date') {
    xItems = timeTicks(x0, x1, Math.max(2, Math.floor(inner.w / 90)), locale).ticks.map((t) => ({ pos: xS(t.value), label: t.label }));
  } else if (m.kind === 'category') {
    xItems = m.cats.map((c, i) => ({ pos: xS(i), label: c }));
  } else {
    let st = niceStep(x1 - x0, Math.max(2, Math.floor(inner.w / 80)));
    if (m.kind === 'year') st = Math.max(1, Math.round(st));
    const tf = m.kind === 'year' ? (v) => String(v) : makeFormat(spec.xFormat, locale, xsAll).tick(st);
    xItems = xS.ticks(st).map((t) => ({ pos: xS(t), label: tf(t) }));
  }

  const body = [];
  body.push(gridY(yS.ticks(nd.step), yS, inner, theme, tickF, { baseline: zero ? 0 : NaN }));
  if (spec.yLabel) body.push(text(area.x, area.y + 10, spec.yLabel, { fill: theme.lede, fontSize: SIZES.axis }));
  body.push(xLabels(xItems, inner, theme, { y: inner.y + inner.h + 19 }));

  // Anotaciones verticales (eventos)
  for (const a of spec.annotations || []) {
    const xv = m.kind === 'category' ? m.cats.indexOf(String(a.x)) : xValue(a.x, m.kind);
    if (!Number.isFinite(xv)) continue;
    const px = Math.round(xS(xv)) + 0.5;
    body.push(el('line', { x1: px, x2: px, y1: inner.y, y2: inner.y + inner.h, stroke: theme.muted, strokeWidth: 1 }));
    if (a.label) body.push(text(px + 5, inner.y + 10, a.label, { fill: theme.lede, fontSize: 11.5, fontWeight: 500, stroke: theme.surface, strokeWidth: 3, paintOrder: 'stroke', strokeLinejoin: 'round' }));
  }

  // Trazos
  const ordered = [...m.lines].sort((a, b) => (focus(a.key) ? 1 : 0) - (focus(b.key) ? 1 : 0));
  const showDots = spec.points ?? (m.lines.every((l) => l.points.length <= 12) && m.lines.length <= 3 && !isArea);
  const curve = spec.curve === 'smooth' ? monotonePath : linearPath;
  const drawOrder = stack ? [...m.lines].reverse() : ordered;
  for (const l of drawOrder) {
    const c = colorOf(l.key);
    const pts = l.points.filter((p) => Number.isFinite(p.y)).map((p) => [xS(p.x), yS(p.y), p]);
    if (!pts.length) continue;
    const segs = splitGaps(l.points, xS, yS);
    const parts = [];
    if (isArea) {
      for (const sgm of segs) {
        const top = curve(sgm.map(([a, b]) => [a, b]));
        const bottom = stack
          ? sgm.map(([a, , p]) => [a, yS(p.y0)]).reverse()
          : [[sgm[sgm.length - 1][0], yS(Math.max(nd.min, 0))], [sgm[0][0], yS(Math.max(nd.min, 0))]];
        const d = top + 'L' + bottom.map(([a, b]) => `${a.toFixed(2)},${b.toFixed(2)}`).join('L') + 'Z';
        parts.push(el('path', { d, fill: c, fillOpacity: stack ? 0.88 : 0.12, stroke: stack ? theme.surface : 'none', strokeWidth: stack ? 1.5 : 0 }));
      }
    }
    if (!stack) for (const sgm of segs) parts.push(el('path', { d: curve(sgm.map(([a, b]) => [a, b])), fill: 'none', stroke: c, strokeWidth: focus(l.key) ? (hl ? 2.75 : 2) : 1.5, strokeLinejoin: 'round', strokeLinecap: 'round' }));
    if (showDots && focus(l.key)) for (const [a, b] of pts) parts.push(el('circle', { cx: a, cy: b, r: 3.5, fill: c, stroke: theme.surface, strokeWidth: 2 }));
    if (focus(l.key) && !stack) {
      const [a, b] = pts[pts.length - 1];
      parts.push(el('circle', { cx: a, cy: b, r: 4.5, fill: c, stroke: theme.surface, strokeWidth: 2 }));
    }
    body.push(g({ class: 'pa-m', 'data-series': l.key }, parts));
  }

  // Etiquetas al final, sin colisiones (si chocan, la leyenda y el tooltip bastan).
  if (wantEnd) {
    const labs = labeled.map((l) => {
      const last = [...l.points].reverse().find((p) => Number.isFinite(p.y));
      if (!last) return null;
      const t = endText(l);
      const yy = stack ? yS((last.y + last.y0) / 2) : yS(last.y);
      return { ...t, y: yy, y0: yy, x: xS(last.x) + 9 };
    }).filter(Boolean).sort((a, b) => a.y - b.y);
    // Pequeño empuje (≤ 6px) para separar etiquetas casi juntas.
    for (let it = 0; it < 20; it++) {
      for (let i = 1; i < labs.length; i++) {
        const d = labs[i].y - labs[i - 1].y;
        if (d < 14) { const s = (14 - d) / 2; labs[i].y += s; labs[i - 1].y -= s; }
      }
    }
    const ok = labs.every((lb, i) => i === 0 || lb.y - labs[i - 1].y >= 13.5) && labs.every((lb) => Math.abs(lb.y - lb.y0) <= 7);
    if (ok) for (const lb of labs) {
      const tparts = [];
      if (lb.name) {
        tparts.push(text(lb.x, lb.y + 4, lb.name, { fill: theme.lede, fontSize: 12 }));
        tparts.push(text(lb.x + measure(lb.name, 12) + 7, lb.y + 4, lb.val, { fill: theme.ink, fontSize: 12, fontWeight: 600 }));
      } else tparts.push(text(lb.x, lb.y + 4, lb.val, { fill: theme.ink, fontSize: 12.5, fontWeight: 600 }));
      body.push(g({ class: 'pa-endlabel' }, tparts));
    }
  }

  body.push(refLinesY(refs, yS, inner, theme, fmt));

  // Capa de interacción: crosshair con todos los valores en ese x.
  const cross = xsAll.map((xv) => ({
    x: +xS(xv).toFixed(1),
    t: xFmt(xv),
    v: m.lines.filter((l) => focus(l.key) || !hl).map((l) => {
      const p = l.points.find((q) => q.x === xv);
      if (!p || !Number.isFinite(p.y)) return null;
      return [l.key, colorOf(l.key), +yS(p.y).toFixed(1), fmt(stack ? p.v : p.y)];
    }).filter(Boolean),
  }));
  body.push(el('rect', { class: 'pa-cross', x: inner.x - 4, y: inner.y, width: inner.w + 8, height: inner.h, fill: 'transparent', 'data-cross': JSON.stringify(cross), 'data-y0': inner.y, 'data-y1': inner.y + inner.h }));

  const desc = describeLine(m, fmt, xFmt, locale);
  return frame.finish(body, { desc, type: isArea ? 'area' : 'line' });
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
    const chs = ch === null ? '' : ` (${ch >= 0 ? '+' : ''}${fmt.type === 'percent' ? '' : Math.round(ch) + '%'})`.replace(' (+)', '').replace(' ()', '');
    const max = pts.reduce((p, q) => ((q.v ?? q.y) > (p.v ?? p.y) ? q : p));
    return en
      ? `${l.key}: from ${fmt(va)} (${xFmt(a.x)}) to ${fmt(vb)} (${xFmt(b.x)})${chs}, peak ${fmt(max.v ?? max.y)} in ${xFmt(max.x)}.`
      : `${l.key}: de ${fmt(va)} (${xFmt(a.x)}) a ${fmt(vb)} (${xFmt(b.x)})${chs}, máximo ${fmt(max.v ?? max.y)} en ${xFmt(max.x)}.`;
  });
  return (en ? 'Line chart. ' : 'Gráfico de líneas. ') + parts.filter(Boolean).join(' ');
}
