// Líneas y áreas: series de tiempo, índices base 100, bandas de confianza
// (seaborn lineplot), escala log y áreas apiladas.
// Etiquetas SIEMPRE al final de cada línea: si chocan se separan y una línea
// guía fina las une con su punto. El eje y va por dentro para ganar ancho.
import { el, g, text, tip } from '../svg.js';
import { measure, truncate } from '../text.js';
import { makeFormat, formatDate, parseDate } from '../format.js';
import { niceDomain, linear, log, logDomain, timeTicks, dateUnit, niceStep, intStep, halfUnit } from '../scale.js';
import { colorMap, readable } from '../theme.js';
import { ensureData, inferXY, requireField, melt, uniq, aggregate, num, fieldKind, xValue, humanize, PlotError } from '../data.js';
import { xLabels, refLinesY, yAxisMargin, yAxisTop, yGrid, yTickLabels, isInside, ticksWidth } from '../axes.js';
import { createFrame } from '../frame.js';
import { ctx } from '../context.js';
import { meanCI, mean, sd, extent } from '../stats.js';
import { hash } from '../frame.js';
import { dashedMatcher, fromTest, hatcher, dashedDefaultLabel, DASH } from '../dashed.js';

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
  const en = String(locale).startsWith('en');
  if (!m.lines.some((l) => l.points.some((p) => Number.isFinite(p.y))))
    throw new PlotError(
      en ? `No numeric values in \`${m.y}\` to plot.` : `No hay valores numéricos en \`${m.y}\` para graficar.`,
      en ? `Check that "${m.y}" holds numbers (not empty or text), or pick another field with y: "field".` : `Revisa que "${m.y}" tenga números (no vacíos ni texto), o elige otro campo con y: "campo".`
    );

  // Apilado (áreas), opcionalmente al 100%. Positivos y negativos se apilan por
  // separado desde cero (como `stackStrategy: 'samesign'` de ECharts).
  if (stack) {
    const tot = new Map(xsAll.map((xv) => [xv, 0]));
    for (const l of m.lines) for (const p of l.points) if (Number.isFinite(p.y)) tot.set(p.x, tot.get(p.x) + Math.abs(p.y));
    const pos = new Map(xsAll.map((xv) => [xv, 0]));
    const neg = new Map(xsAll.map((xv) => [xv, 0]));
    for (const l of m.lines) {
      const byX = new Map(l.points.map((p) => [p.x, p.y]));
      l.points = xsAll.map((xv) => {
        let v = Number.isFinite(byX.get(xv)) ? byX.get(xv) : 0;
        if (pct) v = tot.get(xv) ? v / tot.get(xv) : 0;
        const base = v < 0 ? neg : pos;
        const y0 = base.get(xv);
        base.set(xv, y0 + v);
        return { x: xv, y: y0 + v, y0, v };
      });
    }
  }

  const allY = [], rawY = [];
  for (const l of m.lines) for (const p of l.points) {
    if (Number.isFinite(p.y)) allY.push(p.y);
    if (Number.isFinite(p.lo)) allY.push(p.lo);
    if (Number.isFinite(p.hi)) allY.push(p.hi);
    const r = p.v ?? p.y;
    if (Number.isFinite(r)) rawY.push(r);
  }
  const fmt = pct
    ? makeFormat({ type: 'percent', scale: 100, decimals: spec.format?.decimals }, locale)
    : spec.index ? makeFormat({ type: 'number', decimals: spec.format?.decimals ?? 0 }, locale) : makeFormat(spec.format, locale, rawY);
  let [ymin, ymax] = extent(allY);
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

  // Trazo discontinuo: series enteras (`dashed`) o el tramo desde `dashedFrom` (proyección).
  const dm = dashedMatcher(spec, [], null, null);
  const dashedSeries = (k) => !!(dm && dm(k));
  const fromT = fromTest(spec, (v) => (m.kind === 'category' ? m.cats.indexOf(String(v)) : typeof v === 'number' && m.kind === 'date' ? v : xValue(v, m.kind)));
  const dashedLabel = spec.dashedLabel ?? dashedDefaultLabel(locale);

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

  const frame = createFrame(spec, theme, { height: 400 });
  const want = labelMode !== false;
  // Leyenda solo si alguna serie queda sin etiqueta final.
  const lh = labelSize * ctx.textScale + 3;
  const provisionalH = frame.bottom - frame.top - 40;
  const maxLabels = Math.max(1, Math.floor(provisionalH / lh));
  // Series sin ningún dato válido no llevan etiqueta (ni rompen el cálculo).
  const labelable = m.lines.filter((l) => focus(l.key) && lastOf(l));
  let labeled = want ? [...labelable].sort((a, b) => lastOf(b).y - lastOf(a).y).slice(0, maxLabels) : [];
  const allLabeled = labeled.length === labelable.length;
  const needLegend = multi && (!want || !allLabeled || spec.legend === true || (spec.legend && typeof spec.legend !== 'boolean')) && spec.legend !== false;
  const legend = needLegend ? m.seriesKeys.map((s) => ({ label: s, color: colorOf(s), shape: isArea ? 'square' : 'line', dashed: dashedSeries(s) })) : [];
  const area = frame.layout(legend);
  const inside = stack ? false : spec.axisInside;
  // Alto vertical fijo alrededor del área de trazado (marca superior, eje x, títulos).
  const yChrome = yAxisTop(theme, inside) + (spec.yLabel ? 16 : 0) + 24 * ctx.textScale + (spec.xLabel ? 16 * ctx.textScale : 0);
  // Una leyenda larga en un gráfico bajo no aplasta el trazado: el SVG crece lo justo.
  const MIN_INNER_H = 90 * ctx.textScale;
  if (area.h - yChrome < MIN_INNER_H) {
    const grow = Math.ceil(MIN_INNER_H - (area.h - yChrome));
    frame.setHeight(frame.height + grow);
    area.h += grow;
  }
  // Con el alto real, rotular solo las que caben (la leyenda cubre al resto).
  const capacity = Math.max(1, Math.floor((area.h - yChrome + 8 - lh / 2) / lh) + 1);
  if (labeled.length > capacity) labeled = labeled.slice(0, capacity);

  const endW = labeled.length
    ? Math.max(...labeled.map((l) => { const t = endText(l); return t ? measure(t.val, labelSize, 600) + (t.name ? measure(t.name, labelSize, 500) * 1.04 + 6 * ctx.textScale : 0) : 0; })) + 22
    : 10;

  // Escala y
  // Valores enteros (conteos): nunca marcas en 0,5.
  const intY = !pct && !spec.index && rawY.length > 0 && rawY.every(Number.isInteger);
  const nd = yLog ? logDomain(ymin, ymax) : spec.yDomain ? { min: ymin, max: ymax, step: niceStep(ymax - ymin, Math.max(3, Math.round(area.h / 64))) } : niceDomain(ymin, ymax, Math.max(3, Math.round(area.h / 64)), { integer: intY });
  const yTicksArr = (yLog ? log(nd.min, nd.max, 0, 1) : linear(nd.min, nd.max, 0, 1)).ticks(nd.step);
  const tickF = yLog ? (v) => fmt.tick(v)(v) : fmt.tick(nd.step, yTicksArr);
  const leftM = yAxisMargin(yTicksArr, tickF, theme, inside);
  const yTop = area.y + yAxisTop(theme, inside) + (spec.yLabel ? 16 : 0);
  const inner = { x: area.x + leftM, y: yTop, w: Math.max(80, area.w - leftM - endW), h: area.y + area.h - yTop - 24 * ctx.textScale - (spec.xLabel ? 16 * ctx.textScale : 0) };
  const yS = (yLog ? log : linear)(nd.min, nd.max, inner.y + inner.h, inner.y);

  // Escala x
  let x0 = xsAll[0], x1 = xsAll[xsAll.length - 1];
  if (spec.xDomain) [x0, x1] = spec.xDomain.map((v) => (typeof v === 'number' ? v : m.kind === 'date' ? parseDate(v) : num(v)));
  // Un solo x: centrado, con media unidad a cada lado (media unidad de tiempo en fechas).
  const du = m.kind === 'date' ? dateUnit(xsAll) : null;
  const singleX = x0 === x1;
  if (singleX) { const hw = m.kind === 'date' ? halfUnit(du) : 0.5; x0 -= hw; x1 += hw; }
  if (spec._domains) { spec._domains.y = [nd.min, nd.max]; spec._domains.x = [x0, x1]; }
  const xLog = spec.xScale === 'log' && x0 > 0;
  // Con el eje y por dentro, si el primer punto choca con una etiqueta de marca,
  // el trazado arranca pasado la etiqueta más ancha.
  let xPad = 0;
  if (isInside(theme, inside) && !singleX && !spec.xDomain) {
    const axisSize = theme.type?.axis ?? 12;
    const k = 5 * Math.max(1, ctx.textScale * 0.8);
    // Caja de cada etiqueta: su ancho real, de la altura de las mayúsculas a la línea base.
    const boxes = yTicksArr.map((t) => { const base = Math.round(yS(t)) + 0.5 - k; return { w: measure(tickF(t), axisSize), y0: base - axisSize * 0.75 * ctx.textScale, y1: base + 1 }; });
    const xS0 = (xLog ? log : linear)(x0, x1, inner.x, inner.x + inner.w);
    const dots = spec.points ?? spec.markers ?? (m.lines.every((l) => l.points.length <= 12) && m.lines.length <= 3 && !isArea);
    const r = dots ? (M.pointRadius ?? 4) : (M.lineWidth ?? 2.25) / 2 + 0.5;
    for (const l of m.lines) {
      const p = l.points.find((q) => Number.isFinite(q.y));
      if (!p) continue;
      const px = xS0(p.x), py = yS(p.y);
      if (boxes.some((b) => px - r < inner.x + b.w + 1 && py + r > b.y0 && py - r < b.y1)) xPad = Math.max(xPad, Math.min(Math.max(...boxes.map((b) => b.w)) + 8, inner.w * 0.25));
    }
  }
  const xS = (xLog ? log : linear)(x0, x1, inner.x + xPad, inner.x + inner.w);
  // Formateadores creados una vez (no por punto).
  const xNumFmt = m.kind === 'number' ? makeFormat(spec.xFormat, locale, xsAll) : null;
  const xFmt = (xv) => {
    if (m.kind === 'date') return formatDate(xv, du, locale);
    if (m.kind === 'category') return m.cats[xv];
    if (m.kind === 'year') return String(xv);
    return xNumFmt(xv);
  };
  let xItems;
  if (singleX) {
    xItems = [{ pos: xS(xsAll[0]), label: xFmt(xsAll[0]) }];
  } else if (m.kind === 'date') {
    xItems = timeTicks(x0, x1, Math.max(2, Math.floor(inner.w / 86)), locale).ticks.map((t) => ({ pos: xS(t.value), label: t.label }));
  } else if (m.kind === 'category') {
    xItems = m.cats.map((c, i) => ({ pos: xS(i), label: c })).filter((it, i) => xsAll.includes(i));
  } else if (xLog) {
    const lf = makeFormat(spec.xFormat, locale, xsAll);
    xItems = xS.ticks().map((t) => ({ pos: xS(t), label: lf.tick(t)(t) }));
  } else {
    let st = niceStep(x1 - x0, Math.max(2, Math.floor(inner.w / 78)));
    const ints = xsAll.every(Number.isInteger);
    // Pasos 1/2/5/10 (2,5 → 2, no 3: sin años impares 2001, 2004…).
    if (m.kind === 'year' || ints) st = intStep(st);
    const xMaxAbs = Math.max(Math.abs(xsAll[0]), Math.abs(xsAll[xsAll.length - 1]));
    const tf = m.kind === 'year' ? (v) => String(v) : makeFormat(spec.xFormat ?? (ints && xMaxAbs < 1e4 ? 'integer' : undefined), locale, xsAll).tick(st);
    xItems = xS.ticks(st).map((t) => ({ pos: xS(t), label: tf(t) }));
  }

  const body = [];
  const yTicks = yS.ticks(nd.step);
  body.push(yGrid(yTicks, yS, inner, theme, { baseline: zero ? 0 : NaN }));
  if (spec.yLabel) body.push(text(area.x, area.y + 10, spec.yLabel, { fill: theme.lede, fontSize: theme.type?.axis ?? 12, fontWeight: 500 }));
  body.push(xLabels(xItems, inner, theme, { y: inner.y + inner.h + 18, size: theme.type?.axis }));
  if (spec.xLabel) body.push(text(inner.x + inner.w, inner.y + inner.h + 36, spec.xLabel, { fill: theme.lede, fontSize: theme.type?.axis ?? 12, fontWeight: 500, textAnchor: 'end' }));

  // Anotaciones verticales (eventos). Los rótulos que chocarían bajan a la
  // fila siguiente (14 px) y no tapan la etiqueta de la marca superior.
  const placedAnn = [];
  if (isInside(theme, inside) && yTicks.length) {
    const tTop = yTicks.reduce((a, b) => (yS(b) < yS(a) ? b : a));
    const ty = Math.round(yS(tTop)) + 0.5 - 5 * Math.max(1, ctx.textScale * 0.8);
    placedAnn.push([inner.x, ty - (theme.type?.axis ?? 12) * ctx.textScale, inner.x + measure(tickF(tTop), theme.type?.axis ?? 12) + 2, ty + 2]);
  }
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
      const bx0 = right ? ax - w : ax, bx1 = right ? ax : ax + w;
      let ay = inner.y + 4;
      for (let row = 0; row < 6; row++) {
        ay = inner.y + 4 + row * 14;
        const box = [bx0 - 2, ay - 10, bx1 + 2, ay + 3];
        if (!placedAnn.some((b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1])) { placedAnn.push(box); break; }
      }
      body.push(text(ax, ay, a.label, { fill: theme.lede, fontSize: 11.5, fontWeight: 500, textAnchor: right ? 'end' : 'start', stroke: theme.surface, strokeWidth: 3, paintOrder: 'stroke', strokeLinejoin: 'round' }));
    }
  }

  // Tramo proyectado: banda suave de fondo con su rótulo, desde el último dato firme.
  let cutX = null;
  if (fromT) {
    const firm = xsAll.filter((xv) => !fromT(xv));
    const startX = firm.length ? firm[firm.length - 1] : xsAll.find((xv) => fromT(xv));
    if (startX !== undefined && xsAll.some((xv) => fromT(xv)) && startX <= x1) {
      cutX = Math.max(inner.x, xS(Math.max(startX, x0)));
      body.push(el('rect', { x: cutX, y: inner.y, width: Math.max(0, inner.x + inner.w - cutX), height: inner.h, fill: theme.tint, opacity: 0.55, 'pointer-events': 'none' }));
      body.push(el('line', { x1: cutX, x2: cutX, y1: inner.y, y2: inner.y + inner.h, stroke: theme.muted, strokeWidth: 1, strokeDasharray: '2 3', opacity: 0.8 }));
      if (spec.dashedLabel !== false) body.push(text(cutX + 6, inner.y + 11, dashedLabel, { fill: theme.muted, fontSize: 11.5, fontWeight: 500, stroke: theme.surface, strokeWidth: 3, paintOrder: 'stroke', strokeLinejoin: 'round' }));
    }
  }
  const gidD = 'pa-dash-' + Math.abs(hash(String(spec.title) + m.y + inner.w + theme.mode)).toString(36);
  const H = hatcher(theme, gidD);
  // Recortes para pintar áreas: firme a la izquierda de cutX, rayado a la derecha.
  const clipL = `${gidD}-l`, clipR = `${gidD}-r`;

  // Trazos
  // Orden de dibujo: atenuadas, luego las grises de desborde (9.ª en adelante), luego las de color.
  const rank = (l) => (!focus(l.key) ? 0 : multi && cmap.get(l.key) === theme.other && !spec.colors?.[l.key] ? 1 : 2);
  const ordered = [...m.lines].sort((a, b) => rank(a) - rank(b));
  const showDots = spec.points ?? spec.markers ?? (m.lines.every((l) => l.points.length <= 12) && m.lines.length <= 3 && !isArea);
  const curve = spec.curve === 'smooth' ? monotonePath : spec.curve === 'step' ? stepPath : linearPath;
  const drawOrder = stack ? [...m.lines].reverse() : ordered;
  const lw = M.lineWidth ?? 2.25;
  const maxPts = Math.max(64, Math.round(2 * inner.w));
  const gid = 'pa-grad-' + Math.abs(hash(String(spec.title) + m.y + inner.w)).toString(36);
  let defs = '';
  const washSingle = !multi && !isArea && spec.fill !== false && !m.errorbar && zero;
  for (const l of drawOrder) {
    const c = colorOf(l.key);
    // Más de 2 puntos por píxel: LTTB (mantiene la forma, picos incluidos).
    const segs = splitGaps(l.points, xS, yS).map((sg) => (sg.length > maxPts ? lttb(sg, maxPts) : sg));
    if (!segs.length) continue;
    // Un solo x en un área: una columna centrada (si no, el área no tendría ancho).
    const aw = Math.min(inner.w * 0.2, 40);
    const segsA = singleX ? segs.map((sg) => (sg.length === 1 ? [[sg[0][0] - aw, sg[0][1], sg[0][2]], [sg[0][0] + aw, sg[0][1], sg[0][2]]] : sg)) : segs;
    const parts = [];
    // Banda de confianza (seaborn): antes de la línea, mismo tono.
    if (m.errorbar && !stack) {
      let bpts = l.points.filter((p) => Number.isFinite(p.lo) && Number.isFinite(p.hi));
      if (bpts.length > maxPts) bpts = lttb(bpts.map((p) => [xS(p.x), yS(p.y), p]), maxPts).map((q) => q[2]);
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
      for (const sgm of segsA) {
        const top = curve(sgm.map(([a, b]) => [a, b]));
        const base0 = yS(Math.max(nd.min, 0));
        const bottom = stack ? sgm.map(([a, , p]) => [a, yS(p.y0)]).reverse() : [[sgm[sgm.length - 1][0], base0], [sgm[0][0], base0]];
        const d = top + 'L' + bottom.map(([a, b]) => `${a.toFixed(2)},${b.toFixed(2)}`).join('L') + 'Z';
        const areaAttrs = { d, fill: washSingle ? `url(#${gid})` : c, fillOpacity: washSingle ? 1 : stack ? 0.9 : M.areaOpacity ?? 0.12, stroke: stack ? theme.surface : 'none', strokeWidth: stack ? 1.5 : 0 };
        const hatchedArea = stack || dashedSeries(l.key);
        if (cutX !== null && hatchedArea) {
          // Área apilada o serie punteada: el tramo proyectado va rayado en su color.
          parts.push(el('path', { ...areaAttrs, 'clip-path': `url(#${clipL})` }));
          parts.push(el('path', { ...areaAttrs, fill: H.fill(c), fillOpacity: stack ? 0.95 : 0.5, 'clip-path': `url(#${clipR})` }));
        } else if (dashedSeries(l.key) && !washSingle) parts.push(el('path', { ...areaAttrs, fill: H.fill(c), fillOpacity: stack ? 0.95 : 0.5 }));
        else parts.push(el('path', areaAttrs));
      }
    }
    const sw = focus(l.key) ? (hl ? lw + 0.75 : lw) : 1.5;
    const lineAttrs = { fill: 'none', stroke: c, strokeWidth: sw, strokeLinejoin: 'round', strokeLinecap: 'round' };
    const dashAttrs = { ...lineAttrs, strokeDasharray: DASH.line };
    if (!stack) for (const sgm of segs) {
      if (dashedSeries(l.key)) { parts.push(el('path', { d: curve(sgm.map(([a, b]) => [a, b])), ...dashAttrs })); continue; }
      // Tramo firme sólido y tramo proyectado discontinuo, unidos en el último dato firme.
      const k = fromT ? sgm.findIndex(([, , p]) => fromT(p.x)) : -1;
      if (k < 0) parts.push(el('path', { d: curve(sgm.map(([a, b]) => [a, b])), ...lineAttrs }));
      else {
        if (k > 0) parts.push(el('path', { d: curve(sgm.slice(0, k).map(([a, b]) => [a, b])), ...lineAttrs }));
        const rest = sgm.slice(Math.max(0, k - 1));
        if (rest.length > 1) parts.push(el('path', { d: curve(rest.map(([a, b]) => [a, b])), ...dashAttrs }));
      }
    }
    const pts = segs.flat();
    // Puntos proyectados huecos: se ven como "todavía no medidos".
    const hollow = (p) => dashedSeries(l.key) || (fromT && fromT(p.x));
    const dot = ([a, b, p], r) => el('circle', { cx: a, cy: b, r, ...(hollow(p) ? { fill: theme.surface, stroke: c, strokeWidth: 1.75 } : { fill: c, stroke: theme.surface, strokeWidth: M.ring ?? 2 }) });
    if (focus(l.key) && !stack) {
      if (showDots) for (const q of pts) parts.push(dot(q, (M.pointRadius ?? 4) - 0.5));
      // Punto aislado entre vacíos: sin marcador sería un trazo de largo cero (invisible).
      else for (const sg of segs) if (sg.length === 1 && sg[0] !== pts[pts.length - 1]) parts.push(dot(sg[0], (M.pointRadius ?? 4) - 0.5));
    }
    if (focus(l.key) && !stack) parts.push(dot(pts[pts.length - 1], (M.pointRadius ?? 4) + 0.5));
    body.push(g({ class: 'pa-m', 'data-series': l.key, ...(dashedSeries(l.key) ? { 'data-dashed': '1' } : {}) }, parts));
  }

  body.push(refLinesY(refs, yS, inner, theme, fmt));
  body.push(yTickLabels(yTicks, yS, inner, theme, tickF, { inside }));

  // Etiquetas finales con separación vertical y líneas guía.
  if (labeled.length) {
    let labs = labeled.map((l) => {
      const last = lastOf(l);
      const t = endText(l);
      const yy = stack ? yS((last.y + last.y0) / 2) : yS(last.y);
      // Un solo x en área: la guía parte del borde derecho de la columna, no la cruza.
      const px = xS(last.x) + (singleX && isArea ? Math.min(inner.w * 0.2, 40) : 0);
      return { ...t, key: l.key, y: yy, y0: yy, px, color: colorOf(l.key) };
    }).sort((a, b) => a.y0 - b.y0);
    const lbBottom = inner.y + inner.h + 4;
    dodge(labs, lh, inner.y + lh / 2 - 4, lbBottom);
    // Si aun así no caben, se omiten antes que salirse del SVG.
    labs = labs.filter((lb) => lb.y <= lbBottom + 0.5);
    // Guía también si la serie termina antes del borde derecho (si no, la etiqueta queda suelta).
    const early = (lb) => lb.px < inner.x + inner.w - 2;
    const anyMoved = labs.some((lb) => Math.abs(lb.y - lb.y0) > 1.5 || early(lb));
    const lx = inner.x + inner.w + (anyMoved || stack ? 16 : 9);
    for (const lb of labs) {
      const tparts = [];
      if (Math.abs(lb.y - lb.y0) > 1.5 || stack || early(lb)) {
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
  // Con más x que píxeles, una entrada por columna de píxel (la última).
  let crossXs = xsAll;
  if (xsAll.length > inner.w) {
    const byCol = new Map();
    for (const xv of xsAll) byCol.set(Math.round(xS(xv)), xv);
    crossXs = [...byCol.values()];
  }
  const focusLines = m.lines.filter((l) => focus(l.key)).map((l) => ({ l, at: new Map(l.points.map((q) => [q.x, q])) }));
  const cross = crossXs.map((xv) => ({
    x: +xS(xv).toFixed(1),
    t: xFmt(xv) + (fromT && fromT(xv) ? ` · ${dashedLabel}` : ''),
    v: focusLines.map(({ l, at }) => {
      const p = at.get(xv);
      if (!p || !Number.isFinite(p.y)) return null;
      const extra = Number.isFinite(p.lo) ? ` (${fmt(p.lo)}–${fmt(p.hi)})` : '';
      return [multi ? l.key : m.seriesKeys[0], colorOf(l.key), +yS(p.y).toFixed(1), fmt(stack ? p.v : p.y) + extra];
    }).filter(Boolean),
  }));
  body.push(el('rect', { class: 'pa-cross', x: inner.x - 4, y: inner.y, width: inner.w + 8, height: inner.h, fill: 'transparent', 'data-cross': JSON.stringify(cross), 'data-y0': inner.y, 'data-y1': inner.y + inner.h }));

  const desc = describeLine(m, fmt, xFmt, locale);
  if (cutX !== null) defs += el('clipPath', { id: clipL }, el('rect', { x: 0, y: 0, width: cutX, height: frame.height })) + el('clipPath', { id: clipR }, el('rect', { x: cutX, y: 0, width: frame.width, height: frame.height }));
  return frame.finish(body, { desc, type: isArea ? 'area' : 'line', defs: defs + H.defs() });
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

/**
 * Largest-Triangle-Three-Buckets: reduce [[px, py, p], ...] a `n` puntos
 * conservando la forma visual (primero y último siempre incluidos).
 */
export function lttb(pts, n) {
  const len = pts.length;
  if (n >= len || n < 3) return pts;
  const out = [pts[0]];
  const every = (len - 2) / (n - 2);
  let a = 0;
  for (let i = 0; i < n - 2; i++) {
    const s0 = Math.floor((i + 1) * every) + 1, s1 = Math.min(len, Math.floor((i + 2) * every) + 1);
    let ax = 0, ay = 0;
    for (let j = s0; j < s1; j++) { ax += pts[j][0]; ay += pts[j][1]; }
    const cnt = Math.max(1, s1 - s0);
    ax /= cnt; ay /= cnt;
    const r0 = Math.floor(i * every) + 1, r1 = Math.floor((i + 1) * every) + 1;
    const [px, py] = pts[a];
    let best = -1, bi = r0;
    for (let j = r0; j < r1; j++) {
      const ar = Math.abs((px - ax) * (pts[j][1] - py) - (px - pts[j][0]) * (ay - py));
      if (ar > best) { best = ar; bi = j; }
    }
    out.push(pts[bi]);
    a = bi;
  }
  out.push(pts[len - 1]);
  return out;
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

// Un decimal basta en trazados (0,05 px): SVG más liviano con muchos puntos.
const f2 = (n) => n.toFixed(1);
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
