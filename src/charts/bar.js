import { parseRgb } from '../rgb.js';
// Barras y columnas: simples, agrupadas, apiladas y apiladas al 100%.
// Orientación automática: columnas para pocas categorías cortas o tiempo,
// barras horizontales cuando las etiquetas son largas o hay muchas.
import { el, g, text, barPath, tip, linkWrap } from '../svg.js';
import { tipper } from '../tooltip.js';
import { measure, truncate } from '../text.js';
import { makeFormat } from '../format.js';
import { niceDomain, niceStep, linear, band, dateUnit } from '../scale.js';
import { colorMap } from '../theme.js';
import { ensureData, inferXY, requireField, melt, uniq, aggregate, num, fieldKind, humanize } from '../data.js';
import { gridY, gridX, xLabels, calendarSteps, ticksWidth, refLinesY, refLinesX, groupRuns, groupBandX, groupBandY, groupBandWidth, GROUP_BAND } from '../axes.js';
import { mean, sd, meanCI } from '../stats.js';
import { createFrame, SIZES, chartId } from '../frame.js';
import { parseDate, formatDate } from '../format.js';
import { dashedMatcher, fromTest, hatcher, dashedAttrs, dashedDefaultLabel } from '../dashed.js';
import { ctx } from '../context.js';

export function prepareBar(spec) {
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
  const counting = (spec.aggregate ?? spec.estimator) === 'count';
  y = y || (counting ? null : inf.y);
  requireField(data, x, 'x');
  if (!counting) requireField(data, y, 'y');
  if (series) requireField(data, series, 'series');
  const kind = fieldKind(data, x);
  // Estimador: suma por defecto; con `ci`/`errorbar` → media ± intervalo (seaborn barplot).
  const errorbar = spec.errorbar ?? (spec.ci === true || typeof spec.ci === 'number' ? 'ci' : null);
  const how = spec.aggregate ?? spec.estimator ?? (errorbar ? 'mean' : 'sum');
  const level = typeof spec.ci === 'number' ? (spec.ci > 1 ? spec.ci / 100 : spec.ci) : 0.95;
  const key = (c, s) => c + '\u0000' + s;
  const buckets = new Map();
  for (const r of data) {
    const c = r[x] === null || r[x] === undefined ? '' : String(r[x]);
    const s = series ? String(r[series]) : '';
    const k = key(c, s);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(how === 'count' ? 1 : num(r[y]));
  }
  let cats = uniq(data.map((r) => (r[x] === null || r[x] === undefined ? '' : String(r[x]))));
  const seriesKeys = series ? uniq(data.map((r) => String(r[series]))) : [''];
  const val = (c, s) => {
    const v = buckets.get(key(c, s));
    return v ? aggregate(v, how === 'count' ? 'sum' : how) : 0;
  };
  const values = new Map(cats.map((c) => [c, seriesKeys.map((s) => val(c, s) || 0)]));
  // Un dato que falta no es un cero: la barra no se dibuja y el tooltip lo dice.
  const missingSet = new Set();
  if (how !== 'count') for (const c of cats) seriesKeys.forEach((s, i) => {
    const v = buckets.get(key(c, s));
    if (!v || !v.some(Number.isFinite)) missingSet.add(c + '\u0000' + i);
  });
  const isMissing = (c, i) => missingSet.has(c + '\u0000' + i);
  const errs = new Map();
  if (errorbar && errorbar !== 'none') for (const c of cats) errs.set(c, seriesKeys.map((s) => {
    const v = (buckets.get(key(c, s)) || []).filter(Number.isFinite);
    if (v.length < 2) return null;
    if (errorbar === 'sd') { const mm = mean(v), d = sd(v); return [mm - d, mm + d]; }
    if (errorbar === 'se') { const mm = mean(v), d = sd(v) / Math.sqrt(v.length); return [mm - d, mm + d]; }
    return meanCI(v, level);
  }));
  const total = (c) => values.get(c).reduce((a, b) => a + b, 0);
  if (kind === 'year' || kind === 'number') cats.sort((a, b) => num(a) - num(b));
  else if (kind === 'date') cats.sort((a, b) => parseDate(a) - parseDate(b));
  const nominal = kind === 'category';
  const sort = spec.sort ?? (nominal ? 'desc' : 'none');
  if (sort === 'desc') cats.sort((a, b) => total(b) - total(a));
  else if (sort === 'asc') cats.sort((a, b) => total(a) - total(b));
  else if (sort === 'alpha') cats.sort((a, b) => a.localeCompare(b, 'es'));

  // Cola larga → "Otros" (nunca 40 barras ilegibles).
  // Solo categorías nominales: los periodos (años, meses) nunca se pliegan en "Otros".
  const top = spec.top ?? (nominal && cats.length > 40 ? 25 : null);
  let folded = 0;
  if (top && cats.length > top) {
    const keep = cats.slice(0, top);
    const rest = cats.slice(top);
    folded = rest.length;
    const otherName = String(spec.locale || 'es').startsWith('en') ? 'Other' : 'Otros';
    values.set(otherName, seriesKeys.map((_, i) => rest.reduce((a, c) => a + values.get(c)[i], 0)));
    cats = [...keep, otherName];
  }
  return { data, x, y, series, seriesKeys, cats, values, kind, nominal, folded, total, errs, errorbar, isMissing };
}

export function bar(spec, theme) {
  const m = prepareBar(spec);
  const locale = spec.locale || 'es';
  const { cats, values, seriesKeys } = m;
  const multi = m.series && seriesKeys.length > 1;
  const stack = multi ? spec.stack ?? false : false;
  const pct = stack === 'percent' || stack === 'normalize';
  // `stackGap`: px entre segmentos apilados (2 por defecto; 0 los junta: con
  // muchas series, el blanco entre segmentos finos los lava).
  const SG = Number.isFinite(+spec.stackGap) && spec.stackGap !== null && spec.stackGap !== '' && +spec.stackGap >= 0 ? +spec.stackGap : 2;
  const k = seriesKeys.length;

  // Valores apilados
  const segs = new Map();
  for (const c of cats) {
    const vs = values.get(c);
    const tot = vs.reduce((a, b) => a + Math.abs(b), 0) || 1;
    let pos = 0, neg = 0;
    segs.set(c, vs.map((v) => {
      const vv = pct ? v / tot : v;
      if (vv >= 0) { const s = { from: pos, to: pos + vv, v, vv }; pos += vv; return s; }
      const s = { from: neg, to: neg + vv, v, vv }; neg += vv; return s;
    }));
  }
  const all = stack
    ? cats.flatMap((c) => segs.get(c).map((s) => s.to))
    : cats.flatMap((c) => values.get(c));
  if (m.errs.size) for (const e of m.errs.values()) for (const r of e) if (r) all.push(...r);
  let vmin = Math.min(0, ...all), vmax = Math.max(0, ...all);
  if (pct) { vmin = Math.min(0, vmin); vmax = Math.max(vmax, 1); }
  // Conteos y enteros: marcas enteras (nunca 0,5 personas).
  const allInt = !pct && all.length > 0 && all.every((v) => Number.isInteger(v));
  // Una función de formato manda también al 100 % (recibe la fracción, 0–1).
  const fmt = pct && typeof spec.format !== 'function' ? makeFormat({ type: 'percent', scale: 100, decimals: spec.format?.decimals }, locale) : makeFormat(spec.format, locale, all);
  // `yFormat`: las marcas del eje de valores, aparte de `format` (rótulos y tooltip).
  const axisFmt = spec.yFormat !== undefined ? makeFormat(spec.yFormat, locale, all) : fmt;
  const missingLabel = spec.missingLabel ?? (String(locale).startsWith('en') ? 'no data' : 'sin dato');
  const vf = (c, i, v) => (m.isMissing(c, i) ? missingLabel : fmt(v));

  // Orientación
  const frame = createFrame(spec, theme, { height: 420 });
  const labelSize = 12.5;
  const maxCatW = Math.max(...cats.map((c) => measure(c, labelSize)));
  let horizontal = spec.horizontal ?? spec.orientation === 'horizontal';
  if (spec.horizontal === undefined && !spec.orientation) {
    const slot = (frame.width - frame.pad * 2) / Math.max(1, cats.length);
    horizontal = m.nominal && (cats.length > 12 || maxCatW > slot - 10);
  }

  // Color: identidad por serie; una sola serie → un solo color (o highlight).
  const cmap = colorMap(seriesKeys, theme, spec.colors);
  const hl = spec.highlight === undefined ? null : new Set([].concat(spec.highlight).map(String));
  const hlSeries = hl && seriesKeys.some((s) => hl.has(s));
  const colorFor = (c, si) => {
    if (multi) {
      // highlight sobre series: se atenúan las demás; si nombra categorías, las otras categorías.
      if (hl && (hlSeries ? !hl.has(seriesKeys[si]) : !hl.has(c))) return theme.dim;
      return cmap.get(seriesKeys[si]);
    }
    if (spec.colors && spec.colors[c]) return spec.colors[c];
    if (hl) return hl.has(c) ? theme.categorical[0] : theme.dim;
    return c === 'Otros' || c === 'Other' ? theme.other : theme.categorical[0];
  };
  const legend = multi && spec.legend !== false ? seriesKeys.map((s) => ({ label: s, color: hlSeries && !hl.has(s) ? theme.dim : cmap.get(s), shape: 'square' })) : [];

  // Barras punteadas (estimaciones, cifras provisorias): relleno rayado + borde discontinuo.
  const H = hatcher(theme, chartId(spec, 'hatch'));
  const dm = dashedMatcher(spec, m.data, m.x, m.series);
  // Tooltip: las filas de la marca (su categoría y, si hay, su serie).
  const T = tipper(spec, m.data, locale);
  // `href: "campo"` (barras horizontales): el nombre de cada categoría enlaza.
  const hrefOf = (c) => (spec.href ? (m.data.find((r) => String(r[m.x]) === c) || {})[spec.href] : undefined);
  const key = (c, i) => ({ [m.x]: c, ...(m.series && i !== undefined ? { [m.series]: seriesKeys[i] } : {}) });
  const xNum = (c) => (m.kind === 'date' ? parseDate(c) : num(c));
  const from = m.nominal ? null : fromTest(spec, xNum);
  const isDashed = (c, si) => !!((dm && dm(c, multi ? seriesKeys[si] : m.series ? seriesKeys[0] : undefined)) || (from && from(xNum(c))));
  const anyDashed = (dm || from) && cats.some((c) => seriesKeys.some((_, i) => isDashed(c, i)));
  const dashedLabel = spec.dashedLabel ?? dashedDefaultLabel(locale);
  const dl = (c, si) => (isDashed(c, si) ? dashedLabel : '');
  const paint = (c, si) => (isDashed(c, si) ? dashedAttrs(H, colorFor(c, si)) : { fill: colorFor(c, si) });
  if (anyDashed && spec.legend !== false) legend.push({ label: dashedLabel, key: 'dashed', color: theme.muted, shape: 'square', dashed: true, fill: H.fill(theme.muted), stroke: H.stroke(theme.muted) });

  // Etiquetas de valor
  const labelMode = spec.labels ?? 'auto';
  const showLabels = labelMode === true || (labelMode === 'auto' && !m.errs.size && (!multi || stack) && cats.length <= (horizontal ? 40 : 16));
  const labelOf = (c) => (stack ? (pct ? '' : fmt(m.total(c))) : vf(c, 0, values.get(c)[0]));
  const valueLabelW = showLabels ? Math.max(...cats.map((c) => measure(labelOf(c), SIZES.label, 600))) : 0;
  const hideAxis = spec.axis === false || (showLabels && !multi && !(spec.refLines || []).length && spec.axis !== true);
  const maxBar = spec.barWidth || (horizontal ? theme.marks?.barMaxH ?? 22 : theme.marks?.barMax ?? 36);

  let area = frame.layout(legend);
  const RAD = theme.marks?.barRadius ?? 4;
  // Grupos del eje de categorías (xGroup / yGroup: en barras, cualquiera de los dos
  // agrupa las categorías, sea cual sea la orientación). Sin reordenar.
  const groupF = spec.xGroup ?? spec.yGroup;
  if (groupF) requireField(m.data, groupF, spec.xGroup ? 'xGroup' : 'yGroup');
  const runs = groupF ? groupRuns(cats, m.data, m.x, groupF) : null;
  const tickEvery = Math.max(1, Math.floor((spec.xTicks ?? spec.yTicks)?.every ?? 1));
  const body = [];
  const refs = (spec.refLines || []).map((r) => ({ ...r, y: r.value ?? r.y }));

  if (!horizontal) {
    // ── Columnas
    if (spec.height === undefined && frame.height < 360) frame.setHeight(360);
    const ticksCount = Math.max(3, Math.round(area.h / 64));
    const nd = spec.yDomain ? { min: spec.yDomain[0], max: spec.yDomain[1], step: niceStep(spec.yDomain[1] - spec.yDomain[0], ticksCount) } : niceDomain(vmin, vmax, ticksCount, { integer: allInt });
    const dom = hideAxis && !spec.yDomain ? { min: vmin, max: vmax || 1 } : nd;
    let leftM = hideAxis ? 0 : ticksWidth(linear(nd.min, nd.max, 0, 1).ticks(nd.step), axisFmt.tick(nd.step, linear(nd.min, nd.max, 0, 1).ticks(nd.step))) + 10;
    const top = showLabels ? 16 : 6;
    // Etiquetas bajo barras negativas: reserva espacio para que no pisen las categorías.
    let negPad = showLabels && vmin < 0 ? 16 : 0;
    const gH = runs ? GROUP_BAND : 0;
    // Facet con `sharey: "span"`: lo reservado arriba, abajo y a la izquierda
    // se iguala al del panel que más pide (mismos píxeles por unidad en todos).
    let padT = top * ctx.textScale, padB = 26 * ctx.textScale + negPad + gH;
    if (spec._domains) { spec._domains.y = [dom.min, dom.max]; spec._domains.pad = [padT, padB]; spec._domains.padX = [leftM, 0]; }
    if (spec._pad) { padT = Math.max(padT, spec._pad[0]); padB = Math.max(padB, spec._pad[1]); }
    if (spec._padX) leftM = Math.max(leftM, spec._padX[0]);
    // Las categorías van a la misma altura en todos los paneles de la fila.
    if (spec._pad) negPad = padB - 26 * ctx.textScale - gH;
    const inner = spec._pad
      ? { x: area.x + leftM, y: area.y + padT, w: area.w - leftM, h: area.h - padT - padB }
      : { x: area.x + leftM, y: area.y + top * ctx.textScale, w: area.w - leftM, h: area.h - top * ctx.textScale - 26 * ctx.textScale - negPad - gH };
    const yS = linear(dom.min, dom.max, inner.y + inner.h, inner.y);
    const xb = band(cats, inner.x, inner.x + inner.w, { inner: multi && !stack ? 0.2 : 0.3, outer: 0.1 });
    if (!hideAxis) body.push(gridY(yS.ticks(nd.step), yS, inner, theme, axisFmt.tick(nd.step, yS.ticks(nd.step))));
    const y0 = yS(0);
    // `xBands: [{ from, to, label }]`: tramos de categorías sombreados detrás.
    const xbands = [];
    for (const q of [].concat(spec.xBands || [])) {
      let i0 = cats.indexOf(String(q.from)), i1 = cats.indexOf(String(q.to ?? q.from));
      if (i0 < 0 || i1 < 0) continue;
      if (i1 < i0) [i0, i1] = [i1, i0];
      const pad = (xb.step - xb.bandwidth) / 2;
      const px0 = xb(cats[i0]) - pad, px1 = xb(cats[i1]) + xb.bandwidth + pad;
      const parts = [el('rect', { x: +px0.toFixed(2), y: inner.y, width: +(px1 - px0).toFixed(2), height: inner.h, fill: q.color || theme.tint, opacity: q.color ? 0.18 : 0.7 })];
      if (q.label) parts.push(text(px0 + 4, inner.y + 12, truncate(String(q.label), Math.max(40, px1 - px0 - 8), 11), { fill: theme.muted, fontSize: 11 }));
      xbands.push(g({ class: 'pa-xband' }, parts));
    }
    body.unshift(...xbands);
    // Ancho de barra relativo a la banda (≈ 60 % del paso, como Chart.js y
    // ECharts): con pocas categorías las barras no quedan como palitos entre
    // grandes huecos. `barWidth` lo fija; theme.marks.barMax es el piso.
    const capW = spec.barWidth || (stack ? Math.min(120, Math.max(maxBar * 1.4, xb.step * 0.6))
      : k === 1 ? Math.min(120, Math.max(maxBar, xb.step * 0.6)) : Math.max(maxBar, Math.min(56, (xb.step * 0.7) / k)));
    cats.forEach((c) => {
      const bx = xb(c);
      const bw = xb.bandwidth;
      const vs = values.get(c);
      const parts = [];
      const hit = el('rect', { x: bx - xb.step * 0.12, y: inner.y, width: bw + xb.step * 0.24, height: inner.h, fill: 'transparent' });
      if (stack) {
        const w = Math.min(capW, bw);
        const x0 = bx + (bw - w) / 2;
        const sg = segs.get(c);
        const lastPos = sg.map((s, i) => (s.vv > 0 ? i : -1)).filter((i) => i >= 0).pop();
        const lastNeg = sg.map((s, i) => (s.vv < 0 ? i : -1)).filter((i) => i >= 0).pop();
        sg.forEach((s, i) => {
          if (!s.vv) return;
          const ya = yS(s.from), yb = yS(s.to);
          let top = Math.min(ya, yb), h = Math.abs(yb - ya);
          const gap = s.from !== 0 ? SG : 0;
          if (s.vv > 0) h -= gap; else { top += gap; h -= gap; }
          const outer = s.vv > 0 ? i === lastPos : i === lastNeg;
          const d = barPath(x0, top, w, Math.max(0, h), s.vv > 0 ? 'up' : 'down', outer ? RAD : 0);
          parts.push(g({ class: 'pa-m', 'data-tip': T(key(c, i), c, `${seriesKeys[i]}: ${vf(c, i, pct ? s.vv : s.v)}`, dl(c, i)) }, [el('path', { d, ...paint(c, i) })]));
        });
        if (showLabels && !pct) {
          const t = m.total(c);
          const ty = t >= 0 ? yS(Math.max(0, ...sg.map((s) => s.to))) - 7 : yS(Math.min(0, ...sg.map((s) => s.to))) + 15;
          parts.push(text(bx + bw / 2, ty, fmt(t), { fill: theme.ink, fontSize: SIZES.label, fontWeight: 600, textAnchor: 'middle' }));
        }
        body.push(g({ 'data-tip': T(key(c), c, ...sg.map((s, i) => `${seriesKeys[i]}: ${vf(c, i, pct ? s.vv : s.v)}` + (isDashed(c, i) && dm ? ` (${dashedLabel})` : '')), pct ? '' : `Total: ${fmt(m.total(c))}`, from && from(xNum(c)) ? dashedLabel : '') }, [hit, ...parts]));
      } else {
        const w = Math.min(capW, (bw - 2 * (k - 1)) / k);
        const groupW = w * k + 2 * (k - 1);
        const x0 = bx + (bw - groupW) / 2;
        vs.forEach((v, i) => {
          const bxI = x0 + i * (w + 2);
          const yv = yS(v);
          const top = Math.min(yv, y0), h = Math.abs(yv - y0);
          const d = barPath(bxI, top, w, h, v >= 0 ? 'up' : 'down', RAD);
          const er0 = m.errs.get(c)?.[i];
          const label = (multi ? `${seriesKeys[i]}: ${vf(c, i, v)}` : vf(c, i, v)) + (er0 ? ` (IC ${fmt(er0[0])}–${fmt(er0[1])})` : '');
          parts.push(g({ class: 'pa-m', 'data-tip': T(key(c, i), c, label, dl(c, i)) }, [
            el('rect', { x: bxI - 1, y: inner.y, width: w + 2, height: inner.h, fill: 'transparent' }),
            el('path', { d, ...paint(c, i) }),
            errBar(m.errs.get(c)?.[i], (e) => [bxI + w / 2, yS(e)], true, theme),
          ]));
          // `missingMark: "s/d"`: lo que falta se escribe en la base, no se dibuja.
          if (spec.missingMark && m.isMissing(c, i) && (multi || !showLabels)) parts.push(text(bxI + w / 2, y0 - 5, String(spec.missingMark), { fill: theme.muted, fontSize: 10.5, textAnchor: 'middle' }));
          if (showLabels && !multi) {
            const strong = !hl || hl.has(c);
            parts.push(text(bxI + w / 2, v >= 0 ? yv - 7 : yv + 15, vf(c, i, v), { fill: strong ? theme.ink : theme.muted, fontSize: SIZES.label, fontWeight: strong ? 600 : 400, textAnchor: 'middle' }));
          }
        });
        body.push(g({}, [hit, ...parts]));
      }
    });
    // Línea base
    body.push(el('line', { x1: inner.x, x2: inner.x + inner.w, y1: Math.round(y0) + 0.5, y2: Math.round(y0) + 0.5, stroke: theme.axis, strokeWidth: 1 }));
    // Categorías
    const dUnit = m.kind === 'date' ? dateUnit(cats.map((c) => parseDate(c))) : null;
    // `full`: el nombre entero, para cuando se muestra uno de cada k (cabe en k pasos).
    const items = cats.map((c) => ({ pos: xb.center(c), label: m.nominal ? truncate(c, Math.max(xb.step - 6, 40), 12) : dUnit ? formatDate(parseDate(c), dUnit, locale) : c, full: m.nominal ? c : undefined }));
    body.push(xLabels(items, inner, theme, { y: inner.y + inner.h + 18 + negPad, size: 12, color: theme.lede, every: tickEvery, step: xb.step, steps: calendarSteps(dUnit) }));
    if (runs) body.push(groupBandX(runs, (i) => [xb.center(cats[i]) - xb.step / 2 + 1, xb.center(cats[i]) + xb.step / 2 - 1], inner.y + inner.h + 26 * ctx.textScale + negPad, theme, inner.y));
    body.push(refLinesY(refs, yS, inner, theme, fmt));
  } else {
    // ── Barras horizontales
    const step = Math.max(multi && !stack ? Math.min(maxBar, 16) * k + 2 * (k - 1) + 10 : maxBar + 9, 12.5 * ctx.textScale * 1.45);
    const needH = cats.length * step + 30;
    if (spec.height === undefined) {
      frame.setHeight(area.y + needH + frame.chrome);
      area = { ...area, h: frame.bottom - area.y };
    }
    const catW = Math.min(maxCatW, area.w * 0.38) + 12;
    const gW = runs ? groupBandWidth(runs, area.w * 0.22) : 0;
    if (gW) area = { ...area, x: area.x + gW, w: area.w - gW };
    const rightM = showLabels ? valueLabelW + 10 : 8;
    const hasNeg = vmin < 0;
    const inner = { x: area.x + catW, y: area.y + 4, w: area.w - catW - rightM - (hasNeg && showLabels ? valueLabelW + 10 : 0), h: area.h - (hideAxis ? 8 : 28) };
    if (hasNeg && showLabels) inner.x += valueLabelW + 10;
    // Cuántas marcas caben según el ancho real de sus rótulos (en un teléfono,
    // «7.500.000» no entra cada 50 px): así no hay que ralearlas después.
    const tickW = measure(axisFmt(Math.max(Math.abs(vmin), Math.abs(vmax))), SIZES.axis) + 18;
    const nTicks = Math.max(2, Math.min(Math.round(inner.w / 110), Math.floor(inner.w / tickW)));
    const nd = spec.yDomain ? { min: spec.yDomain[0], max: spec.yDomain[1], step: niceStep(spec.yDomain[1] - spec.yDomain[0], Math.max(2, nTicks)) } : niceDomain(vmin, vmax, nTicks, { integer: allInt });
    const dom = hideAxis && !spec.yDomain ? { min: vmin, max: vmax || 1 } : nd;
    if (spec._domains) spec._domains.y = [dom.min, dom.max];
    const xS = linear(dom.min, dom.max, inner.x, inner.x + inner.w);
    const yb = band(cats, inner.y, inner.y + inner.h, { inner: 0.32, outer: 0.1 });
    if (!hideAxis) body.push(gridX(xS.ticks(nd.step), xS, inner, theme, axisFmt.tick(nd.step, xS.ticks(nd.step))));
    const x0 = xS(0);
    cats.forEach((c) => {
      const by = yb(c);
      const bh = yb.bandwidth;
      const vs = values.get(c);
      const parts = [];
      const strong = !hl || hl.has(c);
      parts.push(el('rect', { x: area.x, y: by - yb.step * 0.16, width: area.w, height: yb.step, fill: 'transparent' }));
      if (cats.indexOf(c) % tickEvery === 0) parts.push(linkWrap(hrefOf(c), text(inner.x - 10 - (hasNeg && showLabels ? valueLabelW + 10 : 0), by + bh / 2 + 4.5, truncate(c, Math.min(maxCatW, area.w * 0.38) + 0.5, labelSize), { fill: strong ? theme.ink : theme.muted, fontSize: labelSize, fontWeight: hl && strong ? 600 : 400, textAnchor: 'end' })));
      if (stack) {
        const h = Math.min(maxBar, bh);
        const y0b = by + (bh - h) / 2;
        const sg = segs.get(c);
        const lastPos = sg.map((s, i) => (s.vv > 0 ? i : -1)).filter((i) => i >= 0).pop();
        const lastNeg = sg.map((s, i) => (s.vv < 0 ? i : -1)).filter((i) => i >= 0).pop();
        sg.forEach((s, i) => {
          if (!s.vv) return;
          const xa = xS(s.from), xb2 = xS(s.to);
          let left = Math.min(xa, xb2), w = Math.abs(xb2 - xa);
          if (s.from !== 0) { if (s.vv > 0) left += SG; w -= SG; }
          const d = barPath(left, y0b, Math.max(0, w), h, s.vv > 0 ? 'right' : 'left', i === lastPos || i === lastNeg ? RAD : 0);
          const fill = colorFor(c, i);
          const lab = pct ? fmt(s.vv) : '';
          const fits = lab && measure(lab, 11, 600) + 10 < w;
          const hatched = isDashed(c, i);
          parts.push(g({ class: 'pa-m', 'data-tip': T(key(c, i), c, `${seriesKeys[i]}: ${vf(c, i, pct ? s.vv : s.v)}`, dl(c, i)) }, [
            el('path', { d, ...paint(c, i) }),
            fits ? text(left + 6, y0b + h / 2 + 4, lab, { fill: hatched ? theme.ink : textColor(fill, theme), fontSize: 11, fontWeight: 600, ...(hatched ? { stroke: theme.surface, strokeWidth: 3, paintOrder: 'stroke' } : {}) }) : '',
          ]));
        });
        if (showLabels && !pct) parts.push(text(xS(Math.max(0, ...sg.map((s) => s.to))) + 7, by + bh / 2 + 4.5, fmt(m.total(c)), { fill: theme.ink, fontSize: SIZES.label, fontWeight: 600 }));
        body.push(g({ 'data-tip': T(key(c), c, ...sg.map((s, i) => `${seriesKeys[i]}: ${vf(c, i, pct ? s.vv : s.v)}` + (isDashed(c, i) ? ` (${dashedLabel})` : ''))) }, parts));
      } else {
        const h = Math.min(multi ? 16 : maxBar, (bh - 2 * (k - 1)) / k);
        const groupH = h * k + 2 * (k - 1);
        const y0b = by + (bh - groupH) / 2;
        vs.forEach((v, i) => {
          const yy = y0b + i * (h + 2);
          const xv = xS(v);
          const d = barPath(Math.min(xv, x0), yy, Math.abs(xv - x0), h, v >= 0 ? 'right' : 'left', RAD);
          const er = m.errs.get(c)?.[i];
          const erTxt = er ? ` (IC ${fmt(er[0])}–${fmt(er[1])})` : '';
          if (spec.missingMark && m.isMissing(c, i) && (multi || !showLabels)) parts.push(text(x0 + 5, yy + h / 2 + 4, String(spec.missingMark), { fill: theme.muted, fontSize: 10.5 }));
          parts.push(g({ class: 'pa-m', 'data-tip': T(key(c, i), c, (multi ? `${seriesKeys[i]}: ` : '') + vf(c, i, v) + erTxt, dl(c, i)) }, [el('path', { d, ...paint(c, i) }), errBar(er, (e) => [xS(e), yy + h / 2], false, theme)]));
          if (showLabels && !multi) {
            parts.push(text(v >= 0 ? xv + 7 : xv - 7, yy + h / 2 + 4.5, vf(c, i, v), { fill: strong ? theme.ink : theme.muted, fontSize: SIZES.label, fontWeight: strong ? 600 : 400, textAnchor: v >= 0 ? 'start' : 'end' }));
          }
        });
        body.push(g({}, parts));
      }
    });
    body.push(el('line', { x1: Math.round(x0) + 0.5, x2: Math.round(x0) + 0.5, y1: inner.y, y2: inner.y + inner.h, stroke: theme.axis, strokeWidth: 1 }));
    if (runs) body.push(groupBandY(runs, (i) => [yb.center(cats[i]) - yb.step / 2 + 1, yb.center(cats[i]) + yb.step / 2 - 1], area.x - gW, gW, theme, inner.x + inner.w));
    body.push(refLinesX(refs.map((r) => ({ ...r, x: r.y, y: undefined })), xS, inner, theme, fmt));
  }

  const desc = describeBar(m, fmt, locale);
  return frame.finish(body, { desc, type: 'bar', defs: H.defs() });
}

/** Barra de error fina con remates cortos (seaborn). */
function errBar(e, P, vertical, theme) {
  if (!e) return '';
  const [ax, ay] = P(e[0]), [bx, by] = P(e[1]);
  const c = 5;
  const d = vertical
    ? `M${ax},${ay}V${by}M${ax - c},${ay}H${ax + c}M${bx - c},${by}H${bx + c}`
    : `M${ax},${ay}H${bx}M${ax},${ay - c}V${ay + c}M${bx},${by - c}V${by + c}`;
  return el('path', { d, stroke: theme.ink, strokeWidth: 1.5, fill: 'none', strokeLinecap: 'round', opacity: 0.85 });
}

function textColor(fill, theme) {
  // Blanco sobre colores oscuros; tinta sobre ámbar/cielo/oliva.
  const [r, gg, b] = parseRgb(fill);
  const l = 0.299 * r + 0.587 * gg + 0.114 * b;
  return l > 150 ? (theme.mode === 'dark' ? '#0B0F2B' : theme.ink) : '#FFFFFF';
}

export function describeBar(m, fmt, locale = 'es') {
  const en = String(locale).startsWith('en');
  const totals = m.cats.map((c) => [c, m.total(c)]);
  if (!totals.length) return '';
  const sorted = [...totals].sort((a, b) => b[1] - a[1]);
  const sum = totals.reduce((a, [, v]) => a + v, 0);
  const [hiC, hiV] = sorted[0];
  const [loC, loV] = sorted[sorted.length - 1];
  const share = sum > 0 ? ` (${fmt.type === 'percent' ? '' : Math.round((hiV / sum) * 100) + '%'})`.replace(' ()', '') : '';
  const what = humanize(m.y === '__value' ? '' : m.y) || (en ? 'Value' : 'Valor');
  return en
    ? `Bar chart of ${what} across ${m.cats.length} categories. Highest: ${hiC} with ${fmt(hiV)}${share}. Lowest: ${loC} with ${fmt(loV)}.`
    : `Gráfico de barras de ${what.toLowerCase()} en ${m.cats.length} categorías. Mayor: ${hiC} con ${fmt(hiV)}${share}. Menor: ${loC} con ${fmt(loV)}.`;
}
