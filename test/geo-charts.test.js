import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/geo/chile.js';
import '../src/geo/world.js';
import '../src/geo/usa.js';
import { choropleth, symbolMap, normKey, colorScale } from '../src/charts/choropleth.js';
import { getGeo, registerGeo, registeredGeo } from '../src/geo/registry.js';
import { fit, mercator, equalEarth, albersUsa, pathD, rings } from '../src/geo/projection.js';
import { themeFor } from '../src/theme.js';
import { geoGallery } from '../examples/specs-geo.js';

const render = (s) => (s.type === 'symbolmap' ? symbolMap : choropleth)(s, themeFor(s));
const clean = (svg) => !/NaN|undefined|object Object|Infinity/.test(svg);

test('la galería de mapas se dibuja en ambos temas y anchos', () => {
  for (const ex of geoGallery) for (const theme of ['papel', 'noche']) for (const width of [720, 390]) {
    const svg = render({ ...ex.spec, theme, width });
    assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'), ex.id);
    assert.ok(clean(svg), `${ex.id} ${theme} ${width}`);
    assert.match(svg, /<desc[^>]*>[^<]+<\/desc>/);
  }
});

test('las 16 regiones de Chile coinciden con variantes comunes del nombre', () => {
  const variants = [
    'Arica y Parinacota', 'Región de Tarapacá', 'ANTOFAGASTA', 'Atacama', 'IV', 'Región de Valparaíso', 'RM', "Libertador General Bernardo O'Higgins",
    'Región del Maule', 'Nuble', 'Región del Bío-Bío', 'La Araucanía', 'Los Rios', 'X', 'Aisén', 'Magallanes y de la Antártica Chilena',
  ];
  const _unmatched = [];
  const svg = choropleth({ geo: 'chile', data: variants.map((r, i) => ({ r, v: i + 1 })), key: 'r', value: 'v', _unmatched }, themeFor({}));
  assert.deepEqual(_unmatched, []);
  assert.equal((svg.match(/class="pa-m" d=/g) || []).length, 16);
  assert.ok(!svg.includes('Sin dato'));
  for (const [a, b] of [['Región Metropolitana de Santiago', 'Metropolitana'], ['Biobío', 'Bio Bio'], ['Aysén', 'Aysen']]) assert.equal(normKey(a) === normKey(b) || ['metropolitanasantiago', 'metropolitana'].includes(normKey(a)), true);
});

test('países por ISO-3, nombre en español o en inglés; sin coincidencia se reporta', () => {
  const _unmatched = [];
  const svg = choropleth({ geo: 'world', data: [{ p: 'CHL', v: 1 }, { p: 'Alemania', v: 2 }, { p: 'United States', v: 3 }, { p: 'Japan', v: 4 }, { p: 'Atlantis', v: 5 }], key: 'p', value: 'v', _unmatched }, themeFor({}));
  assert.deepEqual(_unmatched, ['Atlantis']);
  assert.match(svg, /Sin coincidencia: Atlantis/);
  assert.ok(clean(svg));
});

test('la proyección ajustada cabe en el rectángulo', () => {
  for (const [name, raw] of [['chile', mercator()], ['world', equalEarth()], ['usa', albersUsa()]]) {
    const fc = getGeo(name);
    const box = [10, 20, 310, 420];
    const p = fit(fc.features, raw, box);
    for (const f of fc.features) for (const r of rings(f.geometry)) for (const pt of r) {
      const [x, y] = p(pt);
      assert.ok(x >= box[0] - 0.01 && x <= box[2] + 0.01 && y >= box[1] - 0.01 && y <= box[3] + 0.01, `${name} fuera del rectángulo`);
    }
    assert.ok(pathD(fc.features[0].geometry, p).startsWith('M'));
  }
});

test('escalas: cuantiles, cortes dados y divergente simétrica', () => {
  const t = themeFor({});
  const q = colorScale([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], {}, t);
  assert.equal(q.colors.length, q.breaks.length + 1);
  const th = colorScale([1, 5, 9], { scale: [3, 6] }, t);
  assert.deepEqual(th.breaks, [3, 6]);
  const d = colorScale([-3, -1, 0.5, 3.1], { midpoint: 0 }, t);
  assert.equal(d.colors.length % 2, 0);
  assert.ok(d.breaks.includes(0));
});

test('registro: GeoJSON propio y error útil', () => {
  const fc = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { name: 'A' }, geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] } }] };
  registerGeo('cuadrado', fc);
  assert.ok(registeredGeo().includes('cuadrado'));
  assert.ok(clean(choropleth({ geo: fc, data: [{ k: 'A', v: 1 }], key: 'k', value: 'v' }, themeFor({}))));
  assert.throws(() => getGeo('marte'), /Disponibles/);
});

test('EE. UU.: estados por sigla, nombre en inglés o español y FIPS; Puerto Rico solo con datos', () => {
  const keys = ['CA', 'Texas', 'Nueva York', 'north carolina', '06', 12, 'Washington DC', 'Hawái', 'Alaska', 'US-WA'];
  const _unmatched = [];
  const svg = choropleth({ geo: 'usa', data: keys.map((k, i) => ({ k, v: i + 1 })), key: 'k', value: 'v', _unmatched }, themeFor({}));
  assert.deepEqual(_unmatched, []);
  assert.ok(clean(svg));
  // 50 estados + DC; sin Puerto Rico porque no viene en los datos.
  assert.equal((svg.match(/class="pa-m" d=/g) || []).length, 51);
  const withPR = choropleth({ geo: 'usa', data: [{ k: 'PR', v: 1 }, { k: 'TX', v: 2 }], key: 'k', value: 'v' }, themeFor({}));
  assert.equal((withPR.match(/class="pa-m" d=/g) || []).length, 52);
  // Siglas dentro del mapa, estados chicos del noreste afuera y recuadros de Alaska y Hawái.
  assert.match(svg, />TX</);
  assert.match(svg, /class="pa-callouts/);
  assert.match(svg, /class="pa-insets"/);
  assert.match(svg, /class="pa-zoom" data-zoom="/);
});

test('albersUsa: Alaska y Hawái quedan en recuadros abajo a la izquierda', () => {
  const p = albersUsa();
  const [ak] = p([-150, 64]), [hi] = p([-157, 20.8]), [me] = p([-69, 45]), [wa, waY] = p([-120, 47.5]);
  const [, akY] = p([-150, 64]);
  assert.ok(ak < me && hi < me && akY > waY, 'Alaska debe ir abajo, no al noroeste');
  assert.ok(wa < me);
});

test('dashed en mapas: rayado por nombre o por campo, con clave de leyenda', () => {
  const data = [{ s: 'TX', v: 3, est: true }, { s: 'CA', v: 5, est: false }, { s: 'NY', v: 4, est: 'sí' }];
  for (const dashed of ['est', ['Texas', 'New York'], { field: 'est' }]) {
    const svg = choropleth({ geo: 'usa', data, key: 's', value: 'v', dashed, dashedLabel: 'Preliminar' }, themeFor({}));
    assert.equal((svg.match(/data-dashed="1"/g) || []).length, 2, JSON.stringify(dashed));
    assert.match(svg, /<pattern id="[^"]+-h0"/);
    assert.match(svg, /data-color="dashed"/);
    assert.match(svg, /Preliminar/);
  }
  const sym = symbolMap({ geo: 'usa', data, key: 's', value: 'v', dashed: 'est' }, themeFor({}));
  assert.equal((sym.match(/<circle[^>]+data-dashed="1"/g) || []).length, 2);
});

test('escala divergente: extremos simétricos en la leyenda', () => {
  const d = colorScale([-2.6, 1, 8.9], { midpoint: 0 }, themeFor({}));
  assert.equal(d.min, -d.max);
});
