import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plot, safePlot } from '../src/index.js';

const data = Array.from({ length: 40 }, (_, i) => ({ n: 'U' + i, v: 400 + ((i * 37) % 600), t: i % 3 ? 'Private' : 'State' }));
const spec = { type: 'dotplot', data, x: 'v', label: 'n', series: 't', bin: 50, width: 640, locale: 'en' };

test('dotplot: one dot per row, stacked in bins, one tooltip each', () => {
  const svg = plot(spec);
  assert.equal((svg.match(/<circle[^>]*fill-opacity/g) || []).length, 40);
  assert.equal((svg.match(/class="pa-m"/g) || []).length, 40);
  assert.match(svg, /data-tip="U1\nv: 437\nt: Private"/);
  // Dots in the same bin share an x and stack upward.
  const cx = [...svg.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)"/g)].map((m) => [+m[1], +m[2]]);
  const byX = new Map();
  for (const [x, y] of cx) byX.set(x, [...(byX.get(x) || []), y]);
  assert.ok([...byX.values()].some((ys) => ys.length > 1 && new Set(ys).size === ys.length));
});

test('dotplot: custom ticks, highlight with a ring and the others lighter', () => {
  const svg = plot({ ...spec, ticks: [[500, '$500k'], [900, '$900k']], highlight: 'U7' });
  assert.match(svg, />\$500k</);
  assert.match(svg, />\$900k</);
  assert.match(svg, /stroke-width="1\.75"/);
  assert.match(svg, /fill-opacity="0\.3"/);
  assert.match(svg, />U7</);
});

test('dotplot: categories, bins count, aliases', () => {
  const cat = plot({ type: 'dotplot', data: [{ c: 'a' }, { c: 'a' }, { c: 'b' }], x: 'c' });
  assert.equal((cat.match(/<circle[^>]*fill-opacity/g) || []).length, 3);
  assert.match(plot({ type: 'dot-plot', data, x: 'v', bins: 10 }), /data-pa-type="dotplot"/);
  assert.equal(safePlot({ type: 'dotplot', data: [{ v: 'x' }], x: 'nope' }).ok, false);
});

test('dotplot: skins and determinism', () => {
  const sk = plot({ ...spec, skins: [{ palette: ['#6e86c8', '#d9714f'] }, { when: 'html.classic', palette: ['#0b3f8c', '#d52b1e'] }] });
  assert.match(sk, /html\.classic \.pa-skin-[a-z0-9]+\{[^}]*#0b3f8c/);
  assert.equal(plot(spec), plot(spec));
});
