// plotagents · base: plot(), configure() y pieles, sin ningún tipo de gráfico.
//
//   import { plot } from 'plotagents/types/line';   // base + líneas y áreas
//
// Cada archivo de src/types/ registra sus tipos sobre esta base. Es la entrada
// para un empaquetador sin tree-shaking: una isla del navegador que dibuja
// líneas no carga redes, mapas ni tablas.
import { themeFor, colorMap, deepMerge, isColor, fontSpec } from './theme.js';
import { withContext } from './context.js';
import { autoLocale } from './i18n.js';
import { ensureData, PlotError, fieldKind, uniq, num } from './data.js';
import { facet } from './facet.js';
import { parseDate } from './format.js';
import { inferType, TYPES, normalizeType } from './infer.js';
import { resolveColorScale } from './colorscales.js';
import { expandSkins, mergeSkins, cssVars, plotWithVars } from './skins.js';

// Los tipos se registran al importarse (src/types/*.js); el núcleo los trae todos.
export const RENDERERS = {};

/** Normaliza el spec: tipo inferido y datos como filas. */
export function resolve(spec = {}) {
  if (!spec || typeof spec !== 'object') throw new PlotError('El spec debe ser un objeto.', 'plot({ data: [...], x: "campo", y: "campo" })');
  const s = withDefaults(spec);
  // refLines / annotations: un objeto suelto vale como lista de uno.
  for (const k of ['refLines', 'annotations']) if (s[k] != null && !Array.isArray(s[k]) && typeof s[k] === 'object') s[k] = [s[k]];
  if (s.color && !s.series && typeof s.color === 'string' && !s.color.startsWith('#')) s.series = s.color;
  let type = s.type && s.type !== 'auto' ? String(s.type).trim().toLowerCase() : null;
  if (type) {
    const [t, extra] = normalizeType(type);
    type = t;
    for (const [k, v] of Object.entries(extra)) if (s[k] === undefined) s[k] = v;
  }
  if (!type) {
    const data = s.items || (!s.data && (Array.isArray(s.linkage) || typeof s.text === 'string' || Array.isArray(s.text))) ? [] : ensureData(s);
    type = inferType(s, data);
  }
  if (!RENDERERS[type]) {
    // Un tipo que existe pero no se importó (entrada liviana): se dice cuál importar.
    if (TYPES.includes(type)) {
      const where = ['choropleth', 'symbolmap', 'pointmap'].includes(type) ? 'plotagents/maps' : type === 'table' ? 'plotagents/table' : 'plotagents/core';
      throw new PlotError(`El tipo "${type}" no está cargado en esta entrada.`, `Importa '${where}' (o 'plotagents', que trae todo).`);
    }
    throw new PlotError(`Tipo de gráfico "${s.type}" no soportado.`, `Usa uno de: ${TYPES.join(', ')} o "auto".`);
  }
  s.type = type;
  // Idioma: `locale: "auto"` (y las tablas sin `locale`) lo reconocen del texto del spec.
  if (s.locale === 'auto' || (s.locale === undefined && type === 'table')) {
    s.locale = autoLocale(s, Array.isArray(s.data) ? s.data : []);
  }
  // Colormap divergente (RdBu, coolwarm…): centrada en 0 si los datos lo cruzan; si no, en el medio.
  const cs = resolveColorScale(s.colorScale ?? s.cmap ?? s.colormap);
  if (cs && cs.kind === 'diverging' && s.midpoint === undefined && s.diverging === undefined) {
    const vf = typeof s.colorScale === 'object' && s.colorScale.mid !== undefined ? null : s.value;
    if (typeof s.colorScale === 'object' && s.colorScale?.mid !== undefined) s.midpoint = +s.colorScale.mid;
    else if (vf && Array.isArray(s.data) && s.data.length && typeof s.data[0] === 'object') {
      const vs = s.data.map((r) => num(r[vf])).filter(Number.isFinite);
      if (vs.length) { let lo = Infinity, hi = -Infinity; for (const v of vs) { if (v < lo) lo = v; if (v > hi) hi = v; } s.midpoint = lo < 0 && hi > 0 ? 0 : (lo + hi) / 2; }
    } else s.diverging = true;
  }
  return s;
}

/**
 * Dibuja un gráfico y devuelve un SVG (texto). Funciona en Node y navegador.
 * Lanza PlotError con una pista de corrección si el spec no se puede dibujar.
 */
export function plot(spec) {
  // Colores `var(--x, respaldo)`: los decide la página; se calcula con el respaldo.
  // Van antes que las pieles: cada pasada dibuja todas las pieles con colores
  // literales, y una elección de contraste distinta entre pieles es sólo un color.
  if (spec && typeof spec === 'object') {
    // Antes de withDefaults: ahí `colors` sólo deja pasar colores literales.
    const full = { ...DEFAULTS, ...spec };
    const vars = cssVars(full);
    if (vars.size) return plotWithVars(full, vars, plot);
  }
  const skins = spec && (spec.skins !== undefined ? spec.skins : DEFAULTS.skins);
  if (Array.isArray(skins) && skins.length) {
    const [specs, whens] = expandSkins({ ...spec, skins });
    return mergeSkins(specs.map(plot), whens);
  }
  let s = resolve(spec);
  s = applyTime(s);
  s = applyExclude(s);
  const theme = themeFor(s);
  const textScale = Math.max(0.5, Math.min(4, +(s.textScale ?? s.fontScale ?? s.labelScale ?? 1) || 1));
  return withContext({ textScale }, () => {
    if (s.facet || s.col) return facet(s, theme, (p) => RENDERERS[s.type](p, themeFor(p)));
    return RENDERERS[s.type](s, theme);
  });
}

// ── Configuración global ──────────────────────────────────────────────────
const DEFAULTS = {};

/**
 * Valores por defecto para TODOS los gráficos (el spec siempre gana):
 *   configure({ font: 'Poppins', textScale: 1.5, locale: 'en', theme: 'noche', palette: 'okabe-ito' })
 * `font` acepta un nombre de Google Fonts, una pila CSS o { family, import }.
 * `textScale` multiplica todos los textos (1.5, 2…) y el layout se recalcula.
 * configure() sin argumentos devuelve la configuración actual; configure(null) la borra.
 */
export function configure(options) {
  if (options === null) { for (const k of Object.keys(DEFAULTS)) delete DEFAULTS[k]; return {}; }
  if (options) Object.assign(DEFAULTS, options);
  return { ...DEFAULTS };
}

function withDefaults(spec) {
  const s = { ...DEFAULTS, ...spec };
  // Colores fijados por entidad: solo colores CSS válidos (viajan a atributos y al tooltip).
  if (s.colors && typeof s.colors === 'object') s.colors = Object.fromEntries(Object.entries(s.colors).filter(([, c]) => isColor(c)));
  // Tema global + tema del spec: el del spec se fusiona en profundidad sobre el global.
  if (DEFAULTS.theme && spec.theme && typeof spec.theme === 'object' && spec.theme.extends === undefined) {
    s.theme = typeof DEFAULTS.theme === 'string' ? { ...spec.theme, extends: DEFAULTS.theme } : deepMerge(DEFAULTS.theme, spec.theme);
  }
  // `font`: atajo de theme.font (familia + URL para cargarla).
  const f = fontSpec(s.font);
  if (f) {
    const base = s.theme && typeof s.theme === 'object' ? s.theme : { extends: s.theme || undefined };
    s.theme = { ...base, font: { ...(base.font || {}), ...f } };
  }
  return s;
}

const TIME_AXIS = new Set(['line', 'area', 'ecdf']);

/** Valores ordenados del campo `time` (para sliders y animación). */
export function timeValues(spec) {
  const s = spec.type ? spec : resolve(spec);
  if (!s.time) return [];
  const data = ensureData(s);
  const k = fieldKind(data, s.time);
  const vals = uniq(data.map((r) => r[s.time]).filter((v) => v !== null && v !== undefined && v !== ''));
  return vals.sort((a, b) => (k === 'date' ? parseDate(a) - parseDate(b) : k === 'year' || k === 'number' ? num(a) - num(b) : 0));
}

/**
 * `time` (estilo d3plus): en gráficos que no tienen el tiempo en el eje x,
 * muestra un solo periodo (`timeValue`, por defecto el último). El periodo se
 * agrega a la bajada; en el navegador, render() suma un slider con "play".
 */
function applyTime(s) {
  if (!s.time || TIME_AXIS.has(s.type) || s.x === s.time) return s;
  const vals = timeValues(s);
  if (!vals.length) return s;
  const cur = s.timeValue ?? vals[vals.length - 1];
  const all = ensureData(s);
  const data = all.filter((r) => String(r[s.time]) === String(cur));
  const label = String(cur);
  // Periodo de comparación para variaciones (treemap y otros): el anterior, o el primero con compare: "first".
  const idx = vals.findIndex((v) => String(v) === String(cur));
  const pv = s.compare === 'first' ? vals[0] : s.compare !== undefined && s.compare !== 'previous' && s.compare !== false ? s.compare : vals[idx - 1];
  const _prev = s.compare !== false && pv !== undefined && String(pv) !== String(cur) ? { data: all.filter((r) => String(r[s.time]) === String(pv)), label: String(pv) } : undefined;
  return { ...s, data, colors: stableColors(s, all), subtitle: s.subtitle ? `${s.subtitle} · ${label}` : label, _time: { field: s.time, value: cur, values: vals }, _prev };
}

/** Campo que define las entradas de la leyenda (series, primer nivel, grupo…). */
function legendField(s) {
  if (Array.isArray(s.path) && s.path.length) return s.path[0];
  return s.series ?? s.hue ?? s.group ?? (['donut', 'pie'].includes(s.type) ? s.label ?? s.x : null) ?? (s.type === 'treemap' || s.type === 'sunburst' ? s.label ?? s.x : null);
}

/**
 * `exclude: ["Maule"]` (o shift + clic en la leyenda): quita esas entradas y
 * recalcula ejes, participaciones y layout con lo que queda. Los colores no
 * se mueven y las entradas excluidas siguen en la leyenda, apagadas.
 */
function applyExclude(s) {
  const ex = s.exclude == null || s.exclude === false ? [] : [].concat(s.exclude).map(String);
  if (!ex.length) return s;
  // Tabla ancha: y: ["ingresos", "costos"] → se excluyen columnas.
  if (Array.isArray(s.y) && !s.series && !s.hue) {
    const keep = s.y.filter((k) => !ex.includes(String(k)));
    if (!keep.length || keep.length === s.y.length) return s;
    const cmap = colorMap(s.y, themeFor(s), s.colors);
    return { ...s, y: keep, colors: { ...Object.fromEntries(cmap), ...(s.colors || {}) }, _excluded: s.y.filter((k) => ex.includes(String(k))) };
  }
  const f = legendField(s);
  if (!f || s.items) return s;
  const all = ensureData(s);
  if (!all.length || !(f in all[0])) return s;
  const keep = all.filter((r) => !ex.includes(String(r[f])));
  if (!keep.length || keep.length === all.length) return s;
  const present = new Set(all.map((r) => String(r[f])));
  return { ...s, data: keep, colors: { ...stableColors(s, all), ...(s.colors || {}) }, _excluded: ex.filter((v) => present.has(v)) };
}

/**
 * Colores fijos por entidad a lo largo de TODOS los periodos: al mover el
 * slider, "Minería" sigue siendo índigo aunque cambie su tamaño o su orden.
 */
function stableColors(s, all) {
  const idf = s.series ?? s.hue ?? (Array.isArray(s.path) ? s.path[0] : null) ?? s.group ?? s.from
    ?? (['donut', 'pie'].includes(s.type) ? s.label ?? s.x : null);
  if (!idf || !all.length || !(idf in all[0])) return s.colors;
  const vf = s.value ?? (typeof s.y === 'string' ? s.y : null);
  const tot = new Map();
  for (const r of all) {
    const k = String(r[idf]);
    tot.set(k, (tot.get(k) || 0) + (vf && Number.isFinite(num(r[vf])) ? Math.abs(num(r[vf])) : 1));
  }
  const keys = [...tot.keys()].sort((a, b) => tot.get(b) - tot.get(a));
  const cmap = colorMap(keys, themeFor(s), s.colors);
  return { ...Object.fromEntries(cmap), ...(s.colors || {}) };
}


/** Suma un tipo de gráfico (lo usan 'plotagents/maps' y 'plotagents/table'). */
export function registerRenderer(type, fn) {
  RENDERERS[type] = fn;
}

export { withDefaults };
export { registerTheme, themeFor, themes, palettes, ramps } from './theme.js';
export { makeFormat, formatNumber, formatCompact } from './format.js';
export { PlotError } from './data.js';
export { TYPES };
export default plot;
