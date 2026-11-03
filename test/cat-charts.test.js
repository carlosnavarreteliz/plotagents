import { test } from 'node:test';
import assert from 'node:assert/strict';
import { box, violin, strip, swarm, point, beeswarm } from '../src/charts/categorical.js';
import { radar } from '../src/charts/radar.js';
import { themeFor } from '../src/theme.js';
import { catGallery } from '../examples/specs-cat.js';

const F = { box, violin, strip, swarm, point, radar };
const draw = (spec) => F[spec.type](spec, themeFor(spec));

const valid = (svg, id) => {
  assert.match(svg, /^<svg[^>]+viewBox="0 0 \d+ [\d.]+"/, id);
  assert.ok(svg.endsWith('</svg>'), id);
  assert.ok(!svg.includes('NaN'), `${id} contiene NaN`);
  assert.ok(!svg.includes('undefined'), `${id} contiene undefined`);
  assert.match(svg, /<desc[^>]*>[^<]{20,}<\/desc>/, `${id} sin descripción`);
};

test('galería categórica: SVG válido en papel, noche y ancho de teléfono', () => {
  for (const ex of catGallery) {
    for (const theme of ['papel', 'noche']) for (const width of [720, 380]) valid(draw({ ...ex.spec, theme, width }), `${ex.id}/${theme}/${width}`);
  }
});

const rows = [];
for (const [g, mu] of [['A', 10], ['B', 14], ['C', 8]]) for (let i = 0; i < 30; i++) rows.push({ g, h: i % 2 ? 'x' : 'y', v: mu + ((i * 37) % 11) - 5 });

test('box, violin, strip, swarm y point con hue, orientación y log', () => {
  for (const type of ['box', 'violin', 'strip', 'swarm', 'point']) {
    valid(draw({ type, data: rows, x: 'g', y: 'v' }), type);
    valid(draw({ type, data: rows, x: 'g', y: 'v', hue: 'h' }), `${type}+hue`);
    valid(draw({ type, data: rows, x: 'v', y: 'g' }), `${type}+horizontal`);
    valid(draw({ type, data: rows, x: 'g', y: 'v', yScale: 'log', locale: 'en' }), `${type}+log`);
  }
  valid(draw({ type: 'violin', data: rows, x: 'g', y: 'v', hue: 'h', split: true, inner: 'quartiles' }), 'violin split');
  valid(draw({ type: 'point', data: rows, x: 'g', y: 'v', estimator: 'median', errorbar: 'sd' }), 'point median');
});

test('yDomain se respeta y _domains informa el dominio usado; legend: false', () => {
  const _domains = {};
  const svg = draw({ type: 'box', data: rows, x: 'g', y: 'v', hue: 'h', yDomain: [0, 30], _domains, legend: false });
  assert.deepEqual(_domains.y, [0, 30]);
  assert.ok(!svg.includes('pa-legend'));
  const d2 = {};
  draw({ type: 'strip', data: rows, x: 'v', y: 'g', _domains: d2 });
  assert.equal(d2.y.length, 2);
});

test('error útil con campo inexistente', () => {
  assert.throws(() => draw({ type: 'box', data: rows, x: 'grupo', y: 'v' }), /Campos disponibles/);
});

test('beeswarm no superpone puntos', () => {
  const pos = Array.from({ length: 80 }, (_, i) => 100 + ((i * 13) % 40));
  const r = 4;
  const off = beeswarm(pos, r);
  for (let i = 0; i < pos.length; i++) for (let j = i + 1; j < pos.length; j++) {
    assert.ok(Math.hypot(pos[i] - pos[j], off[i] - off[j]) >= 2 * r - 1e-6);
  }
});

test('radar en formato ancho y normalizado', () => {
  const wide = [{ nombre: 'A', vel: 10, fuerza: 200, precision: 0.8 }, { nombre: 'B', vel: 14, fuerza: 120, precision: 0.6 }];
  const svg = draw({ type: 'radar', data: wide, axes: ['vel', 'fuerza', 'precision'], label: 'nombre', normalize: true });
  valid(svg, 'radar wide');
  assert.ok(svg.includes('fuerza: 200'));
});
