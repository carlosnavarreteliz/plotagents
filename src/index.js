// plotagents · gráficos bellos con una sola llamada, pensados para agentes.
//
//   import { plot } from 'plotagents';
//   const svg = plot({ data, x: 'region', y: 'ventas', title: 'Biobío lidera las ventas' });
//
import { getTheme, themeFor, themes, palettes, ramps, FONT_CSS } from './theme.js';
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
import { heatmap } from './charts/heatmap.js';
import { sankey } from './charts/sankey.js';
import { kpi } from './charts/kpi.js';
import { ensureData, PlotError, fieldKind, uniq, num } from './data.js';
import { facet } from './facet.js';
import { parseDate } from './format.js';
import { inferType, TYPES, ALIASES, normalizeType } from './infer.js';
import { lint } from './lint.js';
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
};



/** Normaliza el spec: tipo inferido y datos como filas. */
export function resolve(spec = {}) {
  if (!spec || typeof spec !== 'object') throw new PlotError('El spec debe ser un objeto.', 'plot({ data: [...], x: "campo", y: "campo" })');
  const s = { ...spec };
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
  if (s.facet || s.col) return facet(s, theme, (p) => RENDERERS[s.type](p, themeFor(p)));
  return RENDERERS[s.type](s, theme);
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
  const data = ensureData(s).filter((r) => String(r[s.time]) === String(cur));
  const label = String(cur);
  return { ...s, data, subtitle: s.subtitle ? `${s.subtitle} · ${label}` : label, _time: { field: s.time, value: cur, values: vals } };
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
  const bundle = bundleSource();
  const safeJSON = (o) => JSON.stringify(o).replace(/</g, '\\u003c');
  const charts = list.map((s, i) => `<figure class="pa" id="pa-${i}">${plot(s)}</figure>` + (bundle ? `<script type="application/json" id="pa-spec-${i}">${safeJSON(s)}</script>` : '')).join('\n');
  const boot = bundle
    ? `<script>${bundle.replace(/<\/(script)/gi, '<\\/$1')}</script>\n<script>document.querySelectorAll('figure.pa').forEach(function(f,i){var s=JSON.parse(document.getElementById('pa-spec-'+i).textContent);plotagents.render(f,s);});</script>`
    : `<script>document.querySelectorAll('figure.pa').forEach(function(f){(${attachSource})(f)});</script>`;
  return `<!doctype html>
<html lang="${esc(lang)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<link rel="stylesheet" href="${FONT_CSS}">
<style>
:root{color-scheme:${dark ? 'dark' : 'light'}}
body{margin:0;background:${bg};font-family:'Mozilla Text',system-ui,sans-serif}
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
export function bundleSource() {
  try {
    const fs = globalThis.process?.getBuiltinModule?.('node:fs');
    if (!fs) return null;
    return fs.readFileSync(new URL('../dist/plotagents.js', import.meta.url), 'utf8');
  } catch {
    return null;
  }
}

_bind(plot, resolve);
export { render };

export { RENDERERS, ALIASES };
export { lint, schema, toolDefinition, themes, palettes, ramps, validatePalette, getTheme, themeFor, attach, PlotError, TYPES, squarify, makeFormat, formatNumber, formatCompact };
export default plot;
