import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plot, safePlot } from '../src/index.js';

const yrs = [2018, 2020, 2022, 2024];
const base = { Minería: 90, Comercio: 70, Servicios: 75, Turismo: 30, Agro: 50 };
const grow = { Minería: -12, Comercio: 6, Servicios: 1, Turismo: 15, Agro: 2 };
const data = Object.keys(base).flatMap((s) => yrs.map((y, i) => ({ y, s, v: base[s] + grow[s] * i })));
const spec = { type: 'bump', data, x: 'y', y: 'v', series: 's', width: 640, locale: 'en' };

test('bump: rank 1 on top, names at both ends, places moved', () => {
  const svg = plot(spec);
  // 2018: Minería 1st; 2024: Turismo 75, Comercio 88, Servicios 78, Agro 56, Minería 54.
  assert.match(svg, />1\. Minería</);
  assert.match(svg, /data-tip="Comercio\n2024: #1 \(88\)"/);
  assert.match(svg, />▲2</); // Turismo: 5th → 3rd
  assert.match(svg, />▼4</); // Minería: 1st → 5th
});

test('bump: top N keeps series that were in the top at some period; the rest go to a "below" row', () => {
  const svg = plot({ ...spec, top: 2 });
  assert.match(svg, />below 2</);
  assert.doesNotMatch(svg, /data-tip="Agro/); // never in the top 2
});

test('bump: slope chart with ends, given ranks, narrow layout', () => {
  const slope = plot({ ...spec, type: 'slope' });
  assert.equal((slope.match(/data-tip="Minería/g) || []).length, 2);
  const ranked = plot({ type: 'bump', data: [{ t: 'a', s: 'X', r: 2 }, { t: 'a', s: 'Y', r: 1 }, { t: 'b', s: 'X', r: 1 }, { t: 'b', s: 'Y', r: 2 }], x: 't', rank: 'r', series: 's', locale: 'en' });
  assert.match(ranked, /data-tip="X\nb: #1"/);
  const narrow = plot({ ...spec, width: 358 });
  assert.match(narrow, />1\. Comercio</); // rank + name on the right when narrow
});

test('bump: needs series; highlight; skins; deterministic', () => {
  assert.equal(safePlot({ type: 'bump', data, x: 'y', y: 'v' }).ok, false);
  const hl = plot({ ...spec, highlight: 'Turismo' });
  assert.match(hl, /#CDD1E3/i); // the others take theme.dim
  const sk = plot({ ...spec, skins: [{ colors: { Turismo: '#d69a2e' } }, { when: 'html.classic', colors: { Turismo: '#7a6420' } }] });
  assert.match(sk, /html\.classic \.pa-skin-[a-z0-9]+\{[^}]*#7a6420/);
  assert.equal(plot(spec), plot(spec));
});
