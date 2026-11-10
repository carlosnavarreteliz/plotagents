// `bare`: the light SVG for tiny marks repeated in an HTML page (rails, sparks),
// its skins (page variables vs. per-page skin rules) and the rail options that
// came with it (railWidth, colors.bandStroke, outsideLabel, halo, tooltip.omit).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plot, skinCSS, lint } from '../src/index.js';

const row = { v: 12.3, pa: 10.1, cl: 14.2, lo: 5.5, hi: 22.5 };
// The PuroChile indicator-table rail: scale and band are the middle 90 %.
const track = {
  type: 'rail', locale: 'es', data: [row], value: 'v', domain: ['lo', 'hi'], band: ['lo', 'hi'],
  refs: [{ field: 'pa', label: 'Región del Biobío' }, { field: 'cl', label: 'Chile' }],
  valueLabel: 'Valor', bandLabel: '90 % central de este nivel', fallback: 'none', dotRadius: 4.75,
  title: 'Tasa de pobreza', width: 132, height: 15,
};
const v = (name, fb) => `var(${name}, ${fb})`;
// Two skins whose every rail colour is a page variable (only the fallbacks differ).
const pageSkins = [
  { theme: { surface: v('--paper', '#fbf7f1') }, colors: { rail: v('--ground-2', '#eee4d4'), band: v('--ground-2', '#eee4d4'), ref: v('--ink-3', '#9d9284'), value: v('--azul', '#5a6fae') } },
  { when: 'html:not(.painted)', theme: { surface: v('--paper', '#ffffff') }, colors: { rail: v('--ground-2', '#eef2f7'), band: v('--ground-2', '#eef2f7'), ref: v('--ink-3', '#8496a8'), value: v('--azul', '#0b3f8c') } },
];
// Two skins with literal colours that differ.
const litSkins = [{ palette: ['#6e86c8'] }, { when: 'html.classic', palette: ['#0b3f8c'], theme: { surface: '#ffffff' } }];

test('bare: no option set leaves the output as it was (bare: false is the default)', () => {
  assert.equal(plot({ ...track, bare: false }), plot(track));
  const svg = plot(track);
  assert.match(svg, /<style>/);
  assert.match(svg, /<title id=/);
  assert.match(svg, /max-width:100%/);
});

test('bare: a rail without style block, a11y chrome, empty groups or data-pa-*', () => {
  const svg = plot({ ...track, bare: true });
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 132 15" width="132" height="15" aria-hidden="true" class="pa-chart" data-tip="/);
  for (const re of [/<style/, /<title/, /<desc/, /role=/, /aria-labelledby/, /pa-header/, /pa-body/, /font-family/, /data-pa-/, /max-width/, /class="pa-m"/, /fill="transparent"/]) {
    assert.doesNotMatch(svg, re, String(re));
  }
  // Same marks: one rail, one band, both refs (one colour → one path), the dot.
  assert.equal((svg.match(/<rect/g) || []).length, 1);
  assert.equal((svg.match(/<circle/g) || []).length, 1);
  assert.match(svg, /<path d="M[\d.]+ 1V14M[\d.]+ 1V14"/);
  // The tooltip moved to the root: the whole box answers.
  assert.match(svg, /data-tip="Tasa de pobreza\nValor: 12,3\n/);
});

test('bare: draws the same geometry as the full rail', () => {
  const full = plot(track), bare = plot({ ...track, bare: true });
  const cx = (s) => (s.match(/<circle cx="([\d.]+)"/) || [])[1];
  assert.equal(cx(bare), cx(full));
  const xs = (s) => [...s.matchAll(/x1="([\d.]+)" x2="\1" y1="1"/g)].map((m) => m[1]);
  const ds = [...bare.matchAll(/M([\d.]+) 1V14/g)].map((m) => m[1]);
  assert.deepEqual(ds, xs(full));
  // A text fallback keeps its font (and the root says so) only when there is text.
  const txt = plot({ type: 'rail', data: [{ v: 3 }], value: 'v', bare: true });
  assert.match(txt, /<text /);
  assert.match(txt, /font-family=/);
  assert.match(txt, /font-variant-numeric/);
});

test('bare: a var() colour is written once, in the style, with its fallback', () => {
  const svg = plot({ ...track, bare: true, colors: { value: v('--azul', '#5a6fae') } });
  assert.match(svg, /<circle [^>]*style="fill:var\(--azul, #5a6fae\)"/);
  assert.doesNotMatch(svg, /fill="#5a6fae"/);
  // Without bare the attribute keeps the fallback, as before.
  assert.match(plot({ ...track, colors: { value: v('--azul', '#5a6fae') } }), /fill="#5a6fae" [^>]*style="fill:var\(--azul, #5a6fae\)"/);
});

test('bare + skins: page variables need no skin machinery', () => {
  const svg = plot({ ...track, bare: true, skins: pageSkins });
  assert.doesNotMatch(svg, /<style|pa-skin|--pa-/);
  // Each colour once, with the first skin's fallback; the page reassigns the variable.
  assert.match(svg, /style="stroke:var\(--ground-2, #eee4d4\)"/);
  assert.match(svg, /style="stroke:var\(--paper, #fbf7f1\);fill:var\(--azul, #5a6fae\)"/);
  assert.doesNotMatch(svg, /#eef2f7|#0b3f8c|#8496a8/);
  assert.doesNotMatch(svg, /(fill|stroke)="#(eee4d4|9d9284|5a6fae|fbf7f1)"/);
  assert.ok(svg.length < 700, `rail of ${svg.length} B`);
  assert.equal(skinCSS({ ...track, skins: pageSkins }), '');
});

test('bare + skins: literal colours that change get content-named variables and rules in the SVG', () => {
  const svg = plot({ ...track, bare: true, skins: litSkins });
  assert.match(svg, /class="pa-chart pa-skins"/);
  const css = (svg.match(/<style>(.*?)<\/style>/) || [])[1];
  assert.match(css, /^\.pa-skins\{--pa-[a-z0-9]+:#6e86c8;?[^}]*\}html\.classic \.pa-skins\{[^}]*#0b3f8c/);
  // The mark: one style declaration whose fallback is the first skin (no attribute).
  assert.match(svg, /fill:var\(--pa-[a-z0-9]+, #6e86c8\)/);
  assert.doesNotMatch(svg, /fill="#6e86c8"/);
  // The classic colour only lives in the rule.
  assert.doesNotMatch(svg.replace(/<style>.*?<\/style>/, ''), /#0b3f8c/);
});

test('bare + skins: { skinCSS: false } leaves the rules to skinCSS(), once per page', () => {
  const a = { ...track, bare: { skinCSS: false }, skins: litSkins };
  const b = { ...a, data: [{ ...row, v: 7 }], width: 318 };
  const sa = plot(a), sb = plot(b);
  assert.doesNotMatch(sa + sb, /<style/);
  // Same colours → same variable names in both SVGs.
  const names = (s) => [...new Set(s.match(/--pa-[a-z0-9]+/g))].sort();
  assert.deepEqual(names(sa), names(sb));
  const css = skinCSS([a, b]);
  assert.equal(css, skinCSS(a));
  for (const n of names(sa)) assert.equal(css.split(n + ':').length - 1, 2, `${n} once per skin`);
  assert.match(css, /^\.pa-skins\{[^}]+\}html\.classic \.pa-skins\{[^}]+\}$/);
  // The inline rules are the same text skinCSS returns.
  assert.ok(plot({ ...a, bare: true }).includes(`<style>${css}</style>`));
});

test('bare + skins: different page variables per skin become a skin variable of var()s', () => {
  const s = { type: 'rail', data: [row], value: 'v', min: 'lo', max: 'hi', bare: true, skins: [
    { colors: { value: v('--azul', '#5a6fae') } }, { when: 'html.c', colors: { value: v('--accent', '#0b3f8c') } },
  ] };
  const svg = plot(s);
  assert.match(svg, /fill:var\(--pa-[a-z0-9]+, var\(--azul, #5a6fae\)\)/);
  assert.match(svg, /html\.c \.pa-skins\{--pa-[a-z0-9]+:var\(--accent, #0b3f8c\)\}/);
});

test('bare + skins: a colour that is var() in one skin and literal in another is an error with a hint', () => {
  assert.throws(() => plot({ ...track, bare: true, skins: [{ colors: { value: v('--azul', '#5a6fae') } }, { when: 'html.c', colors: { value: '#0b3f8c' } }] }),
    (e) => /piel 2/.test(e.message) && /bare/.test(e.hint));
});

test('bare: spark, facet and table', () => {
  const data = [{ r: 'A', x: 1, y: 2 }, { r: 'A', x: 2, y: 3 }, { r: 'B', x: 1, y: 1 }, { r: 'B', x: 2, y: 5 }];
  const sp = plot({ type: 'spark', data: data.slice(0, 2), x: 'x', y: 'y', width: 100, height: 24, bare: true });
  assert.doesNotMatch(sp, /<style|<title|class="pa-m"|y="0"/);
  assert.match(sp, /data-tip="1\n2"/);
  // A facet of bare panels keeps each mark's colour style (only the root's is stripped).
  const f = plot({ type: 'line', data, x: 'x', y: 'y', facet: 'r', width: 400, height: 200, bare: true, palette: [v('--accent', '#123456')] });
  assert.match(f, /stroke:var\(--accent, #123456\)/);
  // A type's own CSS stays (table phone cards); the interaction rules go.
  const t = plot({ type: 'table', data, bare: true });
  assert.match(t, /<style>/);
  assert.doesNotMatch(t, /\.pa-m\{transition/);
});

test('rail: railWidth, colors.bandStroke and halo: false', () => {
  const svg = plot({ ...track, railWidth: 3, colors: { bandStroke: '#334455' }, halo: false });
  assert.match(svg, /<line [^>]*stroke-width="3"/);
  // The stroke sits inside the band: half a pixel in on every side.
  const plain = plot(track);
  const rect = (s) => (s.match(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/) || []).slice(1).map(Number);
  const [x, y, w, h] = rect(svg), [x0, y0, w0, h0] = rect(plain);
  assert.equal(x, x0 + 0.5); assert.equal(y, y0 + 0.5); assert.equal(w, w0 - 1); assert.equal(h, h0 - 1);
  assert.match(svg, /<rect [^>]*stroke="#334455" stroke-width="1"/);
  // No halo: the dot has no stroke; with it (default) a ring of the surface.
  assert.match(svg, /<circle [^>]*fill="[^"]+"\/>/);
  assert.match(plain, /<circle [^>]*stroke="#FCFBF9" stroke-width="1.5"/);
  // Past an end, the value chevron loses its ring too.
  const past = plot({ ...track, data: [{ ...row, v: 40 }], halo: false });
  assert.match(past, /<path d="M[^"]+Z" fill="[^"]+"\/>/);
});

test('rail: outsideLabel says how a value falls past the scale (rail and table range column)', () => {
  const svg = plot({ ...track, data: [{ ...row, v: 40 }], outsideLabel: 'más allá de la comuna más alta' });
  assert.match(svg, /Valor: 40 \(más allá de la comuna más alta\)/);
  assert.doesNotMatch(svg, /fuera de la escala/);
  const en = plot({ ...track, locale: 'en', data: [{ ...row, v: 40 }] });
  assert.match(en, /beyond the scale/);
  const t = plot({ type: 'table', locale: 'es', data: [{ n: 'A', v: 40, lo: 1, hi: 9 }], columns: ['n', { field: 'v', type: 'range', min: 'lo', max: 'hi', clip: true, scale: 'row', outsideLabel: 'sobre el máximo', halo: false }] });
  assert.match(t, /sobre el máximo/);
});

test('tooltip.omit drops one default line by name, keeping the rest', () => {
  const s = { ...track, bandLabel: 'Escala' };
  const tipOf = (svg) => (svg.match(/data-tip="([^"]*)"/) || [])[1];
  const all = tipOf(plot(s)).split('\n');
  assert.ok(all.some((l) => l.startsWith('Escala:')));
  const kept = tipOf(plot({ ...s, tooltip: { omit: ['Escala'] } })).split('\n');
  assert.deepEqual(kept, all.filter((l) => !l.startsWith('Escala:')));
  // By name, not by prefix: "Chile" does not drop "Chilean …"; a RegExp from JS.
  assert.ok(tipOf(plot({ ...s, refs: [{ field: 'cl', label: 'Chilean' }], tooltip: { omit: ['Chile'] } })).includes('Chilean: 14,2'));
  assert.doesNotMatch(tipOf(plot({ ...s, tooltip: { omit: [/^Región/] } })), /Región/);
  // Together with text: the default lines minus the omitted, then the text.
  const withText = tipOf(plot({ ...s, data: [{ ...row, note: 'Nota' }], tooltip: { omit: ['Escala'], text: 'note' } })).split('\n');
  assert.equal(withText.at(-1), 'Nota');
});

test('rail: without a title the first data line leads the data-tip (a host reads it as the heading)', () => {
  const { title, ...noTitle } = track;
  const tip = (plot({ ...noTitle, bare: true }).match(/data-tip="([^"]*)"/) || [])[1];
  assert.equal(tip.split('\n')[0], 'Valor: 12,3');
});

test('bare: lint knows the new options and asks for no title or source', () => {
  const r = lint({ ...track, title: undefined, bare: { skinCSS: false }, halo: false, railWidth: 3, outsideLabel: 'x', colors: { bandStroke: '#333' }, tooltip: { omit: ['Escala'] } });
  const codes = [...r.errors, ...r.warnings, ...r.suggestions].map((x) => x.code);
  assert.ok(!codes.includes('unknown-option'), codes.join());
  assert.ok(!codes.includes('title') && !codes.includes('source'), codes.join());
});
