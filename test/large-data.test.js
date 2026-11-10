import test from 'node:test';
import assert from 'node:assert/strict';
import { plot } from '../src/index.js';

// `Math.min(...vs)` and `push(...marks)` overflow the stack at ~150k values.
const N = 200000;
const rows = Array.from({ length: N }, (_, i) => ({ g: 'ABCD'[i % 4], v: Math.sin(i) * 100 + i / 1000 }));

for (const spec of [{ type: 'strip', x: 'g', y: 'v' }, { type: 'violin', x: 'g', y: 'v' }, { type: 'dotplot', x: 'v' }]) {
  test(`${spec.type}: ${N} rows render without overflowing the stack`, () => {
    const svg = plot({ ...spec, data: rows, title: 'Values rise 200 points', source: 'illustrative data', locale: 'en' });
    assert.match(svg, /^<svg/);
  });
}
