import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plot, safePlot, lint, schema } from '../src/index.js';
import { plot as corePlot } from '../src/core.js';
import { plot as railOnly } from '../src/types/rail.js';
import { measure } from '../src/text.js';

const texts = (svg) => [...svg.matchAll(/>([^<>]+)<\/text>/g)].map((m) => m[1]);
const tips = (svg) => [...svg.matchAll(/data-tip="([^"]*)"/g)].map((m) => m[1].replace(/&#10;|\n/g, '\n'));
const circles = (svg) => [...svg.matchAll(/<circle [^>]*>/g)].map((m) => m[0]);
const chevrons = (svg) => [...svg.matchAll(/<path d="M[^"]*Z"/g)].map((m) => m[0]);

// ── type: "rail" ────────────────────────────────────────────────────────────
const row = { chile: 11.6, lo: 7.1, hi: 15.9, q1: 9.2, q3: 10.8, med: 9.9, reg: 10.5, loName: 'Colchane', hiName: 'Vitacura' };
const base = { type: 'rail', data: [row], value: 'chile', min: 'lo', max: 'hi', band: ['q1', 'q3'], median: 'med', locale: 'en' };

test('rail: a table-cell mark, 160 × 18 by default, with rail, band, median, refs and the dot', () => {
  const svg = plot({ ...base, refs: [{ field: 'reg', label: 'Biobío' }, { value: 12, label: 'Target' }], valueLabel: 'Chile' });
  assert.match(svg, /^<svg[^>]* width="160" height="18"/);
  assert.match(svg, /data-pa-type="rail"/);
  assert.equal(circles(svg).length, 1);
  assert.equal((svg.match(/<rect x="[\d.]+" y="5" width="[\d.]+" height="8" rx="2"/g) || []).length, 1, 'one band');
  // rail + median + two refs
  assert.equal((svg.match(/<line /g) || []).length, 4);
  const t = tips(svg);
  assert.equal(t.length, 1, 'one tooltip for the whole cell');
  assert.equal(t[0], 'Chile: 11.6\nRange: 7.1–15.9\nMiddle half: 9.2–10.8\nMedian: 9.9\nBiobío: 10.5\nTarget: 12');
  // No chrome: no title, axes or source drawn.
  assert.deepEqual(texts(svg), []);
});

test('rail: works at 130 and 330 px wide, and tucks the marks inside any height', () => {
  for (const width of [130, 330]) {
    const svg = plot({ ...base, width });
    assert.match(svg, new RegExp(`width="${width}" height="18"`));
    const cx = +/<circle cx="([\d.]+)"/.exec(svg)[1];
    assert.ok(cx > 5 && cx < width - 5, `${width}: ${cx}`);
  }
  const small = plot({ ...base, height: 12 });
  const r = +/<circle [^>]*r="([\d.]+)"/.exec(small)[1];
  assert.ok(r <= 4.5 && r >= 2, String(r));
});

test('rail: names the ends from fields, and every label may be text or a field', () => {
  const svg = plot({ ...base, minLabel: 'loName', maxLabel: 'hiName', valueLabel: 'Chile', bandLabel: 'Quartiles', medianLabel: 'Median commune' });
  assert.equal(tips(svg)[0], 'Chile: 11.6\nColchane: 7.1\nVitacura: 15.9\nQuartiles: 9.2–10.8\nMedian commune: 9.9');
});

test('rail: clip keeps the scale at min–max and draws a value past an end as a chevron', () => {
  const past = { ...row, chile: 24.4 };
  const stretched = plot({ ...base, data: [past] });
  const clipped = plot({ ...base, data: [past], clip: true });
  // Without clip the scale stretches to the value: a dot at the right end.
  assert.equal(circles(stretched).length, 1);
  assert.equal(chevrons(stretched).length, 0);
  // With clip: no dot, a chevron pointing right, and the tooltip says it.
  assert.equal(circles(clipped).length, 0);
  const [ch] = chevrons(clipped);
  assert.ok(ch, 'chevron');
  const xs = [...ch.matchAll(/([\d.]+),[\d.]+/g)].map((m) => +m[1]);
  assert.ok(Math.max(...xs) > 150 && xs[0] === Math.max(...xs), ch);
  assert.match(tips(clipped)[0], /^Chile: 24\.4 \(beyond the scale\)/);
  // The rail spans the whole track: the scale did not stretch.
  const rail = /<line x1="([\d.]+)" x2="([\d.]+)"/.exec(clipped);
  assert.ok(+rail[1] <= 7 && +rail[2] >= 153, rail[0]);
  // Past the low end, the chevron points left.
  const low = plot({ ...base, data: [{ ...row, chile: 2 }], clip: true });
  const lx = [...chevrons(low)[0].matchAll(/([\d.]+),[\d.]+/g)].map((m) => +m[1]);
  assert.ok(lx[0] === Math.min(...lx) && lx[0] < 8, chevrons(low)[0]);
});

test('rail: domain from fields (p5–p95) clips like clip, with a track and open chevrons for refs past it', () => {
  const data = [{ v: 33.3, p5: 35.2, p95: 43.4, reg: 38.6, cl: 38.1, far: 50 }];
  const svg = plot({ type: 'rail', data, value: 'v', domain: ['p5', 'p95'], refs: [{ field: 'reg', label: 'Biobío' }, { field: 'cl', label: 'Chile' }, { field: 'far', label: 'Far' }], domainLabel: 'Communes p5–p95', locale: 'en', format: (x) => x.toFixed(1) });
  assert.equal(circles(svg).length, 0);
  assert.equal(chevrons(svg).length, 1, 'the value is past the low end');
  assert.match(svg, /<path d="M[^"]*" fill="none"/, 'a ref past the end is an open chevron');
  assert.match(svg, /<line x1="6" x2="154"/, 'without min/max the track spans the domain');
  assert.equal(tips(svg)[0], 'V: 33.3 (beyond the scale)\nBiobío: 38.6\nChile: 38.1\nFar: 50.0 (beyond the scale)\nCommunes p5–p95: 35.2–43.4');
  // `domain` as numbers too.
  assert.equal(plot({ type: 'rail', value: 40, domain: [35, 45] }).includes('<circle'), true);
});

test('rail: no min/max (and no domain) prints the figure, never a lone dot', () => {
  const svg = plot({ type: 'rail', data: [{ v: 4.2, cl: 5 }], value: 'v', refs: ['cl'], format: (x) => `${x} %` });
  assert.equal(circles(svg).length, 0);
  assert.deepEqual(texts(svg), ['4.2 %']);
  const none = plot({ type: 'rail', data: [{ v: 4.2 }], value: 'v', fallback: 'none' });
  assert.equal(circles(none).length, 0);
  assert.deepEqual(texts(none), []);
  // One end missing is no range either.
  assert.equal(circles(plot({ type: 'rail', value: 3, min: 1 })).length, 0);
});

test('rail: format as a function in the tooltip; numbers without data', () => {
  const svg = plot({ type: 'rail', value: 0.5, min: 0, max: 1, median: 0.4, format: (v) => `${Math.round(v * 100)} pct`, valueLabel: 'Here' });
  assert.equal(tips(svg)[0], 'Here: 50 pct\nRango: 0 pct–100 pct\nMediana: 40 pct');
});

test('rail: colors per part, CSS variables and skins', () => {
  const svg = plot({ ...base, color: 'var(--azul, #0b3f8c)', colors: { rail: 'var(--ground-2, #e3e9f1)', band: '#dbe6f6' }, refs: [{ field: 'reg', color: 'var(--ink-3, #8496a8)' }] });
  assert.match(svg, /var\(--azul, #0b3f8c\)/);
  assert.match(svg, /var\(--ground-2, #e3e9f1\)/);
  assert.match(svg, /var\(--ink-3, #8496a8\)/);
  const skinned = plot({ ...base, skins: [{ theme: { categorical: ['#5a6fae'] } }, { when: 'html.classic', theme: { categorical: ['#0b3f8c'] } }] });
  assert.match(skinned, /html\.classic \.pa-skin-[a-z0-9]+\{[^}]*#0b3f8c/i);
  assert.equal(circles(skinned).length, 1);
});

test('rail: registered in the full entry, core and its own type entry; lint and schema know it', () => {
  for (const p of [plot, corePlot, railOnly]) assert.match(p({ type: 'rail', value: 1, min: 0, max: 2 }), /data-pa-type="rail"/);
  assert.equal(plot({ type: 'riel', value: 1, min: 0, max: 2 }), plot({ type: 'rail', value: 1, min: 0, max: 2 }));
  assert.ok(schema.properties.type.enum.includes('rail'));
  for (const k of ['min', 'max', 'median', 'refs', 'domain', 'clip', 'fallback', 'valueLabel', 'minLabel', 'maxLabel', 'domainLabel']) assert.ok(schema.properties[k], k);
  const ok = lint({ type: 'rail', value: 5, min: 0, max: 4, clip: true, refs: [{ value: 3, label: 'x' }] });
  assert.deepEqual(ok.errors, []);
  assert.deepEqual(ok.warnings, []);
  const bad = lint({ type: 'rail', data: [{ a: 1 }, { a: 2 }], value: 'a', min: 'nope', max: 3, refs: [{ label: 'q' }], fallback: 'dot', domain: [1] });
  const codes = [...bad.errors, ...bad.warnings].map((e) => e.code);
  for (const c of ['field', 'rail-refs', 'enum-fallback', 'rail-domain', 'rail-rows']) assert.ok(codes.includes(c), `${c}: ${codes}`);
  assert.ok(lint({ type: 'rail', value: 5 }).suggestions.some((s) => s.code === 'rail-no-range'));
  assert.equal(safePlot({ type: 'rail', value: 5, min: 0, max: 9 }).ok, true);
});

// ── table: range column ─────────────────────────────────────────────────────
const ind = [
  { name: 'Poverty', v: 17.3, lo: 2.1, hi: 41.5, q1: 9, q3: 22, med: 14.8, reg: 15, cl: 16, p5: 4, p95: 30 },
  { name: 'Schooling', v: 11.6, lo: 7.2, hi: 15.1, q1: 9.8, q3: 11.2, med: 10.4, reg: 11, cl: 11.2, p5: 8, p95: 14 },
  { name: 'Country only', v: 4.2 },
];
const col = { field: 'v', type: 'range', min: 'lo', max: 'hi', band: ['q1', 'q3'], median: 'med' };
const tbl = (c, data = ind, extra = {}) => ({ type: 'table', data, columns: ['name', c], locale: 'en', width: 640, ...extra });

test('table range: refs are ticks with their own labels; ref + refLabel is the same as one ref in refs', () => {
  const two = plot(tbl({ ...col, refs: [{ field: 'reg', label: 'Region' }, { field: 'cl', label: 'Chile' }] }));
  assert.ok(tips(two).some((t) => t.includes('Region: 15') && t.includes('Chile: 16')), tips(two).join(' ## '));
  assert.equal(plot(tbl({ ...col, ref: 'cl', refLabel: 'Chile' })), plot(tbl({ ...col, refs: [{ field: 'cl', label: 'Chile' }] })));
});

test('table range: a row without min/max prints only its number; a column without them keeps its dots', () => {
  const svg = plot(tbl(col));
  assert.equal(circles(svg).length, 2, 'two rails, not three');
  assert.ok(texts(svg).includes('4.2'));
  // A benchmark column (no min/max anywhere): every row keeps its dot on the shared scale.
  assert.equal(circles(plot(tbl({ field: 'v', type: 'range', ref: 'cl' }))).length, 3);
  // Phone cards follow the same rule.
  assert.equal(circles(plot(tbl(col, ind, { width: 358, cards: true }))).length, 2);
});

test('table range: clip and domain draw past-the-end values as chevrons', () => {
  const data = [{ name: 'A', v: 50, lo: 0, hi: 40 }, { name: 'B', v: 20, lo: 10, hi: 30 }];
  const svg = plot(tbl({ field: 'v', type: 'range', min: 'lo', max: 'hi', clip: true, scale: 'row' }, data));
  assert.equal(circles(svg).length, 1);
  assert.equal(chevrons(svg).length, 1);
  assert.ok(tips(svg).some((t) => /^A\nV: 50 \(beyond the scale\)/.test(t)), tips(svg).join(' ## '));
  // Shared clip: the column scale is the lowest min to the highest max (0–40).
  assert.equal(chevrons(plot(tbl({ field: 'v', type: 'range', min: 'lo', max: 'hi', clip: true }, data))).length, 1);
  // domain from fields (p5–p95 per row): Poverty 17.3 inside, Schooling inside, row 3 has no domain → number only.
  const dom = plot(tbl({ field: 'v', type: 'range', domain: ['p5', 'p95'], refs: [{ field: 'cl', label: 'Chile' }], domainLabel: 'p5–p95' }));
  assert.equal(circles(dom).length, 3, 'a column without min/max keeps its column scale for the row with no domain');
  assert.ok(tips(dom).some((t) => t.includes('p5–p95: 4.0–30.0')), tips(dom).join(' ## '));
});

// ── table: link column ──────────────────────────────────────────────────────
test('table link: site paths link in the same tab, full URLs in a new one, anything else is text', () => {
  const data = [
    { n: 'Lebu', u: '/es/comuna/lebu/' }, { n: 'INE', u: 'https://www.ine.gob.cl' }, { n: 'Bad', u: 'javascript:alert(1)' }, { n: 'Rel', u: './x' },
  ];
  const svg = plot({ type: 'table', data, columns: ['n', { field: 'u', type: 'link', text: 'n' }], width: 640 });
  assert.match(svg, /<a href="\/es\/comuna\/lebu\/" class="pa-link"><text[^>]*>Lebu<\/text><\/a>/);
  assert.match(svg, /<a href="\.\/x" class="pa-link">/);
  assert.match(svg, /<a href="https:\/\/www\.ine\.gob\.cl" target="_blank" rel="noopener noreferrer">/);
  assert.doesNotMatch(svg, /javascript:/);
  assert.doesNotMatch(svg, /href="\/es\/comuna\/lebu\/"[^>]*target=/);
});

// ── facets: y tick labels and panel colours ─────────────────────────────────
const quarters = [];
const LEVEL = { Unemployment: 10.4, Participation: 50.4, Employment: 55.4 };
for (const s of Object.keys(LEVEL)) for (let y = 2010; y < 2026; y++) for (let m = 1; m <= 12; m++) quarters.push({ s, d: `${y}-${String(m).padStart(2, '0')}`, v: LEVEL[s] + 2 * Math.sin((y * 12 + m - 24121) / 9) });
const fl = { type: 'line', data: quarters, x: 'd', y: 'v', series: 's', facet: 's', columns: 1, legend: false, panelHeight: 140, width: 820, yFormat: (v) => `${Math.round(v)}%` };

test('facet: a panel leaves room for its inside y tick labels, as a lone line chart does', () => {
  // (with one shared y scale the low series runs under its labels, not into them)
  for (const sharey of ['span', false]) {
    const svg = plot({ ...fl, sharey });
    const panels = svg.split(/<svg x="/).slice(1);
    const starts = panels.map((p) => +/<path d="M([\d.]+),/.exec(p.slice(p.indexOf('pa-body')))[1]);
    // Every panel: the line starts past the widest tick label of its own axis.
    panels.forEach((p, i) => {
      const labels = [...p.matchAll(/<g class="pa-axis pa-axis-y">(.*?)<\/g>/g)].flatMap((m) => [...m[1].matchAll(/<text x="([\d.]+)"[^>]*>([^<]+)</g)]);
      const right = Math.max(...labels.map((m) => +m[1] + measure(m[2], 12)));
      assert.ok(starts[i] > right, `sharey ${sharey}, panel ${i}: line at ${starts[i]}, labels end at ${right}`);
    });
    // And the x scale is the same in every panel.
    assert.equal(new Set(starts).size, 1, String(starts));
  }
});

test('facet: panelColor writes each panel name in its series colour (true, an object or a function)', () => {
  const titleFill = (svg) => [...svg.matchAll(/<g class="pa-header"><text [^>]*fill="([^"]+)"[^>]*>([^<]+)</g)].map((m) => [m[2], m[1]]);
  const plain = titleFill(plot(fl));
  assert.equal(new Set(plain.map((t) => t[1])).size, 1, 'default: one ink');
  const colors = { Unemployment: '#c0463c', Participation: '#2f6f4e', Employment: '#3a47b8' };
  const on = Object.fromEntries(titleFill(plot({ ...fl, colors, panelColor: true })));
  for (const k of Object.keys(colors)) assert.equal(on[k].toLowerCase(), colors[k], k);
  const fn = Object.fromEntries(titleFill(plot({ ...fl, panelColor: (k) => (k === 'Employment' ? '#111111' : null) })));
  assert.equal(fn.Employment, '#111111');
  assert.equal(fn.Unemployment, plain[0][1]);
  const obj = Object.fromEntries(titleFill(plot({ ...fl, panelColor: { Participation: 'var(--rojo, #c0463c)' } })));
  assert.match(obj.Participation, /#c0463c|var\(--rojo/);
  assert.equal(lint({ ...fl, panelColor: true }).warnings.filter((w) => w.code === 'unknown-option').length, 0);
});

// ── treemap labels ──────────────────────────────────────────────────────────
test('treemap shareOf: when the long figure does not fit, a shorter one instead of none', () => {
  const data = [{ f: 'A', l: 'Uno', v: 600 }, { f: 'A', l: 'Dos', v: 90 }, { f: 'A', l: 'Tres', v: 60 }, { f: 'B', l: 'Otro', v: 900 }];
  const spec = { type: 'treemap', data, path: ['f', 'l'], value: 'v', focus: ['A'], width: 360, height: 300, legend: false };
  const both = texts(plot({ ...spec, shareOf: 'both' }));
  assert.ok(both.includes('80% · 36% del total'), both.join('|'));
  assert.ok(both.includes('12%') && both.includes('8%'), 'the group share where both do not fit: ' + both.join('|'));
  const total = texts(plot({ ...spec, shareOf: 'total' }));
  assert.ok(total.includes('36% del total') && total.includes('5,5%'), total.join('|'));
});

test('treemap tileLabels "wrap": a tall tile writes more than three lines and still its share', () => {
  const data = [{ f: 'A', l: 'Servicios de alojamiento y de comidas para turistas', v: 140 }, { f: 'A', l: 'Otro', v: 860 }];
  const t = texts(plot({ type: 'treemap', data, path: ['f', 'l'], value: 'v', focus: ['A'], width: 720, height: 420, legend: false, tileLabels: 'wrap' }));
  const i = t.indexOf('14%');
  assert.ok(i > 0, t.join('|'));
  const name = t.slice(t.indexOf('Otro') + 2, i);
  assert.ok(name.length > 3, name.join('|'));
  assert.equal(name.join(' '), 'Servicios de alojamiento y de comidas para turistas');
});
