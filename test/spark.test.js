import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plot, safePlot } from '../src/index.js';

const data = [2019, 2020, 2021, 2022, 2023].map((y, i) => ({ y, v: [10, 12, null, 11, 15][i] }));
const skins = [{ palette: ['#6e86c8'] }, { when: 'html.classic', palette: ['#0b3f8c'] }];

test('spark: any size, no chrome, own min–max scale', () => {
  const svg = plot({ type: 'spark', data, x: 'y', y: 'v', width: 108, height: 26, title: 'Sube', source: 'X' });
  assert.match(svg, /viewBox="0 0 108 26"/);
  assert.doesNotMatch(svg, /<text/); // no title, axes, labels or source drawn
  assert.match(svg, /aria-label="Sube"/); // the title stays for screen readers
  assert.ok(!/<title/.test(svg), 'no <title>: it would show a native tooltip over ours');
  // Min–max: the lowest point sits at the bottom edge of the plot area, the highest at the top.
  const ys = [...svg.matchAll(/[ML]([\d.]+),([\d.]+)/g)].map((m) => +m[2]);
  assert.ok(Math.max(...ys) > 20 && Math.min(...ys) < 6);
});

test('spark: a null is a gap, the end dot marks the last value', () => {
  const svg = plot({ type: 'spark', data, x: 'y', y: 'v', width: 120, height: 30 });
  assert.equal((svg.match(/<path d="M[^"]*"[^>]*stroke=/g) || [])[0].split('M').length - 1, 2);
  assert.equal((svg.match(/<circle/g) || []).length, 1);
});

test('spark: one tooltip per x, shared scale for series', () => {
  const svg = plot({ type: 'spark', data, x: 'y', y: 'v', width: 120, height: 30, locale: 'en' });
  assert.equal((svg.match(/class="pa-m"/g) || []).length, 5);
  assert.match(svg, /data-tip="2021\n—"/);
  const two = plot({ type: 'spark', width: 120, height: 30, data: [1, 2, 3].flatMap((x) => [{ x, s: 'a', v: x }, { x, s: 'b', v: 4 - x }]), x: 'x', y: 'v', series: 's' });
  assert.equal((two.match(/stroke-linecap="round"/g) || []).length, 2);
  assert.match(two, /data-tip="1\na: 1\nb: 3"/);
});

test('spark: fill, aliases, skins, determinism', () => {
  assert.match(plot({ type: 'sparkline', data, x: 'y', y: 'v', fill: true }), /fill-opacity/);
  assert.match(plot({ type: 'spark', data, x: 'y', y: 'v', skins }), /html\.classic \.pa-skin-[a-z0-9]+\{[^}]*#0b3f8c/);
  assert.equal(plot({ type: 'spark', data, x: 'y', y: 'v' }), plot({ type: 'spark', data, x: 'y', y: 'v' }));
  assert.equal(safePlot({ type: 'spark', data, x: 'y', y: 'v' }).ok, true);
});
