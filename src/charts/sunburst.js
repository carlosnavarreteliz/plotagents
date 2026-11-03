// Sunburst: la misma jerarquía que el treemap, en anillos concéntricos. El
// anillo interior es el primer nivel (color por categoría); los exteriores
// heredan el color con pasos sutiles de luminosidad. Total al centro.
import { el, g, text, tip } from '../svg.js';
import { measure } from '../text.js';
import { makeFormat } from '../format.js';
import { textOn } from '../theme.js';
import { humanize } from '../data.js';
import { createFrame } from '../frame.js';
import { buildHierarchy, findNode, assignColors, shareFmt, breadcrumb, height, SEP } from '../hierarchy.js';

const TAU = Math.PI * 2;
const f = (n) => n.toFixed(2);

function arcPath(cx, cy, r0, r1, a0, a1) {
  if (a1 - a0 >= TAU - 1e-6) a1 = a0 + TAU - 1e-4;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const p = (r, a) => `${f(cx + r * Math.cos(a))},${f(cy + r * Math.sin(a))}`;
  if (r0 <= 0.01) return `M${f(cx)},${f(cy)}L${p(r1, a0)}A${f(r1)},${f(r1)} 0 ${large} 1 ${p(r1, a1)}Z`;
  return `M${p(r1, a0)}A${f(r1)},${f(r1)} 0 ${large} 1 ${p(r1, a1)}L${p(r0, a1)}A${f(r0)},${f(r0)} 0 ${large} 0 ${p(r0, a0)}Z`;
}

export function sunburst(spec, theme) {
  const locale = spec.locale || 'es';
  const en = String(locale).startsWith('en');
  const { root, fields, valueField } = buildHierarchy(spec);
  const focus = findNode(root, spec.focus);
  const levels = Math.max(1, height(focus));
  assignColors(root, theme, spec); // colores estables al navegar
  const vals = [];
  (function walk(n) { vals.push(n.value); n.children.forEach(walk); })(root);
  const fmt = makeFormat(spec.format, locale, vals);
  const share = shareFmt(locale);
  const hl = spec.highlight === undefined ? null : new Set([].concat(spec.highlight).map(String));
  const dim = (n) => hl && !n.path.some((p) => hl.has(p));

  const top = focus.children;
  const legend = top.length > 1 && spec.legend !== false && !focus.path.length
    ? [...top.filter((c) => !c.folded).map((c) => ({ label: c.name, color: c.color, shape: 'square' })), ...(top.some((c) => c.folded) ? [{ label: en ? 'Other' : 'Otros', color: theme.other, shape: 'square' }] : [])]
    : [];

  const frame = createFrame(spec, theme);
  let area = frame.layout(legend);
  const body = [];
  const bc = breadcrumb(focus, area.x, area.y, area.w, theme, locale);
  if (bc.h) { body.push(bc.svg); area = { ...area, y: area.y + bc.h, h: area.h - bc.h }; }

  const R = Math.max(40, Math.min(area.w, area.h) / 2 - 2);
  const cx = area.x + area.w / 2, cy = area.y + area.h / 2;
  const r0 = R * (spec.hole ?? 0.3);
  // Anillos: el exterior más delgado cuando hay muchos niveles.
  const weights = Array.from({ length: levels }, (_, i) => (levels >= 3 && i === levels - 1 ? 0.62 : 1));
  const wsum = weights.reduce((a, b) => a + b, 0);
  const radii = [r0];
  weights.forEach((w) => radii.push(radii[radii.length - 1] + ((R - r0) * w) / wsum));

  const total = focus.value, grand = root.value;
  const sep = theme.marks?.gap ?? 2;
  const arcs = [];
  const labels = [];
  (function layout(n, a0, a1, d) {
    let a = a0;
    for (const c of n.children) {
      const span = ((a1 - a0) * c.value) / (n.value || 1);
      if (d < levels) {
        arcs.push({ n: c, a0: a, a1: a + span, r0: radii[d], r1: radii[d + 1], d: d + 1 });
        layout(c, a, a + span, d + 1);
      }
      a += span;
    }
  })(focus, -Math.PI / 2, (3 * Math.PI) / 2, 0);

  for (const a of arcs) {
    const n = a.n;
    const fill = dim(n) ? theme.dim : n.color;
    const parent = n.parent && n.parent.depth > 0 ? n.parent : null;
    const t = tip(n.path.join(SEP), `${fmt(n.value)} · ${share(n.value, grand)} ${en ? 'of total' : 'del total'}`, parent ? `${share(n.value, parent.value)} ${en ? 'of' : 'de'} ${parent.name}` : '');
    const drill = n.children.length ? JSON.stringify(n.path) : undefined;
    body.push(el('path', {
      class: 'pa-m', d: arcPath(cx, cy, a.r0, a.r1, a.a0, a.a1), fill,
      stroke: theme.surface, strokeWidth: Math.min(sep, 1.75), strokeLinejoin: 'round',
      'data-tip': t, 'data-drill': drill, style: drill ? 'cursor:pointer' : undefined,
    }));
    // Etiqueta: tangencial si cabe a lo largo del arco; si no, radial; si no, nada.
    const mid = (a.a0 + a.a1) / 2;
    const rm = (a.r0 + a.r1) / 2;
    const thick = a.r1 - a.r0;
    const ink = textOn(fill, theme);
    for (const size of [12, 11, 10]) {
      const w = measure(n.name, size, 600);
      const deg = (mid * 180) / Math.PI;
      const half = (a.a1 - a.a0) / 2;
      // Tangencial: texto recto sobre un arco. Se busca un radio donde el
      // borde interior no cruce r0 y las puntas no salgan por r1.
      const rt = a.r0 + 2 + size / 2;
      const reach = Math.sqrt((rt + size / 2) ** 2 + (w / 2 + 3) ** 2);
      const angOk = half < Math.PI / 2 && w / 2 + 4 <= (rt - size / 2) * Math.tan(half);
      if (reach <= a.r1 - 2 && angOk) {
        const lo = rt, hi = Math.sqrt(Math.max(0, (a.r1 - 2) ** 2 - (w / 2 + 3) ** 2)) - size / 2;
        const rr = Math.max(lo, Math.min(hi, (lo + hi) / 2));
        let rot = deg + 90;
        if (Math.sin(mid) > 0) rot -= 180;
        labels.push(text(0, 0, n.name, { transform: `translate(${f(cx + rr * Math.cos(mid))},${f(cy + rr * Math.sin(mid))}) rotate(${f(rot)})`, textAnchor: 'middle', dy: size * 0.35, fill: ink, fontSize: size, fontWeight: 600, pointerEvents: 'none' }));
        break;
      }
      // Radial: a lo largo del radio, si el anillo es largo y el arco ancho.
      if (w + 10 <= thick && 2 * a.r0 * Math.sin(Math.min(half, Math.PI / 2)) >= size + 3) {
        let rot = deg;
        if (Math.cos(mid) < 0) rot += 180;
        labels.push(text(0, 0, n.name, { transform: `translate(${f(cx + rm * Math.cos(mid))},${f(cy + rm * Math.sin(mid))}) rotate(${f(rot)})`, textAnchor: 'middle', dy: size * 0.35, fill: ink, fontSize: size, fontWeight: 600, pointerEvents: 'none' }));
        break;
      }
    }
  }
  body.push(g({ class: 'pa-labels' }, labels));

  // Centro: total (o el nodo en foco). Clic en el centro sube un nivel.
  const big = spec.centerValue ?? fmt(total);
  let bigSize = Math.min(30, r0 * 0.46);
  while (bigSize > 12 && measure(big, bigSize, 600) > r0 * 1.7) bigSize -= 1;
  const small = spec.centerLabel ?? (focus.path.length ? focus.name : en ? 'Total' : 'Total');
  const up = focus.path.length ? JSON.stringify(focus.path.slice(0, -1)) : undefined;
  body.push(g({ class: 'pa-center', 'data-drill': up, style: up ? 'cursor:pointer' : undefined }, [
    el('circle', { cx, cy, r: Math.max(0, r0 - 2), fill: theme.surface }),
    text(cx, cy + bigSize * 0.3, big, { fill: theme.ink, fontSize: bigSize, fontWeight: 600, textAnchor: 'middle' }),
    measure(small, 11.5) <= r0 * 1.7 ? text(cx, cy + bigSize * 0.3 + 16, small, { fill: theme.lede, fontSize: 11.5, textAnchor: 'middle' }) : '',
  ]));

  const top3 = top.slice(0, 3).map((c) => `${c.name} ${share(c.value, total)}`).join(', ');
  const what = humanize(valueField);
  const desc = en
    ? `Sunburst of ${what} in ${fields.length} levels, total ${fmt(total)}. Largest groups: ${top3}.`
    : `Sunburst de ${what.toLowerCase()} en ${fields.length} niveles, total ${fmt(total)}. Mayores grupos: ${top3}.`;
  return frame.finish(body, { desc, type: 'sunburst' });
}
