// Pirámide de población: barras horizontales espalda con espalda desde un eje
// central, con los tramos de edad en la columna del medio (sin ejes repetidos).
// Opcional: comparación con otro periodo como contorno escalonado.
import { el, g, text, tip, barPath } from '../svg.js';
import { measure } from '../text.js';
import { makeFormat, formatNumber } from '../format.js';
import { niceStep, linear } from '../scale.js';
import { colorMap, readable } from '../theme.js';
import { ensureData, requireField, num, uniq, fieldsOf, fieldKind, PlotError } from '../data.js';
import { createFrame } from '../frame.js';

const T = (en, es, locale) => (String(locale || 'es').startsWith('en') ? en : es);
const lead = (s) => { const m = /^\s*(\d+)/.exec(String(s)); return m ? +m[1] : NaN; };

export function pyramid(spec, theme) {
  const locale = spec.locale || 'es';
  const data = ensureData(spec);
  const fields = fieldsOf(data);
  const cats = fields.filter((f) => fieldKind(data, f) !== 'number' || /edad|age|grupo|tramo/i.test(f));
  const nums = fields.filter((f) => fieldKind(data, f) === 'number');
  const ageF = spec.age ?? spec.y ?? cats.find((f) => /edad|age|tramo|grupo/i.test(f)) ?? cats[0];
  const sideF = spec.sex ?? spec.series ?? spec.hue ?? (typeof spec.color === 'string' && !spec.color.startsWith('#') ? spec.color : null) ?? cats.find((f) => f !== ageF && /sexo|sex|gender|género|genero/i.test(f)) ?? cats.find((f) => f !== ageF);
  const valF = spec.value ?? spec.x ?? nums.find((f) => f !== ageF && f !== sideF);
  requireField(data, ageF, 'age');
  requireField(data, sideF, 'series');
  requireField(data, valF, 'value');

  // Comparación: otra tabla (compareData) o un valor de un campo (compare + compareField).
  // Con `time` el núcleo ya filtró los datos y entrega el periodo de comparación en _prev.
  let rows = data, cmpRows = spec.compareData ? ensureData({ data: spec.compareData }) : spec._prev && spec.compare !== undefined && spec.compare !== false ? spec._prev.data : null;
  const cmpField = spec.compareField ?? spec.time;
  if (!cmpRows && spec.compare !== undefined && cmpField && fields.includes(cmpField)) {
    cmpRows = data.filter((r) => String(r[cmpField]) === String(spec.compare));
    rows = data.filter((r) => String(r[cmpField]) !== String(spec.compare));
    const periods = uniq(rows.map((r) => String(r[cmpField])));
    if (periods.length > 1) { const last = spec.current ?? periods.sort().at(-1); rows = rows.filter((r) => String(r[cmpField]) === String(last)); }
  }

  const sides = spec.sides ?? uniq(rows.map((r) => String(r[sideF])));
  if (sides.length !== 2) throw new PlotError(T(`A population pyramid needs exactly 2 groups in "${sideF}" (found ${sides.length}).`, `La pirámide necesita exactamente 2 grupos en "${sideF}" (hay ${sides.length}).`, locale), T('Filter the data to two groups, e.g. men and women.', 'Filtra los datos a dos grupos, por ejemplo hombres y mujeres.', locale));
  let ages = uniq([...rows, ...(cmpRows || [])].map((r) => String(r[ageF])));
  if (ages.every((a) => Number.isFinite(lead(a)))) ages.sort((a, b) => lead(a) - lead(b));
  if (spec.ageOrder) ages = spec.ageOrder.map(String);
  const top = [...ages].reverse(); // los mayores arriba

  const sumBy = (rs) => {
    const m = new Map();
    for (const r of rs) {
      const k = String(r[ageF]) + '\u0000' + String(r[sideF]);
      const v = num(r[valF]);
      if (Number.isFinite(v)) m.set(k, (m.get(k) || 0) + Math.abs(v));
    }
    return m;
  };
  const cur = sumBy(rows), cmp = cmpRows ? sumBy(cmpRows) : null;
  const total = [...cur.values()].reduce((a, b) => a + b, 0) || 1;
  const cmpTotal = cmp ? [...cmp.values()].reduce((a, b) => a + b, 0) || 1 : 1;
  const pct = spec.percent === true || spec.format === 'percent' || spec.format?.type === 'percent';
  const val = (m, a, s, tot) => { const v = m.get(a + '\u0000' + s) || 0; return pct ? v / tot : v; };
  const V = (a, s) => val(cur, a, s, total);
  const C = (a, s) => (cmp ? val(cmp, a, s, cmpTotal) : NaN);

  const allV = ages.flatMap((a) => sides.flatMap((s) => [V(a, s), C(a, s)])).filter(Number.isFinite);
  const vmax = Math.max(...allV, 1e-9);
  const fmt = pct ? makeFormat({ type: 'percent', scale: 100, decimals: spec.format?.decimals }, locale) : makeFormat(spec.format, locale, allV);
  const share = (v) => formatNumber((v / total) * 100, (v / total) * 100 < 10 ? 1 : 0, locale, true) + '%';

  const cmap = colorMap(sides, theme, spec.colors);
  const colorOf = (s) => cmap.get(s);
  const cmpLabel = spec.compareLabel ?? spec._prev?.label ?? (spec.compare !== undefined ? String(spec.compare) : T('Comparison', 'Comparación', locale));
  const legend = cmp && spec.legend !== false ? [{ label: cmpLabel, color: theme.ink, shape: 'line' }] : [];

  const frame = createFrame(spec, theme);
  let area = frame.layout(legend);
  const n = ages.length;
  const headerH = 24, axisH = 24;
  const step = spec.barHeight ? spec.barHeight + 2 : Math.max(14, Math.min(26, frame.width < 480 ? 17 : 21));
  if (spec.height === undefined) {
    frame.setHeight(Math.max(frame.height, area.y + headerH + n * step + axisH + frame.chrome));
    area = { ...area, h: frame.bottom - area.y };
  }
  const ageSize = theme.type?.axis ?? 11.5;
  const centerW = Math.max(...ages.map((a) => measure(a, ageSize, 500))) + 18;
  const labelsOn = spec.labels === true;
  const sample = fmt(vmax);
  const endPad = labelsOn ? measure(sample, 11, 600) + 8 : 4;
  const halfW = (area.w - centerW) / 2;
  const cx0 = area.x + halfW, cx1 = cx0 + centerW; // bordes de la columna central
  const plotTop = area.y + headerH;
  const plotH = area.h - headerH - axisH;
  const st = plotH / n;
  const bh = Math.max(4, Math.min(spec.barHeight ?? 24, st - 2));
  // Escala ajustada al dato (sin aire vacío), marcas "bonitas" dentro de ella.
  const nd = { step: niceStep(vmax, Math.max(2, Math.round((halfW - endPad) / 85))) };
  const dmax = spec.xDomain ? spec.xDomain[1] : vmax * 1.02;
  const len = linear(0, dmax, 0, halfW - endPad);
  const yOf = (i) => plotTop + i * st + (st - bh) / 2;

  const body = [];
  // Grilla vertical simétrica y marcas absolutas abajo.
  const tf = fmt.tick(nd.step);
  const tsize = theme.type?.axis ?? 11.5;
  const ticks = len.ticks(nd.step).filter((t) => t <= dmax + 1e-9 && len(t) + measure(tf(t), tsize) / 2 <= halfW + 2);
  const gridParts = [];
  for (const t of ticks) {
    for (const [x, anchor] of [[cx0 - len(t), 'middle'], [cx1 + len(t), 'middle']]) {
      const px = Math.round(x) + 0.5;
      gridParts.push(el('line', { x1: px, x2: px, y1: plotTop - 4, y2: plotTop + plotH, stroke: t === 0 ? theme.axis : theme.grid, strokeWidth: 1, shapeRendering: 'crispEdges' }));
      if (t === 0 && anchor) continue;
      gridParts.push(text(px, plotTop + plotH + 16, tf(t), { fill: theme.muted, fontSize: theme.type?.axis ?? 11.5, textAnchor: anchor }));
    }
  }
  body.push(g({ class: 'pa-grid' }, gridParts));

  // Encabezados: nombre de cada lado en su color (legible) y su participación.
  const sideTot = (s) => ages.reduce((a, ag) => a + (cur.get(ag + '\u0000' + s) || 0), 0);
  sides.forEach((s, k) => {
    const lab = s;
    const sh = share(sideTot(s)) ;
    const hx = k === 0 ? cx0 - 2 : cx1 + 2;
    const anchor = k === 0 ? 'end' : 'start';
    const tw = measure(lab, 13, 600);
    body.push(text(hx, area.y + 14, lab, { fill: readable(colorOf(s), theme), fontSize: 13, fontWeight: 600, textAnchor: anchor }));
    body.push(text(k === 0 ? hx - tw - 6 : hx + tw + 6, area.y + 14, sh, { fill: theme.muted, fontSize: 12, textAnchor: anchor }));
  });

  // Barras
  top.forEach((a, i) => {
    const y = yOf(i);
    // Etiqueta de edad en la columna central.
    body.push(text((cx0 + cx1) / 2, y + bh / 2 + ageSize * 0.36, a, { fill: theme.lede, fontSize: ageSize, fontWeight: 500, textAnchor: 'middle' }));
    sides.forEach((s, k) => {
      const v = V(a, s);
      const w = len(Math.min(v, dmax));
      const c = colorOf(s);
      const x = k === 0 ? cx0 - w : cx1;
      const d = barPath(x, y, w, bh, k === 0 ? 'left' : 'right', Math.min(3.5, bh / 2));
      const cv = C(a, s);
      const lines = [`${a} · ${s}`, fmt(v) + (pct ? '' : ` · ${share(v)}`)];
      if (Number.isFinite(cv)) lines.push(`${cmpLabel}: ${fmt(cv)}`);
      const parts = [el('rect', { x: k === 0 ? area.x : cx1, y: plotTop + i * st, width: halfW, height: st, fill: 'transparent' })];
      if (d) parts.push(el('path', { d, fill: c }));
      if (labelsOn && v > 0) {
        const lab = fmt(v);
        parts.push(text(k === 0 ? x - 5 : x + w + 5, y + bh / 2 + 4, lab, { fill: theme.lede, fontSize: 11, fontWeight: 500, textAnchor: k === 0 ? 'end' : 'start' }));
      }
      body.push(g({ class: 'pa-m', 'data-tip': tip(...lines) }, parts));
    });
  });

  // Comparación: contorno escalonado por lado.
  if (cmp) {
    sides.forEach((s, k) => {
      let d = '';
      top.forEach((a, i) => {
        const cv = C(a, s);
        if (!Number.isFinite(cv)) return;
        const x = k === 0 ? cx0 - len(Math.min(cv, dmax)) : cx1 + len(Math.min(cv, dmax));
        const y0 = plotTop + i * st, y1 = y0 + st;
        d += (d ? `L${x.toFixed(1)},${y0.toFixed(1)}` : `M${(k === 0 ? cx0 : cx1).toFixed(1)},${y0.toFixed(1)}L${x.toFixed(1)},${y0.toFixed(1)}`) + `L${x.toFixed(1)},${y1.toFixed(1)}`;
      });
      if (d) {
        d += `L${(k === 0 ? cx0 : cx1).toFixed(1)},${(plotTop + n * st).toFixed(1)}`;
        body.push(el('path', { d, fill: 'none', stroke: theme.ink, strokeWidth: 1.5, strokeLinejoin: 'round', opacity: 0.85, class: 'pa-compare' }));
      }
    });
  }

  // Descripción
  const en = String(locale).startsWith('en');
  let big = null;
  for (const a of ages) for (const s of sides) { const v = cur.get(a + '\u0000' + s) || 0; if (!big || v > big[2]) big = [a, s, v]; }
  const desc = (en ? 'Population pyramid. ' : 'Pirámide de población. ')
    + sides.map((s) => `${s} ${share(sideTot(s))}`).join(', ') + '. '
    + (big ? (en ? `Largest group: ${big[0]} (${big[1]}), ${fmt(pct ? big[2] / total : big[2])}.` : `Grupo más numeroso: ${big[0]} (${big[1]}), ${fmt(pct ? big[2] / total : big[2])}.`) : '');
  return frame.finish(body, { desc, type: 'pyramid' });
}
