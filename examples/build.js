// Genera la galería: examples/svg/*.svg y examples/index.html (interactiva).
//   node examples/build.js
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { plot, lint, bundleSource } from '../src/index.js';
import { attachSource } from '../src/interact.js';
import { FONT_CSS } from '../src/theme.js';
import { gallery as base } from './specs.js';
import { statsGallery } from './specs-stats.js';
import { catGallery } from './specs-cat.js';
import { partsGallery } from './specs-parts.js';
import { moreGallery } from './specs-more.js';
import { NOTES_EN, SECTIONS_EN } from './notes-en.js';
import { geoGallery } from './specs-geo.js';
import { networkGallery } from './specs-network.js';
import { flowGallery } from './specs-flow.js';
import { dashedGallery } from './specs-dashed.js';

// Galería por secciones. Orden pensado para leer de lo simple a lo avanzado.
const SECTION = {
  barras: 'Comparar', 'barras-horizontales': 'Comparar', 'barras-agrupadas': 'Comparar', 'barras-100': 'Comparar',
  lineas: 'Tiempo', indice: 'Tiempo', 'area-meta': 'Tiempo', 'area-apilada': 'Tiempo', noche: 'Configuración',
  burbujas: 'Relaciones', calor: 'Flujos y números', sankey: 'Redes y flujos', kpi: 'Flujos y números',
};
const ORDER = ['Comparar', 'Tiempo', 'Partes de un todo', 'Mapas', 'Distribuciones', 'Relaciones', 'Redes y flujos', 'Flujos y números', 'Configuración'];
const drop = new Set(['treemap', 'dona', 'slider-rango']); // reemplazados por versiones nuevas
const tag = (list, sec) => list.map((e) => ({ ...e, section: e.section || sec }));
const all = [
  ...base.filter((e) => !drop.has(e.id)).map((e) => ({ ...e, section: SECTION[e.id] || 'Comparar' })),
  ...tag(moreGallery, 'Tiempo'),
  ...tag(partsGallery, 'Partes de un todo'),
  ...statsGallery.map((e) => ({ ...e, section: ['regplot', 'residplot', 'jointplot'].includes(e.spec.type) ? 'Relaciones' : 'Distribuciones' })),
  ...catGallery.map((e) => ({ ...e, section: e.spec.type === 'radar' ? 'Relaciones' : 'Distribuciones' })),
  ...tag(geoGallery, 'Mapas'),
  ...tag(networkGallery, 'Redes y flujos'),
  ...flowGallery.map((e) => ({ ...e, section: e.spec.type === 'pyramid' ? 'Distribuciones' : 'Redes y flujos' })),
  ...dashedGallery,
];
// El ejemplo de líneas original pasa a ser el del slider.
const lineas = all.find((e) => e.id === 'lineas');

const gallery = ORDER.flatMap((sec) => all.filter((e) => e.section === sec && !drop.has(e.id)));
const extra = all.filter((e) => !ORDER.includes(e.section));
gallery.push(...extra);

const here = dirname(fileURLToPath(import.meta.url));
mkdirSync(join(here, 'svg'), { recursive: true });

const slug = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** Código de ejemplo legible: los datos se abrevian a 2 filas. */
function snippet(spec) {
  const short = { ...spec };
  let rows = '';
  if (Array.isArray(spec.data)) {
    rows = spec.data.slice(0, 2).map((r) => '    ' + JSON.stringify(r).replace(/"(\w+)":/g, '$1: ').replace(/,(?=\w+:)/g, ', ')).join(',\n');
    short.data = '__DATA__';
  }
  if (Array.isArray(spec.items)) {
    short.items = '__ITEMS__';
  }
  let s = JSON.stringify(short, null, 2).replace(/"(\w+)":/g, '$1:');
  if (Array.isArray(spec.data)) s = s.replace('"__DATA__"', `[\n${rows},\n    // … ${spec.data.length - 2} filas más\n  ]`);
  if (spec.items) s = s.replace('"__ITEMS__"', '[\n' + spec.items.map((it) => '    ' + JSON.stringify(it).replace(/"(\w+)":/g, '$1: ').replace(/,(?=\w+:)/g, ', ')).join(',\n') + '\n  ]');
  return `plot(${s})`;
}

const cards = [];
const specsJSON = [];
for (const ex of gallery) {
  writeFileSync(join(here, 'svg', ex.id + '.svg'), plot(ex.spec));
  // Un SVG estático (tema claro) para la primera pintura; en el navegador
  // render() lo reemplaza en el tema del lector, con slider y tooltips.
  const fixedDark = ex.spec.theme === 'noche' || ex.spec.theme?.extends === 'noche';
  const svg = plot({ ...ex.spec, width: 640, padding: 18 });
  const report = lint(ex.spec);
  const issues = [...report.errors, ...report.warnings];
  if (issues.length) console.warn(`[${ex.id}]`, issues.map((i) => i.message).join(' | '));
  specsJSON.push({ id: ex.id, spec: ex.spec, fixed: fixedDark || (ex.spec.theme && typeof ex.spec.theme === 'object') });
  cards.push({ section: ex.section, html: `<article class="card${fixedDark ? ' always-dark' : ''}" id="${ex.id}">
  <header><h2>${esc((NOTES_EN[ex.id] || [ex.nameEn || ex.name])[0])}</h2><p>${esc((NOTES_EN[ex.id] || [, ex.noteEn || ex.note])[1]).replace(/`([^`]+)`/g, '<code>$1</code>')}</p></header>
  <figure class="pa" data-id="${ex.id}">${svg}</figure>
  <details><summary>Show code</summary><pre><code>${esc(snippet(ex.spec))}</code></pre></details>
</article>` });
}

const head = `<title>plotagents</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="${FONT_CSS}">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fragment+Mono&display=swap">
<style>
/* Papel claro, tinta petróleo, acento magenta. Galería en dos columnas que se apilan en el teléfono. */
:root{
  --page:#F4F3EF; --card:#FCFBF9; --ink:#141A3F; --lede:#4A5070; --src:#6E7390;
  --tint:#ECEEF8; --chip:#FFFFFF; --accent:#D42A5E;
  --dark-card:#0B0F2B; --dark-ink:#F2F3FA; --dark-lede:#B4BAE0; --dark-tint:#151A3D; --dark-accent:#FF4D7D;
  --show-l:block; --show-d:none;
  --sans:'Mozilla Text',system-ui,-apple-system,'Segoe UI',sans-serif;
  --mono:'Fragment Mono',ui-monospace,'SFMono-Regular',Menlo,monospace;
}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){
  --page:#070A1F; --card:#0B0F2B; --ink:#F2F3FA; --lede:#B4BAE0; --src:#8A90B4;
  --tint:#151A3D; --chip:#151A3D; --accent:#FF4D7D; --show-l:none; --show-d:block; color-scheme:dark}}
:root[data-theme="dark"]{
  --page:#070A1F; --card:#0B0F2B; --ink:#F2F3FA; --lede:#B4BAE0; --src:#8A90B4;
  --tint:#151A3D; --chip:#151A3D; --accent:#FF4D7D; --show-l:none; --show-d:block; color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;background:var(--page);color:var(--ink);font-family:var(--sans);-webkit-font-smoothing:antialiased}
.wrap{max-width:1440px;margin:0 auto;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
.top{padding-block:48px 20px}
.top h1{font-size:clamp(34px,6vw,48px);font-weight:600;letter-spacing:-.02em;margin:0 0 12px;text-wrap:balance}
.top h1 b{color:var(--accent);font-weight:600}
.top p{font-size:18px;color:var(--lede);max-width:62ch;line-height:1.5;margin:0 0 20px}
.install{display:inline-block;font-family:var(--mono);font-size:14px;background:var(--tint);padding:10px 14px;border-radius:8px}
nav{display:flex;flex-wrap:wrap;gap:8px;margin-top:22px}
nav a{font-size:13px;color:var(--lede);text-decoration:none;background:var(--chip);padding:6px 10px;border-radius:999px}
nav a:hover,nav a:focus-visible{color:var(--ink);background:var(--tint);outline:none}
main{padding-block:4px 36px;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,560px),1fr));gap:20px}
.card{--cp:18px;background:var(--card);border-radius:16px;padding:var(--cp) var(--cp) 8px;min-width:0;color:var(--ink);overflow:hidden}
@media (max-width:520px){.card{--cp:12px;border-radius:12px}.wrap{padding-left:max(10px,env(safe-area-inset-left,0px));padding-right:max(10px,env(safe-area-inset-right,0px))}}
.card.always-dark{background:var(--dark-card);color:var(--dark-ink);--lede:var(--dark-lede);--tint:var(--dark-tint);--accent:var(--dark-accent);--ink:var(--dark-ink)}
.card header h2{font-size:13px;font-weight:600;letter-spacing:.02em;margin:0 0 4px;color:var(--accent)}
.card header p{font-size:14px;line-height:1.45;color:var(--lede);margin:0 0 6px;max-width:70ch}
.card code{font-family:var(--mono);font-size:.92em}
figure.pa{margin:4px calc(-1 * var(--cp)) 0}
figure.pa svg{width:100%;height:auto;display:block}
details{margin-top:4px}
summary{cursor:pointer;font-size:13px;color:var(--src);padding:6px 0}
summary:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:4px}
pre{background:var(--tint);border-radius:10px;padding:14px;overflow:auto;font-size:12px;line-height:1.5;margin:4px 0 8px;color:var(--ink)}
pre code{font-family:var(--mono)}
figure.pa .pa-ctl{border-radius:0 0 12px 12px}
.sec-t{font-size:22px;font-weight:600;letter-spacing:-.01em;margin:24px 0 12px;display:flex;align-items:baseline;gap:10px}
.sec-t span{font-size:13px;font-weight:500;color:var(--src)}
footer{padding-block:0 48px;color:var(--src);font-size:13px}
</style>`;

const content = `<div class="wrap">
<section class="top">
  <h1>plot<b>agents</b></h1>
  <p>Beautiful charts from one JSON spec. Data and field names go in; an accessible SVG comes out, with careful typography, colorblind-safe colors and tooltips. Built so an AI agent can chart anything without thinking about design: 26 chart types, seaborn's included, time sliders, small multiples and JSON themes.</p>
  <span class="install">npm install plotagents</span>
  <nav>${ORDER.filter((sec) => cards.some((c) => c.section === sec)).map((sec) => `<a href="#sec-${slug(sec)}">${esc(SECTIONS_EN[sec] || sec)}</a>`).join('')}</nav>
</section>
${ORDER.filter((sec) => cards.some((c) => c.section === sec)).map((sec) => `<section class="sec" id="sec-${slug(sec)}"><h2 class="sec-t">${esc(SECTIONS_EN[sec] || sec)} <span>${cards.filter((c) => c.section === sec).length}</span></h2>
<main>
${cards.filter((c) => c.section === sec).map((c) => c.html).join('\n')}
</main></section>`).join('\n')}
<footer>All data in this gallery is illustrative. Chart text uses the default Spanish (Chile) locale; set <code>locale: "en"</code> for English formats. Hover for values, drag the time sliders, and click a treemap or sunburst group to drill down. The page follows your system's light or dark mode.</footer>
</div>
<script>${(bundleSource() + '\n' + bundleSource('plotagents-geo.js')).replace(/<\/(script)/gi, '<\\/$1')}</script>
<script type="application/json" id="pa-specs">${JSON.stringify(specsJSON).replace(/</g, '\\u003c')}</script>
<script>
(function () {
  var specs = JSON.parse(document.getElementById('pa-specs').textContent);
  var root = document.documentElement;
  function isDark() {
    var t = root.getAttribute('data-theme');
    if (t === 'dark') return true;
    if (t === 'light') return false;
    return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches;
  }
  var handles = {};
  function drawAll() {
    var dark = isDark();
    specs.forEach(function (e) {
      var fig = document.querySelector('figure.pa[data-id="' + e.id + '"]');
      if (!fig) return;
      var s = Object.assign({}, e.spec);
      if (!e.fixed) s.theme = dark ? 'noche' : 'papel';
      // El margen del gráfico es el mismo de la tarjeta: texto alineado y todo el ancho para los datos.
      if (s.padding === undefined) s.padding = window.innerWidth <= 520 ? 12 : 18;
      if (handles[e.id]) handles[e.id].destroy();
      handles[e.id] = plotagents.render(fig, s);
    });
  }
  drawAll();
  if (window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener('change', drawAll);
  new MutationObserver(drawAll).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
})();
</script>`;

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
${head}
</head>
<body>
${content}
</body></html>`;

// Variante fragmento (sin <html>/<head>) para publicar como página.
const outArg = process.argv.indexOf('--fragment');
if (outArg > 0) writeFileSync(process.argv[outArg + 1], head + '\n' + content);
writeFileSync(join(here, 'index.html'), html);
console.log(`Galería: ${gallery.length} gráficos en ${ORDER.length} secciones → examples/index.html y examples/svg/`);
