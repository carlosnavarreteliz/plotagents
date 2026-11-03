/*! plotagents 0.5.0 · MIT · https://github.com/carlosnavarreteliz/plotagents */
(function (global) {
'use strict';
var __defs = {}, __cache = {};
function __def(id, fn) { __defs[id] = fn; }
function __req(id) { if (!__cache[id]) { __cache[id] = { loading: true }; __cache[id] = __defs[id](); } return __cache[id]; }
__def("src/index.js", function () {
const { getTheme, themeFor, themes, palettes, ramps, colorMap, fontSpec, FONT_CSS } = __req("src/theme.js");
const { withContext } = __req("src/context.js");
const { validatePalette } = __req("src/palette.js");
const { bar } = __req("src/charts/bar.js");
const { line } = __req("src/charts/line.js");
const { scatter } = __req("src/charts/scatter.js");
const { treemap, squarify } = __req("src/charts/treemap.js");
const { donut, pie } = __req("src/charts/donut.js");
const { sunburst } = __req("src/charts/sunburst.js");
const { hist, kde, ecdf } = __req("src/charts/dist.js");
const { regplot, residplot, jointplot } = __req("src/charts/regplot.js");
const { box, violin, strip, swarm, point } = __req("src/charts/categorical.js");
const { radar } = __req("src/charts/radar.js");
const { network } = __req("src/charts/network.js");
const { chord } = __req("src/charts/chord.js");
const { pyramid } = __req("src/charts/pyramid.js");
const { flowchart } = __req("src/charts/flowchart.js");
const { choropleth, symbolMap } = __req("src/charts/choropleth.js");
const { registerGeo, getGeo, registeredGeo } = __req("src/geo/registry.js");



const { heatmap } = __req("src/charts/heatmap.js");
const { sankey } = __req("src/charts/sankey.js");
const { kpi } = __req("src/charts/kpi.js");
const { ensureData, PlotError, fieldKind, uniq, num } = __req("src/data.js");
const { facet } = __req("src/facet.js");
const { parseDate } = __req("src/format.js");
const { inferType, TYPES, ALIASES, normalizeType } = __req("src/infer.js");
const { lint, _setProbe } = __req("src/lint.js");
const { schema, toolDefinition } = __req("src/schema.js");
const { attach, attachSource } = __req("src/interact.js");
const { render, _bind } = __req("src/runtime.js");
const { makeFormat, formatNumber, formatCompact } = __req("src/format.js");
const { esc } = __req("src/svg.js");

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
function resolve(spec = {}) {
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
function plot(spec) {
  let s = resolve(spec);
  s = applyTime(s);
  const theme = themeFor(s);
  const textScale = Math.max(0.5, Math.min(4, +(s.textScale ?? s.fontScale ?? s.labelScale ?? 1) || 1));
  return withContext({ textScale }, () => {
    if (s.facet || s.col) return facet(s, theme, (p) => RENDERERS[s.type](p, themeFor(p)));
    return RENDERERS[s.type](s, theme);
  });
}

const DEFAULTS = {};

/**
 * Valores por defecto para TODOS los gráficos (el spec siempre gana):
 *   configure({ font: 'Poppins', textScale: 1.5, locale: 'en', theme: 'noche', palette: 'okabe-ito' })
 * `font` acepta un nombre de Google Fonts, una pila CSS o { family, import }.
 * `textScale` multiplica todos los textos (1.5, 2…) y el layout se recalcula.
 * configure() sin argumentos devuelve la configuración actual; configure(null) la borra.
 */
function configure(options) {
  if (options === null) { for (const k of Object.keys(DEFAULTS)) delete DEFAULTS[k]; return {}; }
  if (options) Object.assign(DEFAULTS, options);
  return { ...DEFAULTS };
}

function withDefaults(spec) {
  const s = { ...DEFAULTS, ...spec };
  if (DEFAULTS.theme && typeof DEFAULTS.theme === 'object' && spec.theme && typeof spec.theme === 'object') s.theme = { ...DEFAULTS.theme, ...spec.theme };
  const f = fontSpec(s.font);
  if (f) {
    const base = s.theme && typeof s.theme === 'object' ? s.theme : { extends: s.theme || undefined };
    s.theme = { ...base, font: { ...(base.font || {}), ...f } };
  }
  return s;
}

const TIME_AXIS = new Set(['line', 'area', 'ecdf']);

/** Valores ordenados del campo `time` (para sliders y animación). */
function timeValues(spec) {
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
  return { ...Object.fromEntries(cmap), ...(s.colors || {}) };
}

/**
 * Versión que nunca lanza: ideal como herramienta de un agente.
 * Devuelve { ok, svg, type, description, errors, warnings, suggestions }.
 */
function safePlot(spec) {
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
function describe(spec) {
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
function toHTML(specs, { title = 'Gráficos', lang = 'es', columns = 1 } = {}) {
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
${[...new Set([FONT_CSS, ...list.map((s) => themeFor(withDefaults(s)).font?.import).filter(Boolean)])].map((u) => `<link rel="stylesheet" href="${esc(u)}">`).join('\n')}
<style>
:root{color-scheme:${dark ? 'dark' : 'light'}}
body{margin:0;background:${bg};font-family:${esc(themeFor(withDefaults(list[0])).font?.family || "'Mozilla Text',system-ui,sans-serif")}}
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
function bundleSource(file = 'plotagents.js') {
  try {
    const fs = globalThis.process?.getBuiltinModule?.('node:fs');
    if (!fs) return null;
    return fs.readFileSync(new URL('../dist/' + file, "about:blank"), 'utf8');
  } catch {
    return null;
  }
}

_bind(plot, resolve);
_setProbe((s) => plot(s));





return { "resolve": resolve, "plot": plot, "configure": configure, "timeValues": timeValues, "safePlot": safePlot, "describe": describe, "toHTML": toHTML, "bundleSource": bundleSource, "default": plot, "render": render, "RENDERERS": RENDERERS, "ALIASES": ALIASES, "registerGeo": registerGeo, "getGeo": getGeo, "registeredGeo": registeredGeo, "lint": lint, "schema": schema, "toolDefinition": toolDefinition, "themes": themes, "palettes": palettes, "ramps": ramps, "validatePalette": validatePalette, "getTheme": getTheme, "themeFor": themeFor, "attach": attach, "PlotError": PlotError, "TYPES": TYPES, "squarify": squarify, "makeFormat": makeFormat, "formatNumber": formatNumber, "formatCompact": formatCompact };
});
__def("src/theme.js", function () {

const FONT =
  "'Mozilla Text', 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const MONO = "'Fragment Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace";
const FONT_CSS =
  'https://fonts.googleapis.com/css2?family=Mozilla+Text:wght@400;500;600;700&display=swap';

const STRUCT = {
  font: { family: FONT, mono: MONO, import: FONT_CSS },
  type: { title: 22, subtitle: 14.5, label: 12, axis: 11.5, legend: 12.5, source: 11, titleWeight: 600 },
  marks: { barRadius: 4, barMax: 36, barMaxH: 22, lineWidth: 2.25, pointRadius: 4, gap: 2, ring: 2, areaOpacity: 0.12, bandOpacity: 0.16, dotOpacity: 0.85 },
  axes: { inside: true, grid: true },
  layout: { padding: 24, paddingSmall: 12 },
};

const papel = {
  name: 'papel',
  mode: 'light',
  surface: '#FCFBF9',
  ink: '#141A3F',
  lede: '#4A5070',
  muted: '#7C819C',
  grid: '#E9EBF3',
  axis: '#C9CDE0',
  tint: '#ECEEF8',
  tint2: '#D9DDF3',
  dim: '#CDD1E3', // marcas fuera de foco (highlight)
  other: '#A5AAC0', // "Otros"
  link: 0.32,
  categorical: [
    '#3A47B8', // índigo
    '#D42A5E', // magenta
    '#E8A33D', // ámbar
    '#1E9C89', // turquesa
    '#7B5CD6', // violeta
    '#B5562E', // óxido
    '#5BA3E0', // cielo
    '#8E9A2F', // oliva
  ],
  sequential: ['#EEF0FA', '#D9DDF3', '#B3BAE8', '#8590D8', '#5A66C7', '#3A47B8', '#26307F', '#141A3F'],
  diverging: ['#26307F', '#5A66C7', '#A9B0E2', '#ECEBE6', '#EFA9BE', '#D9557E', '#9E1D45'],
  status: { good: '#178A68', warning: '#B87A00', critical: '#C9531A' },
  ...STRUCT,
};

const noche = {
  name: 'noche',
  mode: 'dark',
  surface: '#0B0F2B',
  ink: '#F2F3FA',
  lede: '#B4BAE0',
  muted: '#8A90B4',
  grid: '#1B2147',
  axis: '#2E3666',
  tint: '#151A3D',
  tint2: '#1F2654',
  dim: '#2A3160',
  other: '#4A5280',
  link: 0.4,
  categorical: ['#6170E0', '#E63369', '#C4851C', '#22A892', '#9780E8', '#D06A3E', '#499BDA', '#909D2D'],
  sequential: ['#141A3F', '#1F2862', '#2C3888', '#3A47B8', '#6170E0', '#8E99EA', '#BEC5F3', '#E6E9FB'],
  diverging: ['#BEC5F3', '#7F8BE6', '#3F4CA8', '#2A2E48', '#A3294F', '#E8577F', '#F7B3C7'],
  status: { good: '#2BB38A', warning: '#E0A030', critical: '#E8743F' },
  ...STRUCT,
};

const themes = { papel, noche, light: papel, dark: noche };

const palettes = {
  cdia: papel.categorical,
  'cdia-noche': noche.categorical,
  'okabe-ito': ['#0072B2', '#E69F00', '#009E73', '#CC79A7', '#56B4E9', '#D55E00', '#F0E442', '#000000'],
  tableau10: ['#4E79A7', '#F28E2B', '#E15759', '#76B7B2', '#59A14F', '#EDC948', '#B07AA1', '#FF9DA7', '#9C755F', '#BAB0AC'],
  udec: ['#223C6A', '#E69B0A', '#D21428', '#5C7DB8'],
};
const ramps = {
  indigo: papel.sequential,
  magenta: ['#FBEAF0', '#F6CADA', '#EE9DBA', '#E46F98', '#D42A5E', '#A81F4A', '#7A1636', '#4D0E22'],
  teal: ['#E6F5F2', '#C2E8E1', '#8CD3C6', '#52BBA8', '#1E9C89', '#167A6B', '#0F5A4F', '#093B34'],
  amber: ['#FDF3E1', '#F9E0B5', '#F4C77E', '#EEAD4E', '#E8A33D', '#BF7F1F', '#8C5C14', '#5C3C0C'],
  'indigo-magenta': papel.diverging,
  'teal-rust': ['#0F5A4F', '#1E9C89', '#8CD3C6', '#ECEBE6', '#E8B49A', '#C46A3F', '#7F3A1B'],
};

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
function deepMerge(base, over) {
  if (!isObj(over)) return base;
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) out[k] = isObj(v) && isObj(base[k]) ? deepMerge(base[k], v) : v;
  return out;
}

/**
 * Tema = JSON. Acepta un nombre ("papel", "noche") o un objeto parcial que se
 * fusiona en profundidad sobre `extends` (por defecto "papel"):
 *   { extends: "noche", categorical: ["#..."], type: { title: 24 }, marks: { lineWidth: 3 } }
 * `categorical`, `sequential` y `diverging` aceptan también un nombre de paleta.
 */
function getTheme(t) {
  if (!t) return papel;
  if (typeof t === 'string') return themes[t] || papel;
  const base = themes[t.extends] || (t.mode === 'dark' ? noche : papel);
  const merged = deepMerge(base, t);
  if (typeof merged.categorical === 'string') merged.categorical = palettes[merged.categorical] || base.categorical;
  if (typeof merged.sequential === 'string') merged.sequential = ramps[merged.sequential] || base.sequential;
  if (typeof merged.diverging === 'string') merged.diverging = ramps[merged.diverging] || base.diverging;
  return merged;
}

/** Tema efectivo de un spec: `theme` + atajos `palette` y `ramp`. */
function themeFor(spec = {}) {
  let t = getTheme(spec.theme);
  if (spec.palette) t = { ...t, categorical: Array.isArray(spec.palette) ? spec.palette : palettes[spec.palette] || t.categorical };
  if (spec.ramp) t = { ...t, sequential: Array.isArray(spec.ramp) ? spec.ramp : ramps[spec.ramp] || t.sequential };
  return t;
}


function hexToRgb(hex) {
  let h = String(hex).replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]) {
  const f = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return ('#' + f(r) + f(g) + f(b)).toUpperCase();
}

const lin = (c) => {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const delin = (c) => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Texto blanco o tinta según qué contraste mejor sobre el relleno. */
function textOn(fill, theme) {
  const dark = theme.mode === 'dark' ? '#0B0F2B' : theme.ink;
  return contrast('#FFFFFF', fill) >= contrast(dark, fill) ? '#FFFFFF' : dark;
}

/** Interpola en RGB lineal a lo largo de una rampa de colores. t ∈ [0,1]. */
function ramp(stops, t) {
  t = Math.max(0, Math.min(1, Number.isFinite(t) ? t : 0));
  const p = t * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(p));
  const f = p - i;
  const a = hexToRgb(stops[i]).map(lin);
  const b = hexToRgb(stops[i + 1]).map(lin);
  return rgbToHex(a.map((v, k) => delin(v + (b[k] - v) * f)));
}

/**
 * Asigna colores a entidades en orden fijo. El color sigue a la entidad,
 * nunca a su posición: pasar `colors: {"Biobío": "#..."}` fija el color.
 * Más allá de 8 entidades no se inventan tonos: el resto va en gris "Otros".
 */
function colorMap(keys, theme, overrides = {}) {
  const map = new Map();
  let i = 0;
  for (const k of keys) {
    if (overrides && overrides[k]) map.set(k, overrides[k]);
    else map.set(k, i < theme.categorical.length ? theme.categorical[i] : theme.other);
    if (!(overrides && overrides[k])) i++;
  }
  return map;
}

/**
 * Versión legible de un color de serie para usarlo en TEXTO: lo oscurece
 * (o aclara, en tema oscuro) hasta ≥ 4,5:1 contra el fondo. Así una etiqueta
 * puede llevar el color de su línea sin perder legibilidad.
 */
function readable(color, theme, min = 4.5) {
  const target = theme.mode === 'dark' ? '#FFFFFF' : theme.ink;
  let c = color;
  for (let t = 0; t <= 1.0001 && contrast(c, theme.surface) < min; t += 0.05) {
    const A = hexToRgb(color), B = hexToRgb(target);
    c = rgbToHex(A.map((v, i) => v + (B[i] - v) * t));
  }
  return c;
}

/**
 * Tipografía a partir de un nombre: "Poppins" → pila con respaldo y la URL de
 * Google Fonts para cargarla. Una pila completa ("'Inter', sans-serif") se usa
 * tal cual. También acepta { family, import }.
 */
function fontSpec(font) {
  if (!font) return null;
  if (typeof font === 'object') return { ...font };
  const f = String(font).trim();
  if (/[,'"]/.test(f)) return { family: f };
  const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(f).replace(/%20/g, '+')}:wght@400;500;600;700&display=swap`;
  return { family: `'${f}', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`, import: url };
}

return { "deepMerge": deepMerge, "getTheme": getTheme, "themeFor": themeFor, "hexToRgb": hexToRgb, "rgbToHex": rgbToHex, "luminance": luminance, "contrast": contrast, "textOn": textOn, "ramp": ramp, "colorMap": colorMap, "readable": readable, "fontSpec": fontSpec, "FONT": FONT, "MONO": MONO, "FONT_CSS": FONT_CSS, "themes": themes, "palettes": palettes, "ramps": ramps };
});
__def("src/context.js", function () {
const ctx = { textScale: 1 };

/** Ejecuta fn con un contexto temporal y lo restaura después. */
function withContext(values, fn) {
  const prev = { ...ctx };
  Object.assign(ctx, values);
  try { return fn(); } finally { Object.assign(ctx, prev); }
}

return { "withContext": withContext, "ctx": ctx };
});
__def("src/palette.js", function () {

const BAND = { light: [0.43, 0.77], dark: [0.48, 0.67] };
const CHROMA_FLOOR = 0.1;
const CVD_TARGET = 8, CVD_FLOOR = 6, NORMAL_FLOOR = 15;
const MACHADO = {
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
};

const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const rgbLin = (hex) => { const h = hex.replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(lin); };
function oklab([r, g, b]) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
const sim = (rgb, M) => M.map((row) => Math.max(0, Math.min(1, row[0] * rgb[0] + row[1] * rgb[1] + row[2] * rgb[2])));
function dE(a, b, kind) {
  let A = rgbLin(a), B = rgbLin(b);
  if (kind) { A = sim(A, MACHADO[kind]); B = sim(B, MACHADO[kind]); }
  const p = oklab(A), q = oklab(B);
  return 100 * Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}
const lum = (hex) => { const [r, g, b] = rgbLin(hex); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

/**
 * Revisa una paleta categórica. Devuelve { ok, checks: [{ name, status, detail }] }.
 * status: 'pass' | 'warn' | 'fail'. `pairs: 'all'` para dispersión y mapas.
 */
function validatePalette(colors, { mode = 'light', surface, pairs = 'adjacent', locale = 'es' } = {}) {
  const en = String(locale).startsWith('en');
  const pal = colors.map(String);
  surface = surface || (mode === 'dark' ? '#0B0F2B' : '#FCFBF9');
  const checks = [];
  const [lo, hi] = BAND[mode] || BAND.light;
  const Ls = pal.map((c) => oklab(rgbLin(c)));
  const off = pal.filter((c, i) => Ls[i][0] < lo || Ls[i][0] > hi);
  checks.push({ name: 'lightness', status: off.length ? 'fail' : 'pass', detail: off.length ? (en ? `Outside the lightness band ${lo}–${hi}: ` : `Fuera de la banda de luminosidad ${lo}–${hi}: `) + off.join(', ') : en ? 'All inside the lightness band.' : 'Todos dentro de la banda de luminosidad.' });
  const gray = pal.filter((c, i) => Math.hypot(Ls[i][1], Ls[i][2]) < CHROMA_FLOOR);
  checks.push({ name: 'chroma', status: gray.length ? 'fail' : 'pass', detail: gray.length ? (en ? 'Read as gray: ' : 'Se leen como gris: ') + gray.join(', ') : en ? 'All have enough chroma.' : 'Todos con color suficiente.' });
  const list = pairs === 'all' ? pal.flatMap((_, i) => pal.slice(i + 1).map((__, k) => [i, i + 1 + k])) : pal.slice(1).map((_, i) => [i, i + 1]);
  let worst = null, nworst = null;
  for (const [i, j] of list) {
    for (const k of ['protan', 'deutan']) { const d = dE(pal[i], pal[j], k); if (!worst || d < worst[0]) worst = [d, pal[i], pal[j], k]; }
    const n = dE(pal[i], pal[j]);
    if (!nworst || n < nworst[0]) nworst = [n, pal[i], pal[j]];
  }
  if (worst) checks.push({ name: 'cvd', status: worst[0] >= CVD_TARGET ? 'pass' : worst[0] >= CVD_FLOOR ? 'warn' : 'fail', detail: en ? `Worst colorblind pair (${worst[3]}): ${worst[1]} ↔ ${worst[2]}, ΔE ${worst[0].toFixed(1)} (target ≥ ${CVD_TARGET}).` : `Peor par para daltonismo (${worst[3]}): ${worst[1]} ↔ ${worst[2]}, ΔE ${worst[0].toFixed(1)} (meta ≥ ${CVD_TARGET}).` });
  if (nworst) checks.push({ name: 'normal', status: nworst[0] >= NORMAL_FLOOR ? 'pass' : 'fail', detail: en ? `Worst normal-vision pair: ${nworst[1]} ↔ ${nworst[2]}, ΔE ${nworst[0].toFixed(1)} (minimum ${NORMAL_FLOOR}).` : `Peor par con visión normal: ${nworst[1]} ↔ ${nworst[2]}, ΔE ${nworst[0].toFixed(1)} (mínimo ${NORMAL_FLOOR}).` });
  const low = pal.filter((c) => contrast(c, surface) < 3);
  checks.push({ name: 'contrast', status: low.length ? 'warn' : 'pass', detail: low.length ? (en ? 'Below 3:1 against the surface (use visible labels): ' : 'Bajo 3:1 contra el fondo (usa etiquetas visibles): ') + low.join(', ') : en ? 'All ≥ 3:1 against the surface.' : 'Todos ≥ 3:1 contra el fondo.' });
  return { ok: !checks.some((c) => c.status === 'fail'), checks };
}

return { "validatePalette": validatePalette };
});
__def("src/charts/bar.js", function () {
const { el, g, text, barPath, tip } = __req("src/svg.js");
const { measure, truncate } = __req("src/text.js");
const { makeFormat } = __req("src/format.js");
const { niceDomain, niceStep, linear, band } = __req("src/scale.js");
const { colorMap } = __req("src/theme.js");
const { ensureData, inferXY, requireField, melt, uniq, aggregate, num, fieldKind, humanize } = __req("src/data.js");
const { gridY, gridX, xLabels, ticksWidth, refLinesY, refLinesX } = __req("src/axes.js");
const { mean, sd, meanCI } = __req("src/stats.js");
const { createFrame, SIZES, hash } = __req("src/frame.js");
const { parseDate } = __req("src/format.js");
const { dashedMatcher, fromTest, hatcher, dashedAttrs, dashedDefaultLabel } = __req("src/dashed.js");
const { ctx } = __req("src/context.js");
const { otherLabel, thresholdOf, splitOther } = __req("src/other.js");

function prepareBar(spec) {
  let data = ensureData(spec);
  let series = spec.series ?? spec.hue ?? spec.color;
  let y = spec.y;
  if (Array.isArray(y)) {
    if (y.length > 1) {
      data = melt(data, spec.x, y, '__series', '__value', spec.labelsFor || {});
      series = '__series';
      y = '__value';
    } else y = y[0];
  }
  const inf = inferXY({ ...spec, y }, data);
  const x = inf.x;
  const counting = (spec.aggregate ?? spec.estimator) === 'count';
  y = y || (counting ? null : inf.y);
  requireField(data, x, 'x');
  if (!counting) requireField(data, y, 'y');
  if (series) requireField(data, series, 'series');
  const kind = fieldKind(data, x);
  const errorbar = spec.errorbar ?? (spec.ci === true || typeof spec.ci === 'number' ? 'ci' : null);
  const how = spec.aggregate ?? spec.estimator ?? (errorbar ? 'mean' : 'sum');
  const level = typeof spec.ci === 'number' ? (spec.ci > 1 ? spec.ci / 100 : spec.ci) : 0.95;
  const key = (c, s) => c + '\u0000' + s;
  const buckets = new Map();
  for (const r of data) {
    const c = r[x] === null || r[x] === undefined ? '' : String(r[x]);
    const s = series ? String(r[series]) : '';
    const k = key(c, s);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(how === 'count' ? 1 : num(r[y]));
  }
  let cats = uniq(data.map((r) => (r[x] === null || r[x] === undefined ? '' : String(r[x]))));
  const seriesKeys = series ? uniq(data.map((r) => String(r[series]))) : [''];
  const val = (c, s) => {
    const v = buckets.get(key(c, s));
    return v ? aggregate(v, how === 'count' ? 'sum' : how) : 0;
  };
  const values = new Map(cats.map((c) => [c, seriesKeys.map((s) => val(c, s) || 0)]));
  const errs = new Map();
  if (errorbar && errorbar !== 'none') for (const c of cats) errs.set(c, seriesKeys.map((s) => {
    const v = (buckets.get(key(c, s)) || []).filter(Number.isFinite);
    if (v.length < 2) return null;
    if (errorbar === 'sd') { const mm = mean(v), d = sd(v); return [mm - d, mm + d]; }
    if (errorbar === 'se') { const mm = mean(v), d = sd(v) / Math.sqrt(v.length); return [mm - d, mm + d]; }
    return meanCI(v, level);
  }));
  const total = (c) => values.get(c).reduce((a, b) => a + b, 0);
  if (kind === 'year' || kind === 'number') cats.sort((a, b) => num(a) - num(b));
  const nominal = kind === 'category';
  const sort = spec.sort ?? (nominal ? 'desc' : 'none');
  if (sort === 'desc') cats.sort((a, b) => total(b) - total(a));
  else if (sort === 'asc') cats.sort((a, b) => total(a) - total(b));
  else if (sort === 'alpha') cats.sort((a, b) => a.localeCompare(b, 'es'));

  const top = spec.top ?? (cats.length > 40 ? 25 : null);
  const additive = (how === 'sum' || how === 'count') && !errorbar;
  const totals = cats.map(total);
  const canShare = nominal && additive && totals.every((v) => v >= 0);
  const grand = totals.reduce((a, b) => a + b, 0);
  const otherName = otherLabel(spec);
  const hlSet = spec.highlight === undefined ? null : new Set([].concat(spec.highlight).map(String));
  let folded = 0, otherMembers = [], binName = null;
  if (nominal) {
    const sp = splitOther(cats, {
      value: total, name: (c) => c, total: grand, label: otherName,
      threshold: canShare ? thresholdOf(spec) : 0,
      top: top && cats.length > top ? top : null,
      protect: (c) => (hlSet && hlSet.has(c)) || !!(spec.colors && spec.colors[c]),
    });
    if (sp.fold.length || sp.others.length) {
      const name = sp.others.length === 1 ? String(sp.others[0]) : otherName;
      const merge = [...sp.others, ...sp.fold];
      folded = sp.fold.length;
      otherMembers = sp.fold;
      const sum = seriesKeys.map((_, i) => merge.reduce((a, c) => a + values.get(c)[i], 0));
      if (errs.size && merge.length > 1) errs.set(name, seriesKeys.map(() => null));
      values.set(name, sum);
      cats = [...sp.keep, name];
      binName = name;
    }
  }
  return { data, x, y, series, seriesKeys, cats, values, kind, nominal, folded, otherName: binName, otherMembers, total, errs, errorbar };
}

function bar(spec, theme) {
  const m = prepareBar(spec);
  const locale = spec.locale || 'es';
  const { cats, values, seriesKeys } = m;
  const multi = m.series && seriesKeys.length > 1;
  const stack = multi ? spec.stack ?? false : false;
  const pct = stack === 'percent' || stack === 'normalize';
  const k = seriesKeys.length;

  const segs = new Map();
  for (const c of cats) {
    const vs = values.get(c);
    const tot = vs.reduce((a, b) => a + Math.abs(b), 0) || 1;
    let pos = 0, neg = 0;
    segs.set(c, vs.map((v) => {
      const vv = pct ? v / tot : v;
      if (vv >= 0) { const s = { from: pos, to: pos + vv, v, vv }; pos += vv; return s; }
      const s = { from: neg, to: neg + vv, v, vv }; neg += vv; return s;
    }));
  }
  const all = stack
    ? cats.flatMap((c) => segs.get(c).map((s) => s.to))
    : cats.flatMap((c) => values.get(c));
  if (m.errs.size) for (const e of m.errs.values()) for (const r of e) if (r) all.push(...r);
  let vmin = Math.min(0, ...all), vmax = Math.max(0, ...all);
  if (pct) { vmin = Math.min(0, vmin); vmax = Math.max(vmax, 1); }
  const fmt = pct ? makeFormat({ type: 'percent', scale: 100, decimals: spec.format?.decimals }, locale) : makeFormat(spec.format, locale, all);

  const frame = createFrame(spec, theme, { height: 420 });
  const labelSize = 12.5;
  const maxCatW = Math.max(...cats.map((c) => measure(c, labelSize)));
  let horizontal = spec.horizontal ?? spec.orientation === 'horizontal';
  if (spec.horizontal === undefined && !spec.orientation) {
    const slot = (frame.width - frame.pad * 2) / Math.max(1, cats.length);
    horizontal = m.nominal && (cats.length > 12 || maxCatW > slot - 10);
  }

  const cmap = colorMap(seriesKeys, theme, spec.colors);
  const hl = spec.highlight === undefined ? null : new Set([].concat(spec.highlight).map(String));
  const colorFor = (c, si) => {
    if (multi) return cmap.get(seriesKeys[si]);
    if (spec.colors && spec.colors[c]) return spec.colors[c];
    if (c === m.otherName) return theme.other;
    if (hl) return hl.has(c) ? theme.categorical[0] : theme.dim;
    return theme.categorical[0];
  };
  const legend = multi && spec.legend !== false ? seriesKeys.map((s) => ({ label: s, color: cmap.get(s), shape: 'square' })) : [];

  const H = hatcher(theme, 'pa-b' + Math.abs(hash(String(spec.title) + theme.mode + frame.width)).toString(36));
  const dm = dashedMatcher(spec, m.data, m.x, m.series);
  const xNum = (c) => (m.kind === 'date' ? parseDate(c) : num(c));
  const from = m.nominal ? null : fromTest(spec, xNum);
  const isDashed = (c, si) => !!((dm && dm(c, multi ? seriesKeys[si] : m.series ? seriesKeys[0] : undefined)) || (from && from(xNum(c))));
  const anyDashed = (dm || from) && cats.some((c) => seriesKeys.some((_, i) => isDashed(c, i)));
  const dashedLabel = spec.dashedLabel ?? dashedDefaultLabel(locale);
  const otherNote = (c) => {
    if (c !== m.otherName || !m.otherMembers.length) return '';
    const L = m.otherMembers, en = String(locale).startsWith('en');
    const names = L.slice(0, 6).join(', ') + (L.length > 6 ? (en ? ` and ${L.length - 6} more` : ` y ${L.length - 6} más`) : '');
    return `${L.length} ${en ? 'categories' : 'categorías'}: ${names}`;
  };
  const dl = (c, si) => tip(isDashed(c, si) ? dashedLabel : '', otherNote(c));
  const paint = (c, si) => (isDashed(c, si) ? dashedAttrs(H, colorFor(c, si)) : { fill: colorFor(c, si) });
  if (anyDashed && spec.legend !== false) legend.push({ label: dashedLabel, key: 'dashed', color: theme.muted, shape: 'square', dashed: true, fill: H.fill(theme.muted), stroke: H.stroke(theme.muted) });

  const labelMode = spec.labels ?? 'auto';
  const showLabels = labelMode === true || (labelMode === 'auto' && !m.errs.size && (!multi || stack) && cats.length <= (horizontal ? 40 : 16));
  const labelOf = (c) => (stack ? (pct ? '' : fmt(m.total(c))) : fmt(values.get(c)[0]));
  const valueLabelW = showLabels ? Math.max(...cats.map((c) => measure(labelOf(c), SIZES.label, 600))) : 0;
  const hideAxis = spec.axis === false || (showLabels && !multi && !(spec.refLines || []).length && spec.axis !== true);
  const maxBar = spec.barWidth || (horizontal ? theme.marks?.barMaxH ?? 22 : theme.marks?.barMax ?? 36);

  let area = frame.layout(legend);
  const body = [];
  const refs = (spec.refLines || []).map((r) => ({ ...r, y: r.value ?? r.y }));

  if (!horizontal) {
    if (spec.height === undefined && frame.height < 360) frame.setHeight(360);
    const ticksCount = Math.max(3, Math.round(area.h / 64));
    const nd = spec.yDomain ? { min: spec.yDomain[0], max: spec.yDomain[1], step: niceStep(spec.yDomain[1] - spec.yDomain[0], ticksCount) } : niceDomain(vmin, vmax, ticksCount);
    const dom = hideAxis && !spec.yDomain ? { min: vmin, max: vmax || 1 } : nd;
    if (spec._domains) spec._domains.y = [dom.min, dom.max];
    const leftM = hideAxis ? 0 : ticksWidth(linear(nd.min, nd.max, 0, 1).ticks(nd.step), fmt.tick(nd.step)) + 10;
    const top = showLabels ? 20 : 6;
    const inner = { x: area.x + leftM, y: area.y + top * ctx.textScale, w: area.w - leftM, h: area.h - top * ctx.textScale - 26 * ctx.textScale };
    const yS = linear(dom.min, dom.max, inner.y + inner.h, inner.y);
    const xb = band(cats, inner.x, inner.x + inner.w, { inner: multi && !stack ? 0.2 : 0.3, outer: 0.1 });
    if (!hideAxis) body.push(gridY(yS.ticks(nd.step), yS, inner, theme, fmt.tick(nd.step)));
    const y0 = yS(0);
    cats.forEach((c) => {
      const bx = xb(c);
      const bw = xb.bandwidth;
      const vs = values.get(c);
      const parts = [];
      const hit = el('rect', { x: bx - xb.step * 0.12, y: inner.y, width: bw + xb.step * 0.24, height: inner.h, fill: 'transparent' });
      if (stack) {
        const w = Math.min(maxBar * 1.4, bw);
        const x0 = bx + (bw - w) / 2;
        const sg = segs.get(c);
        const lastPos = sg.map((s, i) => (s.vv > 0 ? i : -1)).filter((i) => i >= 0).pop();
        const lastNeg = sg.map((s, i) => (s.vv < 0 ? i : -1)).filter((i) => i >= 0).pop();
        sg.forEach((s, i) => {
          if (!s.vv) return;
          const ya = yS(s.from), yb = yS(s.to);
          let top = Math.min(ya, yb), h = Math.abs(yb - ya);
          const gap = s.from !== 0 ? 2 : 0;
          if (s.vv > 0) h -= gap; else { top += gap; h -= gap; }
          const outer = s.vv > 0 ? i === lastPos : i === lastNeg;
          const d = barPath(x0, top, w, Math.max(0, h), s.vv > 0 ? 'up' : 'down', outer ? 4 : 0);
          parts.push(g({ class: 'pa-m', 'data-tip': tip(c, `${seriesKeys[i]}: ${fmt(pct ? s.vv : s.v)}`, dl(c, i)) }, [el('path', { d, ...paint(c, i) })]));
        });
        if (showLabels && !pct) {
          const t = m.total(c);
          const ty = t >= 0 ? yS(Math.max(0, ...sg.map((s) => s.to))) - 7 : yS(Math.min(0, ...sg.map((s) => s.to))) + 15;
          parts.push(text(bx + bw / 2, ty, fmt(t), { fill: theme.ink, fontSize: SIZES.label, fontWeight: 600, textAnchor: 'middle' }));
        }
        body.push(g({ 'data-tip': tip(c, ...sg.map((s, i) => `${seriesKeys[i]}: ${fmt(pct ? s.vv : s.v)}` + (isDashed(c, i) && dm ? ` (${dashedLabel})` : '')), pct ? '' : `Total: ${fmt(m.total(c))}`, from && from(xNum(c)) ? dashedLabel : '', otherNote(c)) }, [hit, ...parts]));
      } else {
        const w = Math.min(maxBar, (bw - 2 * (k - 1)) / k);
        const groupW = w * k + 2 * (k - 1);
        const x0 = bx + (bw - groupW) / 2;
        vs.forEach((v, i) => {
          const bxI = x0 + i * (w + 2);
          const yv = yS(v);
          const top = Math.min(yv, y0), h = Math.abs(yv - y0);
          const d = barPath(bxI, top, w, h, v >= 0 ? 'up' : 'down');
          const er0 = m.errs.get(c)?.[i];
          const label = (multi ? `${seriesKeys[i]}: ${fmt(v)}` : fmt(v)) + (er0 ? ` (IC ${fmt(er0[0])}–${fmt(er0[1])})` : '');
          parts.push(g({ class: 'pa-m', 'data-tip': tip(c, label, dl(c, i)) }, [
            el('rect', { x: bxI - 1, y: inner.y, width: w + 2, height: inner.h, fill: 'transparent' }),
            el('path', { d, ...paint(c, i) }),
            errBar(m.errs.get(c)?.[i], (e) => [bxI + w / 2, yS(e)], true, theme),
          ]));
          if (showLabels && !multi) {
            const strong = !hl || hl.has(c);
            parts.push(text(bxI + w / 2, v >= 0 ? yv - 7 : yv + 15, fmt(v), { fill: strong ? theme.ink : theme.muted, fontSize: SIZES.label, fontWeight: strong ? 600 : 400, textAnchor: 'middle' }));
          }
        });
        body.push(g({}, [hit, ...parts]));
      }
    });
    body.push(el('line', { x1: inner.x, x2: inner.x + inner.w, y1: Math.round(y0) + 0.5, y2: Math.round(y0) + 0.5, stroke: theme.axis, strokeWidth: 1 }));
    const items = cats.map((c) => ({ pos: xb.center(c), label: m.nominal ? truncate(c, Math.max(xb.step - 6, 40), 12) : c }));
    body.push(xLabels(items, inner, theme, { y: inner.y + inner.h + 18, size: 12, color: theme.lede }));
    body.push(refLinesY(refs, yS, inner, theme, fmt));
  } else {
    const step = Math.max(multi && !stack ? Math.min(maxBar, 16) * k + 2 * (k - 1) + 10 : maxBar + 9, 12.5 * ctx.textScale * 1.45);
    const needH = cats.length * step + 30;
    if (spec.height === undefined) {
      frame.setHeight(area.y + needH + frame.chrome);
      area = { ...area, h: frame.bottom - area.y };
    }
    const catW = Math.min(maxCatW, area.w * 0.38) + 12;
    const rightM = showLabels ? valueLabelW + 10 : 8;
    const hasNeg = vmin < 0;
    const inner = { x: area.x + catW, y: area.y + 4, w: area.w - catW - rightM - (hasNeg && showLabels ? valueLabelW + 10 : 0), h: area.h - (hideAxis ? 8 : 28) };
    if (hasNeg && showLabels) inner.x += valueLabelW + 10;
    const nd = spec.yDomain ? { min: spec.yDomain[0], max: spec.yDomain[1], step: niceStep(spec.yDomain[1] - spec.yDomain[0], Math.max(3, Math.round(inner.w / 110))) } : niceDomain(vmin, vmax, Math.max(3, Math.round(inner.w / 110)));
    const dom = hideAxis && !spec.yDomain ? { min: vmin, max: vmax || 1 } : nd;
    if (spec._domains) spec._domains.y = [dom.min, dom.max];
    const xS = linear(dom.min, dom.max, inner.x, inner.x + inner.w);
    const yb = band(cats, inner.y, inner.y + inner.h, { inner: 0.32, outer: 0.1 });
    if (!hideAxis) body.push(gridX(xS.ticks(nd.step), xS, inner, theme, fmt.tick(nd.step)));
    const x0 = xS(0);
    cats.forEach((c) => {
      const by = yb(c);
      const bh = yb.bandwidth;
      const vs = values.get(c);
      const parts = [];
      const strong = !hl || hl.has(c);
      parts.push(el('rect', { x: area.x, y: by - yb.step * 0.16, width: area.w, height: yb.step, fill: 'transparent' }));
      parts.push(text(inner.x - 10 - (hasNeg && showLabels ? valueLabelW + 10 : 0), by + bh / 2 + 4.5, truncate(c, catW - 12, labelSize), { fill: strong ? theme.ink : theme.muted, fontSize: labelSize, fontWeight: hl && strong ? 600 : 400, textAnchor: 'end' }));
      if (stack) {
        const h = Math.min(maxBar, bh);
        const y0b = by + (bh - h) / 2;
        const sg = segs.get(c);
        const lastPos = sg.map((s, i) => (s.vv > 0 ? i : -1)).filter((i) => i >= 0).pop();
        sg.forEach((s, i) => {
          if (!s.vv) return;
          const xa = xS(s.from), xb2 = xS(s.to);
          let left = Math.min(xa, xb2), w = Math.abs(xb2 - xa);
          if (s.from !== 0) { if (s.vv > 0) left += 2; w -= 2; }
          const d = barPath(left, y0b, Math.max(0, w), h, s.vv > 0 ? 'right' : 'left', i === lastPos || s.vv < 0 ? 4 : 0);
          const fill = colorFor(c, i);
          const lab = pct ? fmt(s.vv) : '';
          const fits = lab && measure(lab, 11, 600) + 10 < w;
          const hatched = isDashed(c, i);
          parts.push(g({ class: 'pa-m', 'data-tip': tip(c, `${seriesKeys[i]}: ${fmt(pct ? s.vv : s.v)}`, dl(c, i)) }, [
            el('path', { d, ...paint(c, i) }),
            fits ? text(left + 6, y0b + h / 2 + 4, lab, { fill: hatched ? theme.ink : textColor(fill, theme), fontSize: 11, fontWeight: 600, ...(hatched ? { stroke: theme.surface, strokeWidth: 3, paintOrder: 'stroke' } : {}) }) : '',
          ]));
        });
        if (showLabels && !pct) parts.push(text(xS(Math.max(0, ...sg.map((s) => s.to))) + 7, by + bh / 2 + 4.5, fmt(m.total(c)), { fill: theme.ink, fontSize: SIZES.label, fontWeight: 600 }));
        body.push(g({ 'data-tip': tip(c, ...sg.map((s, i) => `${seriesKeys[i]}: ${fmt(pct ? s.vv : s.v)}` + (isDashed(c, i) ? ` (${dashedLabel})` : '')), otherNote(c)) }, parts));
      } else {
        const h = Math.min(multi ? 16 : maxBar, (bh - 2 * (k - 1)) / k);
        const groupH = h * k + 2 * (k - 1);
        const y0b = by + (bh - groupH) / 2;
        vs.forEach((v, i) => {
          const yy = y0b + i * (h + 2);
          const xv = xS(v);
          const d = barPath(Math.min(xv, x0), yy, Math.abs(xv - x0), h, v >= 0 ? 'right' : 'left');
          const er = m.errs.get(c)?.[i];
          const erTxt = er ? ` (IC ${fmt(er[0])}–${fmt(er[1])})` : '';
          parts.push(g({ class: 'pa-m', 'data-tip': tip(c, (multi ? `${seriesKeys[i]}: ` : '') + fmt(v) + erTxt, dl(c, i)) }, [el('path', { d, ...paint(c, i) }), errBar(er, (e) => [xS(e), yy + h / 2], false, theme)]));
          if (showLabels && !multi) {
            parts.push(text(v >= 0 ? xv + 7 : xv - 7, yy + h / 2 + 4.5, fmt(v), { fill: strong ? theme.ink : theme.muted, fontSize: SIZES.label, fontWeight: strong ? 600 : 400, textAnchor: v >= 0 ? 'start' : 'end' }));
          }
        });
        body.push(g({}, parts));
      }
    });
    body.push(el('line', { x1: Math.round(x0) + 0.5, x2: Math.round(x0) + 0.5, y1: inner.y, y2: inner.y + inner.h, stroke: theme.axis, strokeWidth: 1 }));
    body.push(refLinesX(refs.map((r) => ({ ...r, x: r.y, y: undefined })), xS, inner, theme, fmt));
  }

  const desc = describeBar(m, fmt, locale);
  return frame.finish(body, { desc, type: 'bar', defs: H.defs() });
}

/** Barra de error fina con remates cortos (seaborn). */
function errBar(e, P, vertical, theme) {
  if (!e) return '';
  const [ax, ay] = P(e[0]), [bx, by] = P(e[1]);
  const c = 5;
  const d = vertical
    ? `M${ax},${ay}V${by}M${ax - c},${ay}H${ax + c}M${bx - c},${by}H${bx + c}`
    : `M${ax},${ay}H${bx}M${ax},${ay - c}V${ay + c}M${bx},${by - c}V${by + c}`;
  return el('path', { d, stroke: theme.ink, strokeWidth: 1.5, fill: 'none', strokeLinecap: 'round', opacity: 0.85 });
}

function textColor(fill, theme) {
  const [r, gg, b] = fill.replace('#', '').match(/../g).map((h) => parseInt(h, 16));
  const l = 0.299 * r + 0.587 * gg + 0.114 * b;
  return l > 150 ? (theme.mode === 'dark' ? '#0B0F2B' : theme.ink) : '#FFFFFF';
}

function describeBar(m, fmt, locale = 'es') {
  const en = String(locale).startsWith('en');
  const totals = m.cats.map((c) => [c, m.total(c)]);
  if (!totals.length) return '';
  const sorted = [...totals].sort((a, b) => b[1] - a[1]);
  const sum = totals.reduce((a, [, v]) => a + v, 0);
  const [hiC, hiV] = sorted[0];
  const [loC, loV] = sorted[sorted.length - 1];
  const share = sum > 0 ? ` (${fmt.type === 'percent' ? '' : Math.round((hiV / sum) * 100) + '%'})`.replace(' ()', '') : '';
  const what = humanize(m.y === '__value' ? '' : m.y) || (en ? 'Value' : 'Valor');
  return en
    ? `Bar chart of ${what} across ${m.cats.length} categories. Highest: ${hiC} with ${fmt(hiV)}${share}. Lowest: ${loC} with ${fmt(loV)}.`
    : `Gráfico de barras de ${what.toLowerCase()} en ${m.cats.length} categorías. Mayor: ${hiC} con ${fmt(hiV)}${share}. Menor: ${loC} con ${fmt(loV)}.`;
}

return { "prepareBar": prepareBar, "bar": bar, "describeBar": describeBar };
});
__def("src/svg.js", function () {

const { ctx } = __req("src/context.js");

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

/** Redondea a 2 decimales para SVG compactos. */
const r2 = (n) => Math.round(n * 100) / 100;

const ATTR_ALIAS = { className: 'class' };
const KEEP_CASE = new Set(['viewBox', 'preserveAspectRatio', 'gradientUnits', 'gradientTransform', 'patternUnits', 'patternTransform', 'patternContentUnits', 'clipPathUnits', 'refX', 'refY', 'markerWidth', 'markerHeight', 'markerUnits', 'textLength', 'lengthAdjust', 'startOffset']);

function el(tag, attrs = {}, children) {
  let s = '<' + tag;
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    const name = ATTR_ALIAS[k] || (KEEP_CASE.has(k) ? k : k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase()));
    const val = typeof v === 'number' ? r2(k === 'fontSize' ? v * ctx.textScale : v) : v;
    s += ` ${name}="${esc(val)}"`;
  }
  if (children === undefined || children === null || children === '') return s + '/>';
  const inner = Array.isArray(children) ? children.flat(Infinity).filter(Boolean).join('') : children;
  return s + '>' + inner + '</' + tag + '>';
}

const g = (attrs, children) => el('g', attrs, children);

/** Texto SVG. `children` se escapa. */
function text(x, y, str, attrs = {}) {
  return el('text', { x, y, ...attrs }, esc(str));
}

/**
 * Barra con extremo de dato redondeado (4px) y base recta.
 * dir: hacia dónde crece la barra: 'up' | 'down' | 'right' | 'left'.
 */
function barPath(x, y, w, h, dir = 'up', radius = 4) {
  if (w <= 0 || h <= 0) return '';
  const r = Math.max(0, Math.min(radius, (dir === 'up' || dir === 'down' ? w : h) / 2, dir === 'up' || dir === 'down' ? h : w));
  const R = r2;
  const x1 = x + w, y1 = y + h;
  if (r === 0) return `M${R(x)},${R(y)}H${R(x1)}V${R(y1)}H${R(x)}Z`;
  switch (dir) {
    case 'up':
      return `M${R(x)},${R(y1)}V${R(y + r)}Q${R(x)},${R(y)} ${R(x + r)},${R(y)}H${R(x1 - r)}Q${R(x1)},${R(y)} ${R(x1)},${R(y + r)}V${R(y1)}Z`;
    case 'down':
      return `M${R(x)},${R(y)}V${R(y1 - r)}Q${R(x)},${R(y1)} ${R(x + r)},${R(y1)}H${R(x1 - r)}Q${R(x1)},${R(y1)} ${R(x1)},${R(y1 - r)}V${R(y)}Z`;
    case 'right':
      return `M${R(x)},${R(y)}H${R(x1 - r)}Q${R(x1)},${R(y)} ${R(x1)},${R(y + r)}V${R(y1 - r)}Q${R(x1)},${R(y1)} ${R(x1 - r)},${R(y1)}H${R(x)}Z`;
    case 'left':
      return `M${R(x1)},${R(y)}H${R(x + r)}Q${R(x)},${R(y)} ${R(x)},${R(y + r)}V${R(y1 - r)}Q${R(x)},${R(y1)} ${R(x + r)},${R(y1)}H${R(x1)}Z`;
    default:
      return `M${R(x)},${R(y)}H${R(x1)}V${R(y1)}H${R(x)}Z`;
  }
}

/** Texto de tooltip: líneas unidas por \n en un atributo data-tip. */
const tip = (...lines) => lines.filter((l) => l !== undefined && l !== null && l !== '').join('\n');

/**
 * Capa de puntos. Con pocos puntos, un <circle> por punto (tooltip propio).
 * Con muchos (> threshold), un solo <path> por estilo —los círculos como
 * arcos— y una capa invisible que busca el punto más cercano al pasar el
 * mouse. Es tan rápido como Canvas y conserva lo vectorial (ver docs).
 */
function dotLayer(circles, { threshold = 1500, maxTips = 20000 } = {}) {
  if (circles.length <= threshold) return circles.map((c) => el('circle', c)).join('');
  const groups = new Map();
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const near = [];
  for (const c of circles) {
    const k = [c.fill, c.fillOpacity, c.r, c.stroke, c.strokeWidth].join('|');
    if (!groups.has(k)) groups.set(k, { attrs: c, d: [] });
    const r = +c.r, cx = +c.cx, cy = +c.cy;
    groups.get(k).d.push(`M${r2(cx - r)},${r2(cy)}a${r},${r} 0 1,0 ${r2(2 * r)},0a${r},${r} 0 1,0 ${r2(-2 * r)},0`);
    x0 = Math.min(x0, cx - r); y0 = Math.min(y0, cy - r); x1 = Math.max(x1, cx + r); y1 = Math.max(y1, cy + r);
    if (near.length < maxTips) near.push([r2(cx), r2(cy), c['data-tip'] || '', c.fill]);
  }
  const paths = [...groups.values()].map(({ attrs, d }) =>
    el('path', { d: d.join(''), fill: attrs.fill, fillOpacity: attrs.fillOpacity, stroke: attrs.stroke && attrs.stroke !== 'none' ? attrs.stroke : null, strokeWidth: attrs.stroke && attrs.stroke !== 'none' ? Math.min(+attrs.strokeWidth || 1, 0.75) : null }));
  const hover = el('rect', { class: 'pa-near', x: x0, y: y0, width: Math.max(1, x1 - x0), height: Math.max(1, y1 - y0), fill: 'transparent', 'data-near': JSON.stringify(near) });
  return g({ class: 'pa-dense' }, [...paths, hover]);
}

return { "el": el, "text": text, "barPath": barPath, "dotLayer": dotLayer, "esc": esc, "r2": r2, "g": g, "tip": tip };
});
__def("src/text.js", function () {
const { ctx } = __req("src/context.js");

const W = {};
const set = (chars, w) => { for (const c of chars) W[c] = w; };
set('abcdeghknopqsuvxyzáéóúñü', 0.54);
set('ijlíï', 0.25);
set('frt', 0.36);
set('mw', 0.82);
set('ABCDEFGHKNOPQRSTUVXYZÁÉÍÓÚÑ', 0.64);
set('IJ', 0.3);
set('MW', 0.86);
set('0123456789', 0.56);
set(' ', 0.27);
set('.,:;\'!|', 0.26);
set('-–()[]/', 0.36);
set('%', 0.82);
set('$€', 0.58);
set('+=<>±×', 0.58);
set('—', 0.9);
set('▲▼■●', 0.9);
set('·', 0.3);
set('→', 0.9);

function measure(str, size = 12, weight = 400) {
  let w = 0;
  for (const c of String(str ?? '')) w += W[c] ?? 0.56;
  const bold = weight >= 600 ? 1.06 : weight >= 500 ? 1.03 : 1;
  return w * size * ctx.textScale * bold * 1.05; // margen: Mozilla Text es un poco más ancha
}

/** Recorta con elipsis para caber en `max` px. */
function truncate(str, max, size = 12, weight = 400) {
  str = String(str ?? '');
  if (measure(str, size, weight) <= max) return str;
  let s = str;
  while (s.length > 1 && measure(s + '…', size, weight) > max) s = s.slice(0, -1);
  return s.trimEnd() + '…';
}

/** Ajusta texto en líneas de ancho `max`. Devuelve un arreglo de líneas. */
function wrap(str, max, size = 12, weight = 400, maxLines = Infinity) {
  const words = String(str ?? '').split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? cur + ' ' + w : w;
    if (measure(next, size, weight) <= max || !cur) cur = next;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = truncate(lines.slice(maxLines - 1).join(' '), max, size, weight);
    return kept;
  }
  return lines;
}

return { "measure": measure, "truncate": truncate, "wrap": wrap };
});
__def("src/format.js", function () {

const SEP = {
  es: { group: '.', dec: ',' },
  en: { group: ',', dec: '.' },
};

const COMPACT = {
  es: [[1e12, ' B'], [1e6, ' M'], [1e3, ' mil']],
  en: [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']],
};

const MONTHS = {
  es: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

const loc = (l) => (l && String(l).toLowerCase().startsWith('en') ? 'en' : 'es');

/** Número con separadores. `decimals` fijo; `trim` quita ceros finales. */
function formatNumber(v, decimals = 0, locale = 'es', trim = false) {
  if (v === null || v === undefined || Number.isNaN(v)) return '';
  if (!Number.isFinite(v)) return v > 0 ? '∞' : '-∞';
  const { group, dec } = SEP[loc(locale)];
  const neg = v < 0;
  let [int, frac = ''] = Math.abs(v).toFixed(Math.max(0, decimals)).split('.');
  int = int.replace(/\B(?=(\d{3})+(?!\d))/g, group);
  if (trim) frac = frac.replace(/0+$/, '');
  const out = frac ? int + dec + frac : int;
  return (neg && /[1-9]/.test(out) ? '−' : '') + out;
}

/** Decimales "inteligentes" según la magnitud. */
function smartDecimals(v) {
  const a = Math.abs(v);
  if (a === 0 || a >= 100) return 0;
  if (a >= 10) return 1;
  if (a >= 1) return 2;
  return Math.min(4, 1 - Math.floor(Math.log10(a)) + 1);
}

function formatCompact(v, locale = 'es', decimals) {
  const l = loc(locale);
  const a = Math.abs(v);
  for (const [n, suf] of COMPACT[l]) {
    if (a >= n) {
      const s = v / n;
      const d = decimals ?? (Math.abs(s) < 10 ? 1 : 0);
      return formatNumber(s, d, l, decimals === undefined) + suf;
    }
  }
  return formatNumber(v, decimals ?? smartDecimals(v), l, decimals === undefined);
}

const isYearLike = (vals) =>
  vals.length > 0 && vals.every((v) => Number.isInteger(v) && v >= 1000 && v <= 2999);

/**
 * Crea un formateador de valores a partir de la opción `format` del spec.
 *   'number' | 'compact' | 'percent' | 'currency' | 'integer' | 'year'
 *   { type, prefix, suffix, decimals, currency }
 * `values` permite autodetectar (p. ej. porcentajes ya multiplicados por 100).
 */
function makeFormat(fmt, locale = 'es', values = []) {
  const o = typeof fmt === 'string' ? { type: fmt } : { ...(fmt || {}) };
  const l = loc(locale);
  const nums = values.filter((v) => Number.isFinite(v));
  const max = nums.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
  let type = o.type;
  if (!type) type = isYearLike(nums) ? 'year' : max >= 1e5 ? 'compact' : 'number';
  const pre = o.prefix ?? (type === 'currency' ? currencyPrefix(o.currency, l) : '');
  const suf = o.suffix ?? '';
  const d = o.decimals;

  let core;
  switch (type) {
    case 'year':
      core = (v) => String(Math.round(v));
      break;
    case 'integer':
      core = (v) => formatNumber(v, 0, l);
      break;
    case 'percent': {
      const scale = o.scale ?? (max > 1.5 ? 1 : 100); // 0,25 → 25%; 25 → 25%
      core = (v) => formatNumber(v * scale, d ?? smartDecimals(v * scale), l, d === undefined) + '%';
      break;
    }
    case 'compact':
      core = (v) => formatCompact(v, l, d);
      break;
    case 'currency':
      core = (v) => (max >= 1e6 ? formatCompact(v, l, d) : formatNumber(v, d ?? (max >= 100 || nums.every(Number.isInteger) ? 0 : 2), l));
      break;
    default:
      core = (v) => formatNumber(v, d ?? smartDecimals(v), l, d === undefined);
  }
  const f = (v) => {
    if (v === null || v === undefined || Number.isNaN(v)) return '';
    const s = core(v);
    if (pre && s.startsWith('−')) return '−' + pre + s.slice(1) + suf;
    return pre + s + suf;
  };
  f.type = type;
  f.tick = (step) => tickFormat(step, o, type, l, pre, suf, max, d);
  return f;
}

function currencyPrefix(cur, l) {
  if (!cur) return '$';
  const c = String(cur).toUpperCase();
  return { USD: 'US$', CLP: '$', EUR: '€', UF: 'UF ', GBP: '£', PEN: 'S/ ', MXN: 'MX$', BRL: 'R$' }[c] || c + ' ';
}

/** Formateador de marcas de eje: decimales según el paso, nunca ruido. */
function tickFormat(step, o, type, l, pre, suf, max, dFixed) {
  const decFor = (s) => {
    const a = Math.abs(s) || 1;
    let d = Math.max(0, -Math.floor(Math.log10(a) + 1e-9));
    while (d < 6 && Math.abs(Math.round(a * 10 ** d) - a * 10 ** d) > 1e-6 * 10 ** d) d++;
    return Math.min(6, d);
  };
  let core;
  if (type === 'year') core = (v) => String(Math.round(v));
  else if (type === 'percent') {
    const scale = o.scale ?? (max > 1.5 ? 1 : 100);
    core = (v) => formatNumber(v * scale, decFor(step * scale), l) + '%';
  } else if (type === 'compact' || max >= 1e4 && type !== 'integer') {
    core = (v) => {
      const a = Math.abs(v);
      const unit = a >= 1e12 ? 1e12 : a >= 1e9 ? 1e9 : a >= 1e6 ? 1e6 : a >= 1e3 ? 1e3 : 1;
      if (unit === 1) return formatNumber(v, decFor(step), l);
      return formatCompact(v, l, decFor(step / unit));
    };
  } else core = (v) => formatNumber(v, dFixed ?? decFor(step), l);
  return (v) => {
    const s = core(v);
    if (pre && s.startsWith('−')) return '−' + pre + s.slice(1) + suf;
    return pre + s + suf;
  };
}


const ISO = /^(\d{4})-(\d{2})(?:-(\d{2}))?(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/;

/** Convierte Date | 'YYYY-MM' | 'YYYY-MM-DD' | ISO a milisegundos (UTC). */
function parseDate(v) {
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'string') {
    const m = ISO.exec(v.trim());
    if (m) return Date.UTC(+m[1], +m[2] - 1, +(m[3] || 1), +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
  }
  return NaN;
}

const isDateLike = (v) => v instanceof Date || (typeof v === 'string' && ISO.test(v.trim()));

function formatDate(ms, unit, locale = 'es', withYear = true) {
  const d = new Date(ms);
  const l = loc(locale);
  const y = d.getUTCFullYear();
  const m = MONTHS[l][d.getUTCMonth()];
  if (unit === 'year') return String(y);
  if (unit === 'quarter') return `T${Math.floor(d.getUTCMonth() / 3) + 1}${withYear ? ' ' + y : ''}`.replace('T', l === 'en' ? 'Q' : 'T');
  if (unit === 'month') return withYear ? `${m} ${y}` : m;
  const day = d.getUTCDate();
  return l === 'en' ? `${m} ${day}${withYear ? ', ' + y : ''}` : `${day} ${m}${withYear ? ' ' + y : ''}`;
}

return { "formatNumber": formatNumber, "smartDecimals": smartDecimals, "formatCompact": formatCompact, "makeFormat": makeFormat, "parseDate": parseDate, "formatDate": formatDate, "MONTHS": MONTHS, "isDateLike": isDateLike };
});
__def("src/scale.js", function () {
const { formatDate } = __req("src/format.js");

function niceStep(span, count = 5) {
  if (!(span > 0)) return 1;
  const raw = span / Math.max(1, count);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const n = raw / mag;
  const f = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return f * mag;
}

/** Dominio "bonito": extremos redondeados al paso de las marcas. */
function niceDomain(min, max, count = 5) {
  if (min === max) {
    if (min === 0) return { min: 0, max: 1, step: 0.2 };
    const pad = Math.abs(min) * 0.1;
    min -= pad;
    max += pad;
  }
  let step = niceStep(max - min, count);
  let lo = Math.floor(min / step + 1e-9) * step;
  let hi = Math.ceil(max / step - 1e-9) * step;
  step = niceStep(hi - lo, count);
  lo = Math.floor(min / step + 1e-9) * step;
  hi = Math.ceil(max / step - 1e-9) * step;
  return { min: lo, max: hi, step };
}

function linear(d0, d1, r0, r1) {
  const k = d1 === d0 ? 0 : (r1 - r0) / (d1 - d0);
  const s = (v) => r0 + (v - d0) * k;
  s.invert = (p) => (k === 0 ? d0 : d0 + (p - r0) / k);
  s.domain = [d0, d1];
  s.range = [r0, r1];
  s.ticks = (step) => {
    const out = [];
    const st = step || niceStep(d1 - d0, 5);
    const start = Math.ceil(Math.min(d0, d1) / st - 1e-9) * st;
    for (let v = start; v <= Math.max(d0, d1) + st * 1e-9; v += st) out.push(Math.abs(v) < st * 1e-9 ? 0 : +v.toPrecision(12));
    return out;
  };
  return s;
}

function log(d0, d1, r0, r1) {
  const lo = Math.log10(Math.max(d0, 1e-12));
  const hi = Math.log10(Math.max(d1, 1e-12));
  const inner = linear(lo, hi, r0, r1);
  const s = (v) => inner(Math.log10(Math.max(v, 1e-12)));
  s.invert = (p) => 10 ** inner.invert(p);
  s.domain = [d0, d1];
  s.range = [r0, r1];
  s.ticks = (max = 7) => {
    const cap = Number.isInteger(max) && max >= 2 ? max : 7;
    const gen = (mult) => {
      const out = [];
      for (let e = Math.floor(lo) - 1; e <= Math.ceil(hi); e++)
        for (const k of mult) {
          const v = +(k * 10 ** e).toPrecision(12);
          if (v >= d0 * 0.999 && v <= d1 * 1.001) out.push(v);
        }
      return out;
    };
    for (const mult of [[1, 2, 5], [1, 3], [1]]) {
      const t = gen(mult);
      if (t.length <= cap) { const dense = gen([1, 2, 3, 5]); return t.length < 4 && dense.length <= cap ? dense : t; }
    }
    const t = gen([1]);
    const every = Math.ceil(t.length / cap);
    return t.filter((_, i) => i % every === 0);
  };
  return s;
}

/** Dominio log ajustado a la secuencia 1-2-5 (sin décadas vacías). */
function logDomain(min, max) {
  const steps = [1, 2, 5, 10];
  const down = (v) => { const e = Math.floor(Math.log10(v)); const m = v / 10 ** e; const k = [...steps].reverse().find((s) => s <= m + 1e-9) || 1; return k * 10 ** e; };
  const up = (v) => { const e = Math.floor(Math.log10(v)); const m = v / 10 ** e; const k = steps.find((s) => s >= m - 1e-9) || 10; return k * 10 ** e; };
  const lo = down(Math.max(min, 1e-12)), hi = up(Math.max(max, 1e-12));
  return { min: lo, max: hi === lo ? lo * 10 : hi };
}

/** Escala de bandas para categorías. */
function band(domain, r0, r1, { inner = 0.3, outer = 0.15 } = {}) {
  const n = domain.length;
  const step = (r1 - r0) / Math.max(1, n - inner + outer * 2);
  const bw = step * (1 - inner);
  const start = r0 + step * outer;
  const idx = new Map(domain.map((d, i) => [d, i]));
  const s = (v) => start + (idx.get(v) ?? 0) * step;
  s.bandwidth = bw;
  s.step = step;
  s.domain = domain;
  s.center = (v) => s(v) + bw / 2;
  return s;
}


const DAY = 864e5;
const UNITS = [
  ['day', 1, DAY],
  ['day', 7, 7 * DAY],
  ['month', 1, 30.44 * DAY],
  ['month', 3, 91.3 * DAY],
  ['month', 6, 182.6 * DAY],
  ['year', 1, 365.25 * DAY],
  ['year', 2, 730.5 * DAY],
  ['year', 5, 1826 * DAY],
  ['year', 10, 3652 * DAY],
  ['year', 25, 9131 * DAY],
  ['year', 50, 18262 * DAY],
];

/** Marcas de tiempo legibles: elige la unidad que da ≤ `count` marcas. */
function timeTicks(t0, t1, count = 6, locale = 'es') {
  const span = Math.max(1, t1 - t0);
  let [unit, every] = UNITS.find(([, , ms]) => span / ms <= count) || UNITS[UNITS.length - 1];
  const out = [];
  const d = new Date(t0);
  let cur;
  if (unit === 'year') {
    const y = Math.ceil(d.getUTCFullYear() / every) * every;
    cur = Date.UTC(y, 0, 1);
    if (cur < t0) cur = Date.UTC(y + every, 0, 1);
    while (cur <= t1) {
      out.push(cur);
      cur = Date.UTC(new Date(cur).getUTCFullYear() + every, 0, 1);
    }
  } else if (unit === 'month') {
    let y = d.getUTCFullYear(), m = Math.ceil(d.getUTCMonth() / every) * every;
    cur = Date.UTC(y, m, 1);
    if (cur < t0) cur = Date.UTC(y, m + every, 1);
    while (cur <= t1) {
      out.push(cur);
      const c = new Date(cur);
      cur = Date.UTC(c.getUTCFullYear(), c.getUTCMonth() + every, 1);
    }
  } else {
    cur = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    if (cur < t0) cur += DAY;
    while (cur <= t1) {
      out.push(cur);
      cur += every * DAY;
    }
  }
  const label = (t, i) => {
    const dt = new Date(t);
    if (unit === 'year') return formatDate(t, 'year', locale);
    if (unit === 'month') {
      const first = i === 0 || dt.getUTCMonth() < every;
      if (every === 3) return formatDate(t, 'quarter', locale, first);
      return formatDate(t, 'month', locale, first);
    }
    const prev = i > 0 ? new Date(out[i - 1]) : null;
    return formatDate(t, 'day', locale, !prev || prev.getUTCFullYear() !== dt.getUTCFullYear());
  };
  return { ticks: out.map((t, i) => ({ value: t, label: label(t, i) })), unit, every };
}

/** Unidad natural de una serie de fechas (para tooltips). */
function dateUnit(times) {
  const ds = times.map((t) => new Date(t));
  if (ds.every((d) => d.getUTCMonth() === 0 && d.getUTCDate() === 1)) return 'year';
  if (ds.every((d) => d.getUTCDate() === 1)) return 'month';
  return 'day';
}

return { "niceStep": niceStep, "niceDomain": niceDomain, "linear": linear, "log": log, "logDomain": logDomain, "band": band, "timeTicks": timeTicks, "dateUnit": dateUnit };
});
__def("src/data.js", function () {
const { isDateLike, parseDate } = __req("src/format.js");

class PlotError extends Error {
  constructor(message, hint) {
    super(hint ? `${message}\n→ ${hint}` : message);
    this.name = 'PlotError';
    this.hint = hint;
  }
}

/** Convierte a número de forma tolerante ("1.234,5", "12%", "$ 3.000"). */
function num(v) {
  if (typeof v === 'number') return v;
  if (v === null || v === undefined || v === '' || typeof v === 'boolean') return NaN;
  let s = String(v).trim().replace(/[\s$€£%]|US\$|CLP|UF/g, '').replace('−', '-');
  const hasC = s.includes(','), hasD = s.includes('.');
  if (hasC && hasD) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (hasC) s = /,\d{3}(?!\d)/.test(s) && !/,\d{1,2}$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
  else if (hasD && /^\-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

function fieldsOf(data) {
  const set = new Set();
  for (const row of data.slice(0, 50)) if (row && typeof row === 'object') Object.keys(row).forEach((k) => set.add(k));
  return [...set];
}

function ensureData(spec) {
  let data = spec.data;
  if (!Array.isArray(data)) {
    if (data && typeof data === 'object') {
      data = Object.entries(data).map(([k, v]) => ({ label: k, value: v }));
    } else throw new PlotError('`data` debe ser un arreglo de objetos (filas).', 'Ejemplo: data: [{ region: "Biobío", ventas: 120 }]');
  }
  if (data.length && typeof data[0] !== 'object') {
    data = data.map((v, i) => ({ index: i + 1, value: v }));
  }
  return data.filter((r) => r && typeof r === 'object');
}

function requireField(data, field, role) {
  if (field === undefined || field === null) return;
  const fields = fieldsOf(data);
  if (!fields.includes(field)) {
    throw new PlotError(
      `El campo "${field}" (${role}) no existe en los datos.`,
      `Campos disponibles: ${fields.map((f) => `"${f}"`).join(', ') || '(ninguno)'}`
    );
  }
}

const isNumericField = (data, f) => {
  let n = 0, ok = 0;
  for (const r of data.slice(0, 200)) {
    const v = r[f];
    if (v === null || v === undefined || v === '') continue;
    n++;
    if (typeof v === 'number' || (typeof v === 'string' && !isDateLike(v) && Number.isFinite(num(v)))) ok++;
  }
  return n > 0 && ok / n > 0.9;
};

const fieldKind = (data, f) => {
  const vals = data.map((r) => r[f]).filter((v) => v !== null && v !== undefined && v !== '');
  if (!vals.length) return 'empty';
  if (vals.every((v) => isDateLike(v))) return 'date';
  if (isNumericField(data, f)) {
    const ns = vals.map(num);
    if (ns.every((v) => Number.isInteger(v) && v >= 1000 && v <= 2999)) return 'year';
    return 'number';
  }
  return 'category';
};

/** Elige x / y si el agente no los indicó. */
function inferXY(spec, data) {
  const fields = fieldsOf(data);
  const kinds = Object.fromEntries(fields.map((f) => [f, fieldKind(data, f)]));
  let { x, y } = spec;
  const nums = fields.filter((f) => kinds[f] === 'number');
  if (!x) x = fields.find((f) => kinds[f] === 'date' || kinds[f] === 'year') || fields.find((f) => kinds[f] === 'category') || fields.find((f) => f !== y);
  if (!y) y = nums.find((f) => f !== x) || fields.find((f) => f !== x);
  return { x, y, kinds };
}

/**
 * y: ['ventas', 'costos'] → formato largo con un campo de serie.
 * Así los agentes pueden pasar tablas anchas sin transformarlas.
 */
function melt(data, x, ys, seriesName = '__series', valueName = '__value', labels = {}) {
  const out = [];
  for (const r of data) for (const f of ys) out.push({ ...r, [x]: r[x], [seriesName]: labels[f] || humanize(f), [valueName]: r[f] });
  return out;
}

function uniq(arr) {
  const seen = new Set();
  const out = [];
  for (const v of arr) {
    const k = v instanceof Date ? v.getTime() : v;
    if (!seen.has(k)) { seen.add(k); out.push(v); }
  }
  return out;
}

function aggregate(values, how = 'sum') {
  const v = values.filter((n) => Number.isFinite(n));
  if (!v.length) return NaN;
  switch (how) {
    case 'mean': case 'avg': return v.reduce((a, b) => a + b, 0) / v.length;
    case 'max': return Math.max(...v);
    case 'min': return Math.min(...v);
    case 'count': return v.length;
    case 'last': return v[v.length - 1];
    case 'first': return v[0];
    default: return v.reduce((a, b) => a + b, 0);
  }
}

/** Valor de x normalizado: fecha → ms, año → número, si no, texto. */
function xValue(v, kind) {
  if (kind === 'date') return parseDate(v);
  if (kind === 'year' || kind === 'number') return num(v);
  return v === null || v === undefined ? '' : String(v);
}

const humanize = (f) =>
  String(f ?? '')
    .replace(/^__.*/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^\w/, (c) => c.toUpperCase());

return { "num": num, "fieldsOf": fieldsOf, "ensureData": ensureData, "requireField": requireField, "inferXY": inferXY, "melt": melt, "uniq": uniq, "aggregate": aggregate, "xValue": xValue, "PlotError": PlotError, "fieldKind": fieldKind, "humanize": humanize };
});
__def("src/axes.js", function () {
const { el, g, text } = __req("src/svg.js");
const { measure } = __req("src/text.js");
const { SIZES } = __req("src/frame.js");
const { ctx } = __req("src/context.js");

/** Líneas de grilla horizontales con etiquetas a la izquierda. */
function gridY(ticks, y, area, theme, fmt, { labels = true, baseline = 0 } = {}) {
  const out = [];
  for (const t of ticks) {
    const py = Math.round(y(t)) + 0.5;
    const isBase = t === baseline;
    out.push(el('line', { x1: area.x, x2: area.x + area.w, y1: py, y2: py, stroke: isBase ? theme.axis : theme.grid, strokeWidth: 1, shapeRendering: 'crispEdges' }));
    if (labels) out.push(text(area.x - 8, py + 4, fmt(t), { fill: theme.muted, fontSize: SIZES.axis, textAnchor: 'end' }));
  }
  return g({ class: 'pa-axis pa-axis-y' }, out);
}

/** Líneas de grilla verticales con etiquetas abajo. */
function gridX(ticks, x, area, theme, fmt, { labels = true, baseline = 0, lines = true } = {}) {
  const out = [];
  const items = ticks.map((t) => ({ pos: Math.round(x(t)) + 0.5, label: fmt(t), t }));
  for (const it of items) {
    if (lines) out.push(el('line', { x1: it.pos, x2: it.pos, y1: area.y, y2: area.y + area.h, stroke: it.t === baseline ? theme.axis : theme.grid, strokeWidth: 1, shapeRendering: 'crispEdges' }));
  }
  if (labels) out.push(xLabels(items, area, theme));
  return g({ class: 'pa-axis pa-axis-x' }, out);
}

/** Etiquetas bajo el eje x, raleadas si chocan (nunca rotadas). */
function xLabels(items, area, theme, { y, size = SIZES.axis, color } = {}) {
  const ly = (y ?? area.y + area.h + 18) + (ctx.textScale - 1) * 10;
  const widths = items.map((it) => measure(it.label, size));
  let every = 1;
  const fits = (k) => {
    let last = -Infinity;
    for (let i = 0; i < items.length; i += k) {
      const left = items[i].pos - widths[i] / 2;
      if (left < last + 10) return false;
      last = items[i].pos + widths[i] / 2;
    }
    return true;
  };
  while (every < items.length && !fits(every)) every++;
  const out = [];
  items.forEach((it, i) => {
    if (i % every) return;
    let anchor = 'middle';
    let px = it.pos;
    const half = widths[i] / 2;
    const ov = Math.min(20, Math.max(0, area.x));
    if (px - half < area.x - ov) { anchor = 'start'; px = Math.max(px - 4, area.x - ov); }
    if (px + half > area.x + area.w + ov) { anchor = 'end'; px = Math.min(px + 4, area.x + area.w + ov); }
    out.push(text(px, ly, it.label, { fill: color || theme.muted, fontSize: size, textAnchor: anchor }));
  });
  return g({}, out);
}

const ticksWidth = (ticks, fmt, size = SIZES.axis) => Math.max(0, ...ticks.map((t) => measure(fmt(t), size)));


const isInside = (theme, inside) => inside ?? theme.axes?.inside ?? true;

/** Margen izquierdo que necesita el eje y (0 si las etiquetas van dentro). */
function yAxisMargin(ticks, fmt, theme, inside) {
  return isInside(theme, inside) ? 0 : ticksWidth(ticks, fmt, theme.type?.axis ?? SIZES.axis) + 10;
}
/** Espacio superior para la etiqueta de la marca más alta. */
const yAxisTop = (theme, inside) => (isInside(theme, inside) ? 14 * ctx.textScale : 6);

function yGrid(ticks, y, area, theme, { baseline = 0 } = {}) {
  return g({ class: 'pa-grid' }, ticks.map((t) => {
    const py = Math.round(y(t)) + 0.5;
    return el('line', { x1: area.x, x2: area.x + area.w, y1: py, y2: py, stroke: t === baseline ? theme.axis : theme.grid, strokeWidth: 1, shapeRendering: 'crispEdges' });
  }));
}

function yTickLabels(ticks, y, area, theme, fmt, { inside, unit } = {}) {
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
function refLinesY(refs = [], y, area, theme, fmt) {
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

function refLinesX(refs = [], x, area, theme, fmt) {
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
function quietCorner(points, inner, w, h = 14, pad = 8) {
  const m = 10;
  const cands = [
    { k: 'tr', x0: inner.x + inner.w - pad - w, y0: inner.y + 2, tx: inner.x + inner.w - pad, ty: inner.y + 2 + h - 3, anchor: 'end' },
    { k: 'br', x0: inner.x + inner.w - pad - w, y0: inner.y + inner.h - h - 4, tx: inner.x + inner.w - pad, ty: inner.y + inner.h - 7, anchor: 'end' },
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

return { "gridY": gridY, "gridX": gridX, "xLabels": xLabels, "yAxisMargin": yAxisMargin, "yGrid": yGrid, "yTickLabels": yTickLabels, "refLinesY": refLinesY, "refLinesX": refLinesX, "quietCorner": quietCorner, "ticksWidth": ticksWidth, "isInside": isInside, "yAxisTop": yAxisTop };
});
__def("src/frame.js", function () {
const { el, esc, g, text, r2 } = __req("src/svg.js");
const { measure, wrap } = __req("src/text.js");
const { FONT, FONT_CSS } = __req("src/theme.js");
const { ctx } = __req("src/context.js");

const SIZES = {
  title: 22,
  subtitle: 14.5,
  label: 12,
  axis: 12,
  legend: 12.5,
  source: 11,
};

function createFrame(spec, theme, defaults = {}) {
  const width = Math.max(240, +spec.width || defaults.width || 720);
  const XS = ctx.textScale;
  let height = Math.max(160, +spec.height || Math.round((defaults.height || 420) * (1 + 0.55 * (XS - 1))));
  const k = width < 420 ? 0.86 : width < 560 ? 0.93 : 1;
  const T0 = { ...SIZES, ...(theme.type || {}) };
  const T = { ...T0, title: Math.round(T0.title * k * 2) / 2, subtitle: Math.max(12, Math.round(T0.subtitle * (k < 1 ? 0.95 : 1) * 2) / 2) };
  const pad = spec.padding ?? (width < 420 ? theme.layout?.paddingSmall ?? 12 : width < 640 ? 16 : theme.layout?.padding ?? 24);
  const innerW = width - pad * 2;
  const parts = [];
  let y = pad;

  const tw = T.titleWeight ?? 600;
  const titleLines = spec.title ? wrap(spec.title, innerW, T.title, tw, 5) : [];
  const subLines = spec.subtitle ? wrap(spec.subtitle, innerW, T.subtitle, 400, 5) : [];
  const header = [];
  const X = ctx.textScale; // alturas de línea crecen con la escala de texto
  const tlh = Math.round(T.title * X * 1.3), slh = Math.round(T.subtitle * X * 1.42);
  titleLines.forEach((l, i) => {
    header.push(text(pad, y + T.title * X * 0.9 + i * tlh, l, { fill: theme.ink, fontSize: T.title, fontWeight: tw, letterSpacing: '-0.01em' }));
  });
  if (titleLines.length) y += titleLines.length * tlh + 2;
  subLines.forEach((l, i) => {
    header.push(text(pad, y + T.subtitle * X * 1.0 + i * slh, l, { fill: theme.lede, fontSize: T.subtitle }));
  });
  if (subLines.length) y += subLines.length * slh + 2;
  if (titleLines.length || subLines.length) y += 10;

  const sourceH = spec.source ? Math.round(18 * Math.max(1, X * 0.95)) : 0;

  const frame = {
    width,
    pad,
    theme,
    get height() { return height; },
    top: y,
    get bottom() { return height - pad - sourceH; },
    /** Alto extra fuera del área de trazado (pie + margen). */
    chrome: pad + sourceH,
    /** Dibuja la leyenda y devuelve el área de trazado restante. */
    layout(legend = [], opts = {}) {
      let ly = y;
      if (legend && legend.length) {
        const { svg, h } = drawLegend(legend, pad, ly, innerW, theme, { ...opts, size: T.legend });
        header.push(svg);
        ly += h + 10; // la leyenda pegada al gráfico que explica
      }
      return { x: pad, y: ly, w: innerW, h: Math.max(40, frame.bottom - ly - Math.max(0, (XS - 1) * 22)) };
    },
    /** Permite a gráficos de alto automático (kpi) fijar el alto final. */
    setHeight(h) { height = h; },
    finish(body, { desc = '', type = 'chart', defs = '' } = {}) {
      if (spec.source) {
        const src = /^fuente|^source/i.test(spec.source) ? spec.source : (String(spec.locale || 'es').startsWith('en') ? 'Source: ' : 'Fuente: ') + spec.source;
        parts.push(text(width - pad, height - pad - 2, src, { fill: theme.muted, fontSize: T.source, textAnchor: 'end' }));
      }
      const id = 'pa' + Math.abs(hash((spec.title || '') + type + width)).toString(36);
      const fontImport = spec.fontImport ? `@import url('${theme.font?.import || FONT_CSS}');` : '';
      const style = `${fontImport}.pa-m{transition:opacity .15s ease}.pa-focus .pa-m{opacity:.28}.pa-focus .pa-m.pa-on{opacity:1}`
        + (/^(choropleth|symbolmap)$/.test(type) ? '.pa-zoom path,.pa-zoom circle,.pa-zoom rect{vector-effect:non-scaling-stroke}.pa-zoom-hide{transition:opacity .2s ease}.pa-zoomed .pa-zoom-hide{opacity:0}' : '');
      return el(
        'svg',
        {
          xmlns: 'http://www.w3.org/2000/svg',
          viewBox: `0 0 ${width} ${r2(height)}`,
          width,
          height: r2(height),
          role: 'img',
          'aria-labelledby': `${id}-t ${id}-d`,
          fontFamily: spec.fontFamily || theme.font?.family || FONT,
          class: 'pa-chart',
          'data-pa-type': type,
          'data-pa-mode': theme.mode,
          'data-pa-lang': String(spec.locale || 'es').slice(0, 2),
          style: 'max-width:100%;height:auto;font-variant-numeric:lining-nums',
        },
        [
          el('title', { id: `${id}-t` }, esc(spec.title || type)),
          el('desc', { id: `${id}-d` }, esc(desc)),
          el('style', {}, style),
          defs ? el('defs', {}, defs) : '',
          spec.background === false ? '' : el('rect', { width, height: r2(height), fill: theme.surface }),
          g({ class: 'pa-header' }, header),
          g({ class: 'pa-body' }, body),
          parts.join(''),
        ]
      );
    },
  };
  return frame;
}

function drawLegend(items, x0, y0, maxW, theme, opts) {
  const out = [];
  const size = opts.size ?? SIZES.legend;
  const X = ctx.textScale;
  const rowH = Math.round(20 * X);
  let x = x0, y = y0, rows = 1;
  for (const it of items) {
    if (it.type === 'ramp') {
      const w = Math.min(220, maxW);
      const gid = 'pa-ramp-' + Math.abs(hash(it.stops.join(''))).toString(36);
      const stops = it.stops.map((c, i) => el('stop', { offset: `${(i / (it.stops.length - 1)) * 100}%`, stopColor: c }));
      out.push(el('defs', {}, el('linearGradient', { id: gid }, stops)));
      if (it.title) { out.push(text(x, y + 10, it.title, { fill: theme.lede, fontSize: size })); x += measure(it.title, size) + 10; }
      out.push(text(x, y + 10, it.min, { fill: theme.muted, fontSize: SIZES.axis }));
      x += measure(it.min, SIZES.axis) + 6;
      out.push(el('rect', { x, y: y + 2, width: w * 0.6, height: 10, rx: 5, fill: `url(#${gid})` }));
      x += w * 0.6 + 6;
      out.push(text(x, y + 10, it.max, { fill: theme.muted, fontSize: SIZES.axis }));
      x += measure(it.max, SIZES.axis) + 18;
      continue;
    }
    const label = String(it.label);
    const w = 18 * X + measure(label, size) + 18;
    if (x + w > x0 + maxW && x > x0) { x = x0; y += rowH; rows++; }
    const cy = y + 6.5 * X;
    out.push(`<g class="pa-key" data-color="${esc(it.key ?? it.color)}" style="cursor:pointer">`);
    out.push(el('rect', { x: x - 3, y: y - 3, width: w - 10, height: rowH - 1, rx: 4, fill: 'transparent' }));
    const sw = 10 * Math.min(1.6, X);
    if (it.shape === 'line') out.push(el('line', { x1: x, x2: x + sw * 1.2, y1: cy, y2: cy, stroke: it.color, strokeWidth: 2.5, strokeLinecap: it.dashed ? 'butt' : 'round', strokeDasharray: it.dashed ? '4 2.5' : null }));
    else if (it.shape === 'square' && it.dashed) out.push(el('rect', { x: x + 0.6, y: cy - sw / 2 + 0.6, width: sw - 1.2, height: sw - 1.2, rx: 2, fill: it.fill || it.color, stroke: it.stroke || it.color, strokeWidth: 1.2, strokeDasharray: '3 2' }));
    else if (it.shape === 'square') out.push(el('rect', { x, y: cy - sw / 2, width: sw, height: sw, rx: 2.5, fill: it.color }));
    else out.push(el('circle', { cx: x + sw / 2, cy, r: sw / 2, fill: it.color }));
    out.push(text(x + sw + 6, y + 11 * X, label, { fill: theme.lede, fontSize: size }));
    out.push('</g>');
    x += w;
  }
  return { svg: g({ class: 'pa-legend' }, out), h: rows * rowH - 6 * X };
}

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

return { "createFrame": createFrame, "hash": hash, "SIZES": SIZES };
});
__def("src/stats.js", function () {

const finite = (vs) => vs.filter((v) => Number.isFinite(v));
const sum = (vs) => vs.reduce((a, b) => a + b, 0);
const mean = (vs) => (vs.length ? sum(vs) / vs.length : NaN);

function variance(vs) {
  const n = vs.length;
  if (n < 2) return 0;
  const m = mean(vs);
  return vs.reduce((a, v) => a + (v - m) ** 2, 0) / (n - 1);
}
const sd = (vs) => Math.sqrt(variance(vs));

/** Cuantil con interpolación lineal (tipo 7, como numpy/R). `sorted` ordenado. */
function quantile(sorted, p) {
  if (!sorted.length) return NaN;
  const h = (sorted.length - 1) * p;
  const lo = Math.floor(h), hi = Math.ceil(h);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (h - lo);
}
const median = (vs) => quantile([...vs].sort((a, b) => a - b), 0.5);

/** Cuantil de la normal estándar (Acklam). */
function zQuantile(p) {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const pl = 0.02425;
  let q, r;
  if (p < pl) { q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  if (p > 1 - pl) { q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  q = p - 0.5; r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

/** Cuantil de la t de Student (expansión de Cornish-Fisher; exacta a ~1e-3 para df ≥ 3). */
function tQuantile(df, p = 0.975) {
  if (df <= 0) return NaN;
  if (df === 1) return Math.tan(Math.PI * (p - 0.5));
  if (df === 2) { const a = 4 * p * (1 - p); return (2 * p - 1) * Math.sqrt(2 / a); }
  const z = zQuantile(p);
  const z3 = z ** 3, z5 = z ** 5, z7 = z ** 7, z9 = z ** 9;
  return z + (z3 + z) / (4 * df) + (5 * z5 + 16 * z3 + 3 * z) / (96 * df ** 2) + (3 * z7 + 19 * z5 + 17 * z3 - 15 * z) / (384 * df ** 3) + (79 * z9 + 776 * z7 + 1482 * z5 - 1920 * z3 - 945 * z) / (92160 * df ** 4);
}

/** Intervalo de confianza de la media (t de Student). */
function meanCI(vs, level = 0.95) {
  const v = finite(vs);
  const m = mean(v);
  if (v.length < 2) return [m, m];
  const h = tQuantile(v.length - 1, 0.5 + level / 2) * sd(v) / Math.sqrt(v.length);
  return [m - h, m + h];
}

/** Resumen para cajas: cuartiles, bigotes a 1,5·RIC y atípicos. */
function fiveNumber(vs) {
  const s = finite(vs).sort((a, b) => a - b);
  const q1 = quantile(s, 0.25), med = quantile(s, 0.5), q3 = quantile(s, 0.75);
  const iqr = q3 - q1;
  const loF = q1 - 1.5 * iqr, hiF = q3 + 1.5 * iqr;
  const inside = s.filter((v) => v >= loF && v <= hiF);
  return {
    n: s.length, min: s[0], max: s[s.length - 1], q1, median: med, q3, iqr, mean: mean(s),
    whiskerLo: inside.length ? inside[0] : q1, whiskerHi: inside.length ? inside[inside.length - 1] : q3,
    outliers: s.filter((v) => v < loF || v > hiF),
  };
}

const niceBinStep = (span, n) => {
  const raw = span / Math.max(1, n);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const f = raw / mag;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag;
};

/**
 * Histograma con anchos "bonitos". Por defecto, regla de Freedman–Diaconis
 * acotada a 5–50 barras. Opciones: bins (número), binWidth, domain [a,b].
 */
function histogram(vs, { bins, binWidth, domain } = {}) {
  const s = finite(vs).sort((a, b) => a - b);
  if (!s.length) return [];
  let [lo, hi] = domain || [s[0], s[s.length - 1]];
  if (lo === hi) { lo -= 0.5; hi += 0.5; }
  let step = binWidth;
  if (!step) {
    let n = bins;
    if (!n) {
      const iqr = quantile(s, 0.75) - quantile(s, 0.25);
      const fd = iqr > 0 ? 2 * iqr / Math.cbrt(s.length) : 0;
      n = fd > 0 ? Math.ceil((hi - lo) / fd) : Math.ceil(Math.log2(s.length) + 1);
      n = Math.max(5, Math.min(50, n));
    }
    step = bins ? (hi - lo) / bins : niceBinStep(hi - lo, n);
  }
  const start = bins ? lo : Math.floor(lo / step + 1e-9) * step;
  const count = Math.max(1, Math.ceil((hi - start) / step - 1e-9));
  const out = Array.from({ length: count }, (_, i) => ({ x0: start + i * step, x1: start + (i + 1) * step, count: 0 }));
  for (const v of s) {
    let i = Math.floor((v - start) / step);
    if (i >= count) i = count - 1;
    if (i >= 0) out[i].count++;
  }
  return out;
}

/** Ancho de banda de Scott (el de seaborn por defecto). */
function scottBandwidth(vs) {
  const v = finite(vs);
  const s = sd(v);
  const iqr = quantile([...v].sort((a, b) => a - b), 0.75) - quantile([...v].sort((a, b) => a - b), 0.25);
  const sigma = Math.min(s, iqr / 1.349) || s || 1;
  return 1.06 * sigma * v.length ** -0.2;
}

/**
 * Densidad por kernel gaussiano. Devuelve [[x, densidad], ...] en una grilla.
 * `cut` extiende la grilla `cut` anchos de banda más allá de los extremos.
 */
function kde(vs, { bandwidth, adjust = 1, gridSize = 160, extent, cut = 3, clip } = {}) {
  const v = finite(vs);
  if (!v.length) return [];
  const bw = (bandwidth ?? scottBandwidth(v)) * adjust || 1;
  let [lo, hi] = extent || [Math.min(...v) - cut * bw, Math.max(...v) + cut * bw];
  if (clip) { lo = Math.max(lo, clip[0]); hi = Math.min(hi, clip[1]); }
  const k = 1 / (v.length * bw * Math.sqrt(2 * Math.PI));
  const out = [];
  for (let i = 0; i < gridSize; i++) {
    const x = lo + ((hi - lo) * i) / (gridSize - 1);
    let d = 0;
    for (const xi of v) { const u = (x - xi) / bw; if (u > -6 && u < 6) d += Math.exp(-0.5 * u * u); }
    out.push([x, d * k]);
  }
  return out;
}

/** Función de distribución empírica: [[x, proporción acumulada], ...]. */
function ecdf(vs) {
  const s = finite(vs).sort((a, b) => a - b);
  return s.map((x, i) => [x, (i + 1) / s.length]);
}


function solve(A, b) {
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    const d = M[c][c] || 1e-12;
    for (let k = c; k <= n; k++) M[c][k] /= d;
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  return M.map((row) => row[n]);
}

function inverse(A) {
  const n = A.length;
  return A.map((_, j) => solve(A, A.map((__, i) => (i === j ? 1 : 0)))).reduce((acc, col, j) => {
    col.forEach((v, i) => { acc[i][j] = v; });
    return acc;
  }, A.map(() => new Array(n).fill(0)));
}

/**
 * Regresión polinomial por mínimos cuadrados (order 1 = lineal), con banda de
 * confianza para la media de y. Devuelve { coef, predict(x), band(x) → [lo,hi], r2, n }.
 */
function polyfit(xs, ys, { order = 1, level = 0.95 } = {}) {
  const pts = xs.map((x, i) => [x, ys[i]]).filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  const n = pts.length;
  const p = order + 1;
  if (n <= p) {
    const my = mean(pts.map((q) => q[1]));
    return { coef: [my], predict: () => my, band: () => [my, my], r2: 0, n };
  }
  const mx = mean(pts.map((q) => q[0]));
  const row = (x) => Array.from({ length: p }, (_, k) => (x - mx) ** k);
  const X = pts.map(([x]) => row(x));
  const XtX = Array.from({ length: p }, (_, i) => Array.from({ length: p }, (_, j) => X.reduce((a, r) => a + r[i] * r[j], 0)));
  const Xty = Array.from({ length: p }, (_, i) => X.reduce((a, r, k) => a + r[i] * pts[k][1], 0));
  const beta = solve(XtX, Xty);
  const predict = (x) => row(x).reduce((a, v, k) => a + v * beta[k], 0);
  const resid = pts.map(([x, y]) => y - predict(x));
  const sse = sum(resid.map((r) => r * r));
  const my = mean(pts.map((q) => q[1]));
  const sst = sum(pts.map(([, y]) => (y - my) ** 2));
  const s2 = sse / (n - p);
  const inv = inverse(XtX);
  const t = tQuantile(n - p, 0.5 + level / 2);
  const band = (x) => {
    const r = row(x);
    let v = 0;
    for (let i = 0; i < p; i++) for (let j = 0; j < p; j++) v += r[i] * inv[i][j] * r[j];
    const h = t * Math.sqrt(Math.max(0, s2 * v));
    const yh = predict(x);
    return [yh - h, yh + h];
  };
  return { coef: beta, center: mx, predict, band, r2: sst ? 1 - sse / sst : 0, n };
}

/** Pearson r. */
function pearson(xs, ys) {
  const pts = xs.map((x, i) => [x, ys[i]]).filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  const mx = mean(pts.map((p) => p[0])), my = mean(pts.map((p) => p[1]));
  let sxy = 0, sxx = 0, syy = 0;
  for (const [x, y] of pts) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0;
}

/** LOWESS (Cleveland): suavizado local robusto. Devuelve [[x, y], ...] ordenado. */
function lowess(xs, ys, { frac = 2 / 3, iters = 2 } = {}) {
  const pts = xs.map((x, i) => [x, ys[i]]).filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y)).sort((a, b) => a[0] - b[0]);
  const n = pts.length;
  if (n < 3) return pts;
  const r = Math.max(2, Math.ceil(frac * n));
  let robust = new Array(n).fill(1);
  let fit = new Array(n).fill(0);
  for (let it = 0; it <= iters; it++) {
    for (let i = 0; i < n; i++) {
      const x0 = pts[i][0];
      const d = pts.map(([x]) => Math.abs(x - x0)).sort((a, b) => a - b);
      const h = d[Math.min(n - 1, r - 1)] || 1e-12;
      let sw = 0, swx = 0, swy = 0, swxx = 0, swxy = 0;
      for (let j = 0; j < n; j++) {
        const u = Math.abs(pts[j][0] - x0) / h;
        const w = u < 1 ? (1 - u ** 3) ** 3 * robust[j] : 0;
        sw += w; swx += w * pts[j][0]; swy += w * pts[j][1]; swxx += w * pts[j][0] ** 2; swxy += w * pts[j][0] * pts[j][1];
      }
      const den = sw * swxx - swx * swx;
      fit[i] = Math.abs(den) < 1e-12 ? swy / (sw || 1) : ((swxx * swy - swx * swxy) + (sw * swxy - swx * swy) * x0) / den;
    }
    const res = pts.map(([, y], i) => Math.abs(y - fit[i]));
    const m = median(res) || 1e-12;
    robust = res.map((e) => { const u = e / (6 * m); return u < 1 ? (1 - u * u) ** 2 : 0; });
  }
  return pts.map(([x], i) => [x, fit[i]]);
}

return { "variance": variance, "quantile": quantile, "zQuantile": zQuantile, "tQuantile": tQuantile, "meanCI": meanCI, "fiveNumber": fiveNumber, "histogram": histogram, "scottBandwidth": scottBandwidth, "kde": kde, "ecdf": ecdf, "polyfit": polyfit, "pearson": pearson, "lowess": lowess, "finite": finite, "sum": sum, "mean": mean, "sd": sd, "median": median };
});
__def("src/dashed.js", function () {
const { el } = __req("src/svg.js");
const { ramp, readable } = __req("src/theme.js");

/** Trazos discontinuos: contornos cortos y finos; líneas algo más largas. */
const DASH = { outline: '4 2.5', line: '5 6', legend: '3.5 2.5' };

const TRUE = /^(true|1|s[ií]|yes|y|x|✓)$/i;
const truthy = (v) => v === true || v === 1 || (typeof v === 'string' && TRUE.test(v.trim()));

/**
 * Devuelve una función (clave, serie?) → boolean, o null si no hay `dashed`.
 * `keyField` y `seriesField` dicen qué campos identifican cada forma.
 */
function dashedMatcher(spec, data, keyField, seriesField, norm = String) {
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
function fromTest(spec, toNum) {
  if (spec.dashedFrom === undefined || spec.dashedFrom === null) return null;
  const t = toNum(spec.dashedFrom);
  return Number.isFinite(t) ? (x) => Number.isFinite(x) && x >= t : null;
}

const isHex = (c) => /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(String(c || ''));

/**
 * Fábrica de rellenos rayados, uno por color. `fill(c)` da el url(#…) y
 * `defs()` los <pattern> que hay que poner en el SVG.
 */
function hatcher(theme, id) {
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
function dashedAttrs(H, color, { width = 1.25 } = {}) {
  return { fill: H.fill(color), stroke: H.stroke(color), strokeWidth: width, strokeDasharray: DASH.outline, 'data-dashed': '1', 'data-color': color };
}

const T = (locale, es, en) => (String(locale || 'es').startsWith('en') ? en : es);
/** Texto por defecto para la leyenda cuando el agente no da `dashedLabel`. */
const dashedDefaultLabel = (locale) => T(locale, 'Estimado', 'Estimate');

return { "dashedMatcher": dashedMatcher, "fromTest": fromTest, "hatcher": hatcher, "dashedAttrs": dashedAttrs, "DASH": DASH, "dashedDefaultLabel": dashedDefaultLabel };
});
__def("src/other.js", function () {

/** Umbral por defecto: menos del 1% del total se agrupa en "Otros". */
const DEFAULT_THRESHOLD = 0.01;

const OTHER_NAMES = new Set(['otros', 'otras', 'otro', 'otra', 'other', 'others', 'resto', 'rest', 'demás', 'los demás', 'las demás']);

/** ¿El nombre ya es un cajón "Otros" (venga de los datos o del agrupamiento)? */
const isOtherName = (name, label) => (label !== undefined && String(name) === String(label)) || OTHER_NAMES.has(String(name).trim().toLowerCase());

/** Nombre del cajón: `otherLabel` del spec, o "Otros" / "Other" según el idioma. */
const otherLabel = (spec) => (typeof spec.otherLabel === 'string' && spec.otherLabel ? spec.otherLabel : String(spec.locale || 'es').startsWith('en') ? 'Other' : 'Otros');

/**
 * Umbral como fracción del total (0–1). Acepta 0.02, "2%" o 2 (= 2%).
 * `threshold: false` o 0 lo apaga.
 */
function thresholdOf(spec) {
  const t = spec.threshold;
  if (t === false || t === null || t === 0) return 0;
  if (t === undefined || t === true) return DEFAULT_THRESHOLD;
  const n = typeof t === 'string' ? parseFloat(t.replace(',', '.')) / (t.includes('%') ? 100 : 1) : Number(t);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n >= 1 ? n / 100 : n;
}

/**
 * Decide qué elementos se agrupan. `items` va en el orden de dibujo;
 * `value(it)` es su tamaño. Devuelve { keep, fold, others } donde `others`
 * son los que ya se llamaban "Otros" en los datos (se fusionan con `fold`).
 * Solo agrupa si hay al menos dos bajo el umbral: un "Otros" de uno no aporta.
 */
function splitOther(items, { value, name, threshold, total, protect, label, top }) {
  const others = items.filter((it) => isOtherName(name(it), label));
  const rest = items.filter((it) => !others.includes(it));
  const small = (it, i) => !(protect && protect(it)) && ((top && i >= top) || (threshold > 0 && total > 0 && value(it) / total < threshold));
  let fold = rest.filter(small);
  if (fold.length < 2 && !others.length && !(top && rest.length > top)) fold = [];
  const keep = rest.filter((it) => !fold.includes(it));
  return { keep, fold, others };
}

return { "thresholdOf": thresholdOf, "splitOther": splitOther, "DEFAULT_THRESHOLD": DEFAULT_THRESHOLD, "isOtherName": isOtherName, "otherLabel": otherLabel };
});
__def("src/charts/line.js", function () {
const { el, g, text, tip } = __req("src/svg.js");
const { measure, truncate } = __req("src/text.js");
const { makeFormat, formatDate, parseDate } = __req("src/format.js");
const { niceDomain, linear, log, logDomain, timeTicks, dateUnit, niceStep } = __req("src/scale.js");
const { colorMap, readable } = __req("src/theme.js");
const { ensureData, inferXY, requireField, melt, uniq, aggregate, num, fieldKind, xValue, humanize } = __req("src/data.js");
const { xLabels, refLinesY, yAxisMargin, yAxisTop, yGrid, yTickLabels } = __req("src/axes.js");
const { createFrame } = __req("src/frame.js");
const { ctx } = __req("src/context.js");
const { meanCI, mean, sd } = __req("src/stats.js");
const { hash } = __req("src/frame.js");
const { dashedMatcher, fromTest, hatcher, dashedDefaultLabel, DASH } = __req("src/dashed.js");

function prepareLine(spec) {
  let data = ensureData(spec);
  let series = spec.series ?? spec.hue ?? spec.color;
  let y = spec.y;
  if (Array.isArray(y)) {
    if (y.length > 1) {
      data = melt(data, spec.x, y, '__series', '__value', spec.labelsFor || {});
      series = '__series';
      y = '__value';
    } else y = y[0];
  }
  const inf = inferXY({ ...spec, y }, data);
  const x = inf.x;
  y = y || inf.y;
  requireField(data, x, 'x');
  requireField(data, y, 'y');
  if (series) requireField(data, series, 'series');
  const kind = fieldKind(data, x);
  const cats = kind === 'category' ? uniq(data.map((r) => String(r[x]))) : null;
  const seriesKeys = series ? uniq(data.map((r) => String(r[series]))) : [humanize(y) || 'Serie'];

  const range = spec.xRange;
  const rv = (v) => (v === undefined || v === null ? null : kind === 'date' ? parseDate(v) : kind === 'category' ? cats.indexOf(String(v)) : num(v));
  const [r0, r1] = range ? [rv(range[0]), rv(range[1])] : [null, null];

  const map = new Map(seriesKeys.map((s) => [s, new Map()]));
  for (const r of data) {
    const s = series ? String(r[series]) : seriesKeys[0];
    const xv = kind === 'category' ? cats.indexOf(String(r[x])) : xValue(r[x], kind);
    if (!Number.isFinite(xv)) continue;
    if (r0 !== null && Number.isFinite(r0) && xv < r0) continue;
    if (r1 !== null && Number.isFinite(r1) && xv > r1) continue;
    const m = map.get(s);
    if (!m.has(xv)) m.set(xv, []);
    m.get(xv).push(num(r[y]));
  }
  const errorbar = spec.errorbar ?? (spec.ci === true || typeof spec.ci === 'number' ? 'ci' : null);
  const how = spec.aggregate ?? spec.estimator ?? (errorbar ? 'mean' : 'sum');
  const level = typeof spec.ci === 'number' ? (spec.ci > 1 ? spec.ci / 100 : spec.ci) : 0.95;
  let lines = seriesKeys.map((s) => ({
    key: s,
    points: [...map.get(s).entries()]
      .map(([xv, ys]) => {
        const v = ys.filter(Number.isFinite);
        const p = { x: xv, y: aggregate(v, how), n: v.length };
        if (errorbar && v.length > 1) {
          if (errorbar === 'sd') { const m = mean(v), d = sd(v); p.lo = m - d; p.hi = m + d; }
          else if (errorbar === 'se') { const m = mean(v), d = sd(v) / Math.sqrt(v.length); p.lo = m - d; p.hi = m + d; }
          else [p.lo, p.hi] = meanCI(v, level);
        }
        return p;
      })
      .sort((a, b) => a.x - b.x),
  }));
  if (spec.index) {
    lines = lines.map((l) => {
      const base = l.points.find((p) => Number.isFinite(p.y) && p.y !== 0)?.y;
      const k = base ? 100 / base : NaN;
      return { ...l, points: l.points.map((p) => ({ ...p, raw: p.y, y: p.y * k, lo: p.lo * k, hi: p.hi * k })) };
    });
  }
  return { data, x, y, series, seriesKeys, lines, kind, cats, errorbar };
}

function line(spec, theme, variant = 'line') {
  const m = prepareLine(spec);
  const locale = spec.locale || 'es';
  const M = theme.marks || {};
  const isArea = variant === 'area' || spec.area === true;
  const multi = m.lines.length > 1;
  const stack = isArea && multi && spec.stack !== false;
  const pct = stack && (spec.stack === 'percent' || spec.normalize);
  const xsAll = uniq(m.lines.flatMap((l) => l.points.map((p) => p.x))).sort((a, b) => a - b);
  if (!xsAll.length) return createFrame(spec, theme).finish([], { desc: '', type: variant });

  if (stack) {
    const tot = new Map(xsAll.map((xv) => [xv, 0]));
    for (const l of m.lines) for (const p of l.points) if (Number.isFinite(p.y)) tot.set(p.x, tot.get(p.x) + p.y);
    const base = new Map(xsAll.map((xv) => [xv, 0]));
    for (const l of m.lines) {
      const byX = new Map(l.points.map((p) => [p.x, p.y]));
      l.points = xsAll.map((xv) => {
        let v = Number.isFinite(byX.get(xv)) ? byX.get(xv) : 0;
        if (pct) v = tot.get(xv) ? v / tot.get(xv) : 0;
        const y0 = base.get(xv);
        base.set(xv, y0 + v);
        return { x: xv, y: y0 + v, y0, v };
      });
    }
  }

  const allY = m.lines.flatMap((l) => l.points.flatMap((p) => [p.y, p.lo, p.hi])).filter(Number.isFinite);
  const rawY = m.lines.flatMap((l) => l.points.map((p) => p.v ?? p.y)).filter(Number.isFinite);
  const fmt = pct
    ? makeFormat({ type: 'percent', scale: 100, decimals: spec.format?.decimals }, locale)
    : spec.index ? makeFormat({ type: 'number', decimals: spec.format?.decimals ?? 0 }, locale) : makeFormat(spec.format, locale, rawY);
  let ymin = Math.min(...allY), ymax = Math.max(...allY);
  const refs = spec.refLines || [];
  for (const r of refs) if (r.y !== undefined) { ymin = Math.min(ymin, r.y); ymax = Math.max(ymax, r.y); }
  const yLog = spec.yScale === 'log' && ymin > 0;
  const zero = !yLog && (spec.zero ?? (isArea || (ymin >= 0 && ymin <= ymax * 0.45) || (ymax <= 0 && ymax >= ymin * 0.45)));
  if (zero) { ymin = Math.min(0, ymin); ymax = Math.max(0, ymax); }
  if (spec.yDomain) [ymin, ymax] = spec.yDomain;

  const cmap = colorMap(m.seriesKeys, theme, spec.colors);
  const hl = spec.highlight === undefined ? null : new Set([].concat(spec.highlight).map(String));
  const focus = (k) => !hl || hl.has(k);
  const colorOf = (k) => (focus(k) ? (!multi ? (spec.colors?.[k] || theme.categorical[0]) : cmap.get(k)) : theme.dim);

  const dm = dashedMatcher(spec, [], null, null);
  const dashedSeries = (k) => !!(dm && dm(k));
  const fromT = fromTest(spec, (v) => (m.kind === 'category' ? m.cats.indexOf(String(v)) : typeof v === 'number' && m.kind === 'date' ? v : xValue(v, m.kind)));
  const dashedLabel = spec.dashedLabel ?? dashedDefaultLabel(locale);

  const labelMode = spec.labels ?? 'auto';
  const lastOf = (l) => [...l.points].reverse().find((p) => Number.isFinite(p.y));
  const labelSize = theme.type?.label ?? 12;
  const endText = (l) => {
    const last = lastOf(l);
    if (!last) return null;
    const val = fmt(stack ? last.v : last.y);
    return multi ? { name: truncate(l.key, 132, labelSize), val } : { name: '', val };
  };

  const frame = createFrame(spec, theme, { height: 400 });
  const want = labelMode !== false;
  const provisionalH = frame.bottom - frame.top - 40;
  const maxLabels = Math.max(1, Math.floor(provisionalH / (labelSize * ctx.textScale + 3)));
  const labeled = want ? m.lines.filter((l) => focus(l.key)).sort((a, b) => (lastOf(b)?.y ?? -Infinity) - (lastOf(a)?.y ?? -Infinity)).slice(0, maxLabels) : [];
  const allLabeled = labeled.length === m.lines.filter((l) => focus(l.key)).length;
  const needLegend = multi && (!want || !allLabeled || spec.legend === true) && spec.legend !== false;
  const legend = needLegend ? m.seriesKeys.map((s) => ({ label: s, color: colorOf(s), shape: isArea ? 'square' : 'line', dashed: dashedSeries(s) })) : [];
  const area = frame.layout(legend);

  const endW = labeled.length
    ? Math.max(...labeled.map((l) => { const t = endText(l); return t ? measure(t.val, labelSize, 600) + (t.name ? measure(t.name, labelSize, 500) * 1.04 + 6 * ctx.textScale : 0) : 0; })) + 22
    : 10;

  const nd = yLog ? logDomain(ymin, ymax) : spec.yDomain ? { min: ymin, max: ymax, step: niceStep(ymax - ymin, Math.max(3, Math.round(area.h / 64))) } : niceDomain(ymin, ymax, Math.max(3, Math.round(area.h / 64)));
  const tickF = yLog ? (v) => fmt.tick(v)(v) : fmt.tick(nd.step);
  const yTicksArr = (yLog ? log(nd.min, nd.max, 0, 1) : linear(nd.min, nd.max, 0, 1)).ticks(nd.step);
  const inside = stack ? false : spec.axisInside;
  const leftM = yAxisMargin(yTicksArr, tickF, theme, inside);
  const yTop = area.y + yAxisTop(theme, inside) + (spec.yLabel ? 16 : 0);
  const inner = { x: area.x + leftM, y: yTop, w: Math.max(80, area.w - leftM - endW), h: area.y + area.h - yTop - 24 * ctx.textScale - (spec.xLabel ? 16 * ctx.textScale : 0) };
  const yS = (yLog ? log : linear)(nd.min, nd.max, inner.y + inner.h, inner.y);

  let x0 = xsAll[0], x1 = xsAll[xsAll.length - 1];
  if (spec.xDomain) [x0, x1] = spec.xDomain.map((v) => (typeof v === 'number' ? v : m.kind === 'date' ? parseDate(v) : num(v)));
  if (spec._domains) { spec._domains.y = [nd.min, nd.max]; spec._domains.x = [x0, x1]; }
  const xLog = spec.xScale === 'log' && x0 > 0;
  const xS = (xLog ? log : linear)(x0, x1 === x0 ? x0 + 1 : x1, inner.x, inner.x + inner.w);
  const xFmt = (xv) => {
    if (m.kind === 'date') return formatDate(xv, dateUnit(xsAll), locale);
    if (m.kind === 'category') return m.cats[xv];
    if (m.kind === 'year') return String(xv);
    return makeFormat(spec.xFormat, locale, xsAll)(xv);
  };
  let xItems;
  if (m.kind === 'date') {
    xItems = timeTicks(x0, x1, Math.max(2, Math.floor(inner.w / 86)), locale).ticks.map((t) => ({ pos: xS(t.value), label: t.label }));
  } else if (m.kind === 'category') {
    xItems = m.cats.map((c, i) => ({ pos: xS(i), label: c })).filter((it, i) => xsAll.includes(i));
  } else if (xLog) {
    xItems = xS.ticks().map((t) => ({ pos: xS(t), label: makeFormat(spec.xFormat, locale, xsAll).tick(t)(t) }));
  } else {
    let st = niceStep(x1 - x0, Math.max(2, Math.floor(inner.w / 78)));
    const ints = xsAll.every(Number.isInteger);
    if (m.kind === 'year' || ints) st = Math.max(1, Math.round(st));
    const tf = m.kind === 'year' ? (v) => String(v) : makeFormat(spec.xFormat ?? (ints ? 'integer' : undefined), locale, xsAll).tick(st);
    xItems = xS.ticks(st).map((t) => ({ pos: xS(t), label: tf(t) }));
  }

  const body = [];
  const yTicks = yS.ticks(nd.step);
  body.push(yGrid(yTicks, yS, inner, theme, { baseline: zero ? 0 : NaN }));
  if (spec.yLabel) body.push(text(area.x, area.y + 10, spec.yLabel, { fill: theme.lede, fontSize: theme.type?.axis ?? 12, fontWeight: 500 }));
  body.push(xLabels(xItems, inner, theme, { y: inner.y + inner.h + 18, size: theme.type?.axis }));
  if (spec.xLabel) body.push(text(inner.x + inner.w, inner.y + inner.h + 36, spec.xLabel, { fill: theme.lede, fontSize: theme.type?.axis ?? 12, fontWeight: 500, textAnchor: 'end' }));

  for (const a of spec.annotations || []) {
    const xv = m.kind === 'category' ? m.cats.indexOf(String(a.x)) : xValue(a.x, m.kind);
    if (!Number.isFinite(xv) || xv < x0 || xv > x1) continue;
    const px = Math.round(xS(xv)) + 0.5;
    body.push(el('line', { x1: px, x2: px, y1: inner.y, y2: inner.y + inner.h, stroke: theme.muted, strokeWidth: 1, opacity: 0.8 }));
    if (a.label) {
      const w = measure(a.label, 11.5, 500);
      const right = px + 5 + w > inner.x + inner.w;
      const ax = right ? Math.max(px - 5, area.x + w) : px + 5;
      body.push(text(ax, inner.y + 4, a.label, { fill: theme.lede, fontSize: 11.5, fontWeight: 500, textAnchor: right ? 'end' : 'start', stroke: theme.surface, strokeWidth: 3, paintOrder: 'stroke', strokeLinejoin: 'round' }));
    }
  }

  let cutX = null;
  if (fromT) {
    const firm = xsAll.filter((xv) => !fromT(xv));
    const startX = firm.length ? firm[firm.length - 1] : xsAll.find((xv) => fromT(xv));
    if (startX !== undefined && xsAll.some((xv) => fromT(xv)) && startX <= x1) {
      cutX = Math.max(inner.x, xS(Math.max(startX, x0)));
      body.push(el('rect', { x: cutX, y: inner.y, width: Math.max(0, inner.x + inner.w - cutX), height: inner.h, fill: theme.tint, opacity: 0.55, 'pointer-events': 'none' }));
      body.push(el('line', { x1: cutX, x2: cutX, y1: inner.y, y2: inner.y + inner.h, stroke: theme.muted, strokeWidth: 1, strokeDasharray: '2 3', opacity: 0.8 }));
      if (spec.dashedLabel !== false) body.push(text(cutX + 6, inner.y + 11, dashedLabel, { fill: theme.muted, fontSize: 11.5, fontWeight: 500, stroke: theme.surface, strokeWidth: 3, paintOrder: 'stroke', strokeLinejoin: 'round' }));
    }
  }
  const gidD = 'pa-dash-' + Math.abs(hash(String(spec.title) + m.y + inner.w + theme.mode)).toString(36);
  const H = hatcher(theme, gidD);
  const clipL = `${gidD}-l`, clipR = `${gidD}-r`;

  const ordered = [...m.lines].sort((a, b) => (focus(a.key) ? 1 : 0) - (focus(b.key) ? 1 : 0));
  const showDots = spec.points ?? spec.markers ?? (m.lines.every((l) => l.points.length <= 12) && m.lines.length <= 3 && !isArea);
  const curve = spec.curve === 'smooth' ? monotonePath : spec.curve === 'step' ? stepPath : linearPath;
  const drawOrder = stack ? [...m.lines].reverse() : ordered;
  const lw = M.lineWidth ?? 2.25;
  const gid = 'pa-grad-' + Math.abs(hash(String(spec.title) + m.y + inner.w)).toString(36);
  let defs = '';
  const washSingle = !multi && !isArea && spec.fill !== false && !m.errorbar && zero;
  for (const l of drawOrder) {
    const c = colorOf(l.key);
    const segs = splitGaps(l.points, xS, yS);
    if (!segs.length) continue;
    const parts = [];
    if (m.errorbar && !stack) {
      const bpts = l.points.filter((p) => Number.isFinite(p.lo) && Number.isFinite(p.hi));
      if (bpts.length > 1) {
        const up = bpts.map((p) => [xS(p.x), yS(p.hi)]);
        const dn = bpts.map((p) => [xS(p.x), yS(p.lo)]).reverse();
        parts.push(el('path', { d: curve(up) + 'L' + dn.map(([a, b]) => `${a.toFixed(2)},${b.toFixed(2)}`).join('L') + 'Z', fill: c, fillOpacity: focus(l.key) ? M.bandOpacity ?? 0.16 : 0.06, stroke: 'none' }));
      }
    }
    if (isArea || washSingle) {
      if (washSingle) {
        defs += el('linearGradient', { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 }, [el('stop', { offset: '0%', stopColor: c, stopOpacity: 0.22 }), el('stop', { offset: '100%', stopColor: c, stopOpacity: 0 })]);
      }
      for (const sgm of segs) {
        const top = curve(sgm.map(([a, b]) => [a, b]));
        const base0 = yS(Math.max(nd.min, 0));
        const bottom = stack ? sgm.map(([a, , p]) => [a, yS(p.y0)]).reverse() : [[sgm[sgm.length - 1][0], base0], [sgm[0][0], base0]];
        const d = top + 'L' + bottom.map(([a, b]) => `${a.toFixed(2)},${b.toFixed(2)}`).join('L') + 'Z';
        const areaAttrs = { d, fill: washSingle ? `url(#${gid})` : c, fillOpacity: washSingle ? 1 : stack ? 0.9 : M.areaOpacity ?? 0.12, stroke: stack ? theme.surface : 'none', strokeWidth: stack ? 1.5 : 0 };
        const hatchedArea = stack || dashedSeries(l.key);
        if (cutX !== null && hatchedArea) {
          parts.push(el('path', { ...areaAttrs, 'clip-path': `url(#${clipL})` }));
          parts.push(el('path', { ...areaAttrs, fill: H.fill(c), fillOpacity: stack ? 0.95 : 0.5, 'clip-path': `url(#${clipR})` }));
        } else if (dashedSeries(l.key) && !washSingle) parts.push(el('path', { ...areaAttrs, fill: H.fill(c), fillOpacity: stack ? 0.95 : 0.5 }));
        else parts.push(el('path', areaAttrs));
      }
    }
    const sw = focus(l.key) ? (hl ? lw + 0.75 : lw) : 1.5;
    const lineAttrs = { fill: 'none', stroke: c, strokeWidth: sw, strokeLinejoin: 'round', strokeLinecap: 'round' };
    const dashAttrs = { ...lineAttrs, strokeDasharray: DASH.line };
    if (!stack) for (const sgm of segs) {
      if (dashedSeries(l.key)) { parts.push(el('path', { d: curve(sgm.map(([a, b]) => [a, b])), ...dashAttrs })); continue; }
      const k = fromT ? sgm.findIndex(([, , p]) => fromT(p.x)) : -1;
      if (k < 0) parts.push(el('path', { d: curve(sgm.map(([a, b]) => [a, b])), ...lineAttrs }));
      else {
        if (k > 0) parts.push(el('path', { d: curve(sgm.slice(0, k).map(([a, b]) => [a, b])), ...lineAttrs }));
        const rest = sgm.slice(Math.max(0, k - 1));
        if (rest.length > 1) parts.push(el('path', { d: curve(rest.map(([a, b]) => [a, b])), ...dashAttrs }));
      }
    }
    const pts = segs.flat();
    const hollow = (p) => dashedSeries(l.key) || (fromT && fromT(p.x));
    const dot = ([a, b, p], r) => el('circle', { cx: a, cy: b, r, ...(hollow(p) ? { fill: theme.surface, stroke: c, strokeWidth: 1.75 } : { fill: c, stroke: theme.surface, strokeWidth: M.ring ?? 2 }) });
    if (showDots && focus(l.key) && !stack) for (const q of pts) parts.push(dot(q, (M.pointRadius ?? 4) - 0.5));
    if (focus(l.key) && !stack) parts.push(dot(pts[pts.length - 1], (M.pointRadius ?? 4) + 0.5));
    body.push(g({ class: 'pa-m', 'data-series': l.key, ...(dashedSeries(l.key) ? { 'data-dashed': '1' } : {}) }, parts));
  }

  body.push(refLinesY(refs, yS, inner, theme, fmt));
  body.push(yTickLabels(yTicks, yS, inner, theme, tickF, { inside }));

  if (labeled.length) {
    const lh = labelSize * ctx.textScale + 3;
    const labs = labeled.map((l) => {
      const last = lastOf(l);
      const t = endText(l);
      const yy = stack ? yS((last.y + last.y0) / 2) : yS(last.y);
      return { ...t, key: l.key, y: yy, y0: yy, px: xS(last.x), color: colorOf(l.key) };
    }).sort((a, b) => a.y0 - b.y0);
    dodge(labs, lh, inner.y + lh / 2 - 4, inner.y + inner.h + 4);
    const anyMoved = labs.some((lb) => Math.abs(lb.y - lb.y0) > 1.5);
    const lx = inner.x + inner.w + (anyMoved || stack ? 16 : 9);
    for (const lb of labs) {
      const tparts = [];
      if (Math.abs(lb.y - lb.y0) > 1.5 || stack) {
        const sx = lb.px + (stack ? 2 : 7);
        tparts.push(el('path', { d: `M${sx.toFixed(1)},${lb.y0.toFixed(1)}L${(lx - 9).toFixed(1)},${lb.y0.toFixed(1)}L${(lx - 4).toFixed(1)},${lb.y.toFixed(1)}`, fill: 'none', stroke: stack ? theme.muted : lb.color, strokeWidth: 1, opacity: 0.7 }));
      }
      if (lb.name) {
        const tc = readable(lb.color, theme);
        tparts.push(text(lx, lb.y + 4, lb.name, { fill: tc, fontSize: labelSize, fontWeight: 500 }));
        tparts.push(text(lx + measure(lb.name, labelSize, 500) * 1.04 + 6 * ctx.textScale, lb.y + 4, lb.val, { fill: tc, fontSize: labelSize, fontWeight: 700 }));
      } else tparts.push(text(lx, lb.y + 4.5, lb.val, { fill: readable(lb.color, theme), fontSize: labelSize + 0.5, fontWeight: 700 }));
      body.push(g({ class: 'pa-endlabel' }, tparts));
    }
  }

  const cross = xsAll.map((xv) => ({
    x: +xS(xv).toFixed(1),
    t: xFmt(xv) + (fromT && fromT(xv) ? ` · ${dashedLabel}` : ''),
    v: m.lines.filter((l) => focus(l.key)).map((l) => {
      const p = l.points.find((q) => q.x === xv);
      if (!p || !Number.isFinite(p.y)) return null;
      const extra = Number.isFinite(p.lo) ? ` (${fmt(p.lo)}–${fmt(p.hi)})` : '';
      return [multi ? l.key : m.seriesKeys[0], colorOf(l.key), +yS(p.y).toFixed(1), fmt(stack ? p.v : p.y) + extra];
    }).filter(Boolean),
  }));
  body.push(el('rect', { class: 'pa-cross', x: inner.x - 4, y: inner.y, width: inner.w + 8, height: inner.h, fill: 'transparent', 'data-cross': JSON.stringify(cross), 'data-y0': inner.y, 'data-y1': inner.y + inner.h }));

  const desc = describeLine(m, fmt, xFmt, locale);
  if (cutX !== null) defs += el('clipPath', { id: clipL }, el('rect', { x: 0, y: 0, width: cutX, height: frame.height })) + el('clipPath', { id: clipR }, el('rect', { x: cutX, y: 0, width: frame.width, height: frame.height }));
  return frame.finish(body, { desc, type: isArea ? 'area' : 'line', defs: defs + H.defs() });
}

/** Separa etiquetas en 1D: empuja hacia abajo y, si se pasan, hacia arriba. */
function dodge(labs, h, top, bottom) {
  for (let i = 0; i < labs.length; i++) labs[i].y = Math.max(labs[i].y0, i ? labs[i - 1].y + h : top);
  for (let i = labs.length - 1; i >= 0; i--) {
    const lim = i === labs.length - 1 ? bottom : labs[i + 1].y - h;
    if (labs[i].y > lim) labs[i].y = lim;
  }
  for (let i = 0; i < labs.length; i++) if (labs[i].y < top + i * h) labs[i].y = top + i * h;
}

function splitGaps(points, xS, yS) {
  const segs = [];
  let cur = [];
  for (const p of points) {
    if (Number.isFinite(p.y)) cur.push([xS(p.x), yS(p.y), p]);
    else if (cur.length) { segs.push(cur); cur = []; }
  }
  if (cur.length) segs.push(cur);
  return segs;
}

const f2 = (n) => n.toFixed(2);
function linearPath(pts) {
  return pts.map(([x, y], i) => (i ? 'L' : 'M') + f2(x) + ',' + f2(y)).join('');
}
function stepPath(pts) {
  return pts.map(([x, y], i) => (i ? `H${f2(x)}V${f2(y)}` : `M${f2(x)},${f2(y)}`)).join('');
}

/** Curva monótona (no inventa máximos ni mínimos entre puntos). */
function monotonePath(pts) {
  const n = pts.length;
  if (n < 3) return linearPath(pts);
  const dx = [], dy = [], s = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1][0] - pts[i][0]);
    dy.push(pts[i + 1][1] - pts[i][1]);
    s.push(dy[i] / (dx[i] || 1));
  }
  const t = [s[0]];
  for (let i = 1; i < n - 1; i++) t.push(s[i - 1] * s[i] <= 0 ? 0 : (3 * (dx[i - 1] + dx[i])) / ((2 * dx[i] + dx[i - 1]) / s[i - 1] + (dx[i] + 2 * dx[i - 1]) / s[i]));
  t.push(s[n - 2]);
  let d = 'M' + f2(pts[0][0]) + ',' + f2(pts[0][1]);
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += `C${f2(pts[i][0] + h)},${f2(pts[i][1] + h * t[i])} ${f2(pts[i + 1][0] - h)},${f2(pts[i + 1][1] - h * t[i + 1])} ${f2(pts[i + 1][0])},${f2(pts[i + 1][1])}`;
  }
  return d;
}

function describeLine(m, fmt, xFmt, locale = 'es') {
  const en = String(locale).startsWith('en');
  const parts = m.lines.slice(0, 6).map((l) => {
    const pts = l.points.filter((p) => Number.isFinite(p.v ?? p.y));
    if (pts.length < 2) return '';
    const a = pts[0], b = pts[pts.length - 1];
    const va = a.v ?? a.y, vb = b.v ?? b.y;
    const ch = va !== 0 ? ((vb - va) / Math.abs(va)) * 100 : null;
    const chs = ch === null || fmt.type === 'percent' ? '' : ` (${ch >= 0 ? '+' : ''}${Math.round(ch)}%)`;
    const max = pts.reduce((p, q) => ((q.v ?? q.y) > (p.v ?? p.y) ? q : p));
    return en
      ? `${l.key}: from ${fmt(va)} (${xFmt(a.x)}) to ${fmt(vb)} (${xFmt(b.x)})${chs}, peak ${fmt(max.v ?? max.y)} in ${xFmt(max.x)}.`
      : `${l.key}: de ${fmt(va)} (${xFmt(a.x)}) a ${fmt(vb)} (${xFmt(b.x)})${chs}, máximo ${fmt(max.v ?? max.y)} en ${xFmt(max.x)}.`;
  });
  return (en ? 'Line chart. ' : 'Gráfico de líneas. ') + parts.filter(Boolean).join(' ');
}

return { "prepareLine": prepareLine, "line": line, "describeLine": describeLine };
});
__def("src/charts/scatter.js", function () {
const { el, g, text, tip, dotLayer } = __req("src/svg.js");
const { measure } = __req("src/text.js");
const { makeFormat } = __req("src/format.js");
const { niceDomain, niceStep, linear, log, logDomain } = __req("src/scale.js");
const { colorMap } = __req("src/theme.js");
const { ensureData, requireField, uniq, num, fieldsOf, fieldKind, humanize } = __req("src/data.js");
const { gridY, gridX, ticksWidth, refLinesY, refLinesX, yAxisMargin, yAxisTop, yGrid, yTickLabels, quietCorner } = __req("src/axes.js");
const { createFrame, SIZES } = __req("src/frame.js");

function scatter(spec, theme) {
  const data = ensureData(spec);
  const fields = fieldsOf(data);
  const numeric = fields.filter((f) => fieldKind(data, f) === 'number' || fieldKind(data, f) === 'year');
  const x = spec.x || numeric[0];
  const y = spec.y || numeric.find((f) => f !== x);
  const size = spec.size;
  const series = spec.series ?? spec.hue ?? spec.color;
  const labelF = spec.label ?? fields.find((f) => fieldKind(data, f) === 'category' && f !== series);
  requireField(data, x, 'x');
  requireField(data, y, 'y');
  if (size) requireField(data, size, 'size');
  if (series) requireField(data, series, 'series');
  const locale = spec.locale || 'es';

  const pts = data
    .map((r) => ({ r, x: num(r[x]), y: num(r[y]), s: size ? num(r[size]) : 1, k: series ? String(r[series]) : '', name: labelF ? String(r[labelF] ?? '') : '' }))
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  const keys = series ? uniq(pts.map((p) => p.k)) : [''];
  const cmap = colorMap(keys, theme, spec.colors);
  const hl = spec.highlight === undefined ? null : new Set([].concat(spec.highlight).map(String));
  const focus = (p) => !hl || hl.has(p.name) || hl.has(p.k);
  const colorOf = (p) => (!focus(p) ? theme.dim : series ? cmap.get(p.k) : theme.categorical[0]);

  const fx = makeFormat(spec.xFormat, locale, pts.map((p) => p.x));
  const fy = makeFormat(spec.yFormat ?? spec.format, locale, pts.map((p) => p.y));
  const fs = size ? makeFormat(spec.sizeFormat, locale, pts.map((p) => p.s)) : null;

  const legend = series && keys.length > 1 && spec.legend !== false ? keys.map((k) => ({ label: k, color: cmap.get(k) })) : [];
  const frame = createFrame(spec, theme, { height: 460 });
  const area = frame.layout(legend);

  const xLog = spec.xScale === 'log', yLog = spec.yScale === 'log';
  const ex = [Math.min(...pts.map((p) => p.x)), Math.max(...pts.map((p) => p.x))];
  const ey = [Math.min(...pts.map((p) => p.y)), Math.max(...pts.map((p) => p.y))];
  if (spec.xDomain) ex.splice(0, 2, ...spec.xDomain);
  if (spec.yDomain) ey.splice(0, 2, ...spec.yDomain);
  const dx = xLog ? logDomain(...ex) : spec.xDomain ? { min: ex[0], max: ex[1], step: niceStep(ex[1] - ex[0], Math.max(3, Math.round(area.w / 110))) } : niceDomain(ex[0], ex[1], Math.max(3, Math.round(area.w / 110)));
  const dy = yLog ? logDomain(...ey) : spec.yDomain ? { min: ey[0], max: ey[1], step: niceStep(ey[1] - ey[0], Math.max(3, Math.round(area.h / 70))) } : niceDomain(ey[0], ey[1], Math.max(3, Math.round(area.h / 70)));
  if (spec._domains) { spec._domains.x = [dx.min, dx.max]; spec._domains.y = [dy.min, dy.max]; }
  const ytf = yLog ? fy : fy.tick(dy.step);
  const xtf = xLog ? fx : fx.tick(dx.step);
  const yTicks = (yLog ? log(dy.min, dy.max, 0, 1) : linear(dy.min, dy.max, 0, 1)).ticks(dy.step);
  const leftM = yAxisMargin(yTicks, ytf, theme);
  const top = area.y + 18 + yAxisTop(theme);
  const inner = { x: area.x + leftM, y: top, w: area.w - leftM - 8, h: area.y + area.h - top - 44 };
  const maxS = Math.max(...pts.map((p) => p.s));
  const rMax = spec.maxRadius ?? Math.min(30, Math.max(12, Math.sqrt((inner.w * inner.h) / Math.max(1, pts.length)) / 3));
  const bp = size ? rMax * 0.75 : 6;
  const xS = (xLog ? log : linear)(dx.min, dx.max, inner.x + bp, inner.x + inner.w - bp);
  const yS = (yLog ? log : linear)(dy.min, dy.max, inner.y + inner.h - bp, inner.y + bp);
  const rOf = (p) => (size ? Math.max(2.5, Math.sqrt(Math.max(0, p.s) / (maxS || 1)) * rMax) : spec.radius ?? (pts.length > 300 ? 3 : 5));

  const body = [];
  body.push(yGrid(yS.ticks(dy.step), yS, inner, theme, { baseline: NaN }));
  body.push(gridX(xS.ticks(dx.step), xS, inner, theme, xtf, { baseline: NaN }));
  body.push(el('line', { x1: inner.x, x2: inner.x + inner.w, y1: inner.y + inner.h + 0.5, y2: inner.y + inner.h + 0.5, stroke: theme.axis }));
  body.push(text(area.x, area.y + 10, spec.yLabel ?? humanize(y), { fill: theme.lede, fontSize: SIZES.axis, fontWeight: 500 }));
  body.push(text(inner.x + inner.w, inner.y + inner.h + 40, spec.xLabel ?? humanize(x), { fill: theme.lede, fontSize: SIZES.axis, fontWeight: 500, textAnchor: 'end' }));

  if (spec.trend) {
    const tx = pts.map((p) => (xLog ? Math.log10(p.x) : p.x)), ty = pts.map((p) => (yLog ? Math.log10(p.y) : p.y));
    const n = tx.length, mx = tx.reduce((a, b) => a + b, 0) / n, my = ty.reduce((a, b) => a + b, 0) / n;
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < n; i++) { sxy += (tx[i] - mx) * (ty[i] - my); sxx += (tx[i] - mx) ** 2; syy += (ty[i] - my) ** 2; }
    const b = sxy / (sxx || 1), a = my - b * mx;
    const r2v = sxx && syy ? (sxy * sxy) / (sxx * syy) : 0;
    const lx0 = xLog ? Math.log10(dx.min) : dx.min, lx1 = xLog ? Math.log10(dx.max) : dx.max;
    const P = (lx) => [xS(xLog ? 10 ** lx : lx), yS(yLog ? 10 ** (a + b * lx) : a + b * lx)];
    const [ax, ay] = P(lx0), [bx, by] = P(lx1);
    body.push(el('clipPath', { id: 'pa-clip-trend' }, el('rect', { x: inner.x, y: inner.y, width: inner.w, height: inner.h })));
    body.push(el('line', { x1: ax, y1: ay, x2: bx, y2: by, stroke: theme.ink, strokeWidth: 1.5, opacity: 0.55, clipPath: 'url(#pa-clip-trend)' }));
    const r2s = `R² = ${r2v.toFixed(2).replace('.', String(locale).startsWith('en') ? '.' : ',')}`;
    const occ = pts.map((p) => [xS(p.x), yS(p.y)]);
    for (let i = 0; i <= 24; i++) occ.push([ax + ((bx - ax) * i) / 24, ay + ((by - ay) * i) / 24]);
    const qc = quietCorner(occ, inner, measure(r2s, 11.5) + 4, 16);
    body.push(text(qc.x, qc.y, r2s, { fill: theme.lede, fontSize: 11.5, textAnchor: qc.anchor, stroke: theme.surface, strokeWidth: 3, paintOrder: 'stroke' }));
  }
  body.push(refLinesY(spec.refLines || [], yS, inner, theme, fy));
  body.push(refLinesX(spec.refLines || [], xS, inner, theme, fx));

  const sorted = [...pts].sort((a, b) => (focus(a) - focus(b)) || b.s - a.s);
  const circles = sorted.map((p) => {
    const lines = [p.name || '', `${humanize(x)}: ${fx(p.x)}`, `${humanize(y)}: ${fy(p.y)}`];
    if (size) lines.push(`${humanize(size)}: ${fs(p.s)}`);
    if (series) lines.splice(1, 0, p.k);
    return { class: 'pa-m', cx: xS(p.x), cy: yS(p.y), r: rOf(p), fill: colorOf(p), fillOpacity: size ? 0.78 : 0.9, stroke: theme.surface, strokeWidth: size ? 1.5 : pts.length > 400 ? 1 : 2, 'data-tip': tip(...lines) };
  });
  body.push(dotLayer(circles));

  body.push(yTickLabels(yS.ticks(dy.step), yS, inner, theme, ytf));

  if (labelF && spec.labels !== false) {
    let chosen;
    if (Array.isArray(spec.labels)) chosen = pts.filter((p) => spec.labels.map(String).includes(p.name));
    else {
      const n = typeof spec.labels === 'number' ? spec.labels : hl ? 0 : Math.min(6, pts.length);
      chosen = [...pts].sort((a, b) => (size ? b.s - a.s : b.y - a.y)).slice(0, n);
      if (hl) chosen = chosen.concat(pts.filter((p) => hl.has(p.name)));
    }
    const placed = [];
    for (const p of chosen) {
      if (!p.name) continue;
      const w = measure(p.name, 12, 500);
      const r = rOf(p);
      let lx = xS(p.x) + r + 4, ly = yS(p.y) + 4, anchor = 'start';
      if (lx + w > inner.x + inner.w) { lx = xS(p.x) - r - 4; anchor = 'end'; }
      const box = anchor === 'start' ? [lx, ly - 11, lx + w, ly + 3] : [lx - w, ly - 11, lx, ly + 3];
      if (placed.some((b) => !(box[2] < b[0] || box[0] > b[2] || box[3] < b[1] || box[1] > b[3]))) continue;
      placed.push(box);
      body.push(el('text', { x: lx, y: ly, fill: theme.ink, fontSize: 12, fontWeight: 500, textAnchor: anchor, stroke: theme.surface, strokeWidth: 3, paintOrder: 'stroke', strokeLinejoin: 'round' }, p.name.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])));
    }
  }

  const en = String(locale).startsWith('en');
  const desc = en
    ? `Scatter plot of ${humanize(y)} vs ${humanize(x)} with ${pts.length} points.`
    : `Gráfico de dispersión de ${humanize(y)} versus ${humanize(x)} con ${pts.length} puntos.`;
  return frame.finish(g({}, body), { desc, type: size ? 'bubble' : 'scatter' });
}

return { "scatter": scatter };
});
__def("src/charts/treemap.js", function () {
const { el, g, text, tip, esc } = __req("src/svg.js");
const { measure, wrap } = __req("src/text.js");
const { makeFormat } = __req("src/format.js");
const { textOn, ramp } = __req("src/theme.js");
const { formatNumber } = __req("src/format.js");
const { humanize } = __req("src/data.js");
const { createFrame } = __req("src/frame.js");
const { ctx } = __req("src/context.js");
const { buildHierarchy, findNode, assignColors, shareFmt, breadcrumb, height, otherNote, SEP } = __req("src/hierarchy.js");

/** Algoritmo squarified (Bruls, Huizing & van Wijk, 2000). */
function squarify(items, x, y, w, h) {
  const out = [];
  const total = items.reduce((a, b) => a + b.value, 0);
  if (total <= 0 || w <= 0 || h <= 0) return out;
  const scale = (w * h) / total;
  const nodes = items.map((it) => ({ it, area: it.value * scale })).filter((n) => n.area > 0);
  let rect = { x, y, w, h };
  let row = [];
  const worst = (r, side) => {
    const s = r.reduce((a, b) => a + b.area, 0);
    const mx = Math.max(...r.map((n) => n.area)), mn = Math.min(...r.map((n) => n.area));
    return Math.max((side * side * mx) / (s * s), (s * s) / (side * side * mn));
  };
  const layoutRow = (r, last) => {
    const s = r.reduce((a, b) => a + b.area, 0);
    if (rect.w >= rect.h) {
      const cw = last ? rect.w : s / rect.h;
      let cy = rect.y;
      r.forEach((n, i) => { const ch = i === r.length - 1 ? rect.y + rect.h - cy : n.area / cw; out.push({ ...n.it, x: rect.x, y: cy, w: cw, h: ch }); cy += ch; });
      rect = { x: rect.x + cw, y: rect.y, w: rect.w - cw, h: rect.h };
    } else {
      const ch = last ? rect.h : s / rect.w;
      let cx = rect.x;
      r.forEach((n, i) => { const cw = i === r.length - 1 ? rect.x + rect.w - cx : n.area / ch; out.push({ ...n.it, x: cx, y: rect.y, w: cw, h: ch }); cx += cw; });
      rect = { x: rect.x, y: rect.y + ch, w: rect.w, h: rect.h - ch };
    }
  };
  nodes.forEach((n, idx) => {
    const side = Math.min(rect.w, rect.h);
    if (!row.length || worst([...row, n], side) <= worst(row, side)) row.push(n);
    else { layoutRow(row, false); row = [n]; }
    if (idx === nodes.length - 1) layoutRow(row, true);
  });
  return out;
}

const GAP = (d) => (d <= 1 ? 4 : d === 2 ? 2 : 1);

function treemap(spec, theme) {
  const locale = spec.locale || 'es';
  const en = String(locale).startsWith('en');
  const { root, fields, valueField } = buildHierarchy(spec);
  const focus = findNode(root, spec.focus);
  const levels = height(focus);
  const single = height(root) <= 1 && spec.colorBy !== 'label';
  assignColors(root, theme, spec, { single });
  const allValues = [];
  (function walk(n) { allValues.push(n.value); n.children.forEach(walk); })(root);
  const fmt = makeFormat(spec.format, locale, allValues);
  const share = shareFmt(locale);
  const hl = spec.highlight === undefined ? null : new Set([].concat(spec.highlight).map(String));

  const prevRows = spec.compareData ?? spec._prev?.data;
  const prevLabel = spec.compareLabel ?? spec._prev?.label;
  const prevMap = new Map();
  if (prevRows && prevRows.length) {
    const pr = buildHierarchy({ ...spec, data: prevRows, time: undefined, threshold: false }).root;
    (function walk(n) { prevMap.set(n.path.join('\u0000'), n.value); n.children.forEach(walk); })(pr);
  }
  const prevOf = (n) => (n.other && n.members ? n.members.reduce((a, m) => a + (prevMap.get(m.path.join('\u0000')) || 0), 0) : prevMap.get(n.path.join('\u0000')));
  const changeOf = (n) => { const pv = prevOf(n); return pv > 0 ? n.value / pv - 1 : null; };
  const showChange = prevMap.size > 0 && spec.change !== false;
  const byChange = showChange && spec.colorBy === 'change';
  const pctTxt = (c) => (c === null ? '' : `${c > 0 ? '▲' : c < 0 ? '▼' : '■'} ${formatNumber(Math.abs(c) * 100, Math.abs(c) < 0.1 ? 1 : 0, locale, true)}%`);
  let cMax = 0;
  if (byChange) (function walk(n) { if (!n.children.length) { const c = changeOf(n); if (c !== null) cMax = Math.max(cMax, Math.abs(c)); } n.children.forEach(walk); })(focus);
  cMax = spec.changeDomain ?? (Math.ceil(Math.min(1, cMax || 0.1) * 20) / 20);
  const divRamp = [...theme.diverging].reverse();
  const changeColor = (c) => (c === null ? theme.tint : ramp(divRamp, 0.5 + Math.max(-1, Math.min(1, c / cMax)) / 2));

  const top = focus.children;
  let legend = [];
  if (byChange && spec.legend !== false) {
    const lab = (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${formatNumber(Math.abs(v) * 100, 0, locale)}%`;
    legend = [{ type: 'ramp', stops: [...theme.diverging].reverse(), min: lab(-cMax), max: lab(cMax), title: (en ? 'Change' : 'Variación') + (prevLabel ? (en ? ' vs ' : ' vs ') + prevLabel : '') }];
  } else if (levels > 1 && top.length > 1 && spec.legend !== false && !focus.path.length) {
    const shown = top.filter((c) => !c.folded);
    const sh0 = shareFmt(locale);
    legend = shown.map((c) => ({ label: `${c.name} ${sh0(c.value, focus.value)}`, color: c.color, shape: 'square' }));
    const rest = top.filter((c) => c.folded);
    if (rest.length) {
      const bin = rest.find((c) => c.other);
      legend.push({ label: `${bin ? bin.name : en ? 'Other' : 'Otros'} ${sh0(rest.reduce((a, c) => a + c.value, 0), focus.value)}`, color: theme.other, shape: 'square' });
    }
  }

  const W = spec.width || 720;
  const frame = createFrame(spec, theme, { height: W < 560 ? Math.round(Math.min(780, W * 1.15 + 170)) : Math.round(Math.max(440, Math.min(620, W * 0.62))) });
  let area = frame.layout(legend);
  const body = [];
  const bc = breadcrumb(focus, area.x, area.y, area.w, theme, locale);
  if (bc.h) { body.push(bc.svg); area = { ...area, y: area.y + bc.h, h: area.h - bc.h }; }

  const total = focus.value;
  const grand = root.value;
  const R = theme.marks?.barRadius ?? 4;

  const tipFor = (n) => {
    const parentShare = n.parent && n.parent.value ? share(n.value, n.parent.value) : '';
    const ch = showChange ? changeOf(n) : null;
    return tip(
      n.path.join(SEP),
      `${fmt(n.value)} · ${share(n.value, grand)} ${en ? 'of total' : 'del total'}`,
      n.parent && n.parent.depth > 0 ? `${parentShare} ${en ? 'of' : 'de'} ${n.parent.name}` : '',
      ch !== null ? `${pctTxt(ch)} ${prevLabel ? 'vs ' + prevLabel : ''}`.trim() : '',
      otherNote(n, locale)
    );
  };
  const dim = (n) => hl && !n.path.some((p) => hl.has(p));

  function drawLeaf(n, x, y, w, h, relDepth) {
    if (w < 0.6 || h < 0.6) return '';
    const ch = showChange ? changeOf(n) : null;
    const fill = dim(n) ? theme.dim : byChange ? changeColor(ch) : n.color;
    const rx = Math.max(0, Math.min(R - 1, w / 6, h / 6));
    const parts = [el('rect', { x, y, width: w, height: h, rx, fill })];
    const extra = [spec.showValues ? fmt(n.value) : null, ch !== null ? pctTxt(ch) : null].filter(Boolean).join(' · ');
    parts.push(...tileLabel(n.name, share(n.value, total), x, y, w, h, textOn(fill, theme), extra || null, relDepth));
    const drill = relDepth === 1 && n.children.length ? JSON.stringify(n.path) : undefined;
    return g({ class: 'pa-m', 'data-tip': tipFor(n), 'data-drill': drill, style: drill ? 'cursor:pointer' : undefined }, parts);
  }

  function drawNode(n, x, y, w, h, relDepth) {
    if (!n.children.length) return drawLeaf(n, x, y, w, h, relDepth);
    const parts = [];
    const iy = y, ih = h;
    const gap = GAP(relDepth + 1);
    const rects = squarify(n.children, x, iy, w, ih);
    for (const c of rects) parts.push(drawNode(c, c.x + gap / 2, c.y + gap / 2, c.w - gap, c.h - gap, relDepth + 1));
    const drill = relDepth === 1 ? JSON.stringify(n.path) : undefined;
    return g({ class: relDepth === 1 ? 'pa-group' : undefined, 'data-tip': relDepth === 1 ? tipFor(n) : undefined, 'data-drill': drill, style: drill ? 'cursor:pointer' : undefined }, parts);
  }

  const g1 = GAP(1);
  const rects = squarify(focus.children, area.x - g1 / 2, area.y - g1 / 2, area.w + g1, area.h + g1);
  for (const r of rects) body.push(drawNode(r, r.x + g1 / 2, r.y + g1 / 2, r.w - g1, r.h - g1, 1));

  const leaves = [];
  (function walk(n) { if (!n.children.length) leaves.push(n); n.children.forEach(walk); })(focus);
  const top3 = leaves.sort((a, b) => b.value - a.value).slice(0, 3).map((l) => `${l.name} ${share(l.value, total)}`).join(', ');
  const what = humanize(valueField);
  const where = focus.path.length ? ` (${focus.path.join(SEP)})` : '';
  const desc = en
    ? `Treemap of ${what}${where} across ${fields.length} level${fields.length > 1 ? 's' : ''}, total ${fmt(total)}. Largest: ${top3}.`
    : `Treemap de ${what.toLowerCase()}${where} en ${fields.length} nivel${fields.length > 1 ? 'es' : ''}, total ${fmt(total)}. Mayores: ${top3}.`;
  return frame.finish(body, { desc, type: 'treemap' });
}

/** Etiqueta dentro del rectángulo solo si cabe; tamaño según el área. */
function tileLabel(name, pct, x, y, w, h, fill, value, depth) {
  const out = [];
  const pad = w < 60 || h < 40 ? 5 : 8;
  const maxSize = depth <= 1 ? 24 : depth === 2 ? 18 : 15;
  for (let size = Math.min(maxSize, Math.max(10, Math.sqrt(w * h) / 8.5)); size >= 9.5; size -= 1) {
    const lines = wrap(name, w - pad * 2, size, 600, 3);
    const X = ctx.textScale;
    const lh = size * X * 1.14;
    const pctSize = Math.max(9.5, size * 0.78);
    const sub = value ? `${pct} · ${value}` : pct;
    const need = pad + lines.length * lh + 3 + pctSize * X + pad * 0.5;
    const widest = Math.max(...lines.map((l) => measure(l, size, 600)), measure(sub, pctSize));
    const fitsW = lines.every((l) => measure(l, size, 600) <= w - pad * 2) && !/…$/.test(lines[lines.length - 1]);
    if (fitsW && widest <= w - pad * 2 && need <= h) {
      lines.forEach((l, i) => out.push(text(x + pad, y + pad + size * X * 0.88 + i * lh, l, { fill, fontSize: size, fontWeight: 600 })));
      out.push(text(x + pad, y + pad + size * X * 0.88 + (lines.length - 1) * lh + pctSize * X + 4, sub, { fill, fontSize: pctSize, opacity: 0.86 }));
      return out;
    }
    if (lines.length === 1 && fitsW && pad + lh <= h) {
      out.push(text(x + pad, y + pad + size * X * 0.88, lines[0], { fill, fontSize: size, fontWeight: 600 }));
      return out;
    }
  }
  return out;
}

return { "squarify": squarify, "treemap": treemap };
});
__def("src/hierarchy.js", function () {
const { ensureData, requireField, num, fieldsOf, fieldKind, PlotError } = __req("src/data.js");
const { hexToRgb, rgbToHex } = __req("src/theme.js");
const { formatNumber } = __req("src/format.js");
const { el, g, text } = __req("src/svg.js");
const { measure, truncate } = __req("src/text.js");
const { otherLabel, thresholdOf, splitOther } = __req("src/other.js");

/** Resuelve los campos de ruta y valor desde el spec (path | group+label | label | x). */
function hierarchyFields(spec, data) {
  const fields = fieldsOf(data);
  const cats = fields.filter((f) => fieldKind(data, f) === 'category');
  let path = spec.path ? [].concat(spec.path) : null;
  if (!path) {
    const leaf = spec.label ?? spec.x;
    path = spec.group ? [spec.group, leaf ?? cats.find((f) => f !== spec.group)] : [leaf ?? cats[0]];
  }
  path = path.filter(Boolean);
  const value = spec.value ?? spec.y ?? (typeof spec.size === 'string' ? spec.size : null) ?? fields.find((f) => fieldKind(data, f) === 'number');
  if (!path.length) throw new PlotError('No encontré un campo de categorías para la jerarquía.', 'Indica path: ["grupo", "elemento"] o label: "campo".');
  path.forEach((p, i) => requireField(data, p, `path[${i}]`));
  requireField(data, value, 'value');
  return { path, value };
}

/**
 * Construye el árbol. Nodo: { name, path, depth, value, children, parent }.
 * `depth` (opcional) agrega todo bajo ese nivel.
 */
function buildHierarchy(spec) {
  const data = ensureData(spec);
  const { path, value } = hierarchyFields(spec, data);
  const levels = Math.max(1, Math.min(path.length, spec.depth ?? path.length));
  const root = { name: '', path: [], depth: 0, value: 0, children: [], map: new Map() };
  for (const r of data) {
    const v = num(r[value]);
    if (!(v > 0)) continue;
    let node = root;
    root.value += v;
    for (let d = 0; d < levels; d++) {
      const raw = r[path[d]];
      const name = raw === null || raw === undefined || raw === '' ? '—' : String(raw);
      if (!node.map.has(name)) {
        const child = { name, path: [...node.path, name], depth: d + 1, value: 0, children: [], map: new Map(), parent: node };
        node.map.set(name, child);
        node.children.push(child);
      }
      node = node.map.get(name);
      node.value += v;
    }
  }
  const sortRec = (n) => { n.children.sort((a, b) => b.value - a.value); n.children.forEach(sortRec); delete n.map; };
  sortRec(root);
  foldOther(root, spec);
  return { root, fields: path.slice(0, levels), valueField: value, data };
}

/**
 * En cada nivel, los hermanos bajo el umbral (fracción del padre) se agrupan
 * en una hoja "Otros" que va siempre al final. Un "Otros" que ya venga en los
 * datos también baja al final (y recibe a los agrupados). No se agrupan los
 * nodos destacados, con color fijo o en la ruta de `focus`.
 */
function foldOther(root, spec) {
  const threshold = thresholdOf(spec);
  const label = otherLabel(spec);
  const hl = spec.highlight === undefined ? null : new Set([].concat(spec.highlight).map(String));
  const focus = (spec.focus || []).map(String);
  const rec = (n) => {
    if (!n.children.length) return;
    const sp = splitOther(n.children, {
      value: (c) => c.value, name: (c) => c.name, total: n.value, threshold, label,
      protect: (c) => (hl && hl.has(c.name)) || !!(spec.colors && spec.colors[c.name]) || focus[c.depth - 1] === c.name,
    });
    sp.keep.forEach(rec);
    if (!sp.fold.length) {
      sp.others.forEach(rec);
      n.children = [...sp.keep, ...sp.others];
      return;
    }
    const merge = [...sp.others, ...sp.fold];
    const name = sp.others.length === 1 ? sp.others[0].name : label;
    const other = {
      name, path: [...n.path, name], depth: n.depth + 1, parent: n, children: [], other: true,
      value: merge.reduce((a, c) => a + c.value, 0),
      members: merge.map((c) => ({ name: c.name, path: c.path, value: c.value })),
    };
    n.children = [...sp.keep, other];
  };
  rec(root);
}

/** Línea de tooltip para un "Otros": cuántos agrupa y cuáles. */
function otherNote(n, locale = 'es') {
  if (!n.other || !n.members) return '';
  const en = String(locale).startsWith('en');
  const L = n.members.map((m) => m.name);
  const names = L.slice(0, 6).join(', ') + (L.length > 6 ? (en ? ` and ${L.length - 6} more` : ` y ${L.length - 6} más`) : '');
  return `${L.length} ${en ? (L.length === 1 ? 'item' : 'items') : L.length === 1 ? 'elemento' : 'elementos'}: ${names}`;
}

/** Busca un nodo por ruta; si no existe, devuelve el más profundo que coincida. */
function findNode(root, focus = []) {
  let node = root;
  for (const name of focus || []) {
    const next = node.children.find((c) => c.name === String(name));
    if (!next) break;
    node = next;
  }
  return node;
}

const height = (n) => (n.children.length ? 1 + Math.max(...n.children.map(height)) : 0);
const descendants = (n) => [n, ...n.children.flatMap(descendants)];

/** Mezcla un color hacia otro (t ∈ [0,1]). */
function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex(A.map((v, i) => v + (B[i] - v) * t));
}

/**
 * Colores por familia: el primer nivel visible toma la paleta categórica en
 * orden de tamaño (desde el 8.º, "Otros" en gris); los descendientes heredan
 * el color con una variación de luminosidad sutil por hermano.
 */
function assignColors(displayRoot, theme, spec, { single = false } = {}) {
  const top = displayRoot.children.filter((c) => !c.other);
  const n = theme.categorical.length;
  const fold = top.length > n;
  top.forEach((c, i) => {
    const fixed = spec.colors && spec.colors[c.name];
    c.color = fixed || (single ? theme.categorical[0] : fold && i >= n - 1 ? theme.other : theme.categorical[i] || theme.other);
    c.folded = !fixed && !single && fold && i >= n - 1;
  });
  for (const c of displayRoot.children) if (c.other) { c.color = (spec.colors && spec.colors[c.name]) || theme.other; c.folded = !single; }
  const steps = [0, 0.14, 0.07, 0.2, 0.1];
  const toward = theme.surface;
  const rec = (node) => node.children.forEach((c, i) => {
    if (node !== displayRoot) c.color = (spec.colors && spec.colors[c.name]) || (c.other ? mix(node.color, toward, 0.4) : spec.shade ? mix(node.color, toward, steps[i % steps.length]) : node.color);
    rec(c);
  });
  rec(displayRoot);
}

function shareFmt(locale) {
  return (v, total) => {
    const p = total > 0 ? (v / total) * 100 : 0;
    return formatNumber(p, p < 1 ? 1 : p < 10 ? 1 : 0, locale, true) + '%';
  };
}

const SEP = ' › ';

/**
 * Migas de pan de foco: "Todo › Minería › Cobre". Cada miga lleva data-drill
 * con la ruta de su ancestro (la raíz, "[]"). Devuelve { svg, h }.
 */
function breadcrumb(focusNode, x, y, w, theme, locale = 'es') {
  if (!focusNode || !focusNode.path.length) return { svg: '', h: 0 };
  const en = String(locale).startsWith('en');
  const crumbs = [{ name: en ? 'All' : 'Todo', path: [] }, ...focusNode.path.map((name, i) => ({ name, path: focusNode.path.slice(0, i + 1) }))];
  const out = [];
  let cx = x;
  const size = 12.5;
  crumbs.forEach((c, i) => {
    const last = i === crumbs.length - 1;
    const label = truncate(c.name, Math.max(60, w / crumbs.length), size, last ? 600 : 400);
    const wLab = measure(label, size, last ? 600 : 400);
    const attrs = { fill: last ? theme.ink : theme.lede, fontSize: size, fontWeight: last ? 600 : 400 };
    if (last) out.push(text(cx, y + 13, label, attrs));
    else out.push(g({ class: 'pa-crumb', 'data-drill': JSON.stringify(c.path), style: 'cursor:pointer' }, [
      el('rect', { x: cx - 3, y, width: wLab + 6, height: 18, fill: 'transparent' }),
      text(cx, y + 13, label, { ...attrs, textDecoration: 'underline', 'text-decoration-color': theme.axis }),
    ]));
    cx += wLab;
    if (!last) {
      out.push(text(cx + 6, y + 13, '›', { fill: theme.muted, fontSize: size }));
      cx += 18;
    }
  });
  return { svg: g({ class: 'pa-breadcrumb' }, out), h: 26 };
}

return { "hierarchyFields": hierarchyFields, "buildHierarchy": buildHierarchy, "otherNote": otherNote, "findNode": findNode, "mix": mix, "assignColors": assignColors, "shareFmt": shareFmt, "breadcrumb": breadcrumb, "height": height, "descendants": descendants, "SEP": SEP };
});
__def("src/charts/donut.js", function () {
const { el, g, text, tip } = __req("src/svg.js");
const { measure, truncate } = __req("src/text.js");
const { makeFormat, formatNumber } = __req("src/format.js");
const { colorMap, textOn } = __req("src/theme.js");
const { ensureData, requireField, num, fieldsOf, fieldKind, humanize } = __req("src/data.js");
const { createFrame, hash } = __req("src/frame.js");
const { dashedMatcher, hatcher, dashedDefaultLabel, DASH } = __req("src/dashed.js");
const { ctx } = __req("src/context.js");

const f = (n) => n.toFixed(2);

function arc(cx, cy, R, r, a0, a1) {
  if (a1 - a0 >= Math.PI * 2 - 1e-6) a1 = a0 + Math.PI * 2 - 1e-4;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const p = (rad, a) => `${f(cx + rad * Math.cos(a))},${f(cy + rad * Math.sin(a))}`;
  if (r <= 0.01) return `M${f(cx)},${f(cy)}L${p(R, a0)}A${f(R)},${f(R)} 0 ${large} 1 ${p(R, a1)}Z`;
  return `M${p(R, a0)}A${f(R)},${f(R)} 0 ${large} 1 ${p(R, a1)}L${p(r, a1)}A${f(r)},${f(r)} 0 ${large} 0 ${p(r, a0)}Z`;
}

function donut(spec, theme) {
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
    if (!(v > 0)) continue;
    const k = String(r[labelF]);
    sums.set(k, (sums.get(k) || 0) + v);
  }
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
  const dm = dashedMatcher(spec, data, labelF, null);
  const isDashed = (s) => !!(dm && !s.other && dm(s.k));
  const dashedLabel = spec.dashedLabel ?? dashedDefaultLabel(locale);
  const H = hatcher(theme, 'pa-d' + Math.abs(hash(String(spec.title) + theme.mode + labelF)).toString(36));
  const paint = (s) => (isDashed(s) ? { fill: H.fill(colorOf(s)), 'data-dashed': '1', 'data-color': colorOf(s) } : { fill: colorOf(s) });
  const tipOf = (s) => tip(s.k, `${fmt(s.v)} · ${pct(s.v)}`, isDashed(s) ? dashedLabel : '');

  let mode = spec.labels === false ? 'none' : spec.labels ?? 'auto';
  if (mode === true) mode = 'auto';

  const frame = createFrame(spec, theme, { height: half ? 320 : 380 });
  const area = frame.layout([]);
  const narrow = area.w < 470;
  if (mode === 'outside') {
    const lw = Math.min(area.w * 0.3, Math.max(...slices.map((s) => measure(s.k, 12.5) + 6 + measure(pct(s.v), 12.5, 600))));
    if ((area.w - 2 * (lw + 30)) / 2 < Math.min(90, area.h / 2 - 10)) mode = 'auto';
  }
  const outside = mode === 'outside';
  const table = mode === 'auto' || mode === 'legend' || mode === 'inside';
  const inner = mode === 'auto' || mode === 'inside';
  const body = [];

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
  if (half && spec.height === undefined && !(table && narrow)) {
    const tableBottom = table ? ty + slices.length * rowH : 0;
    frame.setHeight(Math.max(cy + 12, tableBottom) + frame.chrome);
  }

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
    if (isDashed(q.s)) body.push(el('path', { d: arc(cx, cy, R - sep, r0 > 0 ? r0 + sep : 0, q.a0 + sep / R, q.a1 - sep / R), fill: 'none', stroke: H.stroke(colorOf(q.s)), strokeWidth: 1.2, strokeDasharray: DASH.outline, 'pointer-events': 'none' }));
  }

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
function pie(spec, theme) {
  return donut({ ...spec, thickness: 1 }, theme);
}

return { "donut": donut, "pie": pie };
});
__def("src/charts/sunburst.js", function () {
const { el, g, text, tip } = __req("src/svg.js");
const { measure } = __req("src/text.js");
const { makeFormat } = __req("src/format.js");
const { textOn } = __req("src/theme.js");
const { humanize } = __req("src/data.js");
const { createFrame } = __req("src/frame.js");
const { buildHierarchy, findNode, assignColors, shareFmt, breadcrumb, height, otherNote, SEP } = __req("src/hierarchy.js");

const TAU = Math.PI * 2;
const f = (n) => n.toFixed(2);

function arcPath(cx, cy, r0, r1, a0, a1) {
  if (a1 - a0 >= TAU - 1e-6) a1 = a0 + TAU - 1e-4;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const p = (r, a) => `${f(cx + r * Math.cos(a))},${f(cy + r * Math.sin(a))}`;
  if (r0 <= 0.01) return `M${f(cx)},${f(cy)}L${p(r1, a0)}A${f(r1)},${f(r1)} 0 ${large} 1 ${p(r1, a1)}Z`;
  return `M${p(r1, a0)}A${f(r1)},${f(r1)} 0 ${large} 1 ${p(r1, a1)}L${p(r0, a1)}A${f(r0)},${f(r0)} 0 ${large} 0 ${p(r0, a0)}Z`;
}

function sunburst(spec, theme) {
  const locale = spec.locale || 'es';
  const en = String(locale).startsWith('en');
  const { root, fields, valueField } = buildHierarchy(spec);
  const focus = findNode(root, spec.focus);
  const levels = Math.max(1, height(focus));
  assignColors(root, theme, spec); // colores estables al navegar
  const vals = [];
  (function walk(n) { vals.push(n.value); n.children.forEach(walk); })(root);
  const fmt = makeFormat(spec.format, locale, vals);
  const share = shareFmt(locale);
  const hl = spec.highlight === undefined ? null : new Set([].concat(spec.highlight).map(String));
  const dim = (n) => hl && !n.path.some((p) => hl.has(p));

  const top = focus.children;
  const legend = top.length > 1 && spec.legend !== false && !focus.path.length
    ? [...top.filter((c) => !c.folded).map((c) => ({ label: c.name, color: c.color, shape: 'square' })), ...(top.some((c) => c.folded) ? [{ label: (top.find((c) => c.other) || {}).name || (en ? 'Other' : 'Otros'), color: theme.other, shape: 'square' }] : [])]
    : [];

  const frame = createFrame(spec, theme, { height: (spec.width || 720) < 560 ? Math.round((spec.width || 720) + 190) : Math.min(560, Math.max(380, (spec.width || 720) * 0.7)) });
  let area = frame.layout(legend);
  const body = [];
  const bc = breadcrumb(focus, area.x, area.y, area.w, theme, locale);
  if (bc.h) { body.push(bc.svg); area = { ...area, y: area.y + bc.h, h: area.h - bc.h }; }

  const R = Math.max(40, Math.min(area.w, area.h) / 2 - 2);
  const cx = area.x + area.w / 2, cy = area.y + area.h / 2;
  const r0 = R * (spec.hole ?? 0.3);
  const weights = Array.from({ length: levels }, (_, i) => (levels >= 3 && i === levels - 1 ? 0.62 : 1));
  const wsum = weights.reduce((a, b) => a + b, 0);
  const radii = [r0];
  weights.forEach((w) => radii.push(radii[radii.length - 1] + ((R - r0) * w) / wsum));

  const total = focus.value, grand = root.value;
  const sep = theme.marks?.gap ?? 2;
  const arcs = [];
  const labels = [];
  (function layout(n, a0, a1, d) {
    let a = a0;
    for (const c of n.children) {
      const span = ((a1 - a0) * c.value) / (n.value || 1);
      if (d < levels) {
        arcs.push({ n: c, a0: a, a1: a + span, r0: radii[d], r1: radii[d + 1], d: d + 1 });
        layout(c, a, a + span, d + 1);
      }
      a += span;
    }
  })(focus, -Math.PI / 2, (3 * Math.PI) / 2, 0);

  for (const a of arcs) {
    const n = a.n;
    const fill = dim(n) ? theme.dim : n.color;
    const parent = n.parent && n.parent.depth > 0 ? n.parent : null;
    const t = tip(n.path.join(SEP), `${fmt(n.value)} · ${share(n.value, grand)} ${en ? 'of total' : 'del total'}`, parent ? `${share(n.value, parent.value)} ${en ? 'of' : 'de'} ${parent.name}` : '', otherNote(n, locale));
    const drill = n.children.length ? JSON.stringify(n.path) : undefined;
    body.push(el('path', {
      class: 'pa-m', d: arcPath(cx, cy, a.r0, a.r1, a.a0, a.a1), fill,
      stroke: theme.surface, strokeWidth: Math.min(sep, 1.75), strokeLinejoin: 'round',
      'data-tip': t, 'data-drill': drill, style: drill ? 'cursor:pointer' : undefined,
    }));
    const mid = (a.a0 + a.a1) / 2;
    const rm = (a.r0 + a.r1) / 2;
    const thick = a.r1 - a.r0;
    const ink = textOn(fill, theme);
    for (const size of [12, 11, 10]) {
      const w = measure(n.name, size, 600);
      const deg = (mid * 180) / Math.PI;
      const half = (a.a1 - a.a0) / 2;
      const rt = a.r0 + 2 + size / 2;
      const reach = Math.sqrt((rt + size / 2) ** 2 + (w / 2 + 3) ** 2);
      const angOk = half < Math.PI / 2 && w / 2 + 4 <= (rt - size / 2) * Math.tan(half);
      if (reach <= a.r1 - 2 && angOk) {
        const lo = rt, hi = Math.sqrt(Math.max(0, (a.r1 - 2) ** 2 - (w / 2 + 3) ** 2)) - size / 2;
        const rr = Math.max(lo, Math.min(hi, (lo + hi) / 2));
        let rot = deg + 90;
        if (Math.sin(mid) > 0) rot -= 180;
        labels.push(text(0, 0, n.name, { transform: `translate(${f(cx + rr * Math.cos(mid))},${f(cy + rr * Math.sin(mid))}) rotate(${f(rot)})`, textAnchor: 'middle', dy: size * 0.35, fill: ink, fontSize: size, fontWeight: 600, pointerEvents: 'none' }));
        break;
      }
      if (w + 10 <= thick && 2 * a.r0 * Math.sin(Math.min(half, Math.PI / 2)) >= size + 3) {
        let rot = deg;
        if (Math.cos(mid) < 0) rot += 180;
        labels.push(text(0, 0, n.name, { transform: `translate(${f(cx + rm * Math.cos(mid))},${f(cy + rm * Math.sin(mid))}) rotate(${f(rot)})`, textAnchor: 'middle', dy: size * 0.35, fill: ink, fontSize: size, fontWeight: 600, pointerEvents: 'none' }));
        break;
      }
    }
  }
  body.push(g({ class: 'pa-labels' }, labels));

  const big = spec.centerValue ?? fmt(total);
  let bigSize = Math.min(30, r0 * 0.46);
  while (bigSize > 12 && measure(big, bigSize, 600) > r0 * 1.7) bigSize -= 1;
  const small = spec.centerLabel ?? (focus.path.length ? focus.name : en ? 'Total' : 'Total');
  const up = focus.path.length ? JSON.stringify(focus.path.slice(0, -1)) : undefined;
  body.push(g({ class: 'pa-center', 'data-drill': up, style: up ? 'cursor:pointer' : undefined }, [
    el('circle', { cx, cy, r: Math.max(0, r0 - 2), fill: theme.surface }),
    text(cx, cy + bigSize * 0.3, big, { fill: theme.ink, fontSize: bigSize, fontWeight: 600, textAnchor: 'middle' }),
    measure(small, 11.5) <= r0 * 1.7 ? text(cx, cy + bigSize * 0.3 + 16, small, { fill: theme.lede, fontSize: 11.5, textAnchor: 'middle' }) : '',
  ]));

  const top3 = top.slice(0, 3).map((c) => `${c.name} ${share(c.value, total)}`).join(', ');
  const what = humanize(valueField);
  const desc = en
    ? `Sunburst of ${what} in ${fields.length} levels, total ${fmt(total)}. Largest groups: ${top3}.`
    : `Sunburst de ${what.toLowerCase()} en ${fields.length} niveles, total ${fmt(total)}. Mayores grupos: ${top3}.`;
  return frame.finish(body, { desc, type: 'sunburst' });
}

return { "sunburst": sunburst };
});
__def("src/charts/dist.js", function () {
const { el, g, text, tip, barPath } = __req("src/svg.js");
const { measure } = __req("src/text.js");
const { makeFormat, formatNumber } = __req("src/format.js");
const { niceDomain, niceStep, linear, log, logDomain } = __req("src/scale.js");
const { colorMap } = __req("src/theme.js");
const { ensureData, requireField, num, fieldsOf, fieldKind, uniq, humanize } = __req("src/data.js");
const { yAxisMargin, yAxisTop, yGrid, yTickLabels, gridX, ticksWidth } = __req("src/axes.js");
const { createFrame } = __req("src/frame.js");
const { ctx } = __req("src/context.js");
const { histogram: binValues, kde: kdeEst, scottBandwidth, ecdf: ecdfEst, quantile, finite, median } = __req("src/stats.js");


const EN = (spec) => String(spec.locale || 'es').startsWith('en');

/** Campo de grupo: `hue` (seaborn), `series` o `color` (si no es un hex). */
function hueField(spec) {
  const h = spec.hue ?? spec.series ?? (typeof spec.color === 'string' && !spec.color.startsWith('#') ? spec.color : undefined);
  return h || null;
}

/** Agrupa valores numéricos de `field` por grupo. Devuelve [{ key, values }]. */
function groupValues(data, field, hue) {
  const keys = hue ? uniq(data.map((r) => String(r[hue]))) : [''];
  const m = new Map(keys.map((k) => [k, []]));
  for (const r of data) {
    const v = num(r[field]);
    if (!Number.isFinite(v)) continue;
    m.get(hue ? String(r[hue]) : '').push(v);
  }
  return keys.map((k) => ({ key: k, values: m.get(k) })).filter((gr) => gr.values.length);
}

/**
 * Dominio de un eje numérico (lineal o log), con override `[min, max]`.
 * Devuelve { min, max, step, isLog, ticks, scale(r0, r1) }.
 */
function axisDomain(values, { domain, type, count = 5, zero = false, nice = true } = {}) {
  const fin = finite(values);
  if (type === 'log') {
    const pos = fin.filter((v) => v > 0);
    const d = domain ? { min: domain[0], max: domain[1] } : logDomain(Math.min(...pos), Math.max(...pos));
    const ticks = log(d.min, d.max, 0, 1).ticks();
    return { min: d.min, max: d.max, step: null, isLog: true, ticks, scale: (r0, r1) => log(d.min, d.max, r0, r1) };
  }
  let lo = fin.length ? Math.min(...fin) : 0, hi = fin.length ? Math.max(...fin) : 1;
  if (zero) { lo = Math.min(0, lo); hi = Math.max(0, hi); }
  let d;
  if (domain) {
    const step = niceStep(domain[1] - domain[0], count);
    d = { min: domain[0], max: domain[1], step };
  } else if (nice === 'tight') {
    const span = hi - lo || Math.abs(hi) || 1;
    const a = zero && lo >= 0 ? Math.max(0, lo - span * 0.04) : lo - span * 0.04;
    d = { min: a, max: hi + span * 0.04, step: niceStep(span * 1.08, count) };
  } else if (!nice) {
    d = { min: lo, max: hi === lo ? lo + 1 : hi, step: niceStep((hi === lo ? 1 : hi - lo), count) };
  } else d = niceDomain(lo, hi, count);
  const mag = 10 ** Math.floor(Math.log10(d.step));
  if (Math.abs(d.step / mag - 2.5) < 1e-9) d.step = 2 * mag;
  const ticks = linear(d.min, d.max, 0, 1).ticks(d.step);
  return { min: d.min, max: d.max, step: d.step, isLog: false, ticks, scale: (r0, r1) => linear(d.min, d.max, r0, r1) };
}

/** Formateador de marcas para un eje (lineal o log). */
const tickFmt = (fmt, ax) => (ax.isLog ? fmt : fmt.tick(ax.step));

/** Títulos de eje horizontales: y arriba a la izquierda, x abajo a la derecha. */
function axisTitles(body, theme, area, inner, { x, y }) {
  const size = theme.type?.axis ?? 11.5;
  if (y) body.push(text(area.x, area.y + 10, y, { fill: theme.lede, fontSize: size + 0.5, fontWeight: 500 }));
  if (x) body.push(text(inner.x + inner.w, inner.y + inner.h + 22 + 16 * ctx.textScale, x, { fill: theme.lede, fontSize: size + 0.5, fontWeight: 500, textAnchor: 'end' }));
}

/** Escala log10 → valor, para bins en espacio logarítmico. */
const T = (isLog) => (isLog ? { f: (v) => Math.log10(v), inv: (t) => 10 ** t } : { f: (v) => v, inv: (t) => t });

const halo = (theme) => ({ stroke: theme.surface, strokeWidth: 3, paintOrder: 'stroke', strokeLinejoin: 'round' });

function rangeLabel(a, b, fx) {
  return `${fx(a)} – ${fx(b)}`;
}


/**
 * Histograma. Opciones: x (o y para horizontal), hue, bins, binWidth,
 * stat ('count' | 'percent' | 'density' | 'probability'), kde, multiple
 * ('layer' | 'stack' | 'dodge' | 'fill'), element ('bars' | 'step'),
 * cumulative, commonNorm (true), xScale 'log', xDomain, yDomain.
 */
function hist(spec, theme) {
  const data = ensureData(spec);
  const fields = fieldsOf(data);
  const horizontal = !spec.x && !!spec.y;
  const field = spec.x ?? spec.y ?? fields.find((f) => fieldKind(data, f) === 'number');
  requireField(data, field, horizontal ? 'y' : 'x');
  const hue = hueField(spec);
  if (hue) requireField(data, hue, 'hue');
  const en = EN(spec);
  const locale = spec.locale || 'es';
  const isLog = (horizontal ? spec.yScale : spec.xScale) === 'log';
  const tr = T(isLog);
  const groups = groupValues(data, field, hue).map((gr) => ({ ...gr, values: isLog ? gr.values.filter((v) => v > 0) : gr.values }));
  const all = groups.flatMap((gr) => gr.values);
  if (!all.length) return emptyChart(spec, theme, en);
  const N = all.length;
  const stat = spec.stat || 'count';
  const multiple = groups.length > 1 ? spec.multiple || 'layer' : 'layer';
  const commonNorm = spec.commonNorm ?? spec.common_norm ?? true;

  const dom = spec[horizontal ? 'yDomain' : 'xDomain'];
  const tAll = all.map(tr.f);
  const edges0 = binValues(tAll, { bins: spec.bins, binWidth: spec.binWidth && !isLog ? spec.binWidth : undefined, domain: dom ? dom.map(tr.f) : undefined });
  const bins = edges0.map((b) => ({ t0: b.x0, t1: b.x1, x0: tr.inv(b.x0), x1: tr.inv(b.x1) }));
  const step = bins.length ? bins[0].t1 - bins[0].t0 : 1;
  const start = bins[0].t0;
  const counts = groups.map((gr) => {
    const c = new Array(bins.length).fill(0);
    for (const v of gr.values) {
      let i = Math.floor((tr.f(v) - start) / step + 1e-9);
      if (i === bins.length) i = bins.length - 1;
      if (i >= 0 && i < bins.length) c[i]++;
    }
    return c;
  });
  const norm = (gi) => (commonNorm ? N : groups[gi].values.length);
  let H = counts.map((c, gi) => c.map((n) => {
    if (stat === 'percent') return (n / norm(gi)) * 100;
    if (stat === 'probability' || stat === 'proportion') return n / norm(gi);
    if (stat === 'density') return n / (norm(gi) * step);
    return n;
  }));
  if (spec.cumulative) H = H.map((h) => { let acc = 0; return h.map((v) => (acc += stat === 'density' ? v * step : v)); });

  const K = groups.length;
  const base = H.map((h) => h.map(() => 0));
  if (multiple === 'stack' || multiple === 'fill') {
    for (let i = 0; i < bins.length; i++) {
      let acc = 0;
      const tot = H.reduce((a, h) => a + h[i], 0) || 1;
      for (let gi = 0; gi < K; gi++) {
        const v = multiple === 'fill' ? H[gi][i] / tot : H[gi][i];
        base[gi][i] = acc;
        acc += v;
        H[gi][i] = acc;
      }
    }
  }
  const tops = H.flat();
  const statLabel = {
    count: en ? 'Count' : 'Frecuencia', percent: en ? 'Percent' : 'Porcentaje', density: en ? 'Density' : 'Densidad',
    probability: en ? 'Probability' : 'Proporción', proportion: en ? 'Proportion' : 'Proporción',
  }[stat] || stat;
  const fy = multiple === 'fill' ? makeFormat({ type: 'percent', scale: 100 }, locale) : stat === 'percent' ? makeFormat({ type: 'percent', scale: 1 }, locale) : makeFormat(spec.yFormat ?? (stat === 'count' ? 'integer' : undefined), locale, tops);
  const fx = makeFormat(spec.xFormat ?? spec.format, locale, all);

  const kdes = spec.kde && multiple !== 'fill' && !spec.cumulative
    ? groups.map((gr, gi) => {
        const share = gr.values.length / norm(gi);
        const scale = stat === 'count' ? gr.values.length * step : stat === 'percent' ? share * step * 100 : stat === 'density' ? share : share * step;
        return kdeEst(gr.values.map(tr.f), { adjust: spec.bwAdjust ?? 1, extent: [bins[0].t0, bins[bins.length - 1].t1], gridSize: 140 }).map(([t, d]) => [t, d * scale]);
      })
    : null;
  if (kdes && multiple === 'stack') {
    for (let i = 0; i < kdes[0].length; i++) { let acc = 0; for (const k of kdes) { acc += k[i][1]; k[i][1] = acc; } }
  }
  const kdeMax = kdes ? Math.max(...kdes.flatMap((k) => k.map((p) => p[1]))) : 0;

  const cmap = colorMap(groups.map((gr) => gr.key), theme, spec.colors);
  const single = K === 1;
  const colorOf = (gi) => (single ? (spec.colors && spec.colors[groups[0].key]) || theme.categorical[0] : cmap.get(groups[gi].key));
  const legend = !single && spec.legend !== false ? groups.map((gr) => ({ label: gr.key, color: cmap.get(gr.key), shape: 'square' })) : [];

  const frame = createFrame(spec, theme, { height: 400 });
  const area = frame.layout(legend);
  const body = [];
  const M = theme.marks || {};
  const vMax = Math.max(...tops, kdeMax);
  const valueOverride = horizontal ? spec.xDomain : spec.yDomain;
  const vAx = axisDomain([0, vMax], { domain: multiple === 'fill' ? [0, 1] : valueOverride, count: Math.max(3, Math.round((horizontal ? area.w / 110 : area.h / 64))), zero: true });
  const binDom = dom ? [dom[0], dom[1]] : [bins[0].x0, bins[bins.length - 1].x1];
  const clipId = 'pa-clip-h' + Math.abs(hashStr((spec.title || '') + field + area.w)).toString(36);
  const writeDomains = (bin, val) => { if (spec._domains && typeof spec._domains === 'object') { spec._domains[horizontal ? 'y' : 'x'] = bin; spec._domains[horizontal ? 'x' : 'y'] = val; } };

  if (!horizontal) {
    const ticksF = tickFmt(fy, vAx);
    const leftM = yAxisMargin(vAx.ticks, ticksF, theme, false);
    const top = (spec.yLabel !== false ? 18 : 0) + yAxisTop(theme, false);
    const inner = { x: area.x + leftM, y: area.y + top, w: area.w - leftM - 4, h: area.h - top - 44 };
    const yS = vAx.scale(inner.y + inner.h, inner.y);
    const bAx = axisDomain(binDom, { type: isLog ? 'log' : undefined, domain: binDom, count: Math.max(3, Math.round(inner.w / 90)) });
    const xS = bAx.scale(inner.x, inner.x + inner.w);
    writeDomains([bAx.min, bAx.max], [vAx.min, vAx.max]);
    body.push(el('clipPath', { id: clipId }, el('rect', { x: inner.x, y: inner.y - 2, width: inner.w, height: inner.h + 2 })));
    body.push(yGrid(vAx.ticks, yS, inner, theme));
    body.push(g({ clipPath: `url(#${clipId})` }, drawBins({ bins, H, base, K, multiple, element: spec.element, xS, yS, theme, M, colorOf, single, inner, groups, fy, fx, stat, horizontal: false, statLabel })));
    if (kdes) kdes.forEach((k, gi) => body.push(el('path', { d: k.map(([t, d], i) => `${i ? 'L' : 'M'}${xS(tr.inv(t)).toFixed(2)},${yS(d).toFixed(2)}`).join(''), fill: 'none', stroke: single ? theme.ink : colorOf(gi), strokeWidth: M.lineWidth ?? 2, strokeLinejoin: 'round', strokeLinecap: 'round', opacity: single ? 0.8 : 1 })));
    body.push(el('line', { x1: inner.x, x2: inner.x + inner.w, y1: Math.round(yS(0)) + 0.5, y2: Math.round(yS(0)) + 0.5, stroke: theme.axis, strokeWidth: 1 }));
    body.push(gridX(isLog ? bAx.ticks : bAx.ticks, xS, inner, theme, tickFmt(fx, bAx), { lines: false }));
    body.push(yTickLabels(vAx.ticks, yS, inner, theme, ticksF, { inside: false }));
    axisTitles(body, theme, area, inner, { x: spec.xLabel ?? humanize(field), y: spec.yLabel === false ? null : spec.yLabel ?? (multiple === 'fill' ? (en ? 'Share' : 'Proporción') : statLabel) });
  } else {
    const binTicks = axisDomain(binDom, { type: isLog ? 'log' : undefined, domain: binDom, count: Math.max(3, Math.round(area.h / 60)) });
    const bf = tickFmt(fx, binTicks);
    const leftM = ticksWidth(binTicks.ticks, bf, theme.type?.axis) + 10;
    const top = spec.yLabel !== false ? 22 : 6;
    const inner = { x: area.x + leftM, y: area.y + top, w: area.w - leftM - 8, h: area.h - top - 44 };
    const yS = binTicks.scale(inner.y + inner.h, inner.y);
    const xS = vAx.scale(inner.x, inner.x + inner.w);
    writeDomains([binTicks.min, binTicks.max], [vAx.min, vAx.max]);
    body.push(el('clipPath', { id: clipId }, el('rect', { x: inner.x, y: inner.y, width: inner.w + 2, height: inner.h })));
    body.push(gridX(vAx.ticks, xS, inner, theme, tickFmt(fy, vAx), { lines: true }));
    body.push(drawBins({ bins, H, base, K, multiple, element: spec.element, xS, yS, theme, M, colorOf, single, inner, groups, fy, fx, stat, horizontal: true, statLabel }));
    if (kdes) kdes.forEach((k, gi) => body.push(el('path', { d: k.map(([t, d], i) => `${i ? 'L' : 'M'}${xS(d).toFixed(2)},${yS(tr.inv(t)).toFixed(2)}`).join(''), fill: 'none', stroke: single ? theme.ink : colorOf(gi), strokeWidth: M.lineWidth ?? 2, strokeLinejoin: 'round', opacity: single ? 0.8 : 1 })));
    body.push(el('line', { x1: Math.round(xS(0)) + 0.5, x2: Math.round(xS(0)) + 0.5, y1: inner.y, y2: inner.y + inner.h, stroke: theme.axis, strokeWidth: 1 }));
    body.push(g({ class: 'pa-axis' }, binTicks.ticks.map((t) => text(inner.x - 8, yS(t) + 4, bf(t), { fill: theme.muted, fontSize: theme.type?.axis ?? 11.5, textAnchor: 'end' }))));
    axisTitles(body, theme, area, inner, { y: spec.yLabel === false ? null : spec.yLabel ?? humanize(field), x: spec.xLabel ?? statLabel });
  }

  const sorted = [...all].sort((a, b) => a - b);
  const allCounts = bins.map((_, i) => counts.reduce((a, c) => a + c[i], 0));
  const mi = allCounts.indexOf(Math.max(...allCounts));
  const what = humanize(field).toLowerCase();
  const desc = en
    ? `Histogram of ${what} with ${N} observations${K > 1 ? ` in ${K} groups` : ''}. Median ${fx(quantile(sorted, 0.5))}; the most frequent range is ${rangeLabel(bins[mi].x0, bins[mi].x1, fx)}.`
    : `Histograma de ${what} con ${formatNumber(N, 0, locale)} observaciones${K > 1 ? ` en ${K} grupos` : ''}. Mediana ${fx(quantile(sorted, 0.5))}; el rango más frecuente es ${rangeLabel(bins[mi].x0, bins[mi].x1, fx)}.`;
  return frame.finish(body, { desc, type: 'hist' });
}

function drawBins({ bins, H, base, K, multiple, element, xS, yS, theme, M, colorOf, single, inner, groups, fy, fx, stat, horizontal, statLabel }) {
  const out = [];
  const layered = multiple === 'layer' && K > 1;
  const op = layered ? 0.55 : 1;
  if (element === 'step') {
    for (let gi = 0; gi < K; gi++) {
      const c = colorOf(gi);
      const pts = [];
      bins.forEach((b, i) => {
        if (!horizontal) { pts.push([xS(b.x0), yS(H[gi][i])], [xS(b.x1), yS(H[gi][i])]); }
        else { pts.push([xS(H[gi][i]), yS(b.x0)], [xS(H[gi][i]), yS(b.x1)]); }
      });
      const line = pts.map(([a, b], i) => `${i ? 'L' : 'M'}${a.toFixed(2)},${b.toFixed(2)}`).join('');
      const baseline = bins.map((b, i) => (!horizontal ? [[xS(b.x1), yS(base[gi][i])], [xS(b.x0), yS(base[gi][i])]] : [[xS(base[gi][i]), yS(b.x1)], [xS(base[gi][i]), yS(b.x0)]])).reverse().flat();
      const area = line + 'L' + baseline.map(([a, b]) => `${a.toFixed(2)},${b.toFixed(2)}`).join('L') + 'Z';
      out.push(g({ class: 'pa-m', 'data-tip': tip(groups[gi].key || statLabel, `n = ${groups[gi].values.length}`) }, [
        el('path', { d: area, fill: c, fillOpacity: (M.areaOpacity ?? 0.12) * 1.6 }),
        el('path', { d: line, fill: 'none', stroke: c, strokeWidth: M.lineWidth ?? 2, strokeLinejoin: 'round' }),
      ]));
    }
    return g({}, out);
  }
  bins.forEach((b, i) => {
    const p0 = !horizontal ? xS(b.x0) : yS(b.x1);
    const p1 = !horizontal ? xS(b.x1) : yS(b.x0);
    const full = p1 - p0;
    const gap = full > 8 ? (M.gap ?? 2) : full > 3 ? 1 : 0;
    const groupTip = tip(rangeLabel(b.x0, b.x1, fx), ...groups.map((gr, gi) => {
      const v = multiple === 'stack' || multiple === 'fill' ? H[gi][i] - base[gi][i] : H[gi][i];
      return `${gr.key ? gr.key + ': ' : ''}${fy(v)}`;
    }));
    const parts = [];
    for (let gi = 0; gi < K; gi++) {
      let a0 = p0 + gap / 2, a1 = p1 - gap / 2;
      if (multiple === 'dodge' && K > 1) { const w = (a1 - a0) / K; a0 = a0 + gi * w; a1 = a0 + w - (w > 4 ? 1 : 0); }
      const v1 = H[gi][i], v0 = base[gi][i];
      if (!(v1 - v0 > 0) && multiple !== 'layer') continue;
      if (!(v1 > 0)) continue;
      const isTop = multiple !== 'stack' && multiple !== 'fill' ? true : gi === K - 1 || H.slice(gi + 1).every((h, k) => !(h[i] - base[gi + 1 + k][i] > 0));
      const radius = Math.min(M.barRadius ?? 4, 2.5);
      let d;
      if (!horizontal) {
        const ya = yS(v1), yb = yS(v0) - (v0 > 0 ? 1 : 0);
        d = barPath(a0, ya, Math.max(0, a1 - a0), Math.max(0, yb - ya), 'up', isTop ? radius : 0);
      } else {
        const xa = xS(v0) + (v0 > 0 ? 1 : 0), xb = xS(v1);
        d = barPath(xa, a0, Math.max(0, xb - xa), Math.max(0, a1 - a0), 'right', isTop ? radius : 0);
      }
      if (d) parts.push(el('path', { d, fill: colorOf(gi), fillOpacity: op }));
    }
    const hit = !horizontal
      ? el('rect', { x: p0, y: inner.y, width: Math.max(0, full), height: inner.h, fill: 'transparent' })
      : el('rect', { x: inner.x, y: p0, width: inner.w, height: Math.max(0, full), fill: 'transparent' });
    out.push(g({ class: 'pa-m', 'data-tip': groupTip }, [hit, ...parts]));
  });
  return g({}, out);
}


/**
 * Densidad por kernel. Opciones: x, hue, fill (true), multiple ('layer' |
 * 'stack' | 'fill'), bwAdjust, cut (3), clip [a,b], cumulative, commonNorm,
 * rug, labels ('auto' rotula el pico de cada grupo), xScale 'log', xDomain, yDomain.
 */
function kde(spec, theme) {
  const data = ensureData(spec);
  const fields = fieldsOf(data);
  const field = spec.x ?? spec.y ?? fields.find((f) => fieldKind(data, f) === 'number');
  requireField(data, field, 'x');
  const hue = hueField(spec);
  if (hue) requireField(data, hue, 'hue');
  const en = EN(spec);
  const locale = spec.locale || 'es';
  const isLog = spec.xScale === 'log';
  const tr = T(isLog);
  const groups = groupValues(data, field, hue).map((gr) => ({ ...gr, values: isLog ? gr.values.filter((v) => v > 0) : gr.values })).filter((gr) => gr.values.length > 1);
  if (!groups.length) return emptyChart(spec, theme, en);
  const all = groups.flatMap((gr) => gr.values);
  const N = all.length;
  const K = groups.length;
  const multiple = K > 1 ? spec.multiple || 'layer' : 'layer';
  const commonNorm = spec.commonNorm ?? spec.common_norm ?? !spec.cumulative;
  const cut = spec.cut ?? 3;
  const adjust = spec.bwAdjust ?? spec.bw_adjust ?? 1;
  const bws = groups.map((gr) => scottBandwidth(gr.values.map(tr.f)) * adjust);
  let lo = Math.min(...groups.map((gr, i) => Math.min(...gr.values.map(tr.f)) - cut * bws[i]));
  let hi = Math.max(...groups.map((gr, i) => Math.max(...gr.values.map(tr.f)) + cut * bws[i]));
  if (spec.clip) { lo = Math.max(lo, tr.f(spec.clip[0])); hi = Math.min(hi, tr.f(spec.clip[1])); }
  if (spec.xDomain) { lo = tr.f(spec.xDomain[0]); hi = tr.f(spec.xDomain[1]); }
  const G = 200;
  let curves = groups.map((gr, i) => {
    const share = commonNorm ? gr.values.length / N : 1;
    return kdeEst(gr.values.map(tr.f), { bandwidth: bws[i], extent: [lo, hi], gridSize: G }).map(([t, d]) => [t, d * share]);
  });
  if (spec.cumulative) {
    curves = curves.map((c) => { let acc = 0; return c.map(([t, d], i) => { if (i) acc += ((d + c[i - 1][1]) / 2) * (t - c[i - 1][0]); return [t, acc]; }); });
  }
  const base = curves.map((c) => c.map(() => 0));
  if (multiple === 'stack' || multiple === 'fill') {
    for (let i = 0; i < G; i++) {
      let acc = 0;
      const tot = curves.reduce((a, c) => a + c[i][1], 0) || 1;
      for (let k = 0; k < K; k++) {
        const v = multiple === 'fill' ? curves[k][i][1] / tot : curves[k][i][1];
        base[k][i] = acc; acc += v; curves[k][i] = [curves[k][i][0], acc];
      }
    }
  }
  const yMax = Math.max(...curves.flatMap((c) => c.map((p) => p[1])));
  const cmap = colorMap(groups.map((gr) => gr.key), theme, spec.colors);
  const hl = spec.highlight === undefined ? null : new Set([].concat(spec.highlight).map(String));
  const colorOf = (k) => (hl && !hl.has(groups[k].key) ? theme.dim : K === 1 ? (spec.colors && spec.colors[groups[0].key]) || theme.categorical[0] : cmap.get(groups[k].key));
  const legend = K > 1 && spec.legend !== false ? groups.map((gr, k) => ({ label: gr.key, color: colorOf(k), shape: spec.fill === false ? 'line' : 'square' })) : [];

  const frame = createFrame(spec, theme, { height: 380 });
  const area = frame.layout(legend);
  const M = theme.marks || {};
  const fx = makeFormat(spec.xFormat ?? spec.format, locale, all);
  const fy = multiple === 'fill' || spec.cumulative ? makeFormat({ type: 'percent', scale: 100 }, locale) : makeFormat(spec.yFormat, locale, [yMax]);
  const vAx = axisDomain([0, yMax], { domain: multiple === 'fill' ? [0, 1] : spec.yDomain, zero: true, count: Math.max(3, Math.round(area.h / 70)) });
  const ticksF = tickFmt(fy, vAx);
  const rugH = spec.rug ? 10 : 0;
  const insideY = multiple === 'fill' ? false : undefined;
  const top = 18 + yAxisTop(theme, insideY);
  const leftM = yAxisMargin(vAx.ticks, ticksF, theme, insideY);
  const inner = { x: area.x + leftM, y: area.y + top, w: area.w - leftM - 4, h: area.h - top - 44 - rugH };
  const yS = vAx.scale(inner.y + inner.h, inner.y);
  const xDomVals = [tr.inv(lo), tr.inv(hi)];
  const xAx = axisDomain(xDomVals, { type: isLog ? 'log' : undefined, domain: xDomVals, count: Math.max(3, Math.round(inner.w / 90)) });
  const xS = xAx.scale(inner.x, inner.x + inner.w);
  const P = ([t, d]) => `${xS(tr.inv(t)).toFixed(2)},${yS(d).toFixed(2)}`;
  if (spec._domains && typeof spec._domains === 'object') { spec._domains.x = [xAx.min, xAx.max]; spec._domains.y = [vAx.min, vAx.max]; }

  const body = [];
  body.push(yGrid(vAx.ticks, yS, inner, theme));
  const stacked = multiple === 'stack' || multiple === 'fill';
  const order = stacked ? [...groups.keys()].reverse() : [...groups.keys()].sort((a, b) => (hl ? (hl.has(groups[a].key) ? 1 : 0) - (hl.has(groups[b].key) ? 1 : 0) : 0));
  for (const k of order) {
    const c = curves[k];
    const color = colorOf(k);
    const top = 'M' + c.map(P).join('L');
    const parts = [];
    if (spec.fill !== false || stacked) {
      const bottom = base[k].map((b, i) => [c[i][0], b]).reverse().map(P).join('L');
      parts.push(el('path', { d: top + 'L' + bottom + 'Z', fill: color, fillOpacity: stacked ? 0.85 : (M.areaOpacity ?? 0.12) * 1.5, stroke: stacked ? theme.surface : 'none', strokeWidth: stacked ? 1.5 : 0 }));
    }
    if (!stacked) parts.push(el('path', { d: top, fill: 'none', stroke: color, strokeWidth: M.lineWidth ?? 2, strokeLinejoin: 'round', strokeLinecap: 'round' }));
    const vs = [...groups[k].values].sort((a, b) => a - b);
    body.push(g({ class: 'pa-m', 'data-tip': tip(groups[k].key || humanize(field), `n = ${formatNumber(vs.length, 0, locale)}`, `${en ? 'Median' : 'Mediana'}: ${fx(quantile(vs, 0.5))}`, `P25–P75: ${fx(quantile(vs, 0.25))} – ${fx(quantile(vs, 0.75))}`) }, parts));
  }
  body.push(el('line', { x1: inner.x, x2: inner.x + inner.w, y1: Math.round(yS(0)) + 0.5, y2: Math.round(yS(0)) + 0.5, stroke: theme.axis, strokeWidth: 1 }));
  if (spec.rug) {
    const ry = inner.y + inner.h + 3;
    groups.forEach((gr, k) => {
      const d = gr.values.slice(0, 2000).map((v) => xS(v)).filter((px) => px >= inner.x && px <= inner.x + inner.w).map((px) => `M${px.toFixed(1)},${ry}v${rugH - 3}`).join('');
      if (d) body.push(el('path', { d, stroke: colorOf(k), strokeWidth: 1, opacity: 0.45 }));
    });
  }
  if (K > 1 && !stacked && !spec.cumulative && spec.labels !== false) {
    const boxes = [];
    const labs = [];
    for (let k = 0; k < K; k++) {
      if (hl && !hl.has(groups[k].key)) continue;
      const c = curves[k];
      let pi = 0;
      for (let i = 1; i < c.length; i++) if (c[i][1] > c[pi][1]) pi = i;
      const px = xS(tr.inv(c[pi][0])), py = yS(c[pi][1]) - 8;
      const w = measure(groups[k].key, 12, 600);
      const box = [px - w / 2, py - 12, px + w / 2, py + 2];
      if (box[0] < inner.x || box[2] > inner.x + inner.w || box[1] < area.y + 14) continue;
      if (boxes.some((b) => !(box[2] < b[0] || box[0] > b[2] || box[3] < b[1] || box[1] > b[3]))) continue;
      boxes.push(box);
      labs.push(text(px, py, groups[k].key, { fill: theme.ink, fontSize: 12, fontWeight: 600, textAnchor: 'middle', ...halo(theme) }));
    }
    body.push(g({ class: 'pa-peaks' }, labs));
  }
  body.push(gridX(xAx.ticks, xS, { ...inner, h: inner.h + rugH }, theme, tickFmt(fx, xAx), { lines: false }));
  const showY = spec.yTicks ?? (spec.cumulative || multiple === 'fill');
  if (showY) body.push(yTickLabels(vAx.ticks, yS, inner, theme, ticksF, { inside: insideY }));
  axisTitles(body, theme, area, { ...inner, h: inner.h + rugH }, { x: spec.xLabel ?? humanize(field), y: spec.yLabel === false ? null : spec.yLabel ?? (spec.cumulative ? (en ? 'Cumulative share' : 'Proporción acumulada') : multiple === 'fill' ? (en ? 'Share' : 'Proporción') : en ? 'Density' : 'Densidad') });

  const what = humanize(field).toLowerCase();
  const meds = groups.map((gr) => `${gr.key ? gr.key + ' ' : ''}${fx(median(gr.values))}`).join(', ');
  const desc = en ? `Density plot of ${what} (${N} observations). Median: ${meds}.` : `Gráfico de densidad de ${what} (${formatNumber(N, 0, locale)} observaciones). Mediana: ${meds}.`;
  return frame.finish(body, { desc, type: 'kde' });
}


/** Distribución acumulada empírica. Opciones: x, hue, complementary, xScale 'log', xDomain. */
function ecdf(spec, theme) {
  const data = ensureData(spec);
  const fields = fieldsOf(data);
  const field = spec.x ?? spec.y ?? fields.find((f) => fieldKind(data, f) === 'number');
  requireField(data, field, 'x');
  const hue = hueField(spec);
  if (hue) requireField(data, hue, 'hue');
  const en = EN(spec);
  const locale = spec.locale || 'es';
  const isLog = spec.xScale === 'log';
  const groups = groupValues(data, field, hue).map((gr) => ({ ...gr, values: isLog ? gr.values.filter((v) => v > 0) : gr.values })).filter((gr) => gr.values.length);
  if (!groups.length) return emptyChart(spec, theme, en);
  const all = groups.flatMap((gr) => gr.values);
  const K = groups.length;
  const cmap = colorMap(groups.map((gr) => gr.key), theme, spec.colors);
  const hl = spec.highlight === undefined ? null : new Set([].concat(spec.highlight).map(String));
  const colorOf = (k) => (hl && !hl.has(groups[k].key) ? theme.dim : K === 1 ? theme.categorical[0] : cmap.get(groups[k].key));
  const legend = K > 1 && spec.legend !== false ? groups.map((gr, k) => ({ label: gr.key, color: colorOf(k), shape: 'line' })) : [];
  const frame = createFrame(spec, theme, { height: 380 });
  const area = frame.layout(legend);
  const M = theme.marks || {};
  const fx = makeFormat(spec.xFormat ?? spec.format, locale, all);
  const fy = makeFormat({ type: 'percent', scale: 100 }, locale);
  const vAx = axisDomain([0, 1], { domain: [0, 1], count: 4 });
  const ticksF = (v) => fy(v);
  const top = 18 + yAxisTop(theme);
  const inner = { x: area.x + yAxisMargin(vAx.ticks, ticksF, theme), y: area.y + top, w: 0, h: area.h - top - 44 };
  inner.w = area.x + area.w - inner.x - 4;
  const yS = vAx.scale(inner.y + inner.h, inner.y);
  const xAx = axisDomain(all, { type: isLog ? 'log' : undefined, domain: spec.xDomain, count: Math.max(3, Math.round(inner.w / 90)) });
  const xS = xAx.scale(inner.x, inner.x + inner.w);
  if (spec._domains && typeof spec._domains === 'object') { spec._domains.x = [xAx.min, xAx.max]; spec._domains.y = [0, 1]; }
  const body = [yGrid(vAx.ticks, yS, inner, theme)];
  const py50 = Math.round(yS(0.5)) + 0.5;
  body.push(el('line', { x1: inner.x, x2: inner.x + inner.w, y1: py50, y2: py50, stroke: theme.axis, strokeWidth: 1 }));
  const order = [...groups.keys()].sort((a, b) => (hl ? (hl.has(groups[a].key) ? 1 : 0) - (hl.has(groups[b].key) ? 1 : 0) : 0));
  for (const k of order) {
    const pts = ecdfEst(groups[k].values);
    const comp = !!spec.complementary;
    const Y = (p) => (comp ? 1 - p : p);
    let d = `M${xS(Math.max(xAx.min, pts[0][0])).toFixed(2)},${yS(Y(0)).toFixed(2)}`;
    let prev = 0;
    for (const [x, p] of pts) {
      const px = xS(Math.min(xAx.max, Math.max(xAx.min, x))).toFixed(2);
      d += `L${px},${yS(Y(prev)).toFixed(2)}L${px},${yS(Y(p)).toFixed(2)}`;
      prev = p;
    }
    d += `L${xS(xAx.max).toFixed(2)},${yS(Y(1)).toFixed(2)}`;
    const vs = [...groups[k].values].sort((a, b) => a - b);
    body.push(g({ class: 'pa-m', 'data-tip': tip(groups[k].key || humanize(field), `P25: ${fx(quantile(vs, 0.25))}`, `${en ? 'Median' : 'Mediana'}: ${fx(quantile(vs, 0.5))}`, `P75: ${fx(quantile(vs, 0.75))}`, `P90: ${fx(quantile(vs, 0.9))}`) }, [
      el('path', { d, fill: 'none', stroke: 'transparent', strokeWidth: 12 }),
      el('path', { d, fill: 'none', stroke: colorOf(k), strokeWidth: hl && hl.has(groups[k].key) ? (M.lineWidth ?? 2) + 0.75 : M.lineWidth ?? 2, strokeLinejoin: 'round' }),
    ]));
  }
  body.push(text(inner.x + inner.w, py50 - 5, en ? 'Median' : 'Mediana', { fill: theme.muted, fontSize: theme.type?.axis ?? 11.5, textAnchor: 'end', ...halo(theme) }));
  body.push(el('line', { x1: inner.x, x2: inner.x + inner.w, y1: inner.y + inner.h + 0.5, y2: inner.y + inner.h + 0.5, stroke: theme.axis }));
  body.push(gridX(xAx.ticks, xS, inner, theme, tickFmt(fx, xAx), { lines: false }));
  body.push(yTickLabels(vAx.ticks, yS, inner, theme, ticksF));
  axisTitles(body, theme, area, inner, { x: spec.xLabel ?? humanize(field), y: spec.yLabel === false ? null : spec.yLabel ?? (spec.complementary ? (en ? 'Share above' : 'Proporción sobre el valor') : en ? 'Cumulative share' : 'Proporción acumulada') });
  const what = humanize(field).toLowerCase();
  const meds = groups.map((gr) => `${gr.key ? gr.key + ' ' : ''}${fx(median(gr.values))}`).join(', ');
  const desc = en ? `Empirical cumulative distribution of ${what}. Median: ${meds}.` : `Distribución acumulada empírica de ${what}. Mediana: ${meds}.`;
  return frame.finish(body, { desc, type: 'ecdf' });
}

function emptyChart(spec, theme, en) {
  const frame = createFrame(spec, theme, { height: 200 });
  const area = frame.layout([]);
  return frame.finish([text(area.x, area.y + 20, en ? 'No numeric values to plot.' : 'No hay valores numéricos para graficar.', { fill: theme.lede, fontSize: 13 })], { desc: en ? 'Empty chart.' : 'Gráfico vacío.', type: 'empty' });
}

function hashStr(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return h;
}

return { "hueField": hueField, "groupValues": groupValues, "axisDomain": axisDomain, "axisTitles": axisTitles, "hist": hist, "kde": kde, "ecdf": ecdf, "tickFmt": tickFmt };
});
__def("src/charts/regplot.js", function () {
const { el, g, text, tip, esc, barPath, dotLayer } = __req("src/svg.js");
const { measure } = __req("src/text.js");
const { makeFormat, formatNumber } = __req("src/format.js");
const { colorMap, readable } = __req("src/theme.js");
const { ensureData, requireField, num, fieldsOf, fieldKind, uniq, humanize } = __req("src/data.js");
const { yAxisMargin, yAxisTop, yGrid, yTickLabels, gridX, quietCorner } = __req("src/axes.js");
const { createFrame } = __req("src/frame.js");
const { polyfit, lowess, histogram, kde: kdeEst } = __req("src/stats.js");
const { hueField, axisDomain, tickFmt, axisTitles } = __req("src/charts/dist.js");

const EN = (spec) => String(spec.locale || 'es').startsWith('en');
const halo = (theme) => ({ stroke: theme.surface, strokeWidth: 3, paintOrder: 'stroke', strokeLinejoin: 'round' });
const dec = (v, locale, d = 2) => formatNumber(v, d, locale);

/** Lee puntos (x, y, grupo, nombre) válidos para escalas log si corresponde. */
function readPoints(spec, data, { needY = true } = {}) {
  const fields = fieldsOf(data);
  const numeric = fields.filter((f) => ['number', 'year'].includes(fieldKind(data, f)));
  const x = spec.x || numeric[0];
  const y = spec.y || numeric.find((f) => f !== x);
  requireField(data, x, 'x');
  if (needY) requireField(data, y, 'y');
  const hue = hueField(spec);
  if (hue) requireField(data, hue, 'hue');
  const labelF = spec.label ?? null;
  if (labelF) requireField(data, labelF, 'label');
  const xLog = spec.xScale === 'log' || (spec.logx && spec.xScale === undefined);
  const yLog = spec.yScale === 'log';
  const pts = data
    .map((r) => ({ x: num(r[x]), y: num(r[y]), k: hue ? String(r[hue]) : '', name: labelF ? String(r[labelF] ?? '') : '' }))
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y) && (!xLog || p.x > 0) && (!yLog || p.y > 0));
  const keys = hue ? uniq(pts.map((p) => p.k)) : [''];
  return { x, y, hue, labelF, pts, keys, xLog, yLog };
}

/** Ajuste de un grupo: devuelve { line: [[x,y]], band: [[x,lo,hi]] | null, r2, n }. */
function fitGroup(gp, spec, { xLog, xMin, xMax, steps = 90 }) {
  const fx = (v) => (spec.logx ? Math.log10(v) : v);
  const xs = gp.map((p) => fx(p.x)), ys = gp.map((p) => p.y);
  const lo = spec.truncate === false ? xMin : Math.min(...gp.map((p) => p.x));
  const hi = spec.truncate === false ? xMax : Math.max(...gp.map((p) => p.x));
  const grid = Array.from({ length: steps }, (_, i) => {
    const t = i / (steps - 1);
    return xLog ? 10 ** (Math.log10(lo) + (Math.log10(hi) - Math.log10(lo)) * t) : lo + (hi - lo) * t;
  });
  if (spec.lowess) {
    const lw = lowess(xs, ys, { frac: spec.frac ?? 2 / 3 });
    const pts = lw.map(([t, v]) => [spec.logx ? 10 ** t : t, v]);
    return { line: pts, band: null, r2: null, n: gp.length };
  }
  const fit = polyfit(xs, ys, { order: spec.order ?? 1, level: (spec.ci ?? 95) / 100 });
  const line = grid.map((v) => [v, fit.predict(fx(v))]);
  const band = spec.ci === false || spec.ci === null || gp.length < (spec.order ?? 1) + 3 ? null : grid.map((v) => [v, ...fit.band(fx(v))]);
  return { line, band, r2: fit.r2, n: fit.n, fit };
}


/**
 * Dispersión con recta (o polinomio / LOWESS) ajustada y banda de confianza.
 * Opciones: x, y, hue, ci (95 | false), order, lowess, logx, truncate (true),
 * scatter (true), annotate, label + labels, xScale/yScale 'log', xDomain, yDomain.
 */
function regplot(spec, theme) {
  const data = ensureData(spec);
  const P = readPoints(spec, data);
  const { pts, keys, xLog, yLog } = P;
  const en = EN(spec);
  const locale = spec.locale || 'es';
  const K = keys.length;
  const cmap = colorMap(keys, theme, spec.colors);
  const hl = spec.highlight === undefined ? null : new Set([].concat(spec.highlight).map(String));
  const focusKey = (k) => !hl || hl.has(k);
  const colorOf = (k) => (!focusKey(k) ? theme.dim : K === 1 ? (spec.colors && spec.colors[k]) || theme.categorical[0] : cmap.get(k));
  const legend = K > 1 && spec.legend !== false ? keys.map((k) => ({ label: k, color: colorOf(k) })) : [];
  const frame = createFrame(spec, theme, { height: 440 });
  const area = frame.layout(legend);
  const M = theme.marks || {};

  const xAx0 = axisDomain(pts.map((p) => p.x), { type: xLog ? 'log' : undefined, domain: spec.xDomain, nice: 'tight', count: Math.max(3, Math.round(area.w / 110)) });
  const fits = keys.map((k) => fitGroup(pts.filter((p) => p.k === k), spec, { xLog, xMin: xAx0.min, xMax: xAx0.max }));
  const yVals = pts.map((p) => p.y).concat(fits.flatMap((f) => f.line.map((q) => q[1])));
  const fx = makeFormat(spec.xFormat, locale, pts.map((p) => p.x));
  const fy = makeFormat(spec.yFormat ?? spec.format, locale, pts.map((p) => p.y));
  const yAx = axisDomain(yVals.filter((v) => !yLog || v > 0), { type: yLog ? 'log' : undefined, domain: spec.yDomain, nice: 'tight', count: Math.max(3, Math.round(area.h / 64)) });
  const yt = tickFmt(fy, yAx);
  const leftM = yAxisMargin(yAx.ticks, yt, theme);

  const endLabels = K > 1 && spec.labels !== false && spec.endLabels !== false;
  const endText = (k, f) => (spec.annotate && f.r2 !== null ? `${k} · R² ${dec(f.r2, locale)}` : k);
  const endW = endLabels ? Math.max(...keys.map((k, i) => measure(endText(k, fits[i]), 12, 600))) + 12 : 0;
  const top = 18 + yAxisTop(theme);
  const r = spec.radius ?? (pts.length > 400 ? 2.5 : pts.length > 120 ? 3.25 : M.pointRadius ?? 4);
  const inner = { x: area.x + leftM, y: area.y + top, w: area.w - leftM - endW - 4, h: area.h - top - 44 };
  const pad = r + 2;
  const xS = xAx0.scale(inner.x + pad, inner.x + inner.w - pad);
  const yS = yAx.scale(inner.y + inner.h - pad, inner.y + pad);
  if (spec._domains && typeof spec._domains === 'object') { spec._domains.x = [xAx0.min, xAx0.max]; spec._domains.y = [yAx.min, yAx.max]; }
  const clipId = 'pa-clip-reg-' + Math.abs(hashStr((spec.title || '') + inner.w + K)).toString(36);

  const body = [];
  body.push(el('clipPath', { id: clipId }, el('rect', { x: inner.x, y: inner.y, width: inner.w, height: inner.h })));
  body.push(yGrid(yAx.ticks, yS, inner, theme, { baseline: NaN }));
  body.push(el('line', { x1: inner.x, x2: inner.x + inner.w, y1: inner.y + inner.h + 0.5, y2: inner.y + inner.h + 0.5, stroke: theme.axis }));

  const L = (arr) => arr.map(([a, b], i) => `${i ? 'L' : 'M'}${xS(a).toFixed(2)},${yS(Math.max(yLog ? 1e-12 : -Infinity, b)).toFixed(2)}`).join('');
  keys.forEach((k, i) => {
    const f = fits[i];
    if (!f.band || !focusKey(k)) return;
    const upper = f.band.map(([x, , hi]) => [x, hi]);
    const lower = f.band.map(([x, lo]) => [x, lo]).reverse();
    body.push(el('path', { d: L(upper) + 'L' + L(lower).slice(1) + 'Z', fill: colorOf(k), fillOpacity: M.bandOpacity ?? 0.16, clipPath: `url(#${clipId})` }));
  });
  if (spec.scatter !== false) {
    const order = [...pts].sort((a, b) => (focusKey(a.k) ? 1 : 0) - (focusKey(b.k) ? 1 : 0));
    const dots = order.map((p) => ({
      class: 'pa-m', cx: xS(p.x), cy: yS(p.y), r, fill: colorOf(p.k), fillOpacity: K === 1 ? (M.dotOpacity ?? 0.85) * 0.75 : M.dotOpacity ?? 0.85,
      stroke: pts.length > 400 ? 'none' : theme.surface, strokeWidth: 1.25,
      'data-tip': tip(p.name || p.k || '', `${humanize(P.x)}: ${fx(p.x)}`, `${humanize(P.y)}: ${fy(p.y)}`, p.name && p.k ? p.k : ''),
    }));
    body.push(g({ class: 'pa-points' }, dotLayer(dots)));
  }
  const ends = [];
  keys.forEach((k, i) => {
    const f = fits[i];
    const c = K === 1 && spec.scatter !== false ? theme.ink : colorOf(k);
    const stats = f.r2 !== null ? `R² = ${dec(f.r2, locale)} · n = ${formatNumber(f.n, 0, locale)}` : `n = ${formatNumber(f.n, 0, locale)}`;
    body.push(g({ class: 'pa-m', 'data-tip': tip(k || (en ? 'Fit' : 'Ajuste'), spec.lowess ? 'LOWESS' : (spec.order ?? 1) > 1 ? (en ? `Polynomial (order ${spec.order})` : `Polinomio (orden ${spec.order})`) : en ? 'Linear fit' : 'Ajuste lineal', stats) }, [
      el('path', { d: L(f.line), fill: 'none', stroke: 'transparent', strokeWidth: 12, clipPath: `url(#${clipId})` }),
      el('path', { d: L(f.line), fill: 'none', stroke: c, strokeWidth: focusKey(k) ? (M.lineWidth ?? 2) + 0.25 : 1.5, strokeLinecap: 'round', strokeLinejoin: 'round', opacity: K === 1 ? 0.9 : 1, clipPath: `url(#${clipId})` }),
    ]));
    const last = f.line[f.line.length - 1];
    if (endLabels && focusKey(k)) ends.push({ k, y: yS(last[1]), y0: yS(last[1]), x: xS(last[0]) + 8, t: endText(k, f) });
  });
  ends.sort((a, b) => a.y - b.y);
  for (let it = 0; it < 30; it++) for (let i = 1; i < ends.length; i++) { const d = ends[i].y - ends[i - 1].y; if (d < 14) { const s = (14 - d) / 2; ends[i].y += s; ends[i - 1].y -= s; } }
  for (const e of ends) {
    const lx = inner.x + inner.w + 6;
    if (Math.abs(e.y - e.y0) > 2 || e.x < lx - 10) body.push(el('path', { d: `M${(e.x - 6).toFixed(1)},${e.y0.toFixed(1)}L${(lx - 2).toFixed(1)},${e.y.toFixed(1)}`, stroke: colorOf(e.k), strokeOpacity: 0.7, strokeWidth: 1, fill: 'none' }));
    body.push(text(lx, e.y + 4, e.t, { fill: readable(colorOf(e.k), theme), fontSize: 12, fontWeight: 600 }));
  }
  body.push(pointLabels(pts, spec, xS, yS, r, inner, theme, P));
  if (spec.annotate && K === 1 && fits[0].r2 !== null) {
    const s = `R² = ${dec(fits[0].r2, locale)} · n = ${formatNumber(fits[0].n, 0, locale)}`;
    const occ = pts.map((p) => [xS(p.x), yS(p.y)]);
    if (fits[0].band) for (const b of fits[0].band) occ.push([b[0], (b[1] + b[2]) / 2], [b[0], b[1]], [b[0], b[2]]);
    const qc = quietCorner(occ, inner, measure(s, 12) + 4, 16);
    body.push(text(qc.x, qc.y, s, { fill: theme.lede, fontSize: 12, textAnchor: qc.anchor, ...halo(theme) }));
  }
  body.push(gridX(xAx0.ticks, xS, inner, theme, tickFmt(fx, xAx0), { lines: false }));
  body.push(yTickLabels(yAx.ticks, yS, inner, theme, yt));
  axisTitles(body, theme, area, inner, { x: spec.xLabel ?? humanize(P.x), y: spec.yLabel === false ? null : spec.yLabel ?? humanize(P.y) });

  const desc = describeFits(keys, fits, P, en, locale, spec);
  return frame.finish(body, { desc, type: 'regplot' });
}

function describeFits(keys, fits, P, en, locale, spec) {
  const what = `${humanize(P.y).toLowerCase()} ${en ? 'vs' : 'versus'} ${humanize(P.x).toLowerCase()}`;
  const parts = keys.map((k, i) => {
    const f = fits[i];
    const first = f.line[0][1], last = f.line[f.line.length - 1][1];
    const dir = last > first ? (en ? 'rises' : 'sube') : (en ? 'falls' : 'baja');
    const r2 = f.r2 !== null ? `, R² ${dec(f.r2, locale)}` : '';
    return `${k ? k + ': ' : ''}${en ? 'the fit' : 'el ajuste'} ${dir}${r2}`;
  });
  const kind = spec.lowess ? 'LOWESS' : (spec.order ?? 1) > 1 ? (en ? 'polynomial' : 'polinomial') : en ? 'linear' : 'lineal';
  return en
    ? `Regression plot of ${what} with ${P.pts.length} points and a ${kind} fit. ${parts.join('; ')}.`
    : `Gráfico de regresión de ${what} con ${formatNumber(P.pts.length, 0, locale)} puntos y ajuste ${kind}. ${parts.join('; ')}.`;
}

function pointLabels(pts, spec, xS, yS, r, inner, theme, P) {
  if (!P.labelF || spec.labels === false || spec.labels === undefined) return '';
  let chosen;
  if (Array.isArray(spec.labels)) chosen = pts.filter((p) => spec.labels.map(String).includes(p.name));
  else if (typeof spec.labels === 'number') chosen = [...pts].sort((a, b) => b.y - a.y).slice(0, spec.labels);
  else return '';
  const placed = [];
  const out = [];
  for (const p of chosen) {
    if (!p.name) continue;
    const w = measure(p.name, 12, 500);
    let lx = xS(p.x) + r + 4, anchor = 'start';
    const ly = yS(p.y) + 4;
    if (lx + w > inner.x + inner.w) { lx = xS(p.x) - r - 4; anchor = 'end'; }
    const box = anchor === 'start' ? [lx, ly - 11, lx + w, ly + 3] : [lx - w, ly - 11, lx, ly + 3];
    if (placed.some((b) => !(box[2] < b[0] || box[0] > b[2] || box[3] < b[1] || box[1] > b[3]))) continue;
    placed.push(box);
    out.push(el('text', { x: lx, y: ly, fill: theme.ink, fontSize: 12, fontWeight: 500, textAnchor: anchor, ...halo(theme) }, esc(p.name)));
  }
  return g({ class: 'pa-labels' }, out);
}


/** Residuos de la regresión versus x, con línea en cero y suavizado opcional (lowess: true). */
function residplot(spec, theme) {
  const data = ensureData(spec);
  const P = readPoints(spec, data);
  const en = EN(spec);
  const locale = spec.locale || 'es';
  const fxv = (v) => (spec.logx ? Math.log10(v) : v);
  const fit = polyfit(P.pts.map((p) => fxv(p.x)), P.pts.map((p) => p.y), { order: spec.order ?? 1 });
  const res = P.pts.map((p) => ({ ...p, r: p.y - fit.predict(fxv(p.x)) }));
  const frame = createFrame(spec, theme, { height: 340 });
  const area = frame.layout([]);
  const M = theme.marks || {};
  const fx = makeFormat(spec.xFormat, locale, res.map((p) => p.x));
  const fy = makeFormat(spec.yFormat ?? spec.format, locale, res.map((p) => p.r));
  const lim = Math.max(...res.map((p) => Math.abs(p.r))) || 1;
  const yAx = axisDomain([-lim, lim], { domain: spec.yDomain, count: Math.max(3, Math.round(area.h / 60)) });
  const yt = tickFmt(fy, yAx);
  const top = 18 + yAxisTop(theme);
  const inner = { x: area.x + yAxisMargin(yAx.ticks, yt, theme), y: area.y + top, w: 0, h: area.h - top - 44 };
  inner.w = area.x + area.w - inner.x - 4;
  const r = res.length > 300 ? 2.5 : M.pointRadius ?? 4;
  const xAx = axisDomain(res.map((p) => p.x), { type: P.xLog ? 'log' : undefined, domain: spec.xDomain, nice: 'tight', count: Math.max(3, Math.round(inner.w / 90)) });
  const xS = xAx.scale(inner.x + r + 2, inner.x + inner.w - r - 2);
  const yS = yAx.scale(inner.y + inner.h, inner.y);
  if (spec._domains && typeof spec._domains === 'object') { spec._domains.x = [xAx.min, xAx.max]; spec._domains.y = [yAx.min, yAx.max]; }
  const body = [yGrid(yAx.ticks, yS, inner, theme, { baseline: NaN })];
  const y0 = Math.round(yS(0)) + 0.5;
  body.push(el('line', { x1: inner.x, x2: inner.x + inner.w, y1: y0, y2: y0, stroke: theme.ink, strokeWidth: 1.25, opacity: 0.6 }));
  body.push(g({}, dotLayer(res.map((p) => ({ class: 'pa-m', cx: xS(p.x), cy: yS(p.r), r, fill: theme.categorical[0], fillOpacity: (M.dotOpacity ?? 0.85) * 0.8, stroke: theme.surface, strokeWidth: 1.25, 'data-tip': tip(p.name, `${humanize(P.x)}: ${fx(p.x)}`, `${en ? 'Residual' : 'Residuo'}: ${fy(p.r)}`) })))));
  if (spec.lowess) {
    const lw = lowess(res.map((p) => p.x), res.map((p) => p.r));
    body.push(el('path', { d: lw.map(([a, b], i) => `${i ? 'L' : 'M'}${xS(a).toFixed(2)},${yS(b).toFixed(2)}`).join(''), fill: 'none', stroke: theme.categorical[1], strokeWidth: M.lineWidth ?? 2 }));
  }
  body.push(gridX(xAx.ticks, xS, inner, theme, tickFmt(fx, xAx), { lines: false }));
  body.push(yTickLabels(yAx.ticks, yS, inner, theme, yt));
  axisTitles(body, theme, area, inner, { x: spec.xLabel ?? humanize(P.x), y: spec.yLabel === false ? null : spec.yLabel ?? (en ? 'Residual' : 'Residuo') });
  const sdv = Math.sqrt(res.reduce((a, p) => a + p.r * p.r, 0) / Math.max(1, res.length - 2));
  const desc = en ? `Residuals of ${humanize(P.y)} on ${humanize(P.x)} (${res.length} points). Residual standard error ${fy(sdv)}.` : `Residuos de ${humanize(P.y).toLowerCase()} sobre ${humanize(P.x).toLowerCase()} (${formatNumber(res.length, 0, locale)} puntos). Error estándar residual ${fy(sdv)}.`;
  return frame.finish(body, { desc, type: 'residplot' });
}


/**
 * Dispersión central con distribuciones marginales arriba (x) y a la derecha (y).
 * Opciones: x, y, hue, kind ('scatter' | 'reg'), marginal ('hist' | 'kde'),
 * bins, ci, order, xScale/yScale 'log', xDomain, yDomain, label + labels.
 */
function jointplot(spec, theme) {
  const data = ensureData(spec);
  const P = readPoints(spec, data);
  const { pts, keys, xLog, yLog } = P;
  const en = EN(spec);
  const locale = spec.locale || 'es';
  const K = keys.length;
  const cmap = colorMap(keys, theme, spec.colors);
  const colorOf = (k) => (K === 1 ? (spec.colors && spec.colors[k]) || theme.categorical[0] : cmap.get(k));
  const legend = K > 1 && spec.legend !== false ? keys.map((k) => ({ label: k, color: colorOf(k) })) : [];
  const frame = createFrame(spec, theme, { height: 520 });
  const area = frame.layout(legend);
  const M = theme.marks || {};
  const fx = makeFormat(spec.xFormat, locale, pts.map((p) => p.x));
  const fy = makeFormat(spec.yFormat ?? spec.format, locale, pts.map((p) => p.y));
  const xAx = axisDomain(pts.map((p) => p.x), { type: xLog ? 'log' : undefined, domain: spec.xDomain, nice: 'tight', count: Math.max(3, Math.round(area.w / 120)) });
  const yAx = axisDomain(pts.map((p) => p.y), { type: yLog ? 'log' : undefined, domain: spec.yDomain, nice: 'tight', count: Math.max(3, Math.round(area.h / 80)) });
  const yt = tickFmt(fy, yAx);
  const mH = Math.max(44, Math.min(90, area.h * 0.17));
  const gap = 6;
  const leftM = yAxisMargin(yAx.ticks, yt, theme);
  const topGap = gap + yAxisTop(theme);
  const inner = { x: area.x + leftM, y: area.y + 18 + mH + topGap, w: 0, h: 0 };
  inner.w = area.x + area.w - inner.x - mH - gap;
  inner.h = area.y + area.h - 44 - inner.y;
  const r = spec.radius ?? (pts.length > 400 ? 2.5 : pts.length > 120 ? 3.25 : M.pointRadius ?? 4);
  const xS = xAx.scale(inner.x + r + 2, inner.x + inner.w - r - 2);
  const yS = yAx.scale(inner.y + inner.h - r - 2, inner.y + r + 2);
  if (spec._domains && typeof spec._domains === 'object') { spec._domains.x = [xAx.min, xAx.max]; spec._domains.y = [yAx.min, yAx.max]; }
  const body = [yGrid(yAx.ticks, yS, inner, theme, { baseline: NaN })];
  body.push(el('line', { x1: inner.x, x2: inner.x + inner.w, y1: inner.y + inner.h + 0.5, y2: inner.y + inner.h + 0.5, stroke: theme.axis }));

  const tx = (v) => (xLog ? Math.log10(v) : v), ty = (v) => (yLog ? Math.log10(v) : v);
  const ix = (t) => (xLog ? 10 ** t : t), iy = (t) => (yLog ? 10 ** t : t);
  const marginal = spec.marginal || 'hist';
  const groups = keys.map((k) => pts.filter((p) => p.k === k));
  const topBox = { x: inner.x, y: inner.y - topGap - mH, w: inner.w, h: mH };
  const rightBox = { x: inner.x + inner.w + gap, y: inner.y, w: mH, h: inner.h };
  const op = K > 1 ? 0.55 : 0.85;
  if (marginal === 'kde') {
    const ex = [tx(xAx.min), tx(xAx.max)], ey = [ty(yAx.min), ty(yAx.max)];
    const kx = groups.map((gp) => (gp.length > 1 ? kdeEst(gp.map((p) => tx(p.x)), { extent: ex, gridSize: 120 }).map(([t, d]) => [t, (d * gp.length) / pts.length]) : []));
    const ky = groups.map((gp) => (gp.length > 1 ? kdeEst(gp.map((p) => ty(p.y)), { extent: ey, gridSize: 120 }).map(([t, d]) => [t, (d * gp.length) / pts.length]) : []));
    const mx = Math.max(...kx.flat().map((p) => p[1]), 1e-12), my = Math.max(...ky.flat().map((p) => p[1]), 1e-12);
    kx.forEach((c, i) => {
      if (!c.length) return;
      const pth = c.map(([t, d], j) => `${j ? 'L' : 'M'}${xS(ix(t)).toFixed(2)},${(topBox.y + topBox.h - (d / mx) * topBox.h).toFixed(2)}`).join('');
      body.push(el('path', { d: `${pth}L${xS(ix(c[c.length - 1][0])).toFixed(2)},${topBox.y + topBox.h}L${xS(ix(c[0][0])).toFixed(2)},${topBox.y + topBox.h}Z`, fill: colorOf(keys[i]), fillOpacity: (M.areaOpacity ?? 0.12) * 1.5 }));
      body.push(el('path', { d: pth, fill: 'none', stroke: colorOf(keys[i]), strokeWidth: 1.75 }));
    });
    ky.forEach((c, i) => {
      if (!c.length) return;
      const pth = c.map(([t, d], j) => `${j ? 'L' : 'M'}${(rightBox.x + (d / my) * rightBox.w).toFixed(2)},${yS(iy(t)).toFixed(2)}`).join('');
      body.push(el('path', { d: `${pth}L${rightBox.x},${yS(iy(c[c.length - 1][0])).toFixed(2)}L${rightBox.x},${yS(iy(c[0][0])).toFixed(2)}Z`, fill: colorOf(keys[i]), fillOpacity: (M.areaOpacity ?? 0.12) * 1.5 }));
      body.push(el('path', { d: pth, fill: 'none', stroke: colorOf(keys[i]), strokeWidth: 1.75 }));
    });
  } else {
    const nb = (vs) => spec.bins ?? Math.max(8, Math.min(30, histogram(vs).length));
    const vx = pts.map((p) => tx(p.x)), vy = pts.map((p) => ty(p.y));
    const bx = histogram(vx, { bins: nb(vx), domain: [tx(xAx.min), tx(xAx.max)] });
    const by = histogram(vy, { bins: nb(vy), domain: [ty(yAx.min), ty(yAx.max)] });
    const countIn = (gp, bins, f, sel) => bins.map((b, i) => gp.filter((p) => { const t = f(sel(p)); return t >= b.x0 && (t < b.x1 || (i === bins.length - 1 && t <= b.x1)); }).length);
    const cx = groups.map((gp) => countIn(gp, bx, tx, (p) => p.x));
    const cy = groups.map((gp) => countIn(gp, by, ty, (p) => p.y));
    const mx = Math.max(...cx.flat(), 1), my = Math.max(...cy.flat(), 1);
    groups.forEach((gp, gi) => {
      const c = colorOf(keys[gi]);
      bx.forEach((b, i) => {
        const a0 = xS(ix(b.x0)) + 1, a1 = xS(ix(b.x1)) - 1;
        const h = (cx[gi][i] / mx) * topBox.h;
        if (h <= 0 || a1 <= a0) return;
        body.push(el('path', { class: 'pa-m', d: barPath(a0, topBox.y + topBox.h - h, a1 - a0, h, 'up', 2), fill: c, fillOpacity: op, 'data-tip': tip(`${fx(ix(b.x0))} – ${fx(ix(b.x1))}`, `${keys[gi] ? keys[gi] + ': ' : ''}${cx[gi][i]}`) }));
      });
      by.forEach((b, i) => {
        const a0 = yS(iy(b.x1)) + 1, a1 = yS(iy(b.x0)) - 1;
        const w = (cy[gi][i] / my) * rightBox.w;
        if (w <= 0 || a1 <= a0) return;
        body.push(el('path', { class: 'pa-m', d: barPath(rightBox.x, a0, w, a1 - a0, 'right', 2), fill: c, fillOpacity: op, 'data-tip': tip(`${fy(iy(b.x0))} – ${fy(iy(b.x1))}`, `${keys[gi] ? keys[gi] + ': ' : ''}${cy[gi][i]}`) }));
      });
    });
  }
  body.push(el('line', { x1: topBox.x, x2: topBox.x + topBox.w, y1: topBox.y + topBox.h + 0.5, y2: topBox.y + topBox.h + 0.5, stroke: theme.axis }));
  body.push(el('line', { x1: rightBox.x - 0.5, x2: rightBox.x - 0.5, y1: rightBox.y, y2: rightBox.y + rightBox.h, stroke: theme.axis }));

  if (spec.kind === 'reg') {
    keys.forEach((k, i) => {
      const f = fitGroup(groups[i], spec, { xLog, xMin: xAx.min, xMax: xAx.max });
      const L = (arr) => arr.map(([a, b], j) => `${j ? 'L' : 'M'}${xS(a).toFixed(2)},${yS(b).toFixed(2)}`).join('');
      if (f.band) body.push(el('path', { d: L(f.band.map(([x, , hi]) => [x, hi])) + 'L' + L(f.band.map(([x, lo]) => [x, lo]).reverse()).slice(1) + 'Z', fill: colorOf(k), fillOpacity: M.bandOpacity ?? 0.16 }));
      body.push(el('path', { d: L(f.line), fill: 'none', stroke: K === 1 ? theme.ink : colorOf(k), strokeWidth: M.lineWidth ?? 2, opacity: 0.9 }));
    });
  }
  body.push(g({}, dotLayer(pts.map((p) => ({ class: 'pa-m', cx: xS(p.x), cy: yS(p.y), r, fill: colorOf(p.k), fillOpacity: M.dotOpacity ?? 0.85, stroke: pts.length > 400 ? 'none' : theme.surface, strokeWidth: 1.25, 'data-tip': tip(p.name || p.k, `${humanize(P.x)}: ${fx(p.x)}`, `${humanize(P.y)}: ${fy(p.y)}`, p.name && p.k ? p.k : '') })))));
  body.push(pointLabels(pts, spec, xS, yS, r, inner, theme, P));
  body.push(gridX(xAx.ticks, xS, inner, theme, tickFmt(fx, xAx), { lines: false }));
  body.push(yTickLabels(yAx.ticks, yS, inner, theme, yt));
  axisTitles(body, theme, area, inner, { x: spec.xLabel ?? humanize(P.x), y: spec.yLabel === false ? null : spec.yLabel ?? humanize(P.y) });
  const fit = polyfit(pts.map((p) => tx(p.x)), pts.map((p) => p.y));
  const desc = en
    ? `Joint plot of ${humanize(P.y)} vs ${humanize(P.x)} with marginal distributions (${pts.length} points, R² ${dec(fit.r2, locale)}).`
    : `Gráfico conjunto de ${humanize(P.y).toLowerCase()} versus ${humanize(P.x).toLowerCase()} con distribuciones marginales (${formatNumber(pts.length, 0, locale)} puntos, R² ${dec(fit.r2, locale)}).`;
  return frame.finish(body, { desc, type: 'jointplot' });
}

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

return { "regplot": regplot, "residplot": residplot, "jointplot": jointplot };
});
__def("src/charts/categorical.js", function () {
const { el, g, text, tip, dotLayer } = __req("src/svg.js");
const { measure, truncate } = __req("src/text.js");
const { makeFormat } = __req("src/format.js");
const { niceDomain, niceStep, linear, log, logDomain, band } = __req("src/scale.js");
const { colorMap, readable } = __req("src/theme.js");
const { ensureData, requireField, uniq, num, fieldsOf, fieldKind, humanize } = __req("src/data.js");
const { gridX, xLabels, yAxisMargin, yAxisTop, yGrid, yTickLabels, refLinesY, refLinesX } = __req("src/axes.js");
const { createFrame } = __req("src/frame.js");
const { ctx } = __req("src/context.js");
const { fiveNumber, kde, scottBandwidth, meanCI, mean, median, sd, sum, finite, quantile } = __req("src/stats.js");

const T = (en, es, locale) => (String(locale || 'es').startsWith('en') ? en : es);

/** Pseudoaleatorio determinista en [0,1) a partir de un entero. */
function rand(i) {
  let x = (i + 1) * 2654435761;
  x ^= x >>> 16; x = Math.imul(x, 2246822507); x ^= x >>> 13; x = Math.imul(x, 3266489909); x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}


function prepare(spec) {
  const data = ensureData(spec);
  const fields = fieldsOf(data);
  const kinds = Object.fromEntries(fields.map((f) => [f, fieldKind(data, f)]));
  const isNum = (f) => kinds[f] === 'number';
  const hue = spec.hue ?? spec.series ?? (typeof spec.color === 'string' && !spec.color.startsWith('#') ? spec.color : undefined);
  let cat, val, swapped = false;
  const { x, y } = spec;
  if (x && y) {
    if (isNum(x) && !isNum(y)) { cat = y; val = x; swapped = true; }
    else { cat = x; val = y; }
  } else if (y && !x) { val = y; cat = isNum(y) ? null : null; }
  else if (x && !y) { if (isNum(x)) { val = x; swapped = true; } else { cat = x; val = fields.find((f) => isNum(f) && f !== hue); } }
  else {
    val = fields.find((f) => isNum(f) && f !== hue);
    cat = fields.find((f) => !isNum(f) && f !== hue && f !== val) ?? null;
  }
  requireField(data, val, 'y (valor)');
  if (cat) requireField(data, cat, 'x (categoría)');
  if (hue) requireField(data, hue, 'hue');
  const catOf = (r) => (cat ? String(r[cat] ?? '') : '');
  const cats = spec.order ? spec.order.map(String) : uniq(data.map(catOf));
  const hues = hue ? (spec.hueOrder ? spec.hueOrder.map(String) : uniq(data.map((r) => String(r[hue])))) : [''];
  const groups = new Map();
  for (const r of data) {
    const v = num(r[val]);
    if (!Number.isFinite(v)) continue;
    const k = catOf(r) + '\u0000' + (hue ? String(r[hue]) : '');
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(v);
  }
  const get = (c, h) => groups.get(c + '\u0000' + h) || [];
  const all = [...groups.values()].flat();
  return { data, cat, val, hue, cats, hues, get, all, swapped };
}

/**
 * Ejes, escalas, colores y leyenda compartidos por los cinco gráficos.
 * `extent` = [min, max] de los valores a mostrar (incluye bigotes, IC, etc.).
 */
function setup(spec, theme, m, extent, { type, zero = false, dodge = true, rowStep } = {}) {
  const locale = spec.locale || 'es';
  const vertical = !(spec.horizontal ?? (spec.orient === 'h' ? true : spec.orient === 'v' ? false : undefined) ?? autoHorizontal(spec, m));
  const valueScale = (vertical ? spec.yScale : spec.xScale) ?? spec.valueScale ?? spec.scale;
  const isLog = valueScale === 'log' && extent[0] > 0;
  const fmt = makeFormat(spec.format, locale, m.all);
  const multiHue = m.hues.length > 1;
  const cmap = colorMap(m.hues, theme, spec.colors);
  const hl = spec.highlight === undefined ? null : new Set([].concat(spec.highlight).map(String));
  const colorOf = (c, h) => {
    if (hl && !hl.has(c) && !hl.has(h)) return theme.dim;
    if (multiHue) return cmap.get(h);
    if (spec.colors && spec.colors[c]) return spec.colors[c];
    return theme.categorical[0];
  };
  const legend = multiHue ? m.hues.map((h) => ({ label: h, color: hl && !hl.has(h) ? theme.dim : cmap.get(h), shape: type === 'point' ? 'line' : 'square' })) : [];

  const frame = createFrame(spec, theme, { height: 420 });
  let area = frame.layout(spec.legend === false ? [] : legend);
  const dom = spec.yDomain ?? (vertical ? undefined : spec.xDomain) ?? spec.valueDomain;
  let lo = extent[0], hi = extent[1];
  if (zero && !isLog) { lo = Math.min(0, lo); hi = Math.max(0, hi); }
  const axisSize = theme.type?.axis ?? 11.5;
  const yTitle = vertical ? spec.yLabel ?? humanize(m.val) : spec.yLabel;
  const xTitle = vertical ? spec.xLabel : spec.xLabel ?? humanize(m.val);
  const body = { pre: [], marks: [], post: [] };
  let valS, nd, ticks, tickFmt, inner, catS;

  if (vertical) {
    const top = yAxisTop(theme) + (yTitle ? 18 : 0);
    const bottom = (m.cat ? 24 : 6) + (xTitle ? 18 : 0);
    const h0 = area.h - top - bottom;
    if (isLog) { nd = dom ? { min: dom[0], max: dom[1] } : logDomain(lo, hi); ticks = log(nd.min, nd.max, 0, 1).ticks(); tickFmt = fmt; }
    else { const cnt = Math.max(4, Math.round(h0 / 56)); nd = dom ? { min: dom[0], max: dom[1], step: niceStep(dom[1] - dom[0], cnt) } : niceDomain(lo, hi, cnt); ticks = linear(nd.min, nd.max, 0, 1).ticks(nd.step).filter((t) => t >= nd.min - 1e-9 && t <= nd.max + 1e-9); tickFmt = fmt.tick(nd.step); }
    const leftM = yAxisMargin(ticks, tickFmt, theme);
    inner = { x: area.x + leftM, y: area.y + top, w: area.w - leftM, h: h0 };
    valS = (isLog ? log : linear)(nd.min, nd.max, inner.y + inner.h, inner.y);
    catS = band(m.cats, inner.x, inner.x + inner.w, { inner: 0.28, outer: 0.12 });
    body.pre.push(yGrid(ticks, valS, inner, theme, { baseline: zero ? 0 : NaN }));
    body.post.push(yTickLabels(ticks, valS, inner, theme, tickFmt));
    if (yTitle) body.post.push(text(area.x, area.y + 10, yTitle, { fill: theme.lede, fontSize: axisSize, fontWeight: 500 }));
    if (m.cat) {
      const items = m.cats.map((c) => ({ pos: catS.center(c), label: truncate(c, Math.max(40, catS.step - 6), axisSize + 0.5) }));
      body.post.push(xLabels(items, inner, theme, { y: inner.y + inner.h + 18, size: axisSize + 0.5, color: theme.lede }));
    }
    body.pre.push(el('line', { x1: inner.x, x2: inner.x + inner.w, y1: inner.y + inner.h + 0.5, y2: inner.y + inner.h + 0.5, stroke: theme.axis, strokeWidth: 1 }));
    if (xTitle) body.post.push(text(inner.x + inner.w, inner.y + inner.h + 22 + 18 * ctx.textScale, xTitle, { fill: theme.lede, fontSize: axisSize, fontWeight: 500, textAnchor: 'end' }));
  } else {
    const labelW = m.cat ? Math.min(Math.max(...m.cats.map((c) => measure(c, axisSize + 0.5))), area.w * (area.w < 500 ? 0.42 : 0.32)) + 12 : 0;
    const step = rowStep ?? (multiHue && dodge ? Math.max(30, 22 * m.hues.length + 12) : 46);
    if (spec.height === undefined) {
      frame.setHeight(area.y + m.cats.length * step + 30 + (xTitle ? 20 : 0) + frame.chrome);
      area = { ...area, h: frame.bottom - area.y };
    }
    inner = { x: area.x + labelW, y: area.y + 4, w: area.w - labelW - 10, h: area.h - 30 - (xTitle ? 20 : 0) };
    if (isLog) { nd = dom ? { min: dom[0], max: dom[1] } : logDomain(lo, hi); ticks = log(nd.min, nd.max, 0, 1).ticks(); tickFmt = fmt; }
    else { const cnt = Math.max(4, Math.round(inner.w / 100)); nd = dom ? { min: dom[0], max: dom[1], step: niceStep(dom[1] - dom[0], cnt) } : niceDomain(lo, hi, cnt); ticks = linear(nd.min, nd.max, 0, 1).ticks(nd.step).filter((t) => t >= nd.min - 1e-9 && t <= nd.max + 1e-9); tickFmt = fmt.tick(nd.step); }
    valS = (isLog ? log : linear)(nd.min, nd.max, inner.x, inner.x + inner.w);
    catS = band(m.cats, inner.y, inner.y + inner.h, { inner: 0.28, outer: 0.08 });
    body.pre.push(gridX(ticks, valS, inner, theme, tickFmt, { baseline: zero ? 0 : NaN }));
    if (m.cat) for (const c of m.cats) {
      const strong = !hl || hl.has(c);
      body.post.push(text(inner.x - 10, catS.center(c) + 4.5, truncate(c, labelW - 12, axisSize + 0.5), { fill: strong ? theme.ink : theme.muted, fontSize: axisSize + 0.5, textAnchor: 'end' }));
    }
    if (xTitle) body.post.push(text(inner.x + inner.w, inner.y + inner.h + 22 + 18 * ctx.textScale, xTitle, { fill: theme.lede, fontSize: axisSize, fontWeight: 500, textAnchor: 'end' }));
  }

  if (spec._domains && typeof spec._domains === 'object') spec._domains.y = [nd.min, nd.max];
  const refs = (spec.refLines || []).map((r) => ({ ...r, y: r.value ?? r.y ?? r.x }));
  if (refs.length) body.post.push(vertical ? refLinesY(refs, valS, inner, theme, fmt) : refLinesX(refs.map((r) => ({ ...r, x: r.y, y: undefined })), valS, inner, theme, fmt));

  const k = multiHue && dodge ? m.hues.length : 1;
  const slot = catS.bandwidth / k;
  const center = (c, hi2) => catS(c) + (k > 1 ? slot * (hi2 + 0.5) : catS.bandwidth / 2);
  const P = (cpos, v) => (vertical ? [cpos, valS(v)] : [valS(v), cpos]);
  return { frame, vertical, valS, catS, slot, center, P, fmt, colorOf, body, inner, locale, hl, multiHue };
}

function autoHorizontal(spec, m) {
  if (m.swapped) return true;
  if (!m.cat) return false;
  const w = (spec.width || 720) - 48;
  const slot = w / Math.max(1, m.cats.length);
  const longest = Math.max(...m.cats.map((c) => measure(c, 12)));
  return m.cats.length > 10 || longest > slot - 10;
}

const finish = (s, desc, type) => s.frame.finish([...s.body.pre, ...s.body.marks, ...s.body.post], { desc, type });
const extentOf = (vs) => [Math.min(...vs), Math.max(...vs)];

/** Segmento (línea) en coordenadas de categoría/valor. */
function seg(s, cpos0, v0, cpos1, v1, attrs) {
  const [x1, y1] = s.P(cpos0, v0), [x2, y2] = s.P(cpos1, v1);
  return el('line', { x1, y1, x2, y2, ...attrs });
}

/** Rectángulo entre dos valores, centrado en cpos con ancho w (eje de categorías). */
function rectBetween(s, cpos, w, v0, v1, attrs) {
  const a = s.valS(v0), b = s.valS(v1);
  return s.vertical
    ? el('rect', { x: cpos - w / 2, y: Math.min(a, b), width: w, height: Math.max(0.5, Math.abs(a - b)), ...attrs })
    : el('rect', { x: Math.min(a, b), y: cpos - w / 2, width: Math.max(0.5, Math.abs(a - b)), height: w, ...attrs });
}

function strips(s, theme, vals, cpos, width, color, seed, r) {
  return vals.map((v, i) => {
    const off = (rand(seed * 7919 + i) - 0.5) * width;
    const [x, y] = s.P(cpos + off, v);
    return el('circle', { cx: x, cy: y, r, fill: color, fillOpacity: 0.55, stroke: 'none' });
  });
}

const fmtTipLabel = (c, h) => [c, h].filter(Boolean).join(' · ');


function box(spec, theme) {
  const m = prepare(spec);
  const stats = new Map();
  const ext = [];
  for (const c of m.cats) for (const h of m.hues) {
    const vs = m.get(c, h);
    if (!vs.length) continue;
    const f = fiveNumber(vs);
    stats.set(c + '\u0000' + h, f);
    ext.push(f.min, f.max);
  }
  const s = setup(spec, theme, m, extentOf(ext), { type: 'box' });
  const lw = theme.marks?.lineWidth ?? 2;
  m.cats.forEach((c) => m.hues.forEach((h, hi2) => {
    const f = stats.get(c + '\u0000' + h);
    if (!f) return;
    const color = s.colorOf(c, h);
    const cpos = s.center(c, hi2);
    const w = Math.min(s.slot * 0.72, 64);
    const parts = [];
    parts.push(seg(s, cpos, f.whiskerLo, cpos, f.q1, { stroke: color, strokeWidth: 1.5, strokeLinecap: 'round' }));
    parts.push(seg(s, cpos, f.q3, cpos, f.whiskerHi, { stroke: color, strokeWidth: 1.5, strokeLinecap: 'round' }));
    for (const v of [f.whiskerLo, f.whiskerHi]) parts.push(seg(s, cpos - w * 0.22, v, cpos + w * 0.22, v, { stroke: color, strokeWidth: 1.5, strokeLinecap: 'round' }));
    parts.push(rectBetween(s, cpos, w, f.q1, f.q3, { rx: 3, fill: color, fillOpacity: 0.16, stroke: color, strokeWidth: 1.5 }));
    if (spec.points) parts.push(...strips(s, theme, m.get(c, h), cpos, w * 0.6, color, hi2 * 131 + m.cats.indexOf(c), 2.4));
    parts.push(seg(s, cpos - w / 2 + 0.75, f.median, cpos + w / 2 - 0.75, f.median, { stroke: color, strokeWidth: Math.max(2.5, lw), strokeLinecap: 'butt' }));
    if (spec.showMeans || spec.mean) { const [x, y] = s.P(cpos, f.mean); parts.push(el('path', { d: `M${x},${y - 4}L${x + 4},${y}L${x},${y + 4}L${x - 4},${y}Z`, fill: theme.surface, stroke: color, strokeWidth: 1.5 })); }
    if (!spec.points) for (const v of f.outliers) { const [x, y] = s.P(cpos, v); parts.push(el('circle', { cx: x, cy: y, r: 2.75, fill: 'none', stroke: color, strokeWidth: 1.25 })); }
    s.body.marks.push(g({ class: 'pa-m', 'data-tip': tip(fmtTipLabel(c, h), `n = ${f.n}`, `${T('Median', 'Mediana', s.locale)}: ${s.fmt(f.median)}`, `Q1–Q3: ${s.fmt(f.q1)} – ${s.fmt(f.q3)}`, `${T('Whiskers', 'Bigotes', s.locale)}: ${s.fmt(f.whiskerLo)} – ${s.fmt(f.whiskerHi)}`, f.outliers.length ? `${T('Outliers', 'Atípicos', s.locale)}: ${f.outliers.length}` : '') }, parts));
  }));
  return finish(s, describeGroups(m, (vs) => median(vs), s.fmt, s.locale, T('Box plot', 'Diagrama de caja', s.locale), T('median', 'mediana', s.locale)), 'box');
}


function violin(spec, theme) {
  const m = prepare(spec);
  const split = spec.split && m.hues.length === 2;
  const cut = spec.cut ?? 0;
  const dens = new Map();
  const ext = [];
  const logV = (spec.yScale ?? spec.xScale ?? spec.valueScale ?? spec.scale) === 'log' && m.all.every((v) => v > 0);
  const tf = logV ? Math.log10 : (v) => v, inv = logV ? (v) => 10 ** v : (v) => v;
  for (const c of m.cats) for (const h of m.hues) {
    const vs = m.get(c, h);
    if (vs.length < 2) continue;
    const tv = vs.map(tf);
    const bw = (spec.bandwidth ?? scottBandwidth(tv)) * (spec.bwAdjust ?? 1);
    const mn = Math.min(...tv), mx = Math.max(...tv);
    const d = kde(tv, { bandwidth: bw, extent: [mn - cut * bw, mx + cut * bw], gridSize: 96 }).map(([v, dd]) => [inv(v), dd]);
    dens.set(c + '\u0000' + h, { d, f: fiveNumber(vs), n: vs.length, max: Math.max(...d.map((p) => p[1])) });
    ext.push(inv(mn - cut * bw), inv(mx + cut * bw));
  }
  const s = setup(spec, theme, m, extentOf(ext), { type: 'violin', dodge: !split });
  const scaleMode = ['width', 'count', 'area'].includes(spec.scale) ? spec.scale : spec.densityNorm ?? 'width';
  const gMax = Math.max(...[...dens.values()].map((x) => x.max));
  const nMax = Math.max(...[...dens.values()].map((x) => x.n));
  const inner = spec.inner ?? 'box';
  const op = Math.min(0.5, (theme.marks?.bandOpacity ?? 0.16) * 2.2);
  m.cats.forEach((c) => m.hues.forEach((h, hi2) => {
    const D = dens.get(c + '\u0000' + h);
    if (!D) return;
    const color = s.colorOf(c, h);
    const cpos = split ? s.catS.center(c) : s.center(c, hi2);
    const half = (split ? s.catS.bandwidth : s.slot) * 0.46;
    const norm = scaleMode === 'width' ? D.max : scaleMode === 'count' ? gMax * (nMax / D.n) : gMax;
    const wOf = (d) => (d / (norm || 1)) * half;
    const side = split ? (hi2 === 0 ? -1 : 1) : 0;
    const right = D.d.map(([v, d]) => s.P(cpos + (side === -1 ? 0 : wOf(d)), v));
    const left = D.d.map(([v, d]) => s.P(cpos - (side === 1 ? 0 : wOf(d)), v)).reverse();
    const pts = side === -1 ? [...D.d.map(([v]) => s.P(cpos, v)), ...left] : side === 1 ? [...right, ...D.d.map(([v]) => s.P(cpos, v)).reverse()] : [...right, ...left];
    const path = 'M' + pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join('L') + 'Z';
    const parts = [el('path', { d: path, fill: color, fillOpacity: op, stroke: color, strokeWidth: 1.25, strokeLinejoin: 'round' })];
    const f = D.f;
    const ic = cpos + (side === 0 ? 0 : side * Math.min(half * 0.22, 7));
    if (inner === 'box') {
      parts.push(seg(s, ic, f.whiskerLo, ic, f.whiskerHi, { stroke: theme.ink, strokeWidth: 1.25, strokeOpacity: 0.7 }));
      parts.push(rectBetween(s, ic, 5, f.q1, f.q3, { rx: 2, fill: theme.ink, fillOpacity: 0.85 }));
      const [x, y] = s.P(ic, f.median);
      parts.push(el('circle', { cx: x, cy: y, r: 2.6, fill: theme.surface }));
    } else if (inner === 'quartiles') {
      for (const [q, wq] of [[f.q1, 1], [f.median, 2], [f.q3, 1]]) {
        const dq = D.d.reduce((a, p) => (Math.abs(p[0] - q) < Math.abs(a[0] - q) ? p : a))[1];
        const w = wOf(dq);
        parts.push(seg(s, cpos - (side === 1 ? 0 : w), q, cpos + (side === -1 ? 0 : w), q, { stroke: color, strokeWidth: wq + 0.25 }));
      }
    } else if (inner === 'points' || inner === 'stick') {
      for (const v of m.get(c, h)) parts.push(seg(s, cpos - 3, v, cpos + 3, v, { stroke: theme.ink, strokeOpacity: 0.55, strokeWidth: 1 }));
    }
    s.body.marks.push(g({ class: 'pa-m', 'data-tip': tip(fmtTipLabel(c, h), `n = ${D.n}`, `${T('Median', 'Mediana', s.locale)}: ${s.fmt(f.median)}`, `Q1–Q3: ${s.fmt(f.q1)} – ${s.fmt(f.q3)}`, `${T('Range', 'Rango', s.locale)}: ${s.fmt(f.min)} – ${s.fmt(f.max)}`) }, parts));
  }));
  return finish(s, describeGroups(m, (vs) => median(vs), s.fmt, s.locale, T('Violin plot', 'Gráfico de violín', s.locale), T('median', 'mediana', s.locale)), 'violin');
}


function strip(spec, theme) {
  const m = prepare(spec);
  const s = setup(spec, theme, m, extentOf(m.all), { type: 'strip', dodge: spec.dodge ?? true });
  const n = m.all.length;
  const r = spec.radius ?? (n > 600 ? 2 : n > 200 ? 2.75 : (theme.marks?.pointRadius ?? 4) - 0.5);
  const jitter = spec.jitter ?? 0.6;
  m.cats.forEach((c, ci) => m.hues.forEach((h, hi2) => {
    const vs = m.get(c, h);
    if (!vs.length) return;
    const color = s.colorOf(c, h);
    const cpos = s.center(c, hi2);
    const w = s.slot * (jitter === true ? 0.6 : jitter || 0);
    const parts = vs.map((v, i) => {
      const [x, y] = s.P(cpos + (rand(ci * 7919 + hi2 * 104729 + i) - 0.5) * w, v);
      return { class: 'pa-m', cx: x, cy: y, r, fill: color, fillOpacity: theme.marks?.dotOpacity ?? 0.85, stroke: theme.surface, strokeWidth: n > 300 ? 0.75 : 1.25, 'data-tip': tip(fmtTipLabel(c, h), s.fmt(v)) };
    });
    parts.splice(0, parts.length, dotLayer(parts));
    if (spec.mean || spec.showMeans) {
      const mu = mean(vs);
      parts.push(seg(s, cpos - Math.min(s.slot * 0.42, 34), mu, cpos + Math.min(s.slot * 0.42, 34), mu, { stroke: theme.ink, strokeWidth: 2.5, strokeLinecap: 'round' }));
    }
    s.body.marks.push(g({}, parts));
  }));
  return finish(s, describeGroups(m, mean, s.fmt, s.locale, T('Strip plot', 'Gráfico de puntos por categoría', s.locale), T('mean', 'promedio', s.locale)), 'strip');
}


/**
 * Coloca puntos sin traslape: cada punto busca el desplazamiento lateral más
 * chico que no choque con los ya ubicados. Devuelve offsets en px.
 */
function beeswarm(positions, r) {
  const order = positions.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]);
  const placed = [];
  const out = new Array(positions.length).fill(0);
  const d = 2 * r + 0.4;
  for (const [p, i] of order) {
    const near = placed.filter((q) => Math.abs(q.p - p) < d);
    const cands = [0];
    for (const q of near) {
      const dx = Math.sqrt(Math.max(0, d * d - (q.p - p) ** 2));
      cands.push(q.o + dx, q.o - dx);
    }
    cands.sort((a, b) => Math.abs(a) - Math.abs(b) || a - b);
    let best = 0;
    for (const o of cands) {
      if (near.every((q) => (q.p - p) ** 2 + (q.o - o) ** 2 >= d * d - 1e-6)) { best = o; break; }
    }
    placed.push({ p, o: best });
    out[i] = best;
  }
  return out;
}

function swarm(spec, theme) {
  const m = prepare(spec);
  const s = setup(spec, theme, m, extentOf(m.all), { type: 'swarm', dodge: spec.dodge ?? false });
  const groupsOf = (c) => (s.multiHue && (spec.dodge ?? false) ? m.hues.map((h, hi2) => [[h], hi2]) : [[m.hues, 0]]);
  let r = spec.radius ?? (theme.marks?.pointRadius ?? 4);
  const layouts = () => m.cats.map((c) => groupsOf(c).map(([hs, hi2]) => {
    const items = hs.flatMap((h) => m.get(c, h).map((v) => ({ v, h })));
    const offs = beeswarm(items.map((it) => s.valS(it.v)), r);
    return { c, hi2, items, offs, width: Math.max(0, ...offs.map(Math.abs)) * 2 + 2 * r };
  }));
  let L = layouts();
  const room = (spec.dodge ? s.slot : s.catS.bandwidth) * 0.98;
  for (let it = 0; it < 12 && Math.max(...L.flat().map((x) => x.width)) > room && r > 1.4; it++) { r *= 0.85; L = layouts(); }
  for (const grp of L.flat()) {
    const cpos = spec.dodge ? s.center(grp.c, grp.hi2) : s.catS.center(grp.c);
    const parts = grp.items.map((it, i) => {
      const o = Math.max(-room / 2 + r, Math.min(room / 2 - r, grp.offs[i]));
      const [x, y] = s.vertical ? [cpos + o, s.valS(it.v)] : [s.valS(it.v), cpos + o];
      const color = s.colorOf(grp.c, it.h);
      return { class: 'pa-m', cx: x, cy: y, r, fill: color, fillOpacity: theme.marks?.dotOpacity ?? 0.85, stroke: theme.surface, strokeWidth: r > 2.5 ? 1 : 0.5, 'data-tip': tip(fmtTipLabel(grp.c, it.h), s.fmt(it.v)) };
    });
    parts.splice(0, parts.length, dotLayer(parts));
    s.body.marks.push(g({}, parts));
  }
  return finish(s, describeGroups(m, median, s.fmt, s.locale, T('Swarm plot', 'Gráfico de enjambre', s.locale), T('median', 'mediana', s.locale)), 'swarm');
}


function estimate(vs, est, eb, level = 0.95) {
  const v = finite(vs);
  if (!v.length) return null;
  const e = est === 'median' ? median(v) : est === 'sum' ? sum(v) : mean(v);
  let lo = e, hi = e;
  if (eb === 'ci' && est !== 'sum') [lo, hi] = est === 'median' ? medianCI(v, level) : meanCI(v, level);
  else if (eb === 'sd') { lo = e - sd(v); hi = e + sd(v); }
  else if (eb === 'se') { const se = sd(v) / Math.sqrt(v.length); lo = e - se; hi = e + se; }
  else if (eb === 'pi') { const st = [...v].sort((a, b) => a - b); lo = quantile(st, 0.025); hi = quantile(st, 0.975); }
  return { e, lo, hi, n: v.length };
}

function medianCI(v, level) {
  const st = [...v].sort((a, b) => a - b);
  const n = st.length;
  const z = level >= 0.99 ? 2.576 : level >= 0.95 ? 1.96 : 1.645;
  const k = Math.max(0, Math.floor(n / 2 - (z * Math.sqrt(n)) / 2));
  return [st[k], st[Math.min(n - 1, n - 1 - k)]];
}

function point(spec, theme) {
  const m = prepare(spec);
  const est = spec.estimator ?? 'mean';
  const eb = spec.errorbar === undefined ? 'ci' : spec.errorbar;
  const res = new Map();
  const ext = [];
  for (const c of m.cats) for (const h of m.hues) {
    const r = estimate(m.get(c, h), est, eb, spec.level ?? 0.95);
    if (!r) continue;
    res.set(c + '\u0000' + h, r);
    ext.push(r.lo, r.hi);
  }
  const multi = m.hues.length > 1;
  const showEnd = multi && (spec.labels ?? true) && m.hues.length <= 4;
  const endW = showEnd ? Math.min(140, Math.max(...m.hues.map((h) => measure(h, 12, 500)))) + 16 : 0;
  const s = setup({ ...spec, width: spec.width }, theme, m, extentOf(ext), { type: 'point', dodge: false, zero: est === 'sum' });
  const vertical = s.vertical;
  if (vertical && showEnd) {
    s.catS = band(m.cats, s.inner.x, s.inner.x + s.inner.w - endW, { inner: 0.28, outer: 0.12 });
    s.body.post = s.body.post.filter((p) => !p.startsWith('<g><text') || !m.cat);
    const axisSize = theme.type?.axis ?? 11.5;
    if (m.cat) s.body.post.push(xLabels(m.cats.map((c) => ({ pos: s.catS.center(c), label: truncate(c, Math.max(40, s.catS.step - 6), axisSize + 0.5) })), s.inner, theme, { y: s.inner.y + s.inner.h + 18, size: axisSize + 0.5, color: theme.lede }));
  }
  const dodgeW = multi && (spec.dodge ?? true) ? Math.min(s.catS.bandwidth * 0.36, 26) : 0;
  const cposOf = (c, hi2) => s.catS.center(c) + (multi ? (hi2 - (m.hues.length - 1) / 2) * (dodgeW / Math.max(1, m.hues.length - 1)) : 0);
  const lw = theme.marks?.lineWidth ?? 2;
  const ends = [];
  m.hues.forEach((h, hi2) => {
    const color = s.colorOf(null, h);
    const pts = m.cats.map((c) => [c, res.get(c + '\u0000' + h)]).filter(([, r]) => r);
    const parts = [];
    if (spec.join !== false && pts.length > 1) {
      const d = pts.map(([c, r], i) => { const [x, y] = s.P(cposOf(c, hi2), r.e); return (i ? 'L' : 'M') + x.toFixed(2) + ',' + y.toFixed(2); }).join('');
      parts.push(el('path', { d, fill: 'none', stroke: color, strokeWidth: lw, strokeLinejoin: 'round', strokeLinecap: 'round', strokeOpacity: 0.9 }));
    }
    for (const [c, r] of pts) {
      const cp = cposOf(c, hi2);
      const bits = [];
      if (eb) bits.push(seg(s, cp, r.lo, cp, r.hi, { stroke: color, strokeWidth: 2, strokeLinecap: 'round' }));
      const [x, y] = s.P(cp, r.e);
      bits.push(el('circle', { cx: x, cy: y, r: (theme.marks?.pointRadius ?? 4) + 0.5, fill: color, stroke: theme.surface, strokeWidth: theme.marks?.ring ?? 2 }));
      const ebName = eb === 'ci' ? `IC ${Math.round((spec.level ?? 0.95) * 100)}%` : eb === 'sd' ? T('± SD', '± DE', s.locale) : eb === 'se' ? T('± SE', '± EE', s.locale) : eb === 'pi' ? T('95% range', 'rango 95%', s.locale) : '';
      const estName = est === 'median' ? T('Median', 'Mediana', s.locale) : est === 'sum' ? T('Sum', 'Suma', s.locale) : T('Mean', 'Promedio', s.locale);
      parts.push(g({ class: 'pa-m', 'data-tip': tip(fmtTipLabel(c, h), `${estName}: ${s.fmt(r.e)}`, eb ? `${ebName}: ${s.fmt(r.lo)} – ${s.fmt(r.hi)}` : '', `n = ${r.n}`) }, bits));
    }
    if (showEnd && vertical && pts.length) {
      const [c, r] = pts[pts.length - 1];
      const [x, y] = s.P(cposOf(c, hi2), r.e);
      ends.push({ x: s.catS.center(c) + dodgeW / 2 + 12, y, y0: y, xd: x, label: h, color: s.colorOf(c, h) });
    }
    s.body.marks.push(g({ 'data-series': h }, parts));
  });
  if (ends.length) {
    ends.sort((a, b) => a.y - b.y);
    for (let it = 0; it < 30; it++) for (let i = 1; i < ends.length; i++) { const d = ends[i].y - ends[i - 1].y; if (d < 15) { const sh = (15 - d) / 2; ends[i].y += sh; ends[i - 1].y -= sh; } }
    for (const e of ends) {
      if (Math.abs(e.y - e.y0) > 3 || e.x - e.xd > 14) s.body.post.push(el('path', { d: `M${(e.xd + 7).toFixed(1)},${e.y0.toFixed(1)}L${(e.x - 8).toFixed(1)},${e.y0.toFixed(1)}L${(e.x - 3).toFixed(1)},${e.y.toFixed(1)}`, fill: 'none', stroke: theme.muted, strokeWidth: 1, strokeOpacity: 0.7 }));
      s.body.post.push(text(e.x, e.y + 4, truncate(e.label, endW - 12, 12, 500), { fill: readable(e.color, theme), fontSize: 12, fontWeight: 600 }));
    }
  }
  const estW = est === 'median' ? T('median', 'mediana', s.locale) : est === 'sum' ? T('sum', 'suma', s.locale) : T('mean', 'promedio', s.locale);
  return finish(s, describeGroups(m, (vs) => estimate(vs, est, false).e, s.fmt, s.locale, T('Point plot', 'Gráfico de estimación con intervalo', s.locale), estW), 'point');
}


function describeGroups(m, stat, fmt, locale, kind, statName) {
  const en = String(locale).startsWith('en');
  const rows = [];
  for (const c of m.cats) for (const h of m.hues) {
    const vs = m.get(c, h);
    if (vs.length) rows.push([fmtTipLabel(c, h) || humanize(m.val), stat(vs), vs.length]);
  }
  if (!rows.length) return kind + '.';
  rows.sort((a, b) => b[1] - a[1]);
  const hi = rows[0], lo = rows[rows.length - 1];
  const what = humanize(m.val).toLowerCase();
  return en
    ? `${kind} of ${what} across ${rows.length} groups (${m.all.length} observations). Highest ${statName}: ${hi[0]} (${fmt(hi[1])}). Lowest: ${lo[0]} (${fmt(lo[1])}).`
    : `${kind} de ${what} en ${rows.length} grupos (${m.all.length} observaciones). Mayor ${statName}: ${hi[0]} (${fmt(hi[1])}). Menor: ${lo[0]} (${fmt(lo[1])}).`;
}

return { "box": box, "violin": violin, "strip": strip, "beeswarm": beeswarm, "swarm": swarm, "point": point };
});
__def("src/charts/radar.js", function () {
const { el, g, text, tip } = __req("src/svg.js");
const { measure, wrap } = __req("src/text.js");
const { makeFormat } = __req("src/format.js");
const { niceDomain, niceStep, linear } = __req("src/scale.js");
const { colorMap } = __req("src/theme.js");
const { ensureData, requireField, uniq, num, fieldsOf, fieldKind, humanize, aggregate } = __req("src/data.js");
const { createFrame } = __req("src/frame.js");

function radar(spec, theme) {
  const data = ensureData(spec);
  const fields = fieldsOf(data);
  const kinds = Object.fromEntries(fields.map((f) => [f, fieldKind(data, f)]));
  const locale = spec.locale || 'es';
  const en = String(locale).startsWith('en');
  let series = spec.hue ?? spec.series ?? (typeof spec.color === 'string' && !spec.color.startsWith('#') ? spec.color : undefined);
  let axes, seriesKeys;
  const values = new Map(); // serie → Map(eje → valor)

  if (Array.isArray(spec.axes) && spec.axes.length) {
    axes = spec.axes.map(String);
    axes.forEach((a) => requireField(data, a, 'axes'));
    const labelF = spec.label ?? series ?? fields.find((f) => kinds[f] === 'category' && !axes.includes(f));
    if (labelF) requireField(data, labelF, 'label');
    seriesKeys = data.map((r, i) => (labelF ? String(r[labelF]) : `${en ? 'Series' : 'Serie'} ${i + 1}`));
    data.forEach((r, i) => values.set(seriesKeys[i], new Map(axes.map((a) => [a, num(r[a])]))));
    series = labelF;
  } else {
    const axisF = spec.axis ?? spec.x ?? fields.find((f) => kinds[f] === 'category' && f !== series);
    const valueF = spec.value ?? spec.y ?? fields.find((f) => kinds[f] === 'number' && f !== series);
    requireField(data, axisF, 'axis (x)');
    requireField(data, valueF, 'value (y)');
    if (series) requireField(data, series, 'series');
    axes = uniq(data.map((r) => String(r[axisF])));
    seriesKeys = series ? uniq(data.map((r) => String(r[series]))) : [humanize(valueF)];
    const acc = new Map();
    for (const r of data) {
      const s = series ? String(r[series]) : seriesKeys[0];
      const k = s + '\u0000' + String(r[axisF]);
      if (!acc.has(k)) acc.set(k, []);
      acc.get(k).push(num(r[valueF]));
    }
    for (const s of seriesKeys) values.set(s, new Map(axes.map((a) => [a, aggregate(acc.get(s + '\u0000' + a) || [], spec.aggregate || 'mean')])));
  }
  const n = axes.length;
  const raw = [...values.values()].flatMap((m) => [...m.values()]).filter(Number.isFinite);
  const fmt = makeFormat(spec.format, locale, raw);

  const axisMax = new Map(axes.map((a) => [a, Math.max(...seriesKeys.map((s) => values.get(s).get(a)).filter(Number.isFinite), 0)]));
  const norm = !!spec.normalize;
  const val = (s, a) => { const v = values.get(s).get(a); return norm ? v / (axisMax.get(a) || 1) : v; };
  const vals = seriesKeys.flatMap((s) => axes.map((a) => val(s, a))).filter(Number.isFinite);
  let dom;
  if (spec.domain || spec.valueDomain || spec.yDomain) { const d = spec.domain || spec.valueDomain || spec.yDomain; dom = { min: d[0], max: d[1], step: niceStep(d[1] - d[0], 5) }; }
  else if (norm) dom = { min: 0, max: 1, step: 0.25 };
  else dom = niceDomain(Math.min(0, ...vals), Math.max(...vals), 4);
  const rings = linear(dom.min, dom.max, 0, 1).ticks(dom.step).filter((t) => t > dom.min + 1e-9 && t <= dom.max + 1e-9);
  if (!rings.length || Math.abs(rings[rings.length - 1] - dom.max) > 1e-9) rings.push(dom.max);
  const ringFmt = norm ? (v) => Math.round(v * 100) + '%' : fmt.tick(dom.step);

  const cmap = colorMap(seriesKeys, theme, spec.colors);
  const hl = spec.highlight === undefined ? null : new Set([].concat(spec.highlight).map(String));
  const focus = (s) => !hl || hl.has(s);
  const colorOf = (s) => (focus(s) ? (seriesKeys.length === 1 ? cmap.get(s) || theme.categorical[0] : cmap.get(s)) : theme.dim);
  const legend = seriesKeys.length > 1 ? seriesKeys.map((s) => ({ label: s, color: colorOf(s), shape: 'square' })) : [];

  const frame = createFrame(spec, theme, { height: (spec.width || 720) < 560 ? Math.round((spec.width || 720) * 0.95 + 170) : 460 });
  let area = frame.layout(spec.legend === false ? [] : legend);

  const ls = (theme.type?.label ?? 12) + 0.5;
  const maxLabelW = Math.min(130, Math.max(60, area.w * 0.2));
  const labelLines = axes.map((a) => wrap(a, maxLabelW, ls, 500, 2));
  const labW = Math.max(...labelLines.map((ls2) => Math.max(...ls2.map((l) => measure(l, ls, 500)))));
  const labH = ls * 1.25 * Math.max(...labelLines.map((l) => l.length));
  const gapL = 10;
  let R = Math.min((area.w - 2 * (labW + gapL)) / 2, (area.h - 2 * (labH + gapL)) / 2);
  if (spec.height === undefined) {
    R = Math.max(60, Math.min((area.w - 2 * (labW + gapL)) / 2, spec.maxRadius ?? 210));
    frame.setHeight(area.y + 2 * (R + labH + gapL) + 4 + frame.chrome);
    area = { ...area, h: frame.bottom - area.y };
  }
  R = Math.max(40, R);
  const cx = area.x + area.w / 2;
  const cy = area.y + area.h / 2;
  const ang = (i) => -Math.PI / 2 + (2 * Math.PI * i) / n;
  const rOf = (v) => Math.max(0, ((v - dom.min) / (dom.max - dom.min || 1)) * R);
  const pt = (i, r) => [cx + r * Math.cos(ang(i)), cy + r * Math.sin(ang(i))];
  const shape = spec.grid === 'circle' ? 'circle' : 'polygon';
  const ringPath = (r) => (shape === 'circle' ? null : 'M' + axes.map((_, i) => pt(i, r).map((v) => v.toFixed(2)).join(',')).join('L') + 'Z');

  const body = [];
  rings.forEach((t, k) => {
    const r = rOf(t);
    const outer = k === rings.length - 1;
    const attrs = { fill: 'none', stroke: outer ? theme.axis : theme.grid, strokeWidth: 1 };
    body.push(shape === 'circle' ? el('circle', { cx, cy, r, ...attrs }) : el('path', { d: ringPath(r), ...attrs, strokeLinejoin: 'round' }));
  });
  axes.forEach((_, i) => { const [x, y] = pt(i, R); body.push(el('line', { x1: cx, y1: cy, x2: x, y2: y, stroke: theme.grid, strokeWidth: 1 })); });

  const order = [...seriesKeys].sort((a, b) => (focus(a) ? 1 : 0) - (focus(b) ? 1 : 0));
  const op = theme.marks?.bandOpacity ?? 0.16;
  const lw = theme.marks?.lineWidth ?? 2;
  for (const s of order) {
    const c = colorOf(s);
    const verts = axes.map((a, i) => { const v = val(s, a); return Number.isFinite(v) ? pt(i, rOf(v)) : [cx, cy]; });
    const d = 'M' + verts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join('L') + 'Z';
    const top = axes.map((a) => [a, values.get(s).get(a)]).filter(([, v]) => Number.isFinite(v)).sort((p, q) => (norm ? q[1] / (axisMax.get(q[0]) || 1) - p[1] / (axisMax.get(p[0]) || 1) : q[1] - p[1]));
    const parts = [el('path', { d, fill: c, fillOpacity: focus(s) ? op : op * 0.5, stroke: c, strokeWidth: focus(s) ? lw : 1.25, strokeLinejoin: 'round' })];
    if (focus(s)) verts.forEach(([x, y], i) => {
      const v = values.get(s).get(axes[i]);
      parts.push(el('circle', { cx: x, cy: y, r: (theme.marks?.pointRadius ?? 4) - 0.5, fill: c, stroke: theme.surface, strokeWidth: theme.marks?.ring ?? 2, 'data-tip': tip(s, `${axes[i]}: ${Number.isFinite(v) ? fmt(v) : '—'}`) }));
    });
    body.push(g({ class: 'pa-m', 'data-series': s, 'data-tip': tip(s, ...top.slice(0, 6).map(([a, v]) => `${a}: ${fmt(v)}`)) }, parts));
  }

  rings.forEach((t) => {
    const r = rOf(t);
    body.push(text(cx + 4, cy - r - 3, ringFmt(t), { fill: theme.muted, fontSize: (theme.type?.axis ?? 11.5) - 1, stroke: theme.surface, strokeWidth: 3, paintOrder: 'stroke', strokeLinejoin: 'round' }));
  });

  axes.forEach((a, i) => {
    const t = ang(i);
    const cos = Math.cos(t), sin = Math.sin(t);
    const [x, y] = pt(i, R + gapL);
    const anchor = cos > 0.25 ? 'start' : cos < -0.25 ? 'end' : 'middle';
    const lines = labelLines[i];
    const lh = ls * 1.25;
    const total = lines.length * lh;
    const y0 = sin < -0.25 ? y - total + ls * 0.85 : sin > 0.25 ? y + ls * 0.85 : y - total / 2 + ls * 0.85;
    lines.forEach((l, k) => body.push(text(x, y0 + k * lh, l, { fill: theme.ink, fontSize: ls, fontWeight: 500, textAnchor: anchor })));
  });

  const parts = seriesKeys.slice(0, 5).map((s) => {
    const best = axes.map((a) => [a, val(s, a)]).filter(([, v]) => Number.isFinite(v)).sort((p, q) => q[1] - p[1]);
    if (!best.length) return '';
    const b = best[0], w = best[best.length - 1];
    return en ? `${s}: strongest on ${b[0]}, weakest on ${w[0]}.` : `${s}: más alto en ${b[0]}, más bajo en ${w[0]}.`;
  });
  const warn = seriesKeys.length > 4 ? (en ? ' More than 4 series overlap; consider highlight.' : ' Más de 4 series se superponen; considera highlight.') : '';
  const desc = (en ? `Radar chart with ${n} axes and ${seriesKeys.length} series${norm ? ' (each axis normalized to its maximum)' : ''}. ` : `Gráfico de radar con ${n} ejes y ${seriesKeys.length} series${norm ? ' (cada eje normalizado a su máximo)' : ''}. `) + parts.join(' ') + warn;
  return frame.finish(body, { desc, type: 'radar' });
}

return { "radar": radar };
});
__def("src/charts/network.js", function () {
const { el, g, text, tip } = __req("src/svg.js");
const { measure, truncate } = __req("src/text.js");
const { makeFormat } = __req("src/format.js");
const { colorMap, readable } = __req("src/theme.js");
const { ensureData, requireField, num, fieldsOf, fieldKind, PlotError } = __req("src/data.js");
const { createFrame } = __req("src/frame.js");

const pick = (fields, cands) => cands.find((c) => fields.includes(c));

/** Prepara nodos y aristas a partir del spec. */
function prepareNetwork(spec) {
  const data = ensureData(spec);
  const fields = fieldsOf(data);
  const from = spec.from ?? pick(fields, ['from', 'source', 'origen', 'desde']) ?? fields[0];
  const to = spec.to ?? pick(fields, ['to', 'target', 'destino', 'hasta']) ?? fields[1];
  requireField(data, from, 'from');
  requireField(data, to, 'to');
  const vf = spec.value ?? pick(fields, ['value', 'weight', 'peso', 'valor']) ?? fields.find((f) => f !== from && f !== to && fieldKind(data, f) === 'number');
  if (spec.value) requireField(data, vf, 'value');

  const emap = new Map();
  for (const r of data) {
    const a = r[from], b = r[to];
    if (a === null || a === undefined || b === null || b === undefined) continue;
    const s = String(a), t = String(b);
    if (s === t) continue;
    const w = vf ? num(r[vf]) : 1;
    if (!(w > 0)) continue;
    const key = s < t ? s + '\u0000' + t : t + '\u0000' + s;
    if (!emap.has(key)) emap.set(key, { s: s < t ? s : t, t: s < t ? t : s, v: 0 });
    emap.get(key).v += w;
  }
  const edges = [...emap.values()];

  const nodes = new Map();
  const add = (id) => { if (!nodes.has(id)) nodes.set(id, { id, label: id, group: null, size: null, deg: 0, wdeg: 0 }); return nodes.get(id); };
  if (Array.isArray(spec.nodes) && spec.nodes.length) {
    const nf = fieldsOf(spec.nodes);
    const idF = spec.nodeId ?? pick(nf, ['id', 'name', 'nombre', 'node', 'nodo']) ?? nf[0];
    const labF = spec.nodeLabel ?? pick(nf, ['label', 'etiqueta']) ?? idF;
    const grF = spec.group ?? pick(nf, ['group', 'grupo', 'type', 'tipo', 'category', 'categoria']);
    const szF = spec.size ?? pick(nf, ['size', 'value', 'valor', 'tamaño', 'weight']);
    if (!nf.includes(idF)) throw new PlotError(`El campo "${idF}" (nodeId) no existe en nodes.`, `Campos disponibles: ${nf.join(', ')}`);
    for (const r of spec.nodes) {
      if (r[idF] === null || r[idF] === undefined) continue;
      const n = add(String(r[idF]));
      if (labF && r[labF] !== undefined) n.label = String(r[labF]);
      if (grF && r[grF] !== undefined && r[grF] !== null) n.group = String(r[grF]);
      if (szF && Number.isFinite(num(r[szF]))) n.size = num(r[szF]);
    }
  }
  for (const e of edges) {
    const a = add(e.s), b = add(e.t);
    a.deg++; b.deg++; a.wdeg += e.v; b.wdeg += e.v;
  }
  const list = [...nodes.values()];
  for (const n of list) n.w = n.size ?? n.wdeg;
  return { edges, nodes: list, byId: nodes, valueField: vf };
}

/** Disposición por fuerzas (velocity Verlet simplificado, al estilo d3-force). */
function forceLayout(nodes, edges, byId, { iterations = 320, spacing = 40, pin = null } = {}) {
  const n = nodes.length;
  const order = [...nodes].sort((a, b) => String(a.group).localeCompare(String(b.group)) || b.w - a.w);
  order.forEach((nd, i) => {
    const r = spacing * 0.6 * Math.sqrt(i + 0.5), a = i * 2.399963229728653;
    nd.x = r * Math.cos(a); nd.y = r * Math.sin(a); nd.vx = 0; nd.vy = 0;
  });
  if (pin) { const c = { x: pin.x, y: pin.y }; for (const nd of nodes) { nd.x -= c.x; nd.y -= c.y; } }
  const links = edges.map((e) => ({ a: byId.get(e.s), b: byId.get(e.t), v: e.v }));
  const maxV = Math.max(1, ...links.map((l) => l.v));
  let alpha = 1;
  const decay = 1 - Math.pow(0.001, 1 / iterations);
  const charge = -spacing * spacing * 0.9;
  for (let it = 0; it < iterations; it++) {
    for (let i = 0; i < n; i++) {
      const p = nodes[i];
      for (let j = i + 1; j < n; j++) {
        const q = nodes[j];
        let dx = q.x - p.x, dy = q.y - p.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 1e-6) { dx = ((i * 7 + j * 13) % 11) / 11 - 0.5; dy = ((i * 5 + j * 3) % 7) / 7 - 0.5; d2 = dx * dx + dy * dy; }
        const f = (charge * alpha) / Math.max(d2, spacing * 0.25);
        const d = Math.sqrt(d2);
        const fx = (dx / d) * f, fy = (dy / d) * f;
        p.vx += fx; p.vy += fy; q.vx -= fx; q.vy -= fy;
      }
    }
    for (const l of links) {
      const dx = l.b.x + l.b.vx - l.a.x - l.a.vx, dy = l.b.y + l.b.vy - l.a.y - l.a.vy;
      const d = Math.sqrt(dx * dx + dy * dy) || 1e-6;
      const target = spacing * (1.05 - 0.35 * Math.sqrt(l.v / maxV)) + (l.a.r + l.b.r) * 0.8;
      const k = (alpha * (0.35 + 0.65 * Math.sqrt(l.v / maxV))) / Math.max(1, Math.min(l.a.deg, l.b.deg));
      const f = ((d - target) / d) * k;
      const bias = l.a.deg / (l.a.deg + l.b.deg);
      l.b.vx -= dx * f * bias; l.b.vy -= dy * f * bias;
      l.a.vx += dx * f * (1 - bias); l.a.vy += dy * f * (1 - bias);
    }
    for (const p of nodes) { p.vx -= p.x * 0.02 * alpha; p.vy -= p.y * 0.02 * alpha; }
    for (const p of nodes) { p.vx *= 0.6; p.vy *= 0.6; p.x += p.vx; p.y += p.vy; }
    if (pin) { pin.x = 0; pin.y = 0; pin.vx = 0; pin.vy = 0; }
    for (let pass = 0; pass < 2; pass++)
      for (let i = 0; i < n; i++)
        for (let j = i + 1; j < n; j++) {
          const p = nodes[i], q = nodes[j];
          const dx = q.x - p.x, dy = q.y - p.y;
          const min = p.r + q.r + 3;
          const d2 = dx * dx + dy * dy;
          if (d2 < min * min) {
            const d = Math.sqrt(d2) || 1e-6;
            const s = ((min - d) / d) * 0.5;
            p.x -= dx * s; p.y -= dy * s; q.x += dx * s; q.y += dy * s;
          }
        }
    if (pin) { pin.x = 0; pin.y = 0; }
    alpha -= alpha * decay;
  }
}

/** Círculo ordenado por grupo y tamaño. */
function circleLayout(nodes, groups) {
  const order = [...nodes].sort((a, b) => groups.indexOf(a.group) - groups.indexOf(b.group) || b.w - a.w);
  const n = order.length;
  order.forEach((nd, i) => {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    nd.x = Math.cos(a); nd.y = Math.sin(a); nd.angle = a;
  });
}

function network(spec, theme) {
  const locale = spec.locale || 'es';
  const en = String(locale).startsWith('en');
  const { edges, nodes, byId } = prepareNetwork(spec);
  if (!nodes.length) throw new PlotError('La red no tiene conexiones válidas.', 'Entrega filas con { from, to, value }.');
  const layout = spec.layout === 'circle' ? 'circle' : 'force';

  const gtot = new Map();
  for (const n of nodes) { const k = n.group ?? ''; gtot.set(k, (gtot.get(k) || 0) + n.w); }
  const groups = [...gtot.keys()].sort((a, b) => gtot.get(b) - gtot.get(a));
  const hasGroups = groups.length > 1 || (groups.length === 1 && groups[0] !== '');
  const cmap = colorMap(groups, theme, spec.colors);
  const colorOf = (n) => (spec.colors && spec.colors[n.id]) || (hasGroups ? cmap.get(n.group ?? '') : theme.categorical[0]);
  const fmt = makeFormat(spec.format, locale, nodes.map((n) => n.w));
  const fmtE = makeFormat(spec.format, locale, edges.map((e) => e.v));

  const legend = hasGroups && spec.legend !== false ? groups.map((k) => ({ label: k || (en ? 'No group' : 'Sin grupo'), color: cmap.get(k) })) : [];
  const W = spec.width || 720;
  const frame = createFrame(spec, theme, { height: W < 560 ? Math.round(W * 1.05 + 150) : 520 });
  const area = frame.layout(legend);

  const maxW = Math.max(...nodes.map((n) => n.w), 1e-9);
  const rMax = spec.maxRadius ?? Math.max(9, Math.min(22, Math.sqrt((area.w * area.h) / nodes.length) * 0.32));
  const rMin = Math.min(4, rMax / 2);
  for (const n of nodes) n.r = rMin + (rMax - rMin) * Math.sqrt(Math.max(0, n.w) / maxW);

  const labelSize = (theme.type?.label ?? 12) - 0.5;
  let labelSet;
  if (Array.isArray(spec.labels)) labelSet = new Set(spec.labels.map(String));
  else if (spec.labels === false) labelSet = new Set();
  else {
    const k = typeof spec.labels === 'number' ? spec.labels : nodes.length <= 14 ? nodes.length : layout === 'circle' ? nodes.length : 10;
    labelSet = new Set([...nodes].sort((a, b) => b.w - a.w).slice(0, k).map((n) => n.id));
  }

  const focusNode = spec.focus !== undefined && spec.focus !== null ? byId.get(String([].concat(spec.focus)[0])) : null;
  if (focusNode) {
    labelSet.add(focusNode.id);
    for (const e of edges) { if (e.s === focusNode.id) labelSet.add(e.t); if (e.t === focusNode.id) labelSet.add(e.s); }
  }

  const body = [];
  if (layout === 'circle') {
    circleLayout(nodes, groups);
    const lwFull = Math.max(0, ...nodes.filter((n) => labelSet.has(n.id)).map((n) => measure(n.label, labelSize, 600)));
    const lw = Math.min(area.w * (area.w < 480 ? 0.2 : 0.28), lwFull) + 10;
    const rGuess = Math.min(rMax, 10);
    const R = Math.max(40, Math.min(area.w / 2 - lw - rGuess, area.h / 2 - rGuess - 16));
    const rCap = Math.max(3.5, ((Math.PI * 2 * R) / nodes.length) * 0.4);
    if (rCap < rMax) for (const n of nodes) n.r = Math.max(3, n.r * (rCap / rMax));
    const cx = area.x + area.w / 2, cy = area.y + area.h / 2;
    for (const n of nodes) { n.px = cx + n.x * R; n.py = cy + n.y * R; }
    nodes.cx = cx; nodes.cy = cy; nodes.R = R; nodes.lw = lw;
  } else {
    const spacing = Math.max(26, Math.sqrt((area.w * area.h) / nodes.length) * 0.75);
    forceLayout(nodes, edges, byId, { spacing, pin: focusNode, iterations: spec.iterations ?? (nodes.length > 200 ? 200 : 320) });
    if (!focusNode) {
      const mx = nodes.reduce((a, n) => a + n.x, 0) / nodes.length, my = nodes.reduce((a, n) => a + n.y, 0) / nodes.length;
      let sxx = 0, syy = 0, sxy = 0;
      for (const n of nodes) { const dx = n.x - mx, dy = n.y - my; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
      let th = 0.5 * Math.atan2(2 * sxy, sxx - syy); // ángulo del eje principal
      if (area.h > area.w) th -= Math.PI / 2;
      const c = Math.cos(-th), si = Math.sin(-th);
      for (const n of nodes) { const dx = n.x - mx, dy = n.y - my; n.x = dx * c - dy * si; n.y = dx * si + dy * c; }
    }
    const x0 = Math.min(...nodes.map((n) => n.x - n.r)), x1 = Math.max(...nodes.map((n) => n.x + n.r));
    const y0 = Math.min(...nodes.map((n) => n.y - n.r)), y1 = Math.max(...nodes.map((n) => n.y + n.r));
    const pad = rMax + 4;
    const aw = Math.max(10, area.w - pad * 2), ah = Math.max(10, area.h - pad * 2);
    let sx = aw / Math.max(1e-6, x1 - x0), sy = ah / Math.max(1e-6, y1 - y0);
    const ratio = sx / sy;
    const lim = 2.4;
    if (ratio > lim) sx = sy * lim; else if (ratio < 1 / lim) sy = sx * lim;
    if (focusNode) {
      const ex = Math.max(...nodes.map((n) => Math.abs(n.x) + n.r), 1e-6), ey = Math.max(...nodes.map((n) => Math.abs(n.y) + n.r), 1e-6);
      let fx = aw / 2 / ex, fy = ah / 2 / ey;
      if (fx / fy > lim) fx = fy * lim; else if (fy / fx > lim) fy = fx * lim;
      const ccx = area.x + area.w / 2, ccy = area.y + area.h / 2;
      for (const n of nodes) { n.px = ccx + n.x * fx; n.py = ccy + n.y * fy; }
    } else {
      const ox = area.x + pad + (aw - (x1 - x0) * sx) / 2, oy = area.y + pad + (ah - (y1 - y0) * sy) / 2;
      for (const n of nodes) { n.px = ox + (n.x - x0) * sx; n.py = oy + (n.y - y0) * sy; }
    }
    for (let pass = 0; pass < 6; pass++)
      for (let i = 0; i < nodes.length; i++)
        for (let j = i + 1; j < nodes.length; j++) {
          const p = nodes[i], q = nodes[j];
          const dx = q.px - p.px, dy = q.py - p.py, min = p.r + q.r + 2, d2 = dx * dx + dy * dy;
          if (d2 < min * min) { const d = Math.sqrt(d2) || 1e-6, s = ((min - d) / d) * 0.5; p.px -= dx * s; p.py -= dy * s; q.px += dx * s; q.py += dy * s; }
        }
    for (const n of nodes) {
      n.px = Math.max(area.x + n.r + 1, Math.min(area.x + area.w - n.r - 1, n.px));
      n.py = Math.max(area.y + n.r + 1, Math.min(area.y + area.h - n.r - 1, n.py));
    }
  }

  const hl = focusNode ? new Set([focusNode.id]) : spec.highlight === undefined ? null : new Set([].concat(spec.highlight).map(String));
  const near = new Set();
  if (hl) { for (const id of hl) near.add(id); for (const e of edges) { if (hl.has(e.s)) near.add(e.t); if (hl.has(e.t)) near.add(e.s); } }
  const on = (n) => !hl || near.has(n.id);

  const maxE = Math.max(...edges.map((e) => e.v), 1e-9);
  const manyLinks = edges.length > 150;
  const linkG = [];
  for (const e of [...edges].sort((a, b) => a.v - b.v)) {
    const a = byId.get(e.s), b = byId.get(e.t);
    const w = 0.75 + 3.25 * Math.sqrt(e.v / maxE);
    let d;
    if (layout === 'circle') {
      const mx = (a.px + b.px) / 2, my = (a.py + b.py) / 2;
      const qx = mx + (nodes.cx - mx) * 0.55, qy = my + (nodes.cy - my) * 0.55;
      d = `M${a.px.toFixed(1)},${a.py.toFixed(1)}Q${qx.toFixed(1)},${qy.toFixed(1)} ${b.px.toFixed(1)},${b.py.toFixed(1)}`;
    } else {
      const dx = b.px - a.px, dy = b.py - a.py, len = Math.hypot(dx, dy) || 1;
      const bend = Math.min(18, len * 0.08);
      const qx = (a.px + b.px) / 2 - (dy / len) * bend, qy = (a.py + b.py) / 2 + (dx / len) * bend;
      d = `M${a.px.toFixed(1)},${a.py.toFixed(1)}Q${qx.toFixed(1)},${qy.toFixed(1)} ${b.px.toFixed(1)},${b.py.toFixed(1)}`;
    }
    const active = hl ? hl.has(e.s) || hl.has(e.t) : true;
    linkG.push(el('path', {
      class: 'pa-m', d, fill: 'none', stroke: active && hl ? theme.ink : theme.muted,
      strokeOpacity: hl ? (active ? 0.55 : 0.08) : manyLinks ? 0.22 : 0.38, strokeWidth: w, strokeLinecap: 'round',
      'data-tip': tip(`${a.label} — ${b.label}`, fmtE(e.v)),
    }));
  }
  body.push(g({ class: 'pa-links' }, linkG));

  const nodeG = [];
  for (const n of [...nodes].sort((a, b) => (on(a) - on(b)) || b.r - a.r)) {
    const lines = [n.label];
    if (hasGroups && n.group) lines.push(n.group);
    lines.push(`${en ? 'Connections' : 'Conexiones'}: ${n.deg}`);
    lines.push(`${n.size !== null ? (en ? 'Size' : 'Tamaño') : en ? 'Weighted degree' : 'Grado ponderado'}: ${fmt(n.w)}`);
    const isF = focusNode && n.id === focusNode.id;
    nodeG.push(el('circle', { class: 'pa-m', cx: n.px, cy: n.py, r: n.r, fill: on(n) ? colorOf(n) : theme.dim, stroke: isF ? theme.ink : theme.surface, strokeWidth: isF ? 2.5 : theme.marks?.ring ? Math.min(2, theme.marks.ring) * 0.75 : 1.5, 'data-tip': tip(...lines), 'data-node': n.id, style: 'cursor:pointer' }));
  }
  body.push(g({ class: 'pa-nodes' }, nodeG));

  const placed = nodes.map((n) => [n.px - n.r, n.py - n.r, n.px + n.r, n.py + n.r, n.id, n.r]);
  const labG = [];
  const lbls = nodes.filter((n) => labelSet.has(n.id) && (on(n) || hl?.has(n.id))).sort((a, b) => (hl ? (hl.has(b.id) - hl.has(a.id)) : 0) || b.w - a.w);
  for (const n of lbls) {
    const strong = hl ? hl.has(n.id) : true;
    const weight = strong ? 600 : 500;
    const label = truncate(n.label, layout === 'circle' ? nodes.lw - 8 : 150, labelSize, weight);
    const w = measure(label, labelSize, weight), h = labelSize + 2;
    let cands;
    if (layout === 'circle') {
      const ca = Math.cos(n.angle), sa = Math.sin(n.angle);
      const lx = n.px + ca * (n.r + 6), ly = n.py + sa * (n.r + 6) + labelSize * 0.35;
      const anchor = Math.abs(ca) < 0.2 ? 'middle' : ca > 0 ? 'start' : 'end';
      const yy = Math.abs(ca) < 0.2 ? (sa < 0 ? n.py - n.r - 6 : n.py + n.r + labelSize + 2) : ly;
      cands = [[lx, yy, anchor]];
    } else {
      cands = [
        [n.px + n.r + 4, n.py + labelSize * 0.35, 'start'],
        [n.px - n.r - 4, n.py + labelSize * 0.35, 'end'],
        [n.px, n.py - n.r - 4, 'middle'],
        [n.px, n.py + n.r + labelSize + 1, 'middle'],
        [n.px + n.r * 0.75 + 3, n.py - n.r * 0.75 - 2, 'start'],
        [n.px - n.r * 0.75 - 3, n.py - n.r * 0.75 - 2, 'end'],
        [n.px + n.r * 0.75 + 3, n.py + n.r * 0.75 + labelSize, 'start'],
        [n.px - n.r * 0.75 - 3, n.py + n.r * 0.75 + labelSize, 'end'],
      ];
    }
    for (const [lx, ly, anchor] of cands) {
      const bx0 = anchor === 'start' ? lx : anchor === 'end' ? lx - w : lx - w / 2;
      const box = [bx0 - 1, ly - h + 2, bx0 + w + 1, ly + 3];
      if (box[0] < area.x - 2 || box[2] > area.x + area.w + 2 || box[1] < area.y - 4 || box[3] > area.y + area.h + 4) continue;
      const hit = placed.some((b) => b[4] !== n.id && (b[4] === null || (b[5] >= 7 && (!hl || near.has(b[4])))) && !(box[2] < b[0] || box[0] > b[2] || box[3] < b[1] || box[1] > b[3]));
      const must = hl && hl.has(n.id) && lx === cands[cands.length - 1][0] && ly === cands[cands.length - 1][1];
      if (hit && layout !== 'circle' && !must) continue;
      placed.push([...box, null, 0]);
      labG.push(el('text', {
        x: lx, y: ly, textAnchor: anchor, fill: hasGroups ? readable(colorOf(n), theme) : theme.ink, fontSize: labelSize, fontWeight: weight,
        stroke: theme.surface, strokeWidth: 3, paintOrder: 'stroke', strokeLinejoin: 'round',
      }, label.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])));
      break;
    }
  }
  body.push(g({ class: 'pa-labels' }, labG));

  const top = [...nodes].sort((a, b) => b.deg - a.deg || b.w - a.w).slice(0, 3);
  const desc = en
    ? `Network of ${nodes.length} nodes and ${edges.length} connections. Most connected: ${top.map((n) => `${n.label} (${n.deg})`).join(', ')}.`
    : `Red de ${nodes.length} nodos y ${edges.length} conexiones. Más conectados: ${top.map((n) => `${n.label} (${n.deg})`).join(', ')}.`;
  return frame.finish(body, { desc, type: 'network' });
}

return { "prepareNetwork": prepareNetwork, "network": network };
});
__def("src/charts/chord.js", function () {
const { el, g, text, tip } = __req("src/svg.js");
const { measure, truncate, wrap } = __req("src/text.js");
const { makeFormat, formatNumber } = __req("src/format.js");
const { colorMap, readable } = __req("src/theme.js");
const { ensureData, requireField, num, fieldsOf, fieldKind, PlotError } = __req("src/data.js");
const { createFrame } = __req("src/frame.js");

const pick = (fields, cands) => cands.find((c) => fields.includes(c));
const TAU = Math.PI * 2;

/** Matriz de flujos m[i][j] (de i hacia j) y nombres. */
function prepareChord(spec) {
  if (Array.isArray(spec.matrix)) {
    const names = (spec.names || spec.matrix.map((_, i) => String(i + 1))).map(String);
    if (spec.matrix.length !== names.length) throw new PlotError('`matrix` y `names` deben tener el mismo largo.', 'matrix: [[0, 5], [3, 0]], names: ["A", "B"]');
    return { names, m: spec.matrix.map((row) => names.map((_, j) => Math.max(0, num(row[j]) || 0))) };
  }
  const data = ensureData(spec);
  const fields = fieldsOf(data);
  const from = spec.from ?? pick(fields, ['from', 'source', 'origen', 'desde']) ?? fields[0];
  const to = spec.to ?? pick(fields, ['to', 'target', 'destino', 'hasta']) ?? fields[1];
  requireField(data, from, 'from');
  requireField(data, to, 'to');
  const vf = spec.value ?? pick(fields, ['value', 'valor', 'weight', 'flujo']) ?? fields.find((f) => f !== from && f !== to && fieldKind(data, f) === 'number');
  if (vf) requireField(data, vf, 'value');
  const names = [];
  const idx = new Map();
  const at = (k) => { if (!idx.has(k)) { idx.set(k, names.length); names.push(k); } return idx.get(k); };
  const flows = [];
  for (const r of data) {
    if (r[from] === null || r[from] === undefined || r[to] === null || r[to] === undefined) continue;
    const v = vf ? num(r[vf]) : 1;
    if (!(v > 0)) continue;
    flows.push([at(String(r[from])), at(String(r[to])), v]);
  }
  const m = names.map(() => names.map(() => 0));
  for (const [i, j, v] of flows) m[i][j] += v;
  return { names, m };
}

function chord(spec, theme) {
  const locale = spec.locale || 'es';
  const en = String(locale).startsWith('en');
  const { names, m } = prepareChord(spec);
  const n = names.length;
  if (n < 2) throw new PlotError('El diagrama de cuerdas necesita al menos dos grupos.', 'Entrega filas { from, to, value } entre grupos distintos.');
  const directed = spec.directed === true;

  const seg = names.map(() => []);
  const ribbons = [];
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      if (directed) {
        if (m[i][j] > 0) { const rb = { i, j, v: m[i][j] }; ribbons.push(rb); seg[i].push({ rb, end: 's', partner: j, v: m[i][j] }); seg[j].push({ rb, end: 't', partner: i, v: m[i][j] }); }
      } else if (i < j) {
        const v = m[i][j] + m[j][i];
        if (v > 0) { const rb = { i, j, v, ij: m[i][j], ji: m[j][i] }; ribbons.push(rb); seg[i].push({ rb, end: 's', partner: j, v }); seg[j].push({ rb, end: 't', partner: i, v }); }
      }
    }
  const totals = seg.map((s) => s.reduce((a, b) => a + b.v, 0));
  const out = m.map((row, i) => row.reduce((a, v, j) => a + (j === i ? 0 : v), 0));
  const inn = names.map((_, j) => m.reduce((a, row, i) => a + (i === j ? 0 : row[j]), 0));
  let order = names.map((_, i) => i).filter((i) => totals[i] > 0);
  if (spec.sort !== 'none') order.sort((a, b) => totals[b] - totals[a]);
  const T = order.reduce((a, i) => a + totals[i], 0);
  if (!(T > 0)) throw new PlotError('No hay flujos positivos entre grupos distintos.', 'Revisa el campo de valor.');

  const sizeOrder = [...order].sort((a, b) => totals[b] - totals[a]);
  const cmap = colorMap(sizeOrder.map((i) => names[i]), theme, spec.colors);
  const colorOf = (i) => cmap.get(names[i]);
  const fmt = makeFormat(spec.format, locale, ribbons.map((r) => r.v).concat(totals));
  const pct = (a, b) => (b > 0 ? formatNumber((a / b) * 100, a / b < 0.1 ? 1 : 0, locale, true) + '%' : '');

  const legend = spec.legend === true ? sizeOrder.map((i) => ({ label: names[i], color: colorOf(i) })) : [];
  const W = spec.width || 720;
  const frame = createFrame(spec, theme, { height: W < 560 ? Math.round(W * 1.02 + 150) : 600 });
  const area = frame.layout(legend);

  const pad = Math.min(0.04, (TAU * 0.18) / order.length);
  const k = (TAU - pad * order.length) / T;
  let a = -Math.PI / 2 + pad / 2;
  const arc = new Map();
  for (const i of order) {
    const a0 = a, a1 = a + totals[i] * k;
    arc.set(i, { a0, a1, mid: (a0 + a1) / 2 });
    a = a1 + pad;
  }
  const pos = new Map(order.map((i, p) => [i, p]));
  for (const i of order) {
    const { a0 } = arc.get(i);
    const p = pos.get(i);
    const list = seg[i].filter((s) => pos.has(s.partner)).sort((x, y) => {
      const dx = (pos.get(x.partner) - p + order.length) % order.length;
      const dy = (pos.get(y.partner) - p + order.length) % order.length;
      return dy - dx || (x.end === 's' ? -1 : 1);
    });
    let c = a0;
    for (const s of list) { s.a0 = c; s.a1 = c + s.v * k; c = s.a1; s.rb[s.end] = s; }
  }

  const narrow = area.w < 480;
  const labelSize = (theme.type?.label ?? 12) + (narrow ? -1 : 0.5);
  const radial = spec.labelOrientation ? spec.labelOrientation === 'radial' : order.length > 10;
  const valueOf = (i) => fmt(totals[i]);
  const thick = Math.max(8, Math.min(14, Math.min(area.w, area.h) * 0.03));
  const gapL = 10;
  const radiusFor = (lw) => radial
    ? Math.min(area.w, area.h) / 2 - thick - gapL - lw - 4
    : Math.min(area.w / 2 - (lw + thick + gapL + 6), area.h / 2 - thick - gapL - labelSize * 2.6);
  const full = Math.max(...order.map((i) => Math.max(measure(names[i], labelSize, 600), radial ? 0 : measure(valueOf(i), labelSize - 1.5))));
  const minR = Math.min(area.w, area.h) * (narrow ? 0.22 : 0.3);
  let maxLabel = full;
  if (radiusFor(full) < minR) {
    maxLabel = Math.max(48, radial ? Math.min(area.w, area.h) / 2 - thick - gapL - 4 - minR : area.w / 2 - thick - gapL - 6 - minR);
  }
  const linesOf = (i) => (radial ? [truncate(names[i], maxLabel, labelSize, 600)] : wrap(names[i], maxLabel, labelSize, 600, 2));
  const labelOf = (i) => linesOf(i).join(' ');
  const lw = Math.max(...order.map((i) => Math.max(...linesOf(i).map((l) => measure(l, labelSize, 600)), radial ? 0 : measure(valueOf(i), labelSize - 1.5))));
  let R = Math.max(60, radiusFor(lw));
  const cx = area.x + area.w / 2, cy = area.y + area.h / 2;
  const r0 = R, r1 = R + thick;
  const P = (ang, r) => [cx + Math.cos(ang) * r, cy + Math.sin(ang) * r];
  const f = (v) => v.toFixed(2);

  const hl = spec.highlight === undefined ? null : new Set([].concat(spec.highlight).map(String));
  const isOn = (rb) => !hl || hl.has(names[rb.i]) || hl.has(names[rb.j]);

  const ribbonG = [];
  const rr = r0 - 1;
  for (const rb of [...ribbons].sort((x, y) => (isOn(x) - isOn(y)) || y.v - x.v)) {
    const s = rb.s, t = rb.t;
    if (!s || !t) continue;
    const [sx0, sy0] = P(s.a0, rr), [sx1, sy1] = P(s.a1, rr), [tx0, ty0] = P(t.a0, rr), [tx1, ty1] = P(t.a1, rr);
    const lg = (x, y) => (y - x > Math.PI ? 1 : 0);
    const d = `M${f(sx0)},${f(sy0)}A${f(rr)},${f(rr)} 0 ${lg(s.a0, s.a1)} 1 ${f(sx1)},${f(sy1)}Q${f(cx)},${f(cy)} ${f(tx0)},${f(ty0)}A${f(rr)},${f(rr)} 0 ${lg(t.a0, t.a1)} 1 ${f(tx1)},${f(ty1)}Q${f(cx)},${f(cy)} ${f(sx0)},${f(sy0)}Z`;
    const mode = spec.ribbonColor ?? (directed ? 'source' : 'smaller');
    const src = mode === 'source' ? rb.i
      : mode === 'larger' ? (rb.ij >= rb.ji ? rb.i : rb.j)
      : totals[rb.i] <= totals[rb.j] ? rb.i : rb.j;
    const A = names[rb.i], B = names[rb.j];
    const lines = directed
      ? [`${A} → ${B}`, `${fmt(rb.v)} · ${pct(rb.v, out[rb.i])} ${en ? 'of what' : 'de lo que'} ${A} ${en ? 'sends' : 'envía'}`]
      : [`${A} ↔ ${B}`, `${A} → ${B}: ${fmt(rb.ij)}`, `${B} → ${A}: ${fmt(rb.ji)}`, `${en ? 'Total' : 'Total'}: ${fmt(rb.v)} · ${pct(rb.v, totals[rb.i])} ${en ? 'of' : 'de'} ${A}`];
    ribbonG.push(el('path', {
      class: 'pa-m', d, fill: colorOf(src), fillOpacity: isOn(rb) ? (hl ? 0.75 : 0.62) : 0.1,
      stroke: theme.surface, strokeWidth: 0.75, strokeOpacity: 0.9, 'data-tip': tip(...lines),
    }));
  }

  const arcG = [];
  for (const i of order) {
    const { a0, a1 } = arc.get(i);
    const [x0, y0] = P(a0, r0 + 1.5), [x1, y1] = P(a1, r0 + 1.5), [x2, y2] = P(a1, r1), [x3, y3] = P(a0, r1);
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const d = `M${f(x0)},${f(y0)}A${f(r0 + 1.5)},${f(r0 + 1.5)} 0 ${large} 1 ${f(x1)},${f(y1)}L${f(x2)},${f(y2)}A${f(r1)},${f(r1)} 0 ${large} 0 ${f(x3)},${f(y3)}Z`;
    const dim = hl && !hl.has(names[i]);
    const lines = directed
      ? [names[i], `${en ? 'Out' : 'Sale'}: ${fmt(out[i])}`, `${en ? 'In' : 'Entra'}: ${fmt(inn[i])}`]
      : [names[i], `${en ? 'Total flows' : 'Flujos totales'}: ${fmt(totals[i])}`, `${pct(totals[i], T)} ${en ? 'of all' : 'del total'}`];
    arcG.push(el('path', { class: 'pa-m', d, fill: dim ? theme.dim : colorOf(i), stroke: theme.surface, strokeWidth: 1, 'data-tip': tip(...lines) }));
  }

  const labG = [];
  const halo = { stroke: theme.surface, strokeWidth: 3, paintOrder: 'stroke', strokeLinejoin: 'round' };
  for (const i of order) {
    const { mid, a0, a1 } = arc.get(i);
    if ((a1 - a0) * r1 < 6 && order.length > 6) continue; // arco demasiado chico
    const dim = hl && !hl.has(names[i]);
    const fill = dim ? theme.muted : readable(colorOf(i), theme);
    const ca = Math.cos(mid), sa = Math.sin(mid);
    if (radial) {
      const [lx, ly] = P(mid, r1 + gapL);
      let deg = (mid * 180) / Math.PI;
      const flip = ca < 0;
      if (flip) deg += 180;
      labG.push(el('text', { x: f(lx), y: f(ly), transform: `rotate(${deg.toFixed(1)} ${f(lx)} ${f(ly)})`, textAnchor: flip ? 'end' : 'start', dominantBaseline: 'middle', fill, fontSize: labelSize, fontWeight: 600, ...halo }, esc(labelOf(i))));
    } else {
      const [lx, ly] = P(mid, r1 + gapL);
      const anchor = Math.abs(ca) < 0.25 ? 'middle' : ca > 0 ? 'start' : 'end';
      const dy = Math.abs(ca) < 0.25 ? (sa < 0 ? -labelSize * 1.2 : labelSize * 0.9) : 0;
      const ls = linesOf(i);
      const lh = labelSize * 1.15;
      const y0 = Math.abs(ca) < 0.25 && sa < 0 ? ly + dy - (ls.length - 1) * lh : ly + dy - (Math.abs(ca) >= 0.25 ? ((ls.length - 1) * lh) / 2 : 0);
      ls.forEach((l, k) => labG.push(text(lx, y0 + k * lh, l, { textAnchor: anchor, fill, fontSize: labelSize, fontWeight: 600, ...halo })));
      labG.push(text(lx, y0 + ls.length * lh, valueOf(i), { textAnchor: anchor, fill: theme.lede, fontSize: labelSize - 1.5, ...halo }));
    }
  }

  const body = [g({ class: 'pa-ribbons' }, ribbonG), g({ class: 'pa-arcs' }, arcG), g({ class: 'pa-labels' }, labG)];
  const big = [...ribbons].sort((x, y) => y.v - x.v).slice(0, 3);
  const desc = en
    ? `Chord diagram of ${order.length} groups and ${ribbons.length} flows. Largest: ${big.map((r) => `${names[r.i]} ${directed ? '→' : '↔'} ${names[r.j]} (${fmt(r.v)})`).join('; ')}.`
    : `Diagrama de cuerdas con ${order.length} grupos y ${ribbons.length} flujos. Mayores: ${big.map((r) => `${names[r.i]} ${directed ? '→' : '↔'} ${names[r.j]} (${fmt(r.v)})`).join('; ')}.`;
  return frame.finish(body, { desc, type: 'chord' });
}

function esc(s) {
  return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
}

return { "prepareChord": prepareChord, "chord": chord };
});
__def("src/charts/pyramid.js", function () {
const { el, g, text, tip, barPath } = __req("src/svg.js");
const { measure } = __req("src/text.js");
const { makeFormat, formatNumber } = __req("src/format.js");
const { niceStep, linear } = __req("src/scale.js");
const { colorMap, readable } = __req("src/theme.js");
const { ensureData, requireField, num, uniq, fieldsOf, fieldKind, PlotError } = __req("src/data.js");
const { createFrame } = __req("src/frame.js");

const T = (en, es, locale) => (String(locale || 'es').startsWith('en') ? en : es);
const lead = (s) => { const m = /^\s*(\d+)/.exec(String(s)); return m ? +m[1] : NaN; };

function pyramid(spec, theme) {
  const locale = spec.locale || 'es';
  const data = ensureData(spec);
  const fields = fieldsOf(data);
  const cats = fields.filter((f) => fieldKind(data, f) !== 'number' || /edad|age|grupo|tramo/i.test(f));
  const nums = fields.filter((f) => fieldKind(data, f) === 'number');
  const ageF = spec.age ?? spec.y ?? cats.find((f) => /edad|age|tramo|grupo/i.test(f)) ?? cats[0];
  const sideF = spec.sex ?? spec.series ?? spec.hue ?? (typeof spec.color === 'string' && !spec.color.startsWith('#') ? spec.color : null) ?? cats.find((f) => f !== ageF && /sexo|sex|gender|género|genero/i.test(f)) ?? cats.find((f) => f !== ageF);
  const valF = spec.value ?? spec.x ?? nums.find((f) => f !== ageF && f !== sideF);
  requireField(data, ageF, 'age');
  requireField(data, sideF, 'series');
  requireField(data, valF, 'value');

  let rows = data, cmpRows = spec.compareData ? ensureData({ data: spec.compareData }) : spec._prev && spec.compare !== undefined && spec.compare !== false ? spec._prev.data : null;
  const cmpField = spec.compareField ?? spec.time;
  if (!cmpRows && spec.compare !== undefined && cmpField && fields.includes(cmpField)) {
    cmpRows = data.filter((r) => String(r[cmpField]) === String(spec.compare));
    rows = data.filter((r) => String(r[cmpField]) !== String(spec.compare));
    const periods = uniq(rows.map((r) => String(r[cmpField])));
    if (periods.length > 1) { const last = spec.current ?? periods.sort().at(-1); rows = rows.filter((r) => String(r[cmpField]) === String(last)); }
  }

  const sides = spec.sides ?? uniq(rows.map((r) => String(r[sideF])));
  if (sides.length !== 2) throw new PlotError(T(`A population pyramid needs exactly 2 groups in "${sideF}" (found ${sides.length}).`, `La pirámide necesita exactamente 2 grupos en "${sideF}" (hay ${sides.length}).`, locale), T('Filter the data to two groups, e.g. men and women.', 'Filtra los datos a dos grupos, por ejemplo hombres y mujeres.', locale));
  let ages = uniq([...rows, ...(cmpRows || [])].map((r) => String(r[ageF])));
  if (ages.every((a) => Number.isFinite(lead(a)))) ages.sort((a, b) => lead(a) - lead(b));
  if (spec.ageOrder) ages = spec.ageOrder.map(String);
  const top = [...ages].reverse(); // los mayores arriba

  const sumBy = (rs) => {
    const m = new Map();
    for (const r of rs) {
      const k = String(r[ageF]) + '\u0000' + String(r[sideF]);
      const v = num(r[valF]);
      if (Number.isFinite(v)) m.set(k, (m.get(k) || 0) + Math.abs(v));
    }
    return m;
  };
  const cur = sumBy(rows), cmp = cmpRows ? sumBy(cmpRows) : null;
  const total = [...cur.values()].reduce((a, b) => a + b, 0) || 1;
  const cmpTotal = cmp ? [...cmp.values()].reduce((a, b) => a + b, 0) || 1 : 1;
  const pct = spec.percent === true || spec.format === 'percent' || spec.format?.type === 'percent';
  const val = (m, a, s, tot) => { const v = m.get(a + '\u0000' + s) || 0; return pct ? v / tot : v; };
  const V = (a, s) => val(cur, a, s, total);
  const C = (a, s) => (cmp ? val(cmp, a, s, cmpTotal) : NaN);

  const allV = ages.flatMap((a) => sides.flatMap((s) => [V(a, s), C(a, s)])).filter(Number.isFinite);
  const vmax = Math.max(...allV, 1e-9);
  const fmt = pct ? makeFormat({ type: 'percent', scale: 100, decimals: spec.format?.decimals }, locale) : makeFormat(spec.format, locale, allV);
  const share = (v) => formatNumber((v / total) * 100, (v / total) * 100 < 10 ? 1 : 0, locale, true) + '%';

  const cmap = colorMap(sides, theme, spec.colors);
  const colorOf = (s) => cmap.get(s);
  const cmpLabel = spec.compareLabel ?? spec._prev?.label ?? (spec.compare !== undefined ? String(spec.compare) : T('Comparison', 'Comparación', locale));
  const legend = cmp && spec.legend !== false ? [{ label: cmpLabel, color: theme.ink, shape: 'line' }] : [];

  const frame = createFrame(spec, theme, { height: 420 });
  let area = frame.layout(legend);
  const n = ages.length;
  const headerH = 24, axisH = 24;
  const step = spec.barHeight ? spec.barHeight + 2 : Math.max(14, Math.min(26, frame.width < 480 ? 17 : 21));
  if (spec.height === undefined) {
    frame.setHeight(area.y + headerH + n * step + axisH + frame.chrome);
    area = { ...area, h: frame.bottom - area.y };
  }
  const ageSize = theme.type?.axis ?? 11.5;
  const centerW = Math.max(...ages.map((a) => measure(a, ageSize, 500))) + 18;
  const labelsOn = spec.labels === true;
  const sample = fmt(vmax);
  const endPad = labelsOn ? measure(sample, 11, 600) + 8 : 4;
  const halfW = (area.w - centerW) / 2;
  const cx0 = area.x + halfW, cx1 = cx0 + centerW; // bordes de la columna central
  const plotTop = area.y + headerH;
  const plotH = area.h - headerH - axisH;
  const st = plotH / n;
  const bh = Math.max(4, Math.min(spec.barHeight ?? 24, st - 2));
  const nd = { step: niceStep(vmax, Math.max(2, Math.round((halfW - endPad) / 85))) };
  const dmax = spec.xDomain ? spec.xDomain[1] : vmax * 1.02;
  const len = linear(0, dmax, 0, halfW - endPad);
  const yOf = (i) => plotTop + i * st + (st - bh) / 2;

  const body = [];
  const tf = fmt.tick(nd.step);
  const tsize = theme.type?.axis ?? 11.5;
  const ticks = len.ticks(nd.step).filter((t) => t <= dmax + 1e-9 && len(t) + measure(tf(t), tsize) / 2 <= halfW + 2);
  const gridParts = [];
  for (const t of ticks) {
    for (const [x, anchor] of [[cx0 - len(t), 'middle'], [cx1 + len(t), 'middle']]) {
      const px = Math.round(x) + 0.5;
      gridParts.push(el('line', { x1: px, x2: px, y1: plotTop - 4, y2: plotTop + plotH, stroke: t === 0 ? theme.axis : theme.grid, strokeWidth: 1, shapeRendering: 'crispEdges' }));
      if (t === 0 && anchor) continue;
      gridParts.push(text(px, plotTop + plotH + 16, tf(t), { fill: theme.muted, fontSize: theme.type?.axis ?? 11.5, textAnchor: anchor }));
    }
  }
  body.push(g({ class: 'pa-grid' }, gridParts));

  const sideTot = (s) => ages.reduce((a, ag) => a + (cur.get(ag + '\u0000' + s) || 0), 0);
  sides.forEach((s, k) => {
    const lab = s;
    const sh = share(sideTot(s)) ;
    const hx = k === 0 ? cx0 - 2 : cx1 + 2;
    const anchor = k === 0 ? 'end' : 'start';
    const tw = measure(lab, 13, 600);
    body.push(text(hx, area.y + 14, lab, { fill: readable(colorOf(s), theme), fontSize: 13, fontWeight: 600, textAnchor: anchor }));
    body.push(text(k === 0 ? hx - tw - 6 : hx + tw + 6, area.y + 14, sh, { fill: theme.muted, fontSize: 12, textAnchor: anchor }));
  });

  top.forEach((a, i) => {
    const y = yOf(i);
    body.push(text((cx0 + cx1) / 2, y + bh / 2 + ageSize * 0.36, a, { fill: theme.lede, fontSize: ageSize, fontWeight: 500, textAnchor: 'middle' }));
    sides.forEach((s, k) => {
      const v = V(a, s);
      const w = len(Math.min(v, dmax));
      const c = colorOf(s);
      const x = k === 0 ? cx0 - w : cx1;
      const d = barPath(x, y, w, bh, k === 0 ? 'left' : 'right', Math.min(3.5, bh / 2));
      const cv = C(a, s);
      const lines = [`${a} · ${s}`, fmt(v) + (pct ? '' : ` · ${share(v)}`)];
      if (Number.isFinite(cv)) lines.push(`${cmpLabel}: ${fmt(cv)}`);
      const parts = [el('rect', { x: k === 0 ? area.x : cx1, y: plotTop + i * st, width: halfW, height: st, fill: 'transparent' })];
      if (d) parts.push(el('path', { d, fill: c }));
      if (labelsOn && v > 0) {
        const lab = fmt(v);
        parts.push(text(k === 0 ? x - 5 : x + w + 5, y + bh / 2 + 4, lab, { fill: theme.lede, fontSize: 11, fontWeight: 500, textAnchor: k === 0 ? 'end' : 'start' }));
      }
      body.push(g({ class: 'pa-m', 'data-tip': tip(...lines) }, parts));
    });
  });

  if (cmp) {
    sides.forEach((s, k) => {
      let d = '';
      top.forEach((a, i) => {
        const cv = C(a, s);
        if (!Number.isFinite(cv)) return;
        const x = k === 0 ? cx0 - len(Math.min(cv, dmax)) : cx1 + len(Math.min(cv, dmax));
        const y0 = plotTop + i * st, y1 = y0 + st;
        d += (d ? `L${x.toFixed(1)},${y0.toFixed(1)}` : `M${(k === 0 ? cx0 : cx1).toFixed(1)},${y0.toFixed(1)}L${x.toFixed(1)},${y0.toFixed(1)}`) + `L${x.toFixed(1)},${y1.toFixed(1)}`;
      });
      if (d) {
        d += `L${(k === 0 ? cx0 : cx1).toFixed(1)},${(plotTop + n * st).toFixed(1)}`;
        body.push(el('path', { d, fill: 'none', stroke: theme.ink, strokeWidth: 1.5, strokeLinejoin: 'round', opacity: 0.85, class: 'pa-compare' }));
      }
    });
  }

  const en = String(locale).startsWith('en');
  let big = null;
  for (const a of ages) for (const s of sides) { const v = cur.get(a + '\u0000' + s) || 0; if (!big || v > big[2]) big = [a, s, v]; }
  const desc = (en ? 'Population pyramid. ' : 'Pirámide de población. ')
    + sides.map((s) => `${s} ${share(sideTot(s))}`).join(', ') + '. '
    + (big ? (en ? `Largest group: ${big[0]} (${big[1]}), ${fmt(pct ? big[2] / total : big[2])}.` : `Grupo más numeroso: ${big[0]} (${big[1]}), ${fmt(pct ? big[2] / total : big[2])}.`) : '');
  return frame.finish(body, { desc, type: 'pyramid' });
}

return { "pyramid": pyramid };
});
__def("src/charts/flowchart.js", function () {
const { el, g, text, tip } = __req("src/svg.js");
const { measure, wrap } = __req("src/text.js");
const { colorMap, readable, textOn, hexToRgb, rgbToHex } = __req("src/theme.js");
const { ensureData, uniq, PlotError } = __req("src/data.js");
const { createFrame, hash } = __req("src/frame.js");

const T = (en, es, locale) => (String(locale || 'es').startsWith('en') ? en : es);
const FS = 12.5, LH = 16, EDGE_FS = 11;
const mix = (a, b, t) => { const A = hexToRgb(a), B = hexToRgb(b); return rgbToHex(A.map((v, i) => v + (B[i] - v) * t)); };

function flowchart(spec, theme) {
  const locale = spec.locale || 'es';
  const en = String(locale).startsWith('en');

  const edgeRows = spec.edges ? ensureData({ data: spec.edges }) : spec.data ? ensureData(spec) : [];
  const ff = spec.from ?? (edgeRows[0] && ('from' in edgeRows[0] ? 'from' : 'source' in edgeRows[0] ? 'source' : 'from'));
  const tf = spec.to ?? (edgeRows[0] && ('to' in edgeRows[0] ? 'to' : 'target' in edgeRows[0] ? 'target' : 'to'));
  const lf = spec.edgeLabel ?? 'label';
  const nodeRows = spec.nodes ? ensureData({ data: spec.nodes }) : [];
  const idF = spec.id ?? 'id';
  const nodes = new Map();
  for (const r of nodeRows) {
    const id = String(r[idF] ?? r.label);
    nodes.set(id, { id, label: String(r.label ?? r.name ?? id), type: String(r.type || 'process').toLowerCase(), lane: r.lane ?? r[spec.lane] ?? null, group: r.group ?? r[spec.group] ?? null, detail: r.detail ?? r.description ?? '' });
  }
  const edges = [];
  for (const r of edgeRows) {
    const a = r[ff], b = r[tf];
    if (a === undefined || b === undefined || a === null || b === null) continue;
    for (const id of [String(a), String(b)]) if (!nodes.has(id)) nodes.set(id, { id, label: id, type: 'process', lane: null, group: null, detail: '' });
    edges.push({ s: String(a), t: String(b), label: r[lf] != null ? String(r[lf]) : '' });
  }
  if (!nodes.size) throw new PlotError(T('The flow chart has no nodes.', 'El diagrama de flujo no tiene nodos.', locale), T('Pass `nodes: [{ id, label, type }]` and `data: [{ from, to }]`.', 'Entrega `nodes: [{ id, label, type }]` y `data: [{ from, to }]`.', locale));
  const N = [...nodes.values()];
  const out = new Map(N.map((n) => [n.id, []])), inc = new Map(N.map((n) => [n.id, []]));
  for (const e of edges) { out.get(e.s).push(e); inc.get(e.t).push(e); }

  const state = new Map();
  const roots = N.filter((n) => !inc.get(n.id).length);
  const visit = (id) => {
    state.set(id, 1);
    for (const e of out.get(id)) {
      const st = state.get(e.t);
      if (st === 1) e.back = true;
      else if (!st) visit(e.t);
    }
    state.set(id, 2);
  };
  for (const n of [...roots, ...N]) if (!state.get(n.id)) visit(n.id);
  const fwd = edges.filter((e) => !e.back && e.s !== e.t);

  const layer = new Map(N.map((n) => [n.id, 0]));
  for (let it = 0; it < N.length; it++) {
    let ch = false;
    for (const e of fwd) if (layer.get(e.t) < layer.get(e.s) + 1) { layer.set(e.t, layer.get(e.s) + 1); ch = true; }
    if (!ch) break;
  }
  for (const n of N) if (!inc.get(n.id).length && out.get(n.id).length && n.type !== 'start') {
    const m = Math.min(...out.get(n.id).filter((e) => !e.back).map((e) => layer.get(e.t)));
    if (Number.isFinite(m)) layer.set(n.id, Math.max(0, m - 1));
  }
  const L = Math.max(...layer.values()) + 1;

  const laneKeys = spec.lanes ?? uniq(N.map((n) => n.lane).filter((v) => v !== null && v !== undefined && v !== '').map(String));
  const hasLanes = laneKeys.length > 0 && spec.swimlanes !== false;
  const laneOf = (n) => (hasLanes ? Math.max(0, laneKeys.indexOf(String(n.lane ?? laneKeys[0]))) : 0);
  const layers = Array.from({ length: L }, () => []);
  for (const n of N) layers[layer.get(n.id)].push(n);
  const pos = new Map();
  const reindex = () => layers.forEach((ls) => ls.forEach((n, i) => pos.set(n.id, laneOf(n) * 1000 + i)));
  layers.forEach((ls) => ls.sort((a, b) => laneOf(a) - laneOf(b)));
  reindex();
  const bary = (n, nbrs) => { const ps = nbrs.map((id) => pos.get(id)).filter((v) => v !== undefined); return ps.length ? ps.reduce((a, b) => a + b, 0) / ps.length : pos.get(n.id); };
  for (let sweep = 0; sweep < 6; sweep++) {
    for (let l = 1; l < L; l++) { layers[l].sort((a, b) => laneOf(a) - laneOf(b) || bary(a, inc.get(a.id).filter((e) => !e.back).map((e) => e.s)) - bary(b, inc.get(b.id).filter((e) => !e.back).map((e) => e.s))); reindex(); }
    for (let l = L - 2; l >= 0; l--) { layers[l].sort((a, b) => laneOf(a) - laneOf(b) || bary(a, out.get(a.id).filter((e) => !e.back).map((e) => e.t)) - bary(b, out.get(b.id).filter((e) => !e.back).map((e) => e.t))); reindex(); }
  }

  const groupKeys = uniq(N.map((n) => n.group).filter((v) => v !== null && v !== undefined && v !== '').map(String));
  const cmap = groupKeys.length ? colorMap(groupKeys, theme, spec.colors) : null;
  const colorOf = (n) => (cmap && n.group != null ? cmap.get(String(n.group)) : null);
  const legend = cmap && spec.legend !== false && groupKeys.length > 1 ? groupKeys.map((k) => ({ label: k, color: cmap.get(k), shape: 'square' })) : [];

  const frame = createFrame(spec, theme, { height: 520 });
  let area = frame.layout(legend);
  const backs = edges.filter((e) => e.back || e.s === e.t);
  const relPos = (n) => { const ls = layers[layer.get(n.id)]; return hasLanes ? (laneOf(n) + 0.5) / laneKeys.length : (ls.indexOf(n) + 0.5) / ls.length; };
  for (const e of backs) e.side = (relPos(nodes.get(e.s)) + relPos(nodes.get(e.t))) / 2 < 0.5 ? -1 : 1;
  const nBackL = backs.filter((e) => e.side < 0).length, nBackR = backs.length - nBackL;

  const maxPerCell = (lane) => Math.max(1, ...layers.map((ls) => ls.filter((n) => laneOf(n) === lane).length));
  const roomL = nBackL ? 16 + nBackL * 9 : 0, roomR = nBackR ? 16 + nBackR * 9 : 0;
  const backRoom = roomL + roomR;
  const lrColW = area.w / L;
  const longestWord = Math.max(...N.map((n) => Math.max(...String(n.label).split(/\s+/).map((w) => measure(w, FS, 600)))));
  const dir = spec.direction ? String(spec.direction).toUpperCase() : L <= 6 && lrColW - 46 >= Math.max(hasLanes ? 110 : 80, longestWord + 26) ? 'LR' : 'TB';
  const TB = dir !== 'LR' || lrColW < 60;
  const gapU = TB ? 40 : Math.max(20, Math.min(46, lrColW - 64));
  const gapV = area.w < 480 ? 10 : 18; // entre nodos de una misma capa
  let laneHead = hasLanes ? 26 : 0;
  const lanePad = hasLanes ? (area.w < 480 ? 5 : 10) : 0;
  const nLanes = hasLanes ? laneKeys.length : 1;

  const laneBand = []; // límites del carril en el eje transversal (v)
  const laneW = []; // ancho de nodo por carril (o uno global)
  const maxW = spec.nodeWidth ?? (TB ? 220 : 200);
  if (TB) {
    const crossW = area.w - backRoom;
    const x0 = area.x + roomL;
    if (hasLanes) {
      const wts = laneKeys.map((_, k) => 1 + 0.75 * (maxPerCell(k) - 1));
      const unit = crossW / wts.reduce((a, b) => a + b, 0);
      let bx = x0;
      for (let k = 0; k < nLanes; k++) {
        const bw = unit * wts[k];
        laneBand.push([bx + 3, bx + bw - 3]);
        bx += bw;
        const c = maxPerCell(k);
        laneW.push(Math.min(maxW, (bw - 6 - 2 * lanePad - (c - 1) * gapV) / c));
      }
    } else {
      const C = Math.max(...layers.map((l) => l.length));
      laneW.push(Math.min(maxW, (crossW - (C - 1) * gapV) / C));
    }
  } else {
    laneW.push(Math.max(40, Math.min(maxW, lrColW - gapU)));
  }
  const widthOf = (n) => (TB ? Math.max(64, hasLanes ? laneW[laneOf(n)] : laneW[0]) : laneW[0]);
  const laneTitleLines = hasLanes ? laneKeys.map((k, i) => (TB ? wrap(k, laneBand[i][1] - laneBand[i][0] - 12, 12, 600, 2) : [k])) : [];
  if (hasLanes && TB) laneHead = laneTitleLines.some((l) => l.length > 1) ? 40 : 26;

  for (const n of N) {
    const isDec = n.type === 'decision';
    const w = widthOf(n);
    const tw = Math.max(30, isDec ? w * 0.64 : n.type === 'data' ? w - 34 : w - 22);
    const wt = n.type === 'start' || n.type === 'end' ? 600 : 500;
    const twSafe = tw * 0.92;
    const longest = Math.max(...String(n.label).split(/\s+/).map((wd) => measure(wd, FS, wt)));
    n.fs = longest > twSafe ? Math.max(9.5, FS * (twSafe / longest)) : FS;
    n.lh = Math.round(n.fs * 1.3);
    n.lines = wrap(n.label, twSafe, n.fs, wt);
    const th = n.lines.length * n.lh;
    n.w = w;
    n.h = isDec ? Math.max(58, Math.ceil(th / 0.4) + 4) : Math.max(n.type === 'start' || n.type === 'end' ? 36 : 42, th + 20);
  }

  const fu = (n) => (TB ? n.h : n.w), fv = (n) => (TB ? n.w : n.h);
  const rowSize = layers.map((ls) => Math.max(0, ...ls.map(fu)));
  const u0 = TB ? area.y + laneHead : area.x;
  const rowStart = [];
  let acc = u0;
  for (let l = 0; l < L; l++) { rowStart.push(acc); acc += rowSize[l] + gapU; }
  const contentU = acc - gapU - u0;
  for (let l = 0; l < L; l++) for (const n of layers[l]) n.u0 = rowStart[l] + (rowSize[l] - fu(n)) / 2;

  if (TB) {
    if (hasLanes) {
      for (let l = 0; l < L; l++) for (let k = 0; k < nLanes; k++) {
        const cell = layers[l].filter((n) => laneOf(n) === k);
        const [b0, b1] = laneBand[k];
        const slot = (b1 - b0) / Math.max(1, cell.length);
        cell.forEach((n, i) => { n.vc = b0 + slot * (i + 0.5); });
      }
    } else {
      const C = Math.max(...layers.map((l) => l.length));
      const crossW = area.w - backRoom;
      const slot = crossW / C;
      for (const ls of layers) ls.forEach((n, i) => { n.vc = area.x + roomL + slot * ((C - ls.length) / 2 + i + 0.5); });
    }
  } else {
    const cellH = (k) => Math.max(0, ...layers.map((ls) => { const c = ls.filter((n) => laneOf(n) === k); return c.reduce((a, n) => a + n.h, 0) + Math.max(0, c.length - 1) * gapV; }));
    let v = area.y + roomL;
    for (let k = 0; k < nLanes; k++) {
      const h = cellH(k) + 2 * lanePad + laneHead;
      laneBand.push([v, v + h]);
      v += h + (hasLanes ? 6 : 0);
    }
    for (let l = 0; l < L; l++) for (let k = 0; k < nLanes; k++) {
      const cell = layers[l].filter((n) => laneOf(n) === k);
      const [b0, b1] = laneBand[k];
      const inner0 = b0 + laneHead + lanePad, inner1 = b1 - lanePad;
      const tot = cell.reduce((a, n) => a + n.h, 0) + Math.max(0, cell.length - 1) * gapV;
      let y = (inner0 + inner1) / 2 - tot / 2;
      cell.forEach((n) => { n.vc = y + n.h / 2; y += n.h + gapV; });
    }
  }
  for (const n of N) { n.u1 = n.u0 + fu(n); n.uc = (n.u0 + n.u1) / 2; n.v0 = n.vc - fv(n) / 2; n.v1 = n.vc + fv(n) / 2; }

  const contentBottom = TB ? u0 + contentU : Math.max(...laneBand.map((b) => b[1]));
  const extraBack = !TB ? roomR : 0;
  if (spec.height === undefined) {
    frame.setHeight(contentBottom + extraBack + 8 + frame.chrome);
    area = { ...area, h: frame.bottom - area.y };
  }
  const P = (u, v) => (TB ? [v, u] : [u, v]); // abstracto → pantalla

  const free = (v, l, pad = 8) => layers[l].every((n) => v < n.v0 - pad || v > n.v1 + pad);
  const corridorCandidates = (s, t) => {
    const c = [t.vc, s.vc];
    const allV = N.flatMap((n) => [n.v0 - gapV / 2, n.v1 + gapV / 2]);
    c.push(...allV.sort((a, b) => Math.abs(a - (s.vc + t.vc) / 2) - Math.abs(b - (s.vc + t.vc) / 2)));
    return c;
  };
  let maxV = Math.max(...N.map((n) => n.v1)), minV = Math.min(...N.map((n) => n.v0));
  if (hasLanes) { maxV = Math.max(maxV, laneBand[laneBand.length - 1][1]); minV = Math.min(minV, laneBand[0][0]); }
  const routes = [];
  let kL = 0, kR = 0;
  for (const e of edges) {
    const s = nodes.get(e.s), t = nodes.get(e.t);
    let pts;
    if (e.back || e.s === e.t) {
      const vb = e.side < 0 ? minV - 10 - 9 * kL++ : maxV + 10 + 9 * kR++;
      const ls = layer.get(e.s), lt = layer.get(e.t);
      const ugS = rowStart[ls] + rowSize[ls] + gapU / 2;
      const ugT = rowStart[lt] - gapU / 2;
      void ugT;
      pts = [[s.u1, s.vc], [ugS, s.vc], [ugS, vb], [t.uc, vb], [t.uc, e.side < 0 ? t.v0 : t.v1]];
      routes.push({ e, pts: simplify(pts), back: true });
      continue;
    }
    const ls = layer.get(e.s), lt = layer.get(e.t);
    const ugS = rowStart[ls] + rowSize[ls] + gapU / 2;
    const ugT = rowStart[lt] - gapU / 2;
    const fwdOut = out.get(s.id).filter((x) => !x.back && x.s !== x.t);
    const main = fwdOut.find((x) => layer.get(x.t) === ls + 1 && Math.abs(nodes.get(x.t).vc - s.vc) < 1) || null;
    const side = s.type === 'decision' && fwdOut.length > 1 && main !== e;
    const between = (v) => { for (let l = ls + 1; l < lt; l++) if (!free(v, l)) return false; return true; };
    if (side && Math.abs(t.vc - s.vc) < 1) {
      const dirV = layers[ls].some((n) => n !== s && n.vc < s.vc) ? 1 : -1;
      const sv = dirV > 0 ? s.v1 : s.v0;
      const lanesEdge = hasLanes ? laneBand[laneOf(s)] : null;
      let vc = sv + dirV * 22;
      if (lanesEdge) vc = dirV > 0 ? Math.min(vc, lanesEdge[1] - 6) : Math.max(vc, lanesEdge[0] + 6);
      const ok = (v) => { for (let l = ls + 1; l < lt; l++) if (!free(v, l, 6)) return false; return true; };
      if (!ok(vc)) vc = corridorCandidates(s, t).find((v) => ok(v) && Math.sign(v - s.vc) === dirV) ?? (dirV > 0 ? maxV + 12 : minV - 12);
      pts = [[s.uc, sv], [s.uc, vc], [ugT, vc], [ugT, t.vc], [t.u0, t.vc]];
    } else if (side) {
      const sv = t.vc > s.vc ? s.v1 : s.v0;
      if (between(t.vc)) {
        pts = [[s.uc, sv], [s.uc, t.vc], [t.u0, t.vc]];
        const hit = layers[ls].some((n) => n !== s && Math.min(sv, t.vc) < n.v1 && Math.max(sv, t.vc) > n.v0);
        if (hit) pts = [[s.uc, sv], [s.uc, sv + (t.vc > s.vc ? 12 : -12)], [ugS, sv + (t.vc > s.vc ? 12 : -12)], [ugS, t.vc], [t.u0, t.vc]];
      }
    }
    if (!pts) {
      if (lt === ls + 1) {
        pts = Math.abs(s.vc - t.vc) < 1 ? [[s.u1, s.vc], [t.u0, t.vc]] : [[s.u1, s.vc], [ugS, s.vc], [ugS, t.vc], [t.u0, t.vc]];
      } else {
        const vc = corridorCandidates(s, t).find(between) ?? maxV + 14;
        pts = [[s.u1, s.vc], [ugS, s.vc], [ugS, vc], [ugT, vc], [ugT, t.vc], [t.u0, t.vc]];
      }
    }
    routes.push({ e, pts: simplify(pts), back: false });
  }

  const body = [];
  const mid = 'pa-arrow-' + Math.abs(hash(String(spec.title) + N.length + area.w)).toString(36);
  const edgeColor = theme.muted;
  const defs = `<marker id="${mid}" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="10" markerHeight="10" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M1,1.5L9,5L1,8.5Z" fill="${edgeColor}"/></marker>`;

  if (hasLanes) {
    const parts = [];
    laneKeys.forEach((k, i) => {
      const [b0, b1] = laneBand[i];
      if (TB) {
        const y0 = area.y, y1 = contentBottom + (backs.length ? 0 : 0) + 6;
        parts.push(el('rect', { x: b0, y: y0, width: b1 - b0, height: y1 - y0, rx: 10, fill: theme.tint, opacity: 0.7 }));
        laneTitleLines[i].forEach((ln, j) => parts.push(text((b0 + b1) / 2, y0 + 17 + j * 14, ln, { fill: theme.lede, fontSize: 12, fontWeight: 600, textAnchor: 'middle' })));
      } else {
        const x0 = area.x, x1 = area.x + area.w;
        parts.push(el('rect', { x: x0, y: b0, width: x1 - x0, height: b1 - b0, rx: 10, fill: theme.tint, opacity: 0.7 }));
        parts.push(text(x0 + 12, b0 + 17, k, { fill: theme.lede, fontSize: 12, fontWeight: 600 }));
      }
    });
    body.push(g({ class: 'pa-lanes' }, parts));
  }

  const edgeParts = [], labelParts = [];
  for (const r of routes) {
    const screen = r.pts.map(([u, v]) => P(u, v));
    edgeParts.push(el('path', { d: roundPath(screen, 8), fill: 'none', stroke: edgeColor, strokeWidth: 1.4, strokeLinejoin: 'round', markerEnd: `url(#${mid})` }));
    if (r.e.label) {
      let best = 0, bl = -1;
      for (let i = 0; i < Math.min(2, screen.length - 1); i++) {
        const l = Math.hypot(screen[i + 1][0] - screen[i][0], screen[i + 1][1] - screen[i][1]);
        if (l > bl) { bl = l; best = i; }
      }
      const [ax, ay] = screen[best], [bx, by] = screen[best + 1];
      const t = bl > 70 ? 0.4 : 0.5;
      const lx = ax + (bx - ax) * t, ly = ay + (by - ay) * t;
      const w = measure(r.e.label, EDGE_FS, 600) + 12;
      labelParts.push(g({ class: 'pa-edge-label' }, [
        el('rect', { x: lx - w / 2, y: ly - 9, width: w, height: 18, rx: 9, fill: theme.surface, stroke: theme.grid, strokeWidth: 1 }),
        text(lx, ly + 4, r.e.label, { fill: theme.lede, fontSize: EDGE_FS, fontWeight: 600, textAnchor: 'middle' }),
      ]));
    }
  }
  body.push(g({ class: 'pa-edges' }, edgeParts));

  const nodeParts = [];
  for (const n of N) {
    const [x, y] = TB ? [n.v0, n.u0] : [n.u0, n.v0];
    const c = colorOf(n);
    const neutral = theme.ink;
    let shape, fill = theme.surface, stroke = c || (theme.mode === 'dark' ? theme.lede : theme.lede), sw = 1.5, tcol = theme.ink;
    if (n.type === 'start' || n.type === 'end') {
      fill = c || neutral; stroke = 'none'; tcol = textOn(fill, theme);
      shape = el('rect', { x, y, width: n.w, height: n.h, rx: n.h / 2, fill, stroke });
    } else if (n.type === 'decision') {
      stroke = c || theme.categorical[0];
      fill = mix(theme.surface, stroke, theme.mode === 'dark' ? 0.16 : 0.07);
      shape = el('path', { d: `M${x + n.w / 2},${y}L${x + n.w},${y + n.h / 2}L${x + n.w / 2},${y + n.h}L${x},${y + n.h / 2}Z`, fill, stroke, strokeWidth: sw, strokeLinejoin: 'round' });
    } else if (n.type === 'data') {
      const k = 10;
      shape = el('path', { d: `M${x + k},${y}H${x + n.w}L${x + n.w - k},${y + n.h}H${x}Z`, fill, stroke, strokeWidth: sw, strokeLinejoin: 'round' });
    } else if (n.type === 'note') {
      fill = c ? mix(theme.surface, c, 0.12) : theme.tint2; stroke = 'none'; tcol = theme.lede;
      shape = el('rect', { x, y, width: n.w, height: n.h, rx: 6, fill });
    } else {
      fill = c ? mix(theme.surface, c, theme.mode === 'dark' ? 0.14 : 0.06) : theme.surface;
      shape = el('rect', { x, y, width: n.w, height: n.h, rx: 9, fill, stroke, strokeWidth: sw });
    }
    const bold = n.type === 'start' || n.type === 'end' ? 600 : 500;
    const ty0 = y + n.h / 2 - (n.lines.length * n.lh) / 2 + n.lh * 0.74;
    const texts = n.lines.map((l, i) => text(x + n.w / 2, ty0 + i * n.lh, l, { fill: tcol, fontSize: n.fs, fontWeight: bold, textAnchor: 'middle' }));
    const kind = { start: T('Start', 'Inicio', locale), end: T('End', 'Fin', locale), decision: T('Decision', 'Decisión', locale), data: T('Data', 'Dato', locale), note: T('Note', 'Nota', locale), process: T('Step', 'Paso', locale) }[n.type] || '';
    nodeParts.push(g({ class: 'pa-m', 'data-tip': tip(n.label, n.detail, [kind, n.lane, n.group].filter(Boolean).join(' · ')) }, [shape, ...texts]));
  }
  body.push(g({ class: 'pa-nodes' }, nodeParts));
  body.push(g({}, labelParts));
  void readable;

  const decisions = N.filter((n) => n.type === 'decision').length;
  const desc = en
    ? `Flow chart with ${N.length} steps${decisions ? `, ${decisions} decisions` : ''}${hasLanes ? ` across ${nLanes} lanes (${laneKeys.join(', ')})` : ''}. Starts at "${(roots[0] || N[0]).label}".`
    : `Diagrama de flujo con ${N.length} pasos${decisions ? `, ${decisions} decisiones` : ''}${hasLanes ? ` en ${nLanes} carriles (${laneKeys.join(', ')})` : ''}. Comienza en "${(roots[0] || N[0]).label}".`;
  const svg = frame.finish(body, { desc, type: 'flowchart', defs });
  if (spec._layout) Object.assign(spec._layout, { direction: TB ? 'TB' : 'LR', nodes: N.map((n) => { const [x, y] = TB ? [n.v0, n.u0] : [n.u0, n.v0]; return { id: n.id, x, y, w: n.w, h: n.h }; }) });
  return svg;
}

function simplify(pts) {
  const out = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (last && Math.abs(last[0] - p[0]) < 0.5 && Math.abs(last[1] - p[1]) < 0.5) continue;
    out.push(p);
  }
  return out.filter((p, i) => {
    if (i === 0 || i === out.length - 1) return true;
    const a = out[i - 1], b = out[i + 1];
    return !((Math.abs(a[0] - p[0]) < 0.5 && Math.abs(p[0] - b[0]) < 0.5) || (Math.abs(a[1] - p[1]) < 0.5 && Math.abs(p[1] - b[1]) < 0.5));
  });
}

/** Polilínea con esquinas redondeadas. */
function roundPath(pts, r) {
  if (pts.length < 2) return '';
  const f = (n) => n.toFixed(1);
  let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
    const l1 = Math.hypot(x1 - x0, y1 - y0), l2 = Math.hypot(x2 - x1, y2 - y1);
    const rr = Math.min(r, l1 / 2, l2 / 2);
    const ax = x1 - ((x1 - x0) / l1) * rr, ay = y1 - ((y1 - y0) / l1) * rr;
    const bx = x1 + ((x2 - x1) / l2) * rr, by = y1 + ((y2 - y1) / l2) * rr;
    d += `L${f(ax)},${f(ay)}Q${f(x1)},${f(y1)} ${f(bx)},${f(by)}`;
  }
  const [lx, ly] = pts[pts.length - 1];
  return d + `L${f(lx)},${f(ly)}`;
}

return { "flowchart": flowchart };
});
__def("src/charts/choropleth.js", function () {
const { el, g, text } = __req("src/svg.js");
const { measure, truncate } = __req("src/text.js");
const { makeFormat } = __req("src/format.js");
const { ramp, textOn } = __req("src/theme.js");
const { ensureData, requireField, num, fieldsOf, fieldKind, humanize, aggregate } = __req("src/data.js");
const { createFrame, hash } = __req("src/frame.js");
const { niceStep } = __req("src/scale.js");
const { getGeo } = __req("src/geo/registry.js");
const { mercator, equalEarth, projections, fit, aspectOf, pathD, centroid, rings } = __req("src/geo/projection.js");
const { dashedMatcher, hatcher, dashedAttrs, dashedDefaultLabel, DASH } = __req("src/dashed.js");

const T = (locale, es, en) => (String(locale || 'es').startsWith('en') ? en : es);

/** Normaliza nombres para que "Región del Bío-Bío", "Biobio" y "BIOBÍO" coincidan. */
function normKey(s) {
  return String(s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/^\s*(region|provincia|comuna)\s+(metropolitana\s+de\s+)?(de\s+la\s+|del\s+|de\s+los\s+|de\s+las\s+|de\s+)?/, (m, a, metro) => (metro ? 'metropolitana' : ''))
    .replace(/[^a-z0-9]/g, '');
}

function featureIndex(features, featureKey) {
  const idx = new Map();
  const add = (k, f) => { const n = normKey(k); if (n && !idx.has(n)) idx.set(n, f); };
  for (const f of features) {
    const p = f.properties || {};
    if (featureKey) { add(p[featureKey], f); continue; }
    for (const k of ['code', 'num', 'id', 'iso3', 'iso_a3', 'name', 'nameEn', 'NAME', 'nombre']) if (p[k] !== undefined && p[k] !== null) add(p[k], f);
    for (const a of p.aliases || []) add(a, f);
  }
  return idx;
}

const nameOf = (f, locale) => {
  const p = f.properties || {};
  return (String(locale).startsWith('en') ? p.nameEn || p.name : p.name || p.nameEn) || p.NAME || p.nombre || String(p.code ?? p.id ?? '');
};

/** Redondeo "bonito" de un corte de clase (2 cifras relativas al rango). */
function niceRound(v, range) {
  if (!range) return v;
  const step = 10 ** (Math.floor(Math.log10(range)) - 1);
  return Math.round(v / step) * step;
}

function quantile(sorted, p) {
  const h = (sorted.length - 1) * p, lo = Math.floor(h), hi = Math.ceil(h);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (h - lo);
}

/** Escala de color: clases (cuantiles, intervalos iguales o cortes dados) o continua. */
function colorScale(values, spec, theme) {
  const v = values.filter(Number.isFinite).sort((a, b) => a - b);
  const min = v[0], max = v[v.length - 1], range = max - min;
  const mid = spec.midpoint ?? (spec.diverging ? 0 : undefined);
  const mode = Array.isArray(spec.scale) || Array.isArray(spec.thresholds) ? 'thresholds' : spec.scale || 'quantile';
  if (mid !== undefined) {
    const stops = theme.diverging;
    const dev = Math.max(Math.abs(max - mid), Math.abs(min - mid)) || 1;
    if (mode === 'continuous') return { mode, min: mid - dev, max: mid + dev, mid, color: (x) => ramp(stops, 0.5 + (x - mid) / dev / 2), stops };
    const perSide = Math.max(2, Math.floor((spec.classes ?? 6) / 2));
    const mag = 10 ** Math.floor(Math.log10(dev / perSide));
    const step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((st) => Math.ceil(dev / st - 1e-9) <= perSide) || 10 * mag;
    const k = Math.max(1, Math.ceil(dev / step - 1e-9));
    const breaks = Array.from({ length: 2 * k - 1 }, (_, j) => +(mid + step * (j + 1 - k)).toPrecision(12));
    const n = 2 * k;
    const colors = Array.from({ length: n }, (_, i) => ramp(stops, 0.5 + ((i + 0.5 - k) / k) * 0.5));
    return { ...classed(breaks, colors, Math.min(min, +(mid - k * step).toPrecision(12)), Math.max(max, +(mid + k * step).toPrecision(12))), mid };
  }
  const stops = theme.sequential;
  if (mode === 'continuous') return { mode, min, max, color: (x) => ramp(stops.slice(1), (x - min) / (range || 1)), stops: stops.slice(1) };
  let breaks;
  if (mode === 'thresholds') breaks = [...(Array.isArray(spec.scale) ? spec.scale : spec.thresholds)].map(Number).sort((a, b) => a - b);
  else {
    const n = Math.max(2, Math.min(9, spec.classes ?? Math.min(5, v.length)));
    if (mode === 'equal') breaks = Array.from({ length: n - 1 }, (_, k) => niceRound(min + (range * (k + 1)) / n, range));
    else breaks = Array.from({ length: n - 1 }, (_, k) => niceRound(quantile(v, (k + 1) / n), range));
    breaks = [...new Set(breaks)].filter((b) => b > min && b <= max);
  }
  const n = breaks.length + 1;
  const t0 = theme.mode === 'dark' ? 0.26 : 0.16;
  const colors = Array.from({ length: n }, (_, i) => ramp(stops, n === 1 ? 0.6 : t0 + ((1 - t0) * i) / (n - 1)));
  return classed(breaks, colors, min, max);
}

function classed(breaks, colors, min, max) {
  const cls = (x) => { let i = 0; while (i < breaks.length && x >= breaks[i]) i++; return i; };
  return { mode: 'classes', breaks, colors, min, max, cls, color: (x) => colors[cls(x)] };
}

/** Leyenda escalonada (o degradado), pegada al mapa. Devuelve { svg, h }. */
function legendBar(sc, x, y, maxW, theme, fmt, { title, missing, locale, gid, dashed }) {
  const out = [];
  let lx = x;
  const size = theme.type?.axis ?? 11.5;
  if (title) {
    const tw = Math.min(measure(title, 12, 500), maxW * 0.4);
    out.push(text(lx, y + 13, truncate(title, tw, 12, 500), { fill: theme.lede, fontSize: 12, fontWeight: 500 }));
    lx += tw + 12;
  }
  const missW = missing ? measure(T(locale, 'Sin dato', 'No data'), size) + 14 + (dashed ? 14 : 0) : 0;
  const dashW = dashed ? measure(dashed.label, size) + 16 : 0;
  const extra = missW + dashW ? 14 + missW + dashW : 0;
  const wrapX = 140 + extra > x + maxW - lx;
  const barW = Math.max(120, Math.min(360, x + maxW - lx - (wrapX ? 0 : extra)));
  const by = y + 4;
  if (sc.mode === 'classes') {
    const n = sc.colors.length, gap = 2;
    const sw = (barW - gap * (n - 1)) / n;
    sc.colors.forEach((c, i) => out.push(g({ class: 'pa-key', 'data-color': c, style: 'cursor:pointer' }, [
      el('rect', { x: lx + i * (sw + gap), y: by - 4, width: sw + gap, height: 18, fill: 'transparent' }),
      el('rect', { x: lx + i * (sw + gap), y: by, width: sw, height: 10, rx: i === 0 || i === n - 1 ? 3 : 1, fill: c }),
    ])));
    const labels = [
      ...(sc.min < sc.breaks[0] || !sc.breaks.length ? [{ x: lx, v: sc.min, anchor: 'start' }] : []),
      ...sc.breaks.map((b, i) => ({ x: lx + (i + 1) * (sw + gap) - gap / 2, v: b, anchor: 'middle' })),
      ...(sc.max >= sc.breaks[sc.breaks.length - 1] || !sc.breaks.length ? [{ x: lx + barW, v: sc.max, anchor: 'end' }] : []),
    ];
    let last = -Infinity;
    for (const L of labels) {
      const s = fmt(L.v), w = measure(s, size);
      const left = L.anchor === 'start' ? L.x : L.anchor === 'end' ? L.x - w : L.x - w / 2;
      if (left < last + 6) continue;
      out.push(text(L.x, by + 24, s, { fill: theme.muted, fontSize: size, textAnchor: L.anchor }));
      last = left + w;
    }
  } else {
    const id = gid + '-grad';
    const stops = Array.from({ length: 9 }, (_, i) => el('stop', { offset: `${i * 12.5}%`, stopColor: sc.color(sc.min + ((sc.max - sc.min) * i) / 8) }));
    out.push(el('defs', {}, el('linearGradient', { id }, stops)));
    out.push(el('rect', { x: lx, y: by, width: barW, height: 10, rx: 3, fill: `url(#${id})` }));
    out.push(text(lx, by + 24, fmt(sc.min), { fill: theme.muted, fontSize: size }));
    if (sc.mid !== undefined) out.push(text(lx + barW / 2, by + 24, fmt(sc.mid), { fill: theme.muted, fontSize: size, textAnchor: 'middle' }));
    out.push(text(lx + barW, by + 24, fmt(sc.max), { fill: theme.muted, fontSize: size, textAnchor: 'end' }));
  }
  let mx = wrapX ? x : lx + barW + 14;
  const ey = wrapX ? by + 32 : by;
  if (missing) {
    out.push(g({ class: 'pa-key', 'data-color': `url(#${gid}-nd)`, style: 'cursor:pointer' }, [
      el('rect', { x: mx, y: ey, width: 10, height: 10, rx: 2, fill: `url(#${gid}-nd)`, stroke: theme.axis, strokeWidth: 0.5 }),
      text(mx + 14, ey + 9, T(locale, 'Sin dato', 'No data'), { fill: theme.muted, fontSize: size }),
    ]));
    mx += missW;
  }
  if (dashed) {
    out.push(g({ class: 'pa-key', 'data-color': 'dashed', style: 'cursor:pointer' }, [
      el('rect', { x: mx + 0.6, y: ey + 0.6, width: 9.8, height: 9.8, rx: 2, fill: dashed.fill, stroke: dashed.stroke, strokeWidth: 1.1, strokeDasharray: DASH.legend }),
      text(mx + 15, ey + 9, dashed.label, { fill: theme.lede, fontSize: size }),
    ]));
  }
  return { svg: g({ class: 'pa-legend pa-map-legend' }, out), h: wrapX && (missing || dashed) ? 50 : 34 };
}

/** Patrón rayado para regiones sin dato. */
const noDataPattern = (id, theme) =>
  `<pattern id="${id}" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" fill="${theme.tint}"/><line x1="0" y1="0" x2="0" y2="5" stroke="${theme.muted}" stroke-width="1" stroke-opacity="0.35"/></pattern>`;

/** Datos + geometría emparejados. */
function prepare(spec, locale) {
  const fc = getGeo(spec.geo ?? 'chile');
  const data = ensureData(spec);
  const fields = fieldsOf(data);
  const key = spec.key ?? spec.region ?? spec.x ?? spec.label ?? fields.find((f) => fieldKind(data, f) === 'category');
  const valueF = spec.value ?? spec.y ?? (typeof spec.size === 'string' ? spec.size : null) ?? fields.find((f) => f !== key && fieldKind(data, f) === 'number');
  requireField(data, key, 'key');
  requireField(data, valueF, 'value');
  let features = fc.features.filter((f) => f.geometry && rings(f.geometry).length);
  if (!spec.antarctica) features = features.filter((f) => (f.properties || {}).iso3 !== 'ATA');
  let idx = featureIndex(features, spec.featureKey);
  if (features.some((f) => f.properties?.optional)) {
    const used = new Set(data.map((r) => idx.get(normKey(r[key]))).filter(Boolean));
    features = features.filter((f) => !f.properties?.optional || used.has(f) || spec.territories === true);
    idx = featureIndex(features, spec.featureKey);
  }
  const buckets = new Map();
  const unmatched = [];
  for (const r of data) {
    const f = idx.get(normKey(r[key]));
    if (!f) { if (r[key] !== undefined && r[key] !== null && r[key] !== '') unmatched.push(String(r[key])); continue; }
    if (!buckets.has(f)) buckets.set(f, []);
    buckets.get(f).push(num(r[valueF]));
  }
  const values = new Map();
  for (const [f, vs] of buckets) { const v = aggregate(vs, spec.aggregate || 'mean'); if (Number.isFinite(v)) values.set(f, v); }
  if (Array.isArray(spec._unmatched)) spec._unmatched.push(...new Set(unmatched));
  const ranked = [...values.entries()].sort((a, b) => b[1] - a[1]);
  const rank = new Map(ranked.map(([f], i) => [f, i + 1]));
  const projName = spec.projection ?? fc.projection ?? (/^(world|mundo|countries|paises|países)$/i.test(String(spec.geo)) ? 'equalEarth' : null);
  const lonSpan = (() => { let a = Infinity, b = -Infinity; for (const f of features) for (const r of rings(f.geometry)) for (const p of r) { if (p[0] < a) a = p[0]; if (p[0] > b) b = p[0]; } return b - a; })();
  const raw = (projName && projections[projName] ? projections[projName] : lonSpan > 100 ? equalEarth : mercator)();
  const dm = dashedMatcher(spec, data, key, null, normKey);
  const dashed = new Set(dm ? features.filter((f) => featureKeys(f).some((k) => dm(k))) : []);
  return { fc, features, values, rank, ranked, unmatched: [...new Set(unmatched)], key, valueF, raw, data, dashed };
}

/**
 * Columna de etiquetas para mapas altos: una fila por región a la altura de
 * su centroide (separadas si chocan), con línea guía, barra y valor.
 */
function labelColumn(items, x, y0, y1, w, theme, fmt, { bars = true, maxV }) {
  const out = [];
  const n = items.length;
  const rowH = Math.max(12.5, Math.min(18, (y1 - y0) / Math.max(1, n)));
  const fs = rowH < 14 ? 10.5 : 11.5;
  const rows = items.map((it) => ({ ...it, y: it.cy })).sort((a, b) => a.cy - b.cy);
  for (let i = 0; i < rows.length; i++) rows[i].y = Math.max(rows[i].y, i ? rows[i - 1].y + rowH : y0 + rowH / 2);
  for (let i = rows.length - 1; i >= 0; i--) { const lim = i === rows.length - 1 ? y1 - rowH / 2 : rows[i + 1].y - rowH; if (rows[i].y > lim) rows[i].y = lim; }
  for (let i = 0; i < rows.length; i++) if (rows[i].y < y0 + rowH / 2 + i * rowH) rows[i].y = y0 + rowH / 2 + i * rowH;
  const nameW = Math.min(w * (bars ? 0.46 : 0.68), Math.max(...rows.map((r) => measure(r.name, fs))));
  const valW = Math.max(...rows.map((r) => measure(r.label, fs, 600)));
  const barX = x + nameW + 8;
  const diverging = rows.some((r) => r.v < 0);
  const barMax = Math.max(0, w - nameW - valW * (diverging ? 2 : 1) - (diverging ? 26 : 18));
  const showBars = bars && barMax >= 36;
  const negMax = diverging ? Math.max(0, ...rows.filter((r) => r.v < 0).map((r) => -r.v)) : 0;
  const posMax = Math.max(0, ...rows.filter((r) => r.v > 0).map((r) => r.v));
  const zeroX = diverging ? barX + valW + 6 + (barMax * negMax) / (negMax + posMax || 1) : barX;
  const scaleW = diverging ? barMax / (negMax + posMax || 1) : barMax / (maxV || 1);
  if (showBars && diverging) out.push(el('line', { x1: zeroX, x2: zeroX, y1: y0, y2: y1, stroke: theme.axis, strokeWidth: 1 }));
  for (const r of rows) {
    const parts = [];
    parts.push(el('path', { d: `M${r.cx.toFixed(1)},${r.cy.toFixed(1)}L${(x - 14).toFixed(1)},${r.cy.toFixed(1)}L${(x - 4).toFixed(1)},${r.y.toFixed(1)}`, fill: 'none', stroke: theme.muted, strokeWidth: 0.6, opacity: 0.55 }));
    parts.push(el('circle', { cx: r.cx, cy: r.cy, r: 1.8, fill: theme.ink, opacity: 0.7 }));
    parts.push(text(x, r.y + fs * 0.36, truncate(r.name, nameW, fs), { fill: r.missing ? theme.muted : theme.lede, fontSize: fs }));
    if (r.missing) parts.push(text(showBars ? barX : x + nameW + 8, r.y + fs * 0.36, r.label, { fill: theme.muted, fontSize: fs }));
    else if (showBars) {
      const bw = Math.max(2, Math.abs(r.v) * scaleW);
      const bx = r.v < 0 ? zeroX - bw : zeroX;
      parts.push(el('rect', { x: bx, y: r.y - 3.5, width: bw, height: 7, rx: 2, fill: r.barColor || r.color }));
      parts.push(text(r.v < 0 ? bx - 6 : bx + bw + 6, r.y + fs * 0.36, r.label, { fill: theme.ink, fontSize: fs, fontWeight: 600, textAnchor: r.v < 0 ? 'end' : 'start' }));
    } else parts.push(text(x + nameW + 8, r.y + fs * 0.36, r.label, { fill: theme.ink, fontSize: fs, fontWeight: 600 }));
    out.push(g({ class: 'pa-m', 'data-tip': r.tip }, parts));
  }
  return out;
}

/** Etiquetas sobre el mapa (mapas anchos): solo las elegidas y sin choques. */
function mapLabels(items, theme, placedBoxes = []) {
  const out = [];
  for (const it of items) {
    const w = Math.max(measure(it.name, 11, 600), measure(it.label, 11));
    const box = [it.cx - w / 2 - 2, it.cy - 13, it.cx + w / 2 + 2, it.cy + 13];
    if (placedBoxes.some((b) => !(box[2] < b[0] || box[0] > b[2] || box[3] < b[1] || box[1] > b[3]))) continue;
    placedBoxes.push(box);
    const halo = { stroke: theme.surface, strokeWidth: 3, paintOrder: 'stroke', strokeLinejoin: 'round', textAnchor: 'middle' };
    out.push(g({ class: 'pa-map-label', 'pointer-events': 'none' }, [
      text(it.cx, it.cy - 2, it.name, { fill: theme.ink, fontSize: 11, fontWeight: 600, ...halo }),
      text(it.cx, it.cy + 11, it.label, { fill: theme.lede, fontSize: 11, ...halo }),
    ]));
  }
  return out;
}

function chooseLabeled(m, spec, locale, defaultN) {
  const hl = spec.highlight === undefined ? [] : [].concat(spec.highlight).map(normKey);
  const isHl = (f) => hl.length && featureIndexHas(f, hl);
  if (Array.isArray(spec.labels)) { const want = spec.labels.map(normKey); return m.features.filter((f) => featureIndexHas(f, want)); }
  const n = typeof spec.labels === 'number' ? spec.labels : spec.labels === false ? 0 : defaultN;
  const top = m.ranked.slice(0, n).map(([f]) => f);
  return [...new Set([...m.features.filter(isHl), ...top])];
}
function featureKeys(f) {
  const p = f.properties || {};
  return [p.code, p.num, p.id, p.iso3, p.fips, p.name, p.nameEn, ...(p.aliases || [])].filter((v) => v !== undefined && v !== null).map(normKey);
}
function featureIndexHas(f, keys) {
  const own = featureKeys(f);
  return keys.some((k) => own.includes(k));
}

/**
 * Siglas sobre el mapa (estados de EE. UU. u otra geometría con `abbr`): la
 * sigla va dentro si cabe, con el valor debajo cuando hay espacio. Las
 * marcadas `callout` (estados chicos) van en una columna a la derecha con
 * línea guía, ordenadas por altura.
 */
function abbrLabels(items, proj, theme, { calloutX, showValues, top, bottom }) {
  const inside = [], callouts = [];
  const fs = Math.max(8.5, Math.min(11, proj.bounds.w / 62));
  for (const it of items) {
    const p = it.f.properties || {};
    if (!p.abbr) continue;
    const at = p.labelAt ? proj(p.labelAt) : [it.cx, it.cy];
    if (p.callout && calloutX) { callouts.push({ ...it, ax: it.cx, ay: it.cy }); continue; }
    const s = Math.sqrt(it.area);
    const aw = measure(p.abbr, fs, 600);
    if (aw + 3 > s * 0.95) {
      if (!proj.inset || !proj.inset(p.labelAt || it.f.geometry && rings(it.f.geometry)[0][0])) continue;
      let x1 = -Infinity;
      for (const r of rings(it.f.geometry)) for (const pt of r) x1 = Math.max(x1, proj(pt)[0]);
      inside.push(text(x1 + 5, at[1] + fs * 0.36, p.abbr, { fill: theme.lede, fontSize: fs, fontWeight: 600 }));
      continue;
    }
    const ink = it.dashedShape ? theme.ink : textOn(it.color, theme);
    const val = showValues && !it.missing && s > fs * 3.4 && measure(it.label, fs - 1) + 4 < s * 0.92;
    const y0 = at[1] + (val ? -1 : fs * 0.36);
    const halo = it.dashedShape ? { stroke: theme.surface, strokeWidth: 2.5, paintOrder: 'stroke', strokeLinejoin: 'round' } : {};
    inside.push(text(at[0], y0, p.abbr, { fill: ink, fontSize: fs, fontWeight: 600, textAnchor: 'middle', ...halo }));
    if (val) inside.push(text(at[0], y0 + fs + 0.5, it.label, { fill: ink, fontSize: fs - 1, textAnchor: 'middle', opacity: 0.88, ...halo }));
  }
  const out = [g({ class: 'pa-map-label pa-zoom-hide', 'pointer-events': 'none' }, inside)];
  if (callouts.length) {
    const rowH = fs + 5.5;
    const rows = callouts.sort((a, b) => a.ay - b.ay).map((c) => ({ ...c, y: c.ay }));
    for (let i = 0; i < rows.length; i++) rows[i].y = Math.max(rows[i].y, i ? rows[i - 1].y + rowH : top + rowH / 2);
    for (let i = rows.length - 1; i >= 0; i--) { const lim = i === rows.length - 1 ? bottom - rowH / 2 : rows[i + 1].y - rowH; if (rows[i].y > lim) rows[i].y = lim; }
    const parts = rows.map((r) => {
      const p = r.f.properties;
      const ax = r.ax.toFixed(1), ay = r.ay.toFixed(1);
      return g({ class: 'pa-m', 'data-tip': r.tip, 'data-color': r.color }, [
        el('path', { d: `M${ax},${ay}L${(calloutX - 12).toFixed(1)},${r.y.toFixed(1)}L${(calloutX - 3).toFixed(1)},${r.y.toFixed(1)}`, fill: 'none', stroke: theme.muted, strokeWidth: 0.6, opacity: 0.7 }),
        el('circle', { cx: ax, cy: ay, r: 1.6, fill: theme.ink, opacity: 0.75 }),
        el('rect', { x: calloutX, y: r.y - 4.5, width: 9, height: 9, rx: 2, ...(r.dashedShape ? { fill: r.fill, stroke: r.stroke, strokeWidth: 1, strokeDasharray: DASH.legend } : { fill: r.missing ? r.fill : r.color }) }),
        text(calloutX + 13, r.y + fs * 0.36, p.abbr, { fill: theme.ink, fontSize: fs, fontWeight: 600 }),
        showValues ? text(calloutX + 18 + measure(p.abbr, fs, 600), r.y + fs * 0.36, r.label, { fill: theme.lede, fontSize: fs }) : '',
      ]);
    });
    out.push(g({ class: 'pa-callouts pa-zoom-hide' }, parts));
  }
  return out;
}

/** Recuadros (Alaska, Hawái, Puerto Rico): un marco fino y discontinuo. */
function insetFrames(features, proj, theme) {
  if (!proj.inset) return '';
  const boxes = new Map();
  for (const f of features) for (const r of rings(f.geometry)) {
    const k = proj.inset(r[0]);
    if (!k) continue;
    const b = boxes.get(k) || [Infinity, Infinity, -Infinity, -Infinity];
    for (const pt of r) { const [x, y] = proj(pt); b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y); }
    boxes.set(k, b);
  }
  const pad = 7;
  return g({ class: 'pa-insets', 'pointer-events': 'none' }, [...boxes.values()].map((b) => el('rect', { x: b[0] - pad, y: b[1] - pad, width: b[2] - b[0] + 2 * pad, height: b[3] - b[1] + 2 * pad, rx: 6, fill: 'none', stroke: theme.axis, strokeWidth: 0.8, strokeDasharray: '2 3' })));
}

function baseChart(spec, theme, kind) {
  const locale = spec.locale || 'es';
  const m = prepare(spec, locale);
  const vals = [...m.values.values()];
  const fmt = makeFormat(spec.format, locale, vals);
  const W = spec.width || 720;
  const aspect = aspectOf(m.features, m.raw);
  const tall = aspect > 1.6 && m.features.length <= 40;
  const defH = tall ? (W < 560 ? 660 : 740) : Math.round(W * Math.min(1.1, aspect) + 150);
  const frame = createFrame(spec, theme, { height: defH });
  let area = frame.layout([]);
  const gid = 'pa-map-' + Math.abs(hash(String(spec.title) + kind + W)).toString(36);
  const missingAny = spec.missing !== 'plain' && m.features.some((f) => !m.values.has(f));
  const body = [];
  let sc = null;
  const H = hatcher(theme, gid);
  const dashedLabel = spec.dashedLabel ?? dashedDefaultLabel(locale);
  const dashedKey = m.dashed.size && spec.legend !== false ? { label: dashedLabel, fill: H.fill(theme.muted), stroke: H.stroke(theme.muted) } : null;
  if (kind === 'choropleth' && vals.length) {
    sc = colorScale(vals, spec, theme);
    const lg = legendBar(sc, area.x, area.y, area.w, theme, fmt.tick ? (v) => fmt(v) : fmt, { title: spec.legendTitle ?? humanize(m.valueF), missing: missingAny, locale, gid, dashed: dashedKey });
    body.push(lg.svg);
    area = { ...area, y: area.y + lg.h + 8, h: area.h - lg.h - 8 };
  }
  let rMax = null;
  if (kind === 'symbol') {
    const N = m.values.size;
    const wEst = area.w, hEst = wEst * Math.min(1.1, aspect);
    rMax = spec.maxRadius ?? Math.max(8, Math.min(30, Math.sqrt(tall ? (area.h / aspect) * area.h : wEst * hEst) / (tall ? 9 : N > 30 ? 22 : 16)));
  }
  let lx = area.x;
  const rowItems = [];
  if (kind === 'symbol' && !tall && vals.length) {
    const maxV = Math.max(...vals.map(Math.abs), 0) || 1;
    const size = theme.type?.axis ?? 11.5;
    const base = area.y + 2 * rMax + 2;
    for (const v of [maxV / 16, maxV / 4, maxV]) {
      const r = Math.sqrt(v / maxV) * rMax;
      rowItems.push(el('circle', { cx: lx + r, cy: base - r, r, fill: 'none', stroke: theme.muted, strokeWidth: 0.8 }));
      rowItems.push(text(lx + 2 * r + 5, base - 1, fmt(v), { fill: theme.muted, fontSize: size }));
      lx += 2 * r + 12 + measure(fmt(v), size);
    }
    lx += 10;
  }
  if (dashedKey && !(kind === 'choropleth' && vals.length)) {
    const size = theme.type?.axis ?? 11.5;
    const ky = rowItems.length ? area.y + 2 * rMax - 9 : area.y + 4.6;
    rowItems.push(g({ class: 'pa-key', 'data-color': 'dashed', style: 'cursor:pointer' }, [
      el('rect', { x: lx + 0.6, y: ky, width: 9.8, height: 9.8, rx: 2, fill: dashedKey.fill, stroke: dashedKey.stroke, strokeWidth: 1.1, strokeDasharray: DASH.legend }),
      text(lx + 15, ky + 8.4, dashedLabel, { fill: theme.lede, fontSize: size }),
    ]));
  }
  if (rowItems.length) {
    const h = kind === 'symbol' && !tall ? 2 * rMax + 12 : 26;
    body.push(g({ class: 'pa-legend pa-size-legend' }, rowItems));
    area = { ...area, y: area.y + h, h: area.h - h };
  }
  const callouts = kind === 'choropleth' && !tall && spec.labels !== false ? m.features.filter((f) => f.properties?.callout && f.properties?.abbr) : [];
  const fsC = Math.max(8.5, Math.min(11, (area.w * 0.9) / 62));
  const calloutW = callouts.length
    ? 18 + Math.max(...callouts.map((f) => measure(f.properties.abbr, fsC, 600) + (kind === 'choropleth' && m.values.has(f) ? measure(fmt(m.values.get(f)), fsC) + 4 : 0)))
    : 0;
  if (!tall && spec.height === undefined) {
    const mapH = (area.w - calloutW) * Math.min(1.1, aspect);
    frame.setHeight(area.y + mapH + frame.chrome);
    area = { ...area, h: frame.bottom - area.y };
  }
  let box;
  if (tall) {
    const colMin = W < 480 ? 0.56 : 0.5;
    let mapW = Math.min(area.w * (1 - colMin), area.h / aspect);
    box = [area.x, area.y, area.x + mapW, area.y + area.h];
  } else box = [area.x, area.y, area.x + area.w - calloutW, area.y + area.h];
  const proj = fit(m.features, m.raw, box, { align: tall ? 'left' : 'center' });
  const calloutX = calloutW ? proj.bounds.x + proj.bounds.w + 14 : 0;
  return { locale, m, vals, fmt, frame, area, gid, missingAny, body, sc, proj, tall, H, dashedLabel, calloutX, rMax };
}

const rankText = (r, n, locale) => (String(locale).startsWith('en') ? `#${r} of ${n}` : `${r}.º de ${n}`);

/** Capa del mapa con recorte: el navegador la escala y desplaza (zoom). */
function zoomLayer(B, children) {
  const { area, gid } = B;
  const box = [area.x, area.y, area.w, area.h].map((v) => Math.round(v * 10) / 10);
  return [
    el('clipPath', { id: `${gid}-clip` }, el('rect', { x: box[0], y: box[1] - 2, width: box[2], height: box[3] + 4 })),
    g({ class: 'pa-zoom-clip', 'clip-path': `url(#${gid}-clip)` }, [el('rect', { x: box[0], y: box[1], width: box[2], height: box[3], fill: 'transparent' }), g({ class: 'pa-zoom', 'data-zoom': box.join(',') }, children)]),
  ];
}

function choropleth(spec, theme) {
  const B = baseChart(spec, theme, 'choropleth');
  const { locale, m, fmt, frame, area, gid, body, sc, proj, tall, H, dashedLabel, calloutX } = B;
  const hl = spec.highlight === undefined ? null : [].concat(spec.highlight).map(normKey);
  const isHl = (f) => hl && featureIndexHas(f, hl);
  const N = m.values.size;
  const regions = [], dashedRegions = [], outlines = [];
  const items = [];
  for (const f of m.features) {
    const v = m.values.get(f);
    const has = v !== undefined;
    const base = has ? sc.color(v) : null;
    const isDashed = m.dashed.has(f);
    const name = nameOf(f, locale);
    const tipTxt = (has ? `${name}\n${fmt(v)} · ${rankText(m.rank.get(f), N, locale)}` : `${name}\n${T(locale, 'Sin dato', 'No data')}`) + (isDashed ? `\n${dashedLabel}` : '');
    const d = pathD(f.geometry, proj);
    const common = { class: 'pa-m', d, strokeLinejoin: 'round', opacity: hl && !isHl(f) ? 0.5 : null, 'data-tip': tipTxt, 'data-k': normKey(f.properties?.code ?? f.properties?.iso3 ?? name) };
    let fill = has ? base : spec.missing === 'plain' ? theme.tint : `url(#${gid}-nd)`;
    let stroke = null;
    if (isDashed && has) {
      const a = dashedAttrs(H, base, { width: 1.2 });
      fill = a.fill; stroke = a.stroke;
      dashedRegions.push(el('path', { ...common, ...a }));
    } else if (isDashed) {
      stroke = theme.muted;
      dashedRegions.push(el('path', { ...common, fill, stroke, strokeWidth: 1.1, strokeDasharray: DASH.outline, 'data-dashed': '1', 'data-color': fill }));
    } else regions.push(el('path', { ...common, fill, stroke: theme.surface, strokeWidth: 0.75, 'data-color': fill }));
    if (isHl(f)) outlines.push(el('path', { d, fill: 'none', stroke: theme.ink, strokeWidth: 1.5, strokeLinejoin: 'round', 'pointer-events': 'none' }));
    const c = centroid(f.geometry, proj);
    items.push({ f, name, v, cx: c.x, cy: c.y, area: c.area, label: has ? fmt(v) : '—', color: has ? base : theme.tint, fill, stroke, dashedShape: isDashed, missing: !has, tip: tipTxt });
  }
  const layer = [g({ class: 'pa-regions' }, regions), dashedRegions.length ? g({ class: 'pa-regions pa-dashed' }, dashedRegions) : '', g({ class: 'pa-outlines' }, outlines), insetFrames(m.features, proj, theme)];
  const after = [];
  if (tall && spec.labels !== false) {
    const x = proj.bounds.x + proj.bounds.w + 26;
    const maxV = Math.max(...[...m.values.values()].map(Math.abs));
    after.push(...labelColumn(items, x, area.y, area.y + area.h, area.x + area.w - x, theme, fmt, { bars: spec.bars !== false, maxV }));
  } else if (spec.labels !== false && m.features.some((f) => f.properties?.abbr) && !Array.isArray(spec.labels) && typeof spec.labels !== 'number') {
    const [lab, ...rest] = abbrLabels(items, proj, theme, { calloutX, showValues: spec.values !== false, top: area.y, bottom: area.y + area.h });
    layer.push(lab);
    after.push(...rest);
  } else {
    const chosen = new Set(chooseLabeled(m, spec, locale, m.features.length <= 30 ? m.features.length : 0));
    const ordered = items.filter((it) => chosen.has(it.f) && !it.missing).sort((a, b) => b.area - a.area);
    layer.push(g({ class: 'pa-zoom-hide' }, mapLabels(ordered, theme)));
  }
  body.push(...(tall ? layer : zoomLayer(B, layer)), ...after);
  const desc = describeMap(m, fmt, locale, T(locale, 'Mapa coroplético', 'Choropleth map'));
  return frame.finish(body, { desc, type: 'choropleth', defs: noDataPattern(`${gid}-nd`, theme) + H.defs() });
}

/** Mapa de símbolos: círculos de área proporcional en el centroide. */
function symbolMap(spec, theme) {
  const B = baseChart(spec, theme, 'symbol');
  const { locale, m, fmt, frame, area, body, proj, tall, gid, H, dashedLabel, rMax } = B;
  const N = m.values.size;
  const maxV = Math.max(...[...m.values.values()].map(Math.abs), 0) || 1;
  const color = (spec.colors && Object.values(spec.colors)[0]) || theme.categorical[0];
  const layer = [g({ class: 'pa-regions pa-base' }, m.features.map((f) => el('path', { d: pathD(f.geometry, proj), fill: theme.tint, stroke: theme.surface, strokeWidth: 0.75, strokeLinejoin: 'round', 'data-k': normKey(f.properties?.code ?? f.properties?.iso3 ?? nameOf(f, locale)) }))), insetFrames(m.features, proj, theme)];
  const items = m.features.map((f) => {
    const c = centroid(f.geometry, proj);
    const v = m.values.get(f);
    const name = nameOf(f, locale);
    const isDashed = m.dashed.has(f);
    const at = f.properties?.labelAt ? proj(f.properties.labelAt) : [c.x, c.y];
    return { f, name, v, cx: at[0], cy: at[1], area: c.area, r: v === undefined ? 0 : Math.sqrt(Math.abs(v) / maxV) * rMax, label: v === undefined ? '—' : fmt(v), color, missing: v === undefined, dashedShape: isDashed,
      tip: (v === undefined ? `${name}\n${T(locale, 'Sin dato', 'No data')}` : `${name}\n${fmt(v)} · ${rankText(m.rank.get(f), N, locale)}`) + (isDashed ? `\n${dashedLabel}` : '') };
  });
  const circles = items.filter((it) => !it.missing).sort((a, b) => b.r - a.r)
    .map((it) => el('circle', { class: 'pa-m', cx: it.cx, cy: it.cy, r: Math.max(1.5, it.r), 'data-tip': it.tip, 'data-color': color,
      ...(it.dashedShape ? { ...dashedAttrs(H, color, { width: 1.3 }) } : { fill: color, fillOpacity: 0.75, stroke: theme.surface, strokeWidth: 1.5 }) }));
  layer.push(g({ class: 'pa-symbols' }, circles));
  const sizes = [maxV, maxV / 4, maxV / 16].map((v) => ({ v, r: Math.sqrt(v / maxV) * rMax }));
  const lx = tall ? proj.bounds.x + proj.bounds.w + 26 : area.x + 4, ly = tall ? area.y + area.h - 4 : area.y + area.h - 4;
  const leg = sizes.map((s) => [
    el('circle', { cx: lx + rMax, cy: ly - s.r, r: s.r, fill: 'none', stroke: theme.muted, strokeWidth: 0.75 }),
    el('line', { x1: lx + rMax, x2: lx + rMax * 2 + 8, y1: ly - 2 * s.r, y2: ly - 2 * s.r, stroke: theme.muted, strokeWidth: 0.5 }),
    text(lx + rMax * 2 + 11, ly - 2 * s.r + 3.5, fmt(s.v), { fill: theme.muted, fontSize: 10.5 }),
  ]);
  if (tall && spec.labels !== false) {
    const x = proj.bounds.x + proj.bounds.w + 26;
    const legH = rMax * 2 + 12;
    body.push(...layer, ...labelColumn(items.map((it) => ({ ...it, barColor: color })), x, area.y, area.y + area.h - legH, area.x + area.w - x, theme, fmt, { bars: spec.bars !== false, maxV }));
  } else {
    const chosen = new Set(chooseLabeled(m, spec, locale, Math.min(5, m.values.size)));
    layer.push(g({ class: 'pa-zoom-hide' }, mapLabels(items.filter((it) => chosen.has(it.f) && !it.missing).sort((a, b) => b.v - a.v).map((it) => ({ ...it, cy: it.cy - it.r - 10 })), theme)));
    body.push(...zoomLayer(B, layer));
  }
  if (tall) body.push(g({ class: 'pa-legend pa-size-legend' }, leg));
  const desc = describeMap(m, fmt, locale, T(locale, 'Mapa de símbolos', 'Proportional symbol map'));
  return frame.finish(body, { desc, type: 'symbolmap', defs: H.defs() });
}

function describeMap(m, fmt, locale, what) {
  const en = String(locale).startsWith('en');
  if (!m.ranked.length) return `${what}.`;
  const [hiF, hiV] = m.ranked[0], [loF, loV] = m.ranked[m.ranked.length - 1];
  let s = en
    ? `${what} of ${humanize(m.valueF)} across ${m.values.size} areas. Highest: ${nameOf(hiF, locale)} (${fmt(hiV)}). Lowest: ${nameOf(loF, locale)} (${fmt(loV)}).`
    : `${what} de ${humanize(m.valueF).toLowerCase()} en ${m.values.size} territorios. Mayor: ${nameOf(hiF, locale)} (${fmt(hiV)}). Menor: ${nameOf(loF, locale)} (${fmt(loV)}).`;
  if (m.unmatched.length) s += en ? ` Unmatched: ${m.unmatched.slice(0, 8).join(', ')}.` : ` Sin coincidencia: ${m.unmatched.slice(0, 8).join(', ')}.`;
  return s;
}

return { "normKey": normKey, "colorScale": colorScale, "choropleth": choropleth, "symbolMap": symbolMap };
});
__def("src/geo/registry.js", function () {
const { PlotError } = __req("src/data.js");

const REG = new Map();

function registerGeo(name, fc, aliases = []) {
  if (!fc || fc.type !== 'FeatureCollection') throw new PlotError(`La geometría "${name}" debe ser un GeoJSON FeatureCollection.`);
  for (const n of [name, ...aliases]) REG.set(String(n).toLowerCase(), fc);
  return fc;
}

function getGeo(geo) {
  if (geo && typeof geo === 'object') {
    if (geo.type === 'FeatureCollection') return geo;
    if (geo.type === 'Feature') return { type: 'FeatureCollection', features: [geo] };
    throw new PlotError('`geo` debe ser un nombre registrado o un GeoJSON FeatureCollection.');
  }
  const fc = REG.get(String(geo || '').toLowerCase());
  if (!fc) {
    const known = [...new Set(REG.keys())];
    throw new PlotError(
      `No hay una geometría registrada con el nombre "${geo}".`,
      known.length ? `Disponibles: ${known.join(', ')}. O pasa un GeoJSON en \`geo\`.` : "Importa 'plotagents/geo/chile', 'plotagents/geo/usa' o 'plotagents/geo/world', o pasa un GeoJSON en `geo`."
    );
  }
  return fc;
}

const registeredGeo = () => [...new Set(REG.keys())];

return { "registerGeo": registerGeo, "getGeo": getGeo, "registeredGeo": registeredGeo };
});
__def("src/geo/projection.js", function () {

const RAD = Math.PI / 180;

function mercator() {
  return ([lon, lat]) => {
    const phi = Math.max(-85, Math.min(85, lat)) * RAD;
    return [lon * RAD, -Math.log(Math.tan(Math.PI / 4 + phi / 2))];
  };
}

const A1 = 1.340264, A2 = -0.081106, A3 = 0.000893, A4 = 0.003796, M = Math.sqrt(3) / 2;
function equalEarth() {
  return ([lon, lat]) => {
    const l = lon * RAD;
    const th = Math.asin(M * Math.sin(lat * RAD));
    const t2 = th * th, t6 = t2 * t2 * t2;
    const x = (l * Math.cos(th)) / (M * (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2)));
    const y = th * (A1 + A2 * t2 + t6 * (A3 + A4 * t2));
    return [x, -y];
  };
}

/**
 * Cónica de áreas iguales (Albers) con rotación y centro, en escala unitaria:
 * misma fórmula que d3.geoConicEqualArea. Devuelve [x, y] con y hacia abajo.
 */
function conic(rot, center, [p0, p1], k = 1, [tx, ty] = [0, 0]) {
  const sy0 = Math.sin(p0 * RAD), n = (sy0 + Math.sin(p1 * RAD)) / 2;
  const c = 1 + sy0 * (2 * n - sy0), r0 = Math.sqrt(c) / n;
  const raw = (lon, lat) => {
    let l = lon + rot;
    l = ((((l + 180) % 360) + 360) % 360) - 180;
    const r = Math.sqrt(Math.max(0, c - 2 * n * Math.sin(lat * RAD))) / n;
    const a = l * RAD * n;
    return [r * Math.sin(a), r0 - r * Math.cos(a)];
  };
  const [cx, cy] = raw(center[0], center[1]);
  return (lon, lat) => { const [x, y] = raw(lon, lat); return [tx + k * (x - cx), ty - k * (y - cy)]; };
}

/**
 * EE. UU. compuesto: 48 estados contiguos en Albers y recuadros para Alaska
 * (a 0,35×), Hawái y Puerto Rico abajo, como en d3 / d3-composite-projections.
 * Cada punto va al recuadro de su territorio (las geometrías no cruzan).
 */
function albersUsa() {
  const lower48 = conic(96, [-96.6, 38.7], [29.5, 45.5]);
  const alaska = conic(154, [-156, 58.5], [55, 65], 0.35, [-0.307, 0.201]);
  const hawaii = conic(157, [-160, 19.9], [8, 18], 1, [-0.205, 0.212]);
  const puertoRico = conic(66, [-66, 18], [8, 18], 1, [0.35, 0.224]);
  const which = ([lon, lat]) => (lat > 50 ? 'AK' : lat < 23 && lon < -150 ? 'HI' : lon > -68.5 && lon < -64 && lat < 19.5 ? 'PR' : null);
  const P = { AK: alaska, HI: hawaii, PR: puertoRico };
  const f = (p) => (P[which(p)] || lower48)(p[0], p[1]);
  f.continuous = true; // sin corte en el antimeridiano: los recuadros ya son continuos
  f.inset = which;
  return f;
}

const projections = { mercator, equalEarth, 'equal-earth': equalEarth, albersUsa, 'albers-usa': albersUsa, albers: albersUsa };

/** Recorre todos los anillos de una geometría. */
function rings(geom) {
  if (!geom) return [];
  if (geom.type === 'Polygon') return geom.coordinates;
  if (geom.type === 'MultiPolygon') return geom.coordinates.flat();
  return [];
}
function polygonsOf(geom) {
  if (!geom) return [];
  if (geom.type === 'Polygon') return [geom.coordinates];
  if (geom.type === 'MultiPolygon') return geom.coordinates;
  return [];
}

/**
 * Proyección ajustada a [x0, y0, x1, y1] conservando la proporción.
 * Devuelve una función lon/lat → [x, y] con .bounds (ancho/alto usados).
 */
function fit(features, raw, [x0, y0, x1, y1], { align = 'center' } = {}) {
  let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
  for (const f of features) for (const r of rings(f.geometry)) for (const p of r) {
    const [x, y] = raw(p);
    if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y;
  }
  const w = x1 - x0, h = y1 - y0;
  const k = Math.min(w / (bx1 - bx0 || 1), h / (by1 - by0 || 1));
  const mw = (bx1 - bx0) * k, mh = (by1 - by0) * k;
  const ox = align === 'left' ? x0 : x0 + (w - mw) / 2;
  const oy = y0 + (h - mh) / 2;
  const proj = (p) => { const [x, y] = raw(p); return [ox + (x - bx0) * k, oy + (y - by0) * k]; };
  proj.bounds = { x: ox, y: oy, w: mw, h: mh };
  proj.continuous = !!raw.continuous;
  proj.inset = raw.inset;
  proj.aspect = (by1 - by0) / (bx1 - bx0 || 1);
  return proj;
}

/** Proporción alto/ancho de la colección proyectada (para elegir el alto). */
function aspectOf(features, raw) {
  let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
  for (const f of features) for (const r of rings(f.geometry)) for (const p of r) {
    const [x, y] = raw(p);
    if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y;
  }
  return (by1 - by0) / (bx1 - bx0 || 1);
}

const r1 = (v) => Math.round(v * 10) / 10;

/**
 * Geometría → atributo d de SVG. Los anillos que saltan más de 180° de
 * longitud (antimeridiano) se cortan para no cruzar el mapa entero.
 */
function pathD(geom, proj) {
  let d = '';
  const cut = !proj.continuous;
  for (const ring of rings(geom)) {
    let started = false, lastLon = null, lx = null, ly = null, n = 0;
    for (const p of ring) {
      if (cut && lastLon !== null && Math.abs(p[0] - lastLon) > 180) started = false;
      lastLon = p[0];
      const [x, y] = proj(p);
      const X = r1(x), Y = r1(y);
      if (started && X === lx && Y === ly) continue;
      d += (started ? 'L' : 'M') + X + ',' + Y;
      started = true; lx = X; ly = Y; n++;
    }
    if (n) d += 'Z';
  }
  return d;
}

/** Área (en px²) y centroide del polígono proyectado más grande. */
function centroid(geom, proj) {
  let best = null;
  for (const poly of polygonsOf(geom)) {
    const pts = poly[0].map(proj);
    let a = 0, cx = 0, cy = 0;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const f = pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1];
      a += f; cx += (pts[j][0] + pts[i][0]) * f; cy += (pts[j][1] + pts[i][1]) * f;
    }
    a /= 2;
    if (!best || Math.abs(a) > Math.abs(best.area)) best = { area: a, x: a ? cx / (6 * a) : pts[0][0], y: a ? cy / (6 * a) : pts[0][1] };
  }
  return best ? { x: best.x, y: best.y, area: Math.abs(best.area) } : { x: 0, y: 0, area: 0 };
}

return { "mercator": mercator, "equalEarth": equalEarth, "albersUsa": albersUsa, "rings": rings, "polygonsOf": polygonsOf, "fit": fit, "aspectOf": aspectOf, "pathD": pathD, "centroid": centroid, "projections": projections };
});
__def("src/charts/heatmap.js", function () {
const { el, g, text, tip } = __req("src/svg.js");
const { measure, truncate } = __req("src/text.js");
const { makeFormat } = __req("src/format.js");
const { ramp, textOn } = __req("src/theme.js");
const { ensureData, requireField, uniq, num, fieldsOf, fieldKind, aggregate, humanize } = __req("src/data.js");
const { xLabels } = __req("src/axes.js");
const { createFrame } = __req("src/frame.js");

function heatmap(spec, theme) {
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
  for (const r of data) {
    const k = String(r[x]) + '\u0000' + String(r[y]);
    if (!cells.has(k)) cells.set(k, []);
    cells.get(k).push(num(r[valueF]));
  }
  const val = (a, b) => { const v = cells.get(a + '\u0000' + b); return v ? aggregate(v, spec.aggregate || 'sum') : NaN; };
  const all = [...cells.keys()].map((k) => { const [a, b] = k.split('\u0000'); return val(a, b); }).filter(Number.isFinite);
  const vmin = Math.min(...all), vmax = Math.max(...all);
  const fmt = makeFormat(spec.format, locale, all);
  const mid = spec.midpoint ?? (spec.diverging ? 0 : undefined);
  const stops = mid !== undefined ? theme.diverging : theme.sequential;
  const colorOf = (v) => {
    if (!Number.isFinite(v)) return theme.tint;
    if (mid !== undefined) {
      const span = Math.max(vmax - mid, mid - vmin) || 1;
      return ramp(stops, 0.5 + (v - mid) / span / 2);
    }
    return ramp(stops.slice(1), (v - vmin) / (vmax - vmin || 1));
  };

  const legend = [{ type: 'ramp', stops: mid !== undefined ? stops : stops.slice(1), min: fmt(mid !== undefined ? -(Math.max(vmax - mid, mid - vmin)) + mid : vmin), max: fmt(mid !== undefined ? Math.max(vmax - mid, mid - vmin) + mid : vmax), title: spec.legendTitle ?? humanize(valueF) }];
  const frame = createFrame(spec, theme, { height: Math.min(640, 140 + ys.length * 34) });
  const area = frame.layout(legend);
  const yW = Math.min(area.w * 0.3, Math.max(...ys.map((v) => measure(v, 12)))) + 12;
  const inner = { x: area.x + yW, y: area.y, w: area.w - yW, h: area.h - 26 };
  const cw = inner.w / xs.length, ch = Math.min(inner.h / ys.length, spec.cellHeight ?? 56);
  inner.h = ch * ys.length;
  if (spec.height === undefined) frame.setHeight(inner.y + inner.h + 26 + frame.chrome);
  const showLabels = spec.labels ?? (cw >= Math.max(...all.map((v) => measure(fmt(v), 11))) + 8 && ch >= 18);

  const body = [];
  ys.forEach((b, j) => {
    body.push(text(inner.x - 10, inner.y + j * ch + ch / 2 + 4, truncate(b, yW - 12, 12), { fill: theme.lede, fontSize: 12, textAnchor: 'end' }));
    xs.forEach((a, i) => {
      const v = val(a, b);
      const fill = colorOf(v);
      const cx = inner.x + i * cw + 1, cy = inner.y + j * ch + 1;
      const parts = [el('rect', { x: cx, y: cy, width: Math.max(0, cw - 2), height: Math.max(0, ch - 2), rx: 3, fill })];
      if (showLabels && Number.isFinite(v)) parts.push(text(cx + (cw - 2) / 2, cy + (ch - 2) / 2 + 4, fmt(v), { fill: textOn(fill, theme), fontSize: 11, textAnchor: 'middle', fontWeight: 500 }));
      body.push(g({ class: 'pa-m', 'data-tip': tip(`${b} · ${a}`, Number.isFinite(v) ? fmt(v) : '—') }, parts));
    });
  });
  body.push(xLabels(xs.map((a, i) => ({ pos: inner.x + i * cw + cw / 2, label: a })), inner, theme, { y: inner.y + inner.h + 18, color: theme.lede }));

  const en = String(locale).startsWith('en');
  let best = null;
  for (const a of xs) for (const b of ys) { const v = val(a, b); if (Number.isFinite(v) && (!best || v > best[2])) best = [a, b, v]; }
  const desc = en
    ? `Heatmap of ${humanize(valueF)} by ${humanize(x)} and ${humanize(y)}. Highest: ${best?.[1]} · ${best?.[0]} (${fmt(best?.[2])}).`
    : `Mapa de calor de ${humanize(valueF).toLowerCase()} por ${humanize(x).toLowerCase()} y ${humanize(y).toLowerCase()}. Máximo: ${best?.[1]} · ${best?.[0]} (${fmt(best?.[2])}).`;
  return frame.finish(body, { desc, type: 'heatmap' });
}

return { "heatmap": heatmap };
});
__def("src/charts/sankey.js", function () {
const { el, g, text, tip } = __req("src/svg.js");
const { measure, truncate } = __req("src/text.js");
const { makeFormat } = __req("src/format.js");
const { ensureData, requireField, num, fieldsOf, fieldKind } = __req("src/data.js");
const { createFrame } = __req("src/frame.js");

function sankey(spec, theme) {
  const data = ensureData(spec);
  const fields = fieldsOf(data);
  const from = spec.from ?? spec.source_field ?? (fields.includes('source') ? 'source' : fields.includes('from') ? 'from' : fields[0]);
  const to = spec.to ?? (fields.includes('target') ? 'target' : fields.includes('to') ? 'to' : fields[1]);
  const valueF = spec.value ?? fields.find((f) => f !== from && f !== to && fieldKind(data, f) === 'number');
  requireField(data, from, 'from');
  requireField(data, to, 'to');
  requireField(data, valueF, 'value');
  const locale = spec.locale || 'es';

  const lmap = new Map();
  for (const r of data) {
    const v = num(r[valueF]);
    if (!(v > 0)) continue;
    const s = String(r[from]), t = String(r[to]);
    if (s === t) continue;
    const k = s + '\u0000' + t;
    lmap.set(k, (lmap.get(k) || 0) + v);
  }
  const links = [...lmap.entries()].map(([k, v]) => { const [s, t] = k.split('\u0000'); return { s, t, v }; });
  const names = [...new Set(links.flatMap((l) => [l.s, l.t]))];
  const nodes = new Map(names.map((n) => [n, { name: n, in: [], out: [], depth: 0 }]));
  for (const l of links) { l.sn = nodes.get(l.s); l.tn = nodes.get(l.t); l.sn.out.push(l); l.tn.in.push(l); }
  for (const n of nodes.values()) n.value = Math.max(sum(n.in), sum(n.out));

  for (let it = 0; it < names.length; it++) {
    let changed = false;
    for (const l of links) if (l.tn.depth < l.sn.depth + 1) { l.tn.depth = l.sn.depth + 1; changed = true; }
    if (!changed) break;
  }
  const maxDepth = Math.max(...[...nodes.values()].map((n) => n.depth));
  for (const n of nodes.values()) if (!n.out.length) n.depth = maxDepth; // sumideros a la derecha
  const cols = Array.from({ length: maxDepth + 1 }, () => []);
  for (const n of nodes.values()) cols[n.depth].push(n);
  cols.forEach((c) => c.sort((a, b) => b.value - a.value));

  const fmt = makeFormat(spec.format, locale, links.map((l) => l.v));
  const frame = createFrame(spec, theme, { height: 440 });
  const area = frame.layout([]);
  const label = (n) => n.name;
  const leftW = Math.min(area.w * 0.22, Math.max(...cols[0].map((n) => Math.max(measure(label(n), 12.5, 500), measure(fmt(n.value), 12))))) + 10;
  const last = cols[cols.length - 1];
  const rightW = Math.min(area.w * 0.22, Math.max(...last.map((n) => Math.max(measure(label(n), 12.5, 500), measure(fmt(n.value), 12))))) + 10;
  const NW = 10;
  const inner = { x: area.x + leftW, y: area.y + 4, w: area.w - leftW - rightW, h: area.h - 8 };
  const pad = Math.max(6, Math.min(18, inner.h / Math.max(...cols.map((c) => c.length)) / 4));
  const ky = Math.min(...cols.map((c) => (inner.h - (c.length - 1) * pad) / (sum(c.map((n) => ({ v: n.value }))) || 1)));
  const colX = (i) => inner.x + (cols.length === 1 ? 0 : (i * (inner.w - NW)) / (cols.length - 1));

  const place = () => {
    cols.forEach((c, i) => {
      const H = sum(c.map((n) => ({ v: n.value }))) * ky + (c.length - 1) * pad;
      let y = inner.y + (inner.h - H) / 2;
      for (const n of c) { n.x = colX(i); n.y = y; n.h = Math.max(1, n.value * ky); y += n.h + pad; }
    });
  };
  place();
  const center = (n) => n.y + n.h / 2;
  for (let it = 0; it < 6; it++) {
    for (let i = 1; i < cols.length; i++) cols[i].sort((a, b) => bary(a.in, 'sn') - bary(b.in, 'sn'));
    place();
    for (let i = cols.length - 2; i >= 0; i--) cols[i].sort((a, b) => bary(a.out, 'tn') - bary(b.out, 'tn'));
    place();
  }
  function bary(ls, key) {
    const w = sum(ls);
    return w ? ls.reduce((a, l) => a + center(l[key]) * l.v, 0) / w : Infinity;
  }

  const cc = Math.max(0, cols.findIndex((c) => c.length > 1));
  const fixed = (n) => spec.colors && spec.colors[n.name];
  for (let i = 0; i < cc; i++) for (const n of cols[i]) n.color = fixed(n) || theme.ink;
  [...cols[cc]].sort((a, b) => b.value - a.value).forEach((n, i) => { n.color = fixed(n) || (i < theme.categorical.length ? theme.categorical[i] : theme.other); });
  for (let i = cc + 1; i < cols.length; i++) for (const n of cols[i]) {
    const big = [...n.in].sort((a, b) => b.v - a.v)[0];
    n.color = fixed(n) || (n.in.length ? big.sn.color : theme.categorical[0]);
  }
  const linkColor = (l) => (l.sn.depth < cc ? l.tn.color : l.sn.color);

  for (const n of nodes.values()) {
    let sy = n.y;
    for (const l of [...n.out].sort((a, b) => center(a.tn) - center(b.tn))) { l.y0 = sy; sy += l.v * ky; }
    let ty = n.y;
    for (const l of [...n.in].sort((a, b) => center(a.sn) - center(b.sn))) { l.y1 = ty; ty += l.v * ky; }
  }

  const body = [];
  const linkG = [];
  for (const l of [...links].sort((a, b) => b.v - a.v)) {
    const x0 = l.sn.x + NW, x1 = l.tn.x, xm = (x0 + x1) / 2, w = l.v * ky;
    const d = `M${x0},${l.y0}C${xm},${l.y0} ${xm},${l.y1} ${x1},${l.y1}L${x1},${l.y1 + w}C${xm},${l.y1 + w} ${xm},${l.y0 + w} ${x0},${l.y0 + w}Z`;
    const share = l.sn.value ? Math.round((l.v / l.sn.value) * 100) : 0;
    linkG.push(el('path', { class: 'pa-m', d, fill: linkColor(l), fillOpacity: theme.link, 'data-tip': `${l.s} → ${l.t}\n${fmt(l.v)} · ${share}% de ${l.s}` }));
  }
  body.push(g({ class: 'pa-links' }, linkG));
  for (const [ci, c] of cols.entries()) for (const n of c) {
    const parts = [el('rect', { x: n.x, y: n.y, width: NW, height: n.h, rx: 2, fill: n.color })];
    const isLeft = ci === 0 && cols.length > 1;
    const lx = isLeft ? n.x - 8 : n.x + NW + 8;
    const anchor = isLeft ? 'end' : 'start';
    const maxW = isLeft ? leftW - 10 : ci === cols.length - 1 ? rightW - 10 : (inner.w / Math.max(1, cols.length - 1)) * 0.55;
    const halo = ci > 0 && ci < cols.length - 1 ? { stroke: theme.surface, strokeWidth: 3, paintOrder: 'stroke', strokeLinejoin: 'round' } : {};
    const cy = n.y + n.h / 2;
    if (n.h >= 30) {
      parts.push(text(lx, cy - 2, truncate(label(n), maxW, 12.5, 500), { fill: theme.ink, fontSize: 12.5, fontWeight: 500, textAnchor: anchor, ...halo }));
      parts.push(text(lx, cy + 13, fmt(n.value), { fill: theme.lede, fontSize: 12, textAnchor: anchor, ...halo }));
    } else if (n.h >= 8 || c.length < 12) {
      parts.push(text(lx, cy + 4, truncate(label(n), maxW, 12, 500), { fill: theme.ink, fontSize: 12, fontWeight: 500, textAnchor: anchor, ...halo }));
    }
    body.push(g({ 'data-tip': `${n.name}\n${fmt(n.value)}` }, parts));
  }
  const en = String(locale).startsWith('en');
  const top = [...links].sort((a, b) => b.v - a.v).slice(0, 3).map((l) => `${l.s} → ${l.t} (${fmt(l.v)})`).join('; ');
  const desc = en ? `Sankey diagram with ${nodes.size} nodes and ${links.length} flows. Largest flows: ${top}.` : `Diagrama de Sankey con ${nodes.size} nodos y ${links.length} flujos. Mayores flujos: ${top}.`;
  return frame.finish(body, { desc, type: 'sankey' });
}

const sum = (ls) => ls.reduce((a, l) => a + l.v, 0);

return { "sankey": sankey };
});
__def("src/charts/kpi.js", function () {
const { el, g, text, tip } = __req("src/svg.js");
const { truncate, measure } = __req("src/text.js");
const { makeFormat, formatNumber } = __req("src/format.js");
const { num } = __req("src/data.js");
const { createFrame } = __req("src/frame.js");
const { ctx } = __req("src/context.js");

function kpi(spec, theme) {
  const items = (spec.items || spec.data || []).map((it) => ({ ...it }));
  const locale = spec.locale || 'es';
  const en = String(locale).startsWith('en');
  const frame = createFrame(spec, theme, { height: 200 });
  const area = frame.layout([]);
  const n = Math.max(1, items.length);
  const fit = Math.max(1, Math.floor((area.w + 12) / 180));
  const cols = spec.columns ?? (n <= fit ? n : Math.ceil(n / Math.ceil(n / fit)));
  const gap = 12;
  const tw = (area.w - gap * (cols - 1)) / cols;
  const hasTrend = items.some((it) => Array.isArray(it.trend) && it.trend.length > 1);
  const hasTarget = items.some((it) => it.target !== undefined);
  const X = ctx.textScale;
  const th = Math.round(118 * (0.35 + 0.65 * X) + (hasTrend ? 40 : 0) + (hasTarget ? 30 * X : 0));
  const rows = Math.ceil(n / cols);
  if (spec.height === undefined) frame.setHeight(area.y + rows * th + (rows - 1) * gap + frame.chrome);

  const body = [];
  const shown = items.map((it) => it.display ?? makeFormat(it.format ?? spec.format, locale, [num(it.value), ...(it.trend || []).map(num)])(num(it.value)));
  let vSize = 34;
  while (vSize > 20 && shown.some((s) => measure(s, vSize, 600) > tw - 36)) vSize -= 2;
  items.forEach((it, i) => {
    const cx = area.x + (i % cols) * (tw + gap);
    const cy = area.y + Math.floor(i / cols) * (th + gap);
    const value = num(it.value);
    const fmt = makeFormat(it.format ?? spec.format, locale, [value, ...(it.trend || []).map(num)]);
    const parts = [el('rect', { x: cx, y: cy, width: tw, height: th, rx: 12, fill: theme.tint })];
    const P = 18;
    parts.push(text(cx + P, cy + P + 12 * X, truncate(it.label ?? '', tw - P * 2, 13), { fill: theme.lede, fontSize: 13 }));
    const valStr = shown[i];
    parts.push(text(cx + P, cy + P + 12 * X + 10 + vSize * X * 0.92, valStr, { fill: theme.ink, fontSize: vSize, fontWeight: 600, letterSpacing: '-0.015em' }));

    let delta = it.delta !== undefined ? num(it.delta) : it.previous !== undefined && num(it.previous) ? (value - num(it.previous)) / Math.abs(num(it.previous)) : NaN;
    let y = cy + P + 12 * X + 10 + vSize * X + 20 * X;
    if (Number.isFinite(delta)) {
      const isPct = (it.deltaFormat ?? 'percent') === 'percent';
      if (isPct && Math.abs(delta) > 1.5 && it.delta !== undefined) delta = delta / 100; // 12 → 12%
      const up = delta > 0, flat = delta === 0;
      const goodUp = (it.good ?? spec.good ?? 'up') === 'up';
      const good = flat ? null : up === goodUp;
      const color = good === null ? theme.lede : good ? theme.status.good : theme.status.critical;
      const arrow = flat ? '■' : up ? '▲' : '▼';
      const dstr = isPct
        ? (up ? '+' : flat ? '' : '−') + formatNumber(Math.abs(delta) * 100, Math.abs(delta) < 0.1 ? 1 : 0, locale, true) + '%'
        : (up ? '+' : flat ? '' : '−') + fmt(Math.abs(delta));
      parts.push(text(cx + P, y, `${arrow} ${dstr}`, { fill: color, fontSize: 13, fontWeight: 600 }));
      const period = it.period ?? it.deltaLabel;
      const dw = measure(`${arrow} ${dstr}`, 13, 600) + 8;
      if (period && dw + measure(period, 12.5) <= tw - P * 2) parts.push(text(cx + P + dw, y, period, { fill: theme.lede, fontSize: 12.5 }));
      else if (period) { y += 17 * X; parts.push(text(cx + P, y, truncate(period, tw - P * 2, 12.5), { fill: theme.lede, fontSize: 12.5 })); }
    } else if (it.note) {
      parts.push(text(cx + P, y, truncate(it.note, tw - P * 2, 12.5), { fill: theme.lede, fontSize: 12.5 }));
    }

    if (it.target !== undefined) {
      y += 24 * X;
      const t = num(it.target);
      const f = Math.max(0, Math.min(1, value / (t || 1)));
      const w = tw - P * 2;
      const upGood = (it.good ?? 'up') === 'up';
      const ratio = upGood ? value / (t || 1) : (t || 1) / (value || 1);
      const fill = ratio >= 1 ? theme.status.good : ratio >= 0.8 ? theme.categorical[0] : theme.status.critical;
      parts.push(el('rect', { x: cx + P, y, width: w, height: 6, rx: 3, fill: theme.tint2 }));
      parts.push(el('rect', { x: cx + P, y, width: Math.max(6, w * f), height: 6, rx: 3, fill }));
      const lab = (en ? 'Target ' : 'Meta ') + fmt(t) + ' · ' + formatNumber((value / (t || 1)) * 100, 0, locale) + '%';
      parts.push(text(cx + P, y - 7, lab, { fill: theme.lede, fontSize: 11.5 }));
    }

    if (Array.isArray(it.trend) && it.trend.length > 1) {
      const vals = it.trend.map(num).filter(Number.isFinite);
      const mn = Math.min(...vals), mx = Math.max(...vals);
      const sx = cx + P, sw = tw - P * 2, sy = cy + th - P - 26, sh = 26;
      const pts = vals.map((v, k) => [sx + (k / (vals.length - 1)) * sw, sy + sh - ((v - mn) / (mx - mn || 1)) * sh]);
      parts.push(el('path', { d: pts.map(([a, b], k) => (k ? 'L' : 'M') + a.toFixed(1) + ',' + b.toFixed(1)).join(''), fill: 'none', stroke: theme.muted, strokeWidth: 1.75, strokeLinejoin: 'round', strokeLinecap: 'round' }));
      const [lx, ly] = pts[pts.length - 1];
      parts.push(el('circle', { cx: lx, cy: ly, r: 3.5, fill: theme.categorical[0], stroke: theme.tint, strokeWidth: 2 }));
    }
    body.push(g({ 'data-tip': tip(it.label, valStr, it.period ? `${it.period}` : '') }, parts));
  });
  const desc = items.map((it) => `${it.label}: ${it.display ?? makeFormat(it.format ?? spec.format, locale, [num(it.value)])(num(it.value))}`).join('. ');
  return frame.finish(body, { desc, type: 'kpi' });
}

return { "kpi": kpi };
});
__def("src/facet.js", function () {
const { el, g } = __req("src/svg.js");
const { createFrame } = __req("src/frame.js");
const { colorMap } = __req("src/theme.js");
const { ensureData, requireField, uniq, fieldKind, num } = __req("src/data.js");
const { niceDomain } = __req("src/scale.js");

const LINE_LIKE = new Set(['line', 'area', 'kde', 'ecdf', 'point', 'regplot', 'residplot']);

function facet(spec, theme, renderOne) {
  const data = ensureData(spec);
  const f = spec.facet ?? spec.col;
  requireField(data, f, 'facet');
  let keys = uniq(data.map((r) => String(r[f])));
  const fk = fieldKind(data, f);
  if (fk === 'year' || fk === 'number') keys.sort((a, b) => num(a) - num(b));
  if (spec.facetOrder) keys = [...spec.facetOrder.map(String).filter((k) => keys.includes(k)), ...keys.filter((k) => !spec.facetOrder.map(String).includes(k))];

  const sf = spec.series ?? spec.hue ?? (typeof spec.color === 'string' && !spec.color.startsWith('#') ? spec.color : null);
  const colors = { ...(spec.colors || {}) };
  let legend = [];
  if (sf && data.length && Object.prototype.hasOwnProperty.call(data[0], sf)) {
    const sk = uniq(data.map((r) => String(r[sf])));
    const cm = colorMap(sk, theme, spec.colors);
    for (const k of sk) colors[k] = cm.get(k);
    if (sk.length > 1) legend = sk.map((k) => ({ label: k, color: cm.get(k), shape: LINE_LIKE.has(spec.type) ? 'line' : 'square' }));
  }

  const frame = createFrame({ ...spec, height: 200 }, theme, { width: 720 });
  const area = frame.layout(legend);
  const gap = spec.panelGap ?? 14;
  const fit = Math.max(1, Math.floor((area.w + gap) / 150));
  const want = spec.columns ?? spec.colWrap ?? spec.col_wrap ?? Math.max(1, Math.floor((area.w + gap) / 230));
  const cols = Math.max(1, Math.min(keys.length, want, fit));
  const pw = (area.w - gap * (cols - 1)) / cols;
  const ph = spec.panelHeight ?? Math.round(Math.min(300, Math.max(160, pw * 0.66)));
  const rows = Math.ceil(keys.length / cols);
  frame.setHeight(area.y + rows * ph + (rows - 1) * gap + frame.chrome);

  const panelTheme = { ...theme, type: { ...(theme.type || {}), title: Math.min(13.5, theme.type?.title ?? 13.5), titleWeight: 600 } };
  const multiSeries = legend.length > 1;
  const base = {
    ...spec, facet: undefined, col: undefined, title: undefined, subtitle: undefined, source: undefined, refLines: spec.refLines,
    width: Math.floor(pw), height: ph, padding: 0, colors, legend: false, theme: panelTheme, palette: undefined,
    labels: spec.panelLabels ?? (multiSeries && LINE_LIKE.has(spec.type) ? false : spec.labels),
  };
  const subsets = keys.map((k) => data.filter((r) => String(r[f]) === k));

  const shareY = spec.sharey ?? spec.shareY ?? true;
  const shareX = spec.sharex ?? spec.shareX ?? true;
  let yDomain = spec.yDomain, xDomain = spec.xDomain;
  if ((shareY && !yDomain) || (shareX && !xDomain)) {
    const ds = subsets.map((d, i) => { const _domains = {}; try { renderOne({ ...base, data: d, title: keys[i], _domains }); } catch { /* panel vacío */ } return _domains; });
    const ys = ds.filter((d) => d.y).map((d) => d.y), xs = ds.filter((d) => d.x).map((d) => d.x);
    if (shareY && !yDomain && ys.length) {
      const lo = Math.min(...ys.map((d) => d[0])), hi = Math.max(...ys.map((d) => d[1]));
      yDomain = spec.yScale === 'log' ? [lo, hi] : (({ min, max }) => [min, max])(niceDomain(lo, hi, 4));
    }
    if (shareX && !xDomain && xs.length) xDomain = [Math.min(...xs.map((d) => d[0])), Math.max(...xs.map((d) => d[1]))];
  }

  const body = [];
  keys.forEach((k, i) => {
    const c = i % cols, r = Math.floor(i / cols);
    const px = area.x + c * (pw + gap), py = area.y + r * (ph + gap);
    let svg;
    try {
      svg = renderOne({ ...base, data: subsets[i], title: k, yDomain, xDomain });
    } catch (e) {
      svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${pw}" height="${ph}"></svg>`;
    }
    svg = svg.replace(/^<svg /, `<svg x="${px.toFixed(1)}" y="${py.toFixed(1)}" `).replace(/ style="[^"]*"/, '');
    body.push(svg);
  });
  const en = String(spec.locale || 'es').startsWith('en');
  const desc = (en ? `Small multiples by ${f}: ` : `Paneles por ${f}: `) + keys.join(', ') + '.';
  return frame.finish(g({ class: 'pa-facets' }, body), { desc, type: 'facet' });
}

return { "facet": facet };
});
__def("src/infer.js", function () {
const { fieldsOf, fieldKind } = __req("src/data.js");

const TYPES = ['bar', 'column', 'count', 'line', 'area', 'scatter', 'bubble', 'treemap', 'sunburst', 'donut', 'pie', 'heatmap', 'sankey', 'kpi', 'hist', 'kde', 'ecdf', 'regplot', 'residplot', 'jointplot', 'box', 'violin', 'strip', 'swarm', 'point', 'radar', 'network', 'chord', 'pyramid', 'flowchart', 'choropleth', 'symbolmap'];

const ALIASES = {
  barplot: ['bar', { ci: true }], countplot: 'count', columns: 'column', lineplot: 'line', areaplot: 'area',
  scatterplot: 'scatter', histplot: 'hist', histogram: 'hist', kdeplot: 'kde', density: 'kde', ecdfplot: 'ecdf',
  lmplot: 'regplot', reg: 'regplot', regression: 'regplot', joint: 'jointplot', boxplot: 'box', violinplot: 'violin',
  stripplot: 'strip', swarmplot: 'swarm', beeswarm: 'swarm', pointplot: 'point', spider: 'radar', doughnut: 'donut',
  graph: 'network', force: 'network', red: 'network', 'chord-diagram': 'chord', cuerdas: 'chord',
  populationpyramid: 'pyramid', population: 'pyramid', piramide: 'pyramid', 'pirámide': 'pyramid',
  flow: 'flowchart', diagram: 'flowchart', process: 'flowchart', diagrama: 'flowchart',
  map: 'choropleth', mapa: 'choropleth', choroplethmap: 'choropleth', symbol: 'symbolmap', bubblemap: 'symbolmap', 'mapa-simbolos': 'symbolmap',
  tree: 'treemap', stat: 'kpi', stats: 'kpi', number: 'kpi', heat: 'heatmap', flow: 'sankey',
};

/** Tipo canónico + opciones implícitas del alias (p. ej. barplot → bar con ci). */
function normalizeType(t) {
  const k = String(t || '').toLowerCase();
  const al = ALIASES[k];
  if (!al) return [k, {}];
  return Array.isArray(al) ? [al[0], al[1]] : [al, {}];
}

function inferType(spec, data = []) {
  if (spec.items) return 'kpi';
  if (spec.geo) return 'choropleth';
  if (spec.nodes && spec.nodes.some?.((n) => n && n.type)) return 'flowchart';
  if (spec.nodes) return 'network';
  if (spec.matrix) return 'chord';
  if (spec.from || spec.to) return 'sankey';
  if (spec.path || spec.group) return 'treemap';
  if (spec.size) return 'bubble';
  const fields = fieldsOf(data);
  if ((fields.includes('source') && fields.includes('target')) || (fields.includes('from') && fields.includes('to'))) return 'sankey';
  const kinds = Object.fromEntries(fields.map((f) => [f, fieldKind(data, f)]));
  const x = spec.x ?? fields[0];
  const xk = kinds[x];
  if (xk === 'date' || xk === 'year') return 'line';
  if (xk === 'number') {
    const y = spec.y ?? fields.find((f) => f !== x && kinds[f] === 'number');
    if (y && kinds[y] === 'number') return 'scatter';
  }
  const cats = fields.filter((f) => kinds[f] === 'category');
  if (cats.length >= 2 && !spec.series && fields.some((f) => kinds[f] === 'number') && spec.value) return 'heatmap';
  return 'bar';
}

return { "normalizeType": normalizeType, "inferType": inferType, "TYPES": TYPES, "ALIASES": ALIASES };
});
__def("src/lint.js", function () {
const { ensureData, fieldsOf, fieldKind, uniq, num, PlotError } = __req("src/data.js");
const { inferType, TYPES, normalizeType } = __req("src/infer.js");
const { validatePalette } = __req("src/palette.js");
const { themeFor } = __req("src/theme.js");

/** El índice registra aquí un dibujo de prueba (para revisar coincidencias de mapas). */
let RENDER_PROBE = null;
const _setProbe = (fn) => { RENDER_PROBE = fn; };

function lint(spec = {}) {
  const errors = [];
  const warnings = [];
  const tips = [];
  const err = (code, message, fix) => errors.push({ code, message, fix });
  const warn = (code, message, fix) => warnings.push({ code, message, fix });
  const sug = (code, message, fix) => tips.push({ code, message, fix });

  let data = [];
  try { data = spec.type === 'kpi' || spec.items ? [] : ensureData(spec); } catch (e) { err('data', e.message.split('\n')[0], 'Pasa `data` como arreglo de filas: [{ categoria: "A", valor: 10 }]'); }
  const type = spec.type && spec.type !== 'auto' ? normalizeType(spec.type)[0] : inferType(spec, data);
  if (!TYPES.includes(type)) err('type', `Tipo "${spec.type}" no soportado.`, `Usa uno de: ${TYPES.join(', ')}`);
  const fields = fieldsOf(data);
  const check = (f, role) => {
    for (const ff of [].concat(f ?? [])) if (ff && !fields.includes(ff)) err('field', `El campo "${ff}" (${role}) no existe.`, `Campos disponibles: ${fields.join(', ')}`);
  };
  if (data.length) {
    check(spec.x, 'x'); check(spec.y, 'y'); check(spec.series ?? spec.color, 'series'); check(spec.size, 'size');
    check(spec.value, 'value'); check(spec.label, 'label'); if (!['network', 'flowchart'].includes(type)) check(spec.group, 'group'); check(spec.path, 'path');
    check(spec.from, 'from'); check(spec.to, 'to');
  } else if (type !== 'kpi' && !errors.length) err('empty', 'No hay filas en `data`.', 'Entrega al menos una fila.');

  if (!spec.title) sug('title', 'Falta el título.', 'Escribe el hallazgo como una frase completa: "Biobío concentra el 32% de las ventas", no "Ventas por región".');
  else if (!/\d/.test(spec.title) && /^(evoluci[oó]n|distribuci[oó]n|comparaci[oó]n|ranking|gr[aá]fico|ventas|total|resumen)\b|\b(por|seg[uú]n|vs\.?)\s+\w+$/i.test(spec.title.trim())) sug('title-fact', 'El título describe el gráfico pero no dice qué muestra.', 'Un buen título es un hecho, idealmente con la cifra clave.');
  if (!spec.source) sug('source', 'Falta la fuente de los datos.', 'Agrega `source: "INE, 2025"` (o "datos ilustrativos").');

  const series = spec.series ?? spec.color;
  const nSeries = series && fields.includes(series) ? uniq(data.map((r) => String(r[series]))).length : Array.isArray(spec.y) ? spec.y.length : 1;
  if (nSeries > 8) warn('series-max', `${nSeries} series: solo hay 8 colores distinguibles; desde la 9.ª se pintan en gris.`, 'Agrupa la cola en "Otros", usa `highlight` o divide en varios gráficos.');

  if (type === 'bar') {
    const x = spec.x ?? fields.find((f) => fieldKind(data, f) === 'category');
    const nCat = x && fields.includes(x) ? uniq(data.map((r) => String(r[x]))).length : 0;
    if (nCat === 1 && nSeries === 1) sug('one-bar', 'Una sola barra no compara nada.', 'Usa `type: "kpi"` para mostrar el número.');
    if (nCat > 40 && !spec.top) warn('too-many-bars', `${nCat} categorías: se mostrarán las 25 mayores y el resto como "Otros".`, 'Fija `top: N` para controlar el corte.');
    if (spec.stack && nSeries > 5) sug('stack-many', 'Apilar más de 5 series dificulta comparar los segmentos del medio.', 'Considera barras agrupadas, `highlight` o `stack: "percent"`.');
    if (x && fieldKind(data, x) === 'date' && nCat > 24) sug('bar-time', 'Muchos periodos en barras.', 'Para tendencias largas, `type: "line"` se lee mejor.');
  }
  if (type === 'line' || type === 'area') {
    const x = spec.x;
    if (nSeries > 4 && spec.highlight === undefined) warn('line-many', `${nSeries} líneas: sobre 3-4 el gráfico se vuelve espagueti.`, 'Usa `highlight: "Serie"` para destacar una y atenuar el resto, o separa en varios gráficos.');
    if (x && fields.includes(x) && fieldKind(data, x) === 'category' && !/^(q|t)\d|^\d/i.test(String(data[0]?.[x]))) sug('line-nominal', 'El eje x tiene categorías sin orden: las líneas sugieren continuidad.', 'Para comparar categorías usa `type: "bar"`.');
    const pts = x && fields.includes(x) ? uniq(data.map((r) => String(r[x]))).length : 0;
    if (pts && pts < 3) sug('line-few', 'Menos de 3 puntos en el tiempo.', 'Con 2 periodos, barras agrupadas o un `kpi` con variación comunican mejor.');
    if (Array.isArray(spec.y) && spec.y.length === 2 && !spec.index) {
      const [a, b] = spec.y.map((f) => Math.max(...data.map((r) => Math.abs(num(r[f]))).filter(Number.isFinite)));
      if (a && b && Math.max(a, b) / Math.min(a, b) > 10) warn('dual-scale', 'Las dos medidas tienen escalas muy distintas (no hay doble eje: inventa correlaciones).', 'Usa `index: true` (base 100) o dos gráficos separados.');
    }
  }
  if (type === 'donut') {
    const lf = spec.label ?? spec.x ?? fields.find((f) => fieldKind(data, f) === 'category');
    const vf = spec.value ?? spec.y ?? fields.find((f) => fieldKind(data, f) === 'number');
    const n = lf ? uniq(data.map((r) => String(r[lf]))).length : 0;
    if (n > 6) warn('donut-slices', `${n} segmentos: sobre 6 la dona no se lee; se agrupan en "Otros".`, 'Usa `type: "bar"` o `type: "treemap"`.');
    if (n === 2) sug('donut-two', 'Dos segmentos son un solo número.', 'Usa `type: "kpi"` con el porcentaje.');
    if (vf && n >= 3) {
      const vals = data.map((r) => num(r[vf])).filter((v) => v > 0).sort((a, b) => b - a);
      if (vals.length >= 3 && vals[0] / vals[vals.length - 1] < 1.35) sug('donut-close', 'Los valores son muy parecidos: los ángulos no permiten compararlos.', 'Usa `type: "bar"` ordenado.');
    }
    if (data.some((r) => num(r[vf]) < 0)) err('negative', 'La dona no admite valores negativos.', 'Usa barras.');
  }
  if (type === 'treemap') {
    const vf = spec.value ?? spec.y ?? fields.find((f) => fieldKind(data, f) === 'number');
    if (vf && data.some((r) => num(r[vf]) < 0)) warn('negative', 'Los valores negativos se omiten en el treemap.', 'Usa barras para datos con signo.');
    const gf = spec.group ?? (Array.isArray(spec.path) && spec.path.length > 1 ? spec.path[0] : null);
    if (gf && fields.includes(gf) && uniq(data.map((r) => String(r[gf]))).length > 8) warn('groups-max', 'Más de 8 grupos: desde el 8.º van en gris "Otros".', 'Agrupa categorías o usa otro nivel de jerarquía.');
  }
  if (type === 'scatter' || type === 'bubble') {
    if (nSeries > 3) warn('scatter-colors', `${nSeries} grupos de color en dispersión: solo los 3 primeros colores son distinguibles entre todos los pares para daltonismo.`, 'Usa `highlight`, agrupa o separa en varios gráficos.');
    if (data.length > 2000) sug('overplot', `${data.length} puntos: puede haber sobreposición.`, 'Reduce `radius` o usa un mapa de calor.');
  }
  if (data.length) { check(spec.facet ?? spec.col, 'facet'); check(spec.time, 'time'); check(spec.hue, 'hue'); }

  const custom = spec.palette || (spec.theme && typeof spec.theme === 'object' && spec.theme.categorical);
  if (custom) {
    const th = themeFor(spec);
    const n = Math.max(2, Math.min(th.categorical.length, nSeries));
    const rep = validatePalette(th.categorical.slice(0, n), { mode: th.mode, surface: th.surface, pairs: type === 'scatter' || type === 'bubble' ? 'all' : 'adjacent' });
    for (const c of rep.checks) if (c.status === 'fail') warn('palette-' + c.name, `Paleta: ${c.detail}`, 'Cambia el orden o los tonos, o usa la paleta de fábrica.');
  }

  const numericIn = (f) => f && fields.includes(f) && ['number', 'year'].includes(fieldKind(data, f));
  if (['hist', 'kde', 'ecdf'].includes(type)) {
    const f = spec.x ?? spec.y;
    if (f && fields.includes(f) && !numericIn(f)) err('numeric', `"${f}" no es numérico: ${type} necesita una medida.`, 'Para contar categorías usa `type: "countplot"`.');
    if (data.length < 20) sug('few-obs', `Solo ${data.length} observaciones: la forma de la distribución es poco confiable.`, 'Con pocos datos, `type: "strip"` muestra cada punto.');
  }
  if (['regplot', 'residplot', 'jointplot'].includes(type)) {
    for (const f of [spec.x, spec.y]) if (f && fields.includes(f) && !numericIn(f)) err('numeric', `"${f}" no es numérico: la regresión necesita dos medidas.`, 'Usa `type: "box"` para comparar una medida entre categorías.');
    if (data.length < 8) warn('few-obs', `Solo ${data.length} puntos: la recta y su intervalo son poco confiables.`, 'Muestra los puntos con `type: "scatter"`.');
  }
  if (['box', 'violin'].includes(type) && data.length && spec.x && fields.includes(spec.x)) {
    const counts = new Map();
    for (const r of data) counts.set(String(r[spec.x]), (counts.get(String(r[spec.x])) || 0) + 1);
    const small = [...counts].filter(([, n]) => n < 5).map(([k]) => k);
    if (small.length) sug('few-per-group', `Grupos con menos de 5 datos: ${small.slice(0, 4).join(', ')}.`, '`type: "strip"` o `points: true` muestran cada observación.');
  }
  if (type === 'radar' && nSeries > 4) warn('radar-many', `${nSeries} series en un radar se tapan entre sí.`, 'Usa `highlight`, `facet` o barras agrupadas.');
  if ((type === 'line' || type === 'area') && spec.yScale === 'log' && data.some((r) => num(r[Array.isArray(spec.y) ? spec.y[0] : spec.y]) <= 0)) warn('log-nonpositive', 'Hay valores ≤ 0: la escala log no los puede mostrar.', 'Quita la escala log o filtra esos valores.');

  if (type === 'choropleth' || type === 'symbolmap') {
    const _unmatched = [];
    try { RENDER_PROBE?.({ ...spec, _unmatched }); } catch { /* el error ya se reporta al dibujar */ }
    if (_unmatched.length) warn('geo-unmatched', `${_unmatched.length} fila(s) no coinciden con el mapa: ${_unmatched.slice(0, 5).join(', ')}.`, 'Revisa los nombres o usa códigos (p. ej. "XIII", "ARG", "TX"), o indica `featureKey`.');
  }
  if ((spec.dashed !== undefined && spec.dashed !== false) || spec.dashedFrom !== undefined) {
    if (spec.dashedLabel === undefined) sug('dashed-label', 'Hay formas punteadas pero no se dice qué significan (la leyenda dirá "Estimado").', 'Agrega `dashedLabel: "Proyección"`, "Cifra preliminar" o lo que corresponda.');
    if (spec.dashedFrom !== undefined && !['line', 'area', 'bar', 'column', 'count'].includes(type)) warn('dashed-from-type', '`dashedFrom` solo aplica a líneas, áreas y columnas con eje de tiempo.', 'Usa `dashed` con una lista de categorías o un campo de los datos.');
  }
  if (type === 'pyramid') {
    const sf = spec.sex ?? spec.series ?? spec.hue;
    if (sf && fields.includes(sf)) { const n = uniq(data.map((r) => String(r[sf]))).length; if (n !== 2) err('pyramid-sides', `La pirámide necesita exactamente 2 grupos en "${sf}" (hay ${n}).`, 'Usa `type: "bar"` con `series` para más grupos.'); }
  }
  if (type === 'chord' && data.length && uniq(data.flatMap((r) => [r[spec.from ?? 'from'], r[spec.to ?? 'to']])).length > 16) warn('chord-many', 'Más de 16 grupos en un diagrama de cuerdas: los arcos se vuelven ilegibles.', 'Agrupa los menores en "Otros" o usa `type: "sankey"`.');
  if (type === 'network' && data.length > 2000) sug('network-big', `${data.length} conexiones: la red puede verse como una mancha.`, 'Filtra las conexiones débiles o usa `layout: "circle"`.');

  if (type === 'kpi' && !(spec.items || spec.data || []).length) err('items', 'El KPI necesita `items`.', 'items: [{ label: "Ventas", value: 1250, delta: 0.12, period: "vs 2025" }]');

  return { ok: errors.length === 0, type, errors, warnings, suggestions: tips };
}



return { "lint": lint, "_setProbe": _setProbe, "PlotError": PlotError };
});
__def("src/schema.js", function () {
const { TYPES, ALIASES } = __req("src/infer.js");

const field = (d) => ({ type: 'string', description: d });
const fieldOrList = (d) => ({ anyOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }], description: d });
const strOrList = { anyOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] };

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://unpkg.com/plotagents/schema.json',
  title: 'plotagents spec',
  description:
    'Declarative chart spec. Data as rows (tidy) plus the field name for each role. Everything else has well-designed defaults.',
  type: 'object',
  required: ['data'],
  properties: {
    type: {
      type: 'string',
      enum: ['auto', ...TYPES, ...Object.keys(ALIASES)],
      description:
        'Compare: bar, count. Time: line, area. Relationships: scatter, bubble, regplot, residplot, jointplot, radar. Distributions (seaborn): hist, kde, ecdf, box, violin, strip, swarm, point. Part-to-whole: treemap, sunburst, donut, pie. Other: heatmap, sankey, kpi. seaborn names are accepted (barplot, countplot, histplot, kdeplot, boxplot, violinplot, lmplot…). "auto" (default) picks from the data.',
    },
    data: {
      description: 'Array of rows, e.g. [{ "region": "Biobío", "sales": 1240 }]. For kpi it can be omitted in favor of `items`.',
      anyOf: [{ type: 'array', items: { type: 'object' } }, { type: 'object' }],
    },
    title: { type: 'string', description: 'The finding as a full sentence, ideally with the key number, e.g. "Biobío accounts for 32% of sales".' },
    subtitle: { type: 'string', description: 'How to read the chart: measure, unit and period, e.g. "Sales by region, CLP millions, 2025".' },
    source: { type: 'string', description: 'Data source, shown at the bottom right.' },
    locale: { type: 'string', enum: ['es', 'en'], description: 'Language and number format. Default "es" (1.234,5); use "en" for 1,234.5.' },
    x: field('x-axis or category field (bar, line, area, scatter, heatmap, box, violin…).'),
    y: fieldOrList('Value field. For line/bar a list of fields (wide table) turns each one into a series.'),
    series: field('Field that splits the data into colored series. Alias: hue.'),
    hue: field('Alias of series (seaborn naming).'),
    value: field('Value field for treemap, sunburst, donut, heatmap, sankey and radar.'),
    label: field('Name field (treemap, donut, point labels in scatter/regplot).'),
    group: field('Level-1 group field for a two-level treemap (shortcut for path).'),
    path: { type: 'array', items: { type: 'string' }, description: 'Hierarchy for treemap/sunburst, any depth: [level1, level2, …].' },
    size: field('Bubble size field (area-proportional).'),
    from: field('Sankey source field.'),
    to: field('Sankey target field.'),
    axis: field('radar: field with the axis names (long format).'),
    axes: { type: 'array', items: { type: 'string' }, description: 'radar: fields to use as axes (wide format, one row per series).' },
    items: {
      type: 'array',
      description: 'kpi: the indicators to show.',
      items: {
        type: 'object',
        required: ['label', 'value'],
        properties: {
          label: { type: 'string' },
          value: { type: 'number' },
          delta: { type: 'number', description: 'Relative change as a fraction (0.12 = +12%).' },
          previous: { type: 'number', description: 'Previous value; when given, the change is computed.' },
          period: { type: 'string', description: 'What it is compared against, e.g. "vs 2025".' },
          good: { type: 'string', enum: ['up', 'down'], description: 'Whether going up is good (up) or bad (down, e.g. costs).' },
          trend: { type: 'array', items: { type: 'number' }, description: 'Short series for the sparkline.' },
          target: { type: 'number', description: 'Target: draws a progress meter.' },
          format: { type: 'string' },
        },
      },
    },

    geo: { description: 'choropleth/symbolmap: "chile" (16 regions, default), "usa" (50 states + DC, Albers with Alaska/Hawaii insets; Puerto Rico when it has data), "world" (countries), a name registered with registerGeo(), or a GeoJSON FeatureCollection.', anyOf: [{ type: 'string' }, { type: 'object' }] },
    key: field('choropleth/symbolmap: data field with the region, state or country name/code to match (US: "TX", "Texas", "06").'),
    projection: { type: 'string', enum: ['mercator', 'equalEarth', 'albersUsa'], description: 'choropleth/symbolmap: map projection (picked automatically).' },
    values: { type: 'boolean', description: 'choropleth with state codes (usa): false shows only the codes, without values.' },
    featureKey: field('choropleth: feature property to match against (default tries code, id, ISO-3, name and aliases).'),
    midpoint: { type: 'number', description: 'choropleth/heatmap: diverging color scale around this value (e.g. 0 for changes).' },
    classes: { type: 'integer', description: 'choropleth: number of color classes (default 5).' },
    nodes: { type: 'array', items: { type: 'object' }, description: 'network: node rows (id, group, size). flowchart: steps (id, label, type: start|end|process|decision|data|note, lane).' },
    edges: { type: 'array', items: { type: 'object' }, description: 'flowchart: connections (from, to, label). Same as `data`.' },
    layout: { type: 'string', enum: ['force', 'circle'], description: 'network layout.' },
    matrix: { type: 'array', items: { type: 'array', items: { type: 'number' } }, description: 'chord: square flow matrix (with `names`).' },
    names: { type: 'array', items: { type: 'string' }, description: 'chord: group names for `matrix`.' },
    directed: { type: 'boolean', description: 'chord: treat flows as directed (default false).' },
    direction: { type: 'string', enum: ['TB', 'LR'], description: 'flowchart: top-to-bottom or left-to-right (automatic by default).' },
    age: field('pyramid: age-group field.'),
    sex: field('pyramid: field with exactly two sides (e.g. sex).'),
    percent: { type: 'boolean', description: 'pyramid: show shares of the total population.' },

    facet: field('One panel per value of this field (small multiples, seaborn col). Shared scales and colors.'),
    columns: { type: 'integer', description: 'facet: panels per row (seaborn col_wrap). Reduced automatically on narrow screens.' },
    sharey: { type: 'boolean', description: 'facet: same y scale in every panel (default true).' },
    time: field('Time field (d3plus-style): shows one period at a time (the latest by default) and, in the browser, a slider with play. Not used by line/area, which get a range slider.'),
    timeValue: { description: 'Period to show when `time` is set.' },
    slider: { type: 'boolean', description: 'Browser: false removes the time slider (the chart shows `timeValue` or the latest period).' },
    play: { type: 'boolean', description: 'Browser: false keeps the time slider but hides the play button.' },
    compare: { description: 'With `time`: period to compute changes against: "previous" (default), "first", a specific period, or false.', anyOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }] },
    colorBy: { type: 'string', enum: ['group', 'change', 'label'], description: 'treemap: "change" colors tiles by % change vs the comparison period (diverging, growth cool / decline warm); "label" colors a single-level treemap by item.' },
    shade: { type: 'boolean', description: 'treemap/sunburst: subtle lightness steps inside each category (default false: one solid color per category).' },
    xRange: { type: 'array', description: 'line/area: visible x range [from, to] (what the range slider sets).' },
    focus: { description: 'treemap/sunburst: path to drill into, e.g. ["Mining"]. network: a node id to center and highlight with its neighbors. In the browser, clicking does it.', anyOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] },
    depth: { type: 'integer', description: 'treemap/sunburst: how many levels to show.' },

    xScale: { type: 'string', enum: ['linear', 'log'] },
    yScale: { type: 'string', enum: ['linear', 'log'] },
    xDomain: { type: 'array', items: { type: 'number' }, description: 'Fixed x domain [min, max].' },
    yDomain: { type: 'array', items: { type: 'number' }, description: 'Fixed value-axis domain [min, max].' },
    zero: { type: 'boolean', description: 'line: force (or prevent) a y axis starting at zero.' },
    xLabel: { type: 'string', description: 'x-axis title.' },
    yLabel: { type: 'string', description: 'y-axis title (drawn horizontally above the axis).' },
    format: {
      description: 'Value format: "number" | "compact" | "percent" | "currency" | "integer", or { type, prefix, suffix, decimals, currency }.',
      anyOf: [
        { type: 'string', enum: ['number', 'compact', 'percent', 'currency', 'integer'] },
        { type: 'object', properties: { type: { type: 'string' }, prefix: { type: 'string' }, suffix: { type: 'string' }, decimals: { type: 'integer' }, currency: { type: 'string' } } },
      ],
    },

    highlight: { description: 'Emphasize one or more categories/series and mute the rest.', ...strOrList },
    dashed: { description: 'Draw some shapes dashed (hatched fill + dashed outline; dashed stroke for lines) to mark estimates, projections or provisional figures. A category/series/region name or a list of them, a data field whose truthy rows are dashed, { field, equals }, or true for all.', anyOf: [{ type: 'string' }, { type: 'boolean' }, { type: 'array', items: { type: 'string' } }, { type: 'object', properties: { field: { type: 'string' }, equals: {} } }] },
    dashedFrom: { description: 'line/area/bar on a time axis: x value from which marks are dashed (a projection). Lines turn dashed from the last firm point, over a soft labeled band.', anyOf: [{ type: 'string' }, { type: 'number' }] },
    dashedLabel: { description: 'What the dashed shapes mean ("Projection", "Preliminary"): legend entry, band label and tooltip line. false hides the band label.', anyOf: [{ type: 'string' }, { type: 'boolean' }] },
    labels: { description: 'Value labels: true, false or "auto". In scatter/regplot: a number of points or a list of names to label.', anyOf: [{ type: 'boolean' }, { type: 'string' }, { type: 'number' }, { type: 'array', items: { type: 'string' } }] },
    refLines: { type: 'array', description: 'Reference lines (targets, averages).', items: { type: 'object', properties: { y: { type: 'number' }, x: { type: 'number' }, value: { type: 'number' }, label: { type: 'string' } } } },
    annotations: { type: 'array', description: 'line/area: events on the x axis.', items: { type: 'object', properties: { x: {}, label: { type: 'string' } } } },

    stack: { description: 'bar/area: true stacks; "percent" stacks to 100%.', anyOf: [{ type: 'boolean' }, { type: 'string', enum: ['percent'] }] },
    horizontal: { type: 'boolean', description: 'Force horizontal orientation (otherwise chosen from label length and count).' },
    sort: { type: 'string', enum: ['desc', 'asc', 'none', 'alpha'], description: 'bar: category order (desc by default unless the categories are time).' },
    top: { type: 'integer', description: 'bar: keep the N largest and fold the rest into "Other".' },
    threshold: { description: 'bar, treemap, sunburst: categories under this share of the total (of their parent in a hierarchy) are grouped into one "Other" placed last. 0.01 (1%) by default; accepts 0.05, "5%" or 5; false turns it off. Only groups when at least two fall under it; highlighted categories are never grouped.', anyOf: [{ type: 'number' }, { type: 'string' }, { type: 'boolean' }] },
    otherLabel: { type: 'string', description: 'Name of the grouped bucket. Default "Otros" ("Other" with locale "en"). A category already called "Otros"/"Other"/"Resto" in the data is also moved to the end.' },
    index: { type: 'boolean', description: 'line: rebase each series to 100 at its first value (compare growth without a dual axis).' },
    curve: { type: 'string', enum: ['linear', 'smooth', 'step'] },
    aggregate: { type: 'string', enum: ['sum', 'mean', 'max', 'min', 'count', 'last', 'first'], description: 'How to combine repeated rows. Default sum.' },
    ci: { description: 'line/bar/regplot: confidence interval (true = 95, or a number). In line/bar it switches the estimator to the mean.', anyOf: [{ type: 'boolean' }, { type: 'number' }] },
    errorbar: { type: 'string', enum: ['ci', 'sd', 'se', 'pi', 'none'], description: 'Error bar or band type.' },
    estimator: { type: 'string', enum: ['mean', 'median', 'sum', 'count'], description: 'How to summarize several observations per category.' },

    bins: { type: 'integer', description: 'hist: number of bins.' },
    binWidth: { type: 'number', description: 'hist: bin width.' },
    stat: { type: 'string', enum: ['count', 'percent', 'density', 'probability'], description: 'hist: what the y axis measures.' },
    kde: { type: 'boolean', description: 'hist: overlay a density curve.' },
    multiple: { type: 'string', enum: ['layer', 'stack', 'dodge', 'fill'], description: 'hist/kde with hue: how groups are combined.' },
    fill: { type: 'boolean', description: 'kde: fill the area. line: false removes the gradient under a single line.' },
    order: { description: 'regplot: polynomial degree (number). box/violin/strip/swarm/point: category order (list).', anyOf: [{ type: 'integer' }, { type: 'array', items: { type: 'string' } }] },
    lowess: { type: 'boolean', description: 'regplot: local regression instead of a straight line.' },
    logx: { type: 'boolean', description: 'regplot: fit y ~ log(x) with a log x axis.' },
    trend: { type: 'boolean', description: 'scatter: add a least-squares line and R².' },
    annotate: { type: 'boolean', description: 'regplot: show R² and n.' },
    kind: { type: 'string', enum: ['scatter', 'reg'], description: 'jointplot: center plot.' },
    marginal: { type: 'string', enum: ['hist', 'kde'], description: 'jointplot: marginal plots.' },
    inner: { type: 'string', enum: ['box', 'quartiles', 'points', 'none'], description: 'violin: what goes inside.' },
    split: { type: 'boolean', description: 'violin: with two hue levels, one half each.' },
    points: { type: 'boolean', description: 'box: overlay the observations. line: markers on every point.' },
    normalize: { type: 'boolean', description: 'radar: scale each axis 0–1 by its own maximum.' },

    half: { type: 'boolean', description: 'donut: semicircle.' },

    colors: { type: 'object', additionalProperties: { type: 'string' }, description: 'Pin colors to entities: { "Biobío": "#3A47B8" }.' },
    palette: { description: 'Palette shortcut: a name ("cdia", "okabe-ito", "tableau10", "udec") or a list of colors in fixed order.', ...strOrList },
    ramp: { description: 'Sequential ramp: a name ("indigo", "magenta", "teal", "amber") or a list of colors from light to dark.', ...strOrList },
    theme: {
      description: 'Theme: "papel" (light, default), "noche" (dark), or a JSON object deep-merged over `extends`. Keys: surface, ink, lede, muted, grid, axis, tint, dim, other, categorical (list or palette name), sequential, diverging, status {good, warning, critical}, font {family, mono, import}, type {title, subtitle, label, axis, legend, source, titleWeight}, marks {barRadius, barMax, lineWidth, pointRadius, gap, ring, areaOpacity, bandOpacity, dotOpacity}, axes {inside, grid}, layout {padding}.',
      anyOf: [{ type: 'string', enum: ['papel', 'noche', 'light', 'dark'] }, { type: 'object' }],
    },
    font: { description: 'Typeface for the whole chart: a Google Fonts name ("Poppins"), a CSS stack ("\'Inter\', sans-serif") or { family, import }. configure({ font }) sets it for every chart.', anyOf: [{ type: 'string' }, { type: 'object' }] },
    textScale: { type: 'number', description: 'Multiplies every text size (1.5, 2…); the layout is recomputed so nothing overlaps. Aliases: fontScale, labelScale. configure({ textScale }) sets it for every chart.' },
    width: { type: 'number', description: 'Width in px (default 720; render() uses the container width).' },
    height: { type: 'number', description: 'Height in px. Automatic for horizontal bars, heatmaps, KPI tiles, and narrow treemaps, sunbursts and radars.' },
  },
};

/** Tool definition ready for Claude (Anthropic) or OpenAI. */
function toolDefinition({ name = 'plot', flavor = 'anthropic' } = {}) {
  const description =
    'Draws an elegant, accessible chart from tabular data. Pass rows in `data`, name the fields (x, y, series/hue…) and write a `title` that states the finding. Returns an SVG. Types: bar, count, line, area, scatter, bubble, regplot, residplot, jointplot, hist, kde, ecdf, box, violin, strip, swarm, point, radar, treemap, sunburst, donut, pie, heatmap, sankey, kpi, choropleth (Chile regions / world countries built in), symbolmap, network, chord, pyramid, flowchart (seaborn names accepted). `facet` makes panels; `time` adds a per-period slider. Set `locale: "en"` for English number formats.';
  const { $schema, $id, title, ...params } = schema;
  if (flavor === 'openai') return { type: 'function', function: { name, description, parameters: params } };
  return { name, description, input_schema: params };
}

return { "toolDefinition": toolDefinition, "schema": schema };
});
__def("src/interact.js", function () {

function attach(root) {
  if (!root || root.__pa) return;
  root.__pa = true;
  const svg = root.querySelector('svg.pa-chart');
  if (!svg) return;
  if (getComputedStyle(root).position === 'static') root.style.position = 'relative';
  const dark = svg.getAttribute('data-pa-mode') === 'dark';
  const tipEl = document.createElement('div');
  tipEl.setAttribute('role', 'tooltip');
  tipEl.style.cssText = [
    'position:absolute', 'pointer-events:none', 'z-index:10', 'opacity:0', 'transition:opacity .12s',
    'padding:8px 10px', 'border-radius:8px', 'font:12.5px/1.45 ' + (svg.getAttribute('font-family') || 'system-ui'),
    'white-space:nowrap', 'max-width:280px',
    dark ? 'background:#F2F3FA;color:#141A3F' : 'background:#141A3F;color:#FCFBF9',
    'box-shadow:0 6px 24px rgba(11,15,43,.18)',
  ].join(';');
  root.appendChild(tipEl);
  const NS = 'http://www.w3.org/2000/svg';
  const overlay = document.createElementNS(NS, 'g');
  overlay.setAttribute('pointer-events', 'none');
  svg.appendChild(overlay);
  let on = null;
  let pinned = null;

  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
  const show = (html, ev) => {
    tipEl.innerHTML = html;
    tipEl.style.opacity = '1';
    const r = root.getBoundingClientRect();
    let x = ev.clientX - r.left + 14, y = ev.clientY - r.top + 14;
    const w = tipEl.offsetWidth, h = tipEl.offsetHeight;
    if (x + w > r.width) x = ev.clientX - r.left - w - 14;
    if (y + h > r.height) y = Math.max(0, ev.clientY - r.top - h - 14);
    tipEl.style.left = x + 'px';
    tipEl.style.top = y + 'px';
  };
  const type = svg.getAttribute('data-pa-type') || '';
  const isMap = type === 'choropleth' || type === 'symbolmap';
  const zoomG = svg.querySelector('.pa-zoom');
  const mapOverlay = document.createElementNS(NS, 'g');
  mapOverlay.setAttribute('pointer-events', 'none');
  if (zoomG) zoomG.appendChild(mapOverlay);
  const hide = () => {
    tipEl.style.opacity = '0';
    if (on) on.classList.remove('pa-on');
    on = null;
    overlay.innerHTML = '';
    mapOverlay.innerHTML = '';
    if (!pinned) svg.classList.remove('pa-focus');
  };
  const tipBg = dark ? '#F2F3FA' : '#141A3F';
  const rgb = (h) => { h = String(h).replace('#', ''); if (h.length === 3) h = h.split('').map((c) => c + c).join(''); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const lum = (c) => { const [r, g, b] = rgb(c).map((v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
  const hex = (a) => '#' + a.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
  const onTip = (c) => {
    if (!/^#[0-9a-f]{3,6}$/i.test(c || '')) return null;
    const to = dark ? [20, 26, 63] : [255, 255, 255];
    const A = rgb(c);
    for (let t = 0; t <= 1.001; t += 0.05) { const m = hex(A.map((v, i) => v + (to[i] - v) * t)); if (ratio(m, tipBg) >= 4.5) return m; }
    return null;
  };
  const markColor = (node) => {
    if (!node) return null;
    const dc = node.getAttribute && (node.getAttribute('data-color') || (node.querySelector('[data-color]') || { getAttribute: () => null }).getAttribute('data-color'));
    if (dc && /^#/.test(dc)) return dc;
    const cands = [node, ...node.querySelectorAll('[fill],[stroke]')];
    for (const n of cands) {
      const f = n.getAttribute && n.getAttribute('fill');
      if (f && /^#/.test(f)) return f;
    }
    for (const n of cands) {
      const st = n.getAttribute && n.getAttribute('stroke');
      if (st && /^#/.test(st) && st.toLowerCase() !== (dark ? '#0b0f2b' : '#fcfbf9')) return st;
    }
    return null;
  };
  const linesHtml = (txt, color) => {
    const c = onTip(color);
    return String(txt).split('\n').map((l, i) => (i === 0
      ? `<div style="font-weight:600${c ? ';color:' + c : ''}">${c ? `<span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${color};margin-right:6px;vertical-align:1px"></span>` : ''}${esc(l)}</div>`
      : `<div style="opacity:.86">${esc(l)}</div>`)).join('');
  };

  const toSvg = (ev) => {
    const pt = svg.createSVGPoint();
    pt.x = ev.clientX; pt.y = ev.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  };

  svg.addEventListener('pointermove', (ev) => {
    const t = ev.target;
    if (t && t.closest && t.closest('.pa-key')) return; // la leyenda maneja su propio foco
    if (t && t.classList && t.classList.contains('pa-cross')) {
      const data = JSON.parse(t.getAttribute('data-cross'));
      const p = toSvg(ev);
      let best = data[0];
      for (const d of data) if (Math.abs(d.x - p.x) < Math.abs(best.x - p.x)) best = d;
      const y0 = +t.getAttribute('data-y0'), y1 = +t.getAttribute('data-y1');
      overlay.innerHTML =
        `<line x1="${best.x}" x2="${best.x}" y1="${y0}" y2="${y1}" stroke="${dark ? '#8A90B4' : '#7C819C'}" stroke-width="1"/>` +
        best.v.map((v) => `<circle cx="${best.x}" cy="${v[2]}" r="4.5" fill="${v[1]}" stroke="${dark ? '#0B0F2B' : '#FCFBF9'}" stroke-width="2"/>`).join('');
      const rows = [...best.v].sort((a, b) => a[2] - b[2]).map((v) => `<div style="display:flex;gap:8px;align-items:center"><span style="width:8px;height:8px;border-radius:50%;background:${v[1]}"></span><span style="opacity:.86;flex:1">${esc(v[0])}</span><b style="font-weight:600;margin-left:12px">${esc(v[3])}</b></div>`).join('');
      show(`<div style="font-weight:600;margin-bottom:2px">${esc(best.t)}</div>${rows}`, ev);
      return;
    }
    if (t && t.classList && t.classList.contains('pa-near')) {
      const pts = t.__near || (t.__near = JSON.parse(t.getAttribute('data-near')));
      const p = toSvg(ev);
      let best = null, bd = 196;
      for (const q of pts) { const d = (q[0] - p.x) ** 2 + (q[1] - p.y) ** 2; if (d < bd) { bd = d; best = q; } }
      if (!best) { hide(); return; }
      overlay.innerHTML = `<circle cx="${best[0]}" cy="${best[1]}" r="6" fill="${best[3]}" stroke="${dark ? '#0B0F2B' : '#FCFBF9'}" stroke-width="2"/>`;
      if (best[2]) show(linesHtml(best[2], best[3]), ev); else tipEl.style.opacity = '0';
      return;
    }
    const tg = t && t.closest ? t.closest('[data-tip]') : null;
    if (!tg) { hide(); return; }
    const mark = tg.classList.contains('pa-m') ? tg : tg.querySelector('.pa-m') && tg.querySelectorAll('.pa-m').length === 1 ? tg.querySelector('.pa-m') : null;
    if (mark !== on) {
      if (on) on.classList.remove('pa-on');
      on = mark;
      if (isMap) {
        mapOverlay.innerHTML = '';
        if (on && on.tagName === 'path') mapOverlay.innerHTML = `<path d="${on.getAttribute('d')}" fill="none" stroke="${dark ? '#F2F3FA' : '#141A3F'}" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`;
        else if (on && on.tagName === 'circle') mapOverlay.innerHTML = `<circle cx="${on.getAttribute('cx')}" cy="${on.getAttribute('cy')}" r="${on.getAttribute('r')}" fill="none" stroke="${dark ? '#F2F3FA' : '#141A3F'}" stroke-width="2" vector-effect="non-scaling-stroke"/>`;
      } else if (on) { on.classList.add('pa-on'); svg.classList.add('pa-focus'); } else svg.classList.remove('pa-focus');
    }
    show(linesHtml(tg.getAttribute('data-tip'), markColor(mark || tg)), ev);
  });
  svg.addEventListener('pointerleave', hide);

  const norm = (c) => String(c || '').trim().toLowerCase();
  const body = svg.querySelector('.pa-body');
  const marksOf = (color) => {
    const c = norm(color);
    const out = new Set();
    if (!body) return out;
    if (c === 'dashed') { for (const n of body.querySelectorAll('[data-dashed]')) out.add(n.closest('.pa-m') || n); return out; }
    for (const n of body.querySelectorAll('[fill],[stroke],[data-color]')) {
      if (n.closest('.pa-legend')) continue;
      if (norm(n.getAttribute('fill')) === c || norm(n.getAttribute('stroke')) === c || norm(n.getAttribute('data-color')) === c) {
        const m = n.closest('.pa-m') || n;
        out.add(m);
      }
    }
    return out;
  };
  const focusColor = (color) => {
    svg.querySelectorAll('.pa-m.pa-on').forEach((n) => n.classList.remove('pa-on'));
    svg.querySelectorAll('.pa-key').forEach((k) => (k.style.opacity = color && norm(k.getAttribute('data-color')) !== norm(color) ? '0.4' : ''));
    if (!color) { svg.classList.remove('pa-focus'); return; }
    const ms = marksOf(color);
    for (const n of body ? body.querySelectorAll('[fill],[stroke],[data-color]') : []) if (ms.has(n) && !n.classList.contains('pa-m')) n.classList.add('pa-m');
    ms.forEach((m) => m.classList.add('pa-on'));
    svg.classList.add('pa-focus');
  };
  for (const k of svg.querySelectorAll('.pa-key')) {
    k.setAttribute('tabindex', '0');
    k.setAttribute('role', 'button');
    k.addEventListener('pointerenter', () => { if (!pinned) focusColor(k.getAttribute('data-color')); });
    k.addEventListener('pointerleave', () => { if (!pinned) focusColor(null); });
    const toggle = () => { pinned = pinned === k ? null : k; focusColor(pinned ? k.getAttribute('data-color') : null); };
    k.addEventListener('click', toggle);
    k.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
  }

  if (zoomG) mapZoom(root, svg, zoomG, { dark, hide });
}

/**
 * Zoom y paneo de mapas (buenas prácticas de chartjs-plugin-zoom: la rueda
 * sola desplaza la página; el zoom pide Ctrl/⌘, para no secuestrar el scroll).
 * - clic en una región: acerca hasta encuadrarla; otro clic (o Esc, o doble
 *   clic, o el botón) vuelve a la vista completa.
 * - Ctrl/⌘ + rueda: zoom alrededor del puntero. Pellizco en pantallas táctiles.
 * - arrastre con zoom > 1: desplaza. Botones +, − y restablecer (teclado).
 * El estado sobrevive a los redibujos (slider temporal) en root.__paZoom.
 */
function mapZoom(root, svg, z, { dark, hide }) {
  const [bx, by, bw, bh] = z.getAttribute('data-zoom').split(',').map(Number);
  const en = svg.getAttribute('data-pa-lang') === 'en';
  const L = en ? { in: 'Zoom in', out: 'Zoom out', reset: 'Reset zoom', hint: 'Use Ctrl + scroll to zoom the map' } : { in: 'Acercar', out: 'Alejar', reset: 'Restablecer zoom', hint: 'Usa Ctrl + rueda para hacer zoom en el mapa' };
  const MAX = 14;
  let st = root.__paZoom && root.__paZoom.box === String([bx, by, bw, bh]) ? root.__paZoom : { k: 1, x: 0, y: 0, key: null };
  let raf = 0;
  const clamp = (s) => {
    const k = Math.max(1, Math.min(MAX, s.k));
    const minX = bx + bw - (bx + bw) * k, maxX = bx - bx * k;
    const minY = by + bh - (by + bh) * k, maxY = by - by * k;
    return { ...s, k, x: Math.min(maxX, Math.max(minX, s.x)), y: Math.min(maxY, Math.max(minY, s.y)) };
  };
  const apply = (s) => {
    z.setAttribute('transform', `translate(${s.x.toFixed(2)},${s.y.toFixed(2)}) scale(${s.k.toFixed(4)})`);
    svg.classList.toggle('pa-zoomed', s.k > 1.02);
    svg.style.touchAction = s.k > 1.02 ? 'none' : 'pan-x pan-y';
    z.style.cursor = s.k > 1.02 ? 'grab' : '';
    btnReset.hidden = s.k <= 1.02;
  };
  const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const go = (target, animate = true) => {
    const to = clamp(target);
    cancelAnimationFrame(raf);
    const from = { ...st };
    st = to; root.__paZoom = { ...st, box: String([bx, by, bw, bh]) };
    if (!animate || reduced) { apply(to); return; }
    const t0 = performance.now(), D = 520;
    const step = (now) => {
      const t = Math.min(1, (now - t0) / D), e = 1 - (1 - t) ** 3;
      const k = Math.exp(Math.log(from.k) + (Math.log(to.k) - Math.log(from.k)) * e);
      const cx = (bx + bw / 2 - from.x) / from.k + ((bx + bw / 2 - to.x) / to.k - (bx + bw / 2 - from.x) / from.k) * e;
      const cy = (by + bh / 2 - from.y) / from.k + ((by + bh / 2 - to.y) / to.k - (by + bh / 2 - from.y) / from.k) * e;
      apply({ k, x: bx + bw / 2 - cx * k, y: by + bh / 2 - cy * k });
      if (t < 1) raf = requestAnimationFrame(step); else apply(to);
    };
    raf = requestAnimationFrame(step);
  };
  const zoomAt = (k, px, py, animate) => {
    const lx = (px - st.x) / st.k, ly = (py - st.y) / st.k;
    go({ ...st, k, x: px - lx * k, y: py - ly * k, key: null }, animate);
  };
  const reset = () => go({ k: 1, x: 0, y: 0, key: null });
  const toSvg = (cx, cy) => { const p = svg.createSVGPoint(); p.x = cx; p.y = cy; return p.matrixTransform(svg.getScreenCTM().inverse()); };

  const box = document.createElement('div');
  box.className = 'pa-zoomctl';
  const fg = dark ? '#F2F3FA' : '#141A3F', bg = dark ? 'rgba(20,26,63,.92)' : 'rgba(252,251,249,.94)', bd = dark ? 'rgba(242,243,250,.22)' : 'rgba(20,26,63,.16)';
  box.style.cssText = `position:absolute;display:flex;gap:4px;z-index:5;opacity:.0;transition:opacity .15s`;
  const mk = (label, svgIcon) => {
    const b = document.createElement('button');
    b.type = 'button'; b.setAttribute('aria-label', label); b.title = label;
    b.innerHTML = svgIcon.replace('<svg ', '<svg style="width:12px;height:12px;display:block;flex:none" ');
    b.style.cssText = `width:28px;height:28px;display:grid;place-items:center;padding:0;border-radius:7px;border:1px solid ${bd};background:${bg};color:${fg};cursor:pointer;box-shadow:0 1px 3px rgba(11,15,43,.12)`;
    box.appendChild(b);
    return b;
  };
  const btnIn = mk(L.in, '<svg width="12" height="12" viewBox="0 0 12 12"><path d="M6 2v8M2 6h8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>');
  const btnOut = mk(L.out, '<svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 6h8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>');
  const btnReset = mk(L.reset, '<svg width="12" height="12" viewBox="0 0 12 12"><path d="M2.5 6a3.5 3.5 0 1 0 1.1-2.55M2.5 1.8v2.2h2.2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>');
  const hint = document.createElement('div');
  hint.style.cssText = `position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);padding:8px 12px;border-radius:8px;background:${dark ? '#F2F3FA' : '#141A3F'};color:${dark ? '#141A3F' : '#FCFBF9'};font:12.5px/1.4 ${svg.getAttribute('font-family') || 'system-ui'};pointer-events:none;opacity:0;transition:opacity .2s;z-index:6`;
  hint.textContent = L.hint;
  root.appendChild(box); root.appendChild(hint);
  svg.style.userSelect = 'none';
  svg.style.webkitUserSelect = 'none';
  const place = () => {
    const r = svg.getBoundingClientRect(), rr = root.getBoundingClientRect();
    const s = r.width / (svg.viewBox.baseVal.width || r.width);
    box.style.left = (r.left - rr.left + (bx + bw) * s - 3 * 32) + 'px';
    box.style.top = (r.top - rr.top + by * s + 4) + 'px';
  };
  place();
  root.addEventListener('pointerenter', () => { place(); box.style.opacity = '1'; });
  root.addEventListener('pointerleave', () => { box.style.opacity = st.k > 1.02 ? '1' : '0'; });
  root.addEventListener('focusin', () => { place(); box.style.opacity = '1'; });
  const center = () => [bx + bw / 2, by + bh / 2];
  btnIn.addEventListener('click', () => zoomAt(st.k * 1.6, ...center(), true));
  btnOut.addEventListener('click', () => zoomAt(st.k / 1.6, ...center(), true));
  btnReset.addEventListener('click', reset);
  apply(st);

  let moved = false;
  svg.addEventListener('click', (ev) => {
    if (moved) { moved = false; return; }
    if (!(ev.target.closest && ev.target.closest('.pa-zoom'))) return;
    const m = ev.target.closest && ev.target.closest('.pa-m');
    if (!m || !m.getBBox) return;
    const key = m.getAttribute('data-k') || m.getAttribute('d') || m.getAttribute('cx');
    if (st.key === key) { reset(); return; }
    const b = m.getBBox();
    const k = Math.max(1.4, Math.min(MAX, 0.62 * Math.min(bw / Math.max(b.width, 4), bh / Math.max(b.height, 4))));
    const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
    hide();
    go({ k, x: bx + bw / 2 - cx * k, y: by + bh / 2 - cy * k, key });
  });
  svg.addEventListener('dblclick', (ev) => { if (ev.target.closest && ev.target.closest('.pa-zoom')) { ev.preventDefault(); reset(); } });
  const onKey = (e) => { if (e.key === 'Escape' && st.k > 1.02 && root.isConnected) reset(); };
  if (root.__paKey) document.removeEventListener('keydown', root.__paKey);
  root.__paKey = onKey;
  document.addEventListener('keydown', onKey);

  let hintT = 0;
  svg.addEventListener('wheel', (ev) => {
    if (!(ev.target.closest && ev.target.closest('.pa-zoom-clip'))) return;
    if (!ev.ctrlKey && !ev.metaKey) {
      if (st.k > 1.02) return;
      hint.style.opacity = '1'; clearTimeout(hintT); hintT = setTimeout(() => (hint.style.opacity = '0'), 1100);
      return;
    }
    ev.preventDefault();
    const p = toSvg(ev.clientX, ev.clientY);
    zoomAt(st.k * Math.exp(-ev.deltaY * 0.004), p.x, p.y, false);
  }, { passive: false });

  const ptrs = new Map();
  let drag = null, pinch = null;
  svg.addEventListener('pointerdown', (ev) => {
    if (!(ev.target.closest && ev.target.closest('.pa-zoom-clip'))) return;
    moved = false;
    ptrs.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      const mid = toSvg((a.x + b.x) / 2, (a.y + b.y) / 2);
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), k: st.k, mid };
      drag = null;
    } else if (st.k > 1.02) {
      ev.preventDefault(); // sin selección de texto al arrastrar
      drag = { x: ev.clientX, y: ev.clientY, sx: st.x, sy: st.y };
    }
  });
  svg.addEventListener('pointermove', (ev) => {
    if (!ptrs.has(ev.pointerId)) return;
    ptrs.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    const s = (svg.viewBox.baseVal.width || 1) / svg.getBoundingClientRect().width;
    if (pinch && ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      zoomAt(pinch.k * Math.hypot(a.x - b.x, a.y - b.y) / (pinch.d || 1), pinch.mid.x, pinch.mid.y, false);
      moved = true;
    } else if (drag) {
      const dx = (ev.clientX - drag.x) * s, dy = (ev.clientY - drag.y) * s;
      if (Math.abs(dx) + Math.abs(dy) > 3) {
        moved = true;
        z.style.cursor = 'grabbing';
        if (!svg.hasPointerCapture(ev.pointerId)) svg.setPointerCapture(ev.pointerId);
        go({ ...st, x: drag.sx + dx, y: drag.sy + dy, key: null }, false);
        hide();
      }
    }
  });
  const up = (ev) => {
    ptrs.delete(ev.pointerId);
    if (ptrs.size < 2) pinch = null;
    if (!ptrs.size) { drag = null; z.style.cursor = st.k > 1.02 ? 'grab' : ''; }
  };
  svg.addEventListener('pointerup', up);
  svg.addEventListener('pointercancel', up);
}

const attachSource = `(function(){${mapZoom.toString()}\nreturn ${attach.toString()};})()`;

return { "attach": attach, "attachSource": attachSource };
});
__def("src/runtime.js", function () {
const { attach } = __req("src/interact.js");
const { themeFor, FONT_CSS } = __req("src/theme.js");
const { ensureData, fieldKind, uniq, num, PlotError } = __req("src/data.js");
const { parseDate, formatDate } = __req("src/format.js");
const { dateUnit } = __req("src/scale.js");

let plotFn = null;
let resolveFn = null;
/** index.js registra plot/resolve aquí (evita una importación circular). */
function _bind(plot, resolve) { plotFn = plot; resolveFn = resolve; }

const RANGE_TYPES = new Set(['line', 'area']);
const SNAP_EXCLUDE = new Set(['line', 'area', 'ecdf']);

function ensureAssets() {
  if (typeof document === 'undefined') return;
  if (!document.getElementById('pa-font')) {
    const l = document.createElement('link');
    l.id = 'pa-font'; l.rel = 'stylesheet'; l.href = FONT_CSS;
    document.head.appendChild(l);
  }
  if (document.getElementById('pa-runtime-css')) return;
  const st = document.createElement('style');
  st.id = 'pa-runtime-css';
  st.textContent = `
.pa-ctl{display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;padding:4px 0 2px;font-size:12px;color:var(--pa-muted);user-select:none}
.pa-play{flex:none;width:30px;height:30px;border-radius:50%;border:0;background:var(--pa-accent);color:var(--pa-surface);cursor:pointer;display:grid;place-items:center;padding:0}
.pa-play:focus-visible{outline:2px solid var(--pa-accent);outline-offset:2px}
.pa-play svg{display:block}
.pa-track{position:relative;flex:1 1 220px;min-width:0;height:40px}
.pa-track svg.pa-ov{position:absolute;left:0;top:0;width:100%;height:28px;overflow:visible}
.pa-track input[type=range]{position:absolute;left:0;width:100%;top:6px;margin:0;height:22px;background:transparent;-webkit-appearance:none;appearance:none;pointer-events:none}
.pa-track input[type=range]::-webkit-slider-runnable-track{background:transparent;height:22px}
.pa-track input[type=range]::-moz-range-track{background:transparent;height:22px}
.pa-track input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;pointer-events:auto;width:16px;height:16px;margin-top:3px;border-radius:50%;background:var(--pa-accent);border:2px solid var(--pa-surface);box-shadow:0 1px 4px rgba(11,15,43,.3);cursor:grab}
.pa-track input[type=range]::-moz-range-thumb{pointer-events:auto;width:12px;height:12px;border-radius:50%;background:var(--pa-accent);border:2px solid var(--pa-surface);box-shadow:0 1px 4px rgba(11,15,43,.3);cursor:grab}
.pa-track input[type=range]:focus-visible::-webkit-slider-thumb{outline:2px solid var(--pa-accent);outline-offset:2px}
.pa-ticks{position:absolute;left:0;right:0;top:28px;height:12px;font-size:10.5px;color:var(--pa-muted)}
.pa-ticks span{position:absolute;transform:translateX(-50%);white-space:nowrap}
.pa-now{flex:none;font-weight:600;color:var(--pa-ink);font-size:13px;min-width:4ch;text-align:right;font-variant-numeric:tabular-nums}
.pa-chart [data-drill],.pa-chart [data-node]{cursor:pointer}
.pa-chart [data-node]:focus-visible{outline:none;stroke:var(--pa-accent);stroke-width:3px}
@media (prefers-reduced-motion: reduce){.pa-m{transition:none!important}}`;
  document.head.appendChild(st);
}

/**
 * Dibuja `spec` en un elemento (o selector) del navegador.
 * Devuelve { svg, spec, update(spec), destroy() }.
 */
function render(target, spec, opts = {}) {
  const host = typeof target === 'string' ? document.querySelector(target) : target;
  if (!host) throw new PlotError('No encontré el elemento destino.', 'render("#grafico", spec) o render(elemento, spec)');
  ensureAssets();
  let state = resolveFn ? resolveFn(spec) : { ...spec };
  const fontUrl = themeFor(state).font?.import;
  if (fontUrl && typeof document !== 'undefined' && !document.querySelector(`link[href="${fontUrl}"]`)) {
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = fontUrl; document.head.appendChild(l);
  }
  host.innerHTML = '';
  const chart = document.createElement('div');
  const ctl = document.createElement('div');
  host.appendChild(chart);
  host.appendChild(ctl);
  let timer = null, ro = null, raf = 0;

  const width = () => state.width ?? Math.max(280, Math.round(chart.clientWidth || host.clientWidth || 720));
  const nodePos = () => {
    const m = new Map();
    for (const c of chart.querySelectorAll('[data-node]')) m.set(c.getAttribute('data-node'), [+c.getAttribute('cx'), +c.getAttribute('cy')]);
    return m;
  };
  const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const animateFrom = (before) => {
    if (reduced || !before.size || typeof Element === 'undefined' || !Element.prototype.animate) return;
    const ease = 'cubic-bezier(.2,.7,.2,1)';
    for (const c of chart.querySelectorAll('[data-node]')) {
      const old = before.get(c.getAttribute('data-node'));
      if (!old) continue;
      const dx = old[0] - +c.getAttribute('cx'), dy = old[1] - +c.getAttribute('cy');
      c.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'translate(0,0)' }], { duration: 650, easing: ease });
    }
    for (const sel of ['.pa-links', '.pa-labels']) {
      const n = chart.querySelector(sel);
      if (n) n.animate([{ opacity: 0 }, { opacity: 0 }, { opacity: 1 }], { duration: 750, easing: 'ease-out' });
    }
  };
  const regionFills = () => {
    const m = new Map();
    for (const n of chart.querySelectorAll('.pa-regions [data-k]')) { const f = n.getAttribute('fill'); if (/^#/.test(f || '')) m.set(n.getAttribute('data-k'), f); }
    return m;
  };
  const tweenFills = (before) => {
    if (reduced || !before.size || typeof Element === 'undefined' || !Element.prototype.animate) return;
    for (const n of chart.querySelectorAll('.pa-regions [data-k]')) {
      const old = before.get(n.getAttribute('data-k')), now = n.getAttribute('fill');
      if (old && /^#/.test(now || '') && old.toLowerCase() !== now.toLowerCase()) n.animate([{ fill: old }, { fill: now }], { duration: 420, easing: 'ease-out' });
    }
  };
  const draw = () => {
    const before = nodePos();
    const fills = regionFills();
    chart.innerHTML = plotFn({ ...state, width: width() });
    animateFrom(before);
    tweenFills(fills);
    chart.__pa = false;
    attach(chart);
    for (const n of chart.querySelectorAll('[data-node]')) {
      n.setAttribute('tabindex', '0');
      n.setAttribute('role', 'button');
      const id = n.getAttribute('data-node');
      const go = () => { state = { ...state, focus: String(state.focus) === id ? undefined : id }; draw(); };
      n.addEventListener('click', go);
      n.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    }
    for (const n of chart.querySelectorAll('[data-drill]')) {
      n.setAttribute('tabindex', '0');
      n.setAttribute('role', 'button');
      const go = () => { state = { ...state, focus: JSON.parse(n.getAttribute('data-drill')) }; draw(); };
      n.addEventListener('click', go);
      n.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    }
  };
  const schedule = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); };

  const theme = themeFor(state);
  ctl.className = 'pa-ctl';
  ctl.style.cssText = `--pa-accent:${theme.categorical[0]};--pa-surface:${theme.surface};--pa-ink:${theme.ink};--pa-muted:${theme.muted};--pa-tint:${theme.tint};background:${theme.surface};padding-left:${state.padding ?? 24}px;padding-right:${state.padding ?? 24}px;padding-bottom:6px;font-family:${(theme.font?.family || 'system-ui').replace(/"/g, "'")}`;
  ctl.hidden = true;

  if (opts.controls !== false && state.slider !== false) {
    if (state.time && !SNAP_EXCLUDE.has(state.type) && state.x !== state.time) buildPeriod();
    else if (RANGE_TYPES.has(state.type)) buildRange();
  }

  function buildPeriod() {
    const vals = timeValuesOf(state);
    if (vals.length < 2) return;
    let i = vals.findIndex((v) => String(v) === String(state.timeValue ?? vals[vals.length - 1]));
    if (i < 0) i = vals.length - 1;
    ctl.hidden = false;
    const play = button();
    const track = document.createElement('div'); track.className = 'pa-track';
    const ov = svgEl('svg', { class: 'pa-ov', viewBox: '0 0 100 28', preserveAspectRatio: 'none' });
    ov.appendChild(svgEl('rect', { x: 0, y: 13, width: 100, height: 3, rx: 1.5, fill: theme.tint2 || theme.tint }));
    const fill = svgEl('rect', { x: 0, y: 13, height: 3, rx: 1.5, fill: theme.categorical[0] });
    ov.appendChild(fill);
    track.appendChild(ov);
    const input = range(0, vals.length - 1, i, 'Periodo');
    track.appendChild(input);
    const now = document.createElement('span'); now.className = 'pa-now';
    if (state.play === false) ctl.append(track, now); else ctl.append(play, track, now);
    track.appendChild(ticks(vals.map(String), (k) => k / (vals.length - 1), null, track));
    const set = (k) => {
      i = k; input.value = k;
      fill.setAttribute('width', (100 * k) / (vals.length - 1));
      now.textContent = String(vals[k]);
      state = { ...state, timeValue: vals[k] };
      schedule();
    };
    input.addEventListener('input', () => { stop(); set(+input.value); });
    play.addEventListener('click', () => {
      if (timer) return stop();
      if (i >= vals.length - 1) set(0);
      setIcon(play, 'pause');
      timer = setInterval(() => { if (i >= vals.length - 1) return stop(); set(i + 1); }, state.playInterval ?? 1000);
    });
    function stop() { clearInterval(timer); timer = null; setIcon(play, 'play'); }
    set(i);
  }

  function buildRange() {
    const data = ensureData(state);
    const xf = state.x;
    if (!xf || !data.length || !(xf in data[0])) return;
    const kind = fieldKind(data, xf);
    if (!['date', 'year', 'number'].includes(kind)) return;
    const raw = uniq(data.map((r) => r[xf]));
    const val = (v) => (kind === 'date' ? parseDate(v) : num(v));
    const xs = raw.map((v) => ({ v, t: val(v) })).filter((p) => Number.isFinite(p.t)).sort((a, b) => a.t - b.t);
    if (xs.length < (state.sliderMin ?? 6)) return;
    ctl.hidden = false;
    const ys = Array.isArray(state.y) ? state.y : [state.y];
    const tot = new Map(xs.map((p) => [p.t, 0]));
    for (const r of data) { const t = val(r[xf]); if (tot.has(t)) tot.set(t, tot.get(t) + ys.reduce((a, f) => a + (Number.isFinite(num(r[f])) ? num(r[f]) : 0), 0)); }
    const tv = xs.map((p) => tot.get(p.t));
    const mn = Math.min(...tv), mx = Math.max(...tv);
    const t0 = xs[0].t, t1 = xs[xs.length - 1].t;
    const px = (t) => (100 * (t - t0)) / (t1 - t0 || 1);
    const py = (v) => 26 - (22 * (v - mn)) / (mx - mn || 1);
    const track = document.createElement('div'); track.className = 'pa-track';
    const ov = svgEl('svg', { class: 'pa-ov', viewBox: '0 0 100 28', preserveAspectRatio: 'none' });
    const d = xs.map((p, k) => `${k ? 'L' : 'M'}${px(p.t).toFixed(2)},${py(tv[k]).toFixed(2)}`).join('');
    ov.appendChild(svgEl('path', { d: d + `L100,28L0,28Z`, fill: theme.muted, 'fill-opacity': 0.12 }));
    ov.appendChild(svgEl('path', { d, fill: 'none', stroke: theme.muted, 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke' }));
    const sel = svgEl('rect', { y: 0, height: 28, rx: 3, fill: theme.categorical[0], 'fill-opacity': 0.08 });
    ov.appendChild(sel);
    track.appendChild(ov);
    const fmtX = (p) => (kind === 'date' ? formatDate(p.t, dateUnit(xs.map((q) => q.t)), state.locale || 'es') : String(p.v));
    let lo = 0, hi = xs.length - 1;
    if (state.xRange) {
      const a = xs.findIndex((p) => p.t >= val(state.xRange[0])), b = xs.map((p) => p.t <= val(state.xRange[1])).lastIndexOf(true);
      if (a >= 0) lo = a; if (b >= 0) hi = b;
    }
    const a = range(0, xs.length - 1, lo, 'Desde'), b = range(0, xs.length - 1, hi, 'Hasta');
    const yearOf = (p) => new Date(p.t).getUTCFullYear();
    const tickLabels = kind === 'date' ? xs.map((p) => String(yearOf(p))) : xs.map(fmtX);
    const keep = kind === 'date' ? (k) => k === 0 || yearOf(xs[k]) !== yearOf(xs[k - 1]) : null;
    track.append(a, b);
    const now = document.createElement('span'); now.className = 'pa-now';
    now.textContent = `${fmtX(xs[0])} – ${fmtX(xs[xs.length - 1])}`;
    ctl.append(track, now);
    track.appendChild(ticks(tickLabels, (k) => px(xs[k].t) / 100, keep, track));
    const set = () => {
      let i0 = +a.value, i1 = +b.value;
      if (i1 - i0 < 1) { if (document.activeElement === a) a.value = i0 = Math.max(0, i1 - 1); else b.value = i1 = Math.min(xs.length - 1, i0 + 1); }
      sel.setAttribute('x', px(xs[i0].t)); sel.setAttribute('width', Math.max(0.5, px(xs[i1].t) - px(xs[i0].t)));
      now.textContent = `${fmtX(xs[i0])} – ${fmtX(xs[i1])}`;
      state = { ...state, xRange: i0 === 0 && i1 === xs.length - 1 ? undefined : [xs[i0].v, xs[i1].v] };
      schedule();
    };
    a.addEventListener('input', set); b.addEventListener('input', set);
    set();
  }

  function ticks(labels, pos, keep, trackEl) {
    const box = document.createElement('div'); box.className = 'pa-ticks';
    const n = labels.length;
    const trackW = Math.max(120, (trackEl && trackEl.clientWidth) || (host.clientWidth || 600) - 180);
    const lw = Math.max(...labels.map((l) => String(l).length)) * 6.2 + 14;
    const every = Math.max(1, Math.ceil((n * lw) / trackW));
    let lastPx = -Infinity;
    labels.forEach((l, k) => {
      if (keep ? !keep(k) : k % every && k !== n - 1) return;
      const px = pos(k) * trackW;
      if (px - lastPx < lw && k !== n - 1) return;
      if (k === n - 1 && px - lastPx < lw) return;
      lastPx = px;
      const s = document.createElement('span'); s.textContent = l; s.style.left = (pos(k) * 100).toFixed(2) + '%';
      if (k === 0) s.style.transform = 'none';
      if (k === n - 1) s.style.transform = 'translateX(-100%)';
      box.appendChild(s);
    });
    return box;
  }

  host.addEventListener('keydown', (e) => { if (e.key === 'Escape' && state.focus !== undefined && state.type === 'network') { state = { ...state, focus: undefined }; draw(); } });

  draw();
  if (state.width === undefined && typeof ResizeObserver !== 'undefined') {
    let last = host.clientWidth;
    ro = new ResizeObserver(() => { if (Math.abs(host.clientWidth - last) > 8) { last = host.clientWidth; schedule(); } });
    ro.observe(host);
  }
  return {
    get svg() { return chart.querySelector('svg'); },
    get spec() { return state; },
    update(next) { clearInterval(timer); ro && ro.disconnect(); return render(host, next, opts); },
    destroy() { clearInterval(timer); ro && ro.disconnect(); host.innerHTML = ''; },
  };
}

function timeValuesOf(s) {
  const data = ensureData(s);
  const k = fieldKind(data, s.time);
  return uniq(data.map((r) => r[s.time]).filter((v) => v !== null && v !== undefined && v !== ''))
    .sort((a, b) => (k === 'date' ? parseDate(a) - parseDate(b) : k === 'year' || k === 'number' ? num(a) - num(b) : 0));
}

function svgEl(tag, attrs) {
  const n = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
}
function range(min, max, value, label) {
  const i = document.createElement('input');
  i.type = 'range'; i.min = min; i.max = max; i.step = 1; i.value = value;
  i.setAttribute('aria-label', label);
  return i;
}
function button() {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'pa-play';
  setIcon(b, 'play');
  return b;
}
function setIcon(b, kind) {
  b.setAttribute('aria-label', kind === 'play' ? 'Reproducir' : 'Pausar');
  b.innerHTML = kind === 'play'
    ? '<svg width="12" height="12" viewBox="0 0 12 12"><path d="M3 1.5v9l7.5-4.5z" fill="currentColor"/></svg>'
    : '<svg width="12" height="12" viewBox="0 0 12 12"><rect x="2.5" y="1.5" width="2.5" height="9" rx="1" fill="currentColor"/><rect x="7" y="1.5" width="2.5" height="9" rx="1" fill="currentColor"/></svg>';
}

return { "_bind": _bind, "render": render };
});
global.plotagents = __req("src/index.js");
})(typeof window !== 'undefined' ? window : globalThis);
