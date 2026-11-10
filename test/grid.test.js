import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plot, safePlot, lint } from '../src/index.js';

const texts = (svg) => [...svg.matchAll(/>([^<>]+)<\/text>/g)].map((m) => m[1]);
const axisX = (svg) => {
  const m = svg.match(/class="pa-axis pa-axis-x"[\s\S]*?<\/g><\/g>/);
  return m ? texts(m[0]) : [];
};

// ── 7. La última marca del eje de valores siempre va rotulada ───────────────
test('axis: the last value tick is the first nice value over the max, and it is labeled', () => {
  const data = [{ n: 'Metropolitana', v: 7400741 }, { n: 'Valparaíso', v: 1896053 }, { n: 'Arica y Parinacota', v: 244569 }];
  const full = (v) => Math.round(v).toLocaleString('de-DE');
  for (const width of [358, 560, 1000]) {
    const labs = axisX(plot({ type: 'bar', horizontal: true, data, x: 'n', y: 'v', labels: true, axis: true, width, format: full }));
    const nums = labs.map((s) => +s.replace(/\./g, ''));
    const last = nums[nums.length - 1];
    assert.ok(last >= 7400741, `${width}: ${labs.join(' | ')}`);
    assert.ok(labs.length >= 2, `${width}: ${labs.join(' | ')}`);
  }
});

test('axis: scatter x keeps its last tick labeled on a phone', () => {
  const data = Array.from({ length: 12 }, (_, i) => ({ a: i * 913457, b: i }));
  const labs = axisX(plot({ type: 'scatter', data, x: 'a', y: 'b', width: 340, xFormat: (v) => Math.round(v).toLocaleString('de-DE') }));
  const nums = labs.map((s) => +s.replace(/\./g, ''));
  assert.ok(nums[nums.length - 1] >= 11 * 913457, labs.join(' | '));
});

// ── 1. Escalas por clases ──────────────────────────────────────────────────
const grid = [];
for (const y of ['A', 'B', 'C']) for (const x of ['p', 'q', 'r', 's']) grid.push({ x, y, v: { A: -2, B: 0.1, C: 3 }[y] * (x.charCodeAt(0) - 110), g: x < 'r' ? 'G1' : 'G2', z: y === 'C' ? 'Z2' : 'Z1' });
const bins = { colors: ['#2166AC', '#92C5DE', '#F7F7F7', '#F4A582', '#B2182B'], breaks: [-4, -1, 1, 4] };

test('binned colorScale: heatmap cells take the class color and the legend is stepped', () => {
  const svg = plot({ type: 'heatmap', data: grid, x: 'x', y: 'y', value: 'v', colorScale: bins, width: 520 });
  for (const c of ['#2166AC', '#B2182B']) assert.match(svg, new RegExp(`fill="${c}"`));
  // Five swatches in the legend, the four breaks written under them.
  assert.equal((svg.match(/class="pa-key"/g) || []).length, 5);
  for (const b of ['−4', '−1', '1', '4']) assert.ok(texts(svg).includes(b), texts(svg).join('|'));
});

test('binned colorScale: break labels use a format function', () => {
  const svg = plot({ type: 'heatmap', data: grid, x: 'x', y: 'y', value: 'v', colorScale: bins, format: (v) => `${v} u`, width: 520 });
  assert.ok(texts(svg).includes('-4 u'));
});

test('binned colorScale: choropleth and treemap change', () => {
  const c = plot({ type: 'choropleth', geo: 'chile', data: [{ r: 'Biobío', v: 3 }, { r: 'Maule', v: 9 }], key: 'r', value: 'v', colorScale: { colors: ['#EEEEEE', '#999999', '#333333'], breaks: [2, 5] }, width: 400 });
  assert.match(c, /#999999/);
  assert.match(c, /#333333/);
  const d = [{ g: 'A', k: 'a', v: 10, t: 2023 }, { g: 'B', k: 'c', v: 8, t: 2023 }, { g: 'A', k: 'a', v: 8, t: 2022 }, { g: 'B', k: 'c', v: 9, t: 2022 }];
  const t = plot({ type: 'treemap', data: d, path: ['g', 'k'], value: 'v', time: 't', colorBy: 'change', colorScale: { colors: ['#B2182B', '#EEEEEE', '#2166AC'], breaks: [-0.05, 0.05] }, width: 500 });
  assert.match(t, /#2166AC/);
  assert.match(t, /#B2182B/);
});

test('binned colorScale: breaks and colors that do not match are an error with a fix', () => {
  const bad = { type: 'heatmap', data: grid, x: 'x', y: 'y', value: 'v', colorScale: { colors: ['#000', '#fff'], breaks: [0, 1] } };
  assert.equal(safePlot(bad).ok, false);
  assert.ok(lint(bad).errors.some((e) => e.code === 'colorscale-breaks'));
  assert.equal(safePlot({ ...bad, colorScale: { name: 'Blues', breaks: [0, 1, 2] } }).ok, true);
});

test('heatmap midClass: the class around 0 takes the neutral tint', () => {
  const svg = plot({ type: 'heatmap', data: grid, x: 'x', y: 'y', value: 'v', colorScale: bins, midClass: 'neutral', width: 520 });
  assert.doesNotMatch(svg, /fill="#F7F7F7"/);
});

// ── 2–3. Celdas faltantes, floor y ceiling ──────────────────────────────────
test('heatmap missing: gap draws nothing, plain an outline, hatch a pattern', () => {
  const data = [{ x: 'a', y: 'r', v: 1 }, { x: 'b', y: 'r', v: null }, { x: 'a', y: 's', v: 2 }, { x: 'b', y: 's', v: 3 }];
  const count = (svg) => (svg.match(/class="pa-m"/g) || []).length;
  assert.equal(count(plot({ type: 'heatmap', data, x: 'x', y: 'y', value: 'v', missing: 'gap' })), 3);
  assert.match(plot({ type: 'heatmap', data, x: 'x', y: 'y', value: 'v', missing: 'plain' }), /fill="transparent" stroke=/);
  assert.match(plot({ type: 'heatmap', data, x: 'x', y: 'y', value: 'v', missing: 'hatch' }), /<pattern id="pa-hm-nd-/);
});

test('heatmap floor/ceiling: cells outside are plain, keep their value in the tooltip, leave the scale', () => {
  const data = [{ x: 'a', y: 'r', v: 0.5 }, { x: 'b', y: 'r', v: 1.4 }, { x: 'c', y: 'r', v: 2 }];
  const svg = plot({ type: 'heatmap', data, x: 'x', y: 'y', value: 'v', floor: 1.2, width: 400 });
  assert.match(svg, /data-tip="r · a\n0,5"><rect[^>]*fill="transparent"/);
});

test('heatmap emptyRow: a row without values is written across', () => {
  const data = [{ x: 'a', y: 'r', v: 1 }, { x: 'b', y: 'r', v: 2 }, { x: 'a', y: 's', v: null }, { x: 'b', y: 's', v: null }];
  const svg = plot({ type: 'heatmap', data, x: 'x', y: 'y', value: 'v', emptyRow: 'sin dato', width: 400 });
  assert.ok(texts(svg).includes('sin dato'));
  assert.equal((svg.match(/class="pa-m"/g) || []).length, 3);
});

// ── 4. Raleo de rótulos ────────────────────────────────────────────────────
test('xTicks / yTicks every N', () => {
  const data = [];
  for (let t = 2000; t < 2012; t++) for (const y of ['a', 'b', 'c', 'd']) data.push({ t: String(t), y, v: t % 7 });
  const svg = plot({ type: 'heatmap', data, x: 't', y: 'y', value: 'v', xTicks: { every: 5 }, yTicks: { every: 2 }, width: 900 });
  const labs = texts(svg);
  assert.ok(labs.includes('2000') && labs.includes('2005') && labs.includes('2010'));
  assert.ok(!labs.includes('2001'));
  assert.ok(labs.includes('a') && !labs.includes('b') && labs.includes('c'));
  const bars = plot({ type: 'bar', horizontal: false, sort: 'none', data: data.filter((r) => r.y === 'a'), x: 't', y: 'v', xTicks: { every: 3 }, width: 900 });
  const bl = texts(bars);
  assert.ok(bl.includes('2003') && !bl.includes('2004'));
});

// ── 5. Ejes con grupos ─────────────────────────────────────────────────────
test('xGroup / yGroup: bands with group names on heatmap, bar and strip', () => {
  const hm = plot({ type: 'heatmap', data: grid, x: 'x', y: 'y', value: 'v', xGroup: 'g', yGroup: 'z', width: 600 });
  assert.match(hm, /class="pa-groups pa-groups-x"/);
  assert.match(hm, /class="pa-groups pa-groups-y"/);
  for (const n of ['G1', 'G2', 'Z1', 'Z2']) assert.ok(texts(hm).includes(n), n);
  const regs = [['Arica', 'Norte'], ['Atacama', 'Norte'], ['Santiago', 'Centro'], ['Biobío', 'Sur'], ['Aysén', 'Sur']];
  const d = regs.map(([r, z], i) => ({ r, z, v: i + 1 }));
  const hb = plot({ type: 'bar', horizontal: true, sort: 'none', data: d, x: 'r', y: 'v', yGroup: 'z', width: 358 });
  assert.match(hb, /pa-groups-y/);
  const vb = plot({ type: 'bar', horizontal: false, sort: 'none', data: d, x: 'r', y: 'v', xGroup: 'z', width: 600 });
  assert.match(vb, /pa-groups-x/);
  // Nothing reordered: Arica still comes before Aysén.
  assert.ok(texts(vb).indexOf('Arica') < texts(vb).indexOf('Aysén'));
  const st = plot({ type: 'strip', data: d.flatMap((r) => [r, { ...r, v: r.v + 1 }]), x: 'r', y: 'v', xGroup: 'z', width: 600 });
  assert.match(st, /pa-groups-x/);
  assert.equal(safePlot({ type: 'bar', data: d, x: 'r', y: 'v', xGroup: 'nope' }).ok, false);
});

// ── 6. Columna de rango en tablas ──────────────────────────────────────────
test('table range column: rail, band, median, reference and a full tooltip', () => {
  const data = [
    { ind: 'Pobreza', v: 6.5, min: 0.4, max: 28, q1: 4, q3: 11, med: 7.2, cl: 6.5 },
    { ind: 'Hacinamiento', v: 9.1, min: 2, max: 24, q1: 6, q3: 12, med: 8.4, cl: 7.9 },
  ];
  const spec = (width, extra = {}) => ({ type: 'table', data, width, locale: 'en', columns: ['ind', { field: 'v', type: 'range', min: 'min', max: 'max', band: ['q1', 'q3'], median: 'med', ref: 'cl', refLabel: 'Chile', ...extra }] });
  const svg = plot(spec(640));
  assert.match(svg, /<circle[^>]*r="4\.5"/);
  assert.match(svg, /Range: 0\.4–28\.0|Range: 0\.4–28/);
  assert.match(svg, /Median: 7\.2/);
  assert.match(svg, /Chile: 6\.5/);
  assert.equal(safePlot(spec(358, { scale: 'row' })).ok, true);
  assert.equal(safePlot({ ...spec(300), cards: true }).ok, true);
});
