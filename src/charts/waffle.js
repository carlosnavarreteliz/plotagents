// Waffle: una cuenta hecha cuadros. Cada cuadro es una unidad (una fila, o
// `unit` unidades de `value`), así que la parte se lee como un número de cosas y
// no sólo como una proporción. Los cuadros se llenan por filas, de izquierda a
// derecha, la serie más grande primero; con `facet`, una pared por valor.
//
// Si el total no cabe (más de `maxSquares` cuadros), cada cuadro pasa a valer
// una cantidad redonda (`unit`) y la leyenda lo dice; los cuadros por serie se
// reparten por restos mayores, así que siempre suman el total redondeado.
import { tipper } from '../tooltip.js';
import { el, g, tip } from '../svg.js';
import { makeFormat, formatNumber } from '../format.js';
import { colorMap } from '../theme.js';
import { ensureData, requireField, uniq, num, fieldsOf, fieldKind, PlotError, highlightSet } from '../data.js';
import { createFrame } from '../frame.js';
import { langOf } from '../i18n.js';

const NICE = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000, 20000, 25000, 50000, 100000];

export function waffle(spec, theme) {
  const locale = spec.locale || 'es';
  const en = langOf(locale) === 'en';
  const data = ensureData(spec);
  const TT = tipper(spec, data, locale);
  const fields = fieldsOf(data);
  const series = spec.series ?? spec.hue ?? spec.label ?? spec.x ?? fields.find((f) => fieldKind(data, f) === 'category');
  requireField(data, series, 'series');
  const valueF = spec.value ?? (typeof spec.y === 'string' ? spec.y : null);
  if (valueF) requireField(data, valueF, 'value');

  // Cuenta por serie: suma de `value`, o una unidad por fila.
  const tot = new Map();
  for (const r of data) {
    const k = String(r[series]);
    const v = valueF ? num(r[valueF]) : 1;
    if (!Number.isFinite(v) || v < 0) continue;
    tot.set(k, (tot.get(k) || 0) + v);
  }
  let keys = [...tot.keys()];
  if (Array.isArray(spec.order)) keys = [...spec.order.map(String).filter((k) => tot.has(k)), ...keys.filter((k) => !spec.order.map(String).includes(k))];
  else if (spec.sort !== 'none') keys.sort((a, b) => tot.get(b) - tot.get(a) || (a < b ? -1 : 1));
  const total = keys.reduce((s, k) => s + tot.get(k), 0);
  if (!(total > 0)) throw new PlotError(en ? 'The waffle has nothing to count.' : 'El waffle no tiene nada que contar.', en ? 'Pass rows, or a `value` field with positive numbers.' : 'Pasa filas, o un campo `value` con números positivos.');

  // Valor de cada cuadro.
  // Tope de cuadros: un `unit` diminuto (1e-6) o `maxSquares` enorme no deben agotar la memoria.
  const maxSq = Math.min(10000, Math.max(1, +spec.maxSquares || 400));
  const unit0 = spec.unit ?? NICE.find((u) => total / u <= maxSq) ?? Math.ceil(total / maxSq);
  const unit = +unit0 > 0 ? Math.max(+unit0, total / 10000) : NICE.find((u) => total / u <= maxSq) ?? Math.ceil(total / maxSq);
  const exact = keys.map((k) => tot.get(k) / unit);
  const squares = exact.map(Math.floor);
  let left = Math.round(total / unit) - squares.reduce((a, b) => a + b, 0);
  exact.map((v, i) => [v - Math.floor(v), i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]).forEach(([, i]) => { if (left > 0) { squares[i]++; left--; } });
  const n = squares.reduce((a, b) => a + b, 0);

  const fmt = makeFormat(spec.format ?? 'integer', locale, [...tot.values()]);
  const share = (v) => formatNumber((v / total) * 100, 1, locale, true) + '%';
  const cmap = colorMap(keys, theme, spec.colors);
  const hl = highlightSet(spec);
  const colorOf = (k) => (hl && !hl.has(k) ? theme.dim : cmap.get(k));
  const unitTxt = unit === 1 ? '' : en ? `1 square = ${fmt(unit)}` : `1 cuadro = ${fmt(unit)}`;
  const legend = spec.legend === false ? [] : [
    ...keys.map((k) => ({ label: `${k} · ${fmt(tot.get(k))}`, color: colorOf(k), shape: 'square', value: k })),
    ...(unitTxt ? [{ label: unitTxt, color: theme.muted, shape: 'none' }] : []),
  ];

  const frame = createFrame(spec, theme, { height: 300 });
  const area = frame.layout(legend);
  const cols = Math.max(1, Math.round(spec.columns ?? (n <= 100 ? 10 : n <= 200 ? 20 : 25)));
  const rowsN = Math.ceil(n / cols);
  const gap = theme.marks?.gap ?? 2;
  const cell = Math.max(3, Math.min(spec.cellSize ?? 22, area.w / cols, spec.height !== undefined ? area.h / rowsN : Infinity));
  const s = cell - gap;
  // `cellRadius`: el radio de las esquinas en px (0 = cuadros rectos); por
  // omisión el de las barras del tema, con un tope de un cuarto del cuadro.
  const cr = spec.cellRadius;
  const rad = cr !== undefined && cr !== null && Number.isFinite(+cr) ? Math.max(0, Math.min(+cr, s / 2)) : Math.min(theme.marks?.barRadius ?? 4, s / 4);
  if (spec.height === undefined) frame.setHeight(area.y + rowsN * cell + frame.chrome);

  // Un path por serie (una corrida de cuadros), con su tooltip.
  const body = [];
  let idx = 0;
  // `perSquare`: cada cuadro es su propia marca, con el tooltip de su fila (una
  // verificación, una persona). Sólo cuando un cuadro es una unidad: con
  // `unit` > 1 un cuadro no es una fila y se vuelve a un path por serie.
  if (spec.perSquare && unit === 1) {
    const rowsOf = new Map(keys.map((k) => [k, []]));
    for (const r of data) {
      const k = String(r[series]);
      const v = valueF ? num(r[valueF]) : 1;
      if (!rowsOf.has(k) || !Number.isFinite(v) || v < 0) continue;
      for (let j = 0; j < Math.round(v); j++) rowsOf.get(k).push(r);
    }
    keys.forEach((k, i) => {
      const list = rowsOf.get(k);
      for (let j = 0; j < squares[i]; j++, idx++) {
        const cx = area.x + (idx % cols) * cell, cy = area.y + Math.floor(idx / cols) * cell;
        // Un <rect> por cuadro (con rx si va redondeado): la misma figura que
        // el path de arcos, en la mitad de bytes, y `rect:hover` lo alcanza.
        const sq = el('rect', { x: cx, y: cy, width: s, height: s, rx: rad > 0.5 ? rad : undefined, fill: colorOf(k) });
        const row = list[Math.min(j, list.length - 1)];
        body.push(g({ class: 'pa-m', 'data-tip': TT(row ? [row] : { [series]: k }, k, `${fmt(tot.get(k))} (${share(tot.get(k))})`), 'data-color': colorOf(k) }, [sq]));
      }
    });
  } else keys.forEach((k, i) => {
    const d = [];
    for (let j = 0; j < squares[i]; j++, idx++) {
      const cx = area.x + (idx % cols) * cell, cy = area.y + Math.floor(idx / cols) * cell;
      d.push(rad > 0.5
        ? `M${(cx + rad).toFixed(2)},${cy.toFixed(2)}h${(s - 2 * rad).toFixed(2)}a${rad},${rad} 0 0 1 ${rad},${rad}v${(s - 2 * rad).toFixed(2)}a${rad},${rad} 0 0 1 ${-rad},${rad}h${(2 * rad - s).toFixed(2)}a${rad},${rad} 0 0 1 ${-rad},${-rad}v${(2 * rad - s).toFixed(2)}a${rad},${rad} 0 0 1 ${rad},${-rad}Z`
        : `M${cx.toFixed(2)},${cy.toFixed(2)}h${s.toFixed(2)}v${s.toFixed(2)}h${(-s).toFixed(2)}Z`);
    }
    if (!d.length) return;
    body.push(g({ class: 'pa-m', 'data-tip': TT({ [series]: k }, k, `${fmt(tot.get(k))} (${share(tot.get(k))})`, unitTxt ? `${squares[i]} × ${fmt(unit)}` : '') }, [el('path', { d: d.join(''), fill: colorOf(k) })]));
  });

  const big = keys[0];
  const desc = en
    ? `Waffle of ${fmt(total)} in ${keys.length} groups${unitTxt ? ` (${unitTxt})` : ''}. Largest: ${big}, ${fmt(tot.get(big))} (${share(tot.get(big))}).`
    : `Waffle de ${fmt(total)} en ${keys.length} grupos${unitTxt ? ` (${unitTxt})` : ''}. Mayor: ${big}, ${fmt(tot.get(big))} (${share(tot.get(big))}).`;
  return frame.finish(body, { desc, type: 'waffle' });
}
