import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plot, safePlot, lint, resolve, schema } from '../src/index.js';
import { correlations, clusterTree } from '../src/charts/corr.js';
import { statsGallery, barrios } from '../examples/specs-stats.js';

function valid(svg, id) {
  assert.match(svg, /^<svg[^>]+viewBox="0 0 \d+ [\d.]+"/, id);
  assert.ok(svg.endsWith('</svg>'), id);
  assert.ok(!/NaN|undefined|Infinity/.test(svg), `${id}: NaN/undefined/Infinity`);
  assert.match(svg, /<desc[^>]*>[^<]{20,}<\/desc>/, `${id}: sin descripción`);
}

const rows = [
  { a: 1, b: 2, c: 9, d: 5, g: 'x' }, { a: 2, b: 4, c: 7, d: 5, g: 'y' }, { a: 3, b: 6, c: 8, d: 5, g: 'x' },
  { a: 4, b: 8, c: 4, d: 5, g: 'y' }, { a: 5, b: 11, c: 2, d: 5, g: 'x' }, { a: 6, b: 12, c: null, d: 5, g: 'y' },
];

test('correlations: Pearson, Spearman, casos completos por par y columnas constantes', () => {
  const { r, n, p } = correlations(rows, ['a', 'b', 'c', 'd']);
  assert.ok(Math.abs(r[0][1] - 0.9948) < 1e-3);
  assert.equal(r[0][1], r[1][0]);
  assert.equal(n[0][2], 5); // c tiene un vacío
  assert.ok(r[0][2] < -0.9);
  assert.ok(Number.isNaN(r[0][3]) && Number.isNaN(r[3][3]), 'd no varía');
  assert.ok(p[0][1] < 0.01);
  const s = correlations(rows, ['a', 'b'], 'spearman');
  assert.equal(s.r[0][1], 1); // monótona → ρ = 1
});

test('clusterTree: junta primero las variables más correlacionadas', () => {
  const r = [[1, 0.9, 0.1], [0.9, 1, 0.2], [0.1, 0.2, 1]];
  const t = clusterTree(r);
  const inner = t.left.left ? t.left : t.right;
  assert.deepEqual([...inner.members].sort(), [0, 1]);
});

test('galería: corr, clustermap y pairplot válidos en temas, anchos e idiomas', () => {
  for (const ex of statsGallery.filter((e) => ['corr', 'clustermap', 'pairplot'].includes(e.spec.type))) {
    for (const theme of ['papel', 'noche']) for (const width of [360, 720, 1200]) {
      const r = safePlot({ ...ex.spec, theme, width });
      assert.ok(r.ok, `${ex.id}: ${JSON.stringify(r.errors)}`);
      assert.equal(r.warnings.length, 0, `${ex.id}: ${JSON.stringify(r.warnings)}`);
      valid(r.svg, `${ex.id}/${theme}/${width}`);
    }
    valid(plot({ ...ex.spec, locale: 'en' }), ex.id + '/en');
  }
});

test('corr: triángulo inferior por defecto, completo con cluster, y dendrograma', () => {
  const vars = ['ingreso', 'escolaridad', 'pobreza', 'densidad'];
  const cells = (svg) => (svg.match(/class="pa-m"/g) || []).length;
  const lower = plot({ type: 'corr', data: barrios, vars });
  assert.equal(cells(lower), 6); // k(k−1)/2
  const full = plot({ type: 'corr', data: barrios, vars, triangle: 'full' });
  assert.equal(cells(full), 16);
  const cm = plot({ type: 'clustermap', data: barrios, vars });
  assert.equal(cells(cm), 16);
  assert.match(cm, /<path d="M[^"]+V[^"]+H/, 'dendrograma');
  assert.match(cm, /agrupamiento jerárquico/);
  assert.doesNotMatch(plot({ type: 'corr', data: barrios, vars, cluster: true, dendrogram: false }), /<path d="M[^"]+V[^"]+H/);
});

test('corr: descripción con el par más fuerte de cada signo y formato del idioma', () => {
  const r = safePlot({ type: 'correlation', data: rows, vars: ['a', 'b', 'c'], locale: 'en', title: 't', source: 's' });
  assert.equal(r.type, 'corr');
  assert.match(r.description, /Strongest positive: A and B \(1\.00\)/);
  assert.match(r.description, /Strongest negative: B and C \(−0\.93\)/);
  const es = plot({ type: 'corr', data: rows, vars: ['a', 'c'] });
  assert.match(es, /−0,92/);
});

test('corr: alpha apaga lo no significativo y agrega su clave', () => {
  const svg = plot({ type: 'corr', data: rows, vars: ['a', 'b', 'c'], alpha: 0.001 });
  assert.match(svg, /no significativa/);
});

test('corr: matriz ya calculada en formato largo (x, y, value)', () => {
  const m = [{ x: 'A', y: 'B', r: 0.5 }, { x: 'A', y: 'C', r: -0.2 }, { x: 'B', y: 'C', r: 0.9 }];
  const r = safePlot({ type: 'corr', data: m, x: 'x', y: 'y', value: 'r', title: 't', source: 's' });
  assert.ok(r.ok);
  assert.match(r.description, /B y C \(0,90\)/);
  assert.match(r.description, /A y C \(−0,20\)/);
});

test('pairplot: paneles, hue, corner y límite de 6 variables', () => {
  const vars = ['ingreso', 'escolaridad', 'pobreza'];
  valid(plot({ type: 'pairplot', data: barrios, vars, kind: 'reg', diag: 'kde' }), 'reg+kde');
  valid(plot({ type: 'pairplot', data: barrios, vars, upper: 'scatter' }), 'upper scatter');
  const corner = plot({ type: 'pairplot', data: barrios, vars, corner: true });
  valid(corner, 'corner');
  assert.doesNotMatch(corner, /n = 120/, 'sin paneles de r');
  assert.match(plot({ type: 'pairplot', data: barrios, vars }), /n = 120/);
  const many = safePlot({ type: 'pairplot', data: barrios, title: 't', source: 's' });
  assert.ok(many.warnings.some((w) => w.code === 'pairplot-many'));
  assert.match(many.description, /6 variables/);
  assert.equal(resolve({ type: 'splom', data: barrios }).type, 'pairplot');
});

test('lint: corr y pairplot explican cómo corregir el spec', () => {
  const codes = (s) => { const r = lint({ title: 't', source: 's', ...s }); return [...r.errors, ...r.warnings, ...r.suggestions].map((x) => x.code); };
  assert.ok(codes({ type: 'corr', data: [{ a: 1, g: 'x' }, { a: 2, g: 'y' }] }).includes('corr-vars'));
  assert.ok(codes({ type: 'corr', data: rows, vars: ['a', 'g'] }).includes('corr-numeric'));
  assert.ok(codes({ type: 'corr', data: rows, vars: ['a', 'zz'] }).includes('field'));
  assert.ok(codes({ type: 'corr', data: rows }).includes('corr-few-rows'));
  assert.ok(codes({ type: 'corr', data: rows }).includes('corr-constant'));
  assert.ok(codes({ type: 'corr', data: rows, method: 'kendal' }).includes('enum-method'));
  assert.ok(codes({ type: 'corr', data: rows, alpha: 5 }).includes('corr-alpha'));
  assert.ok(codes({ type: 'pairplot', data: rows, diag: 'violin' }).includes('enum-diag'));
  assert.equal(codes({ type: 'clustermap', data: barrios, vars: ['ingreso', 'pobreza', 'densidad'] }).filter((c) => c === 'unknown-option').length, 0);
  assert.throws(() => plot({ type: 'corr', data: [{ a: 1, g: 'x' }] }), /al menos dos campos numéricos/);
  for (const k of ['vars', 'method', 'triangle', 'cluster', 'alpha', 'diag', 'upper', 'corner']) assert.ok(schema.properties[k], k);
});
