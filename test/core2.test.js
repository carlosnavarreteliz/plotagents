import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plot, lint, safePlot, toHTML, validatePalette, themes, getTheme, palettes, timeValues } from '../src/index.js';
import { logDomain, log } from '../src/scale.js';
import { statsGallery } from '../examples/specs-stats.js';
import { catGallery } from '../examples/specs-cat.js';
import { partsGallery } from '../examples/specs-parts.js';
import { moreGallery } from '../examples/specs-more.js';

const regiones = [];
for (const r of ['Arica', 'Tarapacá', 'Antofagasta', 'Atacama', 'Coquimbo', 'Valparaíso', 'Maule', 'Biobío'])
  for (let y = 2018; y <= 2025; y++) regiones.push({ region: r, año: y, pib: 10 + r.length * (y - 2017) });

test('toda la galería nueva se dibuja sin NaN en ambos temas', () => {
  for (const ex of [...statsGallery, ...catGallery, ...partsGallery, ...moreGallery]) {
    for (const theme of [undefined, 'noche']) {
      const svg = plot({ ...ex.spec, ...(theme && !ex.spec.theme ? { theme } : {}) });
      assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'), ex.id);
      assert.ok(!/NaN|undefined|object Object/.test(svg), `${ex.id} (${theme || 'papel'})`);
    }
  }
});

test('etiquetas al final de TODAS las líneas, sin leyenda redundante', () => {
  const svg = plot({ type: 'line', data: regiones, x: 'año', y: 'pib', series: 'region', height: 460 });
  assert.equal((svg.match(/class="pa-endlabel"/g) || []).length, 8);
  assert.ok(!svg.includes('class="pa-legend"'));
});

test('alias de seaborn', () => {
  const d = [];
  for (const s of ['A', 'B']) for (let i = 0; i < 20; i++) d.push({ s, v: i + (s === 'B' ? 5 : 0) });
  assert.equal(safePlot({ type: 'boxplot', data: d, x: 's', y: 'v' }).type, 'box');
  const bp = plot({ type: 'barplot', data: d, x: 's', y: 'v' });
  assert.match(bp, /IC /); // barras de error en el tooltip
  assert.ok(plot({ type: 'countplot', data: d, x: 's' }).includes('>20<'));
  assert.equal(lint({ type: 'lmplot', data: d, x: 'v', y: 'v' }).type, 'regplot');
});

test('facet: un panel por valor, con dominio compartido', () => {
  const svg = plot({ type: 'line', data: regiones, x: 'año', y: 'pib', facet: 'region', columns: 4 });
  assert.equal((svg.match(/<svg /g) || []).length, 9); // raíz + 8 paneles
  assert.match(svg, /data-pa-type="facet"/);
});

test('time: un periodo a la vez, el último por defecto', () => {
  const spec = { type: 'bar', data: regiones, x: 'region', y: 'pib', time: 'año' };
  assert.deepEqual(timeValues(spec).slice(0, 2), [2018, 2019]);
  assert.match(plot(spec), />2025</);
  assert.match(plot({ ...spec, timeValue: 2019 }), />2019</);
});

test('tema JSON: fusión profunda y paletas con nombre', () => {
  const t = getTheme({ extends: 'noche', categorical: 'okabe-ito', marks: { lineWidth: 3 }, type: { title: 26 } });
  assert.equal(t.surface, themes.noche.surface);
  assert.equal(t.categorical[0], palettes['okabe-ito'][0]);
  assert.equal(t.marks.lineWidth, 3);
  assert.equal(t.marks.barRadius, 4);
  const svg = plot({ data: [{ a: 'x', b: 1 }, { a: 'y', b: 2 }], title: 'Hola', theme: { type: { title: 30 } }, palette: ['#123456'] });
  assert.match(svg, /font-size="30"/);
  assert.match(svg, /#123456/);
});

test('las paletas de fábrica pasan el validador', () => {
  assert.ok(validatePalette(themes.papel.categorical, { mode: 'light', surface: themes.papel.surface }).ok);
  assert.ok(validatePalette(themes.noche.categorical, { mode: 'dark', surface: themes.noche.surface }).ok);
  assert.equal(validatePalette(['#3A47B8', '#3B48B9']).ok, false);
});

test('escala log: dominio 1-2-5 sin décadas vacías', () => {
  const d = logDomain(16, 141);
  assert.deepEqual([d.min, d.max], [10, 200]);
  assert.deepEqual(log(d.min, d.max, 0, 1).ticks(), [10, 20, 50, 100, 200]);
});

test('toHTML incluye la biblioteca para sliders y navegación', () => {
  const html = toHTML({ type: 'treemap', data: regiones, path: ['region'], value: 'pib', time: 'año' });
  assert.match(html, /plotagents\.render/);
  assert.ok(!/<\/script>(?![\s\S]*<\/body>)/.test(html.slice(0, 50)));
});

test('el color sigue a la entidad: entre periodos y al navegar por niveles', async () => {
  const { exportacionesAnuales: d } = await import('../examples/specs-more.js');
  const fillOf = (svg, name) => (new RegExp(`data-tip="${name}[^"]*"><rect[^>]*fill="(#[0-9A-F]{6})"`, 'i').exec(svg) || [])[1];
  const base = { type: 'treemap', data: d, path: ['sector', 'producto'], value: 'valor', time: 'año' };
  const a = fillOf(plot({ ...base, timeValue: 2018 }), 'Agro › Cerezas');
  const b = fillOf(plot({ ...base, timeValue: 2025 }), 'Agro › Cerezas');
  const top = fillOf(plot({ ...base, timeValue: 2025 }), 'Pesca y acuicultura › Salmón');
  const focused = fillOf(plot({ ...base, focus: ['Pesca y acuicultura'] }), 'Pesca y acuicultura › Salmón');
  assert.ok(a && a === b, `Agro cambió de color: ${a} → ${b}`);
  assert.ok(top && top === focused, `Pesca cambió de color al entrar: ${top} → ${focused}`);
});

test('muchos puntos: un path por color y capa de tooltip por cercanía', () => {
  let s = 3;
  const u = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const data = Array.from({ length: 4000 }, () => ({ x: u(), y: u(), g: u() < 0.5 ? 'A' : 'B' }));
  const svg = plot({ type: 'scatter', data, x: 'x', y: 'y', series: 'g' });
  assert.ok((svg.match(/<circle/g) || []).length <= 2); // solo la leyenda
  assert.match(svg, /class="pa-near"/);
  assert.ok(svg.length < 600_000);
});

test('títulos largos nunca se cortan y el margen se achica en móvil', () => {
  const title = 'Los usuarios de la aplicación móvil se multiplicaron por ciento setenta y seis en apenas cuatro años de operación';
  const svg = plot({ data: [{ a: 'x', b: 1 }, { a: 'y', b: 2 }], title, width: 360 });
  assert.ok(!svg.includes('…'));
  for (const w of title.split(' ')) assert.ok(svg.includes(w));
});
