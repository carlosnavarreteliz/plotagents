import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plot } from '../src/index.js';

const texts = (svg) => [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);

test('tabla: el total de un avance con meta suma (gasto vs presupuesto), no promedia', () => {
  const svg = plot({
    type: 'table', title: 't', source: 'x', total: true,
    data: [{ p: 'A', gasto: 50, presupuesto: 100 }, { p: 'B', gasto: 150, presupuesto: 100 }],
    columns: ['p', { field: 'gasto', type: 'progress', target: 'presupuesto', good: 'down' }, 'presupuesto'],
  });
  const t = texts(svg);
  const i = t.indexOf('Total');
  assert.deepEqual(t.slice(i + 1, i + 3), ['200', '200']);
});

test('tabla: `total` en una columna basta para mostrar la fila de totales', () => {
  const svg = plot({ type: 'table', title: 't', source: 'x', data: [{ k: 'a', v: 1, w: 2 }, { k: 'b', v: 2, w: 3 }, { k: 'c', v: 3, w: 4 }], columns: ['k', { field: 'v', total: 'sum' }, 'w'] });
  const t = texts(svg);
  assert.equal(t[t.indexOf('Total') + 1], '6');
});

test('tabla: "Varieties" no se confunde con una variación (delta)', () => {
  const svg = plot({ type: 'table', title: 't', source: 'x', data: [{ k: 'a', Varieties: 3 }, { k: 'b', Varieties: 5 }, { k: 'c', Varieties: 2 }] });
  assert.ok(!texts(svg).some((s) => s.startsWith('+')));
});

test('tabla: "var_ventas" y "dif" siguen siendo deltas', () => {
  const svg = plot({ type: 'table', title: 't', source: 'x', data: [{ k: 'a', var_ventas: 3 }, { k: 'b', var_ventas: -5 }, { k: 'c', var_ventas: 2 }] });
  assert.ok(texts(svg).includes('+3'));
});
