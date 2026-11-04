import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plot, safePlot, resolve, lint, dashboard, planDashboard, lintDashboard, safeDashboard, balancedRows, countWords, toolDefinition } from '../src/index.js';
import { controlMode } from '../src/runtime.js';
import { wordsGallery } from '../examples/specs-words.js';
import { salesDashboard } from '../examples/dashboard.js';

const clean = (svg) => !/NaN|undefined|object Object|Infinity/.test(svg);

test('controles de tiempo: apagados salvo que se pidan', () => {
  assert.equal(controlMode({ time: 'año' }), null);
  assert.equal(controlMode({ type: 'line' }), null);
  assert.equal(controlMode({ slider: true }), 'auto');
  assert.equal(controlMode({ slider: 'buttons' }), 'buttons');
  assert.equal(controlMode({ slider: 'slider' }), 'slider');
  assert.equal(controlMode({ slider: true }, { controls: false }), null);
});

test('wordcloud: galería en ambos temas y anchos, sin choques', () => {
  for (const ex of wordsGallery) for (const theme of ['papel', 'noche']) for (const width of [720, 390]) {
    const svg = plot({ ...ex.spec, theme, width });
    assert.ok(clean(svg), `${ex.id} ${theme} ${width}`);
    assert.match(svg, /data-pa-type="wordcloud"/);
  }
  // Las cajas de las palabras no se superponen (aproximación por posición y tamaño).
  const svg = plot(wordsGallery[0].spec);
  const words = [...svg.matchAll(/<text x="([\d.]+)" y="([\d.]+)" class="pa-m"[^>]*?font-size="([\d.]+)"[^>]*>([^<]+)</g)].map((m) => ({ x: +m[1], y: +m[2], s: +m[3], t: m[4] }));
  assert.ok(words.length > 20);
  assert.equal(words[0].t, 'datos');
  assert.ok(words[0].s > words[words.length - 1].s * 3);
});

test('wordcloud: texto crudo, stopwords e inferencia del tipo', () => {
  const ws = countWords('Los datos y los datos. Datos para la empresa; la empresa decide.');
  assert.deepEqual(ws.sort((a, b) => b.value - a.value)[0], { text: 'datos', value: 3 });
  assert.ok(!ws.some((w) => ['los', 'para', 'la'].includes(w.text.toLowerCase())));
  assert.equal(resolve({ text: 'hola mundo mundo' }).type, 'wordcloud');
  const r = safePlot({ text: ['Más datos, menos Excel', 'Datos limpios para decidir'], subtitle: 'x', title: 'x', source: 'x' });
  assert.ok(r.ok && clean(r.svg), JSON.stringify(r.errors));
  assert.ok(lint({ type: 'wordcloud', data: [{ w: 'a', v: 1 }], locale: 'en' }).suggestions.some((s) => s.code === 'wordcloud-few'));
});

test('dashboard: plan con KPIs, principal ancho y filas completas', () => {
  const plan = planDashboard(salesDashboard('es'));
  assert.equal(plan.panels[0].spec.type, 'line');
  assert.equal(plan.panels[0].span, 12);
  const byRow = {};
  for (const p of plan.panels) byRow[p.row] = (byRow[p.row] || 0) + p.span;
  assert.ok(Object.values(byRow).every((v) => v === 12), JSON.stringify(byRow));
  // Misma entidad, mismo color en todos los gráficos.
  const c = plan.panels.map((p) => p.spec.colors['Ñuble']);
  assert.ok(c.every((x) => x === c[0]));
  assert.deepEqual(plan.filters.map((f) => f.control), ['buttons', 'buttons']);
  // La fuente común no se repite en cada gráfico.
  assert.ok(plan.panels.every((p) => p.spec.source === undefined));
});

test('dashboard: filas balanceadas para 1 a 7 gráficos', () => {
  for (let n = 1; n <= 7; n++) {
    const rows = balancedRows(Array(n).fill(6), false);
    assert.ok(rows.every((r) => r.reduce((a, x) => a + x.span, 0) === 12), `n=${n}`);
    assert.equal(rows.flat().length, n);
    assert.ok(rows.every((r) => r.length <= 3));
  }
});

test('dashboard: HTML autónomo, KPIs calculados con variación y lint', () => {
  const html = dashboard(salesDashboard('en'));
  assert.match(html, /^<!doctype html>/);
  assert.match(html, /class="pa-kpis"/);
  assert.match(html, /Sales 2025/);
  assert.match(html, /▲ \+\d+%<small>vs 2024/);
  assert.match(html, /mountDashboard/);
  assert.ok(!/NaN|undefined/.test(html.replace(/<script>[\s\S]*?<\/script>/g, '')));
  const rep = lintDashboard({ title: 't', source: 's', charts: Array(10).fill({ type: 'donut', data: [{ a: 'x', v: 1 }, { a: 'y', v: 2 }, { a: 'z', v: 3 }], title: 't' }), kpis: Array(7).fill({ label: 'k', value: 1 }) });
  assert.ok(rep.warnings.some((w) => w.code === 'dash-many-charts'));
  assert.ok(rep.warnings.some((w) => w.code === 'dash-many-kpis'));
  assert.ok(rep.suggestions.some((w) => w.code === 'dash-pies'));
  const bad = safeDashboard({ title: 'x', charts: [{ type: 'bar', data: [{ a: 1 }], x: 'nope', y: 'a', title: 't' }] });
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.some((e) => /Gráfico 1/.test(e.message)));
  assert.equal(toolDefinition({ kind: 'dashboard' }).name, 'dashboard');
});
