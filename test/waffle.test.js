import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plot, safePlot } from '../src/index.js';

const data = [{ s: 'Exact', n: 812 }, { s: 'Rounding', n: 290 }, { s: 'Discrepancy', n: 47 }];
const spec = { type: 'waffle', data, series: 's', value: 'n', width: 520, locale: 'en' };
const squaresOf = (svg) => (svg.match(/<path d="M[^"]*"/g) || []).map((p) => (p.match(/Z/g) || []).length);

test('waffle: one square per unit, largest first, legend with counts', () => {
  const rows = Array.from({ length: 30 }, (_, i) => ({ k: i < 20 ? 'A' : i < 27 ? 'B' : 'C' }));
  const svg = plot({ type: 'waffle', data: rows, series: 'k', locale: 'en' });
  assert.deepEqual(squaresOf(svg), [20, 7, 3]);
  assert.match(svg, />A · 20</);
  assert.match(svg, /data-tip="A\n20 \(66\.7%\)"/);
});

test('waffle: large totals get a round unit; squares sum to the rounded total', () => {
  const svg = plot(spec);
  assert.match(svg, />1 square = 5</);
  const sq = squaresOf(svg);
  assert.equal(sq.reduce((a, b) => a + b, 0), Math.round(1149 / 5));
  assert.match(svg, /data-tip="Discrepancy\n47 \(4\.1%\)\n9 × 5"/);
});

test('waffle: columns, order, facet, highlight', () => {
  const rows = Array.from({ length: 12 }, (_, i) => ({ k: i % 2 ? 'A' : 'B', g: i < 6 ? 'X' : 'Y' }));
  assert.match(plot({ type: 'waffle', data: rows, series: 'k', columns: 4, height: 200 }), /<svg/);
  const ord = plot({ type: 'waffle', data: rows, series: 'k', order: ['B', 'A'] });
  assert.ok(ord.indexOf('data-tip="B') < ord.indexOf('data-tip="A'));
  const fac = plot({ type: 'waffle', data: rows, series: 'k', facet: 'g' });
  assert.equal((fac.match(/data-pa-type="waffle"/g) || []).length >= 2, true);
  assert.match(plot({ ...spec, highlight: 'Exact' }), /#CDD1E3/i);
});

test('waffle: errors, skins, deterministic', () => {
  assert.equal(safePlot({ type: 'waffle', data: [{ s: 'a', n: 0 }], series: 's', value: 'n' }).ok, false);
  const sk = plot({ ...spec, skins: [{ palette: ['#6e86c8', '#d9714f', '#19a17d'] }, { when: 'html.classic', palette: ['#0b3f8c', '#d52b1e', '#1d7a74'] }] });
  assert.match(sk, /html\.classic \.pa-skin-[a-z0-9]+\{[^}]*#0b3f8c/);
  assert.equal(plot(spec), plot(spec));
});
