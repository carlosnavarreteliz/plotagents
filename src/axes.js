// Ejes recesivos: líneas finas (1px), sólidas, un tono fuera del fondo.
import { el, g, text, linkWrap } from './svg.js';
import { measure, truncate } from './text.js';
import { SIZES } from './frame.js';
import { isColor } from './theme.js';
import { ctx } from './context.js';

/** Líneas de grilla horizontales con etiquetas a la izquierda. */
export function gridY(ticks, y, area, theme, fmt, { labels = true, baseline = 0 } = {}) {
  const out = [];
  for (const t of ticks) {
    const py = Math.round(y(t)) + 0.5;
    const isBase = t === baseline;
    out.push(el('line', { x1: area.x, x2: area.x + area.w, y1: py, y2: py, stroke: isBase ? theme.axis : theme.grid, ...gridAttrs(theme, isBase) }));
    if (labels) out.push(text(area.x - 8, py + 4, fmt(t), { fill: theme.muted, fontSize: SIZES.axis, textAnchor: 'end' }));
  }
  return g({ class: 'pa-axis pa-axis-y' }, out);
}

/** Líneas de grilla verticales con etiquetas abajo. */
export function gridX(ticks, x, area, theme, fmt, { labels = true, baseline = 0, lines = true } = {}) {
  const out = [];
  const items = ticks.map((t) => ({ pos: Math.round(x(t)) + 0.5, label: fmt(t), t }));
  for (const it of items) {
    if (lines) out.push(el('line', { x1: it.pos, x2: it.pos, y1: area.y, y2: area.y + area.h, stroke: it.t === baseline ? theme.axis : theme.grid, ...gridAttrs(theme, it.t === baseline) }));
  }
  // Un eje de valores siempre rotula su última marca: el primer valor redondo
  // sobre el máximo es lo que dice hasta dónde llega la escala.
  if (labels) out.push(xLabels(items, area, theme, { keepLast: true }));
  return g({ class: 'pa-axis pa-axis-x' }, out);
}

/**
 * Etiquetas bajo el eje x, raleadas si chocan (nunca rotadas).
 * Un ítem con `full` (el rótulo sin recortar) y `step` (la distancia entre
 * ítems): si se muestra uno de cada k, el rótulo se recorta a lo que mide el
 * hueco de k pasos y no al de uno.
 */
export function xLabels(items, area, theme, { y, size = SIZES.axis, color, keepLast = false, every: everyMin = 1, step, steps } = {}) {
  const ly = (y ?? area.y + area.h + 18) + (ctx.textScale - 1) * 10;
  const widths = items.map((it) => measure(it.label, size));
  // `every`: raleo pedido (xTicks: { every }); se ralea más sólo si chocan.
  let every = Math.max(1, Math.floor(everyMin) || 1);
  // Puede sobresalir del área hasta el margen disponible (0 en paneles).
  const ov = Math.min(20, Math.max(0, area.x));
  // Dónde queda de verdad cada rótulo: en los bordes se ancla al inicio o al
  // final y deja de estar centrado en su marca.
  const place = (pos, w) => {
    let anchor = 'middle', px = pos;
    const half = w / 2;
    if (px - half < area.x - ov) { anchor = 'start'; px = Math.max(px - 4, area.x - ov); }
    if (px + half > area.x + area.w + ov) { anchor = 'end'; px = Math.min(px + 4, area.x + area.w + ov); }
    return { anchor, px };
  };
  const span = (i, w) => {
    const { anchor, px } = place(items[i].pos, w);
    const x0 = anchor === 'start' ? px : anchor === 'end' ? px - w : px - w / 2;
    return [x0, x0 + w];
  };
  const fits = (k) => {
    let last = -Infinity;
    for (let i = 0; i < items.length; i += k) {
      const left = items[i].pos - widths[i] / 2;
      if (left < last + 10) return false;
      last = items[i].pos + widths[i] / 2;
    }
    // Con los bordes anclados: el primero y el último pueden correrse hacia adentro.
    const shown = [];
    for (let i = 0; i < items.length; i += k) shown.push(i);
    if (shown.length > 1) {
      const [a, b] = [shown[0], shown[1]], [c, d] = [shown[shown.length - 2], shown[shown.length - 1]];
      if (span(b, widths[b])[0] < span(a, widths[a])[1] + 4) return false;
      if (span(d, widths[d])[0] < span(c, widths[c])[1] + 4) return false;
    }
    return true;
  };
  // `steps`: raleos permitidos (meses: 1, 2, 3, 4, 6, 12…), para que un eje de
  // fechas muestre enero y julio, no enero, septiembre y mayo.
  const next = (k) => (steps ? steps.find((v) => v > k) ?? k + 1 : k + 1);
  while (every < items.length && !fits(every)) every = next(every);
  // Eje de valores: un raleo que deje la última marca sin rótulo se cambia por
  // el más fino que la incluya (cada k que divide n − 1).
  const n = items.length;
  if (keepLast && n > 2 && every > 1 && (n - 1) % every !== 0) {
    let k = every;
    while (k < n - 1 && ((n - 1) % k !== 0 || !fits(k))) k++;
    every = k;
  }
  // Uno de cada `every`: el rótulo recortado vuelve a su largo, hasta el hueco.
  const room = step && every > 1 ? every * step - 4 : 0;
  const labels = items.map((it, i) => (room && !(i % every) && it.full !== undefined && it.full !== it.label ? truncate(it.full, Math.max(room, widths[i]), size) : it.label));
  if (room) {
    // Si un rótulo alargado choca con su vecino (en un borde anclado), los dos
    // vuelven al recorte de siempre, que ya se sabe que cabe.
    const lw = labels.map((l, i) => (l === items[i].label ? widths[i] : measure(l, size)));
    for (let i = every; i < items.length; i += every) {
      const p = i - every;
      if (span(i, lw[i])[0] < span(p, lw[p])[1] + 4) { labels[i] = items[i].label; labels[p] = items[p].label; lw[i] = widths[i]; lw[p] = widths[p]; }
    }
  }
  const out = [];
  items.forEach((it, i) => {
    if (i % every) return;
    const label = labels[i];
    const { anchor, px } = place(it.pos, label === it.label ? widths[i] : measure(label, size));
    // `href`: el rótulo enlaza (sólo rutas y http(s); sin href queda igual).
    out.push(linkWrap(it.href, text(px, ly, label, { fill: color || theme.muted, fontSize: size, textAnchor: anchor })));
  });
  return g({}, out);
}

// Raleos de un eje de fechas: múltiplos que caen en el calendario.
const MONTH_STEPS = [1, 2, 3, 4, 6, 12, 24, 36, 60, 120, 240, 300, 600, 1200];
const YEAR_STEPS = [1, 2, 5, 10, 20, 25, 50, 100];

/**
 * Cada cuántas marcas se puede ralear un eje de fechas cuyas marcas van cada
 * `every` `unit` (meses o años), para que lo que queda caiga en el calendario.
 */
export function calendarSteps(unit, every = 1) {
  const base = unit === 'month' ? MONTH_STEPS : unit === 'year' ? YEAR_STEPS : null;
  if (!base) return undefined;
  const ks = base.filter((v) => v % every === 0).map((v) => v / every);
  return ks.length ? ks : undefined;
}

export const ticksWidth = (ticks, fmt, size = SIZES.axis) => Math.max(0, ...ticks.map((t) => measure(fmt(t), size)));

// ── Eje y "interior": la etiqueta va sobre su línea de grilla, dentro del
// área de trazado (estilo FT / Datawrapper). Ahorra el margen izquierdo.
// Uso: margen = yAxisMargin(...); dibuja yGrid(...) antes de las marcas y
// yTickLabels(...) después, para que queden legibles sobre los datos.

export const isInside = (theme, inside) => inside ?? theme.axes?.inside ?? true;

/** Margen izquierdo que necesita el eje y (0 si las etiquetas van dentro). */
export function yAxisMargin(ticks, fmt, theme, inside) {
  return isInside(theme, inside) ? 0 : ticksWidth(ticks, fmt, theme.type?.axis ?? SIZES.axis) + 10;
}
/** Espacio superior para la etiqueta de la marca más alta. */
export const yAxisTop = (theme, inside) => (isInside(theme, inside) ? 14 * ctx.textScale : 6);

export function yGrid(ticks, y, area, theme, { baseline = 0 } = {}) {
  return g({ class: 'pa-grid' }, ticks.map((t) => {
    const py = Math.round(y(t)) + 0.5;
    return el('line', { x1: area.x, x2: area.x + area.w, y1: py, y2: py, stroke: t === baseline ? theme.axis : theme.grid, ...gridAttrs(theme, t === baseline) });
  }));
}

export function yTickLabels(ticks, y, area, theme, fmt, { inside, unit } = {}) {
  const size = theme.type?.axis ?? SIZES.axis;
  const ins = isInside(theme, inside);
  return g({ class: 'pa-axis pa-axis-y' }, ticks.map((t, i) => {
    const py = Math.round(y(t)) + 0.5;
    const label = fmt(t) + (unit && i === ticks.length - 1 ? ' ' + unit : '');
    return ins
      ? text(area.x, py - 5 * Math.max(1, ctx.textScale * 0.8), label, { fill: theme.muted, fontSize: size, stroke: theme.surface, strokeWidth: 3, paintOrder: 'stroke', strokeLinejoin: 'round' })
      : text(area.x - 8, py + 4, label, { fill: theme.muted, fontSize: size, textAnchor: 'end' });
  }));
}

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

/**
 * Esquina más despejada para una nota (R², n…): cuenta los puntos (y la recta
 * de ajuste, si se pasa muestreada) que caen bajo cada esquina candidata.
 * Devuelve { x, y, anchor } listo para un <text>.
 */
export function quietCorner(points, inner, w, h = 14, pad = 8) {
  const m = 10;
  const cands = [
    { k: 'tr', x0: inner.x + inner.w - pad - w, y0: inner.y + 2, tx: inner.x + inner.w - pad, ty: inner.y + 2 + h - 3, anchor: 'end' },
    { k: 'br', x0: inner.x + inner.w - pad - w, y0: inner.y + inner.h - h - 4, tx: inner.x + inner.w - pad, ty: inner.y + inner.h - 7, anchor: 'end' },
    // A la izquierda se deja libre la columna de etiquetas interiores del eje y.
    { k: 'tl', x0: inner.x + pad + 34, y0: inner.y + 2, tx: inner.x + pad + 34, ty: inner.y + 2 + h - 3, anchor: 'start' },
    { k: 'bl', x0: inner.x + pad + 34, y0: inner.y + inner.h - h - 4, tx: inner.x + pad + 34, ty: inner.y + inner.h - 7, anchor: 'start' },
  ];
  let best = cands[0], bestN = Infinity;
  for (const c of cands) {
    let n = 0;
    for (const [px, py] of points) if (px >= c.x0 - m && px <= c.x0 + w + m && py >= c.y0 - m && py <= c.y0 + h + m) n++;
    if (n < bestN) { bestN = n; best = c; }
  }
  return { x: best.tx, y: best.ty, anchor: best.anchor };
}

/** Trazo de grilla y base según el tema (theme.grid { dash, width }, theme.axis { width }). */
export function gridAttrs(theme, base = false) {
  const st = base ? theme.axisStyle : theme.gridStyle;
  const w = st && Number.isFinite(+st.width) ? +st.width : 1;
  const dash = !base && st && st.dash && /^[\d.\s,]+$/.test(String(st.dash)) ? String(st.dash) : null;
  return { strokeWidth: w, strokeDasharray: dash, shapeRendering: dash ? null : 'crispEdges' };
}

// ── Eje de categorías con grupos (xGroup / yGroup) ──────────────────────────
// Categorías consecutivas que comparten grupo llevan una banda junto al eje con
// el nombre del grupo, en tinte alterno, y una línea fina entre grupos. No se
// reordena nada: un grupo partido en dos tramos son dos bandas.

/** Tramos [{ group, from, to }] de categorías consecutivas con el mismo grupo. */
export function groupRuns(cats, data, catField, groupField) {
  const of = new Map();
  for (const r of data) {
    const c = String(r[catField]);
    if (!of.has(c)) of.set(c, r[groupField] === null || r[groupField] === undefined ? '' : String(r[groupField]));
  }
  const runs = [];
  cats.forEach((c, i) => {
    const name = of.get(String(c)) ?? '';
    const last = runs[runs.length - 1];
    if (last && last.group === name) last.to = i;
    else runs.push({ group: name, from: i, to: i });
  });
  return runs;
}

/** Alto (o ancho mínimo) de la banda de grupos. */
export const GROUP_BAND = 22;

/** Ancho de la banda vertical de grupos (yGroup). */
export function groupBandWidth(runs, maxW, size = 11.5) {
  return Math.min(maxW, Math.max(GROUP_BAND, ...runs.map((r) => measure(r.group, size, 500) + 16)));
}

/**
 * Banda de grupos bajo un eje horizontal. `pos(i)` → [x0, x1] de la categoría i;
 * `y` es el borde superior de la banda; la línea entre grupos sube hasta `top`.
 */
export function groupBandX(runs, pos, y, theme, top, size = 11.5, colors) {
  const out = [];
  runs.forEach((r, k) => {
    const a = pos(r.from)[0], b = pos(r.to)[1];
    // `colors[grupo]`: una franja de su color en el borde que mira a la grilla, en vez del tinte alterno.
    const c = colors && isColor(colors[r.group]) ? colors[r.group] : null;
    if (c) out.push(el('rect', { x: a, y, width: Math.max(0, b - a), height: 3, fill: c }));
    else if (k % 2 === 0) out.push(el('rect', { x: a, y, width: Math.max(0, b - a), height: GROUP_BAND - 4, rx: 3, fill: theme.tint }));
    if (k > 0) out.push(el('line', { x1: a - 1, x2: a - 1, y1: top, y2: y + GROUP_BAND - 4, stroke: theme.axis, strokeWidth: 1, shapeRendering: 'crispEdges' }));
    if (r.group && b - a >= 24) {
      const t = truncate(r.group, b - a - 6, size, 500);
      const node = text((a + b) / 2, y + 13 + (c ? 2 : 0) + (ctx.textScale - 1) * 4, t, { fill: theme.lede, fontSize: size, fontWeight: 500, textAnchor: 'middle' });
      // Un nombre recortado se lee entero en el tooltip.
      out.push(t === r.group ? node : g({ 'data-tip': r.group }, node));
    } else if (r.group) out.push(el('rect', { x: a, y, width: Math.max(0, b - a), height: GROUP_BAND - 4, fill: 'transparent', 'data-tip': r.group }));
  });
  return g({ class: 'pa-groups pa-groups-x' }, out);
}

/**
 * Banda de grupos a la izquierda de un eje vertical. `pos(i)` → [y0, y1];
 * `x`, `w` = posición y ancho de la banda; la línea entre grupos llega a `right`.
 */
export function groupBandY(runs, pos, x, w, theme, right, size = 11.5, colors) {
  const out = [];
  runs.forEach((r, k) => {
    const a = pos(r.from)[0], b = pos(r.to)[1];
    const c = colors && isColor(colors[r.group]) ? colors[r.group] : null;
    if (c) out.push(el('rect', { x, y: a, width: 3, height: Math.max(0, b - a), fill: c }));
    else if (k % 2 === 0) out.push(el('rect', { x, y: a, width: Math.max(0, w - 6), height: Math.max(0, b - a), rx: 3, fill: theme.tint }));
    if (k > 0) out.push(el('line', { x1: x, x2: right, y1: a - 1, y2: a - 1, stroke: theme.axis, strokeWidth: 1, shapeRendering: 'crispEdges' }));
    if (r.group && b - a >= 12) {
      const t = truncate(r.group, w - 14, size, 500);
      const node = text(x + 6, (a + b) / 2 + 4, t, { fill: theme.lede, fontSize: size, fontWeight: 500 });
      out.push(t === r.group ? node : g({ 'data-tip': r.group }, node));
    } else if (r.group) out.push(el('rect', { x, y: a, width: Math.max(0, w - 6), height: Math.max(0, b - a), fill: 'transparent', 'data-tip': r.group }));
  });
  return g({ class: 'pa-groups pa-groups-y' }, out);
}
