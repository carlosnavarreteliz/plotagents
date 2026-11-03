// Seguridad (sin inyección de marcado desde el spec) y tamaño por defecto 500 × 500.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plot, toHTML, getTheme, configure } from '../src/index.js';
import { safeColor, safeUrl, safeFontFamily } from '../src/theme.js';

const EVIL = '#fff"><img src=x onerror=alert(1)>';
const rows = [{ k: 'a', s: 'x', v: 1 }, { k: 'a', s: 'y', v: 2 }, { k: 'b', s: 'x', v: 3 }, { k: 'b', s: 'y', v: 1 }];
const clean = (svg, what) => assert.doesNotMatch(svg, /<img|onerror|<script|javascript:/i, what);

test('colores del spec no pueden inyectar marcado', () => {
  clean(plot({ type: 'bar', data: rows, x: 'k', y: 'v', series: 's', palette: [EVIL, EVIL] }), 'palette → leyenda');
  clean(plot({ type: 'bar', data: rows, x: 'k', y: 'v', series: 's', colors: { x: EVIL } }), 'colors');
  clean(plot({ type: 'line', data: rows, x: 'v', y: 'v', series: 's', theme: { categorical: [EVIL], surface: EVIL, ink: EVIL } }), 'tema');
  clean(plot({ type: 'choropleth', geo: 'chile', data: [{ r: 'Biobío', v: 1 }], key: 'r', value: 'v', theme: { tint: EVIL, muted: EVIL } }), 'patrón sin dato');
  clean(plot({ type: 'flowchart', nodes: [{ id: 'a' }, { id: 'b' }], edges: [{ from: 'a', to: 'b' }], theme: { muted: EVIL } }), 'flecha');
  clean(plot({ type: 'heatmap', data: [{ a: 'x', b: 'y', v: 1 }], x: 'a', y: 'b', value: 'v', ramp: [EVIL, EVIL] }), 'rampa');
});

test('fuentes y URLs del spec no pueden cerrar <style> ni atributos', () => {
  const font = { family: 'x"><img src=x onerror=alert(1)>', import: "https://x');}</style><img src=x onerror=alert(1)>" };
  clean(plot({ type: 'bar', data: rows, x: 'k', y: 'v', font, fontImport: true }), 'svg');
  clean(toHTML([{ type: 'bar', data: rows, x: 'k', y: 'v', font }]).replace(/<script[^>]*>[\s\S]*?<\/script>/g, ''), 'html');
  clean(plot({ type: 'bar', data: rows, x: 'k', y: 'v', fontFamily: 'a"><img src=x onerror=alert(1)>' }), 'fontFamily');
  assert.equal(safeUrl('javascript:alert(1)'), undefined);
  assert.equal(safeUrl("https://ok.com/a.css');x"), undefined);
  assert.equal(safeUrl('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap').startsWith('https://'), true);
  assert.equal(safeFontFamily("'Poppins', sans-serif"), "'Poppins', sans-serif");
});

test('toHTML no rompe la familia tipográfica con entidades HTML dentro del CSS', () => {
  const html = toHTML([{ type: 'bar', data: rows, x: 'k', y: 'v' }]);
  assert.doesNotMatch(html.match(/body\{[^}]*\}/)[0], /&#39;|&quot;/);
});

test('safeColor acepta colores CSS y rechaza todo lo demás', () => {
  for (const c of ['#3A47B8', '#abc', 'red', 'transparent', 'rgb(1, 2, 3)', 'hsl(200 50% 40% / .5)', 'oklch(0.6 0.1 250)']) assert.equal(safeColor(c), c);
  for (const c of [EVIL, 'url(https://x/y.svg#a)', 'var(--x)', 'red;x', 'rgb(1,2,3))', '"red"', 42, null]) assert.equal(safeColor(c), undefined, String(c));
});

test('categorías "toString" o "constructor" no heredan colores de Object.prototype', () => {
  const svg = plot({ type: 'bar', data: [{ k: 'a', s: 'toString', v: 1 }, { k: 'a', s: 'constructor', v: 2 }], x: 'k', y: 'v', series: 's' });
  assert.doesNotMatch(svg, /native code|function /);
});

test('el tema y configure() ignoran __proto__', () => {
  const t = getTheme(JSON.parse('{"__proto__": {"polluted": true}, "extends": "constructor"}'));
  assert.equal(t.polluted, undefined);
  assert.equal(t.surface, getTheme('papel').surface);
  configure(JSON.parse('{"__proto__": {"polluted": true}}'));
  assert.equal({}.polluted, undefined);
  configure(null);
});

test('tamaño por defecto 500 × 500, SVG que se adapta al envoltorio', () => {
  for (const spec of [
    { type: 'bar', data: rows, x: 'k', y: 'v' },
    { type: 'line', data: [{ m: '2024-01', v: 1 }, { m: '2024-02', v: 2 }, { m: '2024-03', v: 3 }], x: 'm', y: 'v' },
    { type: 'scatter', data: rows, x: 'v', y: 'v' },
    { type: 'donut', data: [{ k: 'a', v: 3 }, { k: 'b', v: 2 }, { k: 'c', v: 1 }], label: 'k', value: 'v' },
    { type: 'bar', horizontal: true, data: rows, x: 'k', y: 'v' },
    { type: 'treemap', data: [{ a: 'x', v: 3 }, { a: 'y', v: 2 }], path: ['a'], value: 'v' },
  ]) {
    const svg = plot(spec);
    assert.match(svg, /viewBox="0 0 500 500"/, spec.type);
    assert.match(svg, /style="[^"]*width:100%;height:auto;max-width:100%;max-height:100%/, spec.type);
  }
  // Con muchas filas, crece lo necesario; nunca se achica bajo 500.
  const many = Array.from({ length: 30 }, (_, i) => ({ k: 'Categoría ' + i, v: i + 1 }));
  const h = +/viewBox="0 0 500 ([\d.]+)"/.exec(plot({ type: 'bar', horizontal: true, data: many, x: 'k', y: 'v' }))[1];
  assert.ok(h > 500, String(h));
  // width/height explícitos mandan, con un tope para no pedir lienzos descomunales.
  assert.match(plot({ type: 'bar', data: rows, x: 'k', y: 'v', width: 800, height: 300 }), /viewBox="0 0 800 300"/);
  assert.match(plot({ type: 'bar', data: rows, x: 'k', y: 'v', width: 1e9, height: 1e9 }), /viewBox="0 0 8000 8000"/);
});

test('facet: los paneles no se salen de su columna', () => {
  const data = ['A', 'B', 'C'].flatMap((r) => [1, 2, 3, 4].map((t) => ({ r, t, v: t })));
  const svg = plot({ type: 'line', data, x: 't', y: 'v', facet: 'r', columns: 3 });
  const panels = [...svg.matchAll(/<svg x="([\d.]+)" y="[\d.]+" [^>]*?width="([\d.]+)"/g)].map((m) => [+m[1], +m[2]]);
  assert.equal(panels.length, 3);
  for (let i = 1; i < panels.length; i++) if (panels[i][0] > panels[i - 1][0]) assert.ok(panels[i - 1][0] + panels[i - 1][1] <= panels[i][0] + 0.5, JSON.stringify(panels));
});
