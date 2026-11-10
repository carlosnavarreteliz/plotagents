// Gráficos categóricos al estilo seaborn: caja (box), violín (violin),
// puntos con dispersión (strip), enjambre (swarm) y estimación con
// intervalo (point). Categorías en un eje, valores numéricos en el otro;
// `hue` (alias de `series`) separa grupos por color.
import { el, g, text, tip, dotLayer } from '../svg.js';
import { measure, truncate } from '../text.js';
import { makeFormat } from '../format.js';
import { niceDomain, niceStep, linear, log, logDomain, band } from '../scale.js';
import { colorMap, readable } from '../theme.js';
import { ensureData, requireField, uniq, num, fieldsOf, fieldKind, humanize, PlotError } from '../data.js';
import { gridX, xLabels, yAxisMargin, yAxisTop, yGrid, yTickLabels, refLinesY, refLinesX, groupRuns, groupBandX, groupBandY, groupBandWidth, GROUP_BAND } from '../axes.js';
import { createFrame } from '../frame.js';
import { ctx } from '../context.js';
import { tipper } from '../tooltip.js';
import { fiveNumber, kde, scottBandwidth, meanCI, mean, median, sd, sum, finite, quantile } from '../stats.js';

const T = (en, es, locale) => (String(locale || 'es').startsWith('en') ? en : es);

/** Pseudoaleatorio determinista en [0,1) a partir de un entero. */
function rand(i) {
  let x = (i + 1) * 2654435761;
  x ^= x >>> 16; x = Math.imul(x, 2246822507); x ^= x >>> 13; x = Math.imul(x, 3266489909); x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

// ── Preparación común ──────────────────────────────────────────────────────

function prepare(spec) {
  const data = ensureData(spec);
  const fields = fieldsOf(data);
  const kinds = Object.fromEntries(fields.map((f) => [f, fieldKind(data, f)]));
  const isNum = (f) => kinds[f] === 'number';
  const hue = spec.hue ?? spec.series ?? (typeof spec.color === 'string' && !spec.color.startsWith('#') ? spec.color : undefined);
  let cat, val, swapped = false;
  const { x, y } = spec;
  if (x && y) {
    if (isNum(x) && !isNum(y)) { cat = y; val = x; swapped = true; }
    else { cat = x; val = y; }
  } else if (y && !x) { val = y; cat = isNum(y) ? null : null; }
  else if (x && !y) { if (isNum(x)) { val = x; swapped = true; } else { cat = x; val = fields.find((f) => isNum(f) && f !== hue); } }
  else {
    val = fields.find((f) => isNum(f) && f !== hue);
    cat = fields.find((f) => !isNum(f) && f !== hue && f !== val) ?? null;
  }
  requireField(data, val, 'y (valor)');
  if (cat) requireField(data, cat, 'x (categoría)');
  if (hue) requireField(data, hue, 'hue');
  const catOf = (r) => (cat ? String(r[cat] ?? '') : '');
  const cats = Array.isArray(spec.order) ? spec.order.map(String) : uniq(data.map(catOf));
  const hues = hue ? (Array.isArray(spec.hueOrder) ? spec.hueOrder.map(String) : uniq(data.map((r) => String(r[hue])))) : [''];
  const groups = new Map();
  const groupRows = new Map();
  for (const r of data) {
    const v = num(r[val]);
    if (!Number.isFinite(v)) continue;
    const k = catOf(r) + '\u0000' + (hue ? String(r[hue]) : '');
    if (!groups.has(k)) { groups.set(k, []); groupRows.set(k, []); }
    groups.get(k).push(v);
    groupRows.get(k).push(r);
  }
  const get = (c, h) => groups.get(c + '\u0000' + h) || [];
  // Las filas detrás de cada valor, en el mismo orden (para el tooltip de cada punto).
  const rowsOf = (c, h) => groupRows.get(c + '\u0000' + h) || [];
  const all = [...groups.values()].flat();
  // Sin un solo número no hay eje de valores que dibujar.
  if (!all.length) {
    const en = String(spec.locale || 'es').startsWith('en');
    throw en
      ? new PlotError(`No numeric values in \`${val}\`.`, `\`${val}\` must hold numbers (empty, null and non-finite values are skipped). To count rows per category, use \`type: "countplot"\`.`)
      : new PlotError(`No hay valores numéricos en \`${val}\`.`, `\`${val}\` debe tener números (se omiten vacíos, nulos y valores no finitos). Para contar filas por categoría usa \`type: "countplot"\`.`);
  }
  return { data, cat, val, hue, cats, hues, get, rowsOf, all, swapped };
}

/**
 * Ejes, escalas, colores y leyenda compartidos por los cinco gráficos.
 * `extent` = [min, max] de los valores a mostrar (incluye bigotes, IC, etc.).
 */
function setup(spec, theme, m, extent, { type, zero = false, dodge = true, rowStep, tight = false } = {}) {
  const locale = spec.locale || 'es';
  const vertical = !(spec.horizontal ?? (spec.orient === 'h' ? true : spec.orient === 'v' ? false : undefined) ?? autoHorizontal(spec, m));
  const valueScale = (vertical ? spec.yScale : spec.xScale) ?? spec.valueScale ?? spec.scale;
  // Dominio del eje de valores: `yDomain` manda siempre (también en horizontal, para facetas).
  const dom = spec.yDomain ?? (vertical ? undefined : spec.xDomain) ?? spec.valueDomain;
  // `clamp` (con un dominio): lo que cae fuera se dibuja en el borde, y la
  // marca del borde lo dice (≤ / ≥). Un cero en log, con clamp, va al borde.
  const clamp = !!spec.clamp && Array.isArray(dom) && dom.length === 2 && dom.every(Number.isFinite) && dom[0] < dom[1];
  const isLog = valueScale === 'log' && (extent[0] > 0 || (clamp && dom[0] > 0));
  const fmt = makeFormat(spec.format, locale, m.all);
  const multiHue = m.hues.length > 1;
  const cmap = colorMap(m.hues, theme, spec.colors);
  const hl = spec.highlight === undefined ? null : new Set([].concat(spec.highlight).map(String));
  const colorOf = (c, h) => {
    if (hl && !hl.has(c) && !hl.has(h)) return theme.dim;
    if (multiHue) return cmap.get(h);
    if (spec.colors && spec.colors[c]) return spec.colors[c];
    return theme.categorical[0];
  };
  const legend = multiHue ? m.hues.map((h) => ({ label: h, color: hl && !hl.has(h) ? theme.dim : cmap.get(h), shape: type === 'point' ? 'line' : 'square' })) : [];

  const frame = createFrame(spec, theme, { height: 420 });
  let area = frame.layout(spec.legend === false ? [] : legend);
  let lo = extent[0], hi = extent[1];
  if (zero && !isLog) { lo = Math.min(0, lo); hi = Math.max(0, hi); }
  const axisSize = theme.type?.axis ?? 11.5;
  const yTitle = vertical ? spec.yLabel ?? humanize(m.val) : spec.yLabel;
  const xTitle = vertical ? spec.xLabel : spec.xLabel ?? humanize(m.val);
  const body = { pre: [], marks: [], post: [] };
  let valS, nd, ticks, tickFmt, inner, catS, step, placeLabels = null;
  // Grupos del eje de categorías (xGroup / yGroup, cualquiera de los dos).
  const groupF = m.cat ? spec.xGroup ?? spec.yGroup : null;
  if (groupF) requireField(m.data, groupF, spec.xGroup ? 'xGroup' : 'yGroup');
  const runs = groupF ? groupRuns(m.cats, m.data, m.cat, groupF) : null;
  const tickEvery = Math.max(1, Math.floor((spec.xTicks ?? spec.yTicks)?.every ?? 1));

  if (vertical) {
    const top = yAxisTop(theme) + (yTitle ? 18 : 0);
    const bottom = (m.cat ? 24 : 6) + (xTitle ? 18 : 0) + (runs ? GROUP_BAND : 0);
    const h0 = area.h - top - bottom;
    if (isLog) { nd = dom ? { min: dom[0], max: dom[1] } : logDomain(lo, hi); ticks = log(nd.min, nd.max, 0, 1).ticks(); tickFmt = fmt; }
    else { const cnt = Math.max(4, Math.round(h0 / 56)); nd = dom ? { min: dom[0], max: dom[1], step: niceStep(dom[1] - dom[0], cnt) } : niceDomain(lo, hi, cnt); ticks = linear(nd.min, nd.max, 0, 1).ticks(nd.step).filter((t) => t >= nd.min - 1e-9 && t <= nd.max + 1e-9); tickFmt = fmt.tick(nd.step); }
    if (clamp) tickFmt = clampTicks(tickFmt, nd, m.all, spec.clamp === 'always');
    const leftM = yAxisMargin(ticks, tickFmt, theme);
    inner = { x: area.x + leftM, y: area.y + top, w: area.w - leftM, h: h0 };
    valS = (isLog ? log : linear)(nd.min, nd.max, inner.y + inner.h, inner.y);
    if (clamp) valS = clampScale(valS, nd);
    catS = band(m.cats, inner.x, inner.x + inner.w, { inner: 0.28, outer: 0.12 });
    body.pre.push(yGrid(ticks, valS, inner, theme, { baseline: zero ? 0 : NaN }));
    body.post.push(yTickLabels(ticks, valS, inner, theme, tickFmt));
    if (yTitle) body.post.push(text(area.x, area.y + 10, yTitle, { fill: theme.lede, fontSize: axisSize, fontWeight: 500 }));
    if (m.cat) {
      const items = m.cats.map((c) => ({ pos: catS.center(c), label: truncate(c, Math.max(40, catS.step - 6), axisSize + 0.5) }));
      body.post.push(xLabels(items, inner, theme, { y: inner.y + inner.h + 18, size: axisSize + 0.5, color: theme.lede, every: tickEvery }));
      if (runs) body.post.push(groupBandX(runs, (i) => [catS.center(m.cats[i]) - catS.step / 2 + 1, catS.center(m.cats[i]) + catS.step / 2 - 1], inner.y + inner.h + 24 + (xTitle ? 18 : 0), theme, inner.y));
    }
    body.pre.push(el('line', { x1: inner.x, x2: inner.x + inner.w, y1: inner.y + inner.h + 0.5, y2: inner.y + inner.h + 0.5, stroke: theme.axis, strokeWidth: 1 }));
    if (xTitle) body.post.push(text(inner.x + inner.w, inner.y + inner.h + 22 + 18 * ctx.textScale, xTitle, { fill: theme.lede, fontSize: axisSize, fontWeight: 500, textAnchor: 'end' }));
  } else {
    // `yLabelPosition: 'above'`: el nombre de cada fila va sobre ella (el eje
    // se queda con todo el ancho, para un teléfono).
    const above = spec.yLabelPosition === 'above' && !!m.cat;
    // strip/swarm (`tight`): cada fila es una franja de `rowHeight` con el
    // nombre arriba y los puntos debajo; el nombre se pega a sus puntos.
    const tightAbove = above && tight;
    const labelW = m.cat && !above ? Math.min(Math.max(...m.cats.map((c) => measure(c, axisSize + 0.5))), area.w * (area.w < 500 ? 0.42 : 0.32)) + 12 : 0;
    step = rowStep ?? rowHeightOf(spec) ?? (multiHue && dodge ? Math.max(30, 22 * m.hues.length + 12) : 46);
    // Con `rowHeight` (o el paso que pide un enjambre de radio fijo), el paso
    // entre filas es exactamente ese: el alto suma el relleno de la banda.
    const exact = rowStep !== undefined || rowHeightOf(spec) !== undefined;
    const span = !exact ? m.cats.length * step : tightAbove ? m.cats.length * step : (m.cats.length - (above ? 0.42 : 0.28) + 0.16) * step + (above ? 14 : 0);
    if (spec.height === undefined) {
      frame.setHeight(area.y + span + 30 + (xTitle ? 20 : 0) + frame.chrome);
      area = { ...area, h: frame.bottom - area.y };
    }
    const gW = runs ? groupBandWidth(runs, area.w * 0.22) : 0;
    // `xLabelPosition: "top"`: el eje de valores (marcas y título) sobre las
    // filas; el alto total no cambia, la banda de 30 px pasa de abajo a arriba.
    const xTop = spec.xLabelPosition === 'top';
    const xtH = xTitle ? 20 : 0;
    inner = xTop
      ? { x: area.x + gW + labelW, y: area.y + 26 + xtH, w: area.w - gW - labelW - 10, h: area.h - 30 - xtH }
      : { x: area.x + gW + labelW, y: area.y + 4, w: area.w - gW - labelW - 10, h: area.h - 30 - xtH };
    if (above && !tightAbove) { inner.y += 14; inner.h -= 14; }
    if (isLog) { nd = dom ? { min: dom[0], max: dom[1] } : logDomain(lo, hi); ticks = log(nd.min, nd.max, 0, 1).ticks(); tickFmt = fmt; }
    else { const cnt = Math.max(4, Math.round(inner.w / 100)); nd = dom ? { min: dom[0], max: dom[1], step: niceStep(dom[1] - dom[0], cnt) } : niceDomain(lo, hi, cnt); ticks = linear(nd.min, nd.max, 0, 1).ticks(nd.step).filter((t) => t >= nd.min - 1e-9 && t <= nd.max + 1e-9); tickFmt = fmt.tick(nd.step); }
    valS = (isLog ? log : linear)(nd.min, nd.max, inner.x, inner.x + inner.w);
    if (clamp) { valS = clampScale(valS, nd); tickFmt = clampTicks(tickFmt, nd, m.all, spec.clamp === 'always'); }
    const lineH = (axisSize + 0.5) * ctx.textScale + 4;
    catS = tightAbove ? rowBands(m.cats, inner.y, inner.h, lineH) : band(m.cats, inner.y, inner.y + inner.h, { inner: above ? 0.42 : 0.28, outer: 0.08 });
    body.pre.push(gridX(ticks, valS, inner, theme, tickFmt, { baseline: zero ? 0 : NaN, ...(xTop ? { labelY: inner.y - 8 - (ctx.textScale - 1) * 20 } : {}) }));
    const rowSpan = (c) => (tightAbove ? [catS.top(c) + 1, catS.top(c) + catS.step - 1] : [catS.center(c) - catS.step / 2 + 1, catS.center(c) + catS.step / 2 - 1]);
    if (runs) body.pre.push(groupBandY(runs, (i) => rowSpan(m.cats[i]), area.x, gW, theme, inner.x + inner.w));
    const label = (c, y, attrs) => text(attrs ? inner.x - 10 : inner.x, y, truncate(c, attrs ? labelW - 12 : inner.w, axisSize + 0.5), { fill: !hl || hl.has(c) ? theme.ink : theme.muted, fontSize: axisSize + 0.5, ...attrs });
    if (m.cat && tightAbove) {
      // El nombre va justo sobre el punto más alto de su fila (lo ubica cada
      // gráfico con `placeLabels`), sin subir más allá de la franja.
      const at = body.post.length;
      placeLabels = (topOf) => {
        const out = [];
        for (const [ci, c] of m.cats.entries()) {
          if (ci % tickEvery) continue;
          const dotTop = topOf.get(c) ?? catS.center(c) - 4;
          out.push(label(c, Math.max(catS.top(c) + (axisSize + 0.5) * ctx.textScale, dotTop - 4)));
        }
        body.post.splice(at, 0, ...out);
      };
    } else if (m.cat) for (const [ci, c] of m.cats.entries()) {
      if (ci % tickEvery) continue;
      if (above) body.post.push(label(c, catS(c) - 4));
      else body.post.push(label(c, catS.center(c) + 4.5, { textAnchor: 'end' }));
    }
    if (xTitle) body.post.push(text(inner.x + inner.w, xTop ? area.y + axisSize : inner.y + inner.h + 22 + 18 * ctx.textScale, xTitle, { fill: theme.lede, fontSize: axisSize, fontWeight: 500, textAnchor: 'end' }));
  }

  if (spec._domains && typeof spec._domains === 'object') spec._domains.y = [nd.min, nd.max];
  // Líneas de referencia en el eje de valores (metas, umbrales).
  const refs = [].concat(spec.refLines ?? []).filter((r) => r && typeof r === 'object').map((r) => ({ ...r, y: r.value ?? r.y ?? r.x }));
  if (refs.length) body.post.push(vertical ? refLinesY(refs, valS, inner, theme, fmt) : refLinesX(refs.map((r) => ({ ...r, x: r.y, y: undefined })), valS, inner, theme, fmt));

  // `rowLine`: una guía por categoría, de punta a punta del eje de valores,
  // detrás de las marcas (true: continua; "dashed": 2 3).
  if (spec.rowLine && m.cat) {
    const dash = spec.rowLine === 'dashed' ? '2 3' : null;
    const lines = m.cats.map((c) => {
      const p = Math.round(catS.center(c)) + 0.5;
      return vertical
        ? el('line', { x1: p, x2: p, y1: inner.y, y2: inner.y + inner.h, stroke: theme.grid, strokeWidth: 1, strokeDasharray: dash })
        : el('line', { x1: inner.x, x2: inner.x + inner.w, y1: p, y2: p, stroke: theme.grid, strokeWidth: 1, strokeDasharray: dash });
    });
    body.pre.push(g({ class: 'pa-rowlines' }, lines));
  }

  // Posición en el eje de categorías: centro de cada grupo (con "dodge" por hue).
  const k = multiHue && dodge ? m.hues.length : 1;
  const slot = catS.bandwidth / k;
  const center = (c, hi2) => catS(c) + (k > 1 ? slot * (hi2 + 0.5) : catS.bandwidth / 2);
  const P = (cpos, v) => (vertical ? [cpos, valS(v)] : [valS(v), cpos]);
  // Sin `placeLabels` pedido por el gráfico, los nombres van a la altura por defecto.
  const s = { frame, vertical, valS, catS, slot, center, P, fmt, colorOf, body, inner, locale, hl, multiHue, step, placeLabels };
  return s;
}

/**
 * `clamp`: la escala lleva lo de fuera al borde del dominio, y la marca del
 * borde dice «≤» o «≥» cuando algún valor quedó más allá.
 */
function clampScale(sc, nd) {
  const s = (v) => sc(Math.min(nd.max, Math.max(nd.min, v)));
  return Object.assign(s, sc);
}
function clampTicks(tf, nd, all, always = false) {
  // `clamp: "always"`: los bordes llevan ≤ / ≥ aunque ningún valor los pase.
  const below = always || all.some((v) => v < nd.min), over = always || all.some((v) => v > nd.max);
  const at = (t, b) => Math.abs(t - b) <= Math.abs(b) * 1e-9 + 1e-12;
  return (t) => (below && at(t, nd.min) ? `≤ ${tf(t)}` : over && at(t, nd.max) ? `≥ ${tf(t)}` : tf(t));
}

/** `rowHeight`: px por fila en horizontal (un número positivo), o undefined. */
function rowHeightOf(spec) {
  const h = +spec.rowHeight;
  return spec.rowHeight != null && Number.isFinite(h) && h > 0 ? h : undefined;
}

/**
 * Filas de alto fijo para `yLabelPosition: "above"` en strip/swarm: la franja
 * de cada fila lleva una línea de texto arriba y la banda de puntos debajo.
 * Misma forma que `band()` (s(c) = inicio de la banda, center, bandwidth,
 * step) más `top(c)`, el borde superior de la fila.
 */
function rowBands(cats, y0, h, lineH) {
  const n = Math.max(1, cats.length);
  const step = h / n;
  const bw = Math.max(1, step - lineH - 2);
  const idx = new Map(cats.map((d, i) => [d, i]));
  const top = (c) => y0 + (idx.get(c) ?? 0) * step;
  const s = (c) => top(c) + lineH;
  s.bandwidth = bw;
  s.step = step;
  s.domain = cats;
  s.center = (c) => s(c) + bw / 2;
  s.top = top;
  return s;
}

function autoHorizontal(spec, m) {
  if (m.swapped) return true;
  if (!m.cat) return false;
  const w = (spec.width || 720) - 48;
  const slot = w / Math.max(1, m.cats.length);
  const longest = Math.max(...m.cats.map((c) => measure(c, 12)));
  return m.cats.length > 10 || longest > slot - 10;
}

const finish = (s, desc, type, css = '') => s.frame.finish([...s.body.pre, ...s.body.marks, ...s.body.post], { desc, type, css });
const extentOf = (vs) => [Math.min(...vs), Math.max(...vs)];

/** Segmento (línea) en coordenadas de categoría/valor. */
function seg(s, cpos0, v0, cpos1, v1, attrs) {
  const [x1, y1] = s.P(cpos0, v0), [x2, y2] = s.P(cpos1, v1);
  return el('line', { x1, y1, x2, y2, ...attrs });
}

/** Rectángulo entre dos valores, centrado en cpos con ancho w (eje de categorías). */
function rectBetween(s, cpos, w, v0, v1, attrs) {
  const a = s.valS(v0), b = s.valS(v1);
  return s.vertical
    ? el('rect', { x: cpos - w / 2, y: Math.min(a, b), width: w, height: Math.max(0.5, Math.abs(a - b)), ...attrs })
    : el('rect', { x: Math.min(a, b), y: cpos - w / 2, width: Math.max(0.5, Math.abs(a - b)), height: w, ...attrs });
}

function strips(s, theme, vals, cpos, width, color, seed, r) {
  return vals.map((v, i) => {
    const off = (rand(seed * 7919 + i) - 0.5) * width;
    const [x, y] = s.P(cpos + off, v);
    return el('circle', { cx: x, cy: y, r, fill: color, fillOpacity: 0.55, stroke: 'none' });
  });
}

const fmtTipLabel = (c, h) => [c, h].filter(Boolean).join(' · ');

const r1 = (n) => Math.round(n * 10) / 10;

/**
 * `leanDots: true` (strip, swarm): el estilo de los puntos va una vez en su
 * grupo —`<g class="pa-dots" fill fill-opacity stroke stroke-width>`— y cada
 * punto lleva sólo `cx`, `cy` (a un decimal), `r` y su tooltip. Con pieles,
 * la variable del color también va una vez, en el grupo. Sin `stroke` en el
 * punto, una regla de la página lo pinta al pasar el mouse
 * (`.pa-dots .pa-m:hover { stroke: … }`). Puntos seguidos del mismo estilo
 * comparten grupo (el orden de dibujo no cambia). Con más de 1.500 puntos
 * manda la capa densa de siempre.
 */
function dotMarks(dots, lean) {
  if (!lean || dots.length > 1500) return dotLayer(dots);
  const out = [];
  let run = null, key = null;
  const flush = () => {
    if (!run) return;
    const a = run[0];
    out.push(g({ class: 'pa-dots', fill: a.fill, fillOpacity: a.fillOpacity, stroke: a.stroke, strokeWidth: a.strokeWidth },
      run.map((d) => el('circle', { class: d.class, cx: r1(d.cx), cy: r1(d.cy), r: d.r, 'data-tip': d['data-tip'] }))));
    run = null;
  };
  for (const d of dots) {
    const k = [d.fill, d.fillOpacity, d.stroke, d.strokeWidth].join('|');
    if (k !== key) { flush(); run = []; key = k; }
    run.push(d);
  }
  flush();
  return out.join('');
}

/** El trazo al pasar el mouse sobre un punto `leanDots`: el color del texto de la página. */
const LEAN_CSS = '.pa-dots .pa-m:hover{stroke:currentColor;stroke-width:1.5px}';

// ── Caja ───────────────────────────────────────────────────────────────────

export function box(spec, theme) {
  const m = prepare(spec);
  const stats = new Map();
  const ext = [];
  for (const c of m.cats) for (const h of m.hues) {
    const vs = m.get(c, h);
    if (!vs.length) continue;
    const f = fiveNumber(vs);
    stats.set(c + '\u0000' + h, f);
    ext.push(f.min, f.max);
  }
  const s = setup(spec, theme, m, extentOf(ext), { type: 'box' });
  const lw = theme.marks?.lineWidth ?? 2;
  m.cats.forEach((c) => m.hues.forEach((h, hi2) => {
    const f = stats.get(c + '\u0000' + h);
    if (!f) return;
    const color = s.colorOf(c, h);
    const cpos = s.center(c, hi2);
    const w = Math.min(s.slot * 0.72, 64);
    const parts = [];
    parts.push(seg(s, cpos, f.whiskerLo, cpos, f.q1, { stroke: color, strokeWidth: 1.5, strokeLinecap: 'round' }));
    parts.push(seg(s, cpos, f.q3, cpos, f.whiskerHi, { stroke: color, strokeWidth: 1.5, strokeLinecap: 'round' }));
    for (const v of [f.whiskerLo, f.whiskerHi]) parts.push(seg(s, cpos - w * 0.22, v, cpos + w * 0.22, v, { stroke: color, strokeWidth: 1.5, strokeLinecap: 'round' }));
    parts.push(rectBetween(s, cpos, w, f.q1, f.q3, { rx: 3, fill: color, fillOpacity: 0.16, stroke: color, strokeWidth: 1.5 }));
    if (spec.points) parts.push(...strips(s, theme, m.get(c, h), cpos, w * 0.6, color, hi2 * 131 + m.cats.indexOf(c), 2.4));
    parts.push(seg(s, cpos - w / 2 + 0.75, f.median, cpos + w / 2 - 0.75, f.median, { stroke: color, strokeWidth: Math.max(2.5, lw), strokeLinecap: 'butt' }));
    if (spec.showMeans || spec.mean) { const [x, y] = s.P(cpos, f.mean); parts.push(el('path', { d: `M${x},${y - 4}L${x + 4},${y}L${x},${y + 4}L${x - 4},${y}Z`, fill: theme.surface, stroke: color, strokeWidth: 1.5 })); }
    if (!spec.points) for (const v of f.outliers) { const [x, y] = s.P(cpos, v); parts.push(el('circle', { cx: x, cy: y, r: 2.75, fill: 'none', stroke: color, strokeWidth: 1.25 })); }
    s.body.marks.push(g({ class: 'pa-m', 'data-tip': tip(fmtTipLabel(c, h), `n = ${f.n}`, `${T('Median', 'Mediana', s.locale)}: ${s.fmt(f.median)}`, `Q1–Q3: ${s.fmt(f.q1)} – ${s.fmt(f.q3)}`, `${T('Whiskers', 'Bigotes', s.locale)}: ${s.fmt(f.whiskerLo)} – ${s.fmt(f.whiskerHi)}`, f.outliers.length ? `${T('Outliers', 'Atípicos', s.locale)}: ${f.outliers.length}` : '') }, parts));
  }));
  return finish(s, describeGroups(m, (vs) => median(vs), s.fmt, s.locale, T('Box plot', 'Diagrama de caja', s.locale), T('median', 'mediana', s.locale)), 'box');
}

// ── Violín ─────────────────────────────────────────────────────────────────

export function violin(spec, theme) {
  const m = prepare(spec);
  const split = spec.split && m.hues.length === 2;
  const cut = spec.cut ?? 0;
  const dens = new Map();
  const ext = [];
  // En escala log, la densidad se estima sobre log10(v) para que la forma sea fiel.
  const logV = (spec.yScale ?? spec.xScale ?? spec.valueScale ?? spec.scale) === 'log' && m.all.every((v) => v > 0);
  const tf = logV ? Math.log10 : (v) => v, inv = logV ? (v) => 10 ** v : (v) => v;
  for (const c of m.cats) for (const h of m.hues) {
    const vs = m.get(c, h);
    if (!vs.length) continue;
    // Un solo valor (o todos iguales) no tiene densidad: se dibuja como una marca.
    if (vs.length < 2 || Math.min(...vs) === Math.max(...vs)) {
      dens.set(c + '\u0000' + h, { single: true, f: fiveNumber(vs), n: vs.length, max: 0 });
      ext.push(vs[0]);
      continue;
    }
    const tv = vs.map(tf);
    const bw = (spec.bandwidth ?? scottBandwidth(tv)) * (spec.bwAdjust ?? 1);
    const mn = Math.min(...tv), mx = Math.max(...tv);
    const d = kde(tv, { bandwidth: bw, extent: [mn - cut * bw, mx + cut * bw], gridSize: 96 }).map(([v, dd]) => [inv(v), dd]);
    dens.set(c + '\u0000' + h, { d, f: fiveNumber(vs), n: vs.length, max: Math.max(...d.map((p) => p[1])) });
    ext.push(inv(mn - cut * bw), inv(mx + cut * bw));
  }
  const s = setup(spec, theme, m, extentOf(ext), { type: 'violin', dodge: !split });
  const scaleMode = ['width', 'count', 'area'].includes(spec.scale) ? spec.scale : spec.densityNorm ?? 'width';
  const gMax = Math.max(...[...dens.values()].filter((x) => !x.single).map((x) => x.max), 0);
  const nMax = Math.max(...[...dens.values()].filter((x) => !x.single).map((x) => x.n), 1);
  const inner = spec.inner ?? 'box';
  const op = Math.min(0.5, (theme.marks?.bandOpacity ?? 0.16) * 2.2);
  m.cats.forEach((c) => m.hues.forEach((h, hi2) => {
    const D = dens.get(c + '\u0000' + h);
    if (!D) return;
    const color = s.colorOf(c, h);
    const cpos = split ? s.catS.center(c) : s.center(c, hi2);
    const half = (split ? s.catS.bandwidth : s.slot) * 0.46;
    const norm = scaleMode === 'width' ? D.max : scaleMode === 'count' ? gMax * (nMax / D.n) : gMax;
    const wOf = (d) => (d / (norm || 1)) * half;
    const side = split ? (hi2 === 0 ? -1 : 1) : 0;
    if (D.single) {
      // Sin forma que estimar: una raya a lo ancho del violín y un punto en el valor.
      const v = D.f.median, w = Math.min(half, 18);
      const [x, y] = s.P(cpos, v);
      const parts = [
        seg(s, cpos - (side === 1 ? 0 : w), v, cpos + (side === -1 ? 0 : w), v, { stroke: color, strokeWidth: 2, strokeLinecap: 'round' }),
        el('circle', { cx: x, cy: y, r: 3.5, fill: color, stroke: theme.surface, strokeWidth: 1.5 }),
      ];
      s.body.marks.push(g({ class: 'pa-m', 'data-tip': tip(fmtTipLabel(c, h), `n = ${D.n}`, `${T('Value', 'Valor', s.locale)}: ${s.fmt(v)}`) }, parts));
      return;
    }
    const right = D.d.map(([v, d]) => s.P(cpos + (side === -1 ? 0 : wOf(d)), v));
    const left = D.d.map(([v, d]) => s.P(cpos - (side === 1 ? 0 : wOf(d)), v)).reverse();
    const pts = side === -1 ? [...D.d.map(([v]) => s.P(cpos, v)), ...left] : side === 1 ? [...right, ...D.d.map(([v]) => s.P(cpos, v)).reverse()] : [...right, ...left];
    const path = 'M' + pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join('L') + 'Z';
    const parts = [el('path', { d: path, fill: color, fillOpacity: op, stroke: color, strokeWidth: 1.25, strokeLinejoin: 'round' })];
    const f = D.f;
    const ic = cpos + (side === 0 ? 0 : side * Math.min(half * 0.22, 7));
    if (inner === 'box') {
      parts.push(seg(s, ic, f.whiskerLo, ic, f.whiskerHi, { stroke: theme.ink, strokeWidth: 1.25, strokeOpacity: 0.7 }));
      parts.push(rectBetween(s, ic, 5, f.q1, f.q3, { rx: 2, fill: theme.ink, fillOpacity: 0.85 }));
      const [x, y] = s.P(ic, f.median);
      parts.push(el('circle', { cx: x, cy: y, r: 2.6, fill: theme.surface }));
    } else if (inner === 'quartiles') {
      for (const [q, wq] of [[f.q1, 1], [f.median, 2], [f.q3, 1]]) {
        const dq = D.d.reduce((a, p) => (Math.abs(p[0] - q) < Math.abs(a[0] - q) ? p : a))[1];
        const w = wOf(dq);
        parts.push(seg(s, cpos - (side === 1 ? 0 : w), q, cpos + (side === -1 ? 0 : w), q, { stroke: color, strokeWidth: wq + 0.25 }));
      }
    } else if (inner === 'points' || inner === 'stick') {
      for (const v of m.get(c, h)) parts.push(seg(s, cpos - 3, v, cpos + 3, v, { stroke: theme.ink, strokeOpacity: 0.55, strokeWidth: 1 }));
    }
    s.body.marks.push(g({ class: 'pa-m', 'data-tip': tip(fmtTipLabel(c, h), `n = ${D.n}`, `${T('Median', 'Mediana', s.locale)}: ${s.fmt(f.median)}`, `Q1–Q3: ${s.fmt(f.q1)} – ${s.fmt(f.q3)}`, `${T('Range', 'Rango', s.locale)}: ${s.fmt(f.min)} – ${s.fmt(f.max)}`) }, parts));
  }));
  return finish(s, describeGroups(m, (vs) => median(vs), s.fmt, s.locale, T('Violin plot', 'Gráfico de violín', s.locale), T('median', 'mediana', s.locale)), 'violin');
}

// ── Puntos con dispersión (strip) ──────────────────────────────────────────

export function strip(spec, theme) {
  const m = prepare(spec);
  const s = setup(spec, theme, m, extentOf(m.all), { type: 'strip', dodge: spec.dodge ?? true, tight: true });
  const tops = new Map();
  const n = m.all.length;
  const r = spec.radius ?? (n > 600 ? 2 : n > 200 ? 2.75 : (theme.marks?.pointRadius ?? 4) - 0.5);
  const jitter = spec.jitter ?? 0.6;
  const TT = tipper(spec, m.data, s.locale);
  m.cats.forEach((c, ci) => m.hues.forEach((h, hi2) => {
    const vs = m.get(c, h);
    const rows = m.rowsOf(c, h);
    if (!vs.length) return;
    const color = s.colorOf(c, h);
    const cpos = s.center(c, hi2);
    const w = s.slot * (jitter === true ? 0.6 : jitter || 0);
    const parts = vs.map((v, i) => {
      const [x, y] = s.P(cpos + (rand(ci * 7919 + hi2 * 104729 + i) - 0.5) * w, v);
      if (s.placeLabels) tops.set(c, Math.min(tops.get(c) ?? Infinity, y - r));
      return { class: 'pa-m', cx: x, cy: y, r, fill: color, fillOpacity: theme.marks?.dotOpacity ?? 0.85, stroke: theme.surface, strokeWidth: n > 300 ? 0.75 : 1.25, 'data-tip': TT([rows[i]], fmtTipLabel(c, h), s.fmt(v)) };
    });
    parts.splice(0, parts.length, dotMarks(parts, !!spec.leanDots));
    if (spec.mean || spec.showMeans) {
      const mu = mean(vs);
      parts.push(seg(s, cpos - Math.min(s.slot * 0.42, 34), mu, cpos + Math.min(s.slot * 0.42, 34), mu, { stroke: theme.ink, strokeWidth: 2.5, strokeLinecap: 'round' }));
    }
    s.body.marks.push(g({}, parts));
  }));
  if (s.placeLabels) s.placeLabels(tops);
  return finish(s, describeGroups(m, mean, s.fmt, s.locale, T('Strip plot', 'Gráfico de puntos por categoría', s.locale), T('mean', 'promedio', s.locale)), 'strip', spec.leanDots ? LEAN_CSS : '');
}

// ── Enjambre (swarm / beeswarm) ────────────────────────────────────────────

/**
 * Coloca puntos sin traslape: cada punto busca el desplazamiento lateral más
 * chico que no choque con los ya ubicados. Devuelve offsets en px.
 */
export function beeswarm(positions, r) {
  const order = positions.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]);
  const placed = [];
  const out = new Array(positions.length).fill(0);
  const d = 2 * r + 0.4;
  for (const [p, i] of order) {
    const near = placed.filter((q) => Math.abs(q.p - p) < d);
    const cands = [0];
    for (const q of near) {
      const dx = Math.sqrt(Math.max(0, d * d - (q.p - p) ** 2));
      cands.push(q.o + dx, q.o - dx);
    }
    cands.sort((a, b) => Math.abs(a) - Math.abs(b) || a - b);
    let best = 0;
    for (const o of cands) {
      if (near.every((q) => (q.p - p) ** 2 + (q.o - o) ** 2 >= d * d - 1e-6)) { best = o; break; }
    }
    placed.push({ p, o: best });
    out[i] = best;
  }
  return out;
}

export function swarm(spec, theme) {
  const m = prepare(spec);
  const dodge = spec.dodge ?? false;
  let s = setup(spec, theme, m, extentOf(m.all), { type: 'swarm', dodge, tight: true });
  const groupsOf = (c) => (s.multiHue && dodge ? m.hues.map((h, hi2) => [[h], hi2]) : [[m.hues, 0]]);
  // Radio automático: se achica hasta que el enjambre más ancho quepa.
  // `fixedRadius`: el radio no cambia; en horizontal, sin `rowHeight` ni
  // `height`, la fila crece hasta que quepa; si no puede, los puntos se
  // apretan contra el borde de su banda (y se tocan).
  const fixed = !!spec.fixedRadius;
  let r = spec.radius ?? (theme.marks?.pointRadius ?? 4);
  const TT = tipper(spec, m.data, s.locale);
  const layouts = () => m.cats.map((c) => groupsOf(c).map(([hs, hi2]) => {
    const items = hs.flatMap((h) => { const rows = m.rowsOf(c, h); return m.get(c, h).map((v, i) => ({ v, h, row: rows[i] })); });
    const offs = beeswarm(items.map((it) => s.valS(it.v)), r);
    return { c, hi2, items, offs, width: Math.max(0, ...offs.map(Math.abs)) * 2 + 2 * r };
  }));
  const roomOf = () => (spec.dodge ? s.slot : s.catS.bandwidth) * 0.98;
  let L = layouts();
  let room = roomOf();
  const widest = () => Math.max(...L.flat().map((x) => x.width));
  if (!fixed) {
    for (let it = 0; it < 12 && widest() > room && r > 1.4; it++) { r *= 0.85; L = layouts(); }
  } else if (!s.vertical && spec.height === undefined && spec.rowHeight == null) {
    // La banda es afín al paso de fila: dos pasadas bastan (la segunda corrige el redondeo).
    for (let it = 0; it < 3 && widest() > room + 1e-6; it++) {
      const k = dodge && s.multiHue ? m.hues.length : 1;
      const need = (widest() * k) / 0.98;
      const band = s.catS.bandwidth;
      const step = s.step + (need - band) * (s.step / Math.max(1e-9, s.placeLabels ? s.step : band)) + 0.5;
      s = setup(spec, theme, m, extentOf(m.all), { type: 'swarm', dodge, tight: true, rowStep: Math.ceil(step) });
      L = layouts();
      room = roomOf();
    }
  }
  const tops = new Map();
  for (const grp of L.flat()) {
    const cpos = spec.dodge ? s.center(grp.c, grp.hi2) : s.catS.center(grp.c);
    const lim = Math.max(0, room / 2 - r);
    const parts = grp.items.map((it, i) => {
      const o = Math.max(-lim, Math.min(lim, grp.offs[i]));
      const [x, y] = s.vertical ? [cpos + o, s.valS(it.v)] : [s.valS(it.v), cpos + o];
      if (s.placeLabels) tops.set(grp.c, Math.min(tops.get(grp.c) ?? Infinity, y - r));
      const color = s.colorOf(grp.c, it.h);
      return { class: 'pa-m', cx: x, cy: y, r, fill: color, fillOpacity: theme.marks?.dotOpacity ?? 0.85, stroke: theme.surface, strokeWidth: r > 2.5 ? 1 : 0.5, 'data-tip': TT([it.row], fmtTipLabel(grp.c, it.h), s.fmt(it.v)) };
    });
    parts.splice(0, parts.length, dotMarks(parts, !!spec.leanDots));
    s.body.marks.push(g({}, parts));
  }
  if (s.placeLabels) s.placeLabels(tops);
  return finish(s, describeGroups(m, median, s.fmt, s.locale, T('Swarm plot', 'Gráfico de enjambre', s.locale), T('median', 'mediana', s.locale)), 'swarm', spec.leanDots ? LEAN_CSS : '');
}

// ── Estimación con intervalo (point) ───────────────────────────────────────

function estimate(vs, est, eb, level = 0.95) {
  const v = finite(vs);
  if (!v.length) return null;
  const e = est === 'median' ? median(v) : est === 'sum' ? sum(v) : mean(v);
  let lo = e, hi = e;
  if (eb === 'ci' && est !== 'sum') [lo, hi] = est === 'median' ? medianCI(v, level) : meanCI(v, level);
  else if (eb === 'sd') { lo = e - sd(v); hi = e + sd(v); }
  else if (eb === 'se') { const se = sd(v) / Math.sqrt(v.length); lo = e - se; hi = e + se; }
  else if (eb === 'pi') { const st = [...v].sort((a, b) => a - b); lo = quantile(st, 0.025); hi = quantile(st, 0.975); }
  return { e, lo, hi, n: v.length };
}

function medianCI(v, level) {
  // IC de la mediana por orden de estadísticos (aproximación normal binomial).
  const st = [...v].sort((a, b) => a - b);
  const n = st.length;
  const z = level >= 0.99 ? 2.576 : level >= 0.95 ? 1.96 : 1.645;
  const k = Math.max(0, Math.floor(n / 2 - (z * Math.sqrt(n)) / 2));
  return [st[k], st[Math.min(n - 1, n - 1 - k)]];
}

export function point(spec, theme) {
  const m = prepare(spec);
  const est = spec.estimator ?? 'mean';
  const eb = spec.errorbar === undefined ? 'ci' : spec.errorbar;
  const res = new Map();
  const ext = [];
  for (const c of m.cats) for (const h of m.hues) {
    const r = estimate(m.get(c, h), est, eb, spec.level ?? 0.95);
    if (!r) continue;
    res.set(c + '\u0000' + h, r);
    ext.push(r.lo, r.hi);
  }
  const multi = m.hues.length > 1;
  const showEnd = multi && (spec.labels ?? true) && m.hues.length <= 4;
  // Reserva espacio a la derecha para las etiquetas al final.
  const endW = showEnd ? Math.min(140, Math.max(...m.hues.map((h) => measure(h, 12, 500)))) + 16 : 0;
  const s = setup({ ...spec, width: spec.width }, theme, m, extentOf(ext), { type: 'point', dodge: false, zero: est === 'sum' });
  const vertical = s.vertical;
  if (vertical && showEnd) {
    // Recalcula el eje de categorías dejando espacio a la derecha.
    s.catS = band(m.cats, s.inner.x, s.inner.x + s.inner.w - endW, { inner: 0.28, outer: 0.12 });
    s.body.post = s.body.post.filter((p) => !p.startsWith('<g><text') || !m.cat);
    const axisSize = theme.type?.axis ?? 11.5;
    if (m.cat) s.body.post.push(xLabels(m.cats.map((c) => ({ pos: s.catS.center(c), label: truncate(c, Math.max(40, s.catS.step - 6), axisSize + 0.5) })), s.inner, theme, { y: s.inner.y + s.inner.h + 18, size: axisSize + 0.5, color: theme.lede }));
  }
  const dodgeW = multi && (spec.dodge ?? true) ? Math.min(s.catS.bandwidth * 0.36, 26) : 0;
  const cposOf = (c, hi2) => s.catS.center(c) + (multi ? (hi2 - (m.hues.length - 1) / 2) * (dodgeW / Math.max(1, m.hues.length - 1)) : 0);
  const lw = theme.marks?.lineWidth ?? 2;
  const ends = [];
  m.hues.forEach((h, hi2) => {
    const color = s.colorOf(null, h);
    const pts = m.cats.map((c) => [c, res.get(c + '\u0000' + h)]).filter(([, r]) => r);
    const parts = [];
    if (spec.join !== false && pts.length > 1) {
      const d = pts.map(([c, r], i) => { const [x, y] = s.P(cposOf(c, hi2), r.e); return (i ? 'L' : 'M') + x.toFixed(2) + ',' + y.toFixed(2); }).join('');
      parts.push(el('path', { d, fill: 'none', stroke: color, strokeWidth: lw, strokeLinejoin: 'round', strokeLinecap: 'round', strokeOpacity: 0.9 }));
    }
    for (const [c, r] of pts) {
      const cp = cposOf(c, hi2);
      const bits = [];
      if (eb) bits.push(seg(s, cp, r.lo, cp, r.hi, { stroke: color, strokeWidth: 2, strokeLinecap: 'round' }));
      const [x, y] = s.P(cp, r.e);
      bits.push(el('circle', { cx: x, cy: y, r: (theme.marks?.pointRadius ?? 4) + 0.5, fill: color, stroke: theme.surface, strokeWidth: theme.marks?.ring ?? 2 }));
      const ebName = eb === 'ci' ? `IC ${Math.round((spec.level ?? 0.95) * 100)}%` : eb === 'sd' ? T('± SD', '± DE', s.locale) : eb === 'se' ? T('± SE', '± EE', s.locale) : eb === 'pi' ? T('95% range', 'rango 95%', s.locale) : '';
      const estName = est === 'median' ? T('Median', 'Mediana', s.locale) : est === 'sum' ? T('Sum', 'Suma', s.locale) : T('Mean', 'Promedio', s.locale);
      parts.push(g({ class: 'pa-m', 'data-tip': tip(fmtTipLabel(c, h), `${estName}: ${s.fmt(r.e)}`, eb ? `${ebName}: ${s.fmt(r.lo)} – ${s.fmt(r.hi)}` : '', `n = ${r.n}`) }, bits));
    }
    if (showEnd && vertical && pts.length) {
      const [c, r] = pts[pts.length - 1];
      const [x, y] = s.P(cposOf(c, hi2), r.e);
      ends.push({ x: s.catS.center(c) + dodgeW / 2 + 12, y, y0: y, xd: x, label: h, color: s.colorOf(c, h) });
    }
    s.body.marks.push(g({ 'data-series': h }, parts));
  });
  if (ends.length) {
    ends.sort((a, b) => a.y - b.y);
    for (let it = 0; it < 30; it++) for (let i = 1; i < ends.length; i++) { const d = ends[i].y - ends[i - 1].y; if (d < 15) { const sh = (15 - d) / 2; ends[i].y += sh; ends[i - 1].y -= sh; } }
    for (const e of ends) {
      if (Math.abs(e.y - e.y0) > 3 || e.x - e.xd > 14) s.body.post.push(el('path', { d: `M${(e.xd + 7).toFixed(1)},${e.y0.toFixed(1)}L${(e.x - 8).toFixed(1)},${e.y0.toFixed(1)}L${(e.x - 3).toFixed(1)},${e.y.toFixed(1)}`, fill: 'none', stroke: theme.muted, strokeWidth: 1, strokeOpacity: 0.7 }));
      s.body.post.push(text(e.x, e.y + 4, truncate(e.label, endW - 12, 12, 500), { fill: readable(e.color, theme), fontSize: 12, fontWeight: 600 }));
    }
  }
  const estW = est === 'median' ? T('median', 'mediana', s.locale) : est === 'sum' ? T('sum', 'suma', s.locale) : T('mean', 'promedio', s.locale);
  return finish(s, describeGroups(m, (vs) => estimate(vs, est, false).e, s.fmt, s.locale, T('Point plot', 'Gráfico de estimación con intervalo', s.locale), estW), 'point');
}

// ── Descripción ────────────────────────────────────────────────────────────

function describeGroups(m, stat, fmt, locale, kind, statName) {
  const en = String(locale).startsWith('en');
  const rows = [];
  for (const c of m.cats) for (const h of m.hues) {
    const vs = m.get(c, h);
    if (vs.length) rows.push([fmtTipLabel(c, h) || humanize(m.val), stat(vs), vs.length]);
  }
  if (!rows.length) return kind + '.';
  rows.sort((a, b) => b[1] - a[1]);
  const hi = rows[0], lo = rows[rows.length - 1];
  const what = humanize(m.val).toLowerCase();
  return en
    ? `${kind} of ${what} across ${rows.length} groups (${m.all.length} observations). Highest ${statName}: ${hi[0]} (${fmt(hi[1])}). Lowest: ${lo[0]} (${fmt(lo[1])}).`
    : `${kind} de ${what} en ${rows.length} grupos (${m.all.length} observaciones). Mayor ${statName}: ${hi[0]} (${fmt(hi[1])}). Menor: ${lo[0]} (${fmt(lo[1])}).`;
}
