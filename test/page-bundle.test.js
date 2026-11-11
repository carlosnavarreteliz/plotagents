import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { plot, toHTML, dashboard, bundleSource, resolve } from '../src/index.js';
import { pageBundle } from '../src/page-bundle.js';

const lib = bundleSource();
const read = (f) => (f === 'plotagents.js' ? lib : bundleSource(f));
const marked = lib && lib.includes('\n//#pa-mod ');
const skip = !marked && 'dist sin marcas de módulo (npm run build)';

const rows = [{ region: 'Biobío', sales: 1240 }, { region: 'Ñuble', sales: 830 }, { region: 'Maule', sales: 610 }];
const ts = Array.from({ length: 24 }, (_, i) => ({ m: `2024-${String((i % 12) + 1).padStart(2, '0')}`, s: i < 12 ? 'A' : 'B', v: 100 + i * 3 }));

/** Ejecuta un script de página y devuelve su window.plotagents. */
function run(src) {
  const sandbox = { console };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return sandbox.plotagents;
}

test('page bundle: only the modules of the page types, and the same SVG as the full library', { skip }, () => {
  const specs = [{ type: 'line', data: ts, x: 'm', y: 'v', series: 's' }, { type: 'bar', data: rows, x: 'region', y: 'sales' }];
  const src = pageBundle(specs.map((s) => resolve(s)), read);
  assert.ok(src && src.length < lib.length / 3, `${src && src.length} vs ${lib.length}`);
  assert.ok(src.includes('"src/charts/line.js"') && src.includes('"src/charts/bar.js"'));
  for (const id of ['src/charts/network.js', 'src/charts/table.js', 'src/lint.js', 'src/schema.js', 'src/charts/choropleth.js', 'src/dashboard.js']) assert.ok(!src.includes(`"${id}"`), id);
  const pa = run(src);
  for (const s of specs) assert.equal(pa.plot(s), plot(s));
  assert.equal(typeof pa.render, 'function');
});

test('page bundle: maps bring only their geometry', { skip }, () => {
  const chile = pageBundle([resolve({ type: 'choropleth', data: rows, key: 'region', value: 'sales' })], read);
  assert.ok(chile.includes('"src/geo/chile.js"') && !chile.includes('"src/geo/world.js"') && !chile.includes('"src/geo/usa.js"'));
  const spec = { type: 'choropleth', geo: 'mundo', data: [{ c: 'CL', v: 1 }, { c: 'AR', v: 2 }], key: 'c', value: 'v' };
  const world = pageBundle([resolve(spec)], read);
  assert.ok(world.includes('"src/geo/world.js"') && !world.includes('"src/geo/chile.js"'));
  assert.equal(run(world).plot(spec), plot(spec));
  const own = pageBundle([resolve({ type: 'choropleth', geo: { type: 'FeatureCollection', features: [] }, data: rows, key: 'region', value: 'sales' })], read);
  assert.ok(!own.includes('"src/geo/data/'));
});

test('page bundle: dashboards carry the mount code; toHTML and dashboard() embed light scripts', { skip }, () => {
  const d = pageBundle([resolve({ type: 'kpi', items: [{ label: 'a', value: 1 }] })], read, { dashboard: true });
  assert.equal(typeof run(d).mountDashboard, 'function');
  const page = toHTML([{ type: 'bar', data: rows, x: 'region', y: 'sales' }]);
  assert.ok(page.length < lib.length / 2, `toHTML ${page.length}`);
  const dash = dashboard({ title: 'q', data: rows, charts: [{ type: 'bar', x: 'region', y: 'sales' }, { type: 'donut', label: 'region', value: 'sales' }] });
  assert.ok(dash.length < lib.length / 2, `dashboard ${dash.length}`);
  assert.ok(dash.includes('plotagents.mountDashboard('));
});

test('page bundle: an unknown type or an old dist falls back to the whole library', { skip }, () => {
  assert.equal(pageBundle([{ type: 'nope' }], read), null);
  assert.equal(pageBundle([{ type: 'bar' }], () => 'no marks here'), null);
});
