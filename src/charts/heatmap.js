// Mapa de calor: magnitud en una grilla de dos categorías (o tiempo).
// Rampa secuencial de un solo tono; divergente si hay un punto medio.
import { tipper } from '../tooltip.js';
import { el, g, text, tip, linkWrap } from '../svg.js';
import { measure, truncate } from '../text.js';
import { makeFormat } from '../format.js';
import { ramp, textOn, isColor, hexToRgb, rgbToHex } from '../theme.js';
import { ensureData, requireField, uniq, num, fieldsOf, fieldKind, aggregate, humanize } from '../data.js';
import { xLabels, groupRuns, groupBandX, groupBandY, groupBandWidth, GROUP_BAND } from '../axes.js';
import { createFrame, chartId, SIZES } from '../frame.js';
import { binnedScale, withMidClass } from '../colorscales.js';
import { ctx } from '../context.js';

const CS = 11.5; // cuerpo del título de la esquina

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
  const cellRows = new Map();
  for (const r of data) {
    const k = String(r[x]) + '\u0000' + String(r[y]);
    if (!cells.has(k)) { cells.set(k, []); cellRows.set(k, []); }
    cells.get(k).push(num(r[valueF]));
    cellRows.get(k).push(r);
  }
  const TT = tipper(spec, data, locale);
  const val = (a, b) => { const v = cells.get(a + '\u0000' + b); return v ? aggregate(v, spec.aggregate || 'sum') : NaN; };
  // `floor` / `ceiling`: lo que cae fuera se dibuja como celda vacía (no es
  // «sin dato»: el valor existe y el tooltip lo dice) y no cuenta para la escala.
  const lo = spec.floor ?? null, hi = spec.ceiling ?? null;
  const outside = (v) => Number.isFinite(v) && ((lo !== null && v < lo) || (hi !== null && v > hi));
  // Celdas aparte (`diagonal`, `cellColor`): llevan su propio color, fuera de
  // la escala, con su entrada en la leyenda y su línea en el tooltip. Una
  // celda aparte sin valor sigue siendo «sin dato».
  const apart = apartCells(spec, theme, x, y, cellRows);
  const finite = [...cells.keys()].map((k) => { const [a, b] = k.split('\u0000'); return val(a, b); }).filter(Number.isFinite);
  const all = apart.none ? finite.filter((v) => !outside(v))
    : [...cells.keys()].filter((k) => { const [a, b] = k.split('\u0000'); return !apart.of(a, b); }).map((k) => { const [a, b] = k.split('\u0000'); return val(a, b); }).filter((v) => Number.isFinite(v) && !outside(v));
  const vmin = Math.min(...all), vmax = Math.max(...all);
  const fmt = makeFormat(spec.format, locale, finite);
  const mid = spec.midpoint ?? (spec.diverging ? 0 : undefined);
  const stops = mid !== undefined ? theme.diverging : theme.sequential;
  // `midClass: 'neutral'`: con cortes divergentes, la clase que contiene el 0
  // (sin que el 0 sea un corte) va en el tinte neutro: lo que casi no se aparta
  // no se pinta. `midClass: { color }` da ese color (un parche de piel puede
  // cambiarlo sin tocar el tema). Los colores pueden venir sin el del medio
  // (tantos como cortes): ese color se inserta en la clase del 0 (withMidClass).
  const midC = spec.midClass === 'neutral' ? theme.tint : spec.midClass && typeof spec.midClass === 'object' ? (isColor(spec.midClass.color) ? spec.midClass.color : theme.tint) : null;
  const bins0 = binnedScale(withMidClass(spec, midC));
  const bins = bins0 && midC && !bins0.breaks.includes(0) && bins0.breaks[0] < 0 && bins0.breaks[bins0.breaks.length - 1] > 0
    ? (() => { const k = bins0.cls(0); const colors = bins0.colors.map((c, i) => (i === k ? midC : c)); return { ...bins0, colors, color: (v) => colors[bins0.cls(v)] }; })()
    : bins0;
  // `missingLabel`: lo que dice el tooltip de una celda sin valor.
  const missingLabel = spec.missingLabel === undefined || spec.missingLabel === null ? '—' : String(spec.missingLabel);
  // Celdas sin valor: 'tint' (por defecto, un tinte), 'plain' (sólo el borde),
  // 'hatch' (rayado de «sin dato») o 'gap' (nada).
  const missing = ['tint', 'plain', 'hatch', 'gap'].includes(spec.missing) ? spec.missing : 'tint';
  const ndId = chartId(spec, 'hm-nd');
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
  if (spec.legend !== false) for (const it of apart.legend) legend.push({ label: it.label, color: it.color, shape: 'square', value: it.label });
  // Rótulos girados: el alto por defecto suma lo que piden (si no, se lo comen las celdas).
  const angle = Number.isFinite(+spec.xLabelAngle) ? Math.max(-90, Math.min(90, +spec.xLabelAngle)) : 0;
  const rot = angle !== 0;
  const XS = SIZES.axis;
  const sin = Math.sin((angle * Math.PI) / 180), cos = Math.cos((angle * Math.PI) / 180);
  const labCap = (w) => Math.min(Math.max(60, Math.min(180, w * 0.3)), Math.max(0, ...xs.map((a) => measure(a, XS))));
  const extraH = rot ? Math.max(0, Math.ceil(labCap(+spec.width || 720) * Math.abs(sin) + XS * Math.abs(cos)) + 10 - 26) : 0;
  // `yLabelPosition: "above"`: el nombre de cada fila va sobre ella, a todo
  // el ancho (para un teléfono); la columna de rótulos desaparece.
  const above = spec.yLabelPosition === 'above';
  const LH = above ? Math.round(12 * ctx.textScale + 5) : 0;
  const frame = createFrame(spec, theme, { height: Math.min(640, 140 + ys.length * 34) + extraH + ys.length * LH });
  const area = frame.layout(legend);
  const xRuns = spec.xGroup ? (requireField(data, spec.xGroup, 'xGroup'), groupRuns(xs, data, x, spec.xGroup)) : null;
  const yRuns = spec.yGroup ? (requireField(data, spec.yGroup, 'yGroup'), groupRuns(ys, data, y, spec.yGroup)) : null;
  // `groupLabels: false`: sin la banda de nombres de grupo (en un teléfono se
  // leen «Indus…», «Co…»); las franjas de `groupColors` quedan en el borde de
  // la grilla, con el nombre del grupo en su tooltip.
  const noBand = spec.groupLabels === false;
  const gW = yRuns && !noBand ? groupBandWidth(yRuns, area.w * 0.22) : 0;
  const gH = xRuns && !noBand ? GROUP_BAND : 0;
  // `cornerLabel`: el título de la esquina vacía (qué es fila y qué columna);
  // un salto de línea (\n) lo parte, y la columna de rótulos de fila se ensancha
  // para que quepa (con el mismo tope).
  const corner = spec.cornerLabel === undefined || spec.cornerLabel === null || spec.cornerLabel === '' ? null : String(spec.cornerLabel).split('\n');
  // `rowLabelWidth`: el tope de la columna de rótulos de fila, en px (> 1) o
  // como fracción del ancho (≤ 1); 30 % por defecto.
  const rlw = +spec.rowLabelWidth;
  const yCap = spec.rowLabelWidth != null && Number.isFinite(rlw) && rlw > 0 ? (rlw <= 1 ? area.w * rlw : rlw) : area.w * 0.3;
  const yW = above ? 0 : Math.min(yCap, Math.max(...ys.map((v) => measure(v, 12)), ...(corner ? corner.map((l) => measure(l, CS, 500)) : []))) + 12;
  // Rótulos de columna: abajo (por defecto) o arriba (`xLabelPosition`), y
  // girados (`xLabelAngle`) cuando no caben de lado. Girados, la franja mide lo
  // que mide el rótulo más largo (con un tope; lo cortado va entero en el tooltip).
  const top = spec.xLabelPosition === 'top';
  const maxLab = rot ? labCap(area.w) : 0;
  const headH = rot ? Math.ceil(maxLab * Math.abs(sin) + XS * Math.abs(cos)) + 10 : 26;
  // Un rótulo que se inclina hacia la derecha no se sale del lienzo: se le
  // hace sitio a la derecha de la última columna.
  const towardRight = rot && (top ? sin < 0 : sin > 0);
  const cw0 = (area.w - gW - yW) / xs.length;
  const reserve = towardRight ? Math.max(0, maxLab * Math.abs(cos) - cw0 / 2) : 0;
  const inner = { x: area.x + gW + yW, y: area.y + (top ? headH : 0), w: area.w - gW - yW - (reserve > 1 ? reserve : 0), h: area.h - headH - gH };
  const below = top ? (gH ? 4 : 0) : headH;
  const cw = inner.w / xs.length, ch = Math.min(inner.h / ys.length - LH, spec.cellHeight ?? 56);
  inner.h = (ch + LH) * ys.length;
  // Borde superior de la celda de la fila j (bajo su nombre, con `above`).
  const rowY = (j) => inner.y + j * (ch + LH) + LH;
  // El nombre de la fila: a la izquierda (por defecto) o sobre ella.
  const rowLabel = (b, j, fill) => (above
    ? text(inner.x, rowY(j) - 4, truncate(b, inner.w, 12), { fill, fontSize: 12 })
    : text(inner.x - 10, rowY(j) + ch / 2 + 4, truncate(b, yW - 12, 12), { fill, fontSize: 12, textAnchor: 'end' }));
  if (spec.height === undefined) frame.setHeight(inner.y + inner.h + below + gH + frame.chrome);
  // `cellGap`: aire entre celdas en px (2 por defecto; 0 las junta; [x, y] por eje).
  const [gx, gy] = cellGap(spec.cellGap);
  const rx = gx > 0 && gy > 0 ? 3 : 0;
  // `labelFormat`: el numeral de la celda, aparte del tooltip y la leyenda
  // (una función puede devolver '' para dejar la celda sin cifra).
  const lfmt = spec.labelFormat !== undefined ? makeFormat(spec.labelFormat, locale, finite) : fmt;
  const showLabels = spec.labels ?? (all.length > 0 && cw >= Math.max(...all.map((v) => measure(lfmt(v), 11))) + 8 && ch >= 18);
  // Enlaces en los rótulos de fila y de columna (`rowHref`, `colHref`).
  const rowHrefOf = hrefFor(spec.rowHref, data, y);
  const colHrefOf = hrefFor(spec.colHref, data, x);
  // `rowTip`: lo que dice el rótulo de una fila al pasar el cursor (lo que es
  // de toda la fila y no tiene que repetirse en cada celda).
  const rowTipOf = hrefFor(spec.rowTip, data, y);
  const tipWrap = (t, node) => (t === undefined || t === null || t === '' ? node : g({ 'data-tip': String(t) }, node));
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
      if (j % yEvery === 0) body.push(linkWrap(rowHrefOf(b), tipWrap(rowTipOf(b), rowLabel(b, j, theme.muted))));
      body.push(g({ class: 'pa-m', 'data-tip': tip(b, spec.emptyRow) }, [
        el('rect', { x: inner.x + gx / 2, y: rowY(j) + gy / 2, width: Math.max(0, inner.w - gx), height: Math.max(0, ch - gy), rx, fill: 'transparent', stroke: theme.grid, strokeWidth: 1 }),
        text(inner.x + inner.w / 2, rowY(j) + ch / 2 + 4, truncate(spec.emptyRow, Math.max(20, inner.w - 12), 11.5), { fill: theme.muted, fontSize: 11.5, textAnchor: 'middle' }),
      ]));
      return;
    }
    if (j % yEvery === 0) body.push(linkWrap(rowHrefOf(b), tipWrap(rowTipOf(b), rowLabel(b, j, theme.lede))));
    xs.forEach((a, i) => {
      const v = val(a, b);
      const cx = inner.x + i * cw + gx / 2, cy = rowY(j) + gy / 2;
      const box = { x: cx, y: cy, width: Math.max(0, cw - gx), height: Math.max(0, ch - gy), rx };
      const sp = apart.none || !Number.isFinite(v) ? null : apart.of(a, b);
      const tipTxt = TT({ [x]: a, [y]: b }, `${b} · ${a}`, Number.isFinite(v) ? fmt(v) : missingLabel, sp ? sp.label : '');
      if (!Number.isFinite(v) && missing === 'gap') return;
      if (sp) {
        const parts = [el('rect', { ...box, fill: sp.color, fillOpacity: sp.opacity })];
        const lab = lfmt(v);
        if (showLabels && lab && (spec.labels === true || measure(lab, 11) + 8 <= cw)) parts.push(text(cx + (cw - gx) / 2, cy + (ch - gy) / 2 + 4, lab, { fill: textOn(sp.solid, theme), fontSize: 11, textAnchor: 'middle', fontWeight: 500 }));
        body.push(g({ class: 'pa-m', 'data-tip': tipTxt }, parts));
        return;
      }
      // Celda vacía: sin dato con missing: 'plain', o un valor fuera de floor/ceiling.
      if (outside(v) || (!Number.isFinite(v) && missing === 'plain')) {
        body.push(g({ class: 'pa-m', 'data-tip': tipTxt }, [el('rect', { ...box, fill: 'transparent', stroke: theme.grid, strokeWidth: 1 })]));
        return;
      }
      const fill = colorOf(v);
      const parts = [el('rect', { ...box, fill })];
      const lab = showLabels && Number.isFinite(v) ? lfmt(v) : '';
      if (lab) parts.push(text(cx + (cw - gx) / 2, cy + (ch - gy) / 2 + 4, lab, { fill: textOn(fill, theme), fontSize: 11, textAnchor: 'middle', fontWeight: 500 }));
      body.push(g({ class: 'pa-m', 'data-tip': tipTxt }, parts));
    });
  });
  if (!rot) body.push(xLabels(xs.map((a, i) => ({ pos: inner.x + i * cw + cw / 2, label: a, href: colHrefOf(a) })), inner, theme, { y: top ? inner.y - 9 : inner.y + inner.h + 18, color: theme.lede, every: spec.xTicks?.every }));
  else {
    // Girados: el pivote queda al pie de su columna (o sobre ella) y el texto
    // se centra en la columna; si no caben uno al lado del otro, se ralean.
    const every = Math.max(1, Math.floor(spec.xTicks?.every ?? 1), Math.ceil((XS * 0.85) / Math.max(0.01, cw * Math.abs(sin))));
    const anchor = top ? (sin < 0 ? 'start' : 'end') : (sin < 0 ? 'end' : 'start');
    const py = top ? inner.y - 6 : inner.y + inner.h + 6;
    const out = [];
    xs.forEach((a, i) => {
      if (i % every) return;
      const px = Math.round((inner.x + i * cw + cw / 2 - 0.35 * XS * sin) * 100) / 100;
      const qy = Math.round((py + 0.35 * XS * cos) * 100) / 100;
      const t = truncate(a, maxLab, XS);
      const r = Math.round(angle * 100) / 100;
      const node = text(px, qy, t, { fill: theme.lede, fontSize: XS, textAnchor: anchor, transform: `rotate(${r} ${px} ${qy})` });
      out.push(linkWrap(colHrefOf(a), t === a ? node : g({ 'data-tip': a }, node)));
    });
    body.push(g({ class: 'pa-xlabels' }, out));
  }
  // `groupColors`: un color por grupo, como una franja en su banda (junto a la grilla).
  // `groupStripe: 'labels'`: la franja va en cambio en el borde de la grilla
  // del lado de los rótulos (entre los rótulos y las celdas: arriba con
  // `xLabelPosition: 'top'`), y la banda de grupos queda sólo con los nombres.
  const gc = spec.groupColors && typeof spec.groupColors === 'object' ? spec.groupColors : undefined;
  const atLabels = !!gc && (spec.groupStripe === 'labels' || noBand);
  const xPos = (i) => [inner.x + i * cw + 1, inner.x + (i + 1) * cw - 1];
  const yPos = (j) => [rowY(j) + 1 - (j && LH ? LH : 0), rowY(j) + ch - 1];
  if (xRuns && !noBand) body.push(groupBandX(xRuns, xPos, inner.y + inner.h + below, theme, inner.y, undefined, gc, !atLabels));
  if (yRuns && !noBand) body.push(groupBandY(yRuns, yPos, area.x, gW, theme, inner.x + inner.w, undefined, gc, !atLabels));
  const stripeTip = (grp) => (noBand && grp ? { 'data-tip': String(grp) } : {});
  if (atLabels) {
    const stripes = [];
    for (const r of xRuns || []) {
      if (!isColor(gc[r.group])) continue;
      const a = xPos(r.from)[0], b = xPos(r.to)[1];
      stripes.push(el('rect', { x: a, y: top ? inner.y - 5 : inner.y + inner.h + 2, width: Math.max(0, b - a), height: 3, fill: gc[r.group], ...stripeTip(r.group) }));
    }
    for (const r of yRuns || []) {
      if (!isColor(gc[r.group])) continue;
      const a = yPos(r.from)[0], b = yPos(r.to)[1];
      stripes.push(el('rect', { x: inner.x - 5, y: a, width: 3, height: Math.max(0, b - a), fill: gc[r.group], ...stripeTip(r.group) }));
    }
    body.push(g({ class: 'pa-group-stripes' }, stripes));
  }
  if (corner && !above) {
    // En la esquina: alineado a la derecha sobre los rótulos de fila, pegado a
    // la franja de rótulos de columna. Lo que no cabe va entero en el tooltip.
    const room = Math.max(0, inner.x - 10 - (area.x + gW));
    const fit = Math.max(1, Math.floor((headH - 4) / 14));
    const lines = corner.length > fit ? [...corner.slice(0, fit - 1), corner.slice(fit - 1).join(' ')] : corner;
    const shown = lines.map((l) => truncate(l, room, CS, 500));
    const cut = corner.length > fit || shown.some((l, i) => l !== lines[i]);
    const y0 = top ? inner.y - 9 - (shown.length - 1) * 14 : inner.y + inner.h + 18;
    const nodes = shown.map((l, i) => text(inner.x - 10, y0 + i * 14, l, { fill: theme.muted, fontSize: CS, fontWeight: 500, textAnchor: 'end' }));
    body.push(g({ class: 'pa-corner', 'data-tip': cut ? corner.join(' ') : undefined }, nodes));
  }

  const en = String(locale).startsWith('en');
  let best = null;
  for (const a of xs) for (const b of ys) { const v = val(a, b); if (Number.isFinite(v) && (apart.none || !apart.of(a, b)) && (!best || v > best[2])) best = [a, b, v]; }
  const desc = en
    ? `Heatmap of ${humanize(valueF)} by ${humanize(x)} and ${humanize(y)}.` + (best ? ` Highest: ${best[1]} · ${best[0]} (${fmt(best[2])}).` : ' No cell has a numeric value.')
    : `Mapa de calor de ${humanize(valueF).toLowerCase()} por ${humanize(x).toLowerCase()} y ${humanize(y).toLowerCase()}.` + (best ? ` Máximo: ${best[1]} · ${best[0]} (${fmt(best[2])}).` : ' Ninguna celda tiene un valor numérico.');
  return frame.finish(body, { desc, type: 'heatmap' });
}

/** `cellGap`: un número (ambos ejes) o [x, y]; 2 px por defecto. */
function cellGap(v) {
  const ok = (n) => (Number.isFinite(+n) && +n >= 0 ? +n : 2);
  if (Array.isArray(v)) return [ok(v[0]), ok(v[1] ?? v[0])];
  return v === undefined || v === null ? [2, 2] : [ok(v), ok(v)];
}

/**
 * Enlace de un rótulo: un campo de los datos (la primera fila de ese rótulo
 * que lo traiga) o, desde JS, una función (rótulo) → URL. linkWrap deja pasar
 * sólo rutas y http(s).
 */
function hrefFor(opt, data, key) {
  if (typeof opt === 'function') return (label) => opt(label);
  if (typeof opt !== 'string' || !opt) return () => undefined;
  const m = new Map();
  for (const r of data) {
    const k = String(r[key]);
    const h = r[opt];
    if (!m.has(k) && h !== undefined && h !== null && h !== '') m.set(k, h);
  }
  return (label) => m.get(label);
}

/**
 * Celdas fuera de la escala de color. `diagonal` (true, un rótulo o
 * { color, label, opacity }) aparta las celdas con x = y; `cellColor` es un
 * campo cuyo valor nombra la clase de la celda (su color sale de `colors`, o es
 * un color CSS). Cada clase con nombre lleva su entrada en la leyenda.
 */
function apartCells(spec, theme, x, y, cellRows) {
  const cf = typeof spec.cellColor === 'string' && spec.cellColor ? spec.cellColor : null;
  let diag = null;
  if (spec.diagonal) {
    const d = spec.diagonal === true ? {} : typeof spec.diagonal === 'string' ? { label: spec.diagonal } : spec.diagonal;
    const label = d.label === undefined || d.label === null ? '' : String(d.label);
    const color = isColor(d.color) ? d.color : isColor(spec.colors?.[label]) ? spec.colors[label] : theme.muted;
    const op = Number.isFinite(+d.opacity) && d.opacity !== null && +d.opacity < 1 ? Math.max(0, +d.opacity) : undefined;
    diag = { label, color, opacity: op, solid: op === undefined ? color : mixOn(color, theme.surface, op) };
  }
  if (!cf && !diag) return { none: true, of: () => null, legend: [] };
  const kinds = new Map();
  const kindOf = (k) => {
    if (!kinds.has(k)) {
      // Un valor escrito como color (#hex, rgb(), hsl(), var()) es el color; otro texto es el nombre de la clase.
      const named = !(/^(#|rgba?\(|hsla?\(|var\()/i.test(k) && isColor(k));
      const color = named ? (isColor(spec.colors?.[k]) ? spec.colors[k] : theme.muted) : k;
      kinds.set(k, { label: named ? k : '', color, solid: color });
    }
    return kinds.get(k);
  };
  const of = (a, b) => {
    if (cf) {
      const r = (cellRows.get(a + '\u0000' + b) || []).find((row) => row[cf] !== undefined && row[cf] !== null && row[cf] !== '' && row[cf] !== false);
      if (r) return kindOf(String(r[cf]));
    }
    return diag && a === b ? diag : null;
  };
  // Leyenda: sólo las clases que alguna celda usa, en orden de aparición.
  const used = new Set();
  for (const k of cellRows.keys()) { const [a, b] = k.split('\u0000'); const sp = of(a, b); if (sp && sp.label) used.add(sp); }
  return { none: false, of, legend: [...used] };
}

/** El color que se ve con opacidad sobre el fondo (para elegir el texto encima). */
function mixOn(c, bg, op) {
  if (!/^#|^rgb/i.test(String(c)) || !/^#|^rgb/i.test(String(bg))) return c;
  const a = hexToRgb(c), b = hexToRgb(bg);
  return rgbToHex(a.map((v, i) => v * op + b[i] * (1 - op)));
}
