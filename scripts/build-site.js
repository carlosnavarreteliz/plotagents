// Genera el sitio de GitHub Pages en _site/: portada, documentación (docs/*.md
// y AGENTS.md), galería de ejemplos en vivo y playground.
//   node scripts/build-site.js            → _site/
//   SITE_BASE=/plotagents/ node scripts/build-site.js
import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { plot, lint, safePlot, resolve as resolveSpec, TYPES } from '../src/index.js';
import { FONT_CSS } from '../src/theme.js';
import { gallery, ORDER, nameOf, noteOf, sectionName, slug, snippet } from '../examples/gallery.js';
import { markdown, highlight, esc } from '../site/md.js';
import { heroSpec, quickSpec, ganttSpec, trendSpec, exchanges, badSpec, fixedSpec, languageSpec } from '../site/home-specs.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, process.env.SITE_OUT || '_site');
const BASE = process.env.SITE_BASE || '/plotagents/';
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const REPO = 'https://github.com/carlosnavarreteliz/plotagents';
const BRANCH = 'master';
const read = (p) => readFileSync(join(root, p), 'utf8');

rmSync(OUT, { recursive: true, force: true });
const write = (p, s) => { mkdirSync(dirname(join(OUT, p)), { recursive: true }); writeFileSync(join(OUT, p), s); };
const copy = (from, to) => { mkdirSync(dirname(join(OUT, to)), { recursive: true }); copyFileSync(join(root, from), join(OUT, to)); };

// ── Recursos ───────────────────────────────────────────────────────────────
copy('dist/plotagents.js', 'assets/plotagents.js');
copy('dist/plotagents-geo.js', 'assets/plotagents-geo.js');
for (const f of ['site.css', 'site.js', 'gallery.js', 'playground.js', 'home.js']) copy('site/' + f, 'assets/' + f);
copy('schema.json', 'schema.json');
copy('AGENTS.md', 'AGENTS.md');
copy('AGENTS.md', 'llms.txt');
write('.nojekyll', '');

// ── Ejemplos: SVG estáticos claro y oscuro (miniaturas y primera pintura) ──
const isFixed = (spec) => spec.theme === 'noche' || spec.theme === 'dark' || (spec.theme && typeof spec.theme === 'object');
const typeOf = (spec) => { try { return resolveSpec(spec).type; } catch { return spec.type || 'auto'; } };
const viewBox = (svg) => { const m = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg); return m ? [Math.round(+m[1]), Math.round(+m[2])] : [640, 400]; };
const examples = gallery.map((ex) => {
  const fixed = isFixed(ex.spec);
  const light = plot({ ...ex.spec, width: 640, padding: 18 });
  const dark = fixed ? light : plot({ ...ex.spec, theme: 'noche', width: 640, padding: 18 });
  write(`svg/${ex.id}.svg`, light);
  if (!fixed) write(`svg/${ex.id}-dark.svg`, dark);
  const report = lint(ex.spec);
  for (const i of [...report.errors, ...report.warnings]) console.warn(`[${ex.id}] ${i.message}`);
  return { ...ex, fixed, type: typeOf(ex.spec), size: viewBox(light), name: nameOf(ex), note: noteOf(ex) };
});
const exById = Object.fromEntries(examples.map((e) => [e.id, e]));

/** <img> claro y oscuro de un ejemplo; `p` es el prefijo relativo a la raíz. */
function pics(ex, p, { eager = false } = {}) {
  const [w, h] = ex.size;
  const attrs = `width="${w}" height="${h}" alt="${esc(ex.name)}" ${eager ? '' : 'loading="lazy" '}decoding="async"`;
  if (ex.fixed) return `<img class="ph" src="${p}svg/${ex.id}.svg" ${attrs}>`;
  return `<img class="ph only-l" src="${p}svg/${ex.id}.svg" ${attrs}><img class="ph only-d" src="${p}svg/${ex.id}-dark.svg" ${attrs}>`;
}

// ── Plantilla ──────────────────────────────────────────────────────────────
const ICON = {
  github: '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>',
  auto: '<svg class="i-auto" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="10" cy="10" r="7"/><path d="M10 3a7 7 0 000 14z" fill="currentColor"/></svg>',
  light: '<svg class="i-light" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="10" cy="10" r="3.5"/><path d="M10 1.8v2M10 16.2v2M1.8 10h2M16.2 10h2M4.2 4.2l1.4 1.4M14.4 14.4l1.4 1.4M4.2 15.8l1.4-1.4M14.4 5.6l1.4-1.4"/></svg>',
  dark: '<svg class="i-dark" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M16.5 12.3A7 7 0 017.7 3.5a7 7 0 108.8 8.8z"/></svg>',
  menu: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M3 6h14M3 10h14M3 14h14"/></svg>',
  search: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="7" cy="7" r="5"/><path d="M11 11l3.5 3.5"/></svg>',
  // Marca: una llave de JSON que se abre en tres barras.
  mark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3.5C4.8 3.5 4.5 5 4.5 6.5v3c0 1.2-.6 2.1-2 2.5 1.4.4 2 1.3 2 2.5v3c0 1.5.3 3 2.5 3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><rect x="9.5" y="12" width="3" height="8" rx="1" fill="#E8A33D"/><rect x="14" y="8" width="3" height="12" rx="1" fill="var(--accent)"/><rect x="18.5" y="4" width="3" height="16" rx="1" fill="#6170E0"/></svg>',
};

const THEME_BOOT = `<script>addEventListener('scroll',function(){document.documentElement.classList.toggle('scrolled',scrollY>8)},{passive:true});(function(){var d=document.documentElement,p='auto';try{p=localStorage.getItem('pa-theme')||'auto'}catch(e){}if(p==='light'||p==='dark')d.setAttribute('data-theme',p);d.setAttribute('data-pref',p)})()</script>`;

function layout({ p, active = '', title, description, body, scripts = '', bodyClass = '' }) {
  const nav = [['protocol', 'Protocol', 'docs/agents.html'], ['docs', 'Docs', 'docs/'], ['examples', 'Examples', 'examples/'], ['playground', 'Playground', 'playground/']];
  const fullTitle = title ? `${title} · plotagents` : 'plotagents · the chart protocol for AI agents';
  return `<!doctype html>
<html lang="en" data-pref="auto"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description)}">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta name="theme-color" content="#FCFBF9" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0B0F2B" media="(prefers-color-scheme: dark)">
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#141A3F"/><rect x="7" y="16" width="4" height="9" rx="1.5" fill="#E8A33D"/><rect x="14" y="10" width="4" height="15" rx="1.5" fill="#D42A5E"/><rect x="21" y="6" width="4" height="19" rx="1.5" fill="#6170E0"/></svg>')}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONT_CSS}">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fragment+Mono&family=Instrument+Serif:ital@1&display=swap">
<link rel="stylesheet" href="${p}assets/site.css">
${THEME_BOOT}
<script src="${p}assets/site.js"></script>
</head>
<body class="${bodyClass}">
<a class="sr-only" href="#main">Skip to content</a>
<header class="topbar"><div class="wrap">
  <a class="logo" href="${p}" aria-label="plotagents home">${ICON.mark}<span>plot<b>agents</b></span></a>
  <button class="icon-btn menu-btn" type="button" aria-label="Menu" aria-expanded="false">${ICON.menu}</button>
  <nav class="topnav" aria-label="Main">
    ${nav.map(([k, label, href]) => `<a href="${p}${href}"${k === active ? ' aria-current="page"' : ''}>${label}</a>`).join('\n    ')}
    <a href="${REPO}" rel="noopener" aria-label="GitHub repository">GitHub</a>
    <button class="icon-btn theme-btn" type="button" aria-label="Toggle theme">${ICON.auto}${ICON.light}${ICON.dark}</button>
  </nav>
</div></header>
<div id="main">
${body}
</div>
<footer class="foot"><div class="wrap">
  <span>plotagents ${esc(pkg.version)} · MIT © Carlos Navarrete · Example data is illustrative unless a source says otherwise.</span>
  <nav><a href="${p}docs/agents.html">Protocol</a><a href="${p}docs/">Docs</a><a href="${p}examples/">Examples</a><a href="${p}playground/">Playground</a><a href="${p}llms.txt">llms.txt</a><a href="${REPO}" rel="noopener">GitHub</a></nav>
</div></footer>
${scripts}
</body></html>
`;
}

const codeBlock = (code, lang = 'js') => `<div class="code" data-lang="${lang}"><pre><code>${highlight(code, lang)}</code></pre></div>`;
const jsonScript = (id, data) => `<script type="application/json" id="${id}">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
const libScripts = (p, geo = true) => `<script src="${p}assets/plotagents.js"></script>${geo ? `\n<script src="${p}assets/plotagents-geo.js"></script>` : ''}`;
const inlineChart = (spec) => plot({ ...spec, width: 640, padding: 18 });

// ── Documentación ──────────────────────────────────────────────────────────
const DOCS = [
  { slug: 'getting-started', file: 'docs/getting-started.md', label: 'Getting started', group: 'Guide' },
  { slug: 'charts', file: 'docs/charts.md', label: 'Chart reference', group: 'Guide' },
  { slug: 'themes', file: 'docs/themes.md', label: 'Themes and colors', group: 'Guide' },
  { slug: 'api', file: 'docs/api.md', label: 'API reference', group: 'Reference' },
  { slug: 'agents', file: 'AGENTS.md', label: 'Guide for AI agents', group: 'Reference', title: 'Guide for AI agents' },
  { slug: 'rendering', file: 'docs/rendering.md', label: 'SVG and performance', group: 'Reference' },
];
const docByFile = Object.fromEntries(DOCS.map((d) => [d.file, d]));

/** Enlace del Markdown (relativo a su archivo en el repo) → enlace del sitio desde /docs/. */
function docLink(srcFile) {
  return (href) => {
    if (/^(https?:|mailto:|#)/.test(href)) return href;
    const [path, hash = ''] = href.split('#');
    const h = hash ? '#' + hash : '';
    let rp = posix.normalize(posix.join(posix.dirname(srcFile), path));
    if (path.endsWith('/') && !rp.endsWith('/')) rp += '/';
    if (docByFile[rp]) return `${docByFile[rp].slug}.html${h}`;
    if (rp === 'README.md') return '../' + h;
    if (rp === 'schema.json' || rp === 'llms.txt') return '../' + rp;
    if (rp === 'examples/' || rp === 'examples/index.html') return '../examples/' + h;
    if (rp === 'playground/') return '../playground/' + h;
    if (/^examples\/svg\/[\w-]+\.svg$/.test(rp)) return '../svg/' + rp.slice('examples/svg/'.length);
    return `${REPO}/blob/${BRANCH}/${rp}${h}`;
  };
}

/** En la referencia de gráficos, miniaturas de los ejemplos de cada tipo. */
function examplesFor(level, text) {
  if (level !== 3) return '';
  const names = [...text.matchAll(/`([\w-]+)`/g)].map((m) => m[1]);
  const types = new Set(names.map((n) => typeOf({ type: n })).filter((t) => TYPES.includes(t)));
  const list = examples.filter((e) => types.has(e.type)).slice(0, 6);
  if (!list.length) return '';
  return `<div class="doc-ex" aria-label="Examples">${list.map((e) => `<a href="../examples/#${e.id}"><span class="img">${pics(e, '../')}</span><span class="t">${esc(e.name)}</span></a>`).join('')}</div>`;
}

const sidebar = (cur) => {
  const groups = [...new Set(DOCS.map((d) => d.group))];
  return `<aside class="side" aria-label="Documentation">${groups.map((g) => `<h4>${g}</h4><ul>${DOCS.filter((d) => d.group === g).map((d) => `<li><a href="${d.slug}.html"${d === cur ? ' aria-current="page"' : ''}>${esc(d.label)}</a></li>`).join('')}</ul>`).join('')}
<h4>More</h4><ul><li><a href="../examples/">Examples</a></li><li><a href="../playground/">Playground</a></li><li><a href="../schema.json">schema.json</a></li></ul></aside>`;
};

for (const [i, d] of DOCS.entries()) {
  const md = markdown(read(d.file), { link: docLink(d.file), afterHeading: d.slug === 'charts' ? examplesFor : () => '' });
  let html = md.html;
  if (d.title) html = html.replace(/<h1 id="[^"]*">[\s\S]*?<\/h1>/, `<h1 id="top">${esc(d.title)}</h1>`);
  if (d.slug === 'agents') html = html.replace('</h1>', `</h1>\n<p>A short guide meant to be pasted into an agent's system prompt. The same text is published as plain Markdown at <a href="../AGENTS.md">AGENTS.md</a> and <a href="../llms.txt">llms.txt</a>.</p>`);
  const prev = DOCS[i - 1], next = DOCS[i + 1];
  const toc = md.toc.filter((t) => t.level >= 2);
  const title = d.title || md.title;
  const body = `<div class="wrap docs">
${sidebar(d)}
<article class="prose">
<div class="doc-nav-mobile"><label class="sr-only" for="docsel">Page</label><select id="docsel">${DOCS.map((x) => `<option value="${x.slug}.html"${x === d ? ' selected' : ''}>${esc(x.label)}</option>`).join('')}</select></div>
${html}
<nav class="pager" aria-label="Pages">${prev ? `<a class="prev" href="${prev.slug}.html"><small>Previous</small>${esc(prev.label)}</a>` : ''}${next ? `<a class="next" href="${next.slug}.html"><small>Next</small>${esc(next.label)}</a>` : ''}</nav>
<p class="edit"><a href="${REPO}/blob/${BRANCH}/${d.file}" rel="noopener">Edit this page on GitHub</a></p>
</article>
${toc.length > 1 ? `<nav class="toc" aria-label="On this page"><h4>On this page</h4><ul>${toc.map((t) => `<li><a class="l${t.level}" href="#${t.id}">${t.html}</a></li>`).join('')}</ul></nav>` : '<div></div>'}
</div>`;
  const description = (/<p>([\s\S]*?)<\/p>/.exec(html)?.[1] || '').replace(/<[^>]+>/g, '').slice(0, 200);
  const page = layout({ p: '../', active: 'docs', title, description, body });
  write(`docs/${d.slug}.html`, page);
  if (i === 0) write('docs/index.html', page);
}

// ── Galería ────────────────────────────────────────────────────────────────
{
  const p = '../';
  const secs = ORDER.filter((sec) => examples.some((e) => e.section === sec));
  const extra = [...new Set(examples.map((e) => e.section))].filter((s) => !secs.includes(s));
  const allSecs = [...secs, ...extra];
  const card = (e) => `<article class="card${(e.spec.theme === 'noche' || e.spec.theme?.extends === 'noche') ? ' always-dark' : ''}" id="${e.id}" data-search="${esc([e.name, e.note, e.type, e.id, sectionName(e.section)].join(' '))}">
  <header><h3><a href="#${e.id}">${esc(e.name)}</a></h3><span class="type">${esc(e.type)}</span></header>
  <p class="note">${esc(e.note).replace(/`([^`]+)`/g, '<code>$1</code>')}</p>
  <figure class="pa" data-id="${e.id}">${pics(e, p)}</figure>
  <div class="actions"><details><summary>Show spec</summary>${codeBlock(snippet(e.spec, { more: 'more rows' }))}</details></div>
  <a class="pg" href="${p}playground/#ex=${e.id}">Open in playground →</a>
</article>`;
  const body = `<div class="wrap">
<section class="g-head">
  <h1>${examples.length} charts, <em>all live.</em></h1>
  <p>Every chart below is drawn in your browser from the spec under “Show spec”: exactly what an agent would send. Hover for values, drag the time sliders, click a treemap group to drill down or a network node to focus it. Chart text uses the default Spanish (Chile) locale; set <code>locale: "en"</code> for English.</p>
</section>
<div class="g-tools">
  <div class="chips" role="toolbar" aria-label="Filter by section">
    <button class="chip" type="button" data-sec="all" aria-pressed="true">All <span class="n">${examples.length}</span></button>
    ${allSecs.map((sec) => `<button class="chip" type="button" data-sec="sec-${slug(sec)}" aria-pressed="false">${esc(sectionName(sec))} <span class="n">${examples.filter((e) => e.section === sec).length}</span></button>`).join('\n    ')}
  </div>
  <label class="search">${ICON.search}<span class="sr-only">Search examples</span><input type="search" placeholder="Search: violin, map, slider…  /" autocomplete="off"></label>
</div>
${allSecs.map((sec) => `<section class="g-sec" id="sec-${slug(sec)}"><h2>${esc(sectionName(sec))} <span>${examples.filter((e) => e.section === sec).length}</span></h2>
<div class="g-grid">
${examples.filter((e) => e.section === sec).map(card).join('\n')}
</div></section>`).join('\n')}
<p class="empty" hidden>No example matches. Try another word, or <a href="${p}playground/">build your own in the playground</a>.</p>
</div>`;
  const specs = examples.map((e) => ({ id: e.id, spec: e.spec, fixed: e.fixed }));
  write('examples/index.html', layout({
    p, active: 'examples', title: 'Examples',
    description: `${examples.length} live chart examples with code: bars, lines, treemaps, maps, networks, seaborn-style distributions and more.`,
    body, scripts: `${libScripts(p)}\n${jsonScript('pa-specs', specs)}\n<script src="${p}assets/gallery.js"></script>`,
  }));
}

// ── Playground ─────────────────────────────────────────────────────────────
{
  const p = '../';
  const presets = [
    { id: 'quick-start', name: 'Quick start (English)', section: 'Start here', spec: quickSpec },
    { id: 'hero', name: 'Treemap with a time slider (English)', section: 'Start here', spec: heroSpec },
    { id: 'gantt-en', name: 'Gantt chart (English)', section: 'Start here', spec: ganttSpec },
    { id: 'geojson-en', name: 'Your own GeoJSON (English)', section: 'Start here', spec: languageSpec },
    { id: 'trend-en', name: 'Lines with a highlight (English)', section: 'Start here', spec: trendSpec },
    ...examples.map((e) => ({ id: e.id, name: e.name, section: sectionName(e.section), spec: e.spec })),
  ];
  // Geometrías propias fuera del editor: el spec dice geo: "file:nombre.geojson".
  const geoFiles = {};
  for (const x of presets) if (x.spec.geo && typeof x.spec.geo === 'object') {
    const name = `${x.id}.geojson`;
    geoFiles[name] = x.spec.geo;
    x.spec = { ...x.spec, geo: 'file:' + name };
  }
  const groups = [...new Set(presets.map((x) => x.section))];
  const body = `<div class="wrap pg-page">
<section class="pg-editor" aria-label="Spec editor">
  <div class="pg-bar">
    <label class="sr-only" for="preset">Start from an example</label>
    <select id="preset"><option value="">Custom spec</option>${groups.map((g) => `<optgroup label="${esc(g)}">${presets.filter((x) => x.section === g).map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join('')}</optgroup>`).join('')}</select>
    <button class="btn ghost small" type="button" id="format">Format</button>
    <button class="btn ghost small" type="button" id="geo-btn">Insert GeoJSON…</button>
    <input type="file" id="geo-file" accept=".json,.geojson,.topojson,application/json,application/geo+json" hidden>
  </div>
  <label class="sr-only" for="spec">Spec (JSON)</label>
  <textarea id="spec" spellcheck="false" autocapitalize="off" autocomplete="off" aria-describedby="hint"></textarea>
  <p class="pg-desc" id="hint">JSON or a JavaScript object. The chart redraws as you type; <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>Enter</kbd> redraws now. Drop a <code>.geojson</code> or <code>.topojson</code> file on the editor to map your own shapes: it is kept in the page and referenced as <code>geo: "file:name.geojson"</code>.</p>
</section>
<section class="pg-out" aria-label="Result">
  <div class="pg-bar"><span class="grow"></span><button class="btn ghost small" type="button" id="share">Copy link</button><button class="btn small" type="button" id="download">Download SVG</button></div>
  <figure class="pa pg-chart" id="chart"></figure>
  <p class="pg-desc" id="desc"></p>
  <div class="pg-msgs" id="msgs" aria-live="polite"></div>
</section>
</div>`;
  write('playground/index.html', layout({
    p, active: 'playground', title: 'Playground',
    description: 'Edit a plotagents spec and see the chart, its alt text and the linter’s suggestions live.',
    body, scripts: `${libScripts(p)}\n${jsonScript('pa-presets', presets)}\n${jsonScript('pa-geo-files', geoFiles)}\n<script src="${p}assets/playground.js"></script>`,
  }));
}

// ── Portada ────────────────────────────────────────────────────────────────
{
  const p = '';
  const T = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>');

  /** Un spec como lo escribiría el modelo: una clave por línea, datos abreviados. */
  const SHORT = new Set(['type', 'task', 'start', 'end', 'group', 'progress', 'dependsOn', 'x', 'y', 'series', 'key', 'value', 'label', 'path', 'time', 'highlight', 'locale', 'today', 'dashed', 'dashedLabel']);
  function callText(ex) {
    const s = ex.spec;
    const lines = ['plot({'];
    let row = '';
    const flush = () => { if (row) { lines.push('  ' + row.trim()); row = ''; } };
    const val = (v) => JSON.stringify(v, null, 0).replace(/"(\w+)":/g, '$1: ').replace(/,(?=[\w"{[])/g, ', ');
    for (const [k, v] of Object.entries(s)) {
      if ((ex.omit || []).includes(k)) continue;
      if (k === 'data') { flush(); lines.push(`  data: ${ex.data},`); continue; }
      if (k === 'geo' && ex.geo) { flush(); lines.push(`  geo: ${ex.geo}`); continue; }
      const piece = `${k}: ${val(v)},`;
      if (SHORT.has(k) && piece.length < 40) {
        if ((row + ' ' + piece).length > 58) flush();
        row += ' ' + piece;
      } else { flush(); lines.push(`  ${piece}`); }
    }
    for (const [k, v] of Object.entries(ex.extra || {})) { flush(); lines.push(`  ${k}: ${v},`); }
    flush();
    lines.push('})');
    return lines.join('\n');
  }
  function respText(spec) {
    const r = safePlot(spec);
    const kb = Math.round(r.svg.length / 102.4) / 10;
    const d = r.description.length > 150 ? r.description.slice(0, 147).replace(/\s+\S*$/, '') + '…' : r.description;
    return [
      '{',
      `  ok: ${r.ok}, type: ${JSON.stringify(r.type)},`,
      `  svg: "<svg …>…</svg>",  // ${kb} kB, with <title> and <desc>`,
      `  description: ${JSON.stringify(d)},`,
      `  errors: [], warnings: [${r.warnings.length ? '…' : ''}], suggestions: [${r.suggestions.length ? '…' : ''}]`,
      '}',
    ].join('\n');
  }
  const lines = (code) => highlight(code, 'js').split('\n').map((l) => `<span class="ln">${l || ' '}</span>`);
  const xcs = exchanges.map((ex) => ({ id: ex.id, label: ex.label, ask: ex.ask, call: lines(callText(ex)), resp: lines(respText(ex.spec)), spec: ex.spec }));
  const first = xcs[0];

  // El ciclo de reparación, con la respuesta real del linter.
  const bad = safePlot(badSpec);
  const badCall = `plot({
  type: "donut",
  data: /* 11 rows: city, stores */,
  label: "city",
  value: "store_count",
  locale: "en",
})`;
  const issue = (it) => `{ message: ${JSON.stringify(it.message)},\n      fix: ${JSON.stringify(it.fix)} }`;
  const badResp = `{
  ok: ${bad.ok}, svg: null,
  errors: [
    ${bad.errors.map(issue).join(',\n    ')}
  ],
  warnings: [
    ${bad.warnings.map(issue).join(',\n    ')}
  ],
  suggestions: [ ${bad.suggestions.map((s) => JSON.stringify(s.code)).join(', ')} ]
}`;

  const FIRST_EX = {};
  for (const e of examples) if (!FIRST_EX[e.type]) FIRST_EX[e.type] = e.id;
  const PLATES = [['gantt', 'w7'], ['geojson-propio', 'w5'], ['mapa-eeuu', 'w5'], ['treemap-niveles', 'w7'], ['regresion', 'w4'], ['violin', 'w4'], ['red', 'w4']].filter(([id]) => exById[id]);

  const RULES = [
    ['The title states the finding', 'A full sentence with the key number. `lint` flags titles that only name the chart; `describe` writes the alt text.'],
    ['One axis, always', 'No dual axes: they invent correlations. `index: true` rebases to 100, `facet` draws panels on a shared scale.'],
    ['Labels where the eye is', 'Lines are labeled at their ends, values sit on the bars, colliding labels get leader lines. A legend only when it is needed.'],
    ['Color follows the entity', 'Eight colorblind-safe colors in a fixed order. “Copper” keeps its color when you filter, drill down or move the slider.'],
    ['Honest about uncertainty', 'Estimates and projections are hatched with `dashed`, never a new color, and the legend says what the hatching means.'],
    ['Fast, accessible SVG', 'Zero dependencies, server-side rendering, a `<title>` and `<desc>` in every chart, and dense data batched into paths.'],
  ];
  const VOCAB = [
    ['title', '<b>The finding</b>, as a sentence with the number.'],
    ['subtitle', 'How to read it: measure, unit, period.'],
    ['source', 'Where the data comes from. Always.'],
    ['data', 'Rows, as they come: <code>[{ region, sales }]</code>.'],
    ['x · y · series', 'Which field plays which role.'],
    ['highlight', 'The one thing the reader should see.'],
    ['dashed', 'What is not a firm number yet.'],
    ['facet · time', 'Small multiples; one period at a time.'],
    ['geo', 'Chile, the US, the world, or <b>your own GeoJSON</b>.'],
    ['locale', '<code>"en"</code> or <code>"es"</code>, for numbers and dates.'],
  ];
  const typeWords = TYPES.filter((t) => !['column', 'count', 'bubble', 'residplot'].includes(t));

  const integ = {
    claude: `import Anthropic from '@anthropic-ai/sdk';
import { safePlot, toolDefinition } from 'plotagents';

const client = new Anthropic();
const res = await client.messages.create({
  model: process.env.ANTHROPIC_MODEL,
  max_tokens: 4096,
  tools: [toolDefinition()],        // the whole protocol, as JSON Schema
  messages: [{ role: 'user', content: 'Chart service times per clinic: …' }],
});

const call = res.content.find((b) => b.type === 'tool_use');
const { ok, svg, description, errors } = safePlot(call.input);
// Never throws. If !ok, return \`errors\` as the tool result:
// each one carries a \`fix\`, and the model calls again.`,
    openai: `import OpenAI from 'openai';
import { safePlot, toolDefinition } from 'plotagents';

const client = new OpenAI();
const res = await client.chat.completions.create({
  model: process.env.OPENAI_MODEL,
  tools: [toolDefinition({ flavor: 'openai' })],
  messages: [{ role: 'user', content: 'Map unemployment by region: …' }],
});

const call = res.choices[0].message.tool_calls[0];
const result = safePlot(JSON.parse(call.function.arguments));`,
    browser: `<script src="https://unpkg.com/plotagents/dist/plotagents.js"></script>
<div id="chart"></div>
<script>
  // Tooltips, time sliders, drill-down and map zoom included.
  plotagents.render('#chart', {
    type: 'choropleth',
    geo: '/maps/comunas.topojson',     // your own geometry, by URL
    data, key: 'comuna', value: 'poverty',
    title: 'Poverty is highest in the coal towns',
  });
</script>`,
    cli: `# One spec in, one SVG out. Works in any pipeline.
npx plotagents spec.json -o chart.svg

# The guide an agent needs, in its system prompt:
curl https://carlosnavarrete.cl/plotagents/llms.txt`,
  };
  const INTEG_TABS = [['claude', 'Claude'], ['openai', 'OpenAI'], ['browser', 'Browser'], ['cli', 'CLI']];

  const body = `<div class="wrap">
<section class="hero">
  <div class="h-top mono"><span>plotagents · protocol ${esc(pkg.version)}</span><span>MIT · zero dependencies · SVG</span></div>
  <h1>Charts are a language. Now <em>AI speaks it.</em></h1>
  <div class="hero-row">
    <p class="lede">plotagents is an open protocol between a model and the page. The model says what a chart <b>means</b>: the data, the finding, the unit. The library answers with a <b>finished, accessible chart</b>, or with the exact fix it needs.</p>
    <div class="hero-act">
      <span class="install"><span class="pr">$</span> npm install plotagents <button class="copy" type="button" data-copy="npm install plotagents">Copy</button></span>
      <div class="row">
        <a class="btn" href="docs/agents.html">Read the protocol <span class="arr">→</span></a>
        <a class="tlink" href="playground/">Open the playground</a>
        <a class="tlink" href="examples/">${examples.length} live examples</a>
      </div>
    </div>
  </div>

  <section class="xc" id="exchange" aria-label="A model calling plotagents">
    <div class="xc-head">
      <span class="mono">Live · a model draws by calling plotagents</span>
      <div class="xc-tabs" role="tablist" aria-label="Examples">${xcs.map((x, i) => `<button type="button" role="tab" data-i="${i}" aria-selected="${i === 0}"><span class="i">0${i + 1}</span>${esc(x.label)}</button>`).join('')}</div>
    </div>
    <div class="xc-body">
      <div class="xc-log">
        <div class="turn you"><div class="who"><i></i>Person</div><p class="ask" id="xc-ask">${esc(first.ask)}</p></div>
        <div class="turn agent"><div class="who"><i></i>Model → tool call</div><pre id="xc-call"><code>${first.call.join('')}</code></pre></div>
        <div class="turn lib"><div class="who"><i></i>plotagents → model</div><pre id="xc-resp"><code>${first.resp.join('')}</code></pre></div>
      </div>
      <div class="xc-stage"><figure class="pa" id="xc-chart">${inlineChart(first.spec)}</figure></div>
    </div>
  </section>
</section>

<section class="sec" id="protocol">
  <div class="sec-head">
    <div class="num"><span>01 · The protocol</span><span>safePlot(spec) → { ok, svg, description, errors, warnings, suggestions }</span></div>
    <h2>One message each way. <em>No pixels.</em></h2>
    <p class="sub">A model is good at knowing what the data says and bad at placing tick labels. So the protocol asks only for meaning, and keeps the craft on this side of the wire.</p>
  </div>
  <div class="steps">
    <div class="step"><span class="n">01</span><h3>Say</h3><p>The model describes the chart, not the drawing: rows of data, the role of each field, and a title that states the finding.</p></div>
    <div class="step"><span class="n">02</span><h3>Check</h3><p><code>safePlot</code> never throws. It validates against the JSON Schema and the design rules before anything is drawn.</p></div>
    <div class="step"><span class="n">03</span><h3>Repair</h3><p>Every issue carries a <code>fix</code> written for a model to read. It applies the fix and calls again, usually once.</p></div>
    <div class="step"><span class="n">04</span><h3>Show</h3><p>An SVG comes back with its alt text in <code>description</code>, so the model can read what it drew before it answers.</p></div>
  </div>
  <div class="loop" aria-label="A real repair loop">
    <div><h4><i style="background:var(--accent)"></i>First call</h4><pre><code>${highlight(badCall, 'js').replace('&quot;store_count&quot;', '<span class="bad">&quot;store_count&quot;</span>').replace('"store_count"', '<span class="bad">"store_count"</span>')}</code></pre><p class="note">A wrong field name and an 11-slice donut: two classic mistakes.</p></div>
    <div><h4><i style="background:var(--t-s)"></i>plotagents answers</h4><pre><code>${highlight(badResp, 'js')}</code></pre></div>
    <div><h4><i style="background:var(--accent)"></i>Second call → chart</h4><figure class="pa" id="fix-chart">${inlineChart(fixedSpec)}</figure></div>
  </div>
</section>

<section class="sec" id="vocabulary">
  <div class="sec-head">
    <div class="num"><span>02 · The vocabulary</span><span>${TYPES.length} chart types · schema.json</span></div>
    <h2>A small grammar for <em>every</em> chart.</h2>
    <p class="sub">Ten words carry most charts. Name a type, or leave it out and plotagents infers it from the data. seaborn names work too.</p>
  </div>
  <div class="vocab">
    <dl class="dict">${VOCAB.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl>
    <div>
      <p class="words">${typeWords.map((t, i) => `<span class="w"><a href="${FIRST_EX[t] ? `examples/#${FIRST_EX[t]}` : 'docs/charts.html'}">${t}</a>${i < typeWords.length - 1 ? '<span class="sep">/</span>' : ''}</span>`).join(' ')}</p>
      <p class="words-note">Plus <code>barplot</code>, <code>histplot</code>, <code>violinplot</code>, <code>lmplot</code>… and plain words like <code>timeline</code>, <code>map</code> or <code>roadmap</code>. The full contract is one file: <a href="schema.json">schema.json</a>.</p>
    </div>
  </div>
</section>

<section class="sec" id="gallery">
  <div class="sec-head">
    <div class="num"><span>03 · What comes back</span><span><a class="tlink" href="examples/">All ${examples.length} examples →</a></span></div>
    <h2>Drawn by the library, <em>not guessed</em> by the model.</h2>
    <p class="sub">Every chart here came from a spec of a few lines. Sorting, labeling, color, spacing and the mobile layout were decided on this side.</p>
  </div>
  <div class="plates">
    ${PLATES.map(([id, w]) => { const e = exById[id]; return `<a class="plate ${w}" href="examples/#${e.id}"><span class="img">${pics(e, p)}</span><span class="cap"><span>${esc(e.name)}</span><code>type: "${esc(e.type)}"</code></span></a>`; }).join('\n    ')}
  </div>
</section>

<section class="sec" id="maps">
  <div class="sec-head">
    <div class="num"><span>04 · Maps</span><span>GeoJSON · TopoJSON · URL</span></div>
    <h2>Bring your <em>own</em> geometry.</h2>
    <p class="sub">Chile, the United States and the world come built in. Anything else is one field away: comunas, school districts, sales territories, a campus, a floor plan.</p>
  </div>
  <div class="geo">
    <div>
      <ul class="ticks">
        <li><b>Any shape in <code>geo</code>.</b> A FeatureCollection, a Feature, a list of features, a TopoJSON, or a URL in the browser.</li>
        <li><b>No key to configure.</b> The property that matches your rows (<code>NOM_COM</code>, <code>GEOID</code>, <code>ADMIN</code>) is found for you.</li>
        <li><b>Layers on top.</b> <code>markers</code> by longitude and latitude, <code>layers</code> for rivers, routes or borders.</li>
        <li><b>Your framing.</b> <code>fitTo</code> zooms to a few regions or a box; projections from Mercator to UTM metres.</li>
        <li><b>Text values work.</b> A party or a language colors by category, with a legend.</li>
      </ul>
      ${codeBlock(`plot({
  type: 'choropleth',
  geo: myGeoJSON,     // or TopoJSON, or a URL
  data, key: 'country', value: 'language',
  markers: { data: capitals, label: 'city' },
  layers: [{ geo: tropic, dash: true }],
  fitTo: ['Chile', 'Argentina'],  // optional
})`)}
    </div>
    <figure class="pa" id="geo-chart">${inlineChart(languageSpec)}</figure>
  </div>
</section>

<section class="sec" id="rules">
  <div class="sec-head">
    <div class="num"><span>05 · The craft</span><span>From Wilke’s <em>Fundamentals of Data Visualization</em> and newsroom practice</span></div>
    <h2>Rules the model <em>can’t</em> break.</h2>
    <p class="sub">Agents reach for dual axes, twelve-slice pies and titles that say nothing. Here, the good decision is the only one available.</p>
  </div>
  <div class="rules">
    ${RULES.map(([h, t], i) => `<div class="rule"><div class="n">${String(i + 1).padStart(2, '0')}</div><h3>${esc(h)}</h3><p>${T(t)}</p></div>`).join('\n    ')}
  </div>
</section>

<section class="sec" id="integrate">
  <div class="sec-head">
    <div class="num"><span>06 · Integrate</span><span>Anthropic · OpenAI · any runtime</span></div>
    <h2>Hand it to <em>any</em> model.</h2>
    <p class="sub">The protocol ships as a JSON Schema and a ready-made tool definition, plus a one-page guide for the system prompt.</p>
  </div>
  <div class="integ">
    <ul class="ticks">
      <li><b><code>toolDefinition()</code></b> turns the schema into a tool for Claude or OpenAI.</li>
      <li><b><code>safePlot(spec)</code></b> returns the SVG or the errors, each with a <code>fix</code>.</li>
      <li><b><code>describe(spec)</code></b> writes alt text the model can check.</li>
      <li><b><a href="docs/agents.html">The guide for agents</a></b>, also as <a href="AGENTS.md">AGENTS.md</a> and <a href="llms.txt">llms.txt</a>.</li>
      <li><b><code>render()</code></b> in the browser adds tooltips, sliders, drill-down and map zoom.</li>
    </ul>
    <div>
      <div class="tabs" role="tablist" aria-label="Integration">${INTEG_TABS.map(([k, l], i) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${i === 0}">${l}</button>`).join('')}</div>
      ${INTEG_TABS.map(([k], i) => `<div data-panel="${k}"${i ? ' hidden' : ''}>${codeBlock(integ[k], k === 'cli' ? 'sh' : k === 'browser' ? 'html' : 'js')}</div>`).join('\n      ')}
    </div>
  </div>
</section>

<section class="close">
  <h2>Let your agent <em>show</em>, not just tell.</h2>
  <div class="row">
    <span class="install"><span class="pr">$</span> npm install plotagents <button class="copy" type="button" data-copy="npm install plotagents">Copy</button></span>
    <a class="btn" href="docs/getting-started.html">Get started <span class="arr">→</span></a>
    <a class="tlink" href="${REPO}" rel="noopener">Star on GitHub</a>
  </div>
</section>
</div>`;
  const home = { xcs: xcs.map(({ id, call, resp, ask, spec }) => ({ id, call, resp, ask, spec })), fixed: fixedSpec, geo: languageSpec };
  write('index.html', layout({
    p, active: '', title: '',
    description: 'An open protocol for AI agents to speak in charts: the model sends one JSON spec, plotagents returns a finished, accessible SVG or the exact fix it needs.',
    body,
    scripts: `${libScripts(p, false)}\n${jsonScript('pa-home', home)}\n<script src="${p}assets/home.js"></script>`,
  }));
}

// ── 404 ────────────────────────────────────────────────────────────────────
write('404.html', layout({
  p: BASE, title: 'Page not found', description: 'Page not found.',
  body: `<div class="wrap" style="padding-block:96px;min-height:50vh"><p class="kicker">404</p><h1 style="font-size:40px;letter-spacing:-.02em;margin:0 0 12px">This page is not here</h1><p style="color:var(--lede);font-size:18px">Try the <a href="${BASE}docs/">documentation</a>, the <a href="${BASE}examples/">examples</a> or the <a href="${BASE}">home page</a>.</p></div>`,
}));

const n = examples.length;
console.log(`Sitio: ${DOCS.length} páginas de documentación, ${n} ejemplos → ${posix.relative(root.replace(/\\/g, '/'), OUT.replace(/\\/g, '/')) || OUT}/`);
if (!existsSync(join(OUT, 'index.html'))) process.exit(1);
