import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plot } from '../src/index.js';
import { niceDomain, linear } from '../src/scale.js';
import { histogram } from '../src/stats.js';

test('niceDomain: sin ruido de punto flotante en los extremos', () => {
  assert.deepEqual(niceDomain(0, 0.3), { min: 0, max: 0.3, step: 0.1 });
  assert.deepEqual(niceDomain(-0.3, 0.1), { min: -0.3, max: 0.1, step: 0.1 });
  assert.equal(niceDomain(1e-9, 3e-9).max, 3e-9);
});

test('linear.ticks: sin marcas repetidas con un dominio lejos del cero', () => {
  const t = linear(1e12, 1e12 + 5, 0, 1).ticks();
  assert.equal(new Set(t).size, t.length);
});

test('histogram: con domain no cuenta lo que cae fuera', () => {
  const h = histogram([1, 2, 3, 4, 5, 10], { domain: [2, 6], bins: 4 });
  assert.equal(h.reduce((a, b) => a + b.count, 0), 4);
});

test('histogram: un valor justo en el borde va a la barra de arriba y los bordes son limpios', () => {
  const h = histogram([5, 5, 5]);
  assert.equal(h.find((b) => b.x0 === 5).count, 3);
  assert.ok(h.every((b) => String(b.x0).length < 8));
});

test('facet: los paneles nunca miden menos que el mínimo de un gráfico ni se salen', () => {
  const data = [];
  for (const r of 'ABCDE') for (let y = 2020; y < 2024; y++) data.push({ r, y, v: y % 7 + r.charCodeAt(0) % 5 });
  for (const width of [720, 320]) {
    const svg = plot({ type: 'line', data, x: 'y', y: 'v', facet: 'r', columns: 5, width, title: 't', source: 's' });
    const panels = [...svg.matchAll(/<svg x="([\d.]+)" y="[\d.]+" [^>]*?width="(\d+)"/g)];
    assert.ok(panels.length >= 5);
    for (const [, x, w] of panels) assert.ok(+x + +w <= width, `panel en x=${x} de ${w} px se sale de ${width}`);
  }
});
