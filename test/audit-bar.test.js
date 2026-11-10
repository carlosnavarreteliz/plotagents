import test from 'node:test';
import assert from 'node:assert/strict';
import { plot } from '../src/index.js';

const base = { title: 't', source: 's' };
const texts = (svg) => [...svg.matchAll(/<text([^>]*)>([^<]*)<\/text>/g)].map((m) => ({ y: +m[1].match(/ y="([^"]+)"/)[1], t: m[2] }));

test('kpi: valor no numérico con meta no produce NaN', () => {
  const svg = plot({ ...base, type: 'kpi', items: [{ label: 'a', value: 'x', target: 0 }] });
  assert.ok(!/NaN|undefined/.test(svg));
});

test('bar: etiqueta de barra negativa no pisa la etiqueta de categoría', () => {
  const svg = plot({ ...base, type: 'bar', data: [{ a: 'x', v: -5 }, { a: 'y', v: -2 }], x: 'a', y: 'v' });
  const ts = texts(svg);
  const val = ts.find((t) => t.t === '−5'), cat = ts.find((t) => t.t === 'x');
  assert.ok(cat.y - val.y >= 12, `etiqueta ${val.y} vs categoría ${cat.y}`);
});

test('bar: highlight sobre una serie atenúa las demás en barras agrupadas', () => {
  const data = [{ a: 'x', s: 'p', v: 3 }, { a: 'y', s: 'p', v: 2 }, { a: 'x', s: 'q', v: 3 }];
  const svg = plot({ ...base, type: 'bar', data, x: 'a', y: 'v', series: 's', highlight: 'q' });
  assert.ok(svg.includes('#CDD1E3'));
});
