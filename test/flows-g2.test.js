import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plot, safePlot } from '../src/index.js';
import { spreadLabels } from '../src/charts/sankey.js';

// ── sankey: rótulos separados (`relax`) ─────────────────────────────────────
// Un origen grande y muchos chicos, como la migración de toda la vida de una región.
const big = [{ from: 'L:here', to: 'R:here', value: 7000 }];
const regions = ['Arica', 'Tarapacá', 'Antofagasta', 'Atacama', 'Coquimbo', 'Valparaíso', 'O’Higgins', 'Maule', 'Ñuble', 'Biobío', 'Araucanía', 'Los Ríos', 'Los Lagos', 'Aysén', 'Magallanes'];
const crowded = [
  ...big,
  ...regions.map((r, i) => ({ from: 'L:' + r, to: 'R:here', value: 20 + i * 9 })),
  ...regions.map((r, i) => ({ from: 'L:here', to: 'R:' + r, value: 15 + i * 7 })),
];
const nodes = [
  { id: 'L:here', label: 'Metropolitana', column: 0 }, { id: 'R:here', label: 'Metropolitana', column: 1 },
  ...regions.map((r) => ({ id: 'L:' + r, label: r, column: 0 })), ...regions.map((r) => ({ id: 'R:' + r, label: r, column: 1 })),
];
const skSpec = { type: 'sankey', data: crowded, nodes, order: 'given', width: 900, locale: 'en' };
/** Baselines of the first line of every label, by x (one column per anchor x). */
const nameYs = (svg) => [...svg.matchAll(/<text x="([\d.]+)" y="([\d.]+)"[^>]*font-size="12.5"[^>]*font-weight="500"/g)].map((m) => [+m[1], +m[2]]);

test('spreadLabels: keeps the gap, the order and the bounds, and moves nothing that fits', () => {
  assert.deepEqual(spreadLabels([10, 60, 120], 31, 0, 200), [10, 60, 120]);
  const at = spreadLabels([100, 101, 102, 103], 30, 0, 400);
  for (let i = 1; i < at.length; i++) assert.ok(at[i] - at[i - 1] >= 30 - 1e-9);
  // Minimal displacement: the block is centred on what it wants (mean 101.5).
  assert.ok(Math.abs(at.reduce((a, b) => a + b, 0) / 4 - 101.5) < 1e-9);
  const low = spreadLabels([390, 395, 399], 20, 0, 400);
  assert.ok(low[2] <= 400 && low[0] >= 0 && low[1] - low[0] >= 20 - 1e-9);
  const top = spreadLabels([0, 1, 2], 20, 10, 400);
  assert.equal(top[0], 10);
});

test('sankey relax: every node is named, no two labels in a column overprint, leaders to moved ones', () => {
  const plain = plot(skSpec);
  const svg = plot({ ...skSpec, relax: true });
  // Today the small nodes are unnamed or overprint; with relax, all 32 names are drawn.
  const ys = nameYs(svg);
  assert.equal(ys.length, 32);
  assert.ok(nameYs(plain).length < 32);
  const byX = new Map();
  for (const [x, y] of ys) { if (!byX.has(x)) byX.set(x, []); byX.get(x).push(y); }
  assert.equal(byX.size, 2);
  for (const col of byX.values()) {
    col.sort((a, b) => a - b);
    for (let i = 1; i < col.length; i++) assert.ok(col[i] - col[i - 1] >= 31 - 0.02, `gap ${col[i] - col[i - 1]}`);
  }
  const leaders = svg.match(/class="pa-leader"/g) || [];
  assert.ok(leaders.length > 5 && leaders.length < 32, `leaders: ${leaders.length}`);
  // The big node's label sits beside it: no leader from it.
  assert.doesNotMatch(svg, /<g data-key="L:here"[^>]*>(?:(?!<\/g>).)*pa-leader/s);
  // Second line under every name (the value, formatted).
  assert.equal((svg.match(/<text [^>]*font-size="12" (?![^>]*font-weight)[^>]*>[\d,]+<\/text>/g) || []).length, 32);
  assert.equal(svg, plot({ ...skSpec, relax: true }));
});

test('sankey relax: grows to fit without height, keeps an explicit height', () => {
  const h = (svg) => +svg.match(/viewBox="0 0 [\d.]+ ([\d.]+)"/)[1];
  const grown = plot({ ...skSpec, relax: true });
  assert.ok(h(grown) > h(plot(skSpec)));
  const fixed = plot({ ...skSpec, relax: true, height: 360 });
  assert.equal(h(fixed), 360);
  // Too little room for two lines: one line per label (12 px names), still separated.
  const ys = [...fixed.matchAll(/<text x="([\d.]+)" y="([\d.]+)"[^>]*font-size="12"[^>]*font-weight="500"/g)].map((m) => +m[2]);
  assert.equal(ys.length, 32);
  // A number is the distance between label centres.
  const tight = plot({ ...skSpec, relax: 18 });
  assert.equal([...tight.matchAll(/font-weight="500"/g)].length, 32);
});

test('sankey relax: three columns, skins and CSS-variable colors', () => {
  const data = [
    ...['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((k, i) => ({ from: 'r:' + k, to: 'o:x', value: i ? 3 + i : 400 })),
    { from: 'o:x', to: 'c:1', value: 300 }, ...[2, 3, 4, 5, 6, 7].map((k) => ({ from: 'o:x', to: 'c:' + k, value: k * 2 })),
  ];
  const spec = { type: 'sankey', data, relax: true, stages: ['Region', 'Office', 'Country'], linkColor: ['source', 'target'], width: 720, colors: { 'o:x': 'var(--ink, #222222)' } };
  const svg = plot({ ...spec, skins: [{ theme: { muted: 'var(--ink-3, #9d9284)' } }, { when: 'html.classic', theme: { muted: 'var(--ink-3, #8496a8)' } }] });
  assert.match(svg, /class="pa-leader"[^>]*stroke="#9d9284"[^>]*style="stroke:var\(--pa-s\d+\)"|class="pa-leader"[^>]*style="stroke:var\(/);
  assert.match(svg, /var\(--ink, #222222\)/);
  assert.ok(safePlot(spec).ok);
});

test('sankey relax: lint and schema', () => {
  assert.equal(safePlot({ ...skSpec, relax: 'yes' }).ok, false);
  const r = safePlot({ ...skSpec, relax: true, title: 'x', source: 'y' });
  assert.equal(r.ok, true);
  assert.ok(!r.warnings.some((w) => w.code === 'unknown-option'));
});

// ── network: huecos, aristas neutras, enlaces y posiciones dadas ────────────
// Una red de conocimiento: posiciones de un MDS en 0–1 por eje, peso por grupo.
const kn = [
  { id: 'agro', label: 'Agronomy', x: 0.40, y: 0.11, n: 478, area: 'agri', held: true, url: '/g/agro' },
  { id: 'bio1', label: 'Biology 1', x: 0.30, y: 0.40, n: 900, area: 'nat', held: true, url: '/g/bio1' },
  { id: 'chem', label: 'Chemistry', x: 1.00, y: 0.55, n: 1200, area: 'nat', held: false, url: '/g/chem' },
  { id: 'math', label: 'Mathematics', x: 0.70, y: 1.00, n: 700, area: 'nat', held: false },
  { id: 'hist', label: 'History', x: 0.00, y: 0.70, n: 300, area: 'hum', held: false },
];
const ke = [{ from: 'agro', to: 'bio1', value: 0.77 }, { from: 'bio1', to: 'chem', value: 0.5 }, { from: 'chem', to: 'math', value: 0.69 }, { from: 'hist', to: 'bio1', value: 0.4 }];
const knSpec = { type: 'network', layout: 'preset', flipY: true, nodes: kn, data: ke, group: 'area', size: 'n', width: 800, height: 400, legend: false, locale: 'en' };
const circles = (svg) => [...svg.matchAll(/<circle class="pa-m"[^>]*data-node="([^"]+)"[^>]*>/g)].map((m) => [m[1], m[0]]);

test('network filled/hollow: a field or a list of ids; hollow nodes are rings of their own color', () => {
  const svg = plot({ ...knSpec, filled: 'held' });
  const c = Object.fromEntries(circles(svg));
  const fillOf = (s) => s.match(/ fill="([^"]+)"/)[1];
  const strokeOf = (s) => (s.match(/ stroke="([^"]+)"/) || [])[1];
  const surface = svg.match(/<rect width="800" height="400" fill="([^"]+)"/)[1];
  assert.equal(fillOf(c.chem), surface);
  assert.equal(fillOf(c.math), surface);
  assert.notEqual(fillOf(c.agro), surface);
  // The ring keeps the group color: Chemistry's ring is Biology's fill (same area).
  assert.equal(strokeOf(c.chem), fillOf(c.bio1));
  // `hollow` with a list of ids is the same picture.
  assert.equal(svg, plot({ ...knSpec, hollow: ['chem', 'math', 'hist'] }));
  // Filled nodes are named first and in ink; hollow ones in a muted ink, lighter.
  const lab = (name) => svg.match(new RegExp(`<text[^>]*data-node="${name}"[^>]*>`))?.[0];
  assert.match(lab('agro'), /font-weight="500"/);
  assert.match(lab('chem'), /font-weight="400"/);
  // Without hollow/filled nothing changes.
  assert.doesNotMatch(plot(knSpec), /font-weight="400"/);
});

test('network edges: neutral or one ink, opacity and width fixed or by value, pinned edges on top', () => {
  const base = plot(knSpec);
  const paths = (svg) => [...svg.matchAll(/<path class="pa-m"[^>]*data-s="([^"]+)" data-t="([^"]+)"[^>]*>/g)].map((m) => m[0]);
  const neutral = plot({ ...knSpec, edgeColor: 'neutral', curveness: 0 });
  const muted = new Set(paths(neutral).map((p) => p.match(/stroke="([^"]+)"/)[1]));
  assert.equal(muted.size, 1);
  const ink = plot({ ...knSpec, edgeColor: '#e0d6c4', edgeOpacity: [0.35, 0.95], edgeWidth: 1.1 });
  for (const p of paths(ink)) { assert.match(p, /stroke="#e0d6c4"/); assert.match(p, /stroke-width="1.1"/); }
  const ops = paths(ink).map((p) => +p.match(/stroke-opacity="([\d.]+)"/)[1]);
  assert.equal(Math.max(...ops), 0.95);
  assert.ok(Math.min(...ops) > 0.35 && Math.min(...ops) < 0.7);
  const wide = paths(plot({ ...knSpec, edgeWidth: [0.5, 4] })).map((p) => +p.match(/stroke-width="([\d.]+)"/)[1]);
  assert.equal(Math.max(...wide), 4);
  // A pinned edge (either direction) keeps its own color and is drawn last.
  const pinned = paths(plot({ ...knSpec, edgeColor: 'neutral', colors: { 'bio1→hist': '#d52b1e' } }));
  assert.match(pinned[pinned.length - 1], /data-s="hist" data-t="bio1"[^>]*/);
  assert.match(pinned[pinned.length - 1], /stroke="#d52b1e"/);
  assert.notEqual(base, neutral);
});

test('network href: each node links to its page; minRadius', () => {
  const svg = plot({ ...knSpec, href: 'url' });
  assert.match(svg, /<a href="\/g\/chem" class="pa-link"><circle class="pa-m"[^>]*data-node="chem"/);
  assert.doesNotMatch(svg, /<a href="[^"]*" class="pa-link"><circle[^>]*data-node="math"/);
  const r = (s, id) => +s.match(new RegExp(`<circle[^>]*r="([\\d.]+)"[^>]*data-node="${id}"`))[1];
  assert.ok(r(plot({ ...knSpec, minRadius: 9 }), 'hist') >= 9);
});

test('network: the new options under skins and CSS-variable colors', () => {
  const spec = { ...knSpec, filled: 'held', stretch: true, edgeOpacity: [0.35, 0.95], tooltip: { title: 'label', fields: ['n'], replace: true } };
  const svg = plot({ ...spec, skins: [{ edgeColor: 'var(--line, #e0d6c4)', colors: { nat: '#6e86c8' } }, { when: 'html.classic', edgeColor: 'var(--line, #dfe5ed)', colors: { nat: '#0b3f8c' } }] });
  assert.match(svg, /html\.classic \.pa-skin-[a-z0-9]+\{[^}]*#0b3f8c/);
  assert.match(svg, /stroke:var\(--line, #e0d6c4\)|stroke:var\(--pa-s\d+\)/);
  assert.match(svg, /data-tip="Chemistry\nN: 1,200"/);
  const r = safePlot({ ...spec, title: 'Map', source: 'ANID' });
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.ok(!r.warnings.some((w) => w.code === 'unknown-option'), JSON.stringify(r.warnings));
  assert.equal(safePlot({ ...spec, filled: 'nope' }).ok, false);
});
