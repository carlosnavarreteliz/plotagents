// plotagents · gráficos bellos con una sola llamada, pensados para agentes.
//
//   import { plot } from 'plotagents';
//   const svg = plot({ data, x: 'region', y: 'ventas', title: 'Biobío lidera las ventas' });
//
import { getTheme, themeFor, themes, palettes, ramps, colorMap, fontSpec, deepMerge, registerTheme, isColor, FONT_CSS } from './theme.js';
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
import { gantt } from './charts/gantt.js';
import { wordcloud, countWords } from './charts/wordcloud.js';
import { choropleth, symbolMap, mapSprite } from './charts/choropleth.js';
import { pointmap, embedTiles, TILE_PROVIDERS } from './charts/pointmap.js';
import { registerGeo, getGeo, registeredGeo, toFeatureCollection } from './geo/registry.js';
// Mapas incluidos (Chile por regiones, estados de EE. UU. y países del mundo): listos sin importar nada más.
// El bundle del navegador los separa en dist/plotagents-geo.js.
import './geo/chile.js';
import './geo/world.js';
import './geo/usa.js';
import { heatmap } from './charts/heatmap.js';
import { corr, pairplot, correlations } from './charts/corr.js';
import { sankey } from './charts/sankey.js';
import { kpi } from './charts/kpi.js';
import { table } from './charts/table.js';
import { autoLocale, detectLocale } from './i18n.js';
import { ensureData, PlotError, fieldKind, uniq, num, toRows, packTable } from './data.js';
import { facet } from './facet.js';
import { parseDate } from './format.js';
import { inferType, TYPES, ALIASES, normalizeType } from './infer.js';
import { lint, _setProbe } from './lint.js';
import { schema, toolDefinition, dashboardSchema } from './schema.js';
import { attach, attachSource } from './interact.js';
import { render, _bind, loadGeo } from './runtime.js';
import { renderDashboard, planDashboard, mountDashboard, packRows, balancedRows, _bindDashboard } from './dashboard.js';
import { dashboard, lintDashboard, safeDashboard } from './dashboard-node.js';
import { makeFormat, formatNumber, formatCompact } from './format.js';
import { esc } from './svg.js';
import { pageBundle } from './page-bundle.js';
import { expandSkins, mergeSkins, cssVars, plotWithVars } from './skins.js';
import { resolveColorScale, colorScaleNames, interpolate as interpolateColor, COLORMAPS, QUALITATIVE } from './colorscales.js';

import './core.js';
import { RENDERERS, resolve, plot, configure, timeValues, withDefaults, registerRenderer } from './base.js';

// La entrada completa: el núcleo más mapas (con sus geometrías) y tablas.
registerRenderer('table', (s, t) => table(s, t));
registerRenderer('choropleth', (s, t) => choropleth(s, t));
registerRenderer('symbolmap', (s, t) => symbolMap(s, t));
registerRenderer('pointmap', (s, t) => pointmap(s, t));
export { resolve, plot, configure, timeValues, registerRenderer };

/**
 * Versión que nunca lanza: ideal como herramienta de un agente.
 * Devuelve { ok, svg, type, description, errors, warnings, suggestions }.
 */
export function safePlot(spec) {
  const report = lint(spec || {});
  try {
    const svg = plot(spec);
    // Se dibujó (con valores de respaldo), pero los errores de lint igual se devuelven: ok = sin errores.
    return { ok: report.errors.length === 0, svg, type: report.type, description: describeSvg(svg), errors: report.errors, warnings: report.warnings, suggestions: report.suggestions };
  } catch (e) {
    const errors = report.errors.length ? report.errors : [{ code: 'render', message: e.message.split('\n')[0], fix: e.hint || 'Revisa los campos del spec contra el schema (`toolDefinition()`): textos donde van textos, listas donde van listas.' }];
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
  const themesOf = list.map((s) => themeFor(withDefaults(s)));
  const dark = themesOf.every((t) => t.mode === 'dark');
  // Fondo de la página = fondo del tema (también uno global de configure()).
  const bg = themesOf.every((t) => t.surface === themesOf[0].surface) ? themesOf[0].surface : dark ? '#0B0F2B' : '#FCFBF9';
  const bundle = pageScript(list);
  const safeJSON = (o) => JSON.stringify(o).replace(/</g, '\\u003c');
  // Datos incrustados una sola vez por tabla (varios gráficos de la misma tabla
  // la comparten) y como encabezado + filas: los nombres de campo no se repiten.
  const tables = [], tableIdx = new Map();
  const embed = (s) => {
    if (!s || typeof s !== 'object' || s.data === undefined || typeof s.data === 'string') return s;
    const rows = toRows(s.data);
    if (!Array.isArray(rows)) return s;
    if (!tableIdx.has(rows)) { tableIdx.set(rows, tables.length); tables.push(packTable(rows)); }
    const { data: _d, ...rest } = s;
    return { ...rest, _paData: tableIdx.get(rows) };
  };
  const charts = list.map((s, i) => `<figure class="pa" id="pa-${i}">${plot(s)}</figure>` + (bundle ? `<script type="application/json" id="pa-spec-${i}">${safeJSON(embed(s))}</script>` : '')).join('\n');
  const boot = bundle
    ? `<script>${bundle.replace(/<\/(script)/gi, '<\\/$1')}</script>\n<script type="application/json" id="pa-data">${safeJSON(tables)}</script>\n<script>(function(){var D=JSON.parse(document.getElementById('pa-data').textContent);document.querySelectorAll('figure.pa').forEach(function(f,i){var s=JSON.parse(document.getElementById('pa-spec-'+i).textContent);if(s._paData!=null){s.data=D[s._paData];delete s._paData;}plotagents.render(f,s);});})();</script>`
    : `<script>document.querySelectorAll('figure.pa').forEach(function(f){(${attachSource})(f)});</script>`;
  return `<!doctype html>
<html lang="${esc(lang)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
${[...new Set([FONT_CSS, ...list.map((s) => themeFor(withDefaults(s)).font?.import).filter(Boolean)])].map((u) => `<link rel="stylesheet" href="${esc(u)}">`).join('\n')}
<style>
:root{color-scheme:${dark ? 'dark' : 'light'}}
body{margin:0;background:${cssText(bg)};font-family:${cssText(themeFor(withDefaults(list[0])).font?.family || "'Mozilla Text',system-ui,sans-serif")}}
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

/** Texto dentro de <style>: las entidades HTML no se decodifican ahí (esc() rompería las comillas), así que se quitan los caracteres que cierran la regla o la etiqueta. */
const cssText = (v) => String(v ?? '').replace(/[<>{};\\&]/g, '');

/**
 * Script para incrustar en una página: solo los módulos de sus tipos de gráfico
 * y geometrías (una página con una línea pesa una fracción de la biblioteca).
 * Si algo no se puede resolver, la biblioteca entera, como antes.
 */
function pageScript(specs, { dashboard = false } = {}) {
  const lib = bundleSource();
  if (!lib) return null;
  try {
    const resolved = specs.map((s) => resolve(s));
    const light = pageBundle(resolved, (f) => (f === 'plotagents.js' ? lib : bundleSource(f)), { dashboard });
    if (light) return light;
  } catch { /* abajo: la biblioteca entera */ }
  const needsGeo = specs.some((s) => { try { return ['choropleth', 'symbolmap', 'pointmap'].includes(resolve(s).type); } catch { return false; } });
  return needsGeo ? lib + '\n' + (bundleSource('plotagents-geo.js') || '') : lib;
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
_bindDashboard({ plot, resolve, lint, bundleSource, pageScript, resolveDefaults: withDefaults });
_setProbe((s) => plot(s));
export { render };

export { countWords, dashboardSchema, detectLocale, correlations, toRows, packTable };
export { resolveColorScale, colorScaleNames, interpolateColor, COLORMAPS, QUALITATIVE };
export { dashboard, renderDashboard, planDashboard, lintDashboard, safeDashboard, mountDashboard, packRows, balancedRows };
export { RENDERERS, ALIASES, registerGeo, getGeo, registeredGeo, toFeatureCollection, loadGeo, mapSprite };
export { registerTheme, withDefaults as resolveDefaults, embedTiles, TILE_PROVIDERS };
export { lint, schema, toolDefinition, themes, palettes, ramps, validatePalette, getTheme, themeFor, attach, PlotError, TYPES, squarify, makeFormat, formatNumber, formatCompact };
export default plot;
