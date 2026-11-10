import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Un tipo se registra con un import sin nombres (`import './types/bar.js'`).
// Un empaquetador (webpack, esbuild, Rollup) borra esos imports si
// package.json dice que el módulo no tiene efectos, y el tipo deja de existir:
// "El tipo X no está cargado en esta entrada". Cada import así tiene que caer
// en un patrón de `sideEffects`.
const root = path.resolve(import.meta.dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const globToRe = (g) => new RegExp('^' + g.replace(/^\.\//, '').replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*') + '$');

test('every side-effect-only import is declared in package.json sideEffects', () => {
  assert.ok(Array.isArray(pkg.sideEffects), 'sideEffects must list the files that register types');
  const res = pkg.sideEffects.map(globToRe);
  const files = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (p.endsWith('.js')) files.push(p); } };
  walk(path.join(root, 'src'));
  const missing = [];
  for (const f of files) {
    for (const m of fs.readFileSync(f, 'utf8').matchAll(/^import ['"](\.[^'"]+)['"];?$/gm)) {
      const target = path.relative(root, path.resolve(path.dirname(f), m[1])).split(path.sep).join('/');
      if (!res.some((r) => r.test(target))) missing.push(`${path.relative(root, f)} → ${target}`);
      // y el que importa también, o el empaquetador lo poda antes de llegar
      const self = path.relative(root, f).split(path.sep).join('/');
      if (!res.some((r) => r.test(self))) missing.push(`${self} (imports for side effects)`);
    }
  }
  assert.deepEqual([...new Set(missing)], []);
});
