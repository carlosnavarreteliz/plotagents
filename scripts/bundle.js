// Empaqueta src/ en un solo archivo para el navegador (sin dependencias):
//   dist/plotagents.js     → <script> que define window.plotagents
// Cada módulo queda en su propio ámbito; los import/export se reescriben.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const entry = join(root, 'src/index.js');
const mods = new Map();

function load(file) {
  if (mods.has(file)) return;
  mods.set(file, null);
  let code = readFileSync(file, 'utf8');
  const id = relative(root, file);
  const exportsList = [];
  code = code.replace(/^import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"];?/gm, (_, names, from) => {
    const dep = resolve(dirname(file), from);
    load(dep);
    const binds = names.split(',').map((n) => n.trim()).filter(Boolean).map((n) => n.replace(/\s+as\s+/, ': ')).join(', ');
    return `const { ${binds} } = __req(${JSON.stringify(relative(root, dep))});`;
  });
  code = code.replace(/^export\s+(async\s+)?function\s+(\w+)/gm, (_, a, n) => { exportsList.push([n, n]); return `${a || ''}function ${n}`; });
  code = code.replace(/^export\s+(const|let|class)\s+(\w+)/gm, (_, k, n) => { exportsList.push([n, n]); return `${k} ${n}`; });
  code = code.replace(/^export\s+default\s+(\w+);?/gm, (_, n) => { exportsList.push(['default', n]); return ''; });
  code = code.replace(/^export\s*\{([^}]*)\};?/gm, (_, names) => {
    for (const part of names.split(',').map((x) => x.trim()).filter(Boolean)) {
      const [local, as] = part.split(/\s+as\s+/);
      exportsList.push([as || local, local]);
    }
    return '';
  });
  code = code.replace(/import\.meta\.url/g, '"about:blank"');
  // Quita comentarios de línea completa (más liviano, mismo código).
  code = code.split('\n').filter((l) => !/^\s*\/\/(?!\s*#)/.test(l)).join('\n');
  const ret = exportsList.map(([k, v]) => `${JSON.stringify(k)}: ${v}`).join(', ');
  mods.set(file, `__def(${JSON.stringify(id)}, function () {\n${code}\nreturn { ${ret} };\n});`);
}

load(entry);
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const out = `/*! plotagents ${pkg.version} · MIT · https://github.com/carlosnavarreteliz/plotagents */
(function (global) {
'use strict';
var __defs = {}, __cache = {};
function __def(id, fn) { __defs[id] = fn; }
function __req(id) { if (!__cache[id]) { __cache[id] = { loading: true }; __cache[id] = __defs[id](); } return __cache[id]; }
${[...mods.values()].join('\n')}
global.plotagents = __req(${JSON.stringify(relative(root, entry))});
})(typeof window !== 'undefined' ? window : globalThis);
`;
mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist/plotagents.js'), out);
console.log(`dist/plotagents.js · ${mods.size} módulos · ${(out.length / 1024).toFixed(0)} kB`);
