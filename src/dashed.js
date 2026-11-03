// Formas "punteadas" (`dashed`): para marcar lo que no es un dato firme —
// estimaciones, proyecciones, cifras provisorias, territorios en disputa—
// sin inventar otro color. La forma conserva su tono, pero con un relleno
// rayado (franjas del color sobre una versión clara del mismo) y un contorno
// discontinuo. En líneas, el trazo se vuelve discontinuo (`dashedFrom` corta
// una serie en el punto donde empieza la proyección).
//
//   dashed: "Texas"                     → una categoría, serie o región
//   dashed: ["Texas", "Ohio"]           → varias
//   dashed: "provisional"               → un campo de los datos (filas con valor verdadero)
//   dashed: { field: "estado", equals: "estimado" }
//   dashedFrom: "2025"                  → desde ese x en adelante (líneas, áreas y columnas)
//   dashedLabel: "Estimación"           → entrada de leyenda y línea en el tooltip
import { el } from './svg.js';
import { ramp, readable } from './theme.js';

/** Trazos discontinuos: contornos cortos y finos; líneas algo más largas. */
export const DASH = { outline: '4 2.5', line: '5 6', legend: '3.5 2.5' };

const TRUE = /^(true|1|s[ií]|yes|y|x|✓)$/i;
const truthy = (v) => v === true || v === 1 || (typeof v === 'string' && TRUE.test(v.trim()));

/**
 * Devuelve una función (clave, serie?) → boolean, o null si no hay `dashed`.
 * `keyField` y `seriesField` dicen qué campos identifican cada forma.
 */
export function dashedMatcher(spec, data, keyField, seriesField, norm = String) {
  const d = spec.dashed;
  if (d === undefined || d === null || d === false) return null;
  if (d === true) return () => true;
  const row0 = data && data[0];
  const field = typeof d === 'object' && !Array.isArray(d) ? d.field : typeof d === 'string' && row0 && d in row0 ? d : null;
  if (field) {
    const eq = typeof d === 'object' ? d.equals ?? d.value : undefined;
    const pairs = new Set();
    for (const r of data) {
      const hit = eq !== undefined ? [].concat(eq).map(String).includes(String(r[field])) : truthy(r[field]);
      if (hit) pairs.add(norm(r[keyField]) + '\u0000' + (seriesField ? norm(r[seriesField]) : ''));
    }
    return (k, s) => pairs.has(norm(k) + '\u0000' + (seriesField ? norm(s ?? '') : ''));
  }
  const keys = new Set([].concat(d).map(norm));
  return (k, s) => keys.has(norm(k)) || (s !== undefined && s !== null && keys.has(norm(s)));
}

/** ¿El valor x está en el tramo proyectado (x ≥ dashedFrom)? */
export function fromTest(spec, toNum) {
  if (spec.dashedFrom === undefined || spec.dashedFrom === null) return null;
  const t = toNum(spec.dashedFrom);
  return Number.isFinite(t) ? (x) => Number.isFinite(x) && x >= t : null;
}

const isHex = (c) => /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(String(c || ''));

/**
 * Fábrica de rellenos rayados, uno por color. `fill(c)` da el url(#…) y
 * `defs()` los <pattern> que hay que poner en el SVG.
 */
export function hatcher(theme, id) {
  const pats = new Map();
  return {
    fill(color) {
      if (!pats.has(color)) pats.set(color, `${id}-h${pats.size}`);
      return `url(#${pats.get(color)})`;
    },
    /** Contorno: el mismo tono, con al menos 3:1 contra el fondo (WCAG, gráficos). */
    stroke(color) { return isHex(color) ? readable(color, theme, 3) : color; },
    defs() {
      return [...pats].map(([c, pid]) => pattern(pid, c, theme)).join('');
    },
    get size() { return pats.size; },
  };
}

function pattern(pid, color, theme) {
  const bg = isHex(color) && isHex(theme.surface) ? ramp([theme.surface, color], theme.mode === 'dark' ? 0.3 : 0.22) : null;
  return el('pattern', { id: pid, width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, [
    bg ? el('rect', { width: 6, height: 6, fill: bg }) : el('rect', { width: 6, height: 6, fill: color, fillOpacity: 0.22 }),
    el('rect', { width: 2.6, height: 6, fill: color }),
  ]);
}

/** Atributos de una forma punteada: relleno rayado + contorno discontinuo. */
export function dashedAttrs(H, color, { width = 1.25 } = {}) {
  return { fill: H.fill(color), stroke: H.stroke(color), strokeWidth: width, strokeDasharray: DASH.outline, 'data-dashed': '1', 'data-color': color };
}

const T = (locale, es, en) => (String(locale || 'es').startsWith('en') ? en : es);
/** Texto por defecto para la leyenda cuando el agente no da `dashedLabel`. */
export const dashedDefaultLabel = (locale) => T(locale, 'Estimado', 'Estimate');
