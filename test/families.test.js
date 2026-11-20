import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plot, lint, toHTML, validatePalette, paletteFamilies, familyColors, palettes, ramps, themeFor, configure, safePlot } from '../src/index.js';

const FAMILIES = ['terracota', 'bosque', 'oceano', 'atardecer', 'jardin', 'retro'];
const data = [{ r: 'A', v: 3 }, { r: 'B', v: 5 }, { r: 'C', v: 2 }, { r: 'D', v: 4 }];
const heat = ['x', 'y', 'z'].flatMap((a, i) => ['p', 'q'].map((b, j) => ({ a, b, n: i * 2 + j })));

test('cada familia pasa el validador en claro y en oscuro, en su orden', () => {
  for (const name of FAMILIES) {
    const f = paletteFamilies[name];
    assert.equal(f.colors.length, 8, name);
    assert.equal(f.dark.length, 8, name);
    for (const [mode, colors] of [['light', f.colors], ['dark', f.dark]]) {
      const r = validatePalette(colors, { mode });
      assert.ok(r.ok, `${name}/${mode}: ${r.checks.filter((c) => c.status === 'fail').map((c) => c.detail).join(' | ')}`);
      assert.equal(r.checks.find((c) => c.name === 'cvd').status, 'pass', `${name}/${mode} daltonismo`);
      // Los tres primeros se distinguen todos entre sí (dispersión, mapas).
      const r3 = validatePalette(colors.slice(0, 3), { mode, pairs: 'all' });
      assert.equal(r3.checks.find((c) => c.name === 'cvd').status, 'pass', `${name}/${mode} primeros 3`);
    }
    assert.equal(f.sequential.length, 8);
    assert.equal(f.diverging.length, 7);
  }
});

test('palette: familia → categórica y rampas a juego, con variante oscura', () => {
  const t = themeFor({ palette: 'bosque' });
  assert.deepEqual(t.categorical, paletteFamilies.bosque.colors);
  assert.deepEqual(t.sequential, paletteFamilies.bosque.sequential);
  assert.deepEqual(t.diverging, paletteFamilies.bosque.diverging);
  const d = themeFor({ palette: 'bosque', theme: 'noche' });
  assert.deepEqual(d.categorical, paletteFamilies.bosque.dark);
  assert.deepEqual(d.sequential, paletteFamilies.bosque.sequentialDark);
  assert.deepEqual(familyColors('bosque', 'dark').categorical, paletteFamilies.bosque.dark);
  assert.equal(familyColors('nada'), null);
  // Rampa explícita, colormap o tema propio mandan sobre las de la familia.
  assert.deepEqual(themeFor({ palette: 'bosque', ramp: 'teal' }).sequential, ramps.teal);
  assert.equal(themeFor({ palette: 'bosque', colorScale: 'viridis' }).cmap, 'viridis');
  assert.deepEqual(themeFor({ palette: 'bosque', theme: { sequential: ['#fff', '#000'] } }).sequential, ['#fff', '#000']);
  // Nombres sueltos para theme.categorical y ramp.
  assert.deepEqual(palettes.oceano, paletteFamilies.oceano.colors);
  assert.deepEqual(palettes['oceano-noche'], paletteFamilies.oceano.dark);
  assert.deepEqual(ramps['oceano-diverging'], paletteFamilies.oceano.diverging);
  assert.ok(plot({ type: 'bar', data, x: 'r', y: 'v', series: 'r', palette: 'retro' }).includes(paletteFamilies.retro.colors[0]));
});

test('palettes: alternativas en un SVG, la página elige con data-palette', () => {
  const svg = plot({ type: 'bar', data, x: 'r', y: 'v', series: 'r', palettes: ['cdia', 'bosque', 'oceano'] });
  assert.match(svg, /\[data-palette="bosque"\] \.pa-skin-/);
  assert.match(svg, /\[data-palette="oceano"\] \.pa-skin-/);
  assert.ok(!svg.includes('data-palette="cdia"'), 'la primera va en los atributos, sin regla');
  for (const n of ['bosque', 'oceano']) assert.ok(svg.includes(paletteFamilies[n].colors[0]), n);
  // `palette` decide la de por defecto.
  const svg2 = plot({ type: 'bar', data, x: 'r', y: 'v', series: 'r', palette: 'retro', palettes: ['bosque'] });
  assert.match(svg2, /fill="#06A094"/i);
  assert.match(svg2, /\[data-palette="bosque"\]/);
  // true: todas las familias.
  const all = plot({ type: 'bar', data, x: 'r', y: 'v', series: 'r', palettes: true });
  for (const n of FAMILIES) assert.match(all, new RegExp(`\\[data-palette="${n}"\\]`));
});

test('palettes con rampas: el degradado de la leyenda no rompe la fusión', () => {
  const svg = plot({ type: 'heatmap', data: heat, x: 'a', y: 'b', value: 'n', palettes: ['cdia', 'terracota'] });
  const ids = [...new Set(svg.match(/pa-ramp-[a-z0-9-]+/g))];
  assert.equal(ids.length, 1);
  assert.ok(svg.includes(`url(#${ids[0]})`));
  // Dos gráficos con la misma primera piel y otra alternativa no comparten id.
  const svg2 = plot({ type: 'heatmap', data: heat, x: 'a', y: 'b', value: 'n', palettes: ['cdia', 'bosque'] });
  assert.notEqual(svg2.match(/pa-ramp-[a-z0-9-]+/)[0], ids[0]);
  // Y en oscuro.
  assert.doesNotThrow(() => plot({ type: 'heatmap', data: heat, x: 'a', y: 'b', value: 'n', theme: 'noche', palettes: true }));
});

test('palettes: nombres inválidos y lint', () => {
  const r = safePlot({ type: 'bar', data, x: 'r', y: 'v', palettes: ['cdia', 'x"]{}'] });
  assert.equal(r.ok, false);
  const w = lint({ type: 'bar', data, x: 'r', y: 'v', palettes: ['cdia', 'bosqe'] });
  const m = w.warnings.find((i) => i.code === 'palette-unknown');
  assert.ok(m && /bosque/.test(m.fix), JSON.stringify(w.warnings));
  assert.equal(lint({ type: 'bar', data, x: 'r', y: 'v', palettes: true }).warnings.filter((i) => i.code === 'palette-unknown').length, 0);
  assert.equal(lint({ type: 'bar', data, x: 'r', y: 'v', palette: 'jardin' }).warnings.filter((i) => /^palette-/.test(i.code)).length, 0);
});

test('configure({ palettes }) y toHTML con botones', () => {
  configure({ palettes: ['cdia', 'jardin'] });
  try {
    assert.match(plot({ type: 'bar', data, x: 'r', y: 'v', series: 'r' }), /\[data-palette="jardin"\]/);
    // `palettes: null` la apaga para un gráfico.
    assert.ok(!/data-palette/.test(plot({ type: 'bar', data, x: 'r', y: 'v', series: 'r', palettes: null })));
  } finally { configure(null); }
  const html = toHTML([{ type: 'bar', data, x: 'r', y: 'v', series: 'r', palettes: ['cdia', 'bosque'] }], { lang: 'en' });
  assert.match(html, /<nav class="pa-palettes" aria-label="Color palette">/);
  assert.match(html, /data-palette="bosque"[^>]*><i/);
  assert.match(html, />Forest</);
  assert.ok(!/pa-palettes/.test(toHTML([{ type: 'bar', data, x: 'r', y: 'v' }])));
});
