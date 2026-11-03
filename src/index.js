// plotagents · gráficos bellos con una sola llamada, pensados para agentes.
//
//   import { plot } from 'plotagents';
//   const svg = plot({ data, x: 'region', y: 'ventas', title: 'Biobío lidera las ventas' });
//
import { getTheme, themes, FONT_CSS } from './theme.js';
import { bar } from './charts/bar.js';
import { line } from './charts/line.js';
import { scatter } from './charts/scatter.js';
import { treemap, squarify } from './charts/treemap.js';
import { donut } from './charts/donut.js';
import { heatmap } from './charts/heatmap.js';
import { sankey } from './charts/sankey.js';
import { kpi } from './charts/kpi.js';
import { ensureData, PlotError } from './data.js';
import { inferType, TYPES } from './infer.js';
import { lint } from './lint.js';
import { schema, toolDefinition } from './schema.js';
import { attach, attachSource } from './interact.js';
import { makeFormat, formatNumber, formatCompact } from './format.js';
import { esc } from './svg.js';

const RENDERERS = {
  bar: (s, t) => bar(s, t),
  column: (s, t) => bar({ ...s, horizontal: false }, t),
  line: (s, t) => line(s, t, 'line'),
  area: (s, t) => line(s, t, 'area'),
  scatter: (s, t) => scatter(s, t),
  bubble: (s, t) => scatter(s, t),
  treemap: (s, t) => treemap(s, t),
  donut: (s, t) => donut(s, t),
  pie: (s, t) => donut({ thickness: 1, ...s }, t),
  heatmap: (s, t) => heatmap(s, t),
  sankey: (s, t) => sankey(s, t),
  kpi: (s, t) => kpi(s, t),
};

/** Normaliza el spec: tipo inferido y datos como filas. */
export function resolve(spec = {}) {
  if (!spec || typeof spec !== 'object') throw new PlotError('El spec debe ser un objeto.', 'plot({ data: [...], x: "campo", y: "campo" })');
  const s = { ...spec };
  if (s.color && !s.series && typeof s.color === 'string' && !s.color.startsWith('#')) s.series = s.color;
  let type = s.type && s.type !== 'auto' ? String(s.type).toLowerCase() : null;
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
  const s = resolve(spec);
  return RENDERERS[s.type](s, getTheme(s.theme));
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
 * Navegador: dibuja en un elemento (o selector) con tooltips y ancho
 * adaptable. Devuelve { svg, update(spec), destroy() }.
 */
export function render(target, spec) {
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  if (!el) throw new PlotError('No encontré el elemento destino.', 'render("#grafico", spec) o render(elemento, spec)');
  ensureFont();
  let current = spec;
  const draw = () => {
    const w = spec.width ?? Math.round(el.clientWidth || 720);
    el.innerHTML = plot({ ...current, width: Math.max(280, w) });
    el.__pa = false;
    attach(el);
  };
  draw();
  let ro = null;
  if (current.width === undefined && typeof ResizeObserver !== 'undefined') {
    let last = el.clientWidth;
    ro = new ResizeObserver(() => { if (Math.abs(el.clientWidth - last) > 8) { last = el.clientWidth; draw(); } });
    ro.observe(el);
  }
  return {
    get svg() { return el.querySelector('svg'); },
    update(next) { current = next; spec = next; draw(); },
    destroy() { ro && ro.disconnect(); el.innerHTML = ''; },
  };
}

function ensureFont() {
  if (typeof document === 'undefined' || document.getElementById('pa-font')) return;
  const l = document.createElement('link');
  l.id = 'pa-font';
  l.rel = 'stylesheet';
  l.href = FONT_CSS;
  document.head.appendChild(l);
}

/**
 * Página HTML autónoma (un archivo) con uno o varios gráficos interactivos.
 * Útil para que un agente entregue un reporte que se abre en cualquier navegador.
 */
export function toHTML(specs, { title = 'Gráficos', lang = 'es', columns = 1 } = {}) {
  const list = Array.isArray(specs) ? specs : [specs];
  const dark = list.every((s) => getTheme(s.theme).mode === 'dark');
  const bg = dark ? '#0B0F2B' : '#FCFBF9';
  const charts = list.map((s) => `<figure class="pa">${plot(s)}</figure>`).join('\n');
  return `<!doctype html>
<html lang="${esc(lang)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<link rel="stylesheet" href="${FONT_CSS}">
<style>
:root{color-scheme:${dark ? 'dark' : 'light'}}
body{margin:0;background:${bg};font-family:'Mozilla Text',system-ui,sans-serif}
main{max-width:${columns > 1 ? 1500 : 820}px;margin:0 auto;padding:24px 16px;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,${columns > 1 ? 560 : 320}px),1fr));gap:24px}
figure.pa{margin:0}
figure.pa svg{width:100%;height:auto;display:block}
</style></head>
<body><main>
${charts}
</main>
<script>(${attachSource})\n;document.querySelectorAll('figure.pa').forEach(function(f){(${attachSource})(f)});</script>
</body></html>`;
}

export { lint, schema, toolDefinition, themes, getTheme, attach, PlotError, TYPES, squarify, makeFormat, formatNumber, formatCompact };
export default plot;
