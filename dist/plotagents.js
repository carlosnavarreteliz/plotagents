/*! plotagents 0.3.0 · MIT · https://github.com/carlosnavarreteliz/plotagents */
(function (global) {
'use strict';
var __defs = {}, __cache = {};
function __def(id, fn) { __defs[id] = fn; }
function __req(id) { if (!__cache[id]) { __cache[id] = { loading: true }; __cache[id] = __defs[id](); } return __cache[id]; }
__def("src/index.js", function () {
const { getTheme, themeFor, themes, palettes, ramps, colorMap, FONT_CSS } = __req("src/theme.js");
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
const { heatmap } = __req("src/charts/heatmap.js");
const { sankey } = __req("src/charts/sankey.js");
const { kpi } = __req("src/charts/kpi.js");
const { ensureData, PlotError, fieldKind, uniq, num } = __req("src/data.js");
const { facet } = __req("src/facet.js");
const { parseDate } = __req("src/format.js");
const { inferType, TYPES, ALIASES, normalizeType } = __req("src/infer.js");
const { lint } = __req("src/lint.js");
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
};



/** Normaliza el spec: tipo inferido y datos como filas. */
function resolve(spec = {}) {
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
function plot(spec) {
  let s = resolve(spec);
  s = applyTime(s);
  const theme = themeFor(s);
  if (s.facet || s.col) return facet(s, theme, (p) => RENDERERS[s.type](p, themeFor(p)));
  return RENDERERS[s.type](s, theme);
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
function bundleSource() {
  try {
    const fs = globalThis.process?.getBuiltinModule?.('node:fs');
    if (!fs) return null;
    return fs.readFileSync(new URL('../dist/plotagents.js', "about:blank"), 'utf8');
  } catch {
    return null;
  }
}

_bind(plot, resolve);






return { "resolve": resolve, "plot": plot, "timeValues": timeValues, "safePlot": safePlot, "describe": describe, "toHTML": toHTML, "bundleSource": bundleSource, "default": plot, "render": render, "RENDERERS": RENDERERS, "ALIASES": ALIASES, "lint": lint, "schema": schema, "toolDefinition": toolDefinition, "themes": themes, "palettes": palettes, "ramps": ramps, "validatePalette": validatePalette, "getTheme": getTheme, "themeFor": themeFor, "attach": attach, "PlotError": PlotError, "TYPES": TYPES, "squarify": squarify, "makeFormat": makeFormat, "formatNumber": formatNumber, "formatCompact": formatCompact };
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

return { "deepMerge": deepMerge, "getTheme": getTheme, "themeFor": themeFor, "hexToRgb": hexToRgb, "rgbToHex": rgbToHex, "luminance": luminance, "contrast": contrast, "textOn": textOn, "ramp": ramp, "colorMap": colorMap, "readable": readable, "FONT": FONT, "MONO": MONO, "FONT_CSS": FONT_CSS, "themes": themes, "palettes": palettes, "ramps": ramps };
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
const { createFrame, SIZES } = __req("src/frame.js");

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
  let folded = 0;
  if (top && cats.length > top) {
    const keep = cats.slice(0, top);
    const rest = cats.slice(top);
    folded = rest.length;
    const otherName = String(spec.locale || 'es').startsWith('en') ? 'Other' : 'Otros';
    values.set(otherName, seriesKeys.map((_, i) => rest.reduce((a, c) => a + values.get(c)[i], 0)));
    cats = [...keep, otherName];
  }
  return { data, x, y, series, seriesKeys, cats, values, kind, nominal, folded, total, errs, errorbar };
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
    if (hl) return hl.has(c) ? theme.categorical[0] : theme.dim;
    return c === 'Otros' || c === 'Other' ? theme.other : theme.categorical[0];
  };
  const legend = multi && spec.legend !== false ? seriesKeys.map((s) => ({ label: s, color: cmap.get(s), shape: 'square' })) : [];

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
    const inner = { x: area.x + leftM, y: area.y + top, w: area.w - leftM, h: area.h - top - 26 };
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
          parts.push(g({ class: 'pa-m', 'data-tip': tip(c, `${seriesKeys[i]}: ${fmt(pct ? s.vv : s.v)}`) }, [el('path', { d, fill: colorFor(c, i) })]));
        });
        if (showLabels && !pct) {
          const t = m.total(c);
          const ty = t >= 0 ? yS(Math.max(0, ...sg.map((s) => s.to))) - 7 : yS(Math.min(0, ...sg.map((s) => s.to))) + 15;
          parts.push(text(bx + bw / 2, ty, fmt(t), { fill: theme.ink, fontSize: SIZES.label, fontWeight: 600, textAnchor: 'middle' }));
        }
        body.push(g({ 'data-tip': tip(c, ...sg.map((s, i) => `${seriesKeys[i]}: ${fmt(pct ? s.vv : s.v)}`), pct ? '' : `Total: ${fmt(m.total(c))}`) }, [hit, ...parts]));
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
          parts.push(g({ class: 'pa-m', 'data-tip': tip(c, label) }, [
            el('rect', { x: bxI - 1, y: inner.y, width: w + 2, height: inner.h, fill: 'transparent' }),
            el('path', { d, fill: colorFor(c, i) }),
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
    const step = multi && !stack ? Math.min(maxBar, 16) * k + 2 * (k - 1) + 10 : maxBar + 9;
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
          parts.push(g({ class: 'pa-m', 'data-tip': tip(c, `${seriesKeys[i]}: ${fmt(pct ? s.vv : s.v)}`) }, [
            el('path', { d, fill }),
            fits ? text(left + 6, y0b + h / 2 + 4, lab, { fill: textColor(fill, theme), fontSize: 11, fontWeight: 600 }) : '',
          ]));
        });
        if (showLabels && !pct) parts.push(text(xS(Math.max(0, ...sg.map((s) => s.to))) + 7, by + bh / 2 + 4.5, fmt(m.total(c)), { fill: theme.ink, fontSize: SIZES.label, fontWeight: 600 }));
        body.push(g({ 'data-tip': tip(c, ...sg.map((s, i) => `${seriesKeys[i]}: ${fmt(pct ? s.vv : s.v)}`)) }, parts));
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
          parts.push(g({ class: 'pa-m', 'data-tip': tip(c, (multi ? `${seriesKeys[i]}: ` : '') + fmt(v) + erTxt) }, [el('path', { d, fill: colorFor(c, i) }), errBar(er, (e) => [xS(e), yy + h / 2], false, theme)]));
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
  return frame.finish(body, { desc, type: 'bar' });
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

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

/** Redondea a 2 decimales para SVG compactos. */
const r2 = (n) => Math.round(n * 100) / 100;

const ATTR_ALIAS = { className: 'class' };
const KEEP_CASE = new Set(['viewBox', 'preserveAspectRatio', 'gradientUnits', 'gradientTransform', 'patternUnits', 'clipPathUnits']);

function el(tag, attrs = {}, children) {
  let s = '<' + tag;
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    const name = ATTR_ALIAS[k] || (KEEP_CASE.has(k) ? k : k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase()));
    const val = typeof v === 'number' ? r2(v) : v;
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
  return w * size * bold * 1.05; // margen: Mozilla Text es un poco más ancha
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
  const ly = y ?? area.y + area.h + 18;
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
const yAxisTop = (theme, inside) => (isInside(theme, inside) ? 14 : 6);

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
      ? text(area.x, py - 5, label, { fill: theme.muted, fontSize: size, stroke: theme.surface, strokeWidth: 3, paintOrder: 'stroke', strokeLinejoin: 'round' })
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
  let height = Math.max(160, +spec.height || defaults.height || 420);
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
  const tlh = Math.round(T.title * 1.3), slh = Math.round(T.subtitle * 1.42);
  titleLines.forEach((l, i) => {
    header.push(text(pad, y + T.title * 0.9 + i * tlh, l, { fill: theme.ink, fontSize: T.title, fontWeight: tw, letterSpacing: '-0.01em' }));
  });
  if (titleLines.length) y += titleLines.length * tlh + 2;
  subLines.forEach((l, i) => {
    header.push(text(pad, y + T.subtitle * 1.0 + i * slh, l, { fill: theme.lede, fontSize: T.subtitle }));
  });
  if (subLines.length) y += subLines.length * slh + 2;
  if (titleLines.length || subLines.length) y += 10;

  const sourceH = spec.source ? 18 : 0;

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
      return { x: pad, y: ly, w: innerW, h: Math.max(40, frame.bottom - ly) };
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
      const style = `${fontImport}.pa-m{transition:opacity .15s ease}.pa-focus .pa-m{opacity:.28}.pa-focus .pa-m.pa-on{opacity:1}`;
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
  const rowH = 20;
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
    const w = 18 + measure(label, size) + 18;
    if (x + w > x0 + maxW && x > x0) { x = x0; y += rowH; rows++; }
    const cy = y + 6.5;
    out.push(`<g class="pa-key" data-color="${it.color}" style="cursor:pointer">`);
    out.push(el('rect', { x: x - 3, y: y - 3, width: w - 10, height: 19, rx: 4, fill: 'transparent' }));
    if (it.shape === 'line') out.push(el('line', { x1: x, x2: x + 12, y1: cy, y2: cy, stroke: it.color, strokeWidth: 2.5, strokeLinecap: 'round' }));
    else if (it.shape === 'square') out.push(el('rect', { x, y: cy - 5, width: 10, height: 10, rx: 2.5, fill: it.color }));
    else out.push(el('circle', { cx: x + 5, cy, r: 5, fill: it.color }));
    out.push(text(x + 16, y + 11, label, { fill: theme.lede, fontSize: size }));
    out.push('</g>');
    x += w;
  }
  return { svg: g({ class: 'pa-legend' }, out), h: rows * rowH - 6 };
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
__def("src/charts/line.js", function () {
const { el, g, text, tip } = __req("src/svg.js");
const { measure, truncate } = __req("src/text.js");
const { makeFormat, formatDate, parseDate } = __req("src/format.js");
const { niceDomain, linear, log, logDomain, timeTicks, dateUnit, niceStep } = __req("src/scale.js");
const { colorMap, readable } = __req("src/theme.js");
const { ensureData, inferXY, requireField, melt, uniq, aggregate, num, fieldKind, xValue, humanize } = __req("src/data.js");
const { xLabels, refLinesY, yAxisMargin, yAxisTop, yGrid, yTickLabels } = __req("src/axes.js");
const { createFrame } = __req("src/frame.js");
const { meanCI, mean, sd } = __req("src/stats.js");
const { hash } = __req("src/frame.js");

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
  const maxLabels = Math.max(1, Math.floor(provisionalH / (labelSize + 3)));
  const labeled = want ? m.lines.filter((l) => focus(l.key)).sort((a, b) => (lastOf(b)?.y ?? -Infinity) - (lastOf(a)?.y ?? -Infinity)).slice(0, maxLabels) : [];
  const allLabeled = labeled.length === m.lines.filter((l) => focus(l.key)).length;
  const needLegend = multi && (!want || !allLabeled || spec.legend === true) && spec.legend !== false;
  const legend = needLegend ? m.seriesKeys.map((s) => ({ label: s, color: colorOf(s), shape: isArea ? 'square' : 'line' })) : [];
  const area = frame.layout(legend);

  const endW = labeled.length
    ? Math.max(...labeled.map((l) => { const t = endText(l); return t ? measure(t.val, labelSize, 600) + (t.name ? measure(t.name, labelSize, 500) + 6 : 0) : 0; })) + 22
    : 10;

  const nd = yLog ? logDomain(ymin, ymax) : spec.yDomain ? { min: ymin, max: ymax, step: niceStep(ymax - ymin, Math.max(3, Math.round(area.h / 64))) } : niceDomain(ymin, ymax, Math.max(3, Math.round(area.h / 64)));
  const tickF = yLog ? (v) => fmt.tick(v)(v) : fmt.tick(nd.step);
  const yTicksArr = (yLog ? log(nd.min, nd.max, 0, 1) : linear(nd.min, nd.max, 0, 1)).ticks(nd.step);
  const inside = stack ? false : spec.axisInside;
  const leftM = yAxisMargin(yTicksArr, tickF, theme, inside);
  const yTop = area.y + yAxisTop(theme, inside) + (spec.yLabel ? 16 : 0);
  const inner = { x: area.x + leftM, y: yTop, w: Math.max(80, area.w - leftM - endW), h: area.y + area.h - yTop - 24 - (spec.xLabel ? 16 : 0) };
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
        parts.push(el('path', { d, fill: washSingle ? `url(#${gid})` : c, fillOpacity: washSingle ? 1 : stack ? 0.9 : M.areaOpacity ?? 0.12, stroke: stack ? theme.surface : 'none', strokeWidth: stack ? 1.5 : 0 }));
      }
    }
    if (!stack) for (const sgm of segs) parts.push(el('path', { d: curve(sgm.map(([a, b]) => [a, b])), fill: 'none', stroke: c, strokeWidth: focus(l.key) ? (hl ? lw + 0.75 : lw) : 1.5, strokeLinejoin: 'round', strokeLinecap: 'round' }));
    const pts = segs.flat();
    if (showDots && focus(l.key) && !stack) for (const [a, b] of pts) parts.push(el('circle', { cx: a, cy: b, r: (M.pointRadius ?? 4) - 0.5, fill: c, stroke: theme.surface, strokeWidth: M.ring ?? 2 }));
    if (focus(l.key) && !stack) {
      const [a, b] = pts[pts.length - 1];
      parts.push(el('circle', { cx: a, cy: b, r: (M.pointRadius ?? 4) + 0.5, fill: c, stroke: theme.surface, strokeWidth: M.ring ?? 2 }));
    }
    body.push(g({ class: 'pa-m', 'data-series': l.key }, parts));
  }

  body.push(refLinesY(refs, yS, inner, theme, fmt));
  body.push(yTickLabels(yTicks, yS, inner, theme, tickF, { inside }));

  if (labeled.length) {
    const lh = labelSize + 3;
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
        tparts.push(text(lx + measure(lb.name, labelSize, 500) + 6, lb.y + 4, lb.val, { fill: tc, fontSize: labelSize, fontWeight: 700 }));
      } else tparts.push(text(lx, lb.y + 4.5, lb.val, { fill: readable(lb.color, theme), fontSize: labelSize + 0.5, fontWeight: 700 }));
      body.push(g({ class: 'pa-endlabel' }, tparts));
    }
  }

  const cross = xsAll.map((xv) => ({
    x: +xS(xv).toFixed(1),
    t: xFmt(xv),
    v: m.lines.filter((l) => focus(l.key)).map((l) => {
      const p = l.points.find((q) => q.x === xv);
      if (!p || !Number.isFinite(p.y)) return null;
      const extra = Number.isFinite(p.lo) ? ` (${fmt(p.lo)}–${fmt(p.hi)})` : '';
      return [multi ? l.key : m.seriesKeys[0], colorOf(l.key), +yS(p.y).toFixed(1), fmt(stack ? p.v : p.y) + extra];
    }).filter(Boolean),
  }));
  body.push(el('rect', { class: 'pa-cross', x: inner.x - 4, y: inner.y, width: inner.w + 8, height: inner.h, fill: 'transparent', 'data-cross': JSON.stringify(cross), 'data-y0': inner.y, 'data-y1': inner.y + inner.h }));

  const desc = describeLine(m, fmt, xFmt, locale);
  return frame.finish(body, { desc, type: isArea ? 'area' : 'line', defs });
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
const { buildHierarchy, findNode, assignColors, shareFmt, breadcrumb, height, SEP } = __req("src/hierarchy.js");

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
    const pr = buildHierarchy({ ...spec, data: prevRows, time: undefined }).root;
    (function walk(n) { prevMap.set(n.path.join('\u0000'), n.value); n.children.forEach(walk); })(pr);
  }
  const changeOf = (n) => { const pv = prevMap.get(n.path.join('\u0000')); return pv > 0 ? n.value / pv - 1 : null; };
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
    if (top.some((c) => c.folded)) legend.push({ label: en ? 'Other' : 'Otros', color: theme.other, shape: 'square' });
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
      ch !== null ? `${pctTxt(ch)} ${prevLabel ? 'vs ' + prevLabel : ''}`.trim() : ''
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
    const lh = size * 1.14;
    const pctSize = Math.max(9.5, size * 0.78);
    const sub = value ? `${pct} · ${value}` : pct;
    const need = pad + lines.length * lh + 3 + pctSize + pad * 0.5;
    const widest = Math.max(...lines.map((l) => measure(l, size, 600)), measure(sub, pctSize));
    const fitsW = lines.every((l) => measure(l, size, 600) <= w - pad * 2) && !/…$/.test(lines[lines.length - 1]);
    if (fitsW && widest <= w - pad * 2 && need <= h) {
      lines.forEach((l, i) => out.push(text(x + pad, y + pad + size * 0.88 + i * lh, l, { fill, fontSize: size, fontWeight: 600 })));
      out.push(text(x + pad, y + pad + size * 0.88 + (lines.length - 1) * lh + pctSize + 4, sub, { fill, fontSize: pctSize, opacity: 0.86 }));
      return out;
    }
    if (lines.length === 1 && fitsW && pad + lh <= h) {
      out.push(text(x + pad, y + pad + size * 0.88, lines[0], { fill, fontSize: size, fontWeight: 600 }));
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
  return { root, fields: path.slice(0, levels), valueField: value, data };
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
  const top = displayRoot.children;
  const n = theme.categorical.length;
  const fold = top.length > n;
  top.forEach((c, i) => {
    const fixed = spec.colors && spec.colors[c.name];
    c.color = fixed || (single ? theme.categorical[0] : fold && i >= n - 1 ? theme.other : theme.categorical[i] || theme.other);
    c.folded = !fixed && !single && fold && i >= n - 1;
  });
  const steps = [0, 0.14, 0.07, 0.2, 0.1];
  const toward = theme.surface;
  const rec = (node) => node.children.forEach((c, i) => {
    if (node !== displayRoot) c.color = (spec.colors && spec.colors[c.name]) || (spec.shade ? mix(node.color, toward, steps[i % steps.length]) : node.color);
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

return { "hierarchyFields": hierarchyFields, "buildHierarchy": buildHierarchy, "findNode": findNode, "mix": mix, "assignColors": assignColors, "shareFmt": shareFmt, "breadcrumb": breadcrumb, "height": height, "descendants": descendants, "SEP": SEP };
});
__def("src/charts/donut.js", function () {
const { el, g, text, tip } = __req("src/svg.js");
const { measure, truncate } = __req("src/text.js");
const { makeFormat, formatNumber } = __req("src/format.js");
const { colorMap, textOn } = __req("src/theme.js");
const { ensureData, requireField, num, fieldsOf, fieldKind, humanize } = __req("src/data.js");
const { createFrame } = __req("src/frame.js");

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

  const rowH = 28;
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
    body.push(el('path', { class: 'pa-m', d: arc(cx, cy, R, r0, q.a0, q.a1), fill: colorOf(q.s), stroke: theme.surface, strokeWidth: sep, strokeLinejoin: 'round', 'data-tip': tip(q.s.k, `${fmt(q.s.v)} · ${pct(q.s.v)}`) }));
  }

  if (inner) {
    const rl = isPie ? R * 0.64 : (R + r0) / 2;
    const thick = R - r0;
    for (const q of geo) {
      const fill = colorOf(q.s);
      const ink = textOn(fill, theme);
      const p = pct(q.s.v);
      const size = isPie ? 13 : 12;
      const chord = (q.a1 - q.a0) * rl;
      const x = cx + rl * Math.cos(q.mid), y = cy + rl * Math.sin(q.mid);
      const showName = mode === 'inside' && chord >= measure(q.s.k, 11.5) + 12 && (isPie || thick >= 40);
      if (chord >= measure(p, size, 600) + 10 && (isPie || thick >= size + 8)) {
        body.push(text(x, y + (showName ? -2 : size * 0.35), p, { fill: ink, fontSize: size, fontWeight: 600, textAnchor: 'middle', pointerEvents: 'none' }));
        if (showName) body.push(text(x, y + 13, q.s.k, { fill: ink, fontSize: 11.5, textAnchor: 'middle', opacity: 0.9, pointerEvents: 'none' }));
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
      body.push(g({ 'data-tip': tip(q.s.k, `${fmt(q.s.v)} · ${pct(q.s.v)}`) }, parts));
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
      body.push(text(cx, cy - 6 - bigSize - 2, truncate(small, r0 * 1.6, 12), { fill: theme.lede, fontSize: 12, textAnchor: 'middle' }));
    } else {
      body.push(text(cx, cy + bigSize * 0.32, big, { fill: theme.ink, fontSize: bigSize, fontWeight: 600, textAnchor: 'middle' }));
      body.push(text(cx, cy + bigSize * 0.32 + 18, truncate(small, r0 * 1.6, 12), { fill: theme.lede, fontSize: 12, textAnchor: 'middle' }));
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
        el('rect', { x: tx, y: y - 5, width: 10, height: 10, rx: 2.5, fill: colorOf(s) }),
        text(tx + 18, y + 4.5, truncate(s.k, lw - 18 - valW - pctW - 28, 13), { fill: strong ? theme.ink : theme.muted, fontSize: 13 }),
        text(tx + lw - valW - 14, y + 4.5, pct(s.v), { fill: theme.ink, fontSize: 13, fontWeight: 600, textAnchor: 'end' }),
        text(tx + lw, y + 4.5, fmt(s.v), { fill: theme.muted, fontSize: 12.5, textAnchor: 'end' }),
      ];
      body.push(g({ 'data-tip': tip(s.k, `${fmt(s.v)} · ${pct(s.v)}`) }, parts));
    });
  }

  const kind = isPie ? (en ? 'Pie chart' : 'Gráfico de torta') : en ? 'Donut chart' : 'Gráfico de dona';
  const desc = `${kind} ${en ? 'of' : 'de'} ${humanize(valueF).toLowerCase()}. ` + slices.map((s) => `${s.k} ${pct(s.v)}`).join(', ') + '.';
  return frame.finish(body, { desc, type: isPie ? 'pie' : 'donut' });
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
const { buildHierarchy, findNode, assignColors, shareFmt, breadcrumb, height, SEP } = __req("src/hierarchy.js");

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
    ? [...top.filter((c) => !c.folded).map((c) => ({ label: c.name, color: c.color, shape: 'square' })), ...(top.some((c) => c.folded) ? [{ label: en ? 'Other' : 'Otros', color: theme.other, shape: 'square' }] : [])]
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
    const t = tip(n.path.join(SEP), `${fmt(n.value)} · ${share(n.value, grand)} ${en ? 'of total' : 'del total'}`, parent ? `${share(n.value, parent.value)} ${en ? 'of' : 'de'} ${parent.name}` : '');
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
  if (x) body.push(text(inner.x + inner.w, inner.y + inner.h + 38, x, { fill: theme.lede, fontSize: size + 0.5, fontWeight: 500, textAnchor: 'end' }));
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
    if (xTitle) body.post.push(text(inner.x + inner.w, inner.y + inner.h + 40, xTitle, { fill: theme.lede, fontSize: axisSize, fontWeight: 500, textAnchor: 'end' }));
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
    if (xTitle) body.post.push(text(inner.x + inner.w, inner.y + inner.h + 40, xTitle, { fill: theme.lede, fontSize: axisSize, fontWeight: 500, textAnchor: 'end' }));
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
  const th = 118 + (hasTrend ? 40 : 0) + (hasTarget ? 30 : 0);
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
    parts.push(text(cx + P, cy + P + 12, truncate(it.label ?? '', tw - P * 2, 13), { fill: theme.lede, fontSize: 13 }));
    const valStr = shown[i];
    parts.push(text(cx + P, cy + P + 12 + 12 + vSize * 0.92, valStr, { fill: theme.ink, fontSize: vSize, fontWeight: 600, letterSpacing: '-0.015em' }));

    let delta = it.delta !== undefined ? num(it.delta) : it.previous !== undefined && num(it.previous) ? (value - num(it.previous)) / Math.abs(num(it.previous)) : NaN;
    let y = cy + P + 12 + 12 + vSize + 22;
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
      else if (period) { y += 17; parts.push(text(cx + P, y, truncate(period, tw - P * 2, 12.5), { fill: theme.lede, fontSize: 12.5 })); }
    } else if (it.note) {
      parts.push(text(cx + P, y, truncate(it.note, tw - P * 2, 12.5), { fill: theme.lede, fontSize: 12.5 }));
    }

    if (it.target !== undefined) {
      y += 24;
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

const TYPES = ['bar', 'column', 'count', 'line', 'area', 'scatter', 'bubble', 'treemap', 'sunburst', 'donut', 'pie', 'heatmap', 'sankey', 'kpi', 'hist', 'kde', 'ecdf', 'regplot', 'residplot', 'jointplot', 'box', 'violin', 'strip', 'swarm', 'point', 'radar'];

const ALIASES = {
  barplot: ['bar', { ci: true }], countplot: 'count', columns: 'column', lineplot: 'line', areaplot: 'area',
  scatterplot: 'scatter', histplot: 'hist', histogram: 'hist', kdeplot: 'kde', density: 'kde', ecdfplot: 'ecdf',
  lmplot: 'regplot', reg: 'regplot', regression: 'regplot', joint: 'jointplot', boxplot: 'box', violinplot: 'violin',
  stripplot: 'strip', swarmplot: 'swarm', beeswarm: 'swarm', pointplot: 'point', spider: 'radar', doughnut: 'donut',
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
    check(spec.value, 'value'); check(spec.label, 'label'); check(spec.group, 'group'); check(spec.path, 'path');
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

  if (type === 'kpi' && !(spec.items || spec.data || []).length) err('items', 'El KPI necesita `items`.', 'items: [{ label: "Ventas", value: 1250, delta: 0.12, period: "vs 2025" }]');

  return { ok: errors.length === 0, type, errors, warnings, suggestions: tips };
}



return { "lint": lint, "PlotError": PlotError };
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
    focus: { type: 'array', items: { type: 'string' }, description: 'treemap/sunburst: path to drill into, e.g. ["Mining"]. In the browser, clicking a group does it.' },
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
    labels: { description: 'Value labels: true, false or "auto". In scatter/regplot: a number of points or a list of names to label.', anyOf: [{ type: 'boolean' }, { type: 'string' }, { type: 'number' }, { type: 'array', items: { type: 'string' } }] },
    refLines: { type: 'array', description: 'Reference lines (targets, averages).', items: { type: 'object', properties: { y: { type: 'number' }, x: { type: 'number' }, value: { type: 'number' }, label: { type: 'string' } } } },
    annotations: { type: 'array', description: 'line/area: events on the x axis.', items: { type: 'object', properties: { x: {}, label: { type: 'string' } } } },

    stack: { description: 'bar/area: true stacks; "percent" stacks to 100%.', anyOf: [{ type: 'boolean' }, { type: 'string', enum: ['percent'] }] },
    horizontal: { type: 'boolean', description: 'Force horizontal orientation (otherwise chosen from label length and count).' },
    sort: { type: 'string', enum: ['desc', 'asc', 'none', 'alpha'], description: 'bar: category order (desc by default unless the categories are time).' },
    top: { type: 'integer', description: 'bar: keep the N largest and fold the rest into "Other".' },
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
    width: { type: 'number', description: 'Width in px (default 720; render() uses the container width).' },
    height: { type: 'number', description: 'Height in px. Automatic for horizontal bars, heatmaps, KPI tiles, and narrow treemaps, sunbursts and radars.' },
  },
};

/** Tool definition ready for Claude (Anthropic) or OpenAI. */
function toolDefinition({ name = 'plot', flavor = 'anthropic' } = {}) {
  const description =
    'Draws an elegant, accessible chart from tabular data. Pass rows in `data`, name the fields (x, y, series/hue…) and write a `title` that states the finding. Returns an SVG. Types: bar, count, line, area, scatter, bubble, regplot, residplot, jointplot, hist, kde, ecdf, box, violin, strip, swarm, point, radar, treemap, sunburst, donut, pie, heatmap, sankey, kpi (seaborn names accepted). `facet` makes panels; `time` adds a per-period slider. Set `locale: "en"` for English number formats.';
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
  const hide = () => {
    tipEl.style.opacity = '0';
    if (on) on.classList.remove('pa-on');
    on = null;
    overlay.innerHTML = '';
    if (!pinned) svg.classList.remove('pa-focus');
  };
  const linesHtml = (txt) =>
    String(txt).split('\n').map((l, i) => (i === 0 ? `<div style="font-weight:600">${esc(l)}</div>` : `<div style="opacity:.86">${esc(l)}</div>`)).join('');

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
      if (best[2]) show(linesHtml(best[2]), ev); else tipEl.style.opacity = '0';
      return;
    }
    const tg = t && t.closest ? t.closest('[data-tip]') : null;
    if (!tg) { hide(); return; }
    const mark = tg.classList.contains('pa-m') ? tg : tg.querySelector('.pa-m') && tg.querySelectorAll('.pa-m').length === 1 ? tg.querySelector('.pa-m') : null;
    if (mark !== on) {
      if (on) on.classList.remove('pa-on');
      on = mark;
      if (on) { on.classList.add('pa-on'); svg.classList.add('pa-focus'); } else svg.classList.remove('pa-focus');
    }
    show(linesHtml(tg.getAttribute('data-tip')), ev);
  });
  svg.addEventListener('pointerleave', hide);

  const norm = (c) => String(c || '').trim().toLowerCase();
  const body = svg.querySelector('.pa-body');
  const marksOf = (color) => {
    const c = norm(color);
    const out = new Set();
    if (!body) return out;
    for (const n of body.querySelectorAll('[fill],[stroke]')) {
      if (norm(n.getAttribute('fill')) === c || norm(n.getAttribute('stroke')) === c) {
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
    for (const n of body ? body.querySelectorAll('[fill],[stroke]') : []) if (ms.has(n) && !n.classList.contains('pa-m')) n.classList.add('pa-m');
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
}

const attachSource = attach.toString();

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
.pa-chart [data-drill]{cursor:pointer}
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
  host.innerHTML = '';
  const chart = document.createElement('div');
  const ctl = document.createElement('div');
  host.appendChild(chart);
  host.appendChild(ctl);
  let timer = null, ro = null, raf = 0;

  const width = () => state.width ?? Math.max(280, Math.round(chart.clientWidth || host.clientWidth || 720));
  const draw = () => {
    chart.innerHTML = plotFn({ ...state, width: width() });
    chart.__pa = false;
    attach(chart);
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
