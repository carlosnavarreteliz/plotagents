// Regresiones de la auditoría de la API: safePlot/safeDashboard no lanzan, toHTML, KPIs y schema.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safePlot, safeDashboard, toHTML, lint, plot, dashboardSchema } from '../src/index.js';

const rows = [{ a: 'x', b: 1 }, { a: 'y', b: 2 }];

test('safePlot nunca lanza con opciones de tipo equivocado y cada aviso trae fix', () => {
  const odd = [['title', {}], ['theme', { categorical: 5 }], ['refLines', 5], ['annotations', [null]]];
  for (const [k, v] of odd) {
    const r = safePlot({ type: 'bar', data: rows, x: 'a', y: 'b', [k]: v });
    for (const it of [...r.errors, ...r.warnings, ...r.suggestions]) assert.ok(it.fix, `${k}: ${it.code} sin fix`);
  }
  assert.doesNotThrow(() => lint({ type: 'bar', data: rows, title: 5, theme: { categorical: 5 } }));
});

test('el tipo con espacios se reconoce', () => {
  assert.match(plot({ type: ' Bar ', data: rows, x: 'a', y: 'b' }), /^<svg/);
  assert.equal(safePlot({ type: 'Bar ', data: rows, x: 'a', y: 'b' }).type, 'bar');
});

test('toHTML deja las comillas del font-family sin escapar en <style>', () => {
  const h = toHTML({ type: 'bar', data: rows, x: 'a', y: 'b', font: "'Foo Bar', serif" });
  const css = h.match(/body\{[^}]*\}/)[0];
  assert.ok(!css.includes('&#39;'));
  assert.ok(css.includes("font-family:'Foo Bar'"));
  const evil = toHTML({ type: 'bar', data: rows, x: 'a', y: 'b', font: '</style><script>alert(1)</script>' });
  assert.ok(!evil.includes('</style><script>alert(1)'));
});

test('safeDashboard nunca lanza con charts, kpis o filtros raros', () => {
  const data = [{ region: 'N', v: 1 }, { region: 'S', v: 2 }];
  const bad = [{ charts: 'x' }, { charts: {} }, { charts: [null] }, { kpis: 'a' }, { filters: 5, data, charts: [{ type: 'bar', x: 'region', y: 'v' }] },
    { filters: [null], data, charts: [{ type: 'bar', x: 'region', y: 'v' }] }, { filters: ['a'], data: [1, 2], charts: [{ type: 'bar', x: 'region', y: 'v' }] }];
  for (const d of bad) {
    let r;
    assert.doesNotThrow(() => { r = safeDashboard(d); }, JSON.stringify(d));
    for (const it of [...r.errors, ...r.warnings, ...r.suggestions]) assert.ok(it.fix, `${JSON.stringify(d)}: ${it.code} sin fix`);
  }
});

test('KPI trendBy ordena periodos numéricos como números (1, 2, … 10)', () => {
  const data = [];
  for (let m = 1; m <= 12; m++) data.push({ month: m, sales: m * 10 });
  const r = safeDashboard({ title: 't', source: 's', data, kpis: [{ label: 'Ventas', field: 'sales', trendBy: 'month' }], charts: [{ type: 'bar', x: 'month', y: 'sales', title: 't' }] });
  assert.ok(r.ok);
  const pts = r.html.match(/polyline points="([^"]*)"/)[1].split(' ').map((p) => +p.split(',')[1]);
  // Serie creciente: el eje y (invertido) debe bajar de forma monótona.
  for (let i = 1; i < pts.length; i++) assert.ok(pts[i] < pts[i - 1], `punto ${i} fuera de orden`);
});

test('el schema del dashboard no exige charts (basta con kpis)', () => {
  assert.equal(dashboardSchema.required, undefined);
  for (const k of ['order', 'note', 'font', 'palette', 'textScale']) assert.ok(dashboardSchema.properties[k], k);
  assert.ok(safeDashboard({ title: 't', kpis: [{ label: 'a', value: 3 }] }).ok);
});
