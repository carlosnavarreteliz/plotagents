import test from 'node:test';
import assert from 'node:assert/strict';
import { plot } from '../src/index.js';
import '../src/geo/chile.js';
import { normKey } from '../src/charts/choropleth.js';
import { makeProjection } from '../src/geo/projection.js';

test('normKey: los códigos con cero a la izquierda calzan ("08" = 8)', () => {
  assert.equal(normKey('08'), normKey(8));
  assert.equal(normKey('004'), '4');
  assert.equal(normKey('0'), '0');
  assert.equal(normKey('Región del Biobío'), 'biobio');
});

test('choropleth: región de Chile por código "08" y por nombre sin tilde', () => {
  const spec = { type: 'choropleth', geo: 'chile', title: 't', source: 's', key: 'k', value: 'v', _unmatched: [],
    data: [{ k: '08', v: 1 }, { k: 'Nuble', v: 2 }, { k: 'Bío-Bío', v: 3 }] };
  plot(spec);
  assert.deepEqual(spec._unmatched, []);
});

test('makeProjection: el nombre no distingue mayúsculas ni guiones', () => {
  for (const n of ['equalearth', 'EqualEarth', 'Equal-Earth', 'albersusa', 'MERCATOR']) assert.equal(typeof makeProjection(n), 'function', n);
  assert.equal(makeProjection('nada'), null);
});

test('choropleth: un geo sin geometrías da un error claro, no un SVG con NaN', () => {
  assert.throws(() => plot({ type: 'choropleth', title: 't', source: 's', geo: { type: 'FeatureCollection', features: [] }, data: [{ n: 'a', v: 1 }], key: 'n', value: 'v' }), /geometr/);
});

test('pointmap: cientos de miles de puntos no desbordan la pila', () => {
  const data = Array.from({ length: 140000 }, (_, i) => ({ lon: -75 + (i % 1000) / 100, lat: -40 + (i % 777) / 100, s: i % 9, v: i % 5 }));
  const svg = plot({ type: 'pointmap', title: 't', source: 's', data, size: 's', value: 'v', tiles: false });
  assert.ok(!/NaN|undefined/.test(svg.slice(0, 5000)));
});
