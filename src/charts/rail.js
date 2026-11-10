// Riel: una fila de una distribución, del tamaño de una celda de tabla.
//
// Como `spark`, es una marca sin marco (sin título, ejes ni fuente) para ir
// dentro de una tabla HTML que el sitio ya tiene —con sus enlaces, íconos,
// notas y su ficha de teléfono—: sólo reemplaza el SVG dibujado a mano. Lo
// mismo que la columna `range` de `type: "table"`, con el mismo código
// (src/rail.js): mínimo–máximo como línea, la banda del medio, la mediana,
// el valor de la fila como punto y cualquier número de referencias, cada una
// con su rótulo en el tooltip.
//
// Escala: de punta a punta de lo dibujado; con `clip`, de mínimo a máximo, y
// con `domain`, la que se le dé (p5–p95). Lo que se sale de una escala
// recortada no la estira: es un chevrón en ese extremo. Sin mínimo y máximo
// (ni `domain`) no hay riel: se escribe la cifra (`fallback: "value"`) o
// nada (`fallback: "none"`), nunca un punto suelto que parezca un rango.
import { tipper } from '../tooltip.js';
import { el, g, text } from '../svg.js';
import { makeFormat } from '../format.js';
import { ensureData, num, humanize } from '../data.js';
import { createFrame } from '../frame.js';
import { langOf } from '../i18n.js';
import { railAccessors, railAccessor, railValues, railExtent, railMarks, railTip, textOf } from '../rail.js';

const F = Number.isFinite;

export function rail(spec, theme) {
  const locale = spec.locale || 'es';
  const en = langOf(locale) === 'en';
  // Una sola fila: la primera de `data`, o ninguna si todo viene como número.
  const data = Array.isArray(spec.data) && spec.data.length ? ensureData(spec) : [];
  const row = data[0] ?? {};
  const vKey = spec.value ?? spec.x ?? spec.y;
  const v = railAccessor(vKey)(row);
  const acc = railAccessors(spec);
  const vals = railValues(acc, row);
  const hasRange = F(vals.min) && F(vals.max);

  const frame = createFrame(spec, theme, { chrome: false, width: 160, height: 18, fixedHeight: true, minWidth: 24, minHeight: 8, padding: 0 });
  const W = frame.width, H = frame.height;
  const my = H / 2;
  // Tamaños a la medida del alto: a 18 px, los de la columna `range` de una tabla.
  const ref = Math.max(2, Math.min(8, my - 1));
  const sizes = {
    ref, median: Math.max(1.5, Math.min(6, ref - 2)), band: Math.max(1.5, Math.min(4, ref / 2)),
    dot: spec.dotRadius ?? Math.max(2, Math.min(4.5, my - 1.5)), rail: Math.max(1, Math.min(2, H / 9)),
  };
  // Margen a los lados: el punto entero y el chevrón (7 px) caben dentro.
  const inset = Math.max(Math.ceil(sizes.dot + 1), 6);
  const x0 = inset, w = Math.max(4, W - inset * 2);

  const all = railExtent(v, vals);
  const fmt = makeFormat(spec.format, locale, all);
  const s = F(v) ? fmt(v) : '';
  const label = textOf(spec.valueLabel, row) ?? (typeof vKey === 'string' ? humanize(vKey) : en ? 'Value' : 'Valor');
  const TT = tipper(spec, data, locale);

  // La escala: `domain` (recortada), `clip` (mínimo–máximo) o todo lo dibujado.
  let a, b, clipped = false;
  if (vals.domain) { [a, b] = vals.domain; clipped = true; }
  else if (hasRange && spec.clip) { a = Math.min(vals.min, vals.max); b = Math.max(vals.min, vals.max); clipped = b > a; }
  else if (hasRange) { a = Math.min(...all); b = Math.max(...all); }

  const body = [];
  let desc;
  if (a === undefined) {
    // Sin riel: la cifra sola (o nada).
    if (spec.fallback !== 'none' && s) {
      const size = Math.max(9, Math.min(12.5, H * 0.72));
      body.push(text(spec.align === 'right' ? W - 1 : 1, my + size * 0.36, s, { fill: theme.ink, fontSize: size, fontWeight: 500, textAnchor: spec.align === 'right' ? 'end' : null }));
    }
    desc = s ? `${label}: ${s}` : '';
  } else {
    const colors = { rail: spec.colors?.rail, band: spec.colors?.band, median: spec.colors?.median, ref: spec.colors?.ref };
    const dot = spec.colors?.value ?? (typeof spec.color === 'string' && spec.color ? spec.color : theme.categorical[0]);
    const marks = railMarks({ v, vals, a, b, x0, w, my, clipped, track: !hasRange, theme, colors, dot, sizes });
    body.push(...marks.out);
    const tipText = railTip({ en, label, s: s || '—', fr: fmt, vals, row, past: marks.past, scale: clipped ? [a, b] : null,
      labels: { band: spec.bandLabel, median: spec.medianLabel, min: spec.minLabel, max: spec.maxLabel, domain: spec.domainLabel } });
    desc = tipText.split('\n').join('; ') + '.';
    // Una sola zona de tooltip para toda la marca: la celda entera responde.
    const head = spec.title ?? '';
    body.push(g({ class: 'pa-m', 'data-tip': TT(data.length ? [row] : null, head, ...tipText.split('\n')) }, [
      el('rect', { x: 0, y: 0, width: W, height: H, fill: 'transparent' }),
    ]));
  }
  return frame.finish(body, { desc, type: 'rail' });
}
