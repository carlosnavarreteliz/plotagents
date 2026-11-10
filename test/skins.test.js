import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plot, safePlot, configure } from '../src/index.js';

const data = [
  { sector: 'Minería', y: 40 },
  { sector: 'Comercio', y: 25 },
  { sector: 'Servicios', y: 35 },
];
const base = { type: 'bar', data, x: 'sector', y: 'y', series: 'sector', width: 520, height: 280, locale: 'en' };
const skins = [
  { palette: ['#6e86c8', '#d9714f', '#19a17d'] },
  { when: 'html.classic', palette: ['#0b3f8c', '#d52b1e', '#1d7a74'] },
];

test('skins: one SVG carries every skin, the first in the attributes', () => {
  const svg = plot({ ...base, skins });
  // The default skin stays in the attributes (an <img> sees it).
  assert.match(svg, /fill="#6e86c8" style="fill:var\(--pa-s\d+\)"/);
  // The other skin only lives in the CSS, under its selector.
  assert.match(svg, /html\.classic \.pa-skin-[a-z0-9]+\{[^}]*#0b3f8c/);
  assert.doesNotMatch(svg.replace(/<style>.*?<\/style>/s, ''), /#0b3f8c/);
  // Same geometry as a plain render with the first skin.
  const plain = plot({ ...base, palette: skins[0].palette });
  const strip = (s) => s.replace(/<style>.*?<\/style>/s, '').replace(/\s?style="[^"]*var\(--pa-s[^"]*"/g, '').replace(/ pa-skin-[a-z0-9]+/, '');
  assert.equal(strip(svg), strip(plain));
});

test('skins: colors shared by every skin stay literal', () => {
  const svg = plot({ ...base, skins });
  // Text ink is the same in both skins: no variable for it.
  assert.doesNotMatch(svg, /fill="#4A5070" style="fill:var/);
});

test('skins: entity colors and themes per skin', () => {
  const svg = plot({
    ...base,
    skins: [
      { colors: { Minería: '#d69a2e' } },
      { when: 'html.classic', colors: { Minería: '#7a6420' }, theme: { surface: '#ffffff' } },
    ],
  });
  assert.match(svg, /html\.classic \.pa-skin-[a-z0-9]+\{[^}]*#7a6420/);
  assert.match(svg, /html\.classic \.pa-skin-[a-z0-9]+\{[^}]*#ffffff/);
});

test('skins: colors inside style attributes and <style> become var() with a fallback', () => {
  const svg = plot({ ...base, skins });
  assert.match(svg, /outline:2px solid var\(--pa-s\d+, #6e86c8\)/);
});

test('skins: a skin may only change colors', () => {
  assert.throws(() => plot({ ...base, skins: [{}, { when: 'html.x', data: [] }] }), /data/);
  assert.throws(() => plot({ ...base, skins: [{}, { palette: ['#000'] }] }), /when/);
  // Something other than colors changing (here the locale formats numbers differently).
  const r = safePlot({ ...base, skins: [{}, { when: 'html.x', locale: 'es', title: 'Otro' }] });
  assert.equal(r.ok, false);
});

test('skins: deterministic and identical to a plain render with one skin', () => {
  assert.equal(plot({ ...base, skins }), plot({ ...base, skins }));
  assert.equal(plot({ ...base, skins: [skins[0]] }), plot({ ...base, palette: skins[0].palette }));
});

test('skins: set once with configure(), turned off per chart with skins: null', () => {
  configure({ skins });
  try {
    assert.match(plot(base), /pa-skin-/);
    assert.doesNotMatch(plot({ ...base, skins: null }), /pa-skin-/);
  } finally {
    configure(null);
  }
});

test('skins: works across chart types', () => {
  const tm = plot({
    type: 'treemap', width: 500, height: 300,
    data: [{ g: 'A', k: 'a1', v: 3 }, { g: 'A', k: 'a2', v: 2 }, { g: 'B', k: 'b1', v: 4 }],
    path: ['g', 'k'], value: 'v', skins,
  });
  assert.match(tm, /pa-skin-/);
  const ln = plot({
    type: 'line', width: 500, height: 300,
    data: [{ t: 2020, s: 'A', v: 1 }, { t: 2021, s: 'A', v: 2 }, { t: 2020, s: 'B', v: 2 }, { t: 2021, s: 'B', v: 1 }],
    x: 't', y: 'v', series: 's', skins,
  });
  assert.match(ln, /stroke="#6e86c8"[^>]*style="[^"]*stroke:var\(--pa-s\d+\)/);
});

test('css vars: a var() color is drawn as the variable, computed with its fallback', () => {
  const svg = plot({ ...base, colors: { Minería: 'var(--accent, #0b3f8c)' } });
  assert.match(svg, /fill="#0b3f8c" style="fill:var\(--accent, #0b3f8c\)"/);
  // Without the variable, the SVG is the plain render with the fallback.
  const plain = plot({ ...base, colors: { Minería: '#0b3f8c' } });
  assert.equal(svg.replace(/ style="fill:var\(--accent, #0b3f8c\)"/g, ''), plain);
});

test('css vars: palettes and themes take them too; derived tints stay computed', () => {
  const svg = plot({
    type: 'area', width: 500, height: 280, data: [{ t: 2020, v: 1 }, { t: 2021, v: 3 }, { t: 2022, v: 2 }],
    x: 't', y: 'v', palette: ['var(--accent, #1d7a74)'], theme: { grid: 'var(--rule, #e5e7eb)' },
  });
  assert.match(svg, /stroke:var\(--accent, #1d7a74\)/);
  assert.match(svg, /stroke:var\(--rule, #e5e7eb\)/);
});

test('css vars: a var() without a usable fallback is an error with a fix', () => {
  const r = safePlot({ ...base, colors: { Minería: 'var(--accent)' } });
  assert.equal(r.ok, false);
  assert.match(JSON.stringify(r), /var\(--accent, #/);
});

test('css vars: nest under skins', () => {
  const svg = plot({ ...base, colors: { Minería: 'var(--accent, #0b3f8c)' }, skins: [{}, { when: 'html.classic', colors: { Minería: 'var(--accent, #6e86c8)' } }] });
  assert.match(svg, /fill:var\(--accent, var\(--pa-s\d+, #0b3f8c\)\)/);
});

test('format: a function writes labels, tooltips and ticks', () => {
  const svg = plot({ ...base, labels: true, format: (v) => `${v} u.` });
  assert.match(svg, />40 u\.</);
  assert.match(svg, /data-tip="[^"]*40 u\./);
  assert.equal(safePlot({ ...base, format: (v) => String(v) }).ok, true);
});
