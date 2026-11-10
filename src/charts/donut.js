// Dona y torta: parte-todo de un vistazo, con 6 segmentos como máximo (el
// resto se agrupa en "Otros"). Etiquetas dentro cuando caben, afuera con
// líneas guía sin choques, o como tabla-leyenda al lado. Media dona opcional.
import { el, g, text, tip } from '../svg.js';
import { measure, truncate } from '../text.js';
import { makeFormat, formatNumber } from '../format.js';
import { colorMap, textOn } from '../theme.js';
import { ensureData, requireField, num, fieldsOf, fieldKind, humanize, PlotError } from '../data.js';
import { createFrame, hash } from '../frame.js';
import { dashedMatcher, hatcher, dashedDefaultLabel, DASH } from '../dashed.js';
import { ctx } from '../context.js';

const f = (n) => n.toFixed(2);

function arc(cx, cy, R, r, a0, a1) {
  if (a1 - a0 >= Math.PI * 2 - 1e-6) a1 = a0 + Math.PI * 2 - 1e-4;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const p = (rad, a) => `${f(cx + rad * Math.cos(a))},${f(cy + rad * Math.sin(a))}`;
  if (r <= 0.01) return `M${f(cx)},${f(cy)}L${p(R, a0)}A${f(R)},${f(R)} 0 ${large} 1 ${p(R, a1)}Z`;
  return `M${p(R, a0)}A${f(R)},${f(R)} 0 ${large} 1 ${p(R, a1)}L${p(r, a1)}A${f(r)},${f(r)} 0 ${large} 0 ${p(r, a0)}Z`;
}

export function donut(spec, theme) {
  const data = ensureData(spec);
  const fields = fieldsOf(data);
  const labelF = spec.label ?? spec.x ?? fields.find((k) => fieldKind(data, k) === 'category') ?? fields[0];
  const valueF = spec.value ?? spec.y ?? fields.find((k) => k !== labelF && fieldKind(data, k) === 'number');
  requireField(data, labelF, 'label');
  requireField(data, valueF, 'value');
  const locale = spec.locale || 'es';
  const en = String(locale).startsWith('en');
  const isPie = spec.thickness !== undefined && spec.thickness >= 1;
  const half = !!spec.half;

  const sums = new Map();
  for (const r of data) {
    const v = num(r[valueF]);
    if (!(v > 0) || !Number.isFinite(v)) continue; // ≤ 0, vacíos e Infinity no tienen ángulo
    const k = String(r[labelF]);
    sums.set(k, (sums.get(k) || 0) + v);
  }
  // Sin ningún valor positivo no hay nada que repartir: error claro en vez de un anillo vacío con "0".
  if (!sums.size) throw new PlotError(en ? `No positive values in \`${valueF}\`.` : `No hay valores positivos en \`${valueF}\`.`, en ? 'A donut or pie needs at least one value greater than 0 (zero, negative and empty values are skipped).' : 'La dona o torta necesita al menos un valor mayor que 0 (se omiten ceros, negativos y vacíos).');
  let slices = [...sums.entries()].map(([k, v]) => ({ k, v }));
  if ((spec.sort ?? 'desc') === 'desc') slices.sort((a, b) => b.v - a.v);
  const max = spec.maxSlices ?? 6;
  if (slices.length > max) {
    const sorted = [...slices].sort((a, b) => b.v - a.v);
    const keep = new Set(sorted.slice(0, max - 1).map((s) => s.k));
    const rest = slices.filter((s) => !keep.has(s.k));
    slices = slices.filter((s) => keep.has(s.k));
    slices.push({ k: en ? 'Other' : 'Otros', v: rest.reduce((a, b) => a + b.v, 0), other: true });
  }
  const total = slices.reduce((a, b) => a + b.v, 0);
  const fmt = makeFormat(spec.format, locale, slices.map((s) => s.v));
  const cmap = colorMap(slices.filter((s) => !s.other).map((s) => s.k), theme, spec.colors);
  const hl = spec.highlight === undefined ? null : new Set([].concat(spec.highlight).map(String));
  const colorOf = (s) => (s.other ? theme.other : hl && !hl.has(s.k) ? theme.dim : cmap.get(s.k));
  const pct = (v) => formatNumber((v / (total || 1)) * 100, (v / (total || 1)) * 100 < 10 ? 1 : 0, locale, true) + '%';
  // Segmentos punteados: rayado del mismo color (p. ej. una parte estimada).
  const dm = dashedMatcher(spec, data, labelF, null);
  const isDashed = (s) => !!(dm && !s.other && dm(s.k));
  const dashedLabel = spec.dashedLabel ?? dashedDefaultLabel(locale);
  const H = hatcher(theme, 'pa-d' + Math.abs(hash(String(spec.title) + theme.mode + labelF)).toString(36));
  const paint = (s) => (isDashed(s) ? { fill: H.fill(colorOf(s)), 'data-dashed': '1', 'data-color': colorOf(s) } : { fill: colorOf(s) });
  const tipOf = (s) => tip(s.k, `${fmt(s.v)} · ${pct(s.v)}`, isDashed(s) ? dashedLabel : '');

  // Modo de etiquetas
  let mode = spec.labels === false ? 'none' : spec.labels ?? 'auto';
  if (mode === true) mode = 'auto';

  const frame = createFrame(spec, theme, { height: half ? 320 : 380 });
  const area = frame.layout([]);
  const narrow = area.w < 470;
  // Etiquetas exteriores solo si dejan un radio digno; si no, tabla-leyenda.
  if (mode === 'outside') {
    const lw = Math.min(area.w * 0.3, Math.max(...slices.map((s) => measure(s.k, 12.5) + 6 + measure(pct(s.v), 12.5, 600))));
    if ((area.w - 2 * (lw + 30)) / 2 < Math.min(90, area.h / 2 - 10)) mode = 'auto';
  }
  const outside = mode === 'outside';
  const table = mode === 'auto' || mode === 'legend' || mode === 'inside';
  const inner = mode === 'auto' || mode === 'inside';
  const body = [];

  // Geometría
  const rowH = Math.round(28 * Math.max(1, ctx.textScale * 0.9));
  const tableW = table ? (narrow ? area.w : Math.min(340, area.w * 0.5)) : 0;
  let cx, cy, R;
  let tx = 0, ty = 0;
  const outLabW = outside ? Math.min(area.w * 0.3, Math.max(...slices.map((s) => measure(s.k, 12.5) + 6 + measure(pct(s.v), 12.5, 600)))) : 0;
  if (outside) {
    const availW = (area.w - 2 * (outLabW + 30)) / 2;
    R = half ? Math.min(availW, area.h - 46) : Math.min(availW, area.h / 2 - 10);
    R = Math.max(50, R);
    cx = area.x + area.w / 2;
    cy = half ? area.y + Math.min(area.h - 40, R + 14) : area.y + area.h / 2;
  } else if (table && narrow) {
    R = half ? Math.min(area.w / 2 - 4, 170) : Math.min(area.w / 2 - 4, 150);
    cx = area.x + area.w / 2;
    cy = half ? area.y + R + 4 : area.y + R + 4;
    tx = area.x;
    ty = (half ? cy + 50 : cy + R + 22);
    if (spec.height === undefined) frame.setHeight(ty + slices.length * rowH + frame.chrome);
  } else if (table) {
    const chartW = area.w - tableW - 32;
    R = half ? Math.min(chartW / 2, area.h - 48) : Math.min(chartW / 2, area.h / 2);
    cx = area.x + R;
    cy = half ? area.y + Math.max(R + 6, (area.h + R) / 2 - 10) : area.y + area.h / 2;
    tx = area.x + 2 * R + 32;
    ty = (half ? cy - R / 2 : cy) - (slices.length * rowH) / 2;
    ty = Math.max(area.y, ty);
  } else {
    R = half ? Math.min(area.w / 2, area.h - 48) : Math.min(area.w, area.h) / 2;
    cx = area.x + area.w / 2;
    cy = half ? area.y + Math.min(area.h - 40, R + 8) : area.y + area.h / 2;
  }
  const r0 = isPie ? 0 : R * (1 - (spec.thickness ?? (half ? 0.32 : 0.38)));
  // Media dona: el alto se ajusta al semicírculo (o a la tabla, si es más alta).
  if (half && spec.height === undefined && !(table && narrow)) {
    const tableBottom = table ? ty + slices.length * rowH : 0;
    frame.setHeight(Math.max(cy + 12, tableBottom) + frame.chrome);
  }

  // Arcos
  const start = half ? Math.PI : -Math.PI / 2;
  const span = half ? Math.PI : Math.PI * 2;
  let a = start;
  const geo = [];
  for (const s of slices) {
    const a1 = a + (s.v / total) * span;
    geo.push({ s, a0: a, a1, mid: (a + a1) / 2 });
    a = a1;
  }
  const sep = theme.marks?.gap ?? 2;
  for (const q of geo) {
    body.push(el('path', { class: 'pa-m', d: arc(cx, cy, R, r0, q.a0, q.a1), ...paint(q.s), stroke: theme.surface, strokeWidth: sep, strokeLinejoin: 'round', 'data-tip': tipOf(q.s) }));
    // Borde discontinuo por dentro del segmento punteado (el borde exterior separa segmentos).
    if (isDashed(q.s)) body.push(el('path', { d: arc(cx, cy, R - sep, r0 > 0 ? r0 + sep : 0, q.a0 + sep / R, q.a1 - sep / R), fill: 'none', stroke: H.stroke(colorOf(q.s)), strokeWidth: 1.2, strokeDasharray: DASH.outline, 'pointer-events': 'none' }));
  }

  // Porcentajes dentro de los segmentos que tienen espacio.
  if (inner) {
    const rl = isPie ? R * 0.64 : (R + r0) / 2;
    const thick = R - r0;
    for (const q of geo) {
      const fill = colorOf(q.s);
      const ink = isDashed(q.s) ? theme.ink : textOn(fill, theme);
      const halo = isDashed(q.s) ? { stroke: theme.surface, strokeWidth: 3, paintOrder: 'stroke', strokeLinejoin: 'round' } : {};
      const p = pct(q.s.v);
      const size = isPie ? 13 : 12;
      const chord = (q.a1 - q.a0) * rl;
      const x = cx + rl * Math.cos(q.mid), y = cy + rl * Math.sin(q.mid);
      const showName = mode === 'inside' && chord >= measure(q.s.k, 11.5) + 12 && (isPie || thick >= 40);
      if (chord >= measure(p, size, 600) + 10 && (isPie || thick >= size + 8)) {
        body.push(text(x, y + (showName ? -2 : size * 0.35), p, { fill: ink, fontSize: size, fontWeight: 600, textAnchor: 'middle', pointerEvents: 'none', ...halo }));
        if (showName) body.push(text(x, y + 13, q.s.k, { fill: ink, fontSize: 11.5, textAnchor: 'middle', opacity: 0.9, pointerEvents: 'none', ...halo }));
      }
    }
  }

  // Etiquetas exteriores con líneas guía, sin choques (una columna por lado).
  if (outside) {
    const lh = 17;
    const items = geo.map((q) => ({ q, side: Math.cos(q.mid) >= 0 ? 1 : -1, y: cy + (R + 14) * Math.sin(q.mid) }));
    const yMin = area.y + 8, yMax = half ? cy - 4 : area.y + area.h - 4;
    for (const side of [1, -1]) {
      const col = items.filter((it) => it.side === side).sort((m, n) => m.y - n.y);
      for (let i = 0; i < col.length; i++) col[i].y = Math.max(col[i].y, i ? col[i - 1].y + lh : yMin);
      for (let i = col.length - 1; i >= 0; i--) col[i].y = Math.min(col[i].y, i < col.length - 1 ? col[i + 1].y - lh : yMax);
      for (let i = 0; i < col.length; i++) col[i].y = Math.max(col[i].y, i ? col[i - 1].y + lh : yMin);
    }
    for (const it of items) {
      const { q, side } = it;
      const p1x = cx + (R + 3) * Math.cos(q.mid), p1y = cy + (R + 3) * Math.sin(q.mid);
      const ex = cx + (R + 14) * Math.cos(q.mid);
      const lx = cx + side * (R + 26);
      const strong = !hl || hl.has(q.s.k);
      body.push(el('path', { d: `M${f(p1x)},${f(p1y)}L${f(ex)},${f(it.y)}L${f(lx - side * 4)},${f(it.y)}`, fill: 'none', stroke: theme.muted, strokeWidth: 1, opacity: 0.7 }));
      const name = truncate(q.s.k, outLabW - measure(pct(q.s.v), 12.5, 600) - 5, 12.5);
      const nameW = measure(name, 12.5);
      const anchor = side > 0 ? 'start' : 'end';
      const parts = side > 0
        ? [text(lx, it.y + 4, name, { fill: strong ? theme.ink : theme.muted, fontSize: 12.5 }), text(lx + nameW + 6, it.y + 4, pct(q.s.v), { fill: theme.ink, fontSize: 12.5, fontWeight: 600 })]
        : [text(lx, it.y + 4, pct(q.s.v), { fill: theme.ink, fontSize: 12.5, fontWeight: 600, textAnchor: anchor }), text(lx - measure(pct(q.s.v), 12.5, 600) - 6, it.y + 4, name, { fill: strong ? theme.ink : theme.muted, fontSize: 12.5, textAnchor: anchor })];
      body.push(g({ 'data-tip': tipOf(q.s) }, parts));
    }
  }

  // Centro: total o segmento destacado (solo dona).
  if (!isPie) {
    const focusSlice = hl ? slices.find((s) => hl.has(s.k)) : null;
    const big = spec.centerValue ?? (focusSlice ? pct(focusSlice.v) : fmt(total));
    const small = spec.centerLabel ?? (focusSlice ? focusSlice.k : 'Total');
    let bigSize = Math.min(half ? 38 : 34, r0 * (half ? 0.55 : 0.5));
    while (bigSize > 12 && measure(big, bigSize, 600) > r0 * 1.7) bigSize -= 1;
    if (half) {
      body.push(text(cx, cy - 6, big, { fill: theme.ink, fontSize: bigSize, fontWeight: 600, textAnchor: 'middle' }));
      body.push(text(cx, cy - 6 - bigSize * ctx.textScale - 2, truncate(small, r0 * 1.6, 12), { fill: theme.lede, fontSize: 12, textAnchor: 'middle' }));
    } else {
      body.push(text(cx, cy + bigSize * ctx.textScale * 0.32 - 4 * (ctx.textScale - 1), big, { fill: theme.ink, fontSize: bigSize, fontWeight: 600, textAnchor: 'middle' }));
      body.push(text(cx, cy + bigSize * ctx.textScale * 0.32 + 18 * ctx.textScale, truncate(small, r0 * 1.6, 12), { fill: theme.lede, fontSize: 12, textAnchor: 'middle' }));
    }
  }

  // Tabla-leyenda: nombre, % y valor. La identidad nunca depende solo del color.
  if (table) {
    const lw = narrow ? area.w : Math.min(tableW, area.x + area.w - tx);
    const valW = Math.max(...slices.map((s) => measure(fmt(s.v), 12.5)));
    const pctW = Math.max(...slices.map((s) => measure(pct(s.v), 13, 600)));
    slices.forEach((s, i) => {
      const y = ty + i * rowH + rowH / 2;
      const strong = !hl || hl.has(s.k);
      const parts = [
        el('rect', { x: tx, y: y - 15, width: lw, height: rowH, fill: 'transparent' }),
        isDashed(s)
          ? el('rect', { x: tx + 0.6, y: y - 4.4, width: 8.8, height: 8.8, rx: 2, fill: H.fill(colorOf(s)), stroke: H.stroke(colorOf(s)), strokeWidth: 1.1, strokeDasharray: DASH.legend })
          : el('rect', { x: tx, y: y - 5, width: 10, height: 10, rx: 2.5, fill: colorOf(s) }),
        text(tx + 18, y + 4.5, truncate(s.k, lw - 18 - valW - pctW - 28, 13), { fill: strong ? theme.ink : theme.muted, fontSize: 13 }),
        text(tx + lw - valW - 14, y + 4.5, pct(s.v), { fill: theme.ink, fontSize: 13, fontWeight: 600, textAnchor: 'end' }),
        text(tx + lw, y + 4.5, fmt(s.v), { fill: theme.muted, fontSize: 12.5, textAnchor: 'end' }),
      ];
      body.push(g({ 'data-tip': tipOf(s) }, parts));
    });
  }

  const kind = isPie ? (en ? 'Pie chart' : 'Gráfico de torta') : en ? 'Donut chart' : 'Gráfico de dona';
  const desc = `${kind} ${en ? 'of' : 'de'} ${humanize(valueF).toLowerCase()}. ` + slices.map((s) => `${s.k} ${pct(s.v)}`).join(', ') + '.';
  return frame.finish(body, { desc, type: isPie ? 'pie' : 'donut', defs: H.defs() });
}

/** Torta: dona sin agujero, con porcentajes dentro. */
export function pie(spec, theme) {
  return donut({ ...spec, thickness: 1 }, theme);
}
