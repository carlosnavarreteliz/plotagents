// Diagrama de cuerdas: flujos entre grupos alrededor de un círculo. El largo
// de cada arco es el total del grupo; cada cinta une dos grupos y su ancho es
// el flujo. Útil para migraciones, comercio entre bloques o transferencias.
import { el, g, text, tip, esc } from '../svg.js';
import { measure, truncate, wrap } from '../text.js';
import { makeFormat, formatNumber } from '../format.js';
import { colorMap, readable } from '../theme.js';
import { ensureData, requireField, num, fieldsOf, fieldKind, PlotError } from '../data.js';
import { createFrame } from '../frame.js';

const pick = (fields, cands) => cands.find((c) => fields.includes(c));
const TAU = Math.PI * 2;

/** Matriz de flujos m[i][j] (de i hacia j) y nombres. */
export function prepareChord(spec) {
  if (Array.isArray(spec.matrix)) {
    const names = (spec.names || spec.matrix.map((_, i) => String(i + 1))).map(String);
    if (spec.matrix.length !== names.length) throw new PlotError('`matrix` y `names` deben tener el mismo largo.', 'matrix: [[0, 5], [3, 0]], names: ["A", "B"]');
    return { names, m: spec.matrix.map((row) => names.map((_, j) => { const v = num(row[j]); return Number.isFinite(v) && v > 0 ? v : 0; })) };
  }
  const data = ensureData(spec);
  const fields = fieldsOf(data);
  const from = spec.from ?? pick(fields, ['from', 'source', 'origen', 'desde']) ?? fields[0];
  const to = spec.to ?? pick(fields, ['to', 'target', 'destino', 'hasta']) ?? fields[1];
  requireField(data, from, 'from');
  requireField(data, to, 'to');
  const vf = spec.value ?? pick(fields, ['value', 'valor', 'weight', 'flujo']) ?? fields.find((f) => f !== from && f !== to && fieldKind(data, f) === 'number');
  if (vf) requireField(data, vf, 'value');
  const names = [];
  const idx = new Map();
  const at = (k) => { if (!idx.has(k)) { idx.set(k, names.length); names.push(k); } return idx.get(k); };
  const flows = [];
  for (const r of data) {
    if (r[from] === null || r[from] === undefined || r[to] === null || r[to] === undefined) continue;
    const v = vf ? num(r[vf]) : 1;
    if (!(v > 0) || !Number.isFinite(v)) continue;
    flows.push([at(String(r[from])), at(String(r[to])), v]);
  }
  const m = names.map(() => names.map(() => 0));
  for (const [i, j, v] of flows) m[i][j] += v;
  return { names, m };
}

export function chord(spec, theme) {
  const locale = spec.locale || 'es';
  const en = String(locale).startsWith('en');
  const { names, m } = prepareChord(spec);
  const n = names.length;
  if (n < 2) throw new PlotError('El diagrama de cuerdas necesita al menos dos grupos.', 'Entrega filas { from, to, value } entre grupos distintos.');
  const directed = spec.directed === true;

  // Segmentos de cada grupo: lo que sale y (si es dirigido) lo que entra.
  // No dirigido: la cinta i–j mide m[i][j] + m[j][i] en ambos extremos.
  const seg = names.map(() => []);
  const ribbons = [];
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      if (directed) {
        if (m[i][j] > 0) { const rb = { i, j, v: m[i][j] }; ribbons.push(rb); seg[i].push({ rb, end: 's', partner: j, v: m[i][j] }); seg[j].push({ rb, end: 't', partner: i, v: m[i][j] }); }
      } else if (i < j) {
        const v = m[i][j] + m[j][i];
        if (v > 0) { const rb = { i, j, v, ij: m[i][j], ji: m[j][i] }; ribbons.push(rb); seg[i].push({ rb, end: 's', partner: j, v }); seg[j].push({ rb, end: 't', partner: i, v }); }
      }
    }
  const totals = seg.map((s) => s.reduce((a, b) => a + b.v, 0));
  const out = m.map((row, i) => row.reduce((a, v, j) => a + (j === i ? 0 : v), 0));
  const inn = names.map((_, j) => m.reduce((a, row, i) => a + (i === j ? 0 : row[j]), 0));
  let order = names.map((_, i) => i).filter((i) => totals[i] > 0);
  if (spec.sort !== 'none') order.sort((a, b) => totals[b] - totals[a]);
  const T = order.reduce((a, i) => a + totals[i], 0);
  if (!(T > 0)) throw new PlotError('No hay flujos positivos entre grupos distintos.', 'Revisa el campo de valor.');

  // Colores en orden de tamaño (estables por entidad); el resto, "otros".
  const sizeOrder = [...order].sort((a, b) => totals[b] - totals[a]);
  const cmap = colorMap(sizeOrder.map((i) => names[i]), theme, spec.colors);
  const colorOf = (i) => cmap.get(names[i]);
  const fmt = makeFormat(spec.format, locale, ribbons.map((r) => r.v).concat(totals));
  const pct = (a, b) => (b > 0 ? formatNumber((a / b) * 100, a / b < 0.1 ? 1 : 0, locale, true) + '%' : '');

  const legend = spec.legend === true || (spec.legend && typeof spec.legend !== 'boolean') ? sizeOrder.map((i) => ({ label: names[i], color: colorOf(i) })) : [];
  const W = spec.width || 720;
  const frame = createFrame(spec, theme, { height: W < 560 ? Math.round(W * 1.02 + 150) : 600 });
  const area = frame.layout(legend);

  // Ángulos: arcos proporcionales al total, con separación.
  const pad = Math.min(0.04, (TAU * 0.18) / order.length);
  const k = (TAU - pad * order.length) / T;
  let a = -Math.PI / 2 + pad / 2;
  const arc = new Map();
  for (const i of order) {
    const a0 = a, a1 = a + totals[i] * k;
    arc.set(i, { a0, a1, mid: (a0 + a1) / 2 });
    a = a1 + pad;
  }
  // Dentro de cada arco, los socios se ordenan para que las cintas no se crucen.
  const pos = new Map(order.map((i, p) => [i, p]));
  for (const i of order) {
    const { a0 } = arc.get(i);
    const p = pos.get(i);
    const list = seg[i].filter((s) => pos.has(s.partner)).sort((x, y) => {
      const dx = (pos.get(x.partner) - p + order.length) % order.length;
      const dy = (pos.get(y.partner) - p + order.length) % order.length;
      return dy - dx || (x.end === 's' ? -1 : 1);
    });
    let c = a0;
    for (const s of list) { s.a0 = c; s.a1 = c + s.v * k; c = s.a1; s.rb[s.end] = s; }
  }

  // Etiquetas: horizontales si son pocas; radiales si son muchas.
  const narrow = area.w < 480;
  const labelSize = (theme.type?.label ?? 12) + (narrow ? -1 : 0.5);
  const radial = spec.labelOrientation ? spec.labelOrientation === 'radial' : order.length > 10;
  const valueOf = (i) => fmt(totals[i]);
  const thick = Math.max(8, Math.min(14, Math.min(area.w, area.h) * 0.03));
  const gapL = 10;
  const radiusFor = (lw) => radial
    ? Math.min(area.w, area.h) / 2 - thick - gapL - lw - 4
    : Math.min(area.w / 2 - (lw + thick + gapL + 6), area.h / 2 - thick - gapL - labelSize * 2.6);
  // Nombres completos si el círculo conserva un buen tamaño; si no, se acortan.
  const full = Math.max(...order.map((i) => Math.max(measure(names[i], labelSize, 600), radial ? 0 : measure(valueOf(i), labelSize - 1.5))));
  const minR = Math.min(area.w, area.h) * (narrow ? 0.22 : 0.3);
  let maxLabel = full;
  if (radiusFor(full) < minR) {
    maxLabel = Math.max(48, radial ? Math.min(area.w, area.h) / 2 - thick - gapL - 4 - minR : area.w / 2 - thick - gapL - 6 - minR);
  }
  // Horizontales: si no caben en una línea, se parten en dos (no se cortan).
  const linesOf = (i) => (radial ? [truncate(names[i], maxLabel, labelSize, 600)] : wrap(names[i], maxLabel, labelSize, 600, 2));
  const labelOf = (i) => linesOf(i).join(' ');
  const lw = Math.max(...order.map((i) => Math.max(...linesOf(i).map((l) => measure(l, labelSize, 600)), radial ? 0 : measure(valueOf(i), labelSize - 1.5))));
  let R = Math.max(60, radiusFor(lw));
  const cx = area.x + area.w / 2, cy = area.y + area.h / 2;
  const r0 = R, r1 = R + thick;
  const P = (ang, r) => [cx + Math.cos(ang) * r, cy + Math.sin(ang) * r];
  const f = (v) => v.toFixed(2);

  // Un `highlight` que no existe entre los grupos se ignora (si no, todo quedaría atenuado).
  const hlNames = spec.highlight === undefined || spec.highlight === null ? [] : [].concat(spec.highlight).map(String).filter((k) => names.includes(k));
  const hl = hlNames.length ? new Set(hlNames) : null;
  const isOn = (rb) => !hl || hl.has(names[rb.i]) || hl.has(names[rb.j]);

  // Cintas: de un arco al otro, curvas por el centro.
  const ribbonG = [];
  const rr = r0 - 1;
  for (const rb of [...ribbons].sort((x, y) => (isOn(x) - isOn(y)) || y.v - x.v)) {
    const s = rb.s, t = rb.t;
    if (!s || !t) continue;
    const [sx0, sy0] = P(s.a0, rr), [sx1, sy1] = P(s.a1, rr), [tx0, ty0] = P(t.a0, rr), [tx1, ty1] = P(t.a1, rr);
    const lg = (x, y) => (y - x > Math.PI ? 1 : 0);
    const d = `M${f(sx0)},${f(sy0)}A${f(rr)},${f(rr)} 0 ${lg(s.a0, s.a1)} 1 ${f(sx1)},${f(sy1)}Q${f(cx)},${f(cy)} ${f(tx0)},${f(ty0)}A${f(rr)},${f(rr)} 0 ${lg(t.a0, t.a1)} 1 ${f(tx1)},${f(ty1)}Q${f(cx)},${f(cy)} ${f(sx0)},${f(sy0)}Z`;
    // Color: dirigido → el origen. No dirigido → por defecto el grupo menor
    // del par (así cada zona muestra su color en su cinta con el centro);
    // ribbonColor: 'larger' usa el lado que más envía.
    const mode = spec.ribbonColor ?? (directed ? 'source' : 'smaller');
    const src = mode === 'source' ? rb.i
      : mode === 'larger' ? (rb.ij >= rb.ji ? rb.i : rb.j)
      : totals[rb.i] <= totals[rb.j] ? rb.i : rb.j;
    const A = names[rb.i], B = names[rb.j];
    const lines = directed
      ? [`${A} → ${B}`, `${fmt(rb.v)} · ${pct(rb.v, out[rb.i])} ${en ? 'of what' : 'de lo que'} ${A} ${en ? 'sends' : 'envía'}`]
      : [`${A} ↔ ${B}`, `${A} → ${B}: ${fmt(rb.ij)}`, `${B} → ${A}: ${fmt(rb.ji)}`, `${en ? 'Total' : 'Total'}: ${fmt(rb.v)} · ${pct(rb.v, totals[rb.i])} ${en ? 'of' : 'de'} ${A}`];
    ribbonG.push(el('path', {
      class: 'pa-m', d, fill: colorOf(src), fillOpacity: isOn(rb) ? (hl ? 0.75 : 0.62) : 0.1,
      stroke: theme.surface, strokeWidth: 0.75, strokeOpacity: 0.9, 'data-tip': tip(...lines),
    }));
  }

  // Arcos de cada grupo.
  const arcG = [];
  for (const i of order) {
    const { a0, a1 } = arc.get(i);
    const [x0, y0] = P(a0, r0 + 1.5), [x1, y1] = P(a1, r0 + 1.5), [x2, y2] = P(a1, r1), [x3, y3] = P(a0, r1);
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const d = `M${f(x0)},${f(y0)}A${f(r0 + 1.5)},${f(r0 + 1.5)} 0 ${large} 1 ${f(x1)},${f(y1)}L${f(x2)},${f(y2)}A${f(r1)},${f(r1)} 0 ${large} 0 ${f(x3)},${f(y3)}Z`;
    const dim = hl && !hl.has(names[i]);
    const lines = directed
      ? [names[i], `${en ? 'Out' : 'Sale'}: ${fmt(out[i])}`, `${en ? 'In' : 'Entra'}: ${fmt(inn[i])}`]
      : [names[i], `${en ? 'Total flows' : 'Flujos totales'}: ${fmt(totals[i])}`, `${pct(totals[i], T)} ${en ? 'of all' : 'del total'}`];
    arcG.push(el('path', { class: 'pa-m', d, fill: dim ? theme.dim : colorOf(i), stroke: theme.surface, strokeWidth: 1, 'data-tip': tip(...lines) }));
  }

  // Etiquetas.
  const labG = [];
  const halo = { stroke: theme.surface, strokeWidth: 3, paintOrder: 'stroke', strokeLinejoin: 'round' };
  for (const i of order) {
    const { mid, a0, a1 } = arc.get(i);
    if ((a1 - a0) * r1 < 6 && order.length > 6) continue; // arco demasiado chico
    const dim = hl && !hl.has(names[i]);
    const fill = dim ? theme.muted : readable(colorOf(i), theme);
    const ca = Math.cos(mid), sa = Math.sin(mid);
    if (radial) {
      const [lx, ly] = P(mid, r1 + gapL);
      let deg = (mid * 180) / Math.PI;
      const flip = ca < 0;
      if (flip) deg += 180;
      labG.push(el('text', { x: f(lx), y: f(ly), transform: `rotate(${deg.toFixed(1)} ${f(lx)} ${f(ly)})`, textAnchor: flip ? 'end' : 'start', dominantBaseline: 'middle', fill, fontSize: labelSize, fontWeight: 600, ...halo }, esc(labelOf(i))));
    } else {
      const [lx, ly] = P(mid, r1 + gapL);
      const anchor = Math.abs(ca) < 0.25 ? 'middle' : ca > 0 ? 'start' : 'end';
      const dy = Math.abs(ca) < 0.25 ? (sa < 0 ? -labelSize * 1.2 : labelSize * 0.9) : 0;
      const ls = linesOf(i);
      const lh = labelSize * 1.15;
      // Arriba del círculo el bloque crece hacia arriba; en el resto, hacia abajo.
      const y0 = Math.abs(ca) < 0.25 && sa < 0 ? ly + dy - (ls.length - 1) * lh : ly + dy - (Math.abs(ca) >= 0.25 ? ((ls.length - 1) * lh) / 2 : 0);
      ls.forEach((l, k) => labG.push(text(lx, y0 + k * lh, l, { textAnchor: anchor, fill, fontSize: labelSize, fontWeight: 600, ...halo })));
      labG.push(text(lx, y0 + ls.length * lh, valueOf(i), { textAnchor: anchor, fill: theme.lede, fontSize: labelSize - 1.5, ...halo }));
    }
  }

  const body = [g({ class: 'pa-ribbons' }, ribbonG), g({ class: 'pa-arcs' }, arcG), g({ class: 'pa-labels' }, labG)];
  const big = [...ribbons].sort((x, y) => y.v - x.v).slice(0, 3);
  const desc = en
    ? `Chord diagram of ${order.length} groups and ${ribbons.length} flows. Largest: ${big.map((r) => `${names[r.i]} ${directed ? '→' : '↔'} ${names[r.j]} (${fmt(r.v)})`).join('; ')}.`
    : `Diagrama de cuerdas con ${order.length} grupos y ${ribbons.length} flujos. Mayores: ${big.map((r) => `${names[r.i]} ${directed ? '→' : '↔'} ${names[r.j]} (${fmt(r.v)})`).join('; ')}.`;
  return frame.finish(body, { desc, type: 'chord' });
}

