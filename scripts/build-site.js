// Genera el sitio de GitHub Pages en _site/: portada, documentación (docs/*.md
// y AGENTS.md), galería de ejemplos en vivo y playground.
//   node scripts/build-site.js            → _site/
//   SITE_BASE=/plotagents/ node scripts/build-site.js
import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { plot, lint, resolve as resolveSpec, TYPES } from '../src/index.js';
import { FONT_CSS } from '../src/theme.js';
import { gallery, ORDER, nameOf, noteOf, sectionName, slug, snippet } from '../examples/gallery.js';
import { markdown, highlight, esc } from '../site/md.js';
import { heroSpec, quickSpec, quickCode } from '../site/home-specs.js';

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
for (const f of ['site.css', 'site.js', 'gallery.js', 'playground.js']) copy('site/' + f, 'assets/' + f);
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
};

const THEME_BOOT = `<script>(function(){var d=document.documentElement,p='auto';try{p=localStorage.getItem('pa-theme')||'auto'}catch(e){}if(p==='light'||p==='dark')d.setAttribute('data-theme',p);d.setAttribute('data-pref',p)})()</script>`;

function layout({ p, active = '', title, description, body, scripts = '', bodyClass = '' }) {
  const nav = [['docs', 'Docs', 'docs/'], ['examples', 'Examples', 'examples/'], ['playground', 'Playground', 'playground/']];
  const fullTitle = title ? `${title} · plotagents` : 'plotagents · charts from one JSON spec, built for AI agents';
  return `<!doctype html>
<html lang="en" data-pref="auto"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description)}">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta name="theme-color" content="#F4F3EF" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#070A1F" media="(prefers-color-scheme: dark)">
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#141A3F"/><rect x="7" y="16" width="4" height="9" rx="1.5" fill="#E8A33D"/><rect x="14" y="10" width="4" height="15" rx="1.5" fill="#D42A5E"/><rect x="21" y="6" width="4" height="19" rx="1.5" fill="#6170E0"/></svg>')}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONT_CSS}">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fragment+Mono&display=swap">
<link rel="stylesheet" href="${p}assets/site.css">
${THEME_BOOT}
<script src="${p}assets/site.js"></script>
</head>
<body class="${bodyClass}">
<a class="sr-only" href="#main">Skip to content</a>
<header class="topbar"><div class="wrap">
  <a class="logo" href="${p}">plot<b>agents</b></a>
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
  <span>plotagents ${esc(pkg.version)} · MIT © Carlos Navarrete · All example data is illustrative.</span>
  <nav><a href="${p}docs/">Docs</a><a href="${p}examples/">Examples</a><a href="${p}playground/">Playground</a><a href="${p}llms.txt">llms.txt</a><a href="${REPO}" rel="noopener">GitHub</a></nav>
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
  <div class="actions"><details><summary>Show code</summary>${codeBlock(snippet(e.spec, { more: 'more rows' }))}</details></div>
  <a class="pg" href="${p}playground/#ex=${e.id}">Open in playground →</a>
</article>`;
  const body = `<div class="wrap">
<section class="g-head">
  <p class="kicker">Gallery</p>
  <h1>${examples.length} examples, all live</h1>
  <p>Every chart below is drawn in your browser from the spec under “Show code”. Hover for values, drag the time sliders, click a treemap group to drill down or a network node to focus it. Chart text uses the default Spanish (Chile) locale; set <code>locale: "en"</code> for English number formats.</p>
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
    ...examples.map((e) => ({ id: e.id, name: e.name, section: sectionName(e.section), spec: e.spec })),
  ];
  const groups = [...new Set(presets.map((x) => x.section))];
  const body = `<div class="wrap pg-page">
<section class="pg-editor" aria-label="Spec editor">
  <div class="pg-bar">
    <label class="sr-only" for="preset">Start from an example</label>
    <select id="preset"><option value="">Custom spec</option>${groups.map((g) => `<optgroup label="${esc(g)}">${presets.filter((x) => x.section === g).map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join('')}</optgroup>`).join('')}</select>
    <button class="btn ghost small" type="button" id="format">Format</button>
  </div>
  <label class="sr-only" for="spec">Spec (JSON)</label>
  <textarea id="spec" spellcheck="false" autocapitalize="off" autocomplete="off" aria-describedby="hint"></textarea>
  <p class="pg-desc" id="hint">JSON or a JavaScript object. The chart redraws as you type; <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>Enter</kbd> redraws now.</p>
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
    body, scripts: `${libScripts(p)}\n${jsonScript('pa-presets', presets)}\n<script src="${p}assets/playground.js"></script>`,
  }));
}

// ── Portada ────────────────────────────────────────────────────────────────
{
  const p = '';
  const SHOW = ['lineas', 'treemap-niveles', 'regresion', 'violin', 'sunburst', 'mapa-chile', 'red', 'cuerdas', 'piramide', 'sankey', 'conjunto', 'kpi'];
  const thumbs = SHOW.filter((id) => exById[id]).map((id) => exById[id]);
  const PURPOSES = [
    ['Compare categories', ['bar', 'barplot', 'countplot']],
    ['Change over time', ['line', 'area']],
    ['Relationships', ['scatter', 'bubble', 'regplot', 'residplot', 'jointplot', 'radar']],
    ['Distributions', ['hist', 'kde', 'ecdf', 'box', 'violin', 'strip', 'swarm', 'point']],
    ['Part-to-whole', ['treemap', 'sunburst', 'donut', 'pie']],
    ['Maps', ['choropleth', 'symbolmap']],
    ['Networks and flows', ['network', 'chord', 'sankey', 'flowchart']],
    ['Populations, grids, numbers', ['pyramid', 'heatmap', 'kpi']],
  ];
  const FEATURES = [
    ['#3A47B8', 'The title states the finding', '`lint` nudges toward a title with the key number, and `describe` writes the alt text for you.'],
    ['#D42A5E', 'One axis, always', 'There is no dual axis: `index: true` rebases series to 100 and `facet` draws panels on a shared scale.'],
    ['#E8A33D', 'Labels where the eye is', 'Every line is labeled at its end; colliding labels spread apart with leader lines. A legend appears only when needed.'],
    ['#1E9C89', 'Color follows the entity', 'Eight colorblind-safe colors in a fixed order. “Copper” keeps its color when you filter, drill down or move the slider.'],
    ['#7B5CD6', 'Interactive in the browser', 'Tooltips, time sliders with play, drill-down treemaps, click-to-focus networks and linked legends.'],
    ['#B5562E', 'SVG, fast and accessible', 'Server-side rendering with zero dependencies; dense charts are batched into paths, faster than Canvas.'],
  ];
  const agentCode = `import Anthropic from '@anthropic-ai/sdk';
import { safePlot, toolDefinition } from 'plotagents';

const client = new Anthropic();
const res = await client.messages.create({
  model: process.env.ANTHROPIC_MODEL,
  max_tokens: 4096,
  tools: [toolDefinition()],          // JSON Schema of every option
  messages: [{ role: 'user', content: 'Chart service times per clinic: …' }],
});

const call = res.content.find((b) => b.type === 'tool_use');
const { ok, svg, errors, suggestions } = safePlot(call.input);
// Never throws. If !ok, send \`errors\` back: each one has a \`fix\`.`;
  const body = `<div class="wrap">
<section class="hero">
  <div>
    <p class="kicker">Charts for AI agents</p>
    <h1>One JSON spec in. <em>A finished chart</em> out.</h1>
    <p class="lede">Data and field names go in; an accessible SVG comes out, with careful typography, colorblind-safe colors and tooltips. plotagents makes the design decisions so an agent, or you, never has to.</p>
    <span class="install">npm install plotagents <button class="copy" type="button" data-copy="npm install plotagents">Copy</button></span>
    <div class="ctas">
      <a class="btn" href="docs/">Get started</a>
      <a class="btn ghost" href="examples/">Browse ${examples.length} examples</a>
      <a class="btn ghost" href="playground/">Open the playground</a>
    </div>
    <div class="stats"><span><b>${TYPES.length}</b>chart types</span><span><b>0</b>dependencies</span><span><b>SVG</b>Node, Deno, Bun, browser</span></div>
  </div>
  <figure class="pa hero-chart" id="hero-chart">${inlineChart(heroSpec)}</figure>
</section>

<section class="band" id="quick-start">
  <p class="kicker">Quick start</p>
  <h2>Name the fields. Write the finding. Done.</h2>
  <p class="sub">No margins, colors, tick counts or label positions to choose. The bars sort themselves, values sit on the tips, the axis disappears because it is no longer needed, and <code>highlight</code> mutes everything but the point of the chart.</p>
  <div class="split">
    ${codeBlock(quickCode)}
    <figure class="pa panel" id="quick-chart">${inlineChart(quickSpec)}</figure>
  </div>
</section>

<section class="band">
  <p class="kicker">Why plotagents</p>
  <h2>Design rules written into the code</h2>
  <p class="sub">Agents are good at data and bad at charts: dual axes, 12-slice pies, titles that say nothing. The rules here come from data-visualization teaching (Wilke’s <em>Fundamentals of Data Visualization</em>, the Data Viz Catalogue, the Atlas of Economic Complexity).</p>
  <div class="features">
    ${FEATURES.map(([c, h, t]) => `<div class="feature"><h3><span class="dot" style="background:${c}"></span>${esc(h)}</h3><p>${esc(t).replace(/`([^`]+)`/g, '<code>$1</code>')}</p></div>`).join('\n    ')}
  </div>
</section>

<section class="band">
  <p class="kicker">Gallery</p>
  <h2>${TYPES.length} chart types, seaborn’s included</h2>
  <p class="sub">From bars and lines to multi-level treemaps, choropleth maps of Chile, the United States and the world, networks, chord diagrams and flow charts. seaborn names work too: <code>histplot</code>, <code>violinplot</code>, <code>lmplot</code>…</p>
  <div class="thumbs">
    ${thumbs.map((e) => `<a class="thumb" href="examples/#${e.id}"><span class="img">${pics(e, p)}</span><span class="t">${esc(e.name)}<small>type: '${esc(e.type)}'</small></span></a>`).join('\n    ')}
  </div>
  <div class="types">
    ${PURPOSES.map(([h, ts]) => `<div><h3>${esc(h)}</h3>${ts.map((t) => `<code>${t}</code>`).join('')}</div>`).join('\n    ')}
  </div>
  <p style="margin-top:24px"><a class="btn" href="examples/">See all ${examples.length} examples</a> <a class="btn ghost" href="docs/charts.html">Chart reference</a></p>
</section>

<section class="band">
  <p class="kicker">Built for agents</p>
  <h2>A tool an agent can call, and fix on its own</h2>
  <div class="split">
    <div class="prose">
      <ul>
        <li><strong><code>toolDefinition()</code></strong> turns the JSON Schema into a tool for Claude or OpenAI.</li>
        <li><strong><code>safePlot(spec)</code></strong> never throws. It returns the SVG plus <code>errors</code>, <code>warnings</code> and <code>suggestions</code>, each with a <code>fix</code>, so the agent can correct the spec and call again.</li>
        <li><strong><code>describe(spec)</code></strong> writes alt text, so the agent can check what it drew.</li>
        <li><strong>A one-page guide</strong> for the system prompt: <a href="docs/agents.html">read it</a>, or fetch it as <a href="AGENTS.md">AGENTS.md</a> / <a href="llms.txt">llms.txt</a>.</li>
      </ul>
      <p><a class="btn ghost" href="docs/api.html">API reference</a></p>
    </div>
    ${codeBlock(agentCode)}
  </div>
</section>
</div>`;
  const specs = { 'hero-chart': heroSpec, 'quick-chart': quickSpec };
  write('index.html', layout({
    p, active: '', title: '',
    description: pkg.description,
    body,
    scripts: `${libScripts(p, false)}\n${jsonScript('pa-home', specs)}\n<script>(function(){var s=JSON.parse(document.getElementById('pa-home').textContent);Object.keys(s).forEach(function(id){site.mount(document.getElementById(id),s[id]);});})();</script>`,
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
