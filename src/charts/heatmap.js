// Mapa de calor: magnitud en una grilla de dos categorías (o tiempo).
// Rampa secuencial de un solo tono; divergente si hay un punto medio.
import { tipper } from '../tooltip.js';
import { el, g, text, tip } from '../svg.js';
import { measure, truncate } from '../text.js';
import { makeFormat } from '../format.js';
import { ramp, textOn } from '../theme.js';
import { ensureData, requireField, uniq, num, fieldsOf, fieldKind, aggregate, humanize } from '../data.js';
import { xLabels, groupRuns, groupBandX, groupBandY, groupBandWidth, GROUP_BAND } from '../axes.js';
import { createFrame, hash } from '../frame.js';
import { binnedScale } from '../colorscales.js';

export function heatmap(spec, theme) {
  const data = ensureData(spec);
  const fields = fieldsOf(data);
  const nonNum = fields.filter((f) => fieldKind(data, f) !== 'number');
  const x = spec.x ?? nonNum[0];
  const y = spec.y ?? nonNum.find((f) => f !== x);
  const valueF = spec.value ?? fields.find((f) => f !== x && f !== y && fieldKind(data, f) === 'number');
  requireField(data, x, 'x');
  requireField(data, y, 'y');
  requireField(data, valueF, 'value');
  const locale = spec.locale || 'es';
  const xs = uniq(data.map((r) => String(r[x])));
  const ys = uniq(data.map((r) => String(r[y])));
  const cells = new Map();
  for (const r of data) {
    const k = String(r[x]) + '\u0000' + String(r[y]);
    if (!cells.has(k)) cells.set(k, []);
    cells.get(k).push(num(r[valueF]));
  }
  const TT = tipper(spec, data, locale);
  const val = (a, b) => { const v = cells.get(a + '\u0000' + b); return v ? aggregate(v, spec.aggregate || 'sum') : NaN; };
  // `floor` / `ceiling`: lo que cae fuera se dibuja como celda vacía (no es
  // «sin dato»: el valor existe y el tooltip lo dice) y no cuenta para la escala.
  const lo = spec.floor ?? null, hi = spec.ceiling ?? null;
  const outside = (v) => Number.isFinite(v) && ((lo !== null && v < lo) || (hi !== null && v > hi));
  const finite = [...cells.keys()].map((k) => { const [a, b] = k.split('\u0000'); return val(a, b); }).filter(Number.isFinite);
  const all = finite.filter((v) => !outside(v));
  const vmin = Math.min(...all), vmax = Math.max(...all);
  const fmt = makeFormat(spec.format, locale, finite);
  const mid = spec.midpoint ?? (spec.diverging ? 0 : undefined);
  const stops = mid !== undefined ? theme.diverging : theme.sequential;
  const bins0 = binnedScale(spec);
  // `midClass: 'neutral'`: con cortes divergentes, la clase que contiene el 0
  // (sin que el 0 sea un corte) va en el tinte neutro: lo que casi no se aparta
  // no se pinta.
  const bins = bins0 && spec.midClass === 'neutral' && !bins0.breaks.includes(0) && bins0.breaks[0] < 0 && bins0.breaks[bins0.breaks.length - 1] > 0
    ? (() => { const k = bins0.cls(0); const colors = bins0.colors.map((c, i) => (i === k ? theme.tint : c)); return { ...bins0, colors, color: (v) => colors[bins0.cls(v)] }; })()
    : bins0;
  // Celdas sin valor: 'tint' (por defecto, un tinte), 'plain' (sólo el borde),
  // 'hatch' (rayado de «sin dato») o 'gap' (nada).
  const missing = ['tint', 'plain', 'hatch', 'gap'].includes(spec.missing) ? spec.missing : 'tint';
  const ndId = 'pa-hm-nd-' + Math.abs(hash(String(valueF) + xs.length + ys.length + (spec.title || ''))).toString(36);
  const colorOf = (v) => {
    if (!Number.isFinite(v)) return missing === 'hatch' ? `url(#${ndId})` : theme.tint;
    if (bins) return bins.color(v);
    if (mid !== undefined) {
      const span = Math.max(vmax - mid, mid - vmin) || 1;
      return ramp(stops, 0.5 + (v - mid) / span / 2);
    }
    return ramp(stops.slice(1), (v - vmin) / (vmax - vmin || 1));
  };

  const legend = spec.legend === false ? [] : bins
    ? [{ type: 'steps', colors: bins.colors, labels: bins.breaks.map((b) => fmt(b)), title: spec.legendTitle ?? humanize(valueF) }]
    : [{ type: 'ramp', stops: mid !== undefined ? stops : stops.slice(1), min: fmt(mid !== undefined ? -(Math.max(vmax - mid, mid - vmin)) + mid : vmin), max: fmt(mid !== undefined ? Math.max(vmax - mid, mid - vmin) + mid : vmax), title: spec.legendTitle ?? humanize(valueF) }];
  const frame = createFrame(spec, theme, { height: Math.min(640, 140 + ys.length * 34) });
  const area = frame.layout(legend);
  const xRuns = spec.xGroup ? (requireField(data, spec.xGroup, 'xGroup'), groupRuns(xs, data, x, spec.xGroup)) : null;
  const yRuns = spec.yGroup ? (requireField(data, spec.yGroup, 'yGroup'), groupRuns(ys, data, y, spec.yGroup)) : null;
  const gW = yRuns ? groupBandWidth(yRuns, area.w * 0.22) : 0;
  const gH = xRuns ? GROUP_BAND : 0;
  const yW = Math.min(area.w * 0.3, Math.max(...ys.map((v) => measure(v, 12)))) + 12;
  const inner = { x: area.x + gW + yW, y: area.y, w: area.w - gW - yW, h: area.h - 26 - gH };
  const cw = inner.w / xs.length, ch = Math.min(inner.h / ys.length, spec.cellHeight ?? 56);
  inner.h = ch * ys.length;
  if (spec.height === undefined) frame.setHeight(inner.y + inner.h + 26 + gH + frame.chrome);
  const showLabels = spec.labels ?? (all.length > 0 && cw >= Math.max(...all.map((v) => measure(fmt(v), 11))) + 8 && ch >= 18);
  const yEvery = Math.max(1, Math.floor(spec.yTicks?.every ?? 1));

  const body = [];
  if (missing === 'hatch') {
    body.push(el('defs', {}, el('pattern', { id: ndId, width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, [
      el('rect', { width: 6, height: 6, fill: theme.surface }),
      el('line', { x1: 0, y1: 0, x2: 0, y2: 6, stroke: theme.axis, strokeWidth: 1.5 }),
    ])));
  }
  // `emptyRow: 'sin dato'`: una fila sin ningún valor se rotula de lado a lado
  // en vez de dibujar celdas vacías.
  const rowEmpty = (b) => typeof spec.emptyRow === 'string' && xs.every((a) => !Number.isFinite(val(a, b)));
  ys.forEach((b, j) => {
    if (rowEmpty(b)) {
      if (j % yEvery === 0) body.push(text(inner.x - 10, inner.y + j * ch + ch / 2 + 4, truncate(b, yW - 12, 12), { fill: theme.muted, fontSize: 12, textAnchor: 'end' }));
      body.push(g({ class: 'pa-m', 'data-tip': tip(b, spec.emptyRow) }, [
        el('rect', { x: inner.x + 1, y: inner.y + j * ch + 1, width: Math.max(0, inner.w - 2), height: Math.max(0, ch - 2), rx: 3, fill: 'transparent', stroke: theme.grid, strokeWidth: 1 }),
        text(inner.x + inner.w / 2, inner.y + j * ch + ch / 2 + 4, spec.emptyRow, { fill: theme.muted, fontSize: 11.5, textAnchor: 'middle' }),
      ]));
      return;
    }
    if (j % yEvery === 0) body.push(text(inner.x - 10, inner.y + j * ch + ch / 2 + 4, truncate(b, yW - 12, 12), { fill: theme.lede, fontSize: 12, textAnchor: 'end' }));
    xs.forEach((a, i) => {
      const v = val(a, b);
      const cx = inner.x + i * cw + 1, cy = inner.y + j * ch + 1;
      const box = { x: cx, y: cy, width: Math.max(0, cw - 2), height: Math.max(0, ch - 2), rx: 3 };
      const tipTxt = TT({ [x]: a, [y]: b }, `${b} · ${a}`, Number.isFinite(v) ? fmt(v) : '—');
      if (!Number.isFinite(v) && missing === 'gap') return;
      // Celda vacía: sin dato con missing: 'plain', o un valor fuera de floor/ceiling.
      if (outside(v) || (!Number.isFinite(v) && missing === 'plain')) {
        body.push(g({ class: 'pa-m', 'data-tip': tipTxt }, [el('rect', { ...box, fill: 'transparent', stroke: theme.grid, strokeWidth: 1 })]));
        return;
      }
      const fill = colorOf(v);
      const parts = [el('rect', { ...box, fill })];
      if (showLabels && Number.isFinite(v)) parts.push(text(cx + (cw - 2) / 2, cy + (ch - 2) / 2 + 4, fmt(v), { fill: textOn(fill, theme), fontSize: 11, textAnchor: 'middle', fontWeight: 500 }));
      body.push(g({ class: 'pa-m', 'data-tip': tipTxt }, parts));
    });
  });
  body.push(xLabels(xs.map((a, i) => ({ pos: inner.x + i * cw + cw / 2, label: a })), inner, theme, { y: inner.y + inner.h + 18, color: theme.lede, every: spec.xTicks?.every }));
  if (xRuns) body.push(groupBandX(xRuns, (i) => [inner.x + i * cw + 1, inner.x + (i + 1) * cw - 1], inner.y + inner.h + 26, theme, inner.y));
  if (yRuns) body.push(groupBandY(yRuns, (j) => [inner.y + j * ch + 1, inner.y + (j + 1) * ch - 1], area.x, gW, theme, inner.x + inner.w));

  const en = String(locale).startsWith('en');
  let best = null;
  for (const a of xs) for (const b of ys) { const v = val(a, b); if (Number.isFinite(v) && (!best || v > best[2])) best = [a, b, v]; }
  const desc = en
    ? `Heatmap of ${humanize(valueF)} by ${humanize(x)} and ${humanize(y)}.` + (best ? ` Highest: ${best[1]} · ${best[0]} (${fmt(best[2])}).` : ' No cell has a numeric value.')
    : `Mapa de calor de ${humanize(valueF).toLowerCase()} por ${humanize(x).toLowerCase()} y ${humanize(y).toLowerCase()}.` + (best ? ` Máximo: ${best[1]} · ${best[0]} (${fmt(best[2])}).` : ' Ninguna celda tiene un valor numérico.');
  return frame.finish(body, { desc, type: 'heatmap' });
}
