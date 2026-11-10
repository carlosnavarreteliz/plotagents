// Mapa de calor: magnitud en una grilla de dos categorías (o tiempo).
// Rampa secuencial de un solo tono; divergente si hay un punto medio.
import { el, g, text, tip } from '../svg.js';
import { measure, truncate } from '../text.js';
import { makeFormat } from '../format.js';
import { ramp, textOn } from '../theme.js';
import { ensureData, requireField, uniq, num, fieldsOf, fieldKind, aggregate, humanize } from '../data.js';
import { xLabels } from '../axes.js';
import { createFrame } from '../frame.js';

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
  const val = (a, b) => { const v = cells.get(a + '\u0000' + b); return v ? aggregate(v, spec.aggregate || 'sum') : NaN; };
  const all = [...cells.keys()].map((k) => { const [a, b] = k.split('\u0000'); return val(a, b); }).filter(Number.isFinite);
  const vmin = Math.min(...all), vmax = Math.max(...all);
  const fmt = makeFormat(spec.format, locale, all);
  const mid = spec.midpoint ?? (spec.diverging ? 0 : undefined);
  const stops = mid !== undefined ? theme.diverging : theme.sequential;
  const colorOf = (v) => {
    if (!Number.isFinite(v)) return theme.tint;
    if (mid !== undefined) {
      const span = Math.max(vmax - mid, mid - vmin) || 1;
      return ramp(stops, 0.5 + (v - mid) / span / 2);
    }
    return ramp(stops.slice(1), (v - vmin) / (vmax - vmin || 1));
  };

  const legend = [{ type: 'ramp', stops: mid !== undefined ? stops : stops.slice(1), min: fmt(mid !== undefined ? -(Math.max(vmax - mid, mid - vmin)) + mid : vmin), max: fmt(mid !== undefined ? Math.max(vmax - mid, mid - vmin) + mid : vmax), title: spec.legendTitle ?? humanize(valueF) }];
  const frame = createFrame(spec, theme, { height: Math.min(640, 140 + ys.length * 34) });
  const area = frame.layout(legend);
  const yW = Math.min(area.w * 0.3, Math.max(...ys.map((v) => measure(v, 12)))) + 12;
  const inner = { x: area.x + yW, y: area.y, w: area.w - yW, h: area.h - 26 };
  const cw = inner.w / xs.length, ch = Math.min(inner.h / ys.length, spec.cellHeight ?? 56);
  inner.h = ch * ys.length;
  if (spec.height === undefined) frame.setHeight(inner.y + inner.h + 26 + frame.chrome);
  const showLabels = spec.labels ?? (cw >= Math.max(...all.map((v) => measure(fmt(v), 11))) + 8 && ch >= 18);

  const body = [];
  ys.forEach((b, j) => {
    body.push(text(inner.x - 10, inner.y + j * ch + ch / 2 + 4, truncate(b, yW - 12, 12), { fill: theme.lede, fontSize: 12, textAnchor: 'end' }));
    xs.forEach((a, i) => {
      const v = val(a, b);
      const fill = colorOf(v);
      const cx = inner.x + i * cw + 1, cy = inner.y + j * ch + 1;
      const parts = [el('rect', { x: cx, y: cy, width: Math.max(0, cw - 2), height: Math.max(0, ch - 2), rx: 3, fill })];
      if (showLabels && Number.isFinite(v)) parts.push(text(cx + (cw - 2) / 2, cy + (ch - 2) / 2 + 4, fmt(v), { fill: textOn(fill, theme), fontSize: 11, textAnchor: 'middle', fontWeight: 500 }));
      body.push(g({ class: 'pa-m', 'data-tip': tip(`${b} · ${a}`, Number.isFinite(v) ? fmt(v) : '—') }, parts));
    });
  });
  body.push(xLabels(xs.map((a, i) => ({ pos: inner.x + i * cw + cw / 2, label: a })), inner, theme, { y: inner.y + inner.h + 18, color: theme.lede }));

  const en = String(locale).startsWith('en');
  let best = null;
  for (const a of xs) for (const b of ys) { const v = val(a, b); if (Number.isFinite(v) && (!best || v > best[2])) best = [a, b, v]; }
  const desc = en
    ? `Heatmap of ${humanize(valueF)} by ${humanize(x)} and ${humanize(y)}.` + (best ? ` Highest: ${best[1]} · ${best[0]} (${fmt(best[2])}).` : ' No cell has a numeric value.')
    : `Mapa de calor de ${humanize(valueF).toLowerCase()} por ${humanize(x).toLowerCase()} y ${humanize(y).toLowerCase()}.` + (best ? ` Máximo: ${best[1]} · ${best[0]} (${fmt(best[2])}).` : ' Ninguna celda tiene un valor numérico.');
  return frame.finish(body, { desc, type: 'heatmap' });
}
