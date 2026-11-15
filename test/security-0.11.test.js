import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plot, safePlot, dashboard, toHTML, configure } from '../src/index.js';
import { truncate } from '../src/text.js';
import { embedTiles } from '../src/charts/pointmap.js';

const rows = [{ region: 'Biobío', sales: 1240 }, { region: 'Ñuble', sales: 830 }];
const X = '"><img src=x onerror=alert(1)></style><script>alert(2)</script>';
// El código de la biblioteca embebido en la página trae sus propias etiquetas: solo se mira el resto.
const sinBundle = (html) => html.replace(/<script>[\s\S]*?<\/script>/g, '');

test('security 0.11: truncate is linear (a 200 000-letter label must not hang)', () => {
  const t0 = Date.now();
  const big = 'ab '.repeat(70000);
  assert.ok(plot({ type: 'bar', data: [{ region: big, sales: 1 }, { region: 'x', sales: 2 }], x: 'region', y: 'sales', title: big, source: big }).length > 0);
  assert.ok(Date.now() - t0 < 3000, `${Date.now() - t0} ms`);
  // Mismo resultado que antes en textos normales.
  assert.equal(truncate('Programa de mejoramiento', 60, 12), 'Program…');
  assert.equal(truncate('corto', 200, 12), 'corto');
  assert.ok(truncate('x'.repeat(50), 1, 12).endsWith('…'));
});

test('security 0.11: absurd hierarchy depth is refused instead of exhausting memory', () => {
  const path = Array.from({ length: 5000 }, (_, i) => 'l' + i);
  const data = [{ ...Object.fromEntries(path.map((p) => [p, 'x'])), v: 1 }];
  for (const type of ['treemap', 'sunburst']) {
    const r = safePlot({ type, data, path, value: 'v' });
    assert.equal(r.ok, false);
    assert.match(r.errors[0].message, /niveles/);
  }
});

test('security 0.11: prototype names are not palettes, ramps, filters or types', () => {
  for (const k of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
    assert.ok(plot({ type: 'bar', data: rows, x: 'region', y: 'sales', palette: k }).startsWith('<svg'));
    assert.ok(plot({ type: 'bar', data: rows, x: 'region', y: 'sales', theme: { categorical: k, sequential: k, diverging: k } }).startsWith('<svg'));
    assert.equal(safePlot({ type: k, data: rows }).ok, false);
  }
  const d = dashboard({ data: [{ a: 'x', v: 1 }, { a: 'y', v: 2 }], charts: [{ type: 'bar', x: 'a', y: 'v' }], filters: ['constructor', 'toString'] });
  assert.ok(!d.includes('data-f="0"'));
});

test('security 0.11: configure ignores __proto__', () => {
  configure(JSON.parse('{"__proto__":{"polluted":1},"locale":"en"}'));
  assert.equal({}.polluted, undefined);
  assert.equal(Object.getPrototypeOf(configure()), Object.prototype);
  configure(null);
});

test('security 0.11: hostile strings stay inert in pages and dashboards', () => {
  const html = toHTML({ type: 'bar', data: [{ region: X, sales: 1 }, { region: 'b', sales: 2 }], x: 'region', y: 'sales', title: X, subtitle: X, source: X, font: X, theme: { font: { family: X, import: 'https://fonts.googleapis.com/' + X }, surface: X } }, { title: X, lang: X });
  assert.ok(!/<img src=x|<script>alert/.test(sinBundle(html)));
  assert.ok(!/<link[^>]*evil/.test(html));
  const dash = dashboard({ title: X, subtitle: X, source: X, font: X, theme: { surface: X, ink: X, font: { family: X } }, data: [{ r: X, v: 1, y: 1 }, { r: 'b', v: 2, y: 2 }], kpis: [{ label: X, field: 'v', period: X }, { label: X, value: 1, delta: 0.2, period: X }], charts: [{ type: 'bar', x: 'r', y: 'v', title: X }], filters: [{ field: 'r', label: X, all: X }] });
  assert.ok(!/<img src=x|<script>alert/.test(sinBundle(dash)));
  // Los datos incrustados no cierran su <script> ni abren un comentario.
  const j = toHTML({ type: 'bar', data: [{ region: '</script><!-- ', sales: 1 }, { region: 'b', sales: 2 }], x: 'region', y: 'sales' }).match(/id="pa-data">([\s\S]*?)<\/script>/);
  if (j) assert.ok(!j[1].includes('<'));
});

test('security 0.11: embedTiles refuses internal hosts (trailing dot, single label, reserved ranges)', async () => {
  const asked = [];
  const fake = async (u) => { asked.push(u); return { ok: false }; };
  const urls = ['https://localhost./a.png', 'https://metadata/a.png', 'https://foo.internal./a.png', 'https://0.1.2.3/a.png', 'https://[::1]/a.png', 'https://2130706433/a.png', 'https://tiles.example.com/a.png'];
  await embedTiles(`<svg>${urls.map((u) => `<image class="pa-tile" href="${u}"/>`).join('')}</svg>`, { fetch: fake });
  assert.deepEqual(asked, ['https://tiles.example.com/a.png']);
});

test('security 0.11: category cross products are capped (3 000 rows must not ask for 9 million cells)', () => {
  const d = Array.from({ length: 3000 }, (_, i) => ({ a: 'a' + i, b: 'b' + i, v: i % 7 }));
  const t0 = Date.now();
  for (const spec of [{ type: 'heatmap', x: 'a', y: 'b', value: 'v' }, { type: 'heatmap' }, { type: 'radar', axis: 'a', series: 'b', value: 'v' }, { type: 'bar', x: 'a', series: 'b', y: 'v' }]) {
    const r = safePlot({ data: d, ...spec });
    assert.equal(r.ok, false, spec.type);
    assert.match(r.errors[0].message, /celdas/);
  }
  assert.ok(Date.now() - t0 < 3000);
  // Un mapa de calor normal sigue pasando.
  const ok = Array.from({ length: 600 }, (_, i) => ({ d: 'd' + (i % 30), h: 'h' + (i % 20), v: i }));
  assert.ok(safePlot({ type: 'heatmap', data: ok, x: 'd', y: 'h', value: 'v' }).ok);
});
