import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hist, kde, ecdf } from '../src/charts/dist.js';
import { regplot, residplot, jointplot } from '../src/charts/regplot.js';
import { themeFor } from '../src/theme.js';
import { statsGallery, notas, salarios, estudio, paisesSint } from '../examples/specs-stats.js';

const R = { hist, kde, ecdf, regplot, residplot, jointplot };
const draw = (s) => R[s.type](s, themeFor(s));

function valid(svg, id) {
  assert.match(svg, /^<svg[^>]+viewBox="0 0 \d+ [\d.]+"/, id);
  assert.ok(svg.endsWith('</svg>'), id);
  assert.ok(!/NaN|undefined|Infinity/.test(svg), `${id}: NaN/undefined/Infinity`);
  assert.match(svg, /<desc[^>]*>[^<]{20,}<\/desc>/, `${id}: sin descripción`);
}

test('galería estadística: SVG válido en ambos temas y anchos', () => {
  for (const ex of statsGallery) {
    for (const theme of ['papel', 'noche']) for (const width of [360, 720]) valid(draw({ ...ex.spec, theme, width }), `${ex.id}/${theme}/${width}`);
  }
});

test('variantes de histograma y densidad', () => {
  for (const multiple of ['layer', 'stack', 'dodge', 'fill']) valid(draw({ type: 'hist', data: notas, x: 'nota', hue: 'modalidad', multiple }), 'hist ' + multiple);
  for (const stat of ['count', 'percent', 'density', 'probability']) valid(draw({ type: 'hist', data: notas, x: 'nota', stat, kde: true }), 'hist ' + stat);
  valid(draw({ type: 'hist', data: notas, y: 'nota', element: 'step' }), 'hist horizontal step');
  valid(draw({ type: 'hist', data: salarios, x: 'sueldo', xScale: 'log', cumulative: true }), 'hist log cumulative');
  for (const multiple of ['layer', 'stack', 'fill']) valid(draw({ type: 'kde', data: salarios, x: 'sueldo', hue: 'area', multiple, rug: true }), 'kde ' + multiple);
  valid(draw({ type: 'kde', data: salarios, x: 'sueldo', cumulative: true, xScale: 'log' }), 'kde cumulative log');
  valid(draw({ type: 'ecdf', data: salarios, x: 'sueldo', hue: 'area', complementary: true }), 'ecdf');
});

test('variantes de regresión', () => {
  valid(draw({ type: 'regplot', data: estudio, x: 'horas', y: 'nota', order: 2 }), 'reg order 2');
  valid(draw({ type: 'regplot', data: estudio, x: 'horas', y: 'nota', lowess: true, scatter: false }), 'reg lowess');
  valid(draw({ type: 'regplot', data: paisesSint, x: 'ingreso', y: 'vida', hue: 'region', logx: true, annotate: true, locale: 'en' }), 'reg logx hue en');
  valid(draw({ type: 'residplot', data: estudio, x: 'horas', y: 'nota', lowess: true }), 'resid');
  valid(draw({ type: 'jointplot', data: paisesSint, x: 'ingreso', y: 'vida', hue: 'region', xScale: 'log', marginal: 'kde' }), 'joint kde');
});

test('leyenda por grupo (hue) y supresión con legend: false', () => {
  const svg = draw({ type: 'kde', data: salarios, x: 'sueldo', hue: 'area' });
  assert.ok(svg.includes('pa-legend') && svg.includes('>Tecnología<'));
  assert.ok(!draw({ type: 'kde', data: salarios, x: 'sueldo', hue: 'area', legend: false }).includes('pa-legend'));
});

test('dominios: overrides exactos y salida en _domains', () => {
  const s = { type: 'regplot', data: estudio, x: 'horas', y: 'nota', xDomain: [0, 20], yDomain: [1, 7], _domains: {} };
  draw(s);
  assert.deepEqual(s._domains, { x: [0, 20], y: [1, 7] });
  const h = { type: 'hist', data: notas, x: 'nota', _domains: {} };
  draw(h);
  assert.equal(h._domains.y[0], 0);
  const vs = notas.map((r) => r.nota);
  assert.ok(h._domains.x[0] <= Math.min(...vs) && h._domains.x[1] >= Math.max(...vs));
});

test('regresión correcta: pendiente y R² en la descripción', () => {
  const data = Array.from({ length: 20 }, (_, i) => ({ x: i, y: 2 * i + 1 }));
  const svg = draw({ type: 'regplot', data, x: 'x', y: 'y' });
  assert.match(svg, /R² 1,00/);
  assert.match(svg, /el ajuste sube/);
});

test('error útil cuando falta un campo', () => {
  assert.throws(() => draw({ type: 'hist', data: notas, x: 'puntaje' }), /Campos disponibles/);
  assert.throws(() => draw({ type: 'regplot', data: estudio, x: 'horas', y: 'promedio' }), /Campos disponibles/);
});
