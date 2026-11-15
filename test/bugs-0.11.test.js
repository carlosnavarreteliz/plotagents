// Regresiones de la caza de bugs 0.11: entradas hostiles pero plausibles.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plot, safePlot } from '../src/index.js';

const rows = [{ a: 'x', v: 5 }, { a: 'y', v: 3 }];
const noBad = (svg) => assert.ok(!/NaN|Infinity|undefined|\[object Object\]/.test(svg.replace(/<style[\s\S]*?<\/style>/g, '')));

test('pirámide con etiquetas de edad larguísimas no deja barras de ancho negativo', () => {
  const long = 'x'.repeat(300);
  const svg = plot({ type: 'pyramid', data: [{ age: long, sex: 'M', v: 5 }, { age: long, sex: 'F', v: 4 }, { age: 'y', sex: 'M', v: 1 }], age: 'age', sex: 'sex', value: 'v' });
  assert.ok(!/ (width|height)="-/.test(svg));
  assert.ok(svg.includes('…'));
});

test('pirámide: nombres de grupo largos se recortan', () => {
  const svg = plot({ type: 'pyramid', data: [{ age: '0-4', sex: 'Hombres ' + 'z'.repeat(200), v: 5 }, { age: '0-4', sex: 'Mujeres', v: 4 }], age: 'age', sex: 'sex', value: 'v' });
  assert.ok(!/<text[^>]*>[^<]*z{50}/.test(svg));
});

test('refLines con y no numérico no dibuja NaN', () => {
  noBad(plot({ type: 'bar', data: rows, x: 'a', y: 'v', refLines: [{ y: 'abc' }, { y: 4, label: 'Meta' }] }));
  noBad(plot({ type: 'bar', data: rows, x: 'a', y: 'v', refLines: [{ x: 'abc', y: 'abc' }] }));
});

test('refLines y annotations de forma rara no lanzan TypeError en plot()', () => {
  const d = [{ a: '2020', v: 1 }, { a: '2021', v: 3 }];
  for (const type of ['bar', 'line', 'area', 'countplot']) {
    for (const k of ['refLines', 'annotations']) {
      for (const v of ['x', true, 5, [null], [{ x: '2020' }, null]]) {
        assert.doesNotThrow(() => plot({ type, data: d, x: 'a', y: 'v', [k]: v }), `${type} ${k} ${JSON.stringify(v)}`);
      }
    }
  }
  assert.doesNotThrow(() => plot({ type: 'gantt', data: [{ task: 'a', start: '2020-01-01', end: '2020-02-01' }], refLines: [null, 5] }));
  assert.doesNotThrow(() => plot({ type: 'line', data: [{ a: 1, v: 1, f: 'p' }, { a: 2, v: 2, f: 'p' }], x: 'a', y: 'v', facet: 'f', annotations: [null, { x: 1 }] }));
});

test('facet: filas sin valor van a un panel "(sin dato)", no a "null"/"undefined"', () => {
  const svg = plot({ type: 'bar', data: [{ a: 'x', v: 1, f: null }, { a: 'y', v: 2 }, { a: 'z', v: 3, f: 'q' }], x: 'a', y: 'v', facet: 'f' });
  assert.ok(svg.includes('(sin dato)'));
  assert.ok(!/>(null|undefined)</.test(svg));
  assert.ok(!/: null|undefined/.test(svg.match(/<desc[^<]*/)[0]));
});

test('barras 100% apiladas: la descripción no dice "400%"', () => {
  const svg = plot({ type: 'bar', data: [{ a: 'x', v: 1, s: 'p' }, { a: 'x', v: 3, s: 'q' }], x: 'a', y: 'v', series: 's', stack: 'percent' });
  const desc = svg.match(/<desc[^<]*/)[0];
  assert.ok(!desc.includes('400%'));
  assert.ok(desc.includes('100%'));
});

test('kpi y waffle: columns 0, negativo o no numérico usan el valor por defecto', () => {
  for (const columns of [0, -2, 'a', [], [1, 2], NaN]) {
    const k = plot({ type: 'kpi', items: [{ label: 'a', value: 1 }, { label: 'b', value: 2 }], columns });
    assert.match(k, /viewBox="0 0 720 \d+/, `kpi ${JSON.stringify(columns)}`);
    noBad(k);
    noBad(plot({ type: 'waffle', data: [{ s: 'a', v: 3 }, { s: 'b', v: 2 }], series: 's', value: 'v', columns }));
  }
  assert.doesNotThrow(() => plot({ type: 'kpi', columns: [] }));
});

test('sunburst/treemap: focus que no es lista no lanza TypeError', () => {
  const data = [{ a: 'x', b: 'p', v: 1 }, { a: 'y', b: 'q', v: 2 }];
  for (const focus of [{ a: 1 }, 5, 'x', null]) assert.doesNotThrow(() => plot({ type: 'sunburst', data, path: ['a', 'b'], value: 'v', focus }), JSON.stringify(focus));
});

test('top ≤ 0 o no numérico se ignora (bar, wordcloud, bump)', () => {
  const d = [{ a: 'a', v: 1 }, { a: 'b', v: 3 }, { a: 'c', v: 2 }];
  for (const top of [-1, 0, 'x']) {
    const svg = plot({ type: 'bar', data: d, x: 'a', y: 'v', top });
    assert.ok(!svg.includes('Otros'), `bar top ${top}`);
    const wc = plot({ type: 'wordcloud', data: d.map((r) => ({ word: r.a, n: r.v })), text: 'word', value: 'n', top });
    assert.ok(wc.includes('>a<') || wc.includes('>b<'), `wordcloud top ${top}`);
    const bd = [{ x: '1', y: 1, s: 'a' }, { x: '2', y: 2, s: 'a' }, { x: '1', y: 2, s: 'b' }, { x: '2', y: 1, s: 'b' }];
    const bump = (t) => plot({ type: 'bump', data: bd, x: 'x', y: 'y', series: 's', top: t }).replace(/pa\w+-/g, '');
    assert.equal(bump(top), bump(undefined), `bump top ${top}`);
  }
  assert.ok(plot({ type: 'bar', data: d, x: 'a', y: 'v', top: 2 }).includes('Otros'));
});

test('flowchart: etiqueta de arista larguísima se recorta', () => {
  const svg = plot({ type: 'flowchart', nodes: [{ id: 'a' }, { id: 'b' }], edges: [{ from: 'a', to: 'b', label: 'Etiqueta ' + 'larga '.repeat(40) }] });
  assert.ok(svg.includes('…'));
  assert.ok(safePlot({ type: 'flowchart', nodes: [{ id: 'a' }, { id: 'b' }], edges: [{ from: 'a', to: 'b', label: 'ok' }] }).ok);
});

test('kpi: columns enorme no deja tarjetas con ancho negativo', () => {
  const svg = plot({ type: 'kpi', items: [{ label: 'a', value: 1 }, { label: 'b', value: 2 }], columns: 1e6 });
  assert.ok(!/(width|height)="-/.test(svg));
  noBad(svg);
});

test('categorías vacías van en "(sin dato)", sin tocar los datos', () => {
  const d = [{ c: 'a', s: 'x', v: 3 }, { c: null, s: 'y', v: 2 }, { c: 'b', s: '', v: 4 }];
  for (const type of ['bar', 'donut', 'radar', 'heatmap', 'line'])
    assert.ok(!/>null<|"null"/.test(plot({ type, data: d, x: 'c', y: type === 'heatmap' ? 's' : 'v', value: 'v', label: 'c', axis: 'c', series: type === 'donut' || type === 'heatmap' ? undefined : 's' })), type);
  assert.ok(plot({ type: 'sankey', data: [{ from: 'a', to: null, value: 2 }, { from: 'a', to: 'b', value: 1 }] }).includes('(sin dato)'));
  assert.ok(plot({ type: 'bar', data: d, x: 'c', y: 'v', locale: 'en' }).includes('(no data)'));
  assert.equal(d[1].c, null);
});

test('lienzo diminuto: ningún ancho o alto negativo', () => {
  const svg = plot({ type: 'box', data: [{ c: 'a', v: 1, s: 'x' }, { c: 'b', v: 2, s: 'y' }], x: 'c', y: 'v', series: 's', width: 60, height: 40, title: 'Un título bastante largo', subtitle: 'sub', source: 'src' });
  assert.ok(!/(width|height)="-/.test(svg));
});
