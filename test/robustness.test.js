// Robustness: bad or degenerate input must end in a PlotError with a fix (or
// a clean chart), never a raw TypeError, a NaN path or a hang. Plus the lint
// rules, schema, types and CLI that agents rely on to repair their own spec.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { writeFileSync, readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { plot, lint, schema, PlotError } from '../src/index.js';
import { didYouMean, editDistance } from '../src/lint.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CLI = join(ROOT, 'bin', 'plotagents.js');

const clean = (svg) => {
  assert.ok(svg.startsWith('<svg'), 'returns an SVG');
  assert.ok(!/NaN|Infinity/.test(svg), 'no NaN / Infinity in the SVG');
  assert.ok(!/>undefined<|undefined[ ,.)]/.test(svg), 'no "undefined" text');
  return svg;
};
/** Throws a PlotError (not a TypeError) whose message matches `re` and carries a hint. */
const plotError = (spec, re) => {
  assert.throws(() => plot(spec), (e) => {
    assert.ok(e instanceof PlotError, `expected PlotError, got ${e.name}: ${e.message}`);
    if (re) assert.match(e.message, re);
    assert.ok(e.hint, 'has a fix hint');
    return true;
  });
};
const codes = (r) => [...r.errors, ...r.warnings, ...r.suggestions].map((i) => i.code);
const issue = (r, code) => [...r.errors, ...r.warnings, ...r.suggestions].find((i) => i.code === code);

// ── 1. Sankey ──────────────────────────────────────────────────────────────

test('sankey: only zero / self-loop links → PlotError with a fix', () => {
  plotError({ type: 'sankey', data: [{ from: 'a', to: 'b', value: 0 }, { from: 'c', to: 'c', value: 5 }] }, /flujos positivos/);
  plotError({ type: 'sankey', locale: 'en', data: [{ from: 'a', to: 'a', value: 3 }] }, /no positive flows/);
});

test('sankey: a cycle → PlotError naming the cycle', () => {
  plotError({ type: 'sankey', data: [{ from: 'a', to: 'b', value: 3 }, { from: 'b', to: 'a', value: 2 }] }, /ciclo \(a → b → a\)/);
  plotError({ type: 'sankey', locale: 'en', data: [{ from: 'x', to: 'y', value: 1 }, { from: 'y', to: 'z', value: 1 }, { from: 'z', to: 'x', value: 1 }] }, /cycle/);
  // A DAG still draws.
  clean(plot({ type: 'sankey', data: [{ from: 'a', to: 'b', value: 3 }, { from: 'a', to: 'c', value: 2 }, { from: 'b', to: 'c', value: 1 }] }));
});

// ── 2. Non-finite values ───────────────────────────────────────────────────

test('Infinity values are ignored in donut, pie, chord and sankey', () => {
  const parts = [{ k: 'a', v: Infinity }, { k: 'b', v: 2 }, { k: 'c', v: 3 }];
  clean(plot({ type: 'donut', data: parts, label: 'k', value: 'v' }));
  clean(plot({ type: 'pie', data: parts, label: 'k', value: 'v' }));
  clean(plot({ type: 'chord', data: [{ from: 'a', to: 'b', value: Infinity }, { from: 'b', to: 'c', value: 2 }, { from: 'c', to: 'a', value: 1 }] }));
  clean(plot({ type: 'chord', matrix: [[0, Infinity, 2], [1, 0, 3], [2, 1, 0]], names: ['A', 'B', 'C'] }));
  clean(plot({ type: 'sankey', data: [{ from: 'a', to: 'b', value: Infinity }, { from: 'a', to: 'c', value: 2 }] }));
});

test('regplot with no numeric pairs → PlotError; heatmap description has no "undefined"', () => {
  plotError({ type: 'regplot', data: [{ x: null, y: null }, { x: null, y: null }], x: 'x', y: 'y' }, /valores numéricos/);
  plotError({ type: 'regplot', locale: 'en', data: [{ x: 'a', y: 1 }, { x: 'b', y: 2 }], x: 'x', y: 'y' }, /numeric values/);
  const svg = plot({ type: 'heatmap', data: [{ x: 'a', y: 'b', v: null }], x: 'x', y: 'y', value: 'v' });
  assert.ok(!svg.includes('undefined'));
  assert.match(svg, /Ninguna celda/);
});

// ── 3. Categorical charts and radar ────────────────────────────────────────

test('box/violin/strip/swarm/point/radar with no numeric values → PlotError', () => {
  const data = [{ g: 'a', v: null }, { g: 'b', v: '' }];
  for (const type of ['box', 'violin', 'strip', 'swarm', 'point']) plotError({ type, data, x: 'g', y: 'v' }, /valores numéricos en `v`/);
  plotError({ type: 'box', locale: 'en', data, x: 'g', y: 'v' }, /No numeric values in `v`/);
  plotError({ type: 'radar', data: ['a', 'b', 'c'].map((axis) => ({ axis, value: null, series: 's' })), axis: 'axis', value: 'value', series: 'series' }, /valores numéricos/);
});

test('violin with one value per group still draws a mark', () => {
  const svg = clean(plot({ type: 'violin', data: [{ g: 'a', v: 1 }, { g: 'b', v: 2 }], x: 'g', y: 'v' }));
  assert.ok((svg.match(/class="pa-m"/g) || []).length >= 2, 'one mark per group');
  // Mixed: a real violin next to a single value.
  clean(plot({ type: 'violin', data: [{ g: 'a', v: 1 }, { g: 'a', v: 3 }, { g: 'a', v: 2 }, { g: 'b', v: 5 }], x: 'g', y: 'v' }));
  // All values equal in a group.
  clean(plot({ type: 'violin', data: [{ g: 'a', v: 4 }, { g: 'a', v: 4 }, { g: 'b', v: 1 }, { g: 'b', v: 2 }], x: 'g', y: 'v' }));
});

// ── 4. Shapes that used to raise TypeErrors ────────────────────────────────

test('refLines as a single object works in box and is flagged by lint', () => {
  clean(plot({ type: 'box', data: [{ x: 'a', y: 1 }, { x: 'a', y: 3 }, { x: 'a', y: 2 }], x: 'x', y: 'y', refLines: { y: 2, label: 'Meta' } }));
  const r = lint({ type: 'bar', data: [{ x: 'a', y: 1 }, { x: 'b', y: 3 }], x: 'x', y: 'y', refLines: { y: 2 } });
  assert.match(issue(r, 'not-a-list').fix, /refLines: \[\{"y":2\}\]/);
});

test('format.decimals out of range is a lint error', () => {
  const r = lint({ type: 'bar', data: [{ x: 'a', y: 1 }, { x: 'b', y: 3 }], x: 'x', y: 'y', format: { decimals: 200 } });
  assert.ok(r.errors.some((e) => e.code === 'format-decimals'));
  assert.equal(lint({ type: 'bar', data: [{ x: 'a', y: 1 }], x: 'x', y: 'y', format: { decimals: 2 } }).errors.length, 0);
});

test('kpi: one item as an object, empty trends and missing values', () => {
  clean(plot({ type: 'kpi', items: { label: 'Ventas', value: 3 } }));
  clean(plot({ type: 'kpi', items: [{ label: 'x', value: 5, trend: [null, null] }] }));
  const svg = clean(plot({ type: 'kpi', items: [{ label: 'x', value: null }] }));
  assert.match(svg, /—/);
});

// ── 5. Lint ────────────────────────────────────────────────────────────────

const bars = [{ region: 'Biobío', ventas: 10 }, { region: 'Ñuble', ventas: 20 }, { region: 'Maule', ventas: 30 }];

test('lint: pie gets the donut checks', () => {
  const many = Array.from({ length: 8 }, (_, i) => ({ k: 'k' + i, v: i + 1 }));
  assert.ok(codes(lint({ type: 'pie', data: many, label: 'k', value: 'v' })).includes('donut-slices'));
  const neg = lint({ type: 'pie', data: [{ k: 'a', v: -1 }, { k: 'b', v: 2 }], label: 'k', value: 'v', locale: 'en' });
  assert.match(neg.errors.find((e) => e.code === 'negative').message, /Pies cannot/);
});

test('lint: unknown options get "did you mean", valid options are not flagged', () => {
  const r = lint({ type: 'bar', data: bars, x: 'region', y: 'ventas', titel: 'x', hightlight: 'Ñuble' });
  const msgs = r.warnings.filter((w) => w.code === 'unknown-option');
  assert.equal(msgs.length, 2);
  assert.match(msgs[0].fix, /`title`/);
  assert.match(msgs[1].fix, /`highlight`/);
  const ok = lint({ type: 'bar', data: bars, x: 'region', y: 'ventas', title: 'Maule lidera con 30', source: 'x', legend: 'bottom', exclude: 'Maule', colorScale: 'viridis', cmap: 'Blues', col: undefined, endLabels: false, showValues: true, labelsFor: {}, _internal: 1, palette: 'tab10', facetOrder: [], collapsed: [], weekends: true, curveness: 0.2, tiles: 'osm', primary: true, span: 6 });
  assert.deepEqual(ok.warnings.filter((w) => w.code === 'unknown-option'), []);
  assert.ok(!codes(ok).some((c) => c.startsWith('enum-')));
});

test('lint: every schema property counts as known', () => {
  const spec = { type: 'bar', data: bars, x: 'region', y: 'ventas' };
  for (const k of Object.keys(schema.properties)) if (!(k in spec)) spec[k] = undefined;
  assert.deepEqual(lint(spec).warnings.filter((w) => w.code === 'unknown-option'), []);
});

test('lint: bad enum values are errors with a fix', () => {
  const r = lint({ type: 'bar', data: bars, x: 'region', y: 'ventas', format: 'percentage', stack: 'yes', yScale: 'sqrt', legend: 'middle' });
  const e = Object.fromEntries(r.errors.map((x) => [x.code, x]));
  assert.match(e['enum-format'].fix, /"percent"/);
  assert.ok(e['enum-stack'] && e['enum-yScale'] && e['enum-legend']);
  assert.equal(r.ok, false);
  const en = lint({ type: 'bar', locale: 'en', data: bars, x: 'region', y: 'ventas', xScale: 'lgo' });
  assert.match(en.errors[0].message, /is not a valid value/);
  assert.match(en.errors[0].fix, /Did you mean `xScale: "log"`/);
  assert.ok(codes(lint({ type: 'network', data: [{ from: 'a', to: 'b' }], layout: 'spiral' })).includes('enum-layout'));
  assert.ok(!codes(lint({ type: 'network', data: [{ from: 'a', to: 'b' }], layout: 'circle' })).includes('enum-layout'));
});

test('lint: highlight / dashed / exclude that match no category warn', () => {
  const r = lint({ type: 'bar', data: bars, x: 'region', y: 'ventas', highlight: 'Nuble', exclude: ['Maule', 'Aysén'], dashed: 'Arica' });
  assert.match(issue(r, 'highlight-unknown').message, /"Nuble"/);
  assert.match(issue(r, 'exclude-unknown').message, /"Aysén"/);
  assert.ok(!issue(r, 'exclude-unknown').message.includes('Maule'));
  assert.ok(issue(r, 'dashed-unknown'));
  // A field name for `dashed` and wide-table series names are fine.
  const wide = lint({ type: 'line', data: [{ m: '2024-01', a: 1, b: 2, p: true }], x: 'm', y: ['a', 'b'], highlight: 'b', dashed: 'p' });
  assert.ok(!codes(wide).some((c) => c.endsWith('-unknown')));
});

test('lint: color scales (unknown, qualitative, rainbow) and palettes', () => {
  const base = { type: 'heatmap', data: [{ x: 'a', y: 'b', v: 1 }], x: 'x', y: 'y', value: 'v' };
  assert.match(lint({ ...base, colorScale: 'virdis' }).errors.find((e) => e.code === 'colorscale-unknown').fix, /"viridis"/);
  assert.ok(codes(lint({ ...base, cmap: 'tab10' })).includes('colorscale-qualitative'));
  for (const name of ['jet', 'rainbow', 'hsv', 'nipy_spectral', 'gist_ncar', 'gist_stern', 'gist_rainbow']) {
    const w = lint({ ...base, colormap: name }).warnings.find((x) => x.code === 'colorscale-rainbow');
    assert.ok(w, name);
    assert.match(w.fix, /viridis/);
  }
  for (const ok of ['viridis', 'Viridis', 'viridis_r', 'RdBu', 'coolwarm', ['#FFFFFF', '#000000'], { name: 'Blues', reverse: true }]) {
    assert.ok(!codes(lint({ ...base, colorScale: ok })).some((c) => c.startsWith('colorscale')), JSON.stringify(ok));
  }
  assert.ok(codes(lint({ ...base, palette: 'tab11' })).includes('palette-unknown'));
  assert.ok(!codes(lint({ ...base, palette: 'Set2' })).includes('palette-unknown'));
});

test('lint: theme tokens, Mapbox secret tokens and gantt collapsed phases', () => {
  assert.match(issue(lint({ type: 'bar', data: bars, theme: { backgrond: '#fff', accent: '#123456' } }), 'theme-key').fix, /theme\.background/);
  assert.ok(codes(lint({ type: 'bar', data: bars, theme: 'nochee' })).includes('theme-unknown'));
  const pm = lint({ type: 'pointmap', data: [{ lat: -36.8, lon: -73 }], tiles: 'mapbox-light', tilesKey: 'sk.abc' });
  assert.ok(pm.errors.some((e) => e.code === 'tiles-secret'));
  assert.ok(!pm.errors.some((e) => e.code === 'type'), 'pointmap is a known type');
  assert.ok(codes(lint({ type: 'pointmap', data: [{ lat: 1, lon: 1 }], tiles: 'osmm' })).includes('enum-tiles'));
  const plan = [{ task: 'A', start: '2026-01-05', end: '2026-01-09', phase: 'Diseño' }, { task: 'B', start: '2026-01-12', end: '2026-01-16', phase: 'Obra' }];
  const g = lint({ type: 'gantt', data: plan, group: 'phase', collapsed: ['Diseño', 'Cierre'], today: '2026-01-10' });
  assert.match(issue(g, 'gantt-collapsed-unknown').message, /Cierre/);
  assert.ok(!issue(g, 'gantt-collapsed-unknown').message.includes('Diseño'));
  const big = Array.from({ length: 30 }, (_, i) => ({ task: 'T' + i, start: '2026-01-05', end: '2026-01-09', phase: i < 15 ? 'P1' : 'P2' }));
  assert.ok(codes(lint({ type: 'gantt', data: big, group: 'phase', today: '2026-01-10' })).includes('gantt-collapse'));
});

test('lint: messages follow the locale', () => {
  const es = lint({ type: 'bar', data: bars, x: 'region', y: 'ventas', titel: 'x' });
  const en = lint({ type: 'bar', data: bars, x: 'region', y: 'ventas', titel: 'x', locale: 'en' });
  assert.match(issue(es, 'unknown-option').message, /Opción desconocida/);
  assert.match(issue(en, 'unknown-option').message, /Unknown option/);
  assert.match(issue(en, 'source').message, /source is missing/);
});

test('didYouMean / editDistance', () => {
  assert.equal(editDistance('kitten', 'sitting'), 3);
  assert.equal(didYouMean('titel', ['title', 'type']), 'title');
  assert.equal(didYouMean('percentage', ['number', 'percent']), 'percent');
  assert.equal(didYouMean('zzzz', ['title']), null);
});

// ── 8. Schema ──────────────────────────────────────────────────────────────

test('schema: data is not required, new options are declared', () => {
  assert.ok(!(schema.required || []).includes('data'));
  for (const k of ['legend', 'exclude', 'colorScale', 'cmap', 'colormap', 'col', 'missing', 'hole', 'endLabels', 'showValues', 'jitter', 'valueDomain', 'orient', 'bandwidth', 'thresholds', 'legendTitle', 'facetOrder', 'collapsed', 'collapsible', 'critical', 'weekends', 'layout', 'curveness', 'lat', 'lon', 'tiles', 'tilesKey', 'tileStyle', 'zoom', 'center', 'tileOpacity']) {
    assert.ok(schema.properties[k], k);
  }
  assert.ok(schema.properties.type.enum.includes('pointmap'));
  assert.ok(schema.properties.layout.enum.includes('clusters'));
  const json = JSON.parse(readFileSync(join(ROOT, 'schema.json'), 'utf8'));
  assert.ok(json.properties.colorScale && !json.required, 'schema.json regenerated');
});

// ── 10. CLI ────────────────────────────────────────────────────────────────

test('CLI: dashboard specs render to HTML and --tool dashboard prints its tool', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pa-cli-'));
  const file = join(dir, 'dash.json');
  writeFileSync(file, JSON.stringify({ title: '¿Cómo van las ventas?', data: bars, charts: [{ type: 'bar', x: 'region', y: 'ventas', title: 'Maule lidera' }] }));
  const html = execFileSync(process.execPath, [CLI, file], { encoding: 'utf8' });
  assert.match(html, /^<!doctype html>/i);
  const tool = JSON.parse(execFileSync(process.execPath, [CLI, '--tool', 'dashboard'], { encoding: 'utf8' }));
  assert.equal(tool.name, 'dashboard');
  assert.ok(tool.input_schema.properties.charts);
  const oa = JSON.parse(execFileSync(process.execPath, [CLI, '--tool', 'openai'], { encoding: 'utf8' }));
  assert.equal(oa.function.name, 'plot');
  const lintOut = JSON.parse(spawnSync(process.execPath, [CLI, file, '--lint'], { encoding: 'utf8' }).stdout);
  assert.equal(lintOut.ok, true);
});

test('CLI: a closed pipe (EPIPE) exits quietly', () => {
  const r = spawnSync('/bin/sh', ['-c', `"${process.execPath}" "${CLI}" --schema | head -c 10 > /dev/null`], { encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.ok(!/EPIPE|Error/.test(r.stderr), r.stderr);
});
