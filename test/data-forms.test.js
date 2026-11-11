import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plot, safePlot, lint, toRows, packTable, dashboard, planDashboard, toHTML } from '../src/index.js';
import { unpackPlan } from '../src/dashboard.js';
import { packPlan } from '../src/dashboard-node.js';

const rows = [{ region: 'Biobío', sales: 1240 }, { region: 'Ñuble', sales: 830 }, { region: 'Maule', sales: 610 }];

test('data: columns, header + rows, { columns, rows } and CSV draw the same chart as rows', () => {
  const ref = plot({ type: 'bar', data: rows, x: 'region', y: 'sales' });
  const forms = [
    { region: ['Biobío', 'Ñuble', 'Maule'], sales: [1240, 830, 610] },
    [['region', 'sales'], ['Biobío', 1240], ['Ñuble', 830], ['Maule', 610]],
    { columns: ['region', 'sales'], rows: [['Biobío', 1240], ['Ñuble', 830], ['Maule', 610]] },
    'region,sales\nBiobío,1240\nÑuble,830\nMaule,610\n',
    'region\tsales\r\nBiobío\t1240\r\nÑuble\t830\r\nMaule\t610',
  ];
  for (const data of forms) {
    assert.equal(plot({ type: 'bar', data, x: 'region', y: 'sales' }), ref);
    const r = safePlot({ type: 'bar', data, x: 'region', y: 'sales' });
    assert.ok(r.ok, JSON.stringify(r.errors));
    assert.deepEqual(lint({ type: 'bar', data, x: 'region', y: 'sales' }).errors, []);
  }
});

test('data: CSV quotes, ";" delimiter, empty cells and type inference', () => {
  const t = toRows('name;value;note\n"Biobío; sur";"1.240,5";\nÑuble;007;"dice ""hola"""\n');
  assert.deepEqual(t, [{ name: 'Biobío; sur', value: '1.240,5', note: null }, { name: 'Ñuble', value: '007', note: 'dice "hola"' }]);
  assert.deepEqual(toRows('a,b\n1,-2.5e3'), [{ a: 1, b: -2500 }]);
  assert.equal(toRows('just text'), 'just text');
});

test('data: rows and { label: value } maps pass through unchanged', () => {
  assert.equal(toRows(rows), rows);
  const map = { Biobío: 10, Ñuble: 5 };
  assert.equal(toRows(map), map);
  assert.ok(plot({ type: 'bar', data: map }).includes('Biobío'));
});

test('packTable: field names once, only when every row has the same fields', () => {
  const p = packTable(rows);
  assert.deepEqual(p[0], ['region', 'sales']);
  assert.deepEqual(toRows(p), rows);
  const ragged = [{ a: 1 }, { a: 2, b: 3 }];
  assert.equal(packTable(ragged), ragged);
  assert.equal(packTable([{ a: 1 }, { a: undefined }]).length, 2);
});

test('dashboard: shared data is embedded once and restored', () => {
  const data = [];
  for (const r of ['A', 'B', 'C']) for (let m = 1; m <= 12; m++) data.push({ month: `2025-${String(m).padStart(2, '0')}`, region: r, sales: m * 10 });
  const spec = { title: 'q', data, filters: ['region'], kpis: [{ label: 'Ventas', field: 'sales', agg: 'sum' }], charts: [{ type: 'line', x: 'month', y: 'sales', series: 'region' }, { type: 'bar', x: 'region', y: 'sales' }] };
  const plan = planDashboard(spec);
  const packed = JSON.parse(JSON.stringify(packPlan(plan)));
  assert.ok(packed.panels.every((p) => p.sharedData && p.spec.data === undefined));
  assert.ok(Array.isArray(packed.data[0]));
  const back = unpackPlan(packed);
  assert.deepEqual(back.data, data);
  assert.ok(back.panels.every((p) => p.spec.data === back.data));
  const html = dashboard(spec);
  const tag = '<script type="application/json" id="pa-dash-plan">';
  const i = html.lastIndexOf(tag);
  // Cada fila aparece una sola vez en la página (no una vez por gráfico).
  if (i > 0) assert.equal(html.slice(i, html.indexOf('</script>', i)).split('"2025-01"').length - 1, 3);
  // Columnar input for the dashboard too.
  const cols = { month: data.map((r) => r.month), region: data.map((r) => r.region), sales: data.map((r) => r.sales) };
  assert.deepEqual(planDashboard({ ...spec, data: cols }).data, data);
});

test('toHTML: one copy of a table shared by several charts', () => {
  const html = toHTML([{ type: 'bar', data: rows, x: 'region', y: 'sales' }, { type: 'donut', data: rows, label: 'region', value: 'sales' }]);
  if (!html.includes('id="pa-data"')) return; // sin bundle: no hay specs incrustados
  const specs = [0, 1].map((k) => { const t = `<script type="application/json" id="pa-spec-${k}">`; const i = html.lastIndexOf(t); return JSON.parse(html.slice(i + t.length, html.indexOf('</script>', i))); });
  assert.deepEqual(specs.map((s) => s._paData), [0, 0]);
  const t = '<script type="application/json" id="pa-data">', i = html.lastIndexOf(t);
  const tables = JSON.parse(html.slice(i + t.length, html.indexOf('</script>', i)));
  assert.equal(tables.length, 1);
  assert.deepEqual(toRows(tables[0]), rows);
});

test('padding: 0 at the sides and 8 top/bottom by default; number, list or per side', () => {
  const svg = (p) => plot({ type: 'bar', data: rows, x: 'region', y: 'sales', title: 'Biobío lidera', source: 'INE', ...(p === undefined ? {} : { padding: p }) });
  const titleX = (s) => +s.match(/<g class="pa-header"><text x="([\d.]+)" y="([\d.]+)"/)[1];
  const titleY = (s) => +s.match(/<g class="pa-header"><text x="([\d.]+)" y="([\d.]+)"/)[2];
  const srcX = (s) => +s.match(/<text x="([\d.]+)" y="[\d.]+"[^>]*text-anchor="end"[^>]*>Fuente/)[1];
  const d = svg();
  assert.equal(titleX(d), 0);
  assert.equal(srcX(d), 720);
  assert.equal(titleX(svg(24)), 24);
  assert.equal(srcX(svg(24)), 696);
  assert.equal(titleX(svg([10, 30])), 30);
  assert.equal(titleY(svg([10, 30])) - titleY(svg([0, 30])), 10);
  assert.equal(srcX(svg({ right: 12 })), 708);
  assert.equal(titleX(svg([0, 5, 0, 40])), 40);
});

test('title, subtitle and source are optional: no suggestion asks for them', () => {
  const r = lint({ type: 'bar', data: rows, x: 'region', y: 'sales' });
  assert.ok(!r.suggestions.some((s) => ['title', 'source', 'subtitle'].includes(s.code)));
  assert.ok(safePlot({ type: 'bar', data: rows, x: 'region', y: 'sales' }).ok);
});

// ── Seguridad: lo que encontró la revisión antes de 0.10.0 ─────────────────
import { configure, themeFor, registerTheme } from '../src/index.js';
import { embedTiles } from '../src/charts/pointmap.js';

test('security: skins.when must be a CSS selector', () => {
  const base = { type: 'bar', data: rows, x: 'region', y: 'sales' };
  const r = safePlot({ ...base, skins: [{}, { when: 'html.dark}</style><script>alert(1)</script><style>', palette: ['#111111', '#222222'] }] });
  assert.equal(r.ok, false);
  assert.ok(!String(r.svg).includes('<script'));
  assert.ok(plot({ ...base, skins: [{}, { when: '[data-theme="dark"] .x', palette: ['#111111', '#222222'] }] }).includes('[data-theme="dark"] .x'));
});

test('security: class colorScale colors are validated (no <style> breakout)', () => {
  const data = [{ region: 'Biobío', v: 1, w: 2 }, { region: 'Ñuble', v: 3, w: 4 }];
  const r = safePlot({ type: 'choropleth', data, key: 'region', value: 'v', views: [{ id: 'a', value: 'v' }, { id: 'b', value: 'w', colorScale: { colors: ['#fff', 'x</style><script>alert(1)</script>'], breaks: [1.5] } }] });
  assert.equal(r.ok, false);
  assert.ok(!String(r.svg).includes('<script'));
});

test('security: font stylesheets only from font services, unless the code allows the host', () => {
  const spec = { type: 'bar', data: rows, x: 'region', y: 'sales', theme: { font: { family: 'X', import: 'https://evil.example/x.css' } } };
  assert.equal(themeFor(spec).font.import, undefined);
  assert.match(themeFor({ font: 'Poppins' }).font.import, /fonts\.googleapis\.com/);
  registerTheme('sec-acme', { font: { family: 'Acme', import: 'https://cdn.acme.example/f.css' } });
  assert.equal(themeFor({ theme: 'sec-acme' }).font.import, 'https://cdn.acme.example/f.css');
  configure({ fontHosts: ['fonts.acme.example'] });
  assert.equal(themeFor({ theme: { font: { import: 'https://fonts.acme.example/a.css' } } }).font.import, 'https://fonts.acme.example/a.css');
  configure(null);
  assert.equal(themeFor({ theme: { font: { family: 'x;background:url(https://e/b)' } } }).font.family.includes(';'), false);
});

test('security: prototype keys never change rows or themes', () => {
  const r = toRows([['__proto__', 'v'], [{ polluted: 1 }, 1]]);
  assert.equal(r[0].polluted, undefined);
  assert.equal(Object.getPrototypeOf(r[0]), Object.prototype);
  assert.ok(plot({ type: 'bar', data: rows, x: 'region', y: 'sales', theme: 'constructor' }));
  assert.ok(plot({ type: 'bar', data: rows, x: 'region', y: 'sales', theme: JSON.parse('{"extends":"__proto__","__proto__":{"polluted":1}}') }));
  assert.equal({}.polluted, undefined);
});

test('security: absurd sizes stay bounded (bins, waffle units, width)', () => {
  const d = Array.from({ length: 500 }, (_, i) => ({ x: i % 97, y: i, s: 'abcde'[i % 5] }));
  const t0 = Date.now();
  assert.ok(safePlot({ type: 'hist', data: d, x: 'x', bins: 1e7 }).ok);
  assert.ok(safePlot({ type: 'hist', data: d, x: 'x', binWidth: 1e-9 }).ok);
  assert.ok(safePlot({ type: 'dotplot', data: d, x: 'x', bins: 1e9 }).ok);
  assert.ok(safePlot({ type: 'waffle', data: d.slice(0, 50), series: 's', value: 'y', unit: 1e-9 }).ok);
  assert.ok(plot({ type: 'dotplot', data: d, x: 'x', width: 1e9 }).length < 5e6);
  assert.ok(Date.now() - t0 < 5000, `${Date.now() - t0} ms`);
});

test('security: embedTiles only fetches public https images', async () => {
  const asked = [];
  const fake = async (u) => { asked.push(u); return { ok: true, headers: { get: (k) => (k === 'content-type' ? 'image/png' : null) }, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer }; };
  const svg = ['http://169.254.169.254/latest/meta-data', 'https://127.0.0.1/a.png', 'https://localhost/a.png', 'https://tiles.example.com/1/2/3.png']
    .map((u) => `<image class="pa-tile" href="${u}"/>`).join('');
  const out = await embedTiles(`<svg>${svg}</svg>`, { fetch: fake });
  assert.deepEqual(asked, ['https://tiles.example.com/1/2/3.png']);
  assert.ok(out.includes('data:image/png;base64,'));
  const html = async (u) => ({ ok: true, headers: { get: (k) => (k === 'content-type' ? 'text/html' : null) }, arrayBuffer: async () => new ArrayBuffer(3) });
  assert.ok(!(await embedTiles(`<svg>${svg}</svg>`, { fetch: html })).includes('data:text/html'));
});
