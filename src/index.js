// plotagents · gráficos bellos con una sola llamada, pensados para agentes.
//
//   import { plot } from 'plotagents';
//   const svg = plot({ data, x: 'region', y: 'ventas', title: 'Biobío lidera las ventas' });
//
import { getTheme, themeFor, themes, palettes, ramps, colorMap, fontSpec, FONT_CSS, safeColorMap, safeFontFamily, safeUrl } from './theme.js';
import { withContext } from './context.js';
import { validatePalette } from './palette.js';
import { bar } from './charts/bar.js';
import { line } from './charts/line.js';
import { scatter } from './charts/scatter.js';
import { treemap, squarify } from './charts/treemap.js';
import { donut, pie } from './charts/donut.js';
import { sunburst } from './charts/sunburst.js';
import { hist, kde, ecdf } from './charts/dist.js';
import { regplot, residplot, jointplot } from './charts/regplot.js';
import { box, violin, strip, swarm, point } from './charts/categorical.js';
import { radar } from './charts/radar.js';
import { network } from './charts/network.js';
import { chord } from './charts/chord.js';
import { pyramid } from './charts/pyramid.js';
import { flowchart } from './charts/flowchart.js';
import { choropleth, symbolMap } from './charts/choropleth.js';
import { registerGeo, getGeo, registeredGeo } from './geo/registry.js';
// Mapas incluidos (Chile por regiones y países del mundo): listos sin importar nada más.
// El bundle del navegador los separa en dist/plotagents-geo.js.
import './geo/chile.js';
import './geo/world.js';
import { heatmap } from './charts/heatmap.js';
import { sankey } from './charts/sankey.js';
import { kpi } from './charts/kpi.js';
import { ensureData, PlotError, fieldKind, uniq, num } from './data.js';
import { facet } from './facet.js';
import { parseDate } from './format.js';
import { inferType, TYPES, ALIASES, normalizeType } from './infer.js';
import { lint, _setProbe } from './lint.js';
import { schema, toolDefinition } from './schema.js';
import { attach, attachSource } from './interact.js';
import { render, _bind } from './runtime.js';
import { makeFormat, formatNumber, formatCompact } from './format.js';
import { esc } from './svg.js';

const RENDERERS = {
  bar: (s, t) => bar(s, t),
  column: (s, t) => bar({ ...s, horizontal: false }, t),
  count: (s, t) => bar({ aggregate: 'count', ...s }, t),
  line: (s, t) => line(s, t, 'line'),
  area: (s, t) => line(s, t, 'area'),
  scatter: (s, t) => scatter(s, t),
  bubble: (s, t) => scatter(s, t),
  treemap: (s, t) => treemap(s, t),
  sunburst: (s, t) => sunburst(s, t),
  donut: (s, t) => donut(s, t),
  pie: (s, t) => pie(s, t),
  heatmap: (s, t) => heatmap(s, t),
  sankey: (s, t) => sankey(s, t),
  kpi: (s, t) => kpi(s, t),
  hist: (s, t) => hist(s, t),
  kde: (s, t) => kde(s, t),
  ecdf: (s, t) => ecdf(s, t),
  regplot: (s, t) => regplot(s, t),
  residplot: (s, t) => residplot(s, t),
  jointplot: (s, t) => jointplot(s, t),
  box: (s, t) => box(s, t),
  violin: (s, t) => violin(s, t),
  strip: (s, t) => strip(s, t),
  swarm: (s, t) => swarm(s, t),
  point: (s, t) => point(s, t),
  radar: (s, t) => radar(s, t),
  network: (s, t) => network(s, t),
  chord: (s, t) => chord(s, t),
  pyramid: (s, t) => pyramid(s, t),
  flowchart: (s, t) => flowchart(s, t),
  choropleth: (s, t) => choropleth(s, t),
  symbolmap: (s, t) => symbolMap(s, t),
};



/** Normaliza el spec: tipo inferido y datos como filas. */
export function resolve(spec = {}) {
  if (!spec || typeof spec !== 'object') throw new PlotError('El spec debe ser un objeto.', 'plot({ data: [...], x: "campo", y: "campo" })');
  const s = withDefaults(spec);
  if (s.color && !s.series && typeof s.color === 'string' && !s.color.startsWith('#')) s.series = s.color;
  let type = s.type && s.type !== 'auto' ? String(s.type).toLowerCase() : null;
  if (type) {
    const [t, extra] = normalizeType(type);
    type = t;
    for (const [k, v] of Object.entries(extra)) if (s[k] === undefined) s[k] = v;
  }
  if (!type) {
    const data = s.items ? [] : ensureData(s);
    type = inferType(s, data);
  }
  if (!RENDERERS[type]) throw new PlotError(`Tipo de gráfico "${s.type}" no soportado.`, `Usa uno de: ${TYPES.join(', ')} o "auto".`);
  s.type = type;
  return s;
}

/**
 * Dibuja un gráfico y devuelve un SVG (texto). Funciona en Node y navegador.
 * Lanza PlotError con una pista de corrección si el spec no se puede dibujar.
 */
export function plot(spec) {
  let s = resolve(spec);
  s = applyTime(s);
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
  if (options && typeof options === 'object') {
    for (const [k, v] of Object.entries(options)) if (k !== '__proto__' && k !== 'constructor' && k !== 'prototype') DEFAULTS[k] = v;
  }
  return { ...DEFAULTS };
}

function withDefaults(spec) {
  const s = { ...DEFAULTS, ...spec };
  // Colores por entidad: saneados y sin prototipo (una categoría "toString" no hereda una función).
  if (s.colors !== undefined) s.colors = safeColorMap(s.colors);
  if (typeof s.fontFamily === 'string') s.fontFamily = safeFontFamily(s.fontFamily, undefined);
  if (DEFAULTS.theme && typeof DEFAULTS.theme === 'object' && spec.theme && typeof spec.theme === 'object') s.theme = { ...DEFAULTS.theme, ...spec.theme };
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
  return safeColorMap({ ...Object.fromEntries(cmap), ...(s.colors || {}) });
}

/**
 * Versión que nunca lanza: ideal como herramienta de un agente.
 * Devuelve { ok, svg, type, description, errors, warnings, suggestions }.
 */
export function safePlot(spec) {
  const report = lint(spec || {});
  try {
    const svg = plot(spec);
    return { ok: true, svg, type: report.type, description: describeSvg(svg), errors: [], warnings: report.warnings, suggestions: report.suggestions };
  } catch (e) {
    const errors = report.errors.length ? report.errors : [{ code: 'render', message: e.message.split('\n')[0], fix: e.hint }];
    return { ok: false, svg: null, type: report.type, description: '', errors, warnings: report.warnings, suggestions: report.suggestions };
  }
}

/** Descripción en texto del gráfico (también va en <desc> del SVG). */
export function describe(spec) {
  return describeSvg(plot(spec));
}

function describeSvg(svg) {
  const m = /<desc[^>]*>([\s\S]*?)<\/desc>/.exec(svg);
  return m ? m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'") : '';
}

/**
 * Página HTML autónoma (un archivo) con uno o varios gráficos interactivos:
 * tooltips, slider temporal y navegación por niveles. Incluye la biblioteca
 * en línea (dist/plotagents.js) cuando está disponible; si no, solo tooltips.
 */
export function toHTML(specs, { title = 'Gráficos', lang = 'es', columns = 1 } = {}) {
  const list = Array.isArray(specs) ? specs : [specs];
  const dark = list.every((s) => themeFor(s).mode === 'dark');
  const bg = dark ? '#0B0F2B' : '#FCFBF9';
  const needsGeo = list.some((s) => { try { return ['choropleth', 'symbolmap'].includes(resolve(s).type); } catch { return false; } });
  const bundle = bundleSource() && (needsGeo ? bundleSource() + '\n' + (bundleSource('plotagents-geo.js') || '') : bundleSource());
  const safeJSON = (o) => JSON.stringify(o).replace(/</g, '\\u003c');
  const charts = list.map((s, i) => `<figure class="pa" id="pa-${i}">${plot(s)}</figure>` + (bundle ? `<script type="application/json" id="pa-spec-${i}">${safeJSON(s)}</script>` : '')).join('\n');
  const boot = bundle
    ? `<script>${bundle.replace(/<\/(script)/gi, '<\\/$1')}</script>\n<script>document.querySelectorAll('figure.pa').forEach(function(f,i){var s=JSON.parse(document.getElementById('pa-spec-'+i).textContent);plotagents.render(f,s);});</script>`
    : `<script>document.querySelectorAll('figure.pa').forEach(function(f){(${attachSource})(f)});</script>`;
  return `<!doctype html>
<html lang="${esc(lang)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
${[...new Set([FONT_CSS, ...list.map((s) => safeUrl(themeFor(withDefaults(s)).font?.import)).filter(Boolean)])].map((u) => `<link rel="stylesheet" href="${esc(u)}">`).join('\n')}
<style>
:root{color-scheme:${dark ? 'dark' : 'light'}}
body{margin:0;background:${bg};font-family:${safeFontFamily(themeFor(withDefaults(list[0])).font?.family)}}
main{max-width:${columns > 1 ? 1500 : 820}px;margin:0 auto;padding:24px 16px;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,${columns > 1 ? 560 : 320}px),1fr));gap:24px}
figure.pa{margin:0;min-width:0}
figure.pa svg{width:100%;height:auto;display:block}
</style></head>
<body><main>
${charts}
</main>
${boot}
</body></html>`;
}

/** Código de la biblioteca en un archivo (para incrustar en HTML). */
export function bundleSource(file = 'plotagents.js') {
  try {
    const fs = globalThis.process?.getBuiltinModule?.('node:fs');
    if (!fs) return null;
    return fs.readFileSync(new URL('../dist/' + file, import.meta.url), 'utf8');
  } catch {
    return null;
  }
}

_bind(plot, resolve);
_setProbe((s) => plot(s));
export { render };

export { RENDERERS, ALIASES, registerGeo, getGeo, registeredGeo };
export { lint, schema, toolDefinition, themes, palettes, ramps, validatePalette, getTheme, themeFor, attach, PlotError, TYPES, squarify, makeFormat, formatNumber, formatCompact };
export default plot;
