import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plot } from '../src/index.js';

const E = (a) => a.map(([from, to, value]) => ({ from, to, value }));
const base = { title: 't', source: 's' };

test('network tree/radial: cadena larga no desborda la pila', () => {
  const chain = [];
  for (let i = 0; i < 20000; i++) chain.push(['n' + i, 'n' + (i + 1), 1]);
  for (const layout of ['tree', 'radial']) {
    const svg = plot({ ...base, type: 'network', layout, data: E(chain) });
    assert.ok(!/NaN|undefined/.test(svg));
  }
});

test('network: highlight inexistente se ignora (no atenúa todo)', () => {
  const svg = plot({ ...base, type: 'network', data: E([['a', 'b', 1], ['b', 'c', 1]]), highlight: 'zzz' });
  assert.ok(!svg.includes('"#CDD1E3"') || svg.match(/<circle/g).length === 3);
  const dim = plot({ ...base, type: 'network', data: E([['a', 'b', 1], ['b', 'c', 1]]) });
  assert.equal(svg, dim);
});

test('chord: highlight inexistente se ignora', () => {
  const d = E([['a', 'b', 2], ['b', 'c', 1]]);
  assert.equal(plot({ ...base, type: 'chord', data: d, highlight: 'zzz' }), plot({ ...base, type: 'chord', data: d }));
});

test('sankey: tooltip de enlace en inglés con locale "en"', () => {
  const d = E([['a', 'b', 3], ['a', 'c', 1]]);
  assert.match(plot({ ...base, type: 'sankey', data: d, locale: 'en' }), /75% of a/);
  assert.match(plot({ ...base, type: 'sankey', data: d }), /75% de a/);
});

test('flujos degenerados no producen NaN ni cuelgan', () => {
  for (const type of ['network', 'chord', 'sankey']) {
    const svg = plot({ ...base, type, data: E([['a', 'b', 1]]) });
    assert.ok(!/NaN|undefined/.test(svg), type);
  }
  assert.throws(() => plot({ ...base, type: 'sankey', data: E([['a', 'b', 1], ['b', 'a', 1]]) }), /ciclo/);
});
