import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/geo/chile.js';
import '../src/geo/world.js';
import { choropleth, symbolMap, normKey, colorScale } from '../src/charts/choropleth.js';
import { getGeo, registerGeo, registeredGeo } from '../src/geo/registry.js';
import { fit, mercator, equalEarth, pathD, rings } from '../src/geo/projection.js';
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
  for (const [name, raw] of [['chile', mercator()], ['world', equalEarth()]]) {
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
