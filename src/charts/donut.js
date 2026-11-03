// Dona: parte-todo de un vistazo, con 6 segmentos como máximo (el resto se
// agrupa en "Otros"). Para comparar valores cercanos, usa barras.
import { el, g, text, tip } from '../svg.js';
import { measure, truncate } from '../text.js';
import { makeFormat, formatNumber } from '../format.js';
import { colorMap } from '../theme.js';
import { ensureData, requireField, num, fieldsOf, fieldKind, humanize } from '../data.js';
import { createFrame } from '../frame.js';

export function donut(spec, theme) {
  const data = ensureData(spec);
  const fields = fieldsOf(data);
  const labelF = spec.label ?? spec.x ?? fields.find((f) => fieldKind(data, f) === 'category') ?? fields[0];
  const valueF = spec.value ?? spec.y ?? fields.find((f) => f !== labelF && fieldKind(data, f) === 'number');
  requireField(data, labelF, 'label');
  requireField(data, valueF, 'value');
  const locale = spec.locale || 'es';
  const en = String(locale).startsWith('en');
  const sums = new Map();
  for (const r of data) {
    const v = num(r[valueF]);
    if (!(v > 0)) continue;
    const k = String(r[labelF]);
    sums.set(k, (sums.get(k) || 0) + v);
  }
  let slices = [...sums.entries()].map(([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v);
  const max = spec.maxSlices ?? 6;
  if (slices.length > max) {
    const rest = slices.slice(max - 1);
    slices = slices.slice(0, max - 1);
    slices.push({ k: en ? 'Other' : 'Otros', v: rest.reduce((a, b) => a + b.v, 0), other: true });
  }
  const total = slices.reduce((a, b) => a + b.v, 0);
  const fmt = makeFormat(spec.format, locale, slices.map((s) => s.v));
  const cmap = colorMap(slices.filter((s) => !s.other).map((s) => s.k), theme, spec.colors);
  const hl = spec.highlight === undefined ? null : new Set([].concat(spec.highlight).map(String));
  const colorOf = (s) => (s.other ? theme.other : hl && !hl.has(s.k) ? theme.dim : cmap.get(s.k));
  const pct = (v) => formatNumber((v / total) * 100, (v / total) * 100 < 10 ? 1 : 0, locale, true) + '%';

  const frame = createFrame(spec, theme, { height: 360 });
  const area = frame.layout([]);
  const narrow = area.w < 460;
  const D = narrow ? Math.min(area.w, area.h * 0.55) : Math.min(area.h, area.w * 0.46);
  const R = D / 2, r0 = R * (spec.thickness ? 1 - spec.thickness : 0.62);
  const cx = narrow ? area.x + area.w / 2 : area.x + R, cy = area.y + R + (narrow ? 0 : (area.h - D) / 2);

  const body = [];
  let a0 = -Math.PI / 2;
  for (const s of slices) {
    const a1 = a0 + (s.v / total) * Math.PI * 2;
    const d = arc(cx, cy, R, r0, a0, a1);
    body.push(el('path', { class: 'pa-m', d, fill: colorOf(s), stroke: theme.surface, strokeWidth: 2, strokeLinejoin: 'round', 'data-tip': tip(s.k, `${fmt(s.v)} · ${pct(s.v)}`) }));
    a0 = a1;
  }
  // Centro: el total o el segmento destacado.
  const focusSlice = hl ? slices.find((s) => hl.has(s.k)) : null;
  const big = spec.centerValue ?? (focusSlice ? pct(focusSlice.v) : fmt(total));
  const small = spec.centerLabel ?? (focusSlice ? focusSlice.k : en ? 'Total' : 'Total');
  const bigSize = Math.min(34, r0 * 0.5);
  body.push(text(cx, cy + bigSize * 0.32, big, { fill: theme.ink, fontSize: bigSize, fontWeight: 600, textAnchor: 'middle' }));
  body.push(text(cx, cy + bigSize * 0.32 + 18, truncate(small, r0 * 1.6, 12), { fill: theme.lede, fontSize: 12, textAnchor: 'middle' }));

  // Leyenda-tabla: nombre, % y valor. Identidad nunca solo por color.
  const rowH = 28;
  const lx = narrow ? area.x : area.x + D + 36;
  const lw = narrow ? area.w : area.w - D - 36;
  const ly0 = narrow ? area.y + D + 20 : area.y + (area.h - slices.length * rowH) / 2;
  if (narrow && spec.height === undefined) frame.setHeight(ly0 + slices.length * rowH + frame.chrome);
  const valW = Math.max(...slices.map((s) => measure(fmt(s.v), 12.5)));
  slices.forEach((s, i) => {
    const y = ly0 + i * rowH + rowH / 2;
    const parts = [];
    parts.push(el('rect', { x: lx, y: y - 5, width: 10, height: 10, rx: 2.5, fill: colorOf(s) }));
    parts.push(text(lx + 18, y + 4.5, truncate(s.k, lw - 18 - valW - 80, 13), { fill: theme.ink, fontSize: 13 }));
    parts.push(text(lx + lw - valW - 14, y + 4.5, pct(s.v), { fill: theme.ink, fontSize: 13, fontWeight: 600, textAnchor: 'end' }));
    parts.push(text(lx + lw, y + 4.5, fmt(s.v), { fill: theme.muted, fontSize: 12.5, textAnchor: 'end' }));
    body.push(g({ 'data-tip': tip(s.k, `${fmt(s.v)} · ${pct(s.v)}`) }, parts));
  });

  const desc = (en ? `Donut chart of ${humanize(valueF)}. ` : `Gráfico de dona de ${humanize(valueF).toLowerCase()}. `) + slices.map((s) => `${s.k} ${pct(s.v)}`).join(', ') + '.';
  return frame.finish(body, { desc, type: 'donut' });
}

function arc(cx, cy, R, r, a0, a1) {
  if (a1 - a0 >= Math.PI * 2 - 1e-6) a1 = a0 + Math.PI * 2 - 1e-4;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const p = (rad, a) => `${(cx + rad * Math.cos(a)).toFixed(2)},${(cy + rad * Math.sin(a)).toFixed(2)}`;
  return `M${p(R, a0)}A${R},${R} 0 ${large} 1 ${p(R, a1)}L${p(r, a1)}A${r},${r} 0 ${large} 0 ${p(r, a0)}Z`;
}
