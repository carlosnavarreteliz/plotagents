// Ejes recesivos: líneas finas (1px), sólidas, un tono fuera del fondo.
import { el, g, text } from './svg.js';
import { measure } from './text.js';
import { SIZES } from './frame.js';

/** Líneas de grilla horizontales con etiquetas a la izquierda. */
export function gridY(ticks, y, area, theme, fmt, { labels = true, baseline = 0 } = {}) {
  const out = [];
  for (const t of ticks) {
    const py = Math.round(y(t)) + 0.5;
    const isBase = t === baseline;
    out.push(el('line', { x1: area.x, x2: area.x + area.w, y1: py, y2: py, stroke: isBase ? theme.axis : theme.grid, strokeWidth: 1, shapeRendering: 'crispEdges' }));
    if (labels) out.push(text(area.x - 8, py + 4, fmt(t), { fill: theme.muted, fontSize: SIZES.axis, textAnchor: 'end' }));
  }
  return g({ class: 'pa-axis pa-axis-y' }, out);
}

/** Líneas de grilla verticales con etiquetas abajo. */
export function gridX(ticks, x, area, theme, fmt, { labels = true, baseline = 0, lines = true } = {}) {
  const out = [];
  const items = ticks.map((t) => ({ pos: Math.round(x(t)) + 0.5, label: fmt(t), t }));
  for (const it of items) {
    if (lines) out.push(el('line', { x1: it.pos, x2: it.pos, y1: area.y, y2: area.y + area.h, stroke: it.t === baseline ? theme.axis : theme.grid, strokeWidth: 1, shapeRendering: 'crispEdges' }));
  }
  if (labels) out.push(xLabels(items, area, theme));
  return g({ class: 'pa-axis pa-axis-x' }, out);
}

/** Etiquetas bajo el eje x, raleadas si chocan (nunca rotadas). */
export function xLabels(items, area, theme, { y, size = SIZES.axis, color } = {}) {
  const ly = y ?? area.y + area.h + 18;
  const widths = items.map((it) => measure(it.label, size));
  let every = 1;
  const fits = (k) => {
    let last = -Infinity;
    for (let i = 0; i < items.length; i += k) {
      const left = items[i].pos - widths[i] / 2;
      if (left < last + 10) return false;
      last = items[i].pos + widths[i] / 2;
    }
    return true;
  };
  while (every < items.length && !fits(every)) every++;
  const out = [];
  items.forEach((it, i) => {
    if (i % every) return;
    let anchor = 'middle';
    let px = it.pos;
    const half = widths[i] / 2;
    if (px - half < area.x - 20) { anchor = 'start'; px = Math.max(px - 4, area.x - 20); }
    if (px + half > area.x + area.w + 20) { anchor = 'end'; px = Math.min(px + 4, area.x + area.w + 20); }
    out.push(text(px, ly, it.label, { fill: color || theme.muted, fontSize: size, textAnchor: anchor }));
  });
  return g({}, out);
}

export const ticksWidth = (ticks, fmt, size = SIZES.axis) => Math.max(0, ...ticks.map((t) => measure(fmt(t), size)));

/** Líneas de referencia: metas, promedios, umbrales. Sólidas, nunca punteadas. */
export function refLinesY(refs = [], y, area, theme, fmt) {
  const out = [];
  for (const r of refs) {
    if (r.y === undefined) continue;
    const py = Math.round(y(r.y)) + 0.5;
    if (py < area.y - 1 || py > area.y + area.h + 1) continue;
    out.push(el('line', { x1: area.x, x2: area.x + area.w, y1: py, y2: py, stroke: r.color || theme.ink, strokeWidth: 1.25, opacity: 0.7 }));
    const lab = r.label ? `${r.label} · ${fmt(r.y)}` : fmt(r.y);
    const w = measure(lab, 11.5, 500);
    out.push(el('rect', { x: area.x + area.w - w - 8, y: py - 17, width: w + 8, height: 15, rx: 3, fill: theme.surface, opacity: 0.9 }));
    out.push(text(area.x + area.w - 4, py - 6, lab, { fill: theme.ink, fontSize: 11.5, fontWeight: 500, textAnchor: 'end' }));
  }
  return g({ class: 'pa-refs' }, out);
}

export function refLinesX(refs = [], x, area, theme, fmt) {
  const out = [];
  for (const r of refs) {
    if (r.x === undefined || r.y !== undefined) continue;
    const px = Math.round(x(r.x)) + 0.5;
    out.push(el('line', { x1: px, x2: px, y1: area.y, y2: area.y + area.h, stroke: r.color || theme.ink, strokeWidth: 1.25, opacity: 0.7 }));
    const lab = r.label ? `${r.label} · ${fmt(r.x)}` : fmt(r.x);
    out.push(text(px + 5, area.y + 11, lab, { fill: theme.ink, fontSize: 11.5, fontWeight: 500 }));
  }
  return g({ class: 'pa-refs' }, out);
}
