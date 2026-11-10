import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plot, lint, safePlot } from '../src/index.js';

const texts = (svg) => [...svg.matchAll(/>([^<>]+)<\/text>/g)].map((m) => m[1]);
const tips = (svg) => [...svg.matchAll(/data-tip="([^"]*)"/g)].map((m) => m[1].replace(/&#10;|\n/g, '\n'));
const dots = (svg) => [...svg.matchAll(/<circle class="pa-m" cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"/g)].map((m) => ({ x: +m[1], y: +m[2], r: +m[3] }));
const heightOf = (svg) => +svg.match(/viewBox="0 0 [\d.]+ ([\d.]+)"/)[1];

// ── swarm / strip: DiffDistance ────────────────────────────────────────────
const runs = ['Casen 2024', 'Censo Agropecuario 2021', 'Registro tributario · SII', 'Comercio exterior'];
const rel = [];
runs.forEach((run, i) => {
  const n = [3, 5, 30, 9][i];
  for (let k = 0; k < n; k++) rel.push({ run, rel: 10 ** (-3 + i + (k % 6) * 0.02 + Math.floor(k / 6) * 0.3), title: `${run} #${k}` });
});
const dd = { type: 'swarm', data: rel, x: 'rel', y: 'run', order: runs, xScale: 'log', xDomain: [1e-4, 100], clamp: 'always', format: (v) => `${v}%`, radius: 4.2, fixedRadius: true, width: 920, locale: 'en', xLabel: '' };

test('swarm fixedRadius: every dot keeps the radius; rows grow until the widest cluster fits', () => {
  const svg = plot(dd);
  const ds = dots(svg);
  assert.equal(ds.length, rel.length);
  assert.ok(ds.every((d) => d.r === 4.2));
  // No two dots overlap (beeswarm at the given radius, nothing clamped).
  for (let i = 0; i < ds.length; i++) for (let j = i + 1; j < ds.length; j++) {
    const dist = Math.hypot(ds[i].x - ds[j].x, ds[i].y - ds[j].y);
    assert.ok(dist >= 2 * 4.2 - 0.05, `${dist}`);
  }
  // Without fixedRadius the radius shrinks to fit the default 46 px rows.
  const shrunk = dots(plot({ ...dd, fixedRadius: undefined }));
  assert.ok(shrunk[0].r < 4.2);
  assert.ok(heightOf(svg) > heightOf(plot({ ...dd, fixedRadius: undefined })), 'the rows grew');
});

test('swarm fixedRadius with rowHeight: rows stay that tall, the dots that do not fit press against the band edge', () => {
  const svg = plot({ ...dd, rowHeight: 30 });
  const ds = dots(svg);
  assert.ok(ds.every((d) => d.r === 4.2));
  const name = (s, n) => +s.match(new RegExp(`<text x="[\\d.]+" y="([\\d.]+)"[^>]*>${n}</text>`))[1];
  assert.ok(Math.abs(name(svg, 'Comercio exterior') - name(svg, 'Casen 2024') - 3 * 30) < 0.05, 'rows 30 px apart');
  // The SII cluster stays inside its row.
  const sii = ds.filter((d) => Math.abs(d.y - name(svg, 'Registro tributario · SII') + 4.5) < 20);
  assert.ok(Math.max(...sii.map((d) => d.y)) - Math.min(...sii.map((d) => d.y)) <= 30);
  // rowHeight alone (no fixedRadius) also sets the row step.
  const h30 = plot({ ...dd, fixedRadius: undefined, rowHeight: 30 });
  const h60 = plot({ ...dd, fixedRadius: undefined, rowHeight: 60 });
  assert.ok(Math.abs(name(h60, 'Comercio exterior') - name(h60, 'Casen 2024') - 3 * 60) < 0.05);
  assert.ok(Math.abs(name(h30, 'Comercio exterior') - name(h30, 'Casen 2024') - 3 * 30) < 0.05);
});

test('rowLine: one guide per category behind the dots; "dashed" is 2 3', () => {
  const dashed = plot({ ...dd, rowHeight: 30, rowLine: 'dashed' });
  const g = dashed.match(/<g class="pa-rowlines">(.*?)<\/g>/s)[1];
  assert.equal((g.match(/<line /g) || []).length, runs.length);
  assert.equal((g.match(/stroke-dasharray="2 3"/g) || []).length, runs.length);
  assert.ok(dashed.indexOf('pa-rowlines') < dashed.indexOf('<circle class="pa-m"'), 'behind the marks');
  const solid = plot({ ...dd, rowHeight: 30, rowLine: true }).match(/<g class="pa-rowlines">(.*?)<\/g>/s)[1];
  assert.doesNotMatch(solid, /dasharray/);
  assert.doesNotMatch(plot(dd), /pa-rowlines/);
  // Vertical: one vertical line per category; and for box too.
  const v = plot({ type: 'swarm', data: rel, x: 'run', y: 'rel', horizontal: false, rowLine: true, width: 700 });
  assert.match(v, /<g class="pa-rowlines"><line x1="([\d.]+)" x2="\1"/);
  assert.match(plot({ type: 'box', data: rel, x: 'rel', y: 'run', rowLine: 'dashed' }), /pa-rowlines/);
});

test('clamp "always": the edge ticks say ≤ / ≥ even when no value lies beyond', () => {
  const inside = rel.filter((r) => r.rel >= 1e-4 && r.rel <= 100);
  const t = texts(plot({ ...dd, data: inside }));
  assert.ok(t.includes('≤ 0.0001%') && t.includes('≥ 100%'), t.join('|'));
  const plain = texts(plot({ ...dd, data: inside, clamp: true }));
  assert.ok(plain.includes('0.0001%') && plain.includes('100%') && !plain.some((x) => /[≤≥]/.test(x)));
  assert.ok(lint({ ...dd, clamp: 'allways' }).errors.some((e) => e.code === 'enum-clamp'));
});

test('yLabelPosition "above" in swarm/strip: each name sits right above its highest dot', () => {
  for (const type of ['swarm', 'strip']) {
    const svg = plot({ ...dd, type, width: 358, rowHeight: 40, yLabelPosition: 'above', fixedRadius: type === 'swarm' });
    const ds = dots(svg);
    const ys = runs.map((n) => +svg.match(new RegExp(`<text x="[\\d.]+" y="([\\d.]+)"[^>]*>${n}</text>`))[1]);
    ys.forEach((y, i) => {
      // The dots of this row lie between this name and the next one.
      const next = ys[i + 1] ?? Infinity;
      const mine = ds.filter((d) => d.y > y && d.y < next);
      assert.ok(mine.length, `${type} row ${i}`);
      const gap = Math.min(...mine.map((d) => d.y - d.r)) - y;
      assert.ok(gap >= 3.5 && gap <= 4.5, `${type} row ${i}: ${gap}`);
    });
    assert.ok(Math.abs(ys[1] - ys[0] - 40) < 12, 'rows of about rowHeight');
  }
});

test('swarm fixedRadius / rowLine with a CSS-variable color and under skins', () => {
  const v = plot({ ...dd, rowHeight: 30, rowLine: 'dashed', palette: ['var(--rojo, #d9714f)'] });
  assert.match(v, /var\(--rojo, #d9714f\)/);
  const sk = plot({ ...dd, rowHeight: 30, rowLine: 'dashed', skins: [{ palette: ['#d9714f'] }, { when: 'html.classic', palette: ['#d52b1e'] }] });
  assert.match(sk, /html\.classic \.pa-skin-[a-z0-9]+\{[^}]*#d52b1e/);
  assert.match(sk, /pa-rowlines/);
  assert.ok(lint({ ...dd, type: 'strip' }).suggestions.some((s) => s.code === 'fixedradius-swarm'));
});

// ── dendrogram ─────────────────────────────────────────────────────────────
const tree = [
  { id: 'root', parent: null, height: 15.4 },
  { id: 'n1', parent: 'root', height: 10.1 },
  { id: 'n2', parent: 'root', height: 5.4 },
  { id: 'b0', parent: 'n1', label: 'Los Ángeles · Curicó', sub: '70 comunas\n↑ apartments 1.6\n↓ income 19.7' },
  { id: 'b1', parent: 'n1', label: 'San Vicente · Molina', sub: '48 comunas' },
  { id: 'b2', parent: 'n2', label: 'Las Condes · Ñuñoa', sub: '5 comunas\n↑ apartments 71.6' },
  { id: 'b3', parent: 'n2', label: 'Huara · Camiña' },
];
const den = { type: 'dendrogram', data: tree, label: 'label', width: 600, locale: 'en' };
const axisTicks = (svg) => [...svg.matchAll(/<text x="([\d.]+)" y="[\d.]+" fill="[^"]+" font-size="11" text-anchor="middle">([^<]+)<\/text>/g)].map((m) => ({ x: +m[1], t: m[2] }));

test('dendrogram: the height axis takes as many ticks as fit its width', () => {
  const wide = axisTicks(plot(den));
  assert.equal(wide.length, 4);
  const narrow = axisTicks(plot({ ...den, treeWidth: 70, format: { decimals: 2, suffix: ' u.' } }));
  assert.ok(narrow.length >= 1 && narrow.length < 4, String(narrow.length));
  for (let i = 1; i < narrow.length; i++) assert.ok(Math.abs(narrow[i].x - narrow[i - 1].x) > 40, 'labels do not touch');
});

test('dendrogram tickFormat (or xFormat): the axis apart from format', () => {
  const svg = plot({ ...den, format: { decimals: 2 }, tickFormat: { decimals: 0 }, tooltip: true });
  assert.deepEqual(axisTicks(svg).map((t) => t.t), ['0', '5', '10', '15']);
  assert.ok(tips(svg).some((t) => /Height: 15\.40/.test(t)), 'tooltips keep format');
  assert.ok(axisTicks(plot({ ...den, format: { decimals: 2 }, xFormat: { suffix: ' d' } })).map((t) => t.t).includes('0 d'));
});

test('dendrogram sub with "\\n": several lines under the name, rows grow to fit', () => {
  const svg = plot({ ...den, sub: 'sub' });
  const t = texts(svg);
  for (const l of ['70 comunas', '↑ apartments 1.6', '↓ income 19.7', '↑ apartments 71.6']) assert.ok(t.includes(l), l);
  const y = (s) => +svg.match(new RegExp(`<text x="[\\d.]+" y="([\\d.]+)"[^>]*>${s}</text>`))[1];
  assert.ok(y('70 comunas') > y('Los Ángeles · Curicó') && y('↑ apartments 1.6') - y('70 comunas') === 13 && y('↓ income 19.7') - y('↑ apartments 1.6') === 13);
  // Taller than the one-line version, and the tooltip keeps each line.
  const one = plot({ ...den, data: tree.map((r) => (r.sub ? { ...r, sub: r.sub.split('\n')[0] } : r)), sub: 'sub' });
  assert.ok(heightOf(svg) > heightOf(one));
  assert.ok(tips(svg).some((s) => s.includes('70 comunas\n↑ apartments 1.6')));
});

// ── network ────────────────────────────────────────────────────────────────
test('network: an edge tooltip names each node by its full name (tooltip.title), not its short label', () => {
  const long = 'Ciencias económicas y administrativas';
  const nodes = [{ id: 'psi', label: 'Psicología', full: 'Psicología' }, { id: 'eco', label: 'Ciencias económicas y administrat…', full: long }, { id: 'c', label: 'C', full: 'Ciencia C' }];
  const spec = { type: 'network', data: [{ from: 'psi', to: 'eco', value: 2 }, { from: 'eco', to: 'c', value: 1 }], nodes, width: 600, height: 400, locale: 'en', tooltip: { title: 'full' } };
  const t = tips(plot(spec));
  assert.ok(t.some((s) => s.startsWith(`Psicología — ${long}`) || s.startsWith(`${long} — Psicología`)), t.join(' | '));
  // Without tooltip.title, the label as before.
  assert.ok(tips(plot({ ...spec, tooltip: undefined })).some((s) => s.includes('Ciencias económicas y administrat… — ') || s.includes(' — Ciencias económicas y administrat…')));
});

// ── heatmap ────────────────────────────────────────────────────────────────
const sectors = ['Agro', 'Pesca', 'Minería', 'Industria', 'Comercio'];
const fam = { Agro: 'Recursos', Pesca: 'Recursos', Minería: 'Minería', Industria: 'Industria', Comercio: 'Servicios' };
const regions = ['Arica', 'Tarapacá', 'Antofagasta'];
const grid = regions.flatMap((r, i) => sectors.map((s, j) => ({ sector: s, region: r, family: fam[s], d: ((i * 5 + j) % 7) - 3 })));
const hm = { type: 'heatmap', data: grid, x: 'sector', y: 'region', value: 'd', width: 600, locale: 'en' };
const DIV = ['#2166AC', '#4393C3', '#92C5DE', '#F4A582', '#D6604D', '#B2182B'];

test('heatmap midClass: diverging colors without the middle one; the mid color is inserted', () => {
  const breaks = [-2.5, -1.5, -0.5, 0.5, 1.5, 2.5];
  const six = plot({ ...hm, colorScale: { colors: DIV, breaks }, midClass: { color: '#f3ece0' } });
  const seven = plot({ ...hm, colorScale: { colors: [...DIV.slice(0, 3), '#f3ece0', ...DIV.slice(3)], breaks }, midClass: { color: '#f3ece0' } });
  assert.equal(six, seven);
  // "neutral": the theme tint goes in.
  const tint = plot({ ...hm, colorScale: { colors: DIV, breaks }, midClass: 'neutral' });
  assert.ok(safePlot({ ...hm, colorScale: { colors: DIV, breaks }, midClass: 'neutral' }).ok);
  assert.notEqual(tint, six);
  // Uneven: two breaks below 0, one above → the mid color is third.
  const uneven = plot({ ...hm, colorScale: { colors: ['#000001', '#000002', '#000003'], breaks: [-2, -1, 1] }, midClass: { color: '#f3ece0' } });
  assert.equal(uneven, plot({ ...hm, colorScale: { colors: ['#000001', '#000002', '#f3ece0', '#000003'], breaks: [-2, -1, 1] }, midClass: { color: '#f3ece0' } }));
  // reverse: inserted where the reversed list puts it.
  const rev = plot({ ...hm, colorScale: { colors: ['#000001', '#000002', '#000003'], breaks: [-2, -1, 1], reverse: true }, midClass: { color: '#f3ece0' } });
  assert.equal(rev, plot({ ...hm, colorScale: { colors: ['#000001', '#f3ece0', '#000002', '#000003'], breaks: [-2, -1, 1], reverse: true }, midClass: { color: '#f3ece0' } }));
  // Lint accepts it; without midClass, the short list is still an error.
  assert.ok(!lint({ ...hm, colorScale: { colors: DIV, breaks }, midClass: 'neutral' }).errors.some((e) => e.code === 'colorscale-breaks'));
  assert.equal(safePlot({ ...hm, colorScale: { colors: DIV, breaks } }).ok, false);
  // 0 on a break: nothing to insert, so the count must match.
  assert.equal(safePlot({ ...hm, colorScale: { colors: DIV.slice(0, 5), breaks: [-2, -1, 0, 1, 2] }, midClass: 'neutral' }).ok, false);
});

test('heatmap midClass insertion with CSS-variable colors and under skins', () => {
  const breaks = [-2.5, -1.5, -0.5, 0.5, 1.5, 2.5];
  const v = plot({ ...hm, colorScale: { colors: DIV, breaks }, midClass: { color: 'var(--neutro, #f3ece0)' } });
  assert.match(v, /var\(--neutro, #f3ece0\)/);
  const sk = plot({ ...hm, colorScale: { colors: DIV, breaks }, skins: [{ midClass: { color: '#f3ece0' } }, { when: 'html.classic', midClass: { color: '#f4f6f9' } }] });
  assert.match(sk, /html\.classic \.pa-skin-[a-z0-9]+\{[^}]*#f4f6f9/);
});

test('heatmap groupStripe "labels": the stripe between the column labels and the grid', () => {
  const colors = { Recursos: '#6e8b3d', Minería: '#b5651d', Servicios: '#5a6fae' };
  const top = plot({ ...hm, xGroup: 'family', groupColors: colors, xLabelPosition: 'top', groupStripe: 'labels' });
  const stripes = top.match(/<g class="pa-group-stripes">(.*?)<\/g>/s)[1];
  const rects = [...stripes.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="3" fill="([^"]+)"/g)];
  assert.equal(rects.length, 3);
  const firstCellY = Math.min(...[...top.matchAll(/<g class="pa-m"[^>]*><rect x="[\d.]+" y="([\d.]+)"/g)].map((m) => +m[1]));
  for (const r of rects) assert.ok(Math.abs(+r[2] + 5 - (firstCellY - 1)) < 1.01, `${r[2]} vs ${firstCellY}`);
  // The group band keeps the names, without stripes.
  const band = top.match(/<g class="pa-groups pa-groups-x">.*?<\/g>(?=<|$)/s)[0];
  assert.doesNotMatch(band, /height="3"/);
  assert.ok(texts(band).includes('Minería'));
  // Default ("grid") as before: the stripe on the band.
  assert.match(plot({ ...hm, xGroup: 'family', groupColors: colors, xLabelPosition: 'top' }).match(/<g class="pa-groups pa-groups-x">.*?<\/g>(?=<|$)/s)[0], /height="3"/);
  assert.equal(plot({ ...hm, xGroup: 'family', groupColors: colors, xLabelPosition: 'top', groupStripe: 'grid' }), plot({ ...hm, xGroup: 'family', groupColors: colors, xLabelPosition: 'top' }));
  // Rows: a vertical stripe left of the grid.
  const rows = plot({ ...hm, x: 'region', y: 'sector', yGroup: 'family', groupColors: colors, groupStripe: 'labels' });
  assert.match(rows, /<g class="pa-group-stripes"><rect x="[\d.]+" y="[\d.]+" width="3"/);
  // Under skins, and lint.
  const sk = plot({ ...hm, xGroup: 'family', xLabelPosition: 'top', groupStripe: 'labels', skins: [{ groupColors: { Minería: '#b5651d' } }, { when: 'html.classic', groupColors: { Minería: '#7a3e00' } }] });
  assert.match(sk, /html\.classic \.pa-skin-[a-z0-9]+\{[^}]*#7a3e00/);
  assert.ok(lint({ ...hm, xGroup: 'family', groupStripe: 'labels' }).suggestions.some((s) => s.code === 'groupstripe-no-colors'));
  assert.ok(lint({ ...hm, xGroup: 'family', groupColors: colors, groupStripe: 'label' }).errors.some((e) => e.code === 'enum-groupStripe'));
});
