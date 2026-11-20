import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plot, lint, toHTML, validatePalette, paletteFamilies, familyColors, palettes, ramps, themeFor, configure, safePlot } from '../src/index.js';

const FAMILIES = ['arcilla', 'nordico', 'tinta'];
const data = [{ r: 'A', v: 3 }, { r: 'B', v: 5 }, { r: 'C', v: 2 }, { r: 'D', v: 4 }];
const heat = ['x', 'y', 'z'].flatMap((a, i) => ['p', 'q'].map((b, j) => ({ a, b, n: i * 2 + j })));

test('cada familia minimalista pasa el validador en claro y en oscuro, en su orden', () => {
  for (const name of FAMILIES) {
    const f = paletteFamilies[name];
    assert.equal(f.colors.length, 5, name);
    assert.equal(f.dark.length, 5, name);
    assert.equal(f.minChroma, 0.04);
    for (const [mode, colors] of [['light', f.colors], ['dark', f.dark]]) {
      const r = validatePalette(colors, { mode, minChroma: f.minChroma });
      assert.ok(r.ok, `${name}/${mode}: ${r.checks.filter((c) => c.status === 'fail').map((c) => c.detail).join(' | ')}`);
      assert.equal(r.checks.find((c) => c.name === 'cvd').status, 'pass', `${name}/${mode} daltonismo`);
      // Los tres primeros se distinguen todos entre sí (dispersión, mapas).
      const r3 = validatePalette(colors.slice(0, 3), { mode, pairs: 'all', minChroma: f.minChroma });
      assert.equal(r3.checks.find((c) => c.name === 'cvd').status, 'pass', `${name}/${mode} primeros 3`);
      // Son apagadas a propósito: con el piso de fábrica se leerían como gris.
      assert.equal(validatePalette(colors, { mode }).checks.find((c) => c.name === 'chroma').status, 'fail');
    }
    assert.equal(f.sequential.length, 8);
    assert.equal(f.diverging.length, 7);
  }
});

test('palette: familia → categórica y rampas a juego, con variante oscura', () => {
  const t = themeFor({ palette: 'nordico' });
  assert.deepEqual(t.categorical, paletteFamilies.nordico.colors);
  assert.deepEqual(t.sequential, paletteFamilies.nordico.sequential);
  assert.deepEqual(t.diverging, paletteFamilies.nordico.diverging);
  const d = themeFor({ palette: 'nordico', theme: 'noche' });
  assert.deepEqual(d.categorical, paletteFamilies.nordico.dark);
  assert.deepEqual(d.sequential, paletteFamilies.nordico.sequentialDark);
  assert.deepEqual(familyColors('nordico', 'dark').categorical, paletteFamilies.nordico.dark);
  assert.equal(familyColors('nada'), null);
  // Rampa explícita, colormap o tema propio mandan sobre las de la familia.
  assert.deepEqual(themeFor({ palette: 'nordico', ramp: 'teal' }).sequential, ramps.teal);
  assert.equal(themeFor({ palette: 'nordico', colorScale: 'viridis' }).cmap, 'viridis');
  assert.deepEqual(themeFor({ palette: 'nordico', theme: { sequential: ['#fff', '#000'] } }).sequential, ['#fff', '#000']);
  // Nombres sueltos para theme.categorical y ramp.
  assert.deepEqual(palettes.tinta, paletteFamilies.tinta.colors);
  assert.deepEqual(palettes['tinta-noche'], paletteFamilies.tinta.dark);
  assert.deepEqual(ramps['tinta-diverging'], paletteFamilies.tinta.diverging);
  assert.ok(plot({ type: 'bar', data, x: 'r', y: 'v', series: 'r', palette: 'arcilla' }).includes(paletteFamilies.arcilla.colors[0]));
});

test('palettes: alternativas en un SVG, la página elige con data-palette', () => {
  const svg = plot({ type: 'bar', data, x: 'r', y: 'v', series: 'r', palettes: ['cdia', 'nordico', 'tinta'] });
  assert.match(svg, /\[data-palette="nordico"\] \.pa-skin-/);
  assert.match(svg, /\[data-palette="tinta"\] \.pa-skin-/);
  assert.ok(!svg.includes('data-palette="cdia"'), 'la primera va en los atributos, sin regla');
  for (const n of ['nordico', 'tinta']) assert.ok(svg.includes(paletteFamilies[n].colors[0]), n);
  // `palette` decide la de por defecto.
  const svg2 = plot({ type: 'bar', data, x: 'r', y: 'v', series: 'r', palette: 'tinta', palettes: ['nordico'] });
  assert.match(svg2, /fill="#3B538A"/i);
  assert.match(svg2, /\[data-palette="nordico"\]/);
  // true: todas las familias.
  const all = plot({ type: 'bar', data, x: 'r', y: 'v', series: 'r', palettes: true });
  for (const n of FAMILIES) assert.match(all, new RegExp(`\\[data-palette="${n}"\\]`));
});

test('palettes con rampas: el degradado de la leyenda no rompe la fusión', () => {
  const svg = plot({ type: 'heatmap', data: heat, x: 'a', y: 'b', value: 'n', palettes: ['cdia', 'arcilla'] });
  const ids = [...new Set(svg.match(/pa-ramp-[a-z0-9-]+/g))];
  assert.equal(ids.length, 1);
  assert.ok(svg.includes(`url(#${ids[0]})`));
  // Dos gráficos con la misma primera piel y otra alternativa no comparten id.
  const svg2 = plot({ type: 'heatmap', data: heat, x: 'a', y: 'b', value: 'n', palettes: ['cdia', 'nordico'] });
  assert.notEqual(svg2.match(/pa-ramp-[a-z0-9-]+/)[0], ids[0]);
  // Y en oscuro.
  assert.doesNotThrow(() => plot({ type: 'heatmap', data: heat, x: 'a', y: 'b', value: 'n', theme: 'noche', palettes: true }));
});

test('palettes: nombres inválidos y lint', () => {
  const r = safePlot({ type: 'bar', data, x: 'r', y: 'v', palettes: ['cdia', 'x"]{}'] });
  assert.equal(r.ok, false);
  const w = lint({ type: 'bar', data, x: 'r', y: 'v', palettes: ['cdia', 'bosqe'] });
  const m = w.warnings.find((i) => i.code === 'palette-unknown');
  assert.ok(m && /nordico/.test(m.fix), JSON.stringify(w.warnings));
  assert.equal(lint({ type: 'bar', data, x: 'r', y: 'v', palettes: true }).warnings.filter((i) => i.code === 'palette-unknown').length, 0);
  assert.equal(lint({ type: 'bar', data, x: 'r', y: 'v', series: 'r', palette: 'arcilla' }).warnings.filter((i) => /^palette-/.test(i.code)).length, 0);
  // Una lista propia igual de apagada sí avisa: el piso bajo es sólo para las familias.
  assert.ok(lint({ type: 'bar', data, x: 'r', y: 'v', series: 'r', palette: paletteFamilies.arcilla.colors }).warnings.some((i) => i.code === 'palette-chroma'));
  // Desde la 6ª serie, gris "Otros".
  const six = ['A', 'B', 'C', 'D', 'E', 'F'].map((r, i) => ({ r, v: i + 1 }));
  const t = themeFor({ palette: 'tinta' });
  assert.ok(plot({ type: 'bar', data: six, x: 'r', y: 'v', series: 'r', palette: 'tinta' }).includes(t.other));
  const max = lint({ type: 'bar', data: six, x: 'r', y: 'v', series: 'r', palette: 'tinta', locale: 'en' }).warnings.find((i) => i.code === 'series-max');
  assert.ok(max && /only 5 distinguishable/.test(max.message), JSON.stringify(max));
  assert.ok(!lint({ type: 'bar', data: six, x: 'r', y: 'v', series: 'r' }).warnings.some((i) => i.code === 'series-max'));
});

test('configure({ palettes }) y toHTML con botones', () => {
  configure({ palettes: ['cdia', 'arcilla'] });
  try {
    assert.match(plot({ type: 'bar', data, x: 'r', y: 'v', series: 'r' }), /\[data-palette="arcilla"\]/);
    // `palettes: null` la apaga para un gráfico.
    assert.ok(!/data-palette/.test(plot({ type: 'bar', data, x: 'r', y: 'v', series: 'r', palettes: null })));
  } finally { configure(null); }
  const html = toHTML([{ type: 'bar', data, x: 'r', y: 'v', series: 'r', palettes: ['cdia', 'nordico'] }], { lang: 'en' });
  assert.match(html, /<nav class="pa-palettes" aria-label="Color palette">/);
  assert.match(html, /data-palette="nordico"[^>]*><i/);
  assert.match(html, />Nordic</);
  assert.ok(!/pa-palettes/.test(toHTML([{ type: 'bar', data, x: 'r', y: 'v' }])));
});
