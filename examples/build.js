// Genera la galería: examples/svg/*.svg y examples/index.html (interactiva).
//   node examples/build.js
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { plot, lint } from '../src/index.js';
import { attachSource } from '../src/interact.js';
import { FONT_CSS } from '../src/theme.js';
import { gallery } from './specs.js';

const here = dirname(fileURLToPath(import.meta.url));
mkdirSync(join(here, 'svg'), { recursive: true });

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
for (const ex of gallery) {
  writeFileSync(join(here, 'svg', ex.id + '.svg'), plot(ex.spec));
  // Cada gráfico en los dos temas: la página muestra el que corresponde al
  // modo claro u oscuro del lector. El ejemplo "noche" queda siempre oscuro.
  const fixedDark = ex.spec.theme === 'noche';
  const light = plot({ ...ex.spec, width: 600 });
  const dark = fixedDark ? light : plot({ ...ex.spec, width: 600, theme: 'noche' });
  const report = lint(ex.spec);
  const issues = [...report.errors, ...report.warnings];
  if (issues.length) console.warn(`[${ex.id}]`, issues.map((i) => i.message).join(' | '));
  const figs = fixedDark
    ? `<figure class="pa">${light}</figure>`
    : `<figure class="pa pa-l">${light}</figure><figure class="pa pa-d">${dark}</figure>`;
  cards.push(`<article class="card${fixedDark ? ' always-dark' : ''}" id="${ex.id}">
  <header><h2>${esc(ex.name)}</h2><p>${esc(ex.note).replace(/`([^`]+)`/g, '<code>$1</code>')}</p></header>
  ${figs}
  <details><summary>Ver código</summary><pre><code>${esc(snippet(ex.spec))}</code></pre></details>
</article>`);
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
main{padding-block:8px 48px;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,560px),1fr));gap:20px}
.card{background:var(--card);border-radius:16px;padding:20px 20px 10px;min-width:0;color:var(--ink)}
.card.always-dark{background:var(--dark-card);color:var(--dark-ink);--lede:var(--dark-lede);--tint:var(--dark-tint);--accent:var(--dark-accent);--ink:var(--dark-ink)}
.card header h2{font-size:13px;font-weight:600;letter-spacing:.02em;margin:0 0 4px;color:var(--accent)}
.card header p{font-size:14px;line-height:1.45;color:var(--lede);margin:0 0 6px;max-width:70ch}
.card code{font-family:var(--mono);font-size:.92em}
figure.pa{margin:0 -4px}
figure.pa-l{display:var(--show-l)} figure.pa-d{display:var(--show-d)}
figure.pa svg{width:100%;height:auto;display:block}
details{margin-top:4px}
summary{cursor:pointer;font-size:13px;color:var(--src);padding:6px 0}
summary:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:4px}
pre{background:var(--tint);border-radius:10px;padding:14px;overflow:auto;font-size:12px;line-height:1.5;margin:4px 0 8px;color:var(--ink)}
pre code{font-family:var(--mono)}
footer{padding-block:0 48px;color:var(--src);font-size:13px}
</style>`;

const content = `<div class="wrap">
<section class="top">
  <h1>plot<b>agents</b></h1>
  <p>Gráficos bellos con una sola llamada. Un objeto JSON con datos y nombres de campos entra; sale un SVG accesible, con buena tipografía, colores validados para daltonismo y tooltips. Diseñado para que un agente de IA lo use sin pensar en diseño.</p>
  <span class="install">npm install plotagents</span>
  <nav>${gallery.map((g) => `<a href="#${g.id}">${esc(g.name)}</a>`).join('')}</nav>
</section>
<main>
${cards.join('\n')}
</main>
<footer>Todos los datos de esta galería son ilustrativos. Pasa el mouse sobre los gráficos para ver los valores; la página sigue el modo claro u oscuro de tu sistema.</footer>
</div>
<script>document.querySelectorAll('figure.pa').forEach(function(f){(${attachSource})(f)});</script>`;

const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
${head}
</head>
<body>
${content}
</body></html>`;

// Variante fragmento (sin <html>/<head>) para publicar como página.
const outArg = process.argv.indexOf('--fragment');
if (outArg > 0) writeFileSync(process.argv[outArg + 1], head + '\n' + content);
writeFileSync(join(here, 'index.html'), html);
console.log(`Galería: ${gallery.length} gráficos → examples/index.html y examples/svg/`);
