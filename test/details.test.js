import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plot, safePlot } from '../src/index.js';

const tips = (svg) => svg.match(/data-tip="[^"]*"/g) || [];

test('tooltip: fields and text from the mark rows', () => {
  const svg = plot({
    type: 'bar', x: 'r', y: 'v', locale: 'en',
    data: [{ r: 'X', v: 3, share: 0.25, rank: 1, note: 'Line one\nLine two' }],
    tooltip: { fields: ['rank', { field: 'share', label: 'Share', format: 'percent' }], text: 'note' },
  });
  assert.match(svg, /data-tip="X\n3\nRank: 1\nShare: 25%\nLine one\nLine two"/);
});

test('tooltip: replace, title and a JS function', () => {
  const data = [{ r: 'X', v: 3, name: 'Long name X' }];
  assert.match(plot({ type: 'bar', x: 'r', y: 'v', data, tooltip: { title: 'name', replace: true, fields: ['v'] } }), /data-tip="Long name X\nV: 3"/);
  assert.match(plot({ type: 'bar', x: 'r', y: 'v', data, tooltip: (d) => ({ title: d.row.name, lines: [...d.lines, 'extra'] }) }), /data-tip="Long name X\n3\nextra"/);
  assert.doesNotMatch(plot({ type: 'bar', x: 'r', y: 'v', data, tooltip: false }), /data-tip=/);
});

test('tooltip: a group shows a field only when its rows agree', () => {
  const svg = plot({
    type: 'treemap', path: ['g', 'k'], value: 'v', tooltip: { text: 'd' },
    data: [{ g: 'A', k: 'a1', v: 3, d: 'one' }, { g: 'A', k: 'a2', v: 2, d: 'two' }, { g: 'B', k: 'b1', v: 4, d: 'three' }],
  });
  assert.ok(tips(svg).some((t) => /^data-tip="A\n[^"]*"$/.test(t) && !/one|two/.test(t)));
  assert.ok(tips(svg).some((t) => /A › a1[^"]*one/.test(t)));
});

test('tooltip: works on scatter, pyramid, donut and sankey', () => {
  assert.match(plot({ type: 'scatter', data: [{ x: 1, y: 2, n: 'P', a: 'x1.4' }], x: 'x', y: 'y', label: 'n', tooltip: { text: 'a' } }), /x1\.4/);
  assert.match(plot({ type: 'pyramid', data: [{ a: '0-4', s: 'M', v: 10, n: '10 people' }, { a: '0-4', s: 'F', v: 12, n: '12 people' }], age: 'a', sex: 's', value: 'v', tooltip: { text: 'n' } }), /10 people/);
  assert.match(plot({ type: 'donut', data: [{ l: 'a', v: 1, e: 'extra a' }, { l: 'b', v: 2 }], label: 'l', value: 'v', tooltip: { text: 'e' } }), /extra a/);
  assert.match(plot({ type: 'sankey', data: [{ f: 'a', t: 'b', v: 2, why: 'because' }], from: 'f', to: 't', value: 'v', tooltip: { text: 'why' } }), /because/);
});

test('line: crosshair false writes one tooltip column per x', () => {
  const data = [{ t: 2020, s: 'A', v: 1 }, { t: 2021, s: 'A', v: 2 }, { t: 2020, s: 'B', v: 2 }, { t: 2021, s: 'B', v: 1 }];
  const svg = plot({ type: 'line', data, x: 't', y: 'v', series: 's', crosshair: false });
  assert.deepEqual(tips(svg), ['data-tip="2020\nA: 1\nB: 2"', 'data-tip="2021\nA: 2\nB: 1"']);
  assert.doesNotMatch(svg, /data-cross=/);
});

test('line: band draws a given interval as is, with its label', () => {
  const data = [2020, 2021, 2022].map((t, i) => ({ t, v: 10 + i, lo: 8 + i, hi: 13 + i }));
  const svg = plot({ type: 'line', data, x: 't', y: 'v', band: { lower: 'lo', upper: 'hi', label: '80% interval' }, crosshair: false, locale: 'en' });
  assert.match(svg, /80% interval/);
  assert.match(svg, /data-tip="2020\n10 \(8–13\)"/);
  assert.equal(safePlot({ type: 'line', data, x: 't', y: 'v', band: { lower: 'nope', upper: 'hi' } }).ok, false);
});

test('bar: a missing value is not a zero', () => {
  const data = [{ r: 'A', s: 'Census', v: 10 }, { r: 'A', s: 'Survey', v: null }, { r: 'B', s: 'Census', v: 5 }, { r: 'B', s: 'Survey', v: 6 }];
  const svg = plot({ type: 'bar', data, x: 'r', y: 'v', series: 's', missingMark: 'n/a', locale: 'en' });
  assert.match(svg, /data-tip="A\nSurvey: no data"/);
  assert.match(svg, />n\/a</);
  assert.match(plot({ type: 'bar', data, x: 'r', y: 'v', series: 's', missingLabel: 's/d' }), /Survey: s\/d/);
});

test('bar: a format function also writes percent stacks (it gets the fraction)', () => {
  const svg = plot({ type: 'bar', horizontal: true, stack: 'percent', data: [{ c: 'X', s: 'a', v: 1 }, { c: 'X', s: 'b', v: 2 }], x: 'c', y: 'v', series: 's', format: (v) => `${(v * 100).toFixed(1)} pct` });
  assert.match(svg, /a: 33\.3 pct/);
});

test('xBands shade ranges on bar and line', () => {
  const bar = plot({ type: 'bar', data: ['Jan', 'Feb', 'Mar'].map((r, i) => ({ r, v: i + 1 })), x: 'r', y: 'v', sort: 'none', xBands: [{ from: 'Feb', to: 'Mar', label: 'Read' }] });
  assert.match(bar, /class="pa-xband"/);
  assert.match(bar, />Read</);
  const line = plot({ type: 'line', data: [2018, 2019, 2020].map((t, i) => ({ t, v: i })), x: 't', y: 'v', xBands: { from: 2019, to: 2020 } });
  assert.match(line, /class="pa-xband"/);
});

test('href: links on treemap tiles, bar names and dots; only safe URLs', () => {
  assert.match(plot({ type: 'treemap', data: [{ g: 'A', k: 'a', v: 1, u: '/a/' }], path: ['g', 'k'], value: 'v', href: 'u' }), /<a href="\/a\/"/);
  const bar = plot({ type: 'bar', horizontal: true, data: [{ r: 'Ok', v: 2, u: '/ok/' }, { r: 'Bad', v: 1, u: 'javascript:alert(1)' }], x: 'r', y: 'v', href: 'u' });
  assert.match(bar, /<a href="\/ok\/"/);
  assert.doesNotMatch(bar, /javascript:/);
  assert.match(plot({ type: 'scatter', data: [{ x: 1, y: 1, u: 'https://x.org/' }], x: 'x', y: 'y', href: 'u' }), /<a href="https:\/\/x\.org\/"/);
});

test('scatter: hollow dots are a second encoding without a second color', () => {
  const svg = plot({ type: 'scatter', data: [{ x: 1, y: 1, f: true }, { x: 2, y: 3, f: false }], x: 'x', y: 'y', filled: 'f' });
  const circles = svg.match(/<circle[^>]*class="pa-m"[^>]*>|<circle class="pa-m"[^>]*>/g);
  assert.equal(circles.length, 2);
  assert.ok(circles.some((c) => /fill="#FCFBF9"/.test(c) && /stroke="#3A47B8"/.test(c)));
});

test('sankey: node ids apart from labels, fixed columns, given order, stage headings, link colors', () => {
  const svg = plot({
    type: 'sankey', from: 'f', to: 't', value: 'v', order: 'given', stages: ['Region', 'Office', 'Country'], linkColor: ['source', 'target'],
    data: [{ f: 'r:2', t: 'a:2', v: 10 }, { f: 'a:2', t: 'p:CN', v: 8 }, { f: 'a:2', t: 'p:US', v: 2 }],
    nodes: [{ id: 'r:2', label: 'Antofagasta', column: 0 }, { id: 'a:2', label: 'Antofagasta', sub: 'customs', column: 1 }, { id: 'p:US', label: 'USA' }, { id: 'p:CN', label: 'China' }],
    colors: { 'p:CN': '#D52B1E' }, locale: 'en',
  });
  // Same label in two stages: two nodes, no cycle error.
  assert.equal((svg.match(/data-key="r:2"|data-key="a:2"/g) || []).length, 2);
  assert.match(svg, />Region<.*>Office<.*>Country</s);
  assert.match(svg, />customs</);
  // Second stage takes the target's color.
  assert.match(svg, /data-key="a:2→p:CN"[^>]*|fill="#D52B1E"[^>]*data-key="a:2→p:CN"/);
  // Given order: USA before China in the last column.
  assert.ok(svg.indexOf('>USA<') < svg.indexOf('>China<'));
});

test('facet: same span in every panel with its own floor, notes and panel annotations', () => {
  const data = [];
  for (const [k, b] of [['A', 8], ['B', 60]]) for (let t = 2010; t < 2020; t++) data.push({ k, t, v: b + Math.sin(t) * 2, n: `${k} note` });
  const svg = plot({ type: 'line', data, x: 't', y: 'v', facet: 'k', columns: 1, sharey: 'span', panelNote: 'n', annotations: [{ x: 2015, label: 'Change', panel: 'B' }] });
  const panels = svg.split('<svg x=').slice(1).map((p) => (p.match(/>(\d{1,2})</g) || []).map((x) => +x.slice(1, -1)));
  const spans = panels.map((t) => Math.max(...t) - Math.min(...t));
  assert.equal(spans[0], spans[1]);
  assert.notEqual(Math.min(...panels[0]), Math.min(...panels[1]));
  assert.match(svg, />A note</);
  assert.equal((svg.match(/>Change</g) || []).length, 1);
});
