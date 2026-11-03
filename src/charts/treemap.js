// Treemap: partes de un todo con jerarquía (estilo Atlas de Complejidad
// Económica). Color por grupo; cada rectángulo con nombre y participación.
import { el, g, text, tip } from '../svg.js';
import { measure, wrap } from '../text.js';
import { makeFormat, formatNumber } from '../format.js';
import { textOn } from '../theme.js';
import { ensureData, requireField, num, fieldsOf, fieldKind, humanize } from '../data.js';
import { createFrame } from '../frame.js';

/** Algoritmo squarified (Bruls, Huizing & van Wijk, 2000). */
export function squarify(items, x, y, w, h) {
  const out = [];
  const total = items.reduce((a, b) => a + b.value, 0);
  if (total <= 0 || w <= 0 || h <= 0) return out;
  const scale = (w * h) / total;
  const nodes = items.map((it) => ({ it, area: it.value * scale })).filter((n) => n.area > 0);
  let rect = { x, y, w, h };
  let row = [];
  const worst = (r, side) => {
    const s = r.reduce((a, b) => a + b.area, 0);
    const mx = Math.max(...r.map((n) => n.area)), mn = Math.min(...r.map((n) => n.area));
    return Math.max((side * side * mx) / (s * s), (s * s) / (side * side * mn));
  };
  const layoutRow = (r) => {
    const s = r.reduce((a, b) => a + b.area, 0);
    if (rect.w >= rect.h) {
      const cw = s / rect.h;
      let cy = rect.y;
      for (const n of r) { const ch = n.area / cw; out.push({ ...n.it, x: rect.x, y: cy, w: cw, h: ch }); cy += ch; }
      rect = { x: rect.x + cw, y: rect.y, w: rect.w - cw, h: rect.h };
    } else {
      const ch = s / rect.w;
      let cx = rect.x;
      for (const n of r) { const cw = n.area / ch; out.push({ ...n.it, x: cx, y: rect.y, w: cw, h: ch }); cx += cw; }
      rect = { x: rect.x, y: rect.y + ch, w: rect.w, h: rect.h - ch };
    }
  };
  for (const n of nodes) {
    const side = Math.min(rect.w, rect.h);
    if (!row.length || worst([...row, n], side) <= worst(row, side)) row.push(n);
    else { layoutRow(row); row = [n]; }
  }
  if (row.length) layoutRow(row);
  return out;
}

export function treemap(spec, theme) {
  const data = ensureData(spec);
  const fields = fieldsOf(data);
  const cats = fields.filter((f) => fieldKind(data, f) === 'category');
  let path = spec.path ? [].concat(spec.path) : null;
  if (!path) path = spec.group ? [spec.group, spec.label ?? spec.x ?? cats.find((f) => f !== spec.group)] : [spec.label ?? spec.x ?? cats[0]];
  path = path.filter(Boolean).slice(0, 2);
  const valueF = spec.value ?? spec.y ?? fields.find((f) => fieldKind(data, f) === 'number');
  path.forEach((p, i) => requireField(data, p, i === 0 && path.length > 1 ? 'group' : 'label'));
  requireField(data, valueF, 'value');
  const locale = spec.locale || 'es';
  const en = String(locale).startsWith('en');
  const fmt = makeFormat(spec.format, locale, data.map((r) => num(r[valueF])));
  const two = path.length === 2;

  // Jerarquía
  const groups = new Map();
  for (const r of data) {
    const v = num(r[valueF]);
    if (!(v > 0)) continue;
    const gk = two ? String(r[path[0]]) : '';
    const lk = String(r[path[two ? 1 : 0]]);
    if (!groups.has(gk)) groups.set(gk, new Map());
    const m = groups.get(gk);
    m.set(lk, (m.get(lk) || 0) + v);
  }
  const total = [...groups.values()].reduce((a, m) => a + [...m.values()].reduce((x, y) => x + y, 0), 0);
  let glist = [...groups.entries()].map(([k, m]) => ({ key: k, value: [...m.values()].reduce((a, b) => a + b, 0), leaves: [...m.entries()].map(([lk, v]) => ({ key: lk, value: v, group: k })).sort((a, b) => b.value - a.value) }));
  glist.sort((a, b) => b.value - a.value);

  // Color por grupo en orden fijo (por tamaño). Más de 8 → "Otros" en gris.
  const colorOfGroup = new Map();
  glist.forEach((gr, i) => colorOfGroup.set(gr.key, (spec.colors && spec.colors[gr.key]) || (two ? (i < theme.categorical.length - (glist.length > theme.categorical.length ? 1 : 0) ? theme.categorical[i] : theme.other) : theme.categorical[0])));
  const legend = two ? glist.slice(0, 8).map((gr) => ({ label: gr.key, color: colorOfGroup.get(gr.key), shape: 'square' })) : [];
  if (two && glist.length > 8) legend[7] = { label: en ? 'Other' : 'Otros', color: theme.other, shape: 'square' };

  const frame = createFrame(spec, theme, { height: 460 });
  const area = frame.layout(legend);
  const share = (v) => formatNumber((v / total) * 100, (v / total) * 100 < 1 ? 1 : (v / total) * 100 < 10 ? 1 : 0, locale, true) + '%';

  const body = [];
  const GAP = 2;
  const gRects = squarify(glist, area.x, area.y, area.w, area.h);
  for (const gr of gRects) {
    const color = colorOfGroup.get(gr.key);
    const leaves = squarify(gr.leaves, gr.x, gr.y, gr.w, gr.h);
    const fg = textOn(color, theme);
    for (const lf of leaves) {
      const x = lf.x + GAP / 2, y = lf.y + GAP / 2, w = lf.w - GAP, h = lf.h - GAP;
      if (w <= 0.5 || h <= 0.5) continue;
      const parts = [el('rect', { x, y, width: w, height: h, rx: Math.min(3, w / 4, h / 4), fill: color })];
      parts.push(...tileLabel(lf.key, share(lf.value), x, y, w, h, fg, spec.showValues ? fmt(lf.value) : null));
      body.push(g({ class: 'pa-m', 'data-tip': tip(lf.key, two ? gr.key : '', `${fmt(lf.value)} · ${share(lf.value)}`) }, parts));
    }
  }
  const top3 = glist.flatMap((gr) => gr.leaves).sort((a, b) => b.value - a.value).slice(0, 3).map((l) => `${l.key} ${share(l.value)}`).join(', ');
  const desc = en ? `Treemap of ${humanize(valueF)}, total ${fmt(total)}. Largest: ${top3}.` : `Treemap de ${humanize(valueF).toLowerCase()}, total ${fmt(total)}. Mayores: ${top3}.`;
  return frame.finish(body, { desc, type: 'treemap' });
}

/** Etiqueta dentro del rectángulo solo si cabe; tamaño según el área. */
function tileLabel(name, pct, x, y, w, h, fill, value) {
  const out = [];
  const pad = 8;
  for (let size = Math.min(22, Math.max(11, Math.sqrt(w * h) / 9)); size >= 10.5; size -= 1.5) {
    const lines = wrap(name, w - pad * 2, size, 600, 3);
    const lh = size * 1.15;
    const pctSize = Math.max(10.5, size * 0.78);
    const need = pad + lines.length * lh + 4 + pctSize + pad * 0.6;
    const widest = Math.max(...lines.map((l) => measure(l, size, 600)), measure(pct, pctSize));
    if (widest <= w - pad * 2 && need <= h) {
      lines.forEach((l, i) => out.push(text(x + pad, y + pad + size * 0.9 + i * lh, l, { fill, fontSize: size, fontWeight: 600 })));
      const py = y + pad + size * 0.9 + (lines.length - 1) * lh + pctSize + 5;
      out.push(text(x + pad, py, value ? `${pct} · ${value}` : pct, { fill, fontSize: pctSize, opacity: 0.85 }));
      return out;
    }
    if (lines.length === 1 && measure(lines[0], size, 600) <= w - pad * 2 && pad + lh <= h) {
      out.push(text(x + pad, y + pad + size * 0.9, lines[0], { fill, fontSize: size, fontWeight: 600 }));
      return out;
    }
  }
  return out;
}
