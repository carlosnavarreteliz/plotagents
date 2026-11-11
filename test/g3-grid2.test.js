import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plot, lint, safePlot } from '../src/index.js';
import { binnedScale } from '../src/colorscales.js';

const texts = (svg) => [...svg.matchAll(/>([^<>]+)<\/text>/g)].map((m) => m[1]);
const tips = (svg) => [...svg.matchAll(/data-tip="([^"]*)"/g)].map((m) => m[1].replace(/&#10;|\n/g, '\n'));
const noStyle = (svg) => svg.replace(/<style>.*?<\/style>/s, '');

// ── dotplot ────────────────────────────────────────────────────────────────
const dots = Array.from({ length: 40 }, (_, i) => ({ name: 'I' + i, x: (i * 7.3) % 40 }));
const dp = { type: 'dotplot', data: dots, x: 'x', label: 'name', bin: 1, width: 600, locale: 'en' };

test('dotplot refLines dash: true is 3 3, a pattern passes, anything else is solid', () => {
  assert.match(plot({ ...dp, refLines: [{ x: 18.4, label: 'Chile', dash: true }] }), /<line[^>]*stroke-width="1.25" opacity="0.7" stroke-dasharray="3 3"/);
  assert.match(plot({ ...dp, refLines: [{ x: 18.4, dash: '4 2' }] }), /stroke-dasharray="4 2"/);
  assert.doesNotMatch(plot({ ...dp, refLines: [{ x: 18.4, dash: 'url(x)' }] }), /stroke-dasharray/);
  assert.doesNotMatch(plot({ ...dp, refLines: [{ x: 18.4 }] }), /stroke-dasharray/);
});

test('dotplot refLines showValue: false keeps the value out of the tooltip too', () => {
  const quiet = tips(plot({ ...dp, refLines: [{ x: 18.4, label: 'Chile', showValue: false }] }));
  assert.ok(quiet.includes('Chile'));
  assert.ok(!quiet.some((t) => t.startsWith('Chile') && /18/.test(t)));
  // With the value shown (default) the tooltip carries it; with no label the value is all there is.
  assert.ok(tips(plot({ ...dp, refLines: [{ x: 18.4, label: 'Chile' }] })).includes('Chile\n18.4'));
  assert.ok(tips(plot({ ...dp, refLines: [{ x: 18.4, showValue: false }] })).includes('18.4'));
});

test('dotplot dotRadius: the radius is kept even when the bin is narrower', () => {
  const narrow = { ...dp, bin: 0.2, width: 358 };
  const r = (svg) => +svg.match(/<circle[^>]* r="([\d.]+)"/)[1];
  assert.ok(r(plot(narrow)) < 2);
  assert.equal(r(plot({ ...narrow, dotRadius: 4 })), 4);
  assert.equal(r(plot({ ...narrow, dotRadius: 2.5 })), 2.5);
  // With an explicit height it still shrinks to fit the tallest stack.
  const tall = Array.from({ length: 30 }, (_, i) => ({ name: 'T' + i, x: 5 }));
  assert.ok(r(plot({ ...dp, data: tall, dotRadius: 6, height: 140 })) < 6);
  assert.equal(safePlot({ ...narrow, dotRadius: 4 }).ok, true);
});

test('dotplot refLines dash under skins: geometry shared, colors per skin', () => {
  const svg = plot({ ...dp, series: undefined, refLines: [{ x: 18.4, label: 'Chile', dash: true, color: '#6e86c8' }], skins: [{ palette: ['#6e86c8'] }, { when: 'html.classic', palette: ['#0b3f8c'], refLines: [{ x: 18.4, label: 'Chile', dash: true, color: '#0b3f8c' }] }] });
  assert.match(svg, /stroke-dasharray="3 3"/);
  assert.match(svg, /html\.classic \.pa-skin-[a-z0-9]+\{[^}]*#0b3f8c/);
});

// ── heatmap ────────────────────────────────────────────────────────────────
const sectors = ['Agro', 'Pesca', 'Minería', 'Industria', 'Comercio'];
const fam = { Agro: 'Recursos naturales renovables', Pesca: 'Recursos naturales renovables', Minería: 'Minería', Industria: 'Industria', Comercio: 'Servicios' };
const regions = ['Arica', 'Tarapacá', 'Antofagasta'];
const grid = regions.flatMap((r, i) => sectors.map((s, j) => ({ sector: s, region: r, family: fam[s], d: r === 'Arica' && s === 'Pesca' ? null : ((i * 5 + j) % 7) - 3 })));
const hm = { type: 'heatmap', data: grid, x: 'sector', y: 'region', value: 'd', width: 600, locale: 'en' };
const bins = { colors: ['#2166AC', '#92C5DE', '#F7F7F7', '#F4A582', '#B2182B'], breaks: [-2, -0.5, 0.5, 2] };

test('heatmap midClass { color }: the class around 0 takes the given color', () => {
  const svg = plot({ ...hm, colorScale: bins, midClass: { color: '#f3ece0' } });
  assert.match(svg, /fill="#f3ece0"/);
  assert.doesNotMatch(noStyle(svg).replace(/<g class="pa-legend".*?<\/g><\/g>/s, ''), /fill="#F7F7F7"/);
  // "neutral" is still the theme tint; a bad color falls back to it (lint warns).
  const tint = plot({ ...hm, colorScale: bins, midClass: 'neutral' });
  assert.equal(plot({ ...hm, colorScale: bins, midClass: { color: 'not a color!' } }), tint);
  assert.ok(lint({ ...hm, colorScale: bins, midClass: { color: 'nope!' } }).warnings.some((w) => w.code === 'midclass-color'));
});

test('heatmap midClass { color } from a skin patch', () => {
  const svg = plot({ ...hm, colorScale: bins, skins: [{ midClass: { color: '#f3ece0' } }, { when: 'html.classic', midClass: { color: '#f4f6f9' } }] });
  assert.match(svg, /fill="#f3ece0" style="fill:var\(--pa-s\d+\)"/);
  assert.match(svg, /html\.classic \.pa-skin-[a-z0-9]+\{[^}]*#f4f6f9/);
});

test('heatmap missingLabel: the tooltip of an empty cell', () => {
  assert.ok(tips(plot(hm)).includes('Arica · Pesca\n—'));
  assert.ok(tips(plot({ ...hm, missingLabel: 'no data' })).includes('Arica · Pesca\nno data'));
});

test('heatmap groupColors: a stripe of each group color on the band edge facing the grid', () => {
  const colors = { 'Recursos naturales renovables': '#6e8b3d', Minería: '#b5651d', Servicios: '#5a6fae' };
  const svg = plot({ ...hm, xGroup: 'family', groupColors: colors });
  const band = svg.match(/<g class="pa-groups pa-groups-x">.*?<\/g>(?=<|$)/s)[0];
  for (const c of Object.values(colors)) assert.match(band, new RegExp(`<rect [^>]*height="3" fill="${c}"/>`));
  // The group without a color keeps the alternate tint.
  assert.equal((band.match(/height="3"/g) || []).length, 3);
  // Rows too.
  const rows = plot({ ...hm, x: 'region', y: 'sector', yGroup: 'family', groupColors: colors });
  assert.match(rows, /<g class="pa-groups pa-groups-y">.*<rect [^>]*width="3"[^>]*fill="#b5651d"/s);
  // Under skins: one color per skin.
  const sk = plot({ ...hm, xGroup: 'family', skins: [{ groupColors: { Minería: '#b5651d' } }, { when: 'html.classic', groupColors: { Minería: '#7a3e00' } }] });
  assert.match(sk, /html\.classic \.pa-skin-[a-z0-9]+\{[^}]*#7a3e00/);
  assert.ok(lint({ ...hm, groupColors: colors }).warnings.some((w) => w.code === 'groupcolors-no-group'));
  assert.ok(lint({ ...hm, xGroup: 'family', groupColors: { Nope: '#000' } }).suggestions.some((w) => w.code === 'groupcolors-unknown'));
});

test('heatmap xGroup: a group name cut short is whole in its tooltip', () => {
  const svg = plot({ ...hm, xGroup: 'family', width: 420 });
  assert.ok(texts(svg).some((t) => /^Recursos.*…$/.test(t)));
  assert.ok(tips(svg).includes('Recursos naturales renovables'));
  // A name that fits gets no extra tooltip.
  assert.ok(!tips(svg).includes('Servicios'));
});

test('heatmap cornerLabel: in the empty corner, by the column labels, split on \\n', () => {
  const top = plot({ ...hm, xLabelAngle: -90, xLabelPosition: 'top', cornerLabel: 'born in ↓\nlives in →' });
  const corner = top.match(/<g class="pa-corner">(.*?)<\/g>/s)[1];
  assert.deepEqual(texts(corner), ['born in ↓', 'lives in →']);
  const ys = [...corner.matchAll(/y="([\d.]+)"/g)].map((m) => +m[1]);
  const firstCell = +top.match(/<g class="pa-m"[^>]*><rect x="[\d.]+" y="([\d.]+)"/)[1];
  assert.ok(ys[0] < ys[1] && ys[1] < firstCell, 'over the grid, last line nearest it');
  // Bottom labels: the corner sits under the row labels.
  const bottom = plot({ ...hm, cornerLabel: 'born in ↓ / lives in →' });
  assert.ok(+bottom.match(/<g class="pa-corner"><text x="[\d.]+" y="([\d.]+)"/)[1] > firstCell);
  // Without room, cut and whole in the tooltip.
  const tight = plot({ ...hm, width: 300, cornerLabel: 'where each person was born, against where each person lives now' });
  assert.match(tight, /<g class="pa-corner" data-tip="where each person was born, against where each person lives now">/);
  assert.doesNotMatch(plot(hm), /pa-corner/);
});

// ── binned colorScale: closed, repeated breaks ─────────────────────────────

test('binned colorScale closed: "right" puts a value equal to a break in the class below', () => {
  const left = binnedScale({ colorScale: { colors: ['#aaaaaa', '#bbbbbb', '#cccccc'], breaks: [10, 20] } });
  const right = binnedScale({ colorScale: { colors: ['#aaaaaa', '#bbbbbb', '#cccccc'], breaks: [10, 20], closed: 'right' } });
  assert.deepEqual([9, 10, 15, 20, 21].map(left.cls), [0, 1, 1, 2, 2]);
  assert.deepEqual([9, 10, 15, 20, 21].map(right.cls), [0, 0, 1, 1, 2]);
  assert.throws(() => binnedScale({ colorScale: { colors: ['#aaaaaa', '#bbbbbb'], breaks: [1], closed: 'up' } }), /closed/);
  // Through the charts.
  const d = [{ x: 'a', y: 'r', v: 10 }, { x: 'b', y: 'r', v: 20 }];
  const cs = { colors: ['#111111', '#555555', '#999999'], breaks: [10, 20] };
  const fills = (svg) => [...svg.matchAll(/<g class="pa-m"[^>]*><rect [^>]*fill="(#[0-9a-f]+)"/gi)].map((m) => m[1]);
  assert.deepEqual(fills(plot({ type: 'heatmap', data: d, x: 'x', y: 'y', value: 'v', colorScale: cs })), ['#555555', '#999999']);
  assert.deepEqual(fills(plot({ type: 'heatmap', data: d, x: 'x', y: 'y', value: 'v', colorScale: { ...cs, closed: 'right' } })), ['#111111', '#555555']);
  const map = plot({ type: 'choropleth', geo: 'chile', data: [{ r: 'Maule', v: 20 }], key: 'r', value: 'v', colorScale: { ...cs, closed: 'right' }, width: 400 });
  assert.match(map, /fill="#555555"/);
});

test('binned colorScale: repeated breaks merge (no throw); the empty class and its color drop', () => {
  const b = binnedScale({ colorScale: { colors: ['#000000', '#111111', '#222222', '#333333', '#444444'], breaks: [1, 5, 5, 9] } });
  assert.deepEqual(b.breaks, [1, 5, 9]);
  assert.deepEqual(b.colors, ['#000000', '#111111', '#333333', '#444444']);
  assert.deepEqual([0, 1, 4, 5, 8, 9].map(b.color), ['#000000', '#111111', '#111111', '#333333', '#333333', '#444444']);
  const r = binnedScale({ colorScale: { colors: ['#000000', '#111111', '#222222', '#333333', '#444444'], breaks: [1, 5, 5, 9], closed: 'right' } });
  assert.deepEqual([5, 5.1].map(r.color), ['#111111', '#333333']);
  // Decreasing breaks still throw.
  assert.throws(() => binnedScale({ colorScale: { colors: ['#aaaaaa', '#bbbbbb', '#cccccc'], breaks: [2, 1] } }), /creciente/);
  const spec = { ...hm, colorScale: { colors: ['#000000', '#333333', '#666666', '#999999', '#cccccc'], breaks: [-1, 0.5, 0.5, 2] } };
  assert.equal(safePlot(spec).ok, true);
  assert.ok(lint(spec).suggestions.some((s) => s.code === 'colorscale-repeated-breaks'));
  // The stepped legend carries the merged classes.
  assert.equal((plot(spec).match(/<rect[^>]*fill="#666666"/g) || []).length, 0);
});

// ── waffle ─────────────────────────────────────────────────────────────────
const checks = Array.from({ length: 37 }, (_, i) => ({ r: i < 30 ? 'Exact' : 'Declared', who: 'check ' + i }));
const wf = { type: 'waffle', data: checks, series: 'r', perSquare: true, columns: 12, cellSize: 11, padding: 0 };

test('waffle perSquare: one <rect> per square, rx when rounded, half the bytes of arc paths', () => {
  const svg = plot(wf);
  assert.equal((svg.match(/<g class="pa-m"[^>]*><rect /g) || []).length, 37);
  assert.doesNotMatch(svg, /<path d="M[\d.]+,[\d.]+h/);
  assert.match(svg, /<rect x="[\d.]+" y="[\d.]+" width="9" height="9" rx="2.25" fill=/);
  // Same squares as the per-series paths, in fewer bytes than the old arc paths (~37% less here).
  assert.ok(svg.length < 7000, String(svg.length));
});

test('waffle cellRadius: 0 square corners, a number sets rx, both drawing modes', () => {
  const sq = plot({ ...wf, cellRadius: 0 });
  assert.match(sq, /<rect x="[\d.]+" y="[\d.]+" width="9" height="9" fill=/);
  assert.doesNotMatch(sq, /height="9" rx=/);
  assert.match(plot({ ...wf, cellRadius: 1 }), /width="9" height="9" rx="1"/);
  // Capped at half the square (a circle).
  assert.match(plot({ ...wf, cellRadius: 40 }), /rx="4.5"/);
  const series = { type: 'waffle', data: [{ s: 'a', v: 40 }, { s: 'b', v: 25 }], series: 's', value: 'v' };
  assert.doesNotMatch(plot({ ...series, cellRadius: 0 }), /a[\d.]+,[\d.]+ 0 0 1/);
  assert.match(plot(series), /a[\d.]+,[\d.]+ 0 0 1/);
});

test('waffle perSquare rects under skins', () => {
  const svg = plot({ ...wf, skins: [{ colors: { Exact: '#6e86c8', Declared: '#d9714f' } }, { when: 'html.classic', colors: { Exact: '#0b3f8c', Declared: '#d52b1e' } }] });
  assert.match(svg, /<rect [^>]*fill="#6e86c8" style="fill:var\(--pa-s\d+\)"/);
  assert.match(svg, /html\.classic \.pa-skin-[a-z0-9]+\{[^}]*#d52b1e/);
});

// ── strip / swarm: clamp, labels above, row tooltips (DiffDistance) ─────────
const sources = ['Censo 2024', 'Casen 2024', 'SII'];
const diffs = [
  { source: 'Censo 2024', rel: 0.00002, title: 'Población, Arica', body: 'Published: 1\nRebuilt: 2' },
  { source: 'Censo 2024', rel: 0.5, title: 'A', body: 'a' },
  { source: 'Censo 2024', rel: 0.51, title: 'B', body: 'b' },
  { source: 'Casen 2024', rel: 3, title: 'C', body: 'c' },
  { source: 'SII', rel: 250, title: 'D', body: 'd' },
];
const dd = { type: 'swarm', data: diffs, x: 'rel', y: 'source', xScale: 'log', xDomain: [1e-4, 100], clamp: true, radius: 4.2, width: 920, locale: 'en', format: (v) => `${v}%`, tooltip: { title: 'title', text: 'body', replace: true } };

test('swarm clamp on a log axis: values beyond sit on the edge, the end ticks say ≤ / ≥', () => {
  const svg = plot(dd);
  const t = texts(svg);
  assert.ok(t.includes('≤ 0.0001%'), t.join('|'));
  assert.ok(t.includes('≥ 100%'), t.join('|'));
  const cx = [...svg.matchAll(/<circle class="pa-m" cx="([\d.]+)"/g)].map((m) => +m[1]);
  const xs = [...svg.matchAll(/<line x1="([\d.]+)" x2="\1" y1="[\d.]+" y2="[\d.]+" stroke="[^"]+"/g)].map((m) => +m[1]);
  assert.ok(Math.min(...cx) >= Math.min(...xs) - 1 && Math.max(...cx) <= Math.max(...xs) + 1, 'inside the axis');
  // Nothing beyond on one side: no mark there.
  const inside = plot({ ...dd, data: diffs.filter((r) => r.rel <= 100) });
  assert.ok(!texts(inside).includes('≥ 100%') && texts(inside).includes('100%'));
  // A 0 on a clamped log axis goes to the low edge instead of turning the axis linear.
  assert.ok(texts(plot({ ...dd, data: [...diffs, { source: 'SII', rel: 0, title: 'Z', body: 'z' }] })).includes('≤ 0.0001%'));
  // Without a domain, clamp does nothing and lint says so.
  assert.ok(lint({ ...dd, xDomain: undefined }).warnings.some((w) => w.code === 'clamp-no-domain'));
});

test('swarm: overlapping dots step aside; each dot carries its own row in the tooltip', () => {
  const svg = plot(dd);
  const cy = [...svg.matchAll(/<circle class="pa-m" cx="[\d.]+" cy="([\d.]+)"/g)].map((m) => +m[1]);
  assert.ok(new Set(cy).size > sources.length, 'the two near dots of Censo are nudged apart');
  const t = tips(svg);
  assert.ok(t.includes('Población, Arica\nPublished: 1\nRebuilt: 2'));
  assert.ok(t.includes('D\nd'));
  // Without `tooltip`, the default text is unchanged.
  assert.ok(tips(plot({ ...dd, tooltip: undefined })).includes('Censo 2024\n0.5%'));
  // strip too.
  assert.ok(tips(plot({ ...dd, type: 'strip' })).includes('C\nc'));
});

test('yLabelPosition "above": row names over each row, the axis takes the full width', () => {
  const left = plot({ ...dd, width: 358 });
  const above = plot({ ...dd, width: 358, yLabelPosition: 'above' });
  const name = (svg) => svg.match(/<text x="([\d.]+)" y="([\d.]+)"[^>]*>Casen 2024<\/text>/);
  const nl = name(left), na = name(above);
  assert.match(nl[0], /text-anchor="end"/);
  assert.doesNotMatch(na[0], /text-anchor/);
  assert.ok(+na[1] < +nl[1], 'starts at the left edge of the axis, not before it');
  const firstGrid = (svg) => Math.min(...[...svg.matchAll(/<line x1="([\d.]+)" x2="\1"/g)].map((m) => +m[1]));
  assert.ok(firstGrid(above) < firstGrid(left) - 50, 'the axis is wider');
});

test('swarm with a CSS-variable color and skins', () => {
  const svg = plot({ ...dd, palette: ['var(--rojo, #d9714f)'] });
  assert.match(svg, /var\(--rojo, #d9714f\)/);
  const sk = plot({ ...dd, skins: [{ palette: ['#d9714f'] }, { when: 'html.classic', palette: ['#d52b1e'] }] });
  assert.match(sk, /html\.classic \.pa-skin-[a-z0-9]+\{[^}]*#d52b1e/);
});

// ── sankey ─────────────────────────────────────────────────────────────────
const sk = { type: 'sankey', data: [{ from: 'A', to: 'X', value: 3.3 }, { from: 'A', to: 'Y', value: 1.7 }, { from: 'B', to: 'X', value: 2.9 }], width: 500 };

test('sankey link paths are rounded (two decimals; pathPrecision for fewer)', () => {
  const ds = (svg) => [...svg.matchAll(/<path class="pa-m" d="([^"]+)"/g)].map((m) => m[1]);
  const nums = (d) => d.match(/-?\d+(\.\d+)?/g);
  for (const d of ds(plot(sk))) for (const n of nums(d)) assert.ok(!/\.\d{3}/.test(n), n);
  for (const d of ds(plot({ ...sk, pathPrecision: 1 }))) for (const n of nums(d)) assert.ok(!/\.\d{2}/.test(n), n);
  for (const d of ds(plot({ ...sk, pathPrecision: 0 }))) for (const n of nums(d)) assert.ok(!/\./.test(n), n);
  assert.ok(plot({ ...sk, pathPrecision: 1 }).length < plot(sk).length);
});

// ── network ────────────────────────────────────────────────────────────────
const net = { type: 'network', data: [{ from: 'Universidad con un nombre largo que no cabe en ciento cincuenta píxeles', to: 'B', value: 3 }, { from: 'B', to: 'C', value: 1 }, { from: 'C', to: 'A', value: 2 }], width: 700, height: 420, labels: true };

test('network edgeTip: false (and tooltip: false) drop the edge tooltips', () => {
  const edgeTips = (svg) => (svg.match(/data-s="[^"]*" data-t="[^"]*" data-tip=/g) || []).length;
  assert.equal(edgeTips(plot(net)), 3);
  assert.equal(edgeTips(plot({ ...net, edgeTip: false })), 0);
  assert.ok(tips(plot({ ...net, edgeTip: false })).length > 0, 'nodes keep theirs');
  assert.equal(edgeTips(plot({ ...net, tooltip: false })), 0);
});

test('network labelWidth: how wide a node name may run before it is cut', () => {
  const name = (svg) => texts(svg).find((t) => t.startsWith('Universid'));
  assert.match(name(plot(net)), /…$/);
  assert.equal(name(plot({ ...net, labelWidth: 600 })), 'Universidad con un nombre largo que no cabe en ciento cincuenta píxeles');
  assert.ok(name(plot({ ...net, labelWidth: 60 })).length < name(plot(net)).length);
});

// ── dendrogram ─────────────────────────────────────────────────────────────
const tree = [{ id: 'r' }, { id: 'a', parent: 'r', height: 1 }, { id: 'Una hoja con un nombre muy largo, de esos que el treinta por ciento corta', parent: 'a' }, { id: 'c', parent: 'a' }, { id: 'd', parent: 'r' }];
const den = { type: 'dendrogram', data: tree, width: 1236, padding: 0 };

test('dendrogram labelWidth / treeWidth: the names column past 30%, or the tree at a fixed width', () => {
  const leaf = (svg) => texts(svg).find((t) => t.startsWith('Una hoja'));
  const full = 'Una hoja con un nombre muy largo, de esos que el treinta por ciento corta';
  assert.match(leaf(plot(den)), /…$/);
  assert.equal(leaf(plot({ ...den, labelWidth: 600 })), full);
  assert.match(leaf(plot({ ...den, labelWidth: 100 })), /…$/);
  assert.equal(leaf(plot({ ...den, treeWidth: 250 })), full);
  // treeWidth: the tree spans exactly that, the names the rest.
  const svg = plot({ ...den, treeWidth: 250 });
  const xs = [...svg.matchAll(/<path[^>]* d="M([\d.]+)[, ][\d.]+[HV]/g)].map((m) => +m[1]);
  const textX = Math.min(...[...svg.matchAll(/<text x="([\d.]+)"[^>]*>(?:Una hoja|c|d)</g)].map((m) => +m[1]));
  assert.ok(textX <= 250 + 30, String(textX));
  assert.ok(xs.length === 0 || Math.max(...xs) <= 252);
});
