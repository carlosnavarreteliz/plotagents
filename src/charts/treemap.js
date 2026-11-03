// Treemap de varios niveles (estilo Atlas de Complejidad Económica / d3plus).
// Color por grupo de primer nivel, variación sutil de luminosidad en niveles
// más profundos, encabezados de grupo cuando hay espacio y etiquetas que solo
// aparecen si caben. Drill-down: data-drill + spec.focus.
import { el, g, text, tip, esc } from '../svg.js';
import { measure, wrap } from '../text.js';
import { makeFormat } from '../format.js';
import { textOn, ramp } from '../theme.js';
import { formatNumber } from '../format.js';
import { humanize } from '../data.js';
import { createFrame } from '../frame.js';
import { ctx } from '../context.js';
import { buildHierarchy, findNode, assignColors, shareFmt, breadcrumb, height, SEP } from '../hierarchy.js';

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
  const layoutRow = (r, last) => {
    const s = r.reduce((a, b) => a + b.area, 0);
    if (rect.w >= rect.h) {
      const cw = last ? rect.w : s / rect.h;
      let cy = rect.y;
      r.forEach((n, i) => { const ch = i === r.length - 1 ? rect.y + rect.h - cy : n.area / cw; out.push({ ...n.it, x: rect.x, y: cy, w: cw, h: ch }); cy += ch; });
      rect = { x: rect.x + cw, y: rect.y, w: rect.w - cw, h: rect.h };
    } else {
      const ch = last ? rect.h : s / rect.w;
      let cx = rect.x;
      r.forEach((n, i) => { const cw = i === r.length - 1 ? rect.x + rect.w - cx : n.area / ch; out.push({ ...n.it, x: cx, y: rect.y, w: cw, h: ch }); cx += cw; });
      rect = { x: rect.x, y: rect.y + ch, w: rect.w, h: rect.h - ch };
    }
  };
  nodes.forEach((n, idx) => {
    const side = Math.min(rect.w, rect.h);
    if (!row.length || worst([...row, n], side) <= worst(row, side)) row.push(n);
    else { layoutRow(row, false); row = [n]; }
    if (idx === nodes.length - 1) layoutRow(row, true);
  });
  return out;
}

// Separación entre hermanos según la profundidad visible (1 = primer nivel).
// Separación por nivel: más aire entre categorías, menos dentro de ellas.
const GAP = (d) => (d <= 1 ? 4 : d === 2 ? 2 : 1);

export function treemap(spec, theme) {
  const locale = spec.locale || 'es';
  const en = String(locale).startsWith('en');
  const { root, fields, valueField } = buildHierarchy(spec);
  const focus = findNode(root, spec.focus);
  const levels = height(focus);
  // El color sigue a la entidad: se asigna sobre el árbol completo, así al
  // entrar a un grupo sus elementos conservan la familia de color del padre.
  const single = height(root) <= 1 && spec.colorBy !== 'label';
  assignColors(root, theme, spec, { single });
  const allValues = [];
  (function walk(n) { allValues.push(n.value); n.children.forEach(walk); })(root);
  const fmt = makeFormat(spec.format, locale, allValues);
  const share = shareFmt(locale);
  const hl = spec.highlight === undefined ? null : new Set([].concat(spec.highlight).map(String));

  // Variación vs. el periodo anterior (con `time`) o vs. `compareData`.
  const prevRows = spec.compareData ?? spec._prev?.data;
  const prevLabel = spec.compareLabel ?? spec._prev?.label;
  const prevMap = new Map();
  if (prevRows && prevRows.length) {
    const pr = buildHierarchy({ ...spec, data: prevRows, time: undefined }).root;
    (function walk(n) { prevMap.set(n.path.join('\u0000'), n.value); n.children.forEach(walk); })(pr);
  }
  const changeOf = (n) => { const pv = prevMap.get(n.path.join('\u0000')); return pv > 0 ? n.value / pv - 1 : null; };
  const showChange = prevMap.size > 0 && spec.change !== false;
  const byChange = showChange && spec.colorBy === 'change';
  const pctTxt = (c) => (c === null ? '' : `${c > 0 ? '▲' : c < 0 ? '▼' : '■'} ${formatNumber(Math.abs(c) * 100, Math.abs(c) < 0.1 ? 1 : 0, locale, true)}%`);
  let cMax = 0;
  if (byChange) (function walk(n) { if (!n.children.length) { const c = changeOf(n); if (c !== null) cMax = Math.max(cMax, Math.abs(c)); } n.children.forEach(walk); })(focus);
  cMax = spec.changeDomain ?? (Math.ceil(Math.min(1, cMax || 0.1) * 20) / 20);
  // Crecimiento en el tono frío, caída en el cálido; gris neutro sin cambio.
  const divRamp = [...theme.diverging].reverse();
  const changeColor = (c) => (c === null ? theme.tint : ramp(divRamp, 0.5 + Math.max(-1, Math.min(1, c / cMax)) / 2));

  // Leyenda del primer nivel visible, con su participación: la leyenda también informa.
  const top = focus.children;
  let legend = [];
  if (byChange && spec.legend !== false) {
    const lab = (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${formatNumber(Math.abs(v) * 100, 0, locale)}%`;
    legend = [{ type: 'ramp', stops: [...theme.diverging].reverse(), min: lab(-cMax), max: lab(cMax), title: (en ? 'Change' : 'Variación') + (prevLabel ? (en ? ' vs ' : ' vs ') + prevLabel : '') }];
  } else if (levels > 1 && top.length > 1 && spec.legend !== false && !focus.path.length) {
    const shown = top.filter((c) => !c.folded);
    const sh0 = shareFmt(locale);
    legend = shown.map((c) => ({ label: `${c.name} ${sh0(c.value, focus.value)}`, color: c.color, shape: 'square' }));
    if (top.some((c) => c.folded)) legend.push({ label: en ? 'Other' : 'Otros', color: theme.other, shape: 'square' });
  }

  // En pantallas angostas el treemap crece hacia abajo: rectángulos legibles.
  const W = spec.width || 720;
  const frame = createFrame(spec, theme, { height: W < 560 ? Math.round(Math.min(780, W * 1.15 + 170)) : Math.round(Math.max(440, Math.min(620, W * 0.62))) });
  let area = frame.layout(legend);
  const body = [];
  const bc = breadcrumb(focus, area.x, area.y, area.w, theme, locale);
  if (bc.h) { body.push(bc.svg); area = { ...area, y: area.y + bc.h, h: area.h - bc.h }; }

  const total = focus.value;
  const grand = root.value;
  const R = theme.marks?.barRadius ?? 4;

  const tipFor = (n) => {
    const parentShare = n.parent && n.parent.value ? share(n.value, n.parent.value) : '';
    const ch = showChange ? changeOf(n) : null;
    return tip(
      n.path.join(SEP),
      `${fmt(n.value)} · ${share(n.value, grand)} ${en ? 'of total' : 'del total'}`,
      n.parent && n.parent.depth > 0 ? `${parentShare} ${en ? 'of' : 'de'} ${n.parent.name}` : '',
      ch !== null ? `${pctTxt(ch)} ${prevLabel ? 'vs ' + prevLabel : ''}`.trim() : ''
    );
  };
  const dim = (n) => hl && !n.path.some((p) => hl.has(p));

  function drawLeaf(n, x, y, w, h, relDepth) {
    if (w < 0.6 || h < 0.6) return '';
    const ch = showChange ? changeOf(n) : null;
    const fill = dim(n) ? theme.dim : byChange ? changeColor(ch) : n.color;
    const rx = Math.max(0, Math.min(R - 1, w / 6, h / 6));
    const parts = [el('rect', { x, y, width: w, height: h, rx, fill })];
    const extra = [spec.showValues ? fmt(n.value) : null, ch !== null ? pctTxt(ch) : null].filter(Boolean).join(' · ');
    parts.push(...tileLabel(n.name, share(n.value, total), x, y, w, h, textOn(fill, theme), extra || null, relDepth));
    const drill = relDepth === 1 && n.children.length ? JSON.stringify(n.path) : undefined;
    return g({ class: 'pa-m', 'data-tip': tipFor(n), 'data-drill': drill, style: drill ? 'cursor:pointer' : undefined }, parts);
  }

  function drawNode(n, x, y, w, h, relDepth) {
    // Hoja visible (sin hijos o al fondo de la jerarquía mostrada).
    if (!n.children.length) return drawLeaf(n, x, y, w, h, relDepth);
    // Sin bandas de encabezado: el área de cada grupo es exactamente su valor.
    // La categoría se reconoce por su color sólido, el espacio entre grupos y la leyenda.
    const parts = [];
    const iy = y, ih = h;
    const gap = GAP(relDepth + 1);
    const rects = squarify(n.children, x, iy, w, ih);
    for (const c of rects) parts.push(drawNode(c, c.x + gap / 2, c.y + gap / 2, c.w - gap, c.h - gap, relDepth + 1));
    const drill = relDepth === 1 ? JSON.stringify(n.path) : undefined;
    return g({ class: relDepth === 1 ? 'pa-group' : undefined, 'data-tip': relDepth === 1 ? tipFor(n) : undefined, 'data-drill': drill, style: drill ? 'cursor:pointer' : undefined }, parts);
  }

  const g1 = GAP(1);
  const rects = squarify(focus.children, area.x - g1 / 2, area.y - g1 / 2, area.w + g1, area.h + g1);
  for (const r of rects) body.push(drawNode(r, r.x + g1 / 2, r.y + g1 / 2, r.w - g1, r.h - g1, 1));

  const leaves = [];
  (function walk(n) { if (!n.children.length) leaves.push(n); n.children.forEach(walk); })(focus);
  const top3 = leaves.sort((a, b) => b.value - a.value).slice(0, 3).map((l) => `${l.name} ${share(l.value, total)}`).join(', ');
  const what = humanize(valueField);
  const where = focus.path.length ? ` (${focus.path.join(SEP)})` : '';
  const desc = en
    ? `Treemap of ${what}${where} across ${fields.length} level${fields.length > 1 ? 's' : ''}, total ${fmt(total)}. Largest: ${top3}.`
    : `Treemap de ${what.toLowerCase()}${where} en ${fields.length} nivel${fields.length > 1 ? 'es' : ''}, total ${fmt(total)}. Mayores: ${top3}.`;
  return frame.finish(body, { desc, type: 'treemap' });
}

/** Etiqueta dentro del rectángulo solo si cabe; tamaño según el área. */
function tileLabel(name, pct, x, y, w, h, fill, value, depth) {
  const out = [];
  const pad = w < 60 || h < 40 ? 5 : 8;
  const maxSize = depth <= 1 ? 24 : depth === 2 ? 18 : 15;
  for (let size = Math.min(maxSize, Math.max(10, Math.sqrt(w * h) / 8.5)); size >= 9.5; size -= 1) {
    const lines = wrap(name, w - pad * 2, size, 600, 3);
    const X = ctx.textScale;
    const lh = size * X * 1.14;
    const pctSize = Math.max(9.5, size * 0.78);
    const sub = value ? `${pct} · ${value}` : pct;
    const need = pad + lines.length * lh + 3 + pctSize * X + pad * 0.5;
    const widest = Math.max(...lines.map((l) => measure(l, size, 600)), measure(sub, pctSize));
    const fitsW = lines.every((l) => measure(l, size, 600) <= w - pad * 2) && !/…$/.test(lines[lines.length - 1]);
    if (fitsW && widest <= w - pad * 2 && need <= h) {
      lines.forEach((l, i) => out.push(text(x + pad, y + pad + size * X * 0.88 + i * lh, l, { fill, fontSize: size, fontWeight: 600 })));
      out.push(text(x + pad, y + pad + size * X * 0.88 + (lines.length - 1) * lh + pctSize * X + 4, sub, { fill, fontSize: pctSize, opacity: 0.86 }));
      return out;
    }
    if (lines.length === 1 && fitsW && pad + lh <= h) {
      out.push(text(x + pad, y + pad + size * X * 0.88, lines[0], { fill, fontSize: size, fontWeight: 600 }));
      return out;
    }
  }
  return out;
}
