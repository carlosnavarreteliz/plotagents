import test from 'node:test';
import assert from 'node:assert/strict';
import { plot, safePlot } from '../src/index.js';
import { countWords } from '../src/charts/wordcloud.js';

const base = { title: 'Un hallazgo', source: 'illustrative data' };

test('donut: sin valores positivos da un error claro, no un anillo vacío', () => {
  const r = safePlot({ ...base, type: 'donut', data: [{ a: 'x', v: 0 }, { a: 'y', v: -2 }], label: 'a', value: 'v' });
  assert.equal(r.ok, false);
  assert.throws(() => plot({ ...base, type: 'pie', data: [{ a: 'x', v: 0 }], label: 'a', value: 'v' }), /valores positivos/);
});

test('donut: una sola porción dibuja un círculo completo sin NaN', () => {
  const svg = plot({ ...base, type: 'donut', data: [{ a: 'x', v: 5 }], label: 'a', value: 'v' });
  assert.ok(!/NaN|undefined/.test(svg));
});

for (const type of ['treemap', 'sunburst']) {
  test(`${type}: focus sobre una hoja no deja el gráfico vacío`, () => {
    const data = [{ r: 'A', g: 'x', v: 5 }, { r: 'A', g: 'y', v: 2 }, { r: 'B', g: 'x', v: 3 }];
    const leaf = plot({ ...base, type, data, path: ['r', 'g'], value: 'v', focus: ['A', 'x'] });
    const parent = plot({ ...base, type, data, path: ['r', 'g'], value: 'v', focus: ['A'] });
    assert.ok(!/NaN|undefined/.test(leaf));
    assert.ok(leaf.includes('>A<'), 'migas del padre');
    assert.equal((leaf.match(/class="pa-m"/g) || []).length, (parent.match(/class="pa-m"/g) || []).length);
  });
}

test('wordcloud: palabras vacías de pt/fr/de y sin tildes', () => {
  const w = (t, locale) => countWords(t, { locale }).map((x) => x.text);
  assert.deepEqual(w('tambien casa también', 'es'), ['casa']);
  assert.deepEqual(w('não casa uma', 'pt'), ['casa']);
  assert.deepEqual(w('les maison pour', 'fr'), ['maison']);
  assert.deepEqual(w('und Haus nicht', 'de'), ['Haus']);
});

test('wordcloud: la misma palabra en dos series se conserva en ambas', () => {
  const svg = plot({ ...base, type: 'wordcloud', data: [{ w: 'agua', s: 'g1', n: 5 }, { w: 'agua', s: 'g2', n: 3 }], text: 'w', value: 'n', series: 's' });
  assert.equal((svg.match(/>agua</g) || []).length, 2);
});
