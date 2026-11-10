import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plot } from '../src/index.js';
import { makeFormat } from '../src/format.js';

const yLabels = (svg) => [...svg.matchAll(/class="pa-axis pa-axis-y"[\s\S]*?<\/g>/g)]
  .flatMap((m) => [...m[0].matchAll(/>([^<>]+)<\/text>/g)].map((x) => x[1]));

test('marcas enteras sin ",0"; fraccionarias conservan decimales', () => {
  const f = makeFormat(undefined, 'es', [0.1, 2.1]).tick(0.5);
  assert.deepEqual([0, 0.5, 1, 1.5, 2].map(f), ['0', '0,5', '1', '1,5', '2']);
  const fe = makeFormat(undefined, 'en', [0.1, 2.1]).tick(0.5);
  assert.deepEqual([1, 1.5].map(fe), ['1', '1.5']);
  const fd = makeFormat({ decimals: 1 }, 'es', [590, 612]).tick(5);
  assert.deepEqual([600, 1200.5].map(fd), ['600', '1.200,5']);
  assert.equal(makeFormat('percent', 'es', [0.01, 0.03]).tick(0.005)(0.02), '2%');
});

test('eje log: cada marca con su propia unidad (1, no "0,001 mil")', () => {
  const svg = plot({ type: 'line', data: [{ x: 2020, y: 1 }, { x: 2021, y: 100 }, { x: 2022, y: 10000 }], x: 'x', y: 'y', yScale: 'log', title: 't', source: 's' });
  const labs = yLabels(svg);
  assert.ok(labs.includes('1') && labs.includes('10 mil'), labs.join(' | '));
});

test('colorScale acepta nombres CSS en la lista', async () => {
  const { safePlot } = await import('../src/index.js');
  const r = safePlot({ type: 'heatmap', data: [{ x: 'a', y: 'b', v: 1 }, { x: 'b', y: 'a', v: 2 }], x: 'x', y: 'y', value: 'v', colorScale: ['white', 'steelblue'], title: 't', source: 's' });
  assert.equal(r.ok, true, JSON.stringify(r.errors));
});
