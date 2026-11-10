import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plot } from '../src/index.js';
import { correlations } from '../src/charts/corr.js';

test('corr: p-value exacto (t de Student) como scipy', () => {
  // scipy.stats.pearsonr([1,2,3,4,5],[2,1,4,3,5]) -> r = 0.8, p = 0.10409
  const d = [[1, 2], [2, 1], [3, 4], [4, 3], [5, 5]].map(([a, b]) => ({ a, b }));
  const { r, p } = correlations(d, ['a', 'b']);
  assert.ok(Math.abs(r[0][1] - 0.8) < 1e-12);
  assert.ok(Math.abs(p[0][1] - 0.104088) < 1e-5);
  // n = 3, r = 0.5: t = 0.5774 con 1 gl -> p = 2/3
  const q = correlations([[1, 1], [2, 3], [3, 2]].map(([a, b]) => ({ a, b })), ['a', 'b']);
  assert.ok(Math.abs(q.p[0][1] - 2 / 3) < 1e-9);
});

test('corr: Spearman con empates promedia los rangos', () => {
  const d = [[1, 1], [2, 1], [2, 3], [3, 4], [4, 4]].map(([a, b]) => ({ a, b }));
  const { r } = correlations(d, ['a', 'b'], 'spearman');
  assert.ok(Math.abs(r[0][1] - 8.25 / Math.sqrt(9.5 * 9)) < 1e-12);
});

test('hist: un grupo sin valores > 0 en escala log no deja leyenda fantasma', () => {
  const data = [{ v: -1, g: 'neg' }, { v: 0, g: 'neg' }, { v: 1, g: 'pos' }, { v: 10, g: 'pos' }, { v: 100, g: 'pos' }];
  const svg = plot({ type: 'hist', x: 'v', hue: 'g', xScale: 'log', data, source: 'test', title: 't', stat: 'percent', commonNorm: false });
  assert.ok(!svg.includes('>neg<'));
  assert.ok(!/NaN|undefined/.test(svg));
});
