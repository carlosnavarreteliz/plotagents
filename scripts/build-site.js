// Genera el sitio de GitHub Pages en _site/: portada, documentación (docs/*.md
// y AGENTS.md), galería de ejemplos en vivo y playground.
//   node scripts/build-site.js            → _site/        (inglés)
//   node scripts/build-site.js --lang es  → _site/es/     (español; correr después del inglés)
//   SITE_BASE=/plotagents/ node scripts/build-site.js
import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { plot, lint, safePlot, resolve as resolveSpec, TYPES, colorScaleNames, resolveColorScale } from '../src/index.js';
import { FONT_CSS } from '../src/theme.js';
import { gallery, ORDER, nameOf, noteOf, sectionName, slug, snippet } from '../examples/gallery.js';
import { markdown, highlight, esc } from '../site/md.js';
import { planDashboard, dashboardMarkup, DASH_CSS } from '../src/dashboard.js';
import { salesDashboard } from '../examples/dashboard.js';
import { homeSpecs } from '../site/home-specs.js';
import { zip } from '../site/zip.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Idioma: el inglés vive en la raíz del sitio y el español en /es/, con la misma estructura.
const li = process.argv.indexOf('--lang');
const LANG = li > 0 && process.argv[li + 1] === 'es' ? 'es' : 'en';
const ES = LANG === 'es';
/** Texto en el idioma de esta compilación. */
const t = (en, es) => (ES ? es : en);
const SITE_ROOT = join(root, process.env.SITE_OUT || '_site');
const OUT = ES ? join(SITE_ROOT, 'es') : SITE_ROOT;
const BASE = process.env.SITE_BASE || '/plotagents/';
const { heroSpec, quickSpec, ganttSpec, trendSpec, exchanges, badSpec, fixedSpec, languageSpec } = homeSpecs(LANG);
const SKILL_CMD = 'npx skills add carlosnavarreteliz/plotagents';
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
// La Agent Skill: el SKILL.md suelto y un .zip con la carpeta, listo para subir a la app de Claude.
const skillMd = read('skills/plotagents/SKILL.md');
write('skill/SKILL.md', skillMd);
write('skill/plotagents-skill.zip', zip([{ name: 'plotagents/SKILL.md', data: skillMd }]));

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
  return { ...ex, fixed, type: typeOf(ex.spec), size: viewBox(light), name: ES ? ex.name : nameOf(ex), note: ES ? ex.note : noteOf(ex) };
});
const exById = Object.fromEntries(examples.map((e) => [e.id, e]));
const secName = (sec) => (ES ? sec : sectionName(sec));

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
  globe: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><circle cx="8" cy="8" r="6.3"/><path d="M1.7 8h12.6M8 1.7c1.8 1.9 2.6 4 2.6 6.3S9.8 12.4 8 14.3M8 1.7C6.2 3.6 5.4 5.7 5.4 8s.8 4.4 2.6 6.3"/></svg>',
  download: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 3v10M5.5 8.5 10 13l4.5-4.5M4 16.5h12"/></svg>',
  search: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="7" cy="7" r="5"/><path d="M11 11l3.5 3.5"/></svg>',
  // Marca: una llave de JSON que se abre en tres barras.
  mark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3.5C4.8 3.5 4.5 5 4.5 6.5v3c0 1.2-.6 2.1-2 2.5 1.4.4 2 1.3 2 2.5v3c0 1.5.3 3 2.5 3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><rect x="9.5" y="12" width="3" height="8" rx="1" fill="#E8A33D"/><rect x="14" y="8" width="3" height="12" rx="1" fill="var(--accent)"/><rect x="18.5" y="4" width="3" height="16" rx="1" fill="#6170E0"/></svg>',
};

// Favicon = la marca del logo (llave + tres barras), con tinta clara en pestañas oscuras.
const FAVICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><style>.b{stroke:#141A3F}.m{fill:#D42A5E}@media (prefers-color-scheme:dark){.b{stroke:#F2F3FA}.m{fill:#FF4D7D}}</style><path class="b" d="M7 3.5C4.8 3.5 4.5 5 4.5 6.5v3c0 1.2-.6 2.1-2 2.5 1.4.4 2 1.3 2 2.5v3c0 1.5.3 3 2.5 3" fill="none" stroke-width="2.2" stroke-linecap="round"/><rect x="9.5" y="12" width="3" height="8" rx="1" fill="#E8A33D"/><rect class="m" x="14" y="8" width="3" height="12" rx="1"/><rect x="18.5" y="4" width="3" height="16" rx="1" fill="#6170E0"/></svg>';
write('favicon.svg', FAVICON);

// Primera visita con el navegador en español → la versión en español (una sola vez:
// elegir un idioma con el botón EN/ES queda guardado y manda desde ahí).
const LANG_BOOT = `<script>(function(){try{var d=document.documentElement,k='pa-lang',s=localStorage.getItem(k),a=d.getAttribute('data-alt');if(!s&&d.lang==='en'&&a&&/^es\\b/i.test(navigator.language||'')&&!/[?&]lang=en/.test(location.search)){localStorage.setItem(k,'es');location.replace(a+location.hash)}}catch(e){}})()</script>`;
const THEME_BOOT = `<script>addEventListener('scroll',function(){document.documentElement.classList.toggle('scrolled',scrollY>8)},{passive:true});(function(){var d=document.documentElement,p='auto';try{p=localStorage.getItem('pa-theme')||'auto'}catch(e){}if(p==='light'||p==='dark')d.setAttribute('data-theme',p);d.setAttribute('data-pref',p)})()</script>`;

function layout({ p, path = '', active = '', title, description, body, scripts = '', bodyClass = '' }) {
  const nav = [['protocol', t('Protocol', 'Protocolo'), 'docs/agents.html'], ['docs', t('Docs', 'Documentación'), 'docs/'], ['examples', t('Examples', 'Ejemplos'), 'examples/'], ['dashboard', 'Dashboards', 'dashboard/'], ['playground', 'Playground', 'playground/'], ['skill', 'Skill', '#skill']];
  const fullTitle = title ? `${title} · plotagents` : t('plotagents · the chart protocol for AI agents', 'plotagents · el protocolo de gráficos para agentes de IA');
  // La misma página en el otro idioma: el español cuelga de /es/.
  const other = ES ? `${p}../${path}` : `${p}es/${path}`;
  const enUrl = `https://carlosnavarrete.cl${BASE}${path}`, esUrl = `https://carlosnavarrete.cl${BASE}es/${path}`;
  return `<!doctype html>
<html lang="${LANG}" data-pref="auto" data-alt="${other}"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description)}">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website">
<link rel="alternate" hreflang="en" href="${enUrl}">
<link rel="alternate" hreflang="es" href="${esUrl}">
<link rel="alternate" hreflang="x-default" href="${enUrl}">
<meta name="theme-color" content="#FCFBF9" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0B0F2B" media="(prefers-color-scheme: dark)">
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${encodeURIComponent(FAVICON)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONT_CSS}">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fragment+Mono&family=Instrument+Serif:ital@1&display=swap">
<link rel="stylesheet" href="${p}assets/site.css">
${LANG_BOOT}
${THEME_BOOT}
<script src="${p}assets/site.js"></script>
</head>
<body class="${bodyClass}">
<a class="sr-only" href="#main">${t('Skip to content', 'Ir al contenido')}</a>
<header class="topbar"><div class="wrap">
  <a class="logo" href="${p}" aria-label="${t('plotagents home', 'Inicio de plotagents')}">${ICON.mark}<span>plot<b>agents</b></span></a>
  <button class="icon-btn menu-btn" type="button" aria-label="${t('Menu', 'Menú')}" aria-expanded="false">${ICON.menu}</button>
  <nav class="topnav" aria-label="${t('Main', 'Principal')}">
    ${nav.map(([k, label, href]) => `<a href="${p}${href}"${k === active ? ' aria-current="page"' : ''}${k === 'skill' ? ' class="nav-skill"' : ''}>${label}</a>`).join('\n    ')}
    <a href="${REPO}" rel="noopener" aria-label="${t('GitHub repository', 'Repositorio en GitHub')}">GitHub</a>
    <a class="lang-btn" href="${other}" hreflang="${ES ? 'en' : 'es'}" lang="${ES ? 'en' : 'es'}" data-lang="${ES ? 'en' : 'es'}" aria-label="${t('Leer en español', 'Read in English')}">${ICON.globe}<span>${ES ? 'EN' : 'ES'}</span></a>
    <button class="icon-btn theme-btn" type="button" aria-label="${t('Toggle theme', 'Cambiar tema')}">${ICON.auto}${ICON.light}${ICON.dark}</button>
  </nav>
</div></header>
<div id="main">
${body}
</div>
<footer class="foot"><div class="wrap">
  <span>plotagents ${esc(pkg.version)} · MIT © Carlos Navarrete · ${t('Example data is illustrative unless a source says otherwise.', 'Los datos de los ejemplos son ilustrativos salvo que la fuente diga otra cosa.')}</span>
  <nav><a href="${p}docs/agents.html">${t('Protocol', 'Protocolo')}</a><a href="${p}docs/">${t('Docs', 'Documentación')}</a><a href="${p}examples/">${t('Examples', 'Ejemplos')}</a><a href="${p}playground/">Playground</a><a href="${p}#skill">Skill</a><a href="${p}llms.txt">llms.txt</a><a href="${REPO}" rel="noopener">GitHub</a><a href="${other}" lang="${ES ? 'en' : 'es'}" data-lang="${ES ? 'en' : 'es'}">${ES ? 'English' : 'Español'}</a></nav>
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
// `file` es el original en inglés (base de los enlaces); `es` es su traducción en docs/es/.
const DOCS = [
  { slug: 'getting-started', file: 'docs/getting-started.md', label: t('Getting started', 'Primeros pasos'), group: t('Guide', 'Guía') },
  { slug: 'charts', file: 'docs/charts.md', label: t('Chart reference', 'Referencia de gráficos'), group: t('Guide', 'Guía') },
  { slug: 'themes', file: 'docs/themes.md', label: t('Themes and colors', 'Temas y colores'), group: t('Guide', 'Guía') },
  { slug: 'colorscales', file: 'docs/colorscales.md', label: t('Color scales', 'Escalas de color'), group: t('Guide', 'Guía') },
  { slug: 'dashboards', file: 'docs/dashboards.md', label: 'Dashboards', group: t('Guide', 'Guía') },
  { slug: 'api', file: 'docs/api.md', label: t('API reference', 'Referencia de la API'), group: t('Reference', 'Referencia') },
  { slug: 'agents', file: 'AGENTS.md', es: 'docs/es/agents.md', label: t('Guide for AI agents', 'Guía para agentes de IA'), group: t('Reference', 'Referencia'), title: t('Guide for AI agents', 'Guía para agentes de IA') },
  { slug: 'rendering', file: 'docs/rendering.md', label: t('SVG and performance', 'SVG y rendimiento'), group: t('Reference', 'Referencia') },
].map((d) => ({ ...d, es: d.es || d.file.replace(/^docs\//, 'docs/es/') }));

/** Texto de una página en el idioma del sitio. La traducción toma los anclajes del inglés,
 *  título por título, para que los enlaces `archivo.md#ancla` sigan funcionando. */
function docSource(d) {
  const en = read(d.file);
  if (!ES) return en;
  if (!existsSync(join(root, d.es))) { console.warn(`[es] falta ${d.es}: uso el inglés`); return en; }
  const ids = [...markdown(en, { link: (h) => h }).html.matchAll(/<h[1-6] id="([^"]+)"/g)].map((m) => m[1]);
  const lines = read(d.es).split('\n');
  let fence = false, k = 0;
  const heads = [];
  lines.forEach((l, i) => { if (/^\s*(```|~~~)/.test(l)) fence = !fence; else if (!fence && /^#{1,6}\s/.test(l)) heads.push(i); });
  if (heads.length !== ids.length) { console.warn(`[es] ${d.es}: ${heads.length} títulos y el inglés tiene ${ids.length}; anclajes sin fijar`); return lines.join('\n'); }
  for (const i of heads) if (!/\{#[\w-]+\}\s*$/.test(lines[i])) lines[i] = lines[i].replace(/\s*#*\s*$/, '') + ` {#${ids[k++]}}`; else k++;
  return lines.join('\n');
}
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
  return `<div class="doc-ex" aria-label="${t('Examples', 'Ejemplos')}">${list.map((e) => `<a href="../examples/#${e.id}"><span class="img">${pics(e, '../')}</span><span class="t">${esc(e.name)}</span></a>`).join('')}</div>`;
}

const sidebar = (cur) => {
  const groups = [...new Set(DOCS.map((d) => d.group))];
  return `<aside class="side" aria-label="${t('Documentation', 'Documentación')}">${groups.map((g) => `<h4>${g}</h4><ul>${DOCS.filter((d) => d.group === g).map((d) => `<li><a href="${d.slug}.html"${d === cur ? ' aria-current="page"' : ''}>${esc(d.label)}</a></li>`).join('')}</ul>`).join('')}
<h4>${t('More', 'Más')}</h4><ul><li><a href="../#skill">${t('Install the Agent Skill', 'Instalar la Agent Skill')}</a></li><li><a href="../dashboard/">${t('Live dashboard', 'Dashboard en vivo')}</a></li><li><a href="../examples/">${t('Examples', 'Ejemplos')}</a></li><li><a href="../playground/">Playground</a></li><li><a href="../schema.json">schema.json</a></li></ul></aside>`;
};

/** Franjas de todas las escalas de color, agrupadas por tipo (página Color scales). */
function colorScaleGallery() {
  const groups = colorScaleNames();
  const title = { sequential: t('Sequential', 'Secuenciales'), diverging: t('Diverging', 'Divergentes'), cyclic: t('Cyclic', 'Cíclicas'), qualitative: t('Qualitative (for palette)', 'Cualitativas (para palette)') };
  return Object.entries(groups).map(([kind, names]) => `<h3 id="cs-${kind}">${title[kind]}</h3>\n<div class="cscales">${names.map((n) => {
    const cs = resolveColorScale(n);
    const bg = kind === 'qualitative'
      ? `linear-gradient(to right,${cs.stops.map((c, i) => `${c} ${(i / cs.stops.length) * 100}% ${((i + 1) / cs.stops.length) * 100}%`).join(',')})`
      : `linear-gradient(to right,${cs.stops.map((c, i) => `${c} ${(i / (cs.stops.length - 1)) * 100}%`).join(',')})`;
    return `<div class="cs"><span class="cs-bar" style="background:${bg}"></span><code>${esc(n)}</code></div>`;
  }).join('')}</div>`).join('\n');
}

for (const [i, d] of DOCS.entries()) {
  const md = markdown(docSource(d), { link: docLink(d.file), afterHeading: d.slug === 'charts' ? examplesFor : () => '' });
  let html = md.html;
  if (d.title) html = html.replace(/<h1 id="[^"]*">[\s\S]*?<\/h1>/, `<h1 id="top">${esc(d.title)}</h1>`);
  if (d.slug === 'colorscales') html = html.replace(/<p>\{\{colorscales\}\}<\/p>/, colorScaleGallery());
  if (d.slug === 'agents') html = html.replace('</h1>', `</h1>\n<p>${t(`A short guide meant to be pasted into an agent's system prompt. The same text is published as plain Markdown at <a href="../AGENTS.md">AGENTS.md</a> and <a href="../llms.txt">llms.txt</a>. To have your AI follow it on its own, <a href="../#skill">install the Agent Skill</a>.`, `Una guía breve pensada para pegarla en el prompt de sistema de un agente. El mismo texto, en inglés, está publicado como Markdown en <a href="../AGENTS.md">AGENTS.md</a> y <a href="../llms.txt">llms.txt</a>. Para que tu IA la siga sola, <a href="../#skill">instala la Agent Skill</a>.`)}</p>`);
  const prev = DOCS[i - 1], next = DOCS[i + 1];
  const toc = md.toc.filter((t) => t.level >= 2);
  const title = d.title || md.title;
  const body = `<div class="wrap docs">
${sidebar(d)}
<article class="prose">
<div class="doc-nav-mobile"><label class="sr-only" for="docsel">${t('Page', 'Página')}</label><select id="docsel">${DOCS.map((x) => `<option value="${x.slug}.html"${x === d ? ' selected' : ''}>${esc(x.label)}</option>`).join('')}</select></div>
${html}
<nav class="pager" aria-label="${t('Pages', 'Páginas')}">${prev ? `<a class="prev" href="${prev.slug}.html"><small>${t('Previous', 'Anterior')}</small>${esc(prev.label)}</a>` : ''}${next ? `<a class="next" href="${next.slug}.html"><small>${t('Next', 'Siguiente')}</small>${esc(next.label)}</a>` : ''}</nav>
<p class="edit"><a href="${REPO}/blob/${BRANCH}/${ES ? d.es : d.file}" rel="noopener">${t('Edit this page on GitHub', 'Editar esta página en GitHub')}</a></p>
</article>
${toc.length > 1 ? `<nav class="toc" aria-label="${t('On this page', 'En esta página')}"><h4>${t('On this page', 'En esta página')}</h4><ul>${toc.map((t) => `<li><a class="l${t.level}" href="#${t.id}">${t.html}</a></li>`).join('')}</ul></nav>` : '<div></div>'}
</div>`;
  const description = (/<p>([\s\S]*?)<\/p>/.exec(html)?.[1] || '').replace(/<[^>]+>/g, '').slice(0, 200);
  const page = layout({ p: '../', path: `docs/${d.slug}.html`, active: 'docs', title, description, body });
  write(`docs/${d.slug}.html`, page);
  if (i === 0) write('docs/index.html', page);
}

// ── Galería ────────────────────────────────────────────────────────────────
{
  const p = '../';
  const secs = ORDER.filter((sec) => examples.some((e) => e.section === sec));
  const extra = [...new Set(examples.map((e) => e.section))].filter((s) => !secs.includes(s));
  const allSecs = [...secs, ...extra];
  const card = (e) => `<article class="card${(e.spec.theme === 'noche' || e.spec.theme?.extends === 'noche') ? ' always-dark' : ''}" id="${e.id}" data-search="${esc([e.name, e.note, e.type, e.id, secName(e.section)].join(' '))}">
  <header><h3><a href="#${e.id}">${esc(e.name)}</a></h3><span class="type">${esc(e.type)}</span></header>
  <p class="note">${esc(e.note).replace(/`([^`]+)`/g, '<code>$1</code>')}</p>
  <figure class="pa" data-id="${e.id}">${pics(e, p)}</figure>
  <div class="actions"><details><summary>${t('Show spec', 'Ver spec')}</summary>${codeBlock(snippet(e.spec, { more: t('more rows', 'filas más') }))}</details></div>
  <a class="pg" href="${p}playground/#ex=${e.id}">${t('Open in playground', 'Abrir en el playground')} →</a>
</article>`;
  const body = `<div class="wrap">
<section class="g-head">
  <h1>${t(`${examples.length} charts, <em>all live.</em>`, `${examples.length} gráficos, <em>todos en vivo.</em>`)}</h1>
  <p>${t('Every chart below is drawn in your browser from the spec under “Show spec”: exactly what an agent would send. Hover for values, drag the time sliders, click a treemap group to drill down or a network node to focus it. Chart text uses the default Spanish (Chile) locale; set <code>locale: "en"</code> for English.', 'Cada gráfico se dibuja en tu navegador a partir del spec que está en “Ver spec”: exactamente lo que enviaría un agente. Pasa el cursor para ver los valores, mueve los sliders de tiempo, haz clic en un grupo del treemap para entrar en él o en un nodo de una red para centrarlo. Los textos usan el formato de Chile, el predeterminado; con <code>locale: "en"</code> quedan en inglés.')}</p>
</section>
<div class="g-tools">
  <div class="chips" role="toolbar" aria-label="${t('Filter by section', 'Filtrar por sección')}">
    <button class="chip" type="button" data-sec="all" aria-pressed="true">${t('All', 'Todos')} <span class="n">${examples.length}</span></button>
    ${allSecs.map((sec) => `<button class="chip" type="button" data-sec="sec-${slug(sec)}" aria-pressed="false">${esc(secName(sec))} <span class="n">${examples.filter((e) => e.section === sec).length}</span></button>`).join('\n    ')}
  </div>
  <label class="search">${ICON.search}<span class="sr-only">${t('Search examples', 'Buscar ejemplos')}</span><input type="search" placeholder="${t('Search: violin, map, slider…  /', 'Buscar: violín, mapa, slider…  /')}" autocomplete="off"></label>
</div>
${allSecs.map((sec) => `<section class="g-sec" id="sec-${slug(sec)}"><h2>${esc(secName(sec))} <span>${examples.filter((e) => e.section === sec).length}</span></h2>
<div class="g-grid">
${examples.filter((e) => e.section === sec).map(card).join('\n')}
</div></section>`).join('\n')}
<p class="empty" hidden>${t(`No example matches. Try another word, or <a href="${p}playground/">build your own in the playground</a>.`, `Ningún ejemplo coincide. Prueba otra palabra o <a href="${p}playground/">arma el tuyo en el playground</a>.`)}</p>
</div>`;
  const specs = examples.map((e) => ({ id: e.id, spec: e.spec, fixed: e.fixed }));
  write('examples/index.html', layout({
    p, path: 'examples/', active: 'examples', title: t('Examples', 'Ejemplos'),
    description: t(`${examples.length} live chart examples with code: bars, lines, treemaps, maps, networks, seaborn-style distributions and more.`, `${examples.length} ejemplos de gráficos en vivo con su código: barras, líneas, treemaps, mapas, redes, distribuciones al estilo seaborn y más.`),
    body, scripts: `${libScripts(p)}\n${jsonScript('pa-specs', specs)}\n<script src="${p}assets/gallery.js"></script>`,
  }));
}

// ── Dashboard en vivo ──────────────────────────────────────────────────────
{
  const p = '../';
  const spec = salesDashboard(LANG);
  const plan = planDashboard(spec);
  const svgs = {};
  for (const x of plan.panels) svgs[x.id] = plot({ ...x.spec, width: x.span >= 12 ? 1200 : x.span >= 8 ? 800 : x.span >= 6 ? 600 : 420 });
  const body = `<div class="wrap dash-page">
<section class="g-head">
  <h1>${t('A dashboard from <em>one spec.</em>', 'Un dashboard con <em>un solo spec.</em>')}</h1>
  <p>${t(`Four KPIs, four charts and two filters, laid out by <code>dashboard()</code>: numbers first, the trend full width, balanced rows, one color per region in every chart, one source line. Click a region or a channel: every chart and KPI follows. <a href="${p}docs/dashboards.html">How it decides →</a>`, `Cuatro KPI, cuatro gráficos y dos filtros, ordenados por <code>dashboard()</code>: primero las cifras, la tendencia a todo el ancho, filas equilibradas, un color por región en todos los gráficos y una sola línea de fuente. Haz clic en una región o un canal: todos los gráficos y KPI lo siguen. <a href="${p}docs/dashboards.html">Cómo decide →</a>`)}</p>
</section>
<div id="board">${dashboardMarkup(plan, svgs)}</div>
<details class="dash-spec"><summary>${t('Show spec', 'Ver spec')}</summary>${codeBlock(`dashboard(${JSON.stringify({ ...spec, data: '__DATA__' }, null, 2).replace(/"(\w+)":/g, '$1:').replace('"__DATA__"', `[ /* ${spec.data.length} ${t('rows', 'filas')}: ${Object.keys(spec.data[0]).join(', ')} */ ]`)})`)}</details>
</div>`;
  write('dashboard/index.html', layout({
    p, path: 'dashboard/', active: 'dashboard', title: t('Live dashboard', 'Dashboard en vivo'),
    description: t('A complete, interactive dashboard built from one spec with plotagents: KPIs, a trend, a map, bars and a treemap, with shared filters.', 'Un dashboard completo e interactivo hecho con un solo spec de plotagents: KPI, una tendencia, un mapa, barras y un treemap, con filtros compartidos.'),
    bodyClass: 'is-dash',
    body: `<style>${DASH_CSS}.dash-page .pa-dash{padding-inline:0;max-width:none;background:transparent}.dash-spec{margin:40px 0 0}.dash-spec summary{cursor:pointer;font-family:var(--mono);font-size:11.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--src)}.is-embed .topbar,.is-embed .foot,.is-embed .g-head,.is-embed .dash-spec{display:none}.is-embed .pa-dfilters{top:0}.pa-dfilters{top:var(--top)}.is-embed .pa-dfilters{top:0}</style>${body}`,
    scripts: `${libScripts(p)}\n${jsonScript('pa-dash-spec', spec)}\n<script>(function(){if(/embed/.test(location.search))document.body.classList.add('is-embed');var spec=JSON.parse(document.getElementById('pa-dash-spec').textContent),el=document.getElementById('board');function go(){plotagents.renderDashboard(el,Object.assign({},spec,{theme:site.isDark()?'noche':'papel'}));}go();site.onTheme(go);})();</script>`,
  }));
}

// ── Playground ─────────────────────────────────────────────────────────────
{
  const p = '../';
  const presets = [
    { id: 'quick-start', name: t('Quick start (English)', 'Para empezar'), section: t('Start here', 'Empieza aquí'), spec: quickSpec },
    { id: 'hero', name: t('Treemap with a time slider (English)', 'Treemap con slider de tiempo'), section: t('Start here', 'Empieza aquí'), spec: heroSpec },
    { id: 'gantt-en', name: t('Gantt chart (English)', 'Carta Gantt'), section: t('Start here', 'Empieza aquí'), spec: ganttSpec },
    { id: 'geojson-en', name: t('Your own GeoJSON (English)', 'Tu propio GeoJSON'), section: t('Start here', 'Empieza aquí'), spec: languageSpec },
    { id: 'trend-en', name: t('Lines with a highlight (English)', 'Líneas con una destacada'), section: t('Start here', 'Empieza aquí'), spec: trendSpec },
    ...examples.map((e) => ({ id: e.id, name: e.name, section: secName(e.section), spec: e.spec })),
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
<section class="pg-editor" aria-label="${t('Spec editor', 'Editor del spec')}">
  <div class="pg-bar">
    <label class="sr-only" for="preset">${t('Start from an example', 'Partir de un ejemplo')}</label>
    <select id="preset"><option value="">${t('Custom spec', 'Spec propio')}</option>${groups.map((g) => `<optgroup label="${esc(g)}">${presets.filter((x) => x.section === g).map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join('')}</optgroup>`).join('')}</select>
    <button class="btn ghost small" type="button" id="format">${t('Format', 'Ordenar')}</button>
    <button class="btn ghost small" type="button" id="geo-btn">${t('Insert GeoJSON…', 'Insertar GeoJSON…')}</button>
    <input type="file" id="geo-file" accept=".json,.geojson,.topojson,application/json,application/geo+json" hidden>
  </div>
  <label class="sr-only" for="spec">${t('Spec (JSON)', 'Spec (JSON)')}</label>
  <textarea id="spec" spellcheck="false" autocapitalize="off" autocomplete="off" aria-describedby="hint"></textarea>
  <p class="pg-desc" id="hint">${t('JSON or a JavaScript object. The chart redraws as you type; <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>Enter</kbd> redraws now. Drop a <code>.geojson</code> or <code>.topojson</code> file on the editor to map your own shapes: it is kept in the page and referenced as <code>geo: "file:name.geojson"</code>.', 'JSON o un objeto de JavaScript. El gráfico se redibuja mientras escribes; <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>Enter</kbd> lo redibuja al instante. Suelta un archivo <code>.geojson</code> o <code>.topojson</code> sobre el editor para mapear tus propias formas: queda guardado en la página y se usa como <code>geo: "file:nombre.geojson"</code>.')}</p>
</section>
<section class="pg-out" aria-label="${t('Result', 'Resultado')}">
  <div class="pg-bar"><span class="grow"></span><button class="btn ghost small" type="button" id="share">${t('Copy link', 'Copiar enlace')}</button><button class="btn small" type="button" id="download">${t('Download SVG', 'Descargar SVG')}</button></div>
  <figure class="pa pg-chart" id="chart"></figure>
  <p class="pg-desc" id="desc"></p>
  <div class="pg-msgs" id="msgs" aria-live="polite"></div>
</section>
</div>`;
  write('playground/index.html', layout({
    p, path: 'playground/', active: 'playground', title: 'Playground',
    description: t('Edit a plotagents spec and see the chart, its alt text and the linter’s suggestions live.', 'Edita un spec de plotagents y mira en vivo el gráfico, su texto alternativo y las sugerencias del linter.'),
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
      `  svg: "<svg …>…</svg>",  // ${kb} kB, ${t('with', 'con')} <title> ${t('and', 'y')} <desc>`,
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
  data: /* 11 ${t('rows', 'filas')}: city, stores */,
  label: "city",
  value: "store_count",
  locale: "${LANG}",
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

  const RULES = ES ? [
    ['El título dice el hallazgo', 'Una oración completa con la cifra clave. `lint` marca los títulos que solo nombran el gráfico; `describe` escribe el texto alternativo.'],
    ['Un eje, siempre', 'Nada de doble eje: inventa correlaciones. `index: true` lleva todo a base 100 y `facet` dibuja paneles en una escala común.'],
    ['Etiquetas donde mira el ojo', 'Las líneas se rotulan en su extremo, los valores van sobre las barras y las etiquetas que chocan se separan con guías. Leyenda solo cuando hace falta.'],
    ['El color sigue a la entidad', 'Ocho colores aptos para daltonismo en un orden fijo. “Cobre” conserva su color al filtrar, al entrar en un grupo o al mover el slider.'],
    ['Honesto con la incertidumbre', 'Las estimaciones y proyecciones se rayan con `dashed`, nunca con un color nuevo, y la leyenda dice qué significa el rayado.'],
    ['SVG rápido y accesible', 'Cero dependencias, render en el servidor, un `<title>` y un `<desc>` en cada gráfico y los datos densos agrupados en trazos.'],
  ] : [
    ['The title states the finding', 'A full sentence with the key number. `lint` flags titles that only name the chart; `describe` writes the alt text.'],
    ['One axis, always', 'No dual axes: they invent correlations. `index: true` rebases to 100, `facet` draws panels on a shared scale.'],
    ['Labels where the eye is', 'Lines are labeled at their ends, values sit on the bars, colliding labels get leader lines. A legend only when it is needed.'],
    ['Color follows the entity', 'Eight colorblind-safe colors in a fixed order. “Copper” keeps its color when you filter, drill down or move the slider.'],
    ['Honest about uncertainty', 'Estimates and projections are hatched with `dashed`, never a new color, and the legend says what the hatching means.'],
    ['Fast, accessible SVG', 'Zero dependencies, server-side rendering, a `<title>` and `<desc>` in every chart, and dense data batched into paths.'],
  ];
  const VOCAB = ES ? [
    ['title', '<b>El hallazgo</b>, como una oración con la cifra.'],
    ['subtitle', 'Cómo leerlo: medida, unidad, período.'],
    ['source', 'De dónde vienen los datos. Siempre.'],
    ['data', 'Filas, tal como llegan: <code>[{ region, sales }]</code>.'],
    ['x · y · series', 'Qué rol cumple cada campo.'],
    ['highlight', 'Lo único que el lector debe ver.'],
    ['dashed', 'Lo que todavía no es una cifra firme.'],
    ['facet · time', 'Paneles pequeños; un período a la vez.'],
    ['geo', 'Chile, EE. UU., el mundo o <b>tu propio GeoJSON</b>.'],
    ['locale', '<code>"es"</code> o <code>"en"</code>, para números y fechas.'],
  ] : [
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
  tools: [toolDefinition()],        ${t('// the whole protocol, as JSON Schema', '// todo el protocolo, como JSON Schema')}
  messages: [{ role: 'user', content: '${t('Chart service times per clinic: …', 'Grafica los tiempos de atención por clínica: …')}' }],
});

const call = res.content.find((b) => b.type === 'tool_use');
const { ok, svg, description, errors } = safePlot(call.input);
${t('// Never throws. If !ok, return `errors` as the tool result:\n// each one carries a `fix`, and the model calls again.', '// Nunca lanza errores. Si !ok, devuelve `errors` como resultado:\n// cada uno trae un `fix` y el modelo vuelve a llamar.')}`,
    openai: `import OpenAI from 'openai';
import { safePlot, toolDefinition } from 'plotagents';

const client = new OpenAI();
const res = await client.chat.completions.create({
  model: process.env.OPENAI_MODEL,
  tools: [toolDefinition({ flavor: 'openai' })],
  messages: [{ role: 'user', content: '${t('Map unemployment by region: …', 'Mapea el desempleo por región: …')}' }],
});

const call = res.choices[0].message.tool_calls[0];
const result = safePlot(JSON.parse(call.function.arguments));`,
    browser: `<script src="https://unpkg.com/plotagents/dist/plotagents.js"></script>
<div id="chart"></div>
<script>
  ${t('// Tooltips, time sliders, drill-down and map zoom included.', '// Incluye tooltips, sliders de tiempo, drill-down y zoom en mapas.')}
  plotagents.render('#chart', {
    type: 'choropleth',
    geo: '/maps/comunas.topojson',     ${t('// your own geometry, by URL', '// tu propia geometría, por URL')}
    data, key: 'comuna', value: 'poverty',
    title: '${t('Poverty is highest in the coal towns', 'La pobreza es más alta en las comunas del carbón')}',
  });
</script>`,
    cli: `${t('# One spec in, one SVG out. Works in any pipeline.', '# Entra un spec, sale un SVG. Funciona en cualquier pipeline.')}
npx plotagents spec.json -o chart.svg

${t('# Teach your AI assistant to chart with plotagents:', '# Enséñale a tu asistente de IA a graficar con plotagents:')}
${SKILL_CMD}

${t('# The guide an agent needs, in its system prompt:', '# La guía que necesita un agente, para su prompt de sistema:')}
curl https://carlosnavarrete.cl/plotagents/llms.txt`,
  };
  const INTEG_TABS = [['claude', 'Claude'], ['openai', 'OpenAI'], ['browser', t('Browser', 'Navegador')], ['cli', 'CLI']];

  // La Agent Skill: un botón grande, el comando y cómo instalarla en cada asistente.
  const skillBlock = `<section class="skill" id="skill" aria-labelledby="skill-h">
  <div class="skill-copy">
    <div class="num mono"><span>${t('Agent Skill', 'Agent Skill')}</span><span>Claude · Cursor · Codex · ${t('any AI', 'cualquier IA')}</span></div>
    <h2 id="skill-h">${t('Install it once. <em>Your AI charts with plotagents</em> from then on.', 'Instálala una vez. <em>Tu IA grafica con plotagents</em> desde ahí en adelante.')}</h2>
    <p>${t('The skill tells your assistant to use plotagents for every chart, map, table and dashboard. It carries the essentials of the protocol and checks npm for a newer release before it starts, so it never falls behind.', 'La skill le dice a tu asistente que use plotagents en cada gráfico, mapa, tabla y dashboard. Trae lo esencial del protocolo y revisa en npm si hay una versión nueva antes de empezar, así nunca queda atrás.')}</p>
  </div>
  <div class="skill-act">
    <a class="btn xl" href="skill/plotagents-skill.zip" download="plotagents-skill.zip">${ICON.download}<span>${t('Install the skill', 'Instalar la skill')}<small>${t('plotagents-skill.zip · for the Claude app', 'plotagents-skill.zip · para la app de Claude')}</small></span></a>
    <span class="install"><span class="pr">$</span> ${SKILL_CMD} <button class="copy" type="button" data-copy="${SKILL_CMD}">${t('Copy', 'Copiar')}</button></span>
    <ol class="skill-how">
      <li><b>Claude Code, Cursor, Codex…</b> ${t('Run the command above in your terminal.', 'Corre el comando de arriba en tu terminal.')}</li>
      <li><b>${t('Claude app', 'App de Claude')}</b> ${t('Download the .zip and upload it in Settings → Capabilities → Skills.', 'Descarga el .zip y súbelo en Configuración → Capacidades → Skills.')}</li>
      <li><b>${t('Any other AI', 'Cualquier otra IA')}</b> ${t('Paste <a href="skill/SKILL.md">SKILL.md</a> into its instructions.', 'Pega <a href="skill/SKILL.md">SKILL.md</a> en sus instrucciones.')}</li>
    </ol>
  </div>
</section>`;

  const body = `<div class="wrap">
<section class="hero">
  <div class="h-top mono"><span>plotagents · ${t('protocol', 'protocolo')} ${esc(pkg.version)}</span><span>MIT · ${t('zero dependencies', 'cero dependencias')} · SVG</span></div>
  <h1>${t('Charts are a language. Now <em>AI speaks it.</em>', 'Los gráficos son un lenguaje. Ahora <em>la IA lo habla.</em>')}</h1>
  <div class="hero-row">
    <p class="lede">${t('plotagents is an open protocol between a model and the page. The model says what a chart <b>means</b>: the data, the finding, the unit. The library answers with a <b>finished, accessible chart</b>, or with the exact fix it needs.', 'plotagents es un protocolo abierto entre un modelo y la página. El modelo dice lo que un gráfico <b>significa</b>: los datos, el hallazgo, la unidad. La biblioteca responde con un <b>gráfico terminado y accesible</b>, o con la corrección exacta que le falta.')}</p>
    <div class="hero-act">
      <span class="install"><span class="pr">$</span> npm install plotagents <button class="copy" type="button" data-copy="npm install plotagents">${t('Copy', 'Copiar')}</button></span>
      <div class="row">
        <a class="btn" href="#skill">${ICON.download}${t('Install the AI skill', 'Instalar la skill para tu IA')}</a>
        <a class="tlink" href="docs/agents.html">${t('Read the protocol', 'Leer el protocolo')}</a>
        <a class="tlink" href="playground/">${t('Open the playground', 'Abrir el playground')}</a>
        <a class="tlink" href="examples/">${t(`${examples.length} live examples`, `${examples.length} ejemplos en vivo`)}</a>
      </div>
    </div>
  </div>

  <section class="xc" id="exchange" aria-label="${t('A model calling plotagents', 'Un modelo llamando a plotagents')}">
    <div class="xc-head">
      <span class="mono">${t('Live · a model draws by calling plotagents', 'En vivo · un modelo dibuja llamando a plotagents')}</span>
      <div class="xc-tabs" role="tablist" aria-label="${t('Examples', 'Ejemplos')}">${xcs.map((x, i) => `<button type="button" role="tab" data-i="${i}" aria-selected="${i === 0}"><span class="i">0${i + 1}</span>${esc(x.label)}</button>`).join('')}</div>
    </div>
    <div class="xc-body">
      <div class="xc-log">
        <div class="turn you"><div class="who"><i></i>${t('Person', 'Persona')}</div><p class="ask" id="xc-ask">${esc(first.ask)}</p></div>
        <div class="turn agent"><div class="who"><i></i>${t('Model → tool call', 'Modelo → llamada a la herramienta')}</div><pre id="xc-call"><code>${first.call.join('')}</code></pre></div>
        <div class="turn lib"><div class="who"><i></i>${t('plotagents → model', 'plotagents → modelo')}</div><pre id="xc-resp"><code>${first.resp.join('')}</code></pre></div>
      </div>
      <div class="xc-stage"><figure class="pa" id="xc-chart">${inlineChart(first.spec)}</figure></div>
    </div>
  </section>
</section>

${skillBlock}

<section class="sec" id="protocol">
  <div class="sec-head">
    <div class="num"><span>01 · ${t('The protocol', 'El protocolo')}</span><span>safePlot(spec) → { ok, svg, description, errors, warnings, suggestions }</span></div>
    <h2>${t('One message each way. <em>No pixels.</em>', 'Un mensaje de ida y uno de vuelta. <em>Sin píxeles.</em>')}</h2>
    <p class="sub">${t('A model is good at knowing what the data says and bad at placing tick labels. So the protocol asks only for meaning, and keeps the craft on this side of the wire.', 'Un modelo es bueno para saber qué dicen los datos y malo para ubicar las etiquetas de un eje. Por eso el protocolo le pide solo el significado y deja el oficio de este lado.')}</p>
  </div>
  <div class="steps">
    <div class="step"><span class="n">01</span><h3>${t('Say', 'Decir')}</h3><p>${t('The model describes the chart, not the drawing: rows of data, the role of each field, and a title that states the finding.', 'El modelo describe el gráfico, no el dibujo: filas de datos, el rol de cada campo y un título que dice el hallazgo.')}</p></div>
    <div class="step"><span class="n">02</span><h3>${t('Check', 'Revisar')}</h3><p>${t('<code>safePlot</code> never throws. It validates against the JSON Schema and the design rules before anything is drawn.', '<code>safePlot</code> nunca lanza errores. Valida contra el JSON Schema y las reglas de diseño antes de dibujar nada.')}</p></div>
    <div class="step"><span class="n">03</span><h3>${t('Repair', 'Corregir')}</h3><p>${t('Every issue carries a <code>fix</code> written for a model to read. It applies the fix and calls again, usually once.', 'Cada problema trae un <code>fix</code> escrito para que lo lea un modelo. Lo aplica y vuelve a llamar, casi siempre una sola vez.')}</p></div>
    <div class="step"><span class="n">04</span><h3>${t('Show', 'Mostrar')}</h3><p>${t('An SVG comes back with its alt text in <code>description</code>, so the model can read what it drew before it answers.', 'Vuelve un SVG con su texto alternativo en <code>description</code>, así el modelo puede leer lo que dibujó antes de responder.')}</p></div>
  </div>
  <div class="loop" aria-label="${t('A real repair loop', 'Un ciclo de corrección real')}">
    <div><h4><i style="background:var(--accent)"></i>${t('First call', 'Primera llamada')}</h4><pre><code>${highlight(badCall, 'js').replace('&quot;store_count&quot;', '<span class="bad">&quot;store_count&quot;</span>').replace('"store_count"', '<span class="bad">"store_count"</span>')}</code></pre><p class="note">${t('A wrong field name and an 11-slice donut: two classic mistakes.', 'Un campo mal escrito y una dona de 11 partes: dos errores clásicos.')}</p></div>
    <div><h4><i style="background:var(--t-s)"></i>${t('plotagents answers', 'plotagents responde')}</h4><pre><code>${highlight(badResp, 'js')}</code></pre></div>
    <div><h4><i style="background:var(--accent)"></i>${t('Second call → chart', 'Segunda llamada → gráfico')}</h4><figure class="pa" id="fix-chart">${inlineChart(fixedSpec)}</figure></div>
  </div>
</section>

<section class="sec" id="vocabulary">
  <div class="sec-head">
    <div class="num"><span>02 · ${t('The vocabulary', 'El vocabulario')}</span><span>${TYPES.length} ${t('chart types', 'tipos de gráfico')} · schema.json</span></div>
    <h2>${t('A small grammar for <em>every</em> chart.', 'Una gramática pequeña para <em>todos</em> los gráficos.')}</h2>
    <p class="sub">${t('Ten words carry most charts. Name a type, or leave it out and plotagents infers it from the data. seaborn names work too.', 'Diez palabras bastan para la mayoría de los gráficos. Nombra un tipo, o déjalo fuera y plotagents lo deduce de los datos. Los nombres de seaborn también sirven.')}</p>
  </div>
  <div class="vocab">
    <dl class="dict">${VOCAB.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl>
    <div>
      <p class="words">${typeWords.map((t, i) => `<span class="w"><a href="${FIRST_EX[t] ? `examples/#${FIRST_EX[t]}` : 'docs/charts.html'}">${t}</a>${i < typeWords.length - 1 ? '<span class="sep">/</span>' : ''}</span>`).join(' ')}</p>
      <p class="words-note">${t('Plus <code>barplot</code>, <code>histplot</code>, <code>violinplot</code>, <code>lmplot</code>… and plain words like <code>timeline</code>, <code>map</code> or <code>roadmap</code>. The full contract is one file: <a href="schema.json">schema.json</a>.', 'Además <code>barplot</code>, <code>histplot</code>, <code>violinplot</code>, <code>lmplot</code>… y palabras simples como <code>timeline</code>, <code>map</code> o <code>roadmap</code>. El contrato completo es un solo archivo: <a href="schema.json">schema.json</a>.')}</p>
    </div>
  </div>
</section>

<section class="sec" id="gallery">
  <div class="sec-head">
    <div class="num"><span>03 · ${t('What comes back', 'Lo que vuelve')}</span><span><a class="tlink" href="examples/">${t(`All ${examples.length} examples →`, `Los ${examples.length} ejemplos →`)}</a></span></div>
    <h2>${t('Drawn by the library, <em>not guessed</em> by the model.', 'Dibujado por la biblioteca, <em>no adivinado</em> por el modelo.')}</h2>
    <p class="sub">${t('Every chart here came from a spec of a few lines. Sorting, labeling, color, spacing and the mobile layout were decided on this side.', 'Cada gráfico salió de un spec de pocas líneas. El orden, las etiquetas, el color, los espacios y la versión móvil se decidieron de este lado.')}</p>
  </div>
  <div class="plates">
    ${PLATES.map(([id, w]) => { const e = exById[id]; return `<a class="plate ${w}" href="examples/#${e.id}"><span class="img">${pics(e, p)}</span><span class="cap"><span>${esc(e.name)}</span><code>type: "${esc(e.type)}"</code></span></a>`; }).join('\n    ')}
  </div>
</section>

<section class="sec" id="maps">
  <div class="sec-head">
    <div class="num"><span>04 · ${t('Maps', 'Mapas')}</span><span>GeoJSON · TopoJSON · URL</span></div>
    <h2>${t('Bring your <em>own</em> geometry.', 'Trae tu <em>propia</em> geometría.')}</h2>
    <p class="sub">${t('Chile, the United States and the world come built in. Anything else is one field away: comunas, school districts, sales territories, a campus, a floor plan.', 'Chile, Estados Unidos y el mundo vienen incluidos. Todo lo demás está a un campo de distancia: comunas, distritos escolares, zonas de venta, un campus, un plano.')}</p>
  </div>
  <div class="geo">
    <div>
      <ul class="ticks">
        ${t(`<li><b>Any shape in <code>geo</code>.</b> A FeatureCollection, a Feature, a list of features, a TopoJSON, or a URL in the browser.</li>
        <li><b>No key to configure.</b> The property that matches your rows (<code>NOM_COM</code>, <code>GEOID</code>, <code>ADMIN</code>) is found for you.</li>
        <li><b>Layers on top.</b> <code>markers</code> by longitude and latitude, <code>layers</code> for rivers, routes or borders.</li>
        <li><b>Your framing.</b> <code>fitTo</code> zooms to a few regions or a box; projections from Mercator to UTM metres.</li>
        <li><b>Text values work.</b> A party or a language colors by category, with a legend.</li>`, `<li><b>Cualquier forma en <code>geo</code>.</b> Un FeatureCollection, un Feature, una lista de features, un TopoJSON o una URL en el navegador.</li>
        <li><b>Sin clave que configurar.</b> La propiedad que calza con tus filas (<code>NOM_COM</code>, <code>GEOID</code>, <code>ADMIN</code>) se encuentra sola.</li>
        <li><b>Capas encima.</b> <code>markers</code> por longitud y latitud, <code>layers</code> para ríos, rutas o límites.</li>
        <li><b>Tu encuadre.</b> <code>fitTo</code> acerca a unas pocas regiones o a un recuadro; proyecciones desde Mercator hasta UTM en metros.</li>
        <li><b>Los textos también sirven.</b> Un partido o un idioma colorean por categoría, con leyenda.</li>`)}
      </ul>
      ${codeBlock(`plot({
  type: 'choropleth',
  geo: myGeoJSON,     ${t('// or TopoJSON, or a URL', '// o un TopoJSON, o una URL')}
  data, key: 'country', value: 'language',
  markers: { data: capitals, label: 'city' },
  layers: [{ geo: tropic, dash: true }],
  fitTo: ['Chile', 'Argentina'],  ${t('// optional', '// opcional')}
})`)}
    </div>
    <figure class="pa" id="geo-chart">${inlineChart(languageSpec)}</figure>
  </div>
</section>

<section class="sec" id="rules">
  <div class="sec-head">
    <div class="num"><span>05 · ${t('The craft', 'El oficio')}</span><span>${t('From Wilke’s <em>Fundamentals of Data Visualization</em> and newsroom practice', 'De <em>Fundamentals of Data Visualization</em> de Wilke y la práctica de las salas de prensa')}</span></div>
    <h2>${t('Rules the model <em>can’t</em> break.', 'Reglas que el modelo <em>no puede</em> romper.')}</h2>
    <p class="sub">${t('Agents reach for dual axes, twelve-slice pies and titles that say nothing. Here, the good decision is the only one available.', 'Los agentes tienden al doble eje, a las tortas de doce partes y a los títulos que no dicen nada. Aquí la buena decisión es la única disponible.')}</p>
  </div>
  <div class="rules">
    ${RULES.map(([h, t], i) => `<div class="rule"><div class="n">${String(i + 1).padStart(2, '0')}</div><h3>${esc(h)}</h3><p>${T(t)}</p></div>`).join('\n    ')}
  </div>
</section>

<section class="sec" id="integrate">
  <div class="sec-head">
    <div class="num"><span>06 · ${t('Integrate', 'Integrar')}</span><span>Anthropic · OpenAI · ${t('any runtime', 'cualquier entorno')}</span></div>
    <h2>${t('Hand it to <em>any</em> model.', 'Pásaselo a <em>cualquier</em> modelo.')}</h2>
    <p class="sub">${t('The protocol ships as a JSON Schema and a ready-made tool definition, plus a one-page guide for the system prompt and an Agent Skill.', 'El protocolo viene como un JSON Schema y una definición de herramienta lista, más una guía de una página para el prompt de sistema y una Agent Skill.')}</p>
  </div>
  <div class="integ">
    <ul class="ticks">
      ${t(`<li><b><a href="#skill">The Agent Skill</a></b> makes Claude, Cursor or Codex reach for plotagents on their own.</li>
      <li><b><code>toolDefinition()</code></b> turns the schema into a tool for Claude or OpenAI.</li>
      <li><b><code>safePlot(spec)</code></b> returns the SVG or the errors, each with a <code>fix</code>.</li>
      <li><b><code>describe(spec)</code></b> writes alt text the model can check.</li>
      <li><b><a href="docs/agents.html">The guide for agents</a></b>, also as <a href="AGENTS.md">AGENTS.md</a> and <a href="llms.txt">llms.txt</a>.</li>
      <li><b><code>render()</code></b> in the browser adds tooltips, drill-down, map zoom, and time controls when the spec asks for them.</li>`, `<li><b><a href="#skill">La Agent Skill</a></b> hace que Claude, Cursor o Codex usen plotagents por su cuenta.</li>
      <li><b><code>toolDefinition()</code></b> convierte el schema en una herramienta para Claude u OpenAI.</li>
      <li><b><code>safePlot(spec)</code></b> devuelve el SVG o los errores, cada uno con su <code>fix</code>.</li>
      <li><b><code>describe(spec)</code></b> escribe un texto alternativo que el modelo puede revisar.</li>
      <li><b><a href="docs/agents.html">La guía para agentes</a></b>, también como <a href="AGENTS.md">AGENTS.md</a> y <a href="llms.txt">llms.txt</a> (en inglés).</li>
      <li><b><code>render()</code></b> en el navegador agrega tooltips, drill-down, zoom en mapas y controles de tiempo cuando el spec los pide.</li>`)}
    </ul>
    <div>
      <div class="tabs" role="tablist" aria-label="${t('Integration', 'Integración')}">${INTEG_TABS.map(([k, l], i) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${i === 0}">${l}</button>`).join('')}</div>
      ${INTEG_TABS.map(([k], i) => `<div data-panel="${k}"${i ? ' hidden' : ''}>${codeBlock(integ[k], k === 'cli' ? 'sh' : k === 'browser' ? 'html' : 'js')}</div>`).join('\n      ')}
    </div>
  </div>
</section>

<section class="sec" id="dashboards">
  <div class="sec-head">
    <div class="num"><span>07 · Dashboards</span><span><a class="tlink" href="dashboard/">${t('Open the live dashboard →', 'Abrir el dashboard en vivo →')}</a></span></div>
    <h2>${t('Ask for a dashboard. <em>Get a good one.</em>', 'Pide un dashboard. <em>Recibe uno bueno.</em>')}</h2>
    <p class="sub">${t('The same idea, one level up: the model lists KPIs, charts and filters; <code>dashboard()</code> lays them out the way an analyst would, and filters work across every panel.', 'La misma idea, un nivel más arriba: el modelo enumera KPI, gráficos y filtros; <code>dashboard()</code> los ordena como lo haría un analista y los filtros actúan sobre todos los paneles.')}</p>
  </div>
  <div class="geo">
    <div>
      <ul class="ticks">
        ${t(`<li><b>Numbers first.</b> Up to five KPIs, computed from the data, with year-over-year change and a sparkline.</li>
        <li><b>Z-pattern.</b> The trend goes full width; the rest fills balanced rows of a 12-column grid.</li>
        <li><b>One color per entity</b> across every chart, one theme, one source line.</li>
        <li><b>Filters as buttons</b> that move every chart and KPI at once.</li>
        <li><b>One HTML file.</b> Works offline, prints, and turns into a PDF.</li>`, `<li><b>Primero las cifras.</b> Hasta cinco KPI, calculados desde los datos, con la variación anual y una sparkline.</li>
        <li><b>Lectura en Z.</b> La tendencia va a todo el ancho; el resto llena filas equilibradas de una grilla de 12 columnas.</li>
        <li><b>Un color por entidad</b> en todos los gráficos, un tema, una línea de fuente.</li>
        <li><b>Filtros como botones</b> que mueven todos los gráficos y KPI a la vez.</li>
        <li><b>Un solo archivo HTML.</b> Funciona sin conexión, se imprime y se convierte en PDF.</li>`)}
      </ul>
      ${codeBlock(`dashboard({
  title: '${t('How are southern sales doing?', '¿Cómo van las ventas del sur?')}',
  data: sales,
  kpis: [{ label: '${t('Sales 2025', 'Ventas 2025')}', field: 'sales', agg: 'sum',
           compare: { field: 'year', current: 2025, previous: 2024 } }],
  charts: [trend, map, byChannel, treemap],
  filters: ['region', 'channel'],
})`)}
    </div>
    <div class="dash-frame"><iframe src="dashboard/?embed" title="${t('Live dashboard built with plotagents', 'Dashboard en vivo hecho con plotagents')}" loading="lazy"></iframe></div>
  </div>
</section>

<section class="close">
  <h2>${t('Let your agent <em>show</em>, not just tell.', 'Que tu agente <em>muestre</em>, no solo cuente.')}</h2>
  <div class="row">
    <a class="btn" href="#skill">${ICON.download}${t('Install the AI skill', 'Instalar la skill para tu IA')}</a>
    <span class="install"><span class="pr">$</span> npm install plotagents <button class="copy" type="button" data-copy="npm install plotagents">${t('Copy', 'Copiar')}</button></span>
    <a class="tlink" href="docs/getting-started.html">${t('Get started', 'Primeros pasos')} →</a>
    <a class="tlink" href="${REPO}" rel="noopener">${t('Star on GitHub', 'Dale una estrella en GitHub')}</a>
  </div>
</section>
</div>`;
  const home = { xcs: xcs.map(({ id, call, resp, ask, spec }) => ({ id, call, resp, ask, spec })), fixed: fixedSpec, geo: languageSpec };
  write('index.html', layout({
    p, path: '', active: '', title: '',
    description: t('An open protocol for AI agents to speak in charts: the model sends one JSON spec, plotagents returns a finished, accessible SVG or the exact fix it needs.', 'Un protocolo abierto para que los agentes de IA hablen en gráficos: el modelo envía un spec JSON y plotagents devuelve un SVG terminado y accesible, o la corrección exacta que le falta.'),
    body,
    scripts: `${libScripts(p, false)}\n${jsonScript('pa-home', home)}\n<script src="${p}assets/home.js"></script>`,
  }));
}

// ── 404 (solo en la raíz: GitHub Pages usa un único 404.html) ───────────────
if (!ES) write('404.html', layout({
  p: BASE, title: 'Page not found', description: 'Page not found.',
  body: `<div class="wrap" style="padding-block:96px;min-height:50vh"><p class="kicker">404</p><h1 style="font-size:40px;letter-spacing:-.02em;margin:0 0 12px">This page is not here</h1><p style="color:var(--lede);font-size:18px">Try the <a href="${BASE}docs/">documentation</a>, the <a href="${BASE}examples/">examples</a> or the <a href="${BASE}">home page</a>.</p></div>`,
}));

const n = examples.length;
console.log(`Sitio (${LANG}): ${DOCS.length} páginas de documentación, ${n} ejemplos → ${posix.relative(root.replace(/\\/g, '/'), OUT.replace(/\\/g, '/')) || OUT}/`);
if (!existsSync(join(OUT, 'index.html'))) process.exit(1);
