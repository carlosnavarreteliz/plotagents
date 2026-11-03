import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plot, safePlot, lint, describe, toHTML, schema, toolDefinition, squarify, formatNumber, formatCompact, makeFormat, PlotError } from '../src/index.js';
import { gallery } from '../examples/specs.js';

const ventas = [
  { region: 'Biobío', ventas: 1240 },
  { region: 'Ñuble', ventas: 610 },
  { region: 'Araucanía', ventas: 880 },
];

test('todos los ejemplos de la galería producen SVG válido', () => {
  for (const ex of gallery) {
    const svg = plot(ex.spec);
    assert.match(svg, /^<svg[^>]+viewBox="0 0 \d+ [\d.]+"/, ex.id);
    assert.ok(svg.endsWith('</svg>'), ex.id);
    assert.ok(!svg.includes('NaN'), `${ex.id} contiene NaN`);
    assert.ok(!svg.includes('undefined'), `${ex.id} contiene undefined`);
    assert.match(svg, /<desc[^>]*>[^<]+<\/desc>/, `${ex.id} sin descripción`);
  }
});

test('tipo automático según los datos', () => {
  assert.equal(safePlot({ data: ventas }).type, 'bar');
  assert.equal(safePlot({ data: [{ mes: '2024-01', v: 1 }, { mes: '2024-02', v: 2 }, { mes: '2024-03', v: 3 }] }).type, 'line');
  assert.equal(safePlot({ data: [{ a: 1.5, b: 2 }, { a: 2.5, b: 3 }] }).type, 'scatter');
  assert.equal(safePlot({ data: [{ source: 'A', target: 'B', v: 1 }] }).type, 'sankey');
  assert.equal(safePlot({ items: [{ label: 'x', value: 1 }] }).type, 'kpi');
});

test('error útil cuando falta un campo', () => {
  assert.throws(() => plot({ type: 'bar', data: ventas, x: 'comuna', y: 'ventas' }), (e) => e instanceof PlotError && /Campos disponibles: "region", "ventas"/.test(e.message));
  const r = safePlot({ type: 'bar', data: ventas, x: 'comuna', y: 'ventas' });
  assert.equal(r.ok, false);
  assert.equal(r.svg, null);
  assert.ok(r.errors[0].fix.includes('region'));
});

test('barras ordenadas de mayor a menor y etiquetadas', () => {
  const svg = plot({ type: 'bar', data: ventas, x: 'region', y: 'ventas' });
  const iB = svg.indexOf('>Biobío<'), iA = svg.indexOf('>Araucanía<'), iN = svg.indexOf('>Ñuble<');
  assert.ok(iB < iA && iA < iN);
  assert.ok(svg.includes('>1.240<'));
});

test('tabla ancha (y como lista) se convierte en series', () => {
  const data = [{ año: 2023, ingresos: 10, costos: 8 }, { año: 2024, ingresos: 12, costos: 9 }, { año: 2025, ingresos: 15, costos: 9 }];
  const svg = plot({ type: 'line', data, x: 'año', y: ['ingresos', 'costos'] });
  assert.ok(svg.includes('>Ingresos<') && svg.includes('>Costos<'));
});

test('lint sugiere y advierte', () => {
  const many = Array.from({ length: 6 }, (_, i) => [{ t: 2020, s: 'S' + i, v: i }, { t: 2021, s: 'S' + i, v: i + 1 }]).flat();
  const r = lint({ type: 'line', data: many, x: 't', y: 'v', series: 's' });
  assert.ok(r.warnings.some((w) => w.code === 'line-many'));
  assert.ok(r.suggestions.some((w) => w.code === 'title'));
  const d = lint({ type: 'donut', data: Array.from({ length: 9 }, (_, i) => ({ k: 'k' + i, v: i + 1 })) });
  assert.ok(d.warnings.some((w) => w.code === 'donut-slices'));
});

test('formato numérico en español', () => {
  assert.equal(formatNumber(1234567.891, 1), '1.234.567,9');
  assert.equal(formatNumber(-3.5, 1), '−3,5');
  assert.equal(formatCompact(1250000000), '1.250 M');
  assert.equal(formatCompact(12900), '13 mil');
  assert.equal(formatCompact(1290), '1,3 mil');
  assert.equal(makeFormat('percent', 'es', [0.25, 0.5])(0.561), '56,1%');
  assert.equal(makeFormat('percent', 'es', [25, 50])(56.1), '56,1%');
  assert.equal(makeFormat('currency', 'es', [18500])(18500), '$18.500');
  assert.equal(makeFormat(undefined, 'en', [1, 2])(1234.5), '1,235');
  assert.equal(makeFormat(undefined, 'en', [1, 2])(12.34), '12.3');
});

test('squarify conserva el área total', () => {
  const rects = squarify([{ value: 6 }, { value: 6 }, { value: 4 }, { value: 3 }, { value: 2 }, { value: 2 }, { value: 1 }], 0, 0, 600, 400);
  const area = rects.reduce((a, r) => a + r.w * r.h, 0);
  assert.ok(Math.abs(area - 240000) < 1e-6);
  for (const r of rects) assert.ok(r.x >= -1e-9 && r.y >= -1e-9 && r.x + r.w <= 600 + 1e-6 && r.y + r.h <= 400 + 1e-6);
});

test('describe, HTML, schema y definición de herramienta', () => {
  assert.match(describe({ type: 'bar', data: ventas, x: 'region', y: 'ventas' }), /Mayor: Biobío con 1\.240/);
  const html = toHTML([{ data: ventas, title: 'Uno' }, { data: ventas, title: 'Dos', theme: 'noche' }]);
  assert.ok(html.startsWith('<!doctype html>') && html.includes('pa-chart'));
  assert.equal(schema.required[0], 'data');
  assert.equal(toolDefinition().name, 'plot');
  assert.equal(toolDefinition({ flavor: 'openai' }).type, 'function');
});

test('el texto del usuario se escapa', () => {
  const svg = plot({ data: [{ k: '<script>alert(1)</script>', v: 1 }, { k: 'b & c', v: 2 }], title: 'A < B' });
  assert.ok(!svg.includes('<script>'));
  assert.ok(svg.includes('b &amp; c'));
});
