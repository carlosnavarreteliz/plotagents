import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plot } from '../src/index.js';

const base = { source: 'illustrative data', title: 't', locale: 'en' };
const circles = (svg) => [...svg.matchAll(/<circle[^>]*cx="([\d.-]+)" cy="([\d.-]+)"/g)].map((m) => [+m[1], +m[2]]);
const rows = [...Array(40)].map((_, i) => ({ a: i, b: i * 2 + ((i * 7) % 11) }));

test('regplot: ci true / fracción usan el nivel 95%, no 1%', () => {
  const bandH = (ci) => {
    const s = plot({ ...base, type: 'regplot', data: rows, x: 'a', y: 'b', ci });
    const m = s.match(/<path d="(M[^"]+)" fill="[^"]+" fill-opacity="0.16"/);
    const ys = [...m[1].matchAll(/,(-?[\d.]+)/g)].map((x) => +x[1]);
    return Math.max(...ys) - Math.min(...ys);
  };
  const ref = bandH(95);
  assert.equal(bandH(true), ref);
  assert.equal(bandH(0.95), ref);
});

test('line: xDomain/yDomain recortan lo que queda fuera del área', () => {
  const s = plot({ ...base, type: 'line', xDomain: [2021, 2022], yDomain: [0, 5], data: [2019, 2020, 2021, 2022, 2023].map((x, i) => ({ x, y: i * 3 })), x: 'x', y: 'y' });
  assert.match(s, /clip-path="url\(#pa-clip-/);
  assert.match(s, /<clipPath id="pa-clip-/);
  assert.ok(!/NaN|undefined/.test(s));
});

test('scatter: puntos fuera de xDomain/yDomain no se dibujan fuera del SVG', () => {
  const s = plot({ ...base, type: 'scatter', xDomain: [2, 3], yDomain: [0, 5], data: [{ a: 1, b: 2 }, { a: 2.5, b: 3 }, { a: 9, b: 30 }], x: 'a', y: 'b' });
  const c = circles(s);
  assert.equal(c.length, 1);
  assert.ok(c.every(([x, y]) => x >= 0 && x <= 720 && y >= 0 && y <= 460));
});

test('regplot y jointplot: puntos fuera del dominio se omiten', () => {
  for (const type of ['regplot', 'jointplot']) {
    const s = plot({ ...base, type, xDomain: [10, 20], yDomain: [0, 50], data: rows, x: 'a', y: 'b' });
    assert.ok(circles(s).every(([x, y]) => x >= 0 && x <= 720 && y >= 0 && y <= 520), type);
  }
});

test('line: yScale log con un cero lo deja como hueco y mantiene la escala log', () => {
  const s = plot({ ...base, type: 'line', yScale: 'log', data: [{ x: 1, y: 0 }, { x: 2, y: 10 }, { x: 3, y: 1000 }], x: 'x', y: 'y' });
  assert.ok(!/NaN|undefined/.test(s));
  const labels = [...s.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);
  assert.ok(labels.includes('10') && labels.includes('100'), labels.join('|'));
});

test('line: yScale log con ci no produce NaN', () => {
  const data = [...Array(20)].map((_, i) => ({ x: 2000 + (i % 5), y: i % 7 === 0 ? 0.01 : 1 + (i % 4) }));
  const s = plot({ ...base, type: 'line', yScale: 'log', ci: true, data, x: 'x', y: 'y' });
  assert.ok(!/NaN|undefined/.test(s));
});
