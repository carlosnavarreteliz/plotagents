// Empaqueta src/ para el navegador, sin dependencias:
//   dist/plotagents.js      → <script> que define window.plotagents (sin mapas)
//   dist/plotagents-geo.js  → registra Chile, EE. UU. y el mundo en window.plotagents
// Cada módulo queda en su propio ámbito; los import/export se reescriben.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const GEO = ['src/geo/chile.js', 'src/geo/world.js', 'src/geo/usa.js'];

// Cada módulo se minifica por separado con terser (solo al compilar: es una
// devDependency; el paquete publicado sigue sin dependencias). Así cada uno
// conserva su marca //#pa-mod y las páginas pueden armarse con solo los suyos.
// `node scripts/bundle.js --no-minify` deja el código legible para depurar.
const MINIFY = !process.argv.includes('--no-minify');
async function minifyAll(mods) {
  if (!MINIFY) return;
  const { minify } = await import('terser');
  for (const [file, m] of mods) {
    const out = await minify(m.code, { compress: { passes: 2 }, mangle: true, format: { comments: false }, ecma: 2020 });
    m.code = out.code;
  }
}

function build(entries, { exclude = new Set(), external = {} } = {}) {
  const mods = new Map();
  const deps = new Map(); // id → ids que pide con __req (para armar páginas con solo lo que usan)
  function load(file) {
    if (mods.has(file)) return;
    mods.set(file, null);
    let code = readFileSync(file, 'utf8');
    const id = relative(root, file);
    const exportsList = [];
    const need = new Set();
    deps.set(file, need);
    code = code.replace(/^import\s+['"]([^'"]+)['"];?/gm, (_, from) => {
      const dep = relative(root, resolve(dirname(file), from));
      if (exclude.has(dep)) return '';
      load(resolve(dirname(file), from));
      return `__req(${JSON.stringify(dep)});`;
    });
    // Reexportaciones (entradas livianas: src/core.js, src/types/*.js, src/maps.js).
    let star = 0, reN = 0;
    code = code.replace(/^export\s*\*\s*from\s*['"]([^'"]+)['"];?/gm, (_, from) => {
      const dep = relative(root, resolve(dirname(file), from));
      load(resolve(dirname(file), from));
      star++;
      return `__star.push(__req(${JSON.stringify(dep)}));`;
    });
    code = code.replace(/^export\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"];?/gm, (_, names, from) => {
      const dep = relative(root, resolve(dirname(file), from));
      load(resolve(dirname(file), from));
      const v = `__re${reN++}`;
      for (const part of names.split(',').map((x) => x.trim()).filter(Boolean)) {
        const [local, as] = part.split(/\s+as\s+/);
        exportsList.push([as || local, `${v}[${JSON.stringify(local)}]`]);
      }
      return `const ${v} = __req(${JSON.stringify(dep)});`;
    });
    code = code.replace(/^import\s+(\w+)\s*,\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"];?/gm, (_, def, names, from) => `import { default as ${def}, ${names} } from '${from}';`);
    code = code.replace(/^import\s+(\w+)\s+from\s*['"]([^'"]+)['"];?/gm, (_, def, from) => `import { default as ${def} } from '${from}';`);
    code = code.replace(/^import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"];?/gm, (_, names, from) => {
      const dep = relative(root, resolve(dirname(file), from));
      const binds = names.split(',').map((n) => n.trim()).filter(Boolean).map((n) => n.replace(/\s+as\s+/, ': ')).join(', ');
      if (external[dep]) return `const { ${binds} } = ${external[dep]};`;
      load(resolve(dirname(file), from));
      return `const { ${binds} } = __req(${JSON.stringify(dep)});`;
    });
    code = code.replace(/^export\s+(async\s+)?function\s+(\w+)/gm, (_, a, n) => { exportsList.push([n, n]); return `${a || ''}function ${n}`; });
    code = code.replace(/^export\s+(const|let|class)\s+(\w+)/gm, (_, k, n) => { exportsList.push([n, n]); return `${k} ${n}`; });
    code = code.replace(/^export\s+default\s+(\w+);?\s*$/gm, (_, n) => { exportsList.push(['default', n]); return ''; });
    code = code.replace(/^export\s+default\s+/gm, () => { exportsList.push(['default', '__default']); return 'const __default = '; });
    code = code.replace(/^export\s*\{([^}]*)\};?/gm, (_, names) => {
      for (const part of names.split(',').map((x) => x.trim()).filter(Boolean)) {
        const [local, as] = part.split(/\s+as\s+/);
        exportsList.push([as || local, local]);
      }
      return '';
    });
    code = code.replace(/import\.meta\.url/g, '"about:blank"');
    // Quita comentarios de línea completa (más liviano, mismo código).
    for (const m of code.matchAll(/__req\("([^"]+)"\)/g)) need.add(m[1]);
    const ret = exportsList.map(([k, v]) => `${JSON.stringify(k)}: ${v}`).join(', ');
    const body = star ? `var __star = [];\n${code}\nreturn Object.assign({}, ...__star, { ${ret} });` : `${code}\nreturn { ${ret} };`;
    // Marca por módulo (id y dependencias): toHTML y dashboard arman con ella una
    // página que lleva solo los módulos de sus tipos de gráfico (src/page-bundle.js).
    mods.set(file, { id, need: [...need], code: `__def(${JSON.stringify(id)}, function () {\n${body}\n});` });
  }
  for (const e of entries) load(join(root, e));
  return mods;
}

const wrap = (mods, tail, meta = '') => `/*! plotagents ${pkg.version} · MIT · https://github.com/carlosnavarreteliz/plotagents */
(function (global) {
'use strict';
var __defs = {}, __cache = {};
function __def(id, fn) { __defs[id] = fn; }
function __req(id) { if (!__cache[id]) { __cache[id] = { loading: true }; __cache[id] = __defs[id](); } return __cache[id]; }
${meta}${[...mods.values()].map((m) => `//#pa-mod ${m.id} ${m.need.join(',')}\n${m.code}`).join('\n')}
//#pa-tail
${tail}
})(typeof window !== 'undefined' ? window : globalThis);
`;

// Qué módulo registra cada tipo de gráfico y cada geometría con nombre (para las páginas).
const TYPE_ENTRIES = [...readdirSync(join(root, 'src/types')).filter((f) => f.endsWith('.js')).map((f) => 'src/types/' + f), 'src/maps.js', 'src/table-entry.js'];
const typeMap = {};
for (const f of TYPE_ENTRIES) for (const m of readFileSync(join(root, f), 'utf8').matchAll(/registerRenderer\('([\w-]+)'/g)) typeMap[m[1]] = f;
const geoMap = {};
for (const f of GEO) {
  const line = readFileSync(join(root, f), 'utf8').match(/registerGeo\(([^\n]*)\);/)[1];
  for (const m of line.matchAll(/'([^']+)'/g)) geoMap[m[1].toLowerCase()] = f;
}

mkdirSync(join(root, 'dist'), { recursive: true });
const core = build(['src/index.js', 'src/page.js', 'src/page-dashboard.js', ...TYPE_ENTRIES], { exclude: new Set(GEO) });
await minifyAll(core);
const coreOut = wrap(core, `global.plotagents = __req("src/index.js");`, `//#pa-types ${JSON.stringify(typeMap)}\n`);
writeFileSync(join(root, 'dist/plotagents.js'), coreOut);

const geo = build(GEO, { external: { 'src/geo/registry.js': 'global.plotagents' } });
await minifyAll(geo);
const geoOut = wrap(geo, GEO.map((g) => `__req(${JSON.stringify(g)});`).join('\n'), `//#pa-geo ${JSON.stringify(geoMap)}\n`);
writeFileSync(join(root, 'dist/plotagents-geo.js'), geoOut);

console.log(`dist/plotagents.js · ${core.size} módulos · ${(coreOut.length / 1024).toFixed(0)} kB`);
console.log(`dist/plotagents-geo.js · ${geo.size} módulos · ${(geoOut.length / 1024).toFixed(0)} kB`);
