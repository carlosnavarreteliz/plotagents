import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plot } from '../src/index.js';
import { prepareBar } from '../src/charts/bar.js';
import { buildHierarchy } from '../src/hierarchy.js';
import { thresholdOf } from '../src/other.js';

const regiones = [['Biobío', 1240], ['Ñuble', 800], ['Otros', 30], ['Araucanía', 600], ['Maule', 500], ['Aysén', 8], ['Magallanes', 6], ['Los Ríos', 5]]
  .map(([region, ventas]) => ({ region, ventas }));
const bar = (extra = {}) => prepareBar({ type: 'bar', data: regiones, x: 'region', y: 'ventas', ...extra });

test('umbral: acepta fracción, porcentaje y false', () => {
  assert.equal(thresholdOf({}), 0.01);
  assert.equal(thresholdOf({ threshold: 0.05 }), 0.05);
  assert.equal(thresholdOf({ threshold: '5%' }), 0.05);
  assert.equal(thresholdOf({ threshold: 5 }), 0.05);
  assert.equal(thresholdOf({ threshold: false }), 0);
});

test('barras: las categorías bajo el umbral van a "Otros", al final', () => {
  const m = bar();
  assert.deepEqual(m.cats, ['Biobío', 'Ñuble', 'Araucanía', 'Maule', 'Otros']);
  assert.equal(m.values.get('Otros')[0], 30 + 8 + 6 + 5);
  assert.deepEqual(m.otherMembers, ['Aysén', 'Magallanes', 'Los Ríos']);
});

test('barras: sin umbral, el "Otros" de los datos igual baja al final', () => {
  const m = bar({ threshold: false });
  assert.equal(m.cats.at(-1), 'Otros');
  assert.equal(m.values.get('Otros')[0], 30);
  assert.ok(m.cats.includes('Aysén'));
});

test('barras: highlight protege, otherLabel renombra, una sola chica no se agrupa', () => {
  const m = bar({ highlight: 'Aysén', otherLabel: 'Resto' });
  assert.ok(m.cats.includes('Aysén'));
  const solo = prepareBar({ type: 'bar', data: [{ k: 'a', v: 100 }, { k: 'b', v: 90 }, { k: 'c', v: 0.5 }], x: 'k', y: 'v' });
  assert.deepEqual(solo.cats, ['a', 'b', 'c']);
  const ren = prepareBar({ type: 'bar', data: [{ k: 'a', v: 100 }, { k: 'b', v: 0.5 }, { k: 'c', v: 0.4 }], x: 'k', y: 'v', otherLabel: 'Resto' });
  assert.deepEqual(ren.cats, ['a', 'Resto']);
});

test('barras: no agrupa medias ni ejes de tiempo', () => {
  const rows = [{ k: 'a', v: 100 }, { k: 'a', v: 90 }, { k: 'b', v: 0.5 }, { k: 'b', v: 0.6 }, { k: 'c', v: 0.4 }, { k: 'c', v: 0.3 }];
  assert.deepEqual(prepareBar({ type: 'barplot', data: rows, x: 'k', y: 'v', ci: true }).cats.sort(), ['a', 'b', 'c']);
  const years = [{ y: 2020, v: 100 }, { y: 2021, v: 0.2 }, { y: 2022, v: 0.1 }];
  assert.deepEqual(prepareBar({ type: 'bar', data: years, x: 'y', y: 'v' }).cats, ['2020', '2021', '2022']);
});

const prod = [['Minería', 'Cobre', 500], ['Minería', 'Litio', 120], ['Minería', 'Oro', 4], ['Minería', 'Plata', 3], ['Pesca', 'Salmón', 300], ['Forestal', 'Celulosa', 6], ['Turismo', 'Hoteles', 5]]
  .map(([sector, producto, valor]) => ({ sector, producto, valor }));

test('treemap: hermanos bajo el umbral → una hoja "Otros" al final de cada nivel', () => {
  const { root } = buildHierarchy({ data: prod, path: ['sector', 'producto'], value: 'valor' });
  assert.deepEqual(root.children.map((c) => c.name), ['Minería', 'Pesca', 'Otros']);
  const otros = root.children.at(-1);
  assert.equal(otros.value, 11);
  assert.deepEqual(otros.members.map((m) => m.name), ['Forestal', 'Turismo']);
  assert.deepEqual(root.children[0].children.map((c) => c.name), ['Cobre', 'Litio', 'Otros']);
  const off = buildHierarchy({ data: prod, path: ['sector', 'producto'], value: 'valor', threshold: false }).root;
  assert.equal(off.children.length, 4);
});

test('treemap: "Otros" va en gris, en la leyenda y con tooltip de lo que agrupa', () => {
  const svg = plot({ type: 'treemap', data: prod, path: ['sector', 'producto'], value: 'valor', title: 't', source: 's' });
  assert.ok(svg.includes('Otros 1,2%'), 'leyenda con participación');
  assert.ok(/data-tip="Otros[^"]*2 elementos: Forestal, Turismo/.test(svg));
});
