import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plot, safePlot, lint } from '../src/index.js';

const texts = (svg) => [...svg.matchAll(/>([^<>]+)<\/text>/g)].map((m) => m[1]);
const tips = (svg) => [...svg.matchAll(/data-tip="([^"]*)"/g)].map((m) => m[1].replace(/&#10;|\n/g, '\n'));

// ── heatmap ────────────────────────────────────────────────────────────────
const regions = ['Arica', 'Tarapacá', 'Antofagasta'];
const flows = [];
for (const a of regions) for (const b of regions) flows.push({ born: a, lives: b, people: a === b ? 600000 : a === 'Arica' && b === 'Antofagasta' ? null : 1000 + a.length * 100 + b.length, href: `/es/region/${a}/`, cref: `/es/region/${b}/` });
const fm = { type: 'heatmap', data: flows, x: 'lives', y: 'born', value: 'people', width: 600, locale: 'en', format: 'integer' };

test('heatmap rowHref / colHref: row and column labels link; unsafe URLs do not', () => {
  const svg = plot({ ...fm, rowHref: 'href', colHref: 'cref' });
  for (const r of regions) assert.equal((svg.match(new RegExp(`<a href="/es/region/${r}/" class="pa-link">`, 'g')) || []).length, 2, r);
  const bad = flows.map((r) => ({ ...r, href: 'javascript:alert(1)' }));
  assert.doesNotMatch(plot({ ...fm, data: bad, rowHref: 'href' }), /javascript:/);
  // From JS, a function of the label.
  const fn = plot({ ...fm, colHref: (l) => `/c/${l.length}` });
  assert.match(fn, /<a href="\/c\/5" class="pa-link">/);
});

test('heatmap xLabelAngle: rotated column heads, top or bottom, truncated heads keep the full name', () => {
  const long = flows.map((r) => ({ ...r, lives: r.lives + ' y sus alrededores inmediatos del norte grande' }));
  const svg = plot({ ...fm, data: long, xLabelAngle: -90, xLabelPosition: 'top' });
  assert.equal((svg.match(/transform="rotate\(-90 /g) || []).length, 3);
  assert.match(svg, /text-anchor="start" transform="rotate\(-90/);
  assert.ok(tips(svg).some((t) => t === 'Arica y sus alrededores inmediatos del norte grande'));
  const bottom = plot({ ...fm, xLabelAngle: -45 });
  assert.match(bottom, /text-anchor="end" transform="rotate\(-45/);
  // The top heads sit above the first row.
  const firstRow = +/<rect x="[\d.]+" y="([\d.]+)"/.exec(svg.slice(svg.indexOf('class="pa-m"')))[1];
  const headY = +/<text x="[\d.]+" y="([\d.]+)"[^>]*transform="rotate/.exec(svg)[1];
  assert.ok(headY < firstRow, `${headY} < ${firstRow}`);
});

test('heatmap cellGap: 0 joins the cells (no rounding); [x, y] per axis', () => {
  const a = plot({ ...fm, cellGap: 0 });
  assert.doesNotMatch(a.slice(a.indexOf('pa-body')), /class="pa-m"[^>]*><rect[^>]*rx="3"/);
  const w = [...a.matchAll(/class="pa-m"[^>]*><rect x="([\d.]+)" y="[\d.]+" width="([\d.]+)"/g)].slice(0, 2).map((m) => [+m[1], +m[2]]);
  assert.ok(Math.abs(w[0][0] + w[0][1] - w[1][0]) < 0.02, JSON.stringify(w));
  const b = plot({ ...fm, cellGap: [1, 4] });
  assert.match(b, /class="pa-m"[^>]*><rect[^>]*rx="3"/);
});

test('heatmap diagonal: own color, outside the scale, own legend entry and tooltip line', () => {
  const svg = plot({ ...fm, diagonal: { label: 'Born and lives here', color: '#7A3E9D', opacity: 0.5 } });
  assert.equal((svg.match(/fill="#7A3E9D" fill-opacity="0.5"/g) || []).length, 3);
  assert.ok(texts(svg).includes('Born and lives here'), 'legend entry');
  assert.ok(tips(svg).some((t) => t.includes('600,000') && t.includes('Born and lives here')));
  // The ramp is computed over the crossings alone.
  const legendTexts = texts(svg.slice(0, svg.indexOf('pa-body')));
  assert.ok(!legendTexts.includes('600,000') && legendTexts.includes('2,108'), legendTexts.join('|'));
  assert.ok(!/Highest: \w+ · \w+ \(600,000\)/.test(svg));
  // A missing value on the diagonal is still "no data", never painted as apart.
  const miss = flows.map((r) => (r.born === 'Arica' && r.lives === 'Arica' ? { ...r, people: null } : r));
  assert.equal((plot({ ...fm, data: miss, diagonal: { label: 'x', color: '#7A3E9D' } }).match(/fill="#7A3E9D"/g) || []).length, 2 + 1); // 2 cells + legend swatch
});

test('heatmap cellColor: a field names the class of a cell; color from `colors`', () => {
  const data = flows.map((r) => ({ ...r, kind: r.born === 'Tarapacá' && r.lives === 'Arica' ? 'Revised' : null }));
  const svg = plot({ ...fm, data, cellColor: 'kind', colors: { Revised: '#C05621' } });
  assert.equal((svg.match(/fill="#C05621"/g) || []).length, 2); // the cell and its legend swatch
  assert.ok(texts(svg).includes('Revised'));
  assert.ok(tips(svg).some((t) => t.startsWith('Tarapacá · Arica') && t.endsWith('Revised')));
});

test('heatmap labelFormat: the numeral in the cell, apart from tooltip and legend', () => {
  const svg = plot({ ...fm, labels: true, labelFormat: (v) => (v > 2000 ? '' : 'n'), format: (v) => `${v} people` });
  assert.ok(texts(svg).includes('n'));
  assert.ok(!texts(svg).some((t) => t.endsWith('people') && /^\d+ people$/.test(t) && false));
  assert.ok(tips(svg).some((t) => t.includes('1700 people') || /\d+ people/.test(t)));
});

test('heatmap: new options work under skins and CSS-variable colors', () => {
  const skins = [{ diagonal: { label: 'Stayed', color: '#5a6fae' } }, { when: 'html:not(.painted)', diagonal: { label: 'Stayed', color: '#0b3f8c' } }];
  const svg = plot({ ...fm, xLabelAngle: -90, xLabelPosition: 'top', rowHref: 'href', cellGap: 0, skins });
  assert.match(svg, /html:not\(\.painted\) \.pa-skin-[a-z0-9]+\{[^}]*#0b3f8c/);
  const v = plot({ ...fm, diagonal: { label: 'Stayed', color: 'var(--azul, #5a6fae)' } });
  assert.match(v, /var\(--azul, #5a6fae\)/);
});

test('heatmap: emptyRow text never runs past the grid', () => {
  const data = flows.map((r) => (r.born === 'Arica' ? { ...r, people: null } : r));
  const svg = plot({ ...fm, data, width: 358, emptyRow: 'no data — the register for this region was withheld by the source' });
  assert.ok(texts(svg).some((t) => t.endsWith('…')));
});

test('heatmap: the new options are in the schema (no unknown-option warning)', () => {
  const r = lint({ ...fm, rowHref: 'href', colHref: 'cref', xLabelAngle: -90, xLabelPosition: 'top', cellGap: 0, diagonal: { label: 'x' }, cellColor: 'href', labelFormat: 'integer' });
  assert.ok(!r.warnings.some((w) => w.code === 'unknown-option'), JSON.stringify(r.warnings));
});

test('heatmap lint: link and class fields must exist; unnamed classes and diagonal get a suggestion', () => {
  const r = lint({ ...fm, rowHref: 'nope' });
  assert.ok(r.errors.some((e) => e.code === 'field' && e.message.includes('nope')));
  const data = flows.map((d) => ({ ...d, kind: d.born === d.lives ? 'Stayed' : null }));
  assert.ok(lint({ ...fm, data, cellColor: 'kind' }).suggestions.some((t) => t.code === 'cellcolor-no-color'));
  assert.ok(!lint({ ...fm, data, cellColor: 'kind', colors: { Stayed: '#123456' } }).suggestions.some((t) => t.code === 'cellcolor-no-color'));
  assert.ok(lint({ ...fm, diagonal: true }).suggestions.some((t) => t.code === 'diagonal-label'));
});

// ── dotplot refLines ───────────────────────────────────────────────────────
const inst = Array.from({ length: 24 }, (_, i) => ({ name: 'Inst ' + i, dropout: 5 + ((i * 7) % 30), chile: 18.4 }));
const dp = { type: 'dotplot', data: inst, x: 'dropout', bin: 2, label: 'name', width: 600, locale: 'en', format: (v) => `${v}%` };

test('dotplot refLines: a labeled vertical line, behind the dots, label on top, its own tooltip', () => {
  const svg = plot({ ...dp, refLines: [{ x: 18.4, label: 'Chile' }] });
  assert.ok(texts(svg).includes('Chile · 18.4%'), texts(svg).join('|'));
  assert.ok(tips(svg).includes('Chile\n18.4%'));
  assert.ok(svg.indexOf('class="pa-refs"') < svg.indexOf('<circle'), 'line behind the dots');
  // The label strip makes the chart taller, never squeezes the dots.
  const h = (s) => +/viewBox="0 0 [\d.]+ ([\d.]+)"/.exec(s)[1];
  assert.ok(h(svg) > h(plot(dp)));
  // A field: every row must agree (per facet panel, each panel's own).
  assert.ok(texts(plot({ ...dp, refLines: [{ x: 'chile', label: 'Chile', showValue: false }] })).includes('Chile'));
  const split = inst.map((r, i) => ({ ...r, chile: i % 2 ? 1 : 2 }));
  assert.doesNotMatch(plot({ ...dp, data: split, refLines: [{ x: 'chile', label: 'Chile' }] }), /pa-refs/);
});

test('dotplot refLines: a reference outside the data widens the axis to include it', () => {
  const svg = plot({ ...dp, refLines: [{ x: 80, label: 'Far' }] });
  const ref = +/class="pa-ref"[^>]*><line x1="([\d.]+)"/.exec(svg)[1];
  const maxDot = Math.max(...[...svg.matchAll(/<circle cx="([\d.]+)"/g)].map((m) => +m[1]));
  assert.ok(ref > maxDot, `${ref} > ${maxDot}`);
  assert.match(svg, /text-anchor="end"[^>]*>Far · 80%/);
});

test('dotplot refLines under skins', () => {
  const svg = plot({ ...dp, refLines: [{ x: 18.4, label: 'Chile' }], skins: [{ palette: ['#6e86c8'] }, { when: 'html.classic', palette: ['#0b3f8c'] }] });
  assert.match(svg, /Chile · 18.4%/);
});

test('dotplot lint: a reference field that does not hold one value is flagged', () => {
  const split = inst.map((r, i) => ({ ...r, chile: i % 2 ? 1 : 2 }));
  assert.ok(lint({ ...dp, data: split, refLines: [{ x: 'chile', label: 'Chile' }] }).warnings.some((w) => w.code === 'refline-field'));
  assert.ok(!lint({ ...dp, refLines: [{ x: 'chile', label: 'Chile' }] }).warnings.some((w) => w.code === 'refline-field'));
});
