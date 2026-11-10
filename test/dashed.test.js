import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plot, safePlot } from '../src/index.js';
import { attachSource } from '../src/interact.js';
import { dashedMatcher } from '../src/dashed.js';
import { dashedGallery } from '../examples/specs-dashed.js';

const clean = (svg) => !/NaN|undefined|object Object|Infinity/.test(svg);
const count = (s, re) => (s.match(re) || []).length;

test('la galería punteada se dibuja en ambos temas y anchos', () => {
  for (const ex of dashedGallery) for (const theme of ['papel', 'noche']) for (const width of [720, 390]) {
    const svg = plot({ ...ex.spec, theme, width });
    assert.ok(clean(svg), `${ex.id} ${theme} ${width}`);
    assert.match(svg, /<pattern|stroke-dasharray/, ex.id);
  }
});

test('dashedMatcher: lista, campo, campo con valor y true', () => {
  const data = [{ c: 'A', f: true, e: 'est' }, { c: 'B', f: 'no', e: 'real' }];
  assert.ok(dashedMatcher({ dashed: ['A'] }, data, 'c')('A'));
  assert.ok(!dashedMatcher({ dashed: 'A' }, data, 'c')('B'));
  assert.ok(dashedMatcher({ dashed: 'f' }, data, 'c')('A'));
  assert.ok(!dashedMatcher({ dashed: 'f' }, data, 'c')('B'));
  assert.ok(dashedMatcher({ dashed: { field: 'e', equals: 'real' } }, data, 'c')('B'));
  assert.ok(dashedMatcher({ dashed: true }, data, 'c')('B'));
  assert.equal(dashedMatcher({}, data, 'c'), null);
});

test('barras: dashedFrom raya desde ese año y agrega la clave de leyenda', () => {
  const data = [2022, 2023, 2024, 2025, 2026].map((año, i) => ({ año, v: 10 + i }));
  const svg = plot({ type: 'bar', data, x: 'año', y: 'v', dashedFrom: 2025, dashedLabel: 'Estimado' });
  assert.equal(count(svg, /<path[^>]+data-dashed="1"/g), 2);
  assert.match(svg, /class="pa-key" data-color="dashed"/);
  assert.match(svg, /data-tip="2025&#10;|data-tip="2025\n|Estimado/);
  // Series: una serie entera punteada.
  const multi = plot({ type: 'bar', data: data.flatMap((r) => [{ ...r, s: 'Real' }, { ...r, s: 'Meta', v: r.v + 1 }]), x: 'año', y: 'v', series: 's', dashed: 'Meta' });
  assert.equal(count(multi, /<path[^>]+data-dashed="1"/g), 5);
});

test('líneas: tramo proyectado discontinuo, banda y puntos huecos', () => {
  const data = [2019, 2020, 2021, 2022, 2023, 2024].map((año, i) => ({ año, v: 5 + i }));
  const svg = plot({ type: 'line', data, x: 'año', y: 'v', dashedFrom: 2023, dashedLabel: 'Proyección', points: true });
  assert.equal(count(svg, /stroke-dasharray="5 6"/g), 1);
  assert.match(svg, />Proyección</);
  assert.match(svg, /2023 · Proyección/);
  const series = plot({ type: 'line', data: data.flatMap((r) => [{ ...r, s: 'A' }, { ...r, s: 'B', v: r.v * 2 }]), x: 'año', y: 'v', series: 's', dashed: 'B' });
  assert.equal(count(series, /stroke-dasharray="5 6"/g), 1);
  const area = plot({ type: 'area', data: data.flatMap((r) => [{ ...r, s: 'A' }, { ...r, s: 'B' }]), x: 'año', y: 'v', series: 's', dashedFrom: 2023 });
  assert.equal(count(area, /clip-path="url\(#pa-dash-[^"]+-r\)"/g), 2);
  assert.ok(clean(area));
});

test('dona: segmento punteado con rayado y muestra rayada en la tabla', () => {
  const svg = plot({ type: 'donut', data: [{ k: 'A', v: 5 }, { k: 'B', v: 3 }], label: 'k', value: 'v', dashed: 'B' });
  assert.equal(count(svg, /data-dashed="1"/g), 1);
  assert.ok(count(svg, /fill="url\(#pa-hatch-[^"]+-h0\)"/g) >= 2);
});

test('lint sugiere dashedLabel cuando falta', () => {
  const r = safePlot({ type: 'bar', data: [{ a: 'x', v: 1 }, { a: 'y', v: 2 }], x: 'a', y: 'v', dashed: 'y', title: 't', source: 's' });
  assert.ok(r.ok);
  assert.ok(r.suggestions.some((s) => s.code === 'dashed-label'));
});

test('attachSource es una función autocontenida (toHTML sin bundle)', () => {
  const fn = new Function(`return ${attachSource}`)();
  assert.equal(typeof fn, 'function');
});
