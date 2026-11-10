// Las entradas livianas, en su propio proceso: aquí nadie importa 'plotagents' completo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plot as linePlot, RENDERERS } from '../src/types/line.js';

test('entries: a type entry loads only its own types', () => {
  assert.match(linePlot({ type: 'line', data: [{ x: 2020, y: 1 }, { x: 2021, y: 2 }], x: 'x', y: 'y' }), /^<svg/);
  assert.ok(RENDERERS.line && RENDERERS.area);
  assert.equal(RENDERERS.network, undefined);
  assert.throws(() => linePlot({ type: 'network', data: [{ from: 'a', to: 'b' }] }), /plotagents\/core/);
});

test('entries: maps without bundled geometries; core without maps', async () => {
  const maps = await import('../src/maps.js');
  const geo = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { name: 'A' }, geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] } }] };
  assert.match(maps.plot({ type: 'choropleth', geo, key: 'k', value: 'v', data: [{ k: 'A', v: 1 }] }), /data-key="A"/);
  assert.equal(maps.registeredGeo().includes('chile'), false);
  const core = await import('../src/core.js');
  assert.match(core.plot({ type: 'treemap', data: [{ a: 'x', v: 1 }, { a: 'y', v: 2 }], path: ['a'], value: 'v' }), /^<svg/);
  assert.equal(core.RENDERERS.table, undefined);
});
