// Mapas, quinta tanda: puntos livianos (marcadores y extremos de líneas),
// marcadores por vista, radio mínimo, tarjeta propia, un subconjunto de un
// sprite, extremos por valor, tamaño sin style en línea y rótulos en el borde.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plot, lint, mapSprite } from '../src/index.js';
import { attachSource } from '../src/interact.js';

const sq = (x, y, s = 9) => `M${x},${y}L${x + s},${y}L${x + s},${y + s}L${x},${y + s}Z`;
const strip = { paths: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`c${i}`, sq(i * 10, 0)])) };
const rows = Array.from({ length: 10 }, (_, i) => ({ id: `c${i}`, a: i + 1, b: 10 - i }));
const base = { type: 'choropleth', geo: strip, data: rows, key: 'id', value: 'a', width: 600, labels: false, legend: false, locale: 'en' };
const pts = [
  { x: 5, y: 5, s: 10, c: '#aa0000', t: 'first' },
  { x: 35, y: 5, s: 1, c: '#00aa00', t: 'second' },
  { x: 75, y: 5, s: 4, c: '#aa0000', t: 'third' },
];
const dots = (svg) => [...svg.matchAll(/<circle class="pa-m[^"]*"[^>]*>/g)].map((m) => m[0]);
const group = (svg, cls = 'pa-markers') => (svg.match(new RegExp(`<g class="${cls}[^"]*"[^>]*>`)) || [])[0];
const attr = (tag, a) => (tag.match(new RegExp(`\\s${a}="([^"]*)"`)) || [])[1];
const css = (svg) => svg.match(/<style>(.*?)<\/style>/s)[1];
const codes = (r) => [...r.errors, ...r.warnings].map((x) => x.code);

// ── 1. Puntos livianos ──────────────────────────────────────────────────────
test('markers: border on the group, one class per color with one scoped rule; no per-dot fill, stroke, style or data-color', () => {
  const svg = plot({ ...base, markers: { data: pts, lon: 'x', lat: 'y', size: 's', color: 'c', label: 't', labels: false } });
  const G = group(svg);
  assert.ok(attr(G, 'stroke') && attr(G, 'stroke-width') === '1.5');
  const ds = dots(svg);
  assert.equal(ds.length, 3);
  for (const d of ds) {
    for (const a of ['fill', 'stroke', 'stroke-width', 'style', 'data-color']) assert.equal(attr(d, a), undefined, `${a} on ${d}`);
    assert.match(attr(d, 'class'), /^pa-m pk\d$/);
  }
  const scope = attr(G, 'class').split(' ')[1];
  assert.match(scope, /-dots$/);
  assert.ok(css(svg).includes(`.${scope} .pk0{fill:#aa0000}`));
  assert.ok(css(svg).includes(`.${scope} .pk1{fill:#00aa00}`));
  // Dos colores, dos reglas: los dos puntos rojos comparten clase.
  assert.equal(ds.filter((d) => d.includes('pk0')).length, 2);
});

test('markers of one color carry it on the group: no classes, no rules', () => {
  const svg = plot({ ...base, markers: { data: pts, lon: 'x', lat: 'y', label: 't', labels: false } });
  const G = group(svg);
  assert.ok(attr(G, 'fill'));
  assert.equal(attr(G, 'class'), 'pa-markers');
  assert.ok(dots(svg).every((d) => attr(d, 'class') === 'pa-m'));
  assert.doesNotMatch(css(svg), /\.pk\d/);
});

test('markers: stroke false / a color, strokeWidth, opacity and precision', () => {
  const m = { data: pts, lon: 'x', lat: 'y', size: 's', maxRadius: 9, labels: false };
  const off = plot({ ...base, markers: { ...m, stroke: false, opacity: 0.82, precision: 0 } });
  const G = group(off);
  assert.equal(attr(G, 'stroke'), undefined);
  assert.equal(attr(G, 'stroke-width'), undefined);
  assert.equal(attr(G, 'fill-opacity'), '0.82');
  for (const d of dots(off)) {
    assert.equal(attr(d, 'fill-opacity'), undefined);
    for (const a of ['cx', 'cy', 'r']) assert.match(attr(d, a), /^-?\d+$/);
  }
  const red = plot({ ...base, markers: { ...m, stroke: '#ff0000', strokeWidth: 0.5 } });
  assert.equal(attr(group(red), 'stroke'), '#ff0000');
  assert.equal(attr(group(red), 'stroke-width'), '0.5');
  // Sin opacity: 0,8 sólo en los puntos de más de 6 px (lo de siempre), sin el «1» de los chicos.
  const def = dots(plot({ ...base, markers: m }));
  assert.ok(def.some((d) => attr(d, 'fill-opacity') === '0.8'));
  assert.ok(def.every((d) => attr(d, 'fill-opacity') !== '1'));
  // `precision` cae a `pathPrecision`.
  assert.ok(dots(plot({ ...base, pathPrecision: 1, markers: m })).every((d) => /^-?\d+(\.\d)?$/.test(attr(d, 'cx'))));
  assert.throws(() => plot({ ...base, markers: { ...m, opacity: 2 } }), /opacity/);
  assert.throws(() => plot({ ...base, markers: { ...m, precision: 5 } }), /precision/);
});

test('markers under skins: the dots are identical, the rule changes color through a variable', () => {
  const skin = (c1, c2) => ({ markers: { data: pts.map((p, i) => ({ ...p, c: i === 1 ? c2 : c1 })), lon: 'x', lat: 'y', color: 'c', labels: false } });
  const svg = plot({ ...base, skins: [skin('#aa0000', '#00aa00'), { when: 'html.dark', ...skin('#ff8888', '#88ff88') }] });
  for (const d of dots(svg)) assert.equal(attr(d, 'style'), undefined);
  const c = css(svg);
  assert.match(c, /-dots \.pk0\{fill:var\(--pa-s\d+, #aa0000\)\}/);
  assert.match(c, /html\.dark \.pa-skin-[a-z0-9]+\{[^}]*#ff8888/);
});

test('markers with a CSS-variable color: the rule carries the variable (an attribute could not)', () => {
  const svg = plot({ ...base, markers: { data: pts, lon: 'x', lat: 'y', color: 'var(--accent, #0b3f8c)', labels: false } });
  assert.match(css(svg), /-dots \.pk0\{fill:var\(--accent, #0b3f8c\)\}/);
  assert.ok(dots(svg).every((d) => !/fill="var/.test(d)));
});

test('markers: a color that is not one falls back instead of reaching the <style>', () => {
  const svg = plot({ ...base, markers: { data: [{ x: 5, y: 5, c: 'red}body{display:none' }, { x: 15, y: 5, c: '#00aa00' }], lon: 'x', lat: 'y', color: 'c', labels: false } });
  assert.doesNotMatch(svg, /body\{display/);
});

test('markers with a legend keep data-color on the dots of the legend color (the key still lights them)', () => {
  const svg = plot({ ...base, legend: true, markers: { data: [{ x: 5, y: 5 }, { x: 15, y: 5, color: '#00aa00' }], lon: 'x', lat: 'y', color: '#aa0000', legend: 'Ports', labels: false } });
  const ds = dots(svg);
  assert.equal(ds.filter((d) => attr(d, 'data-color') === '#aa0000').length, 1);
});

test('link ends: one color goes on the group, several on classes; no per-dot fill', () => {
  const one = plot({ ...base, links: { data: [{ from: 'c0', to: 'c5', value: 3 }, { from: 'c0', to: 'c9', value: 1 }], ends: true } });
  const G = group(one, 'pa-link-ends');
  assert.ok(attr(G, 'fill'));
  const ends = [...one.matchAll(/<circle [^>]*data-key="c\d"[^>]*>/g)].map((m) => m[0]);
  assert.equal(ends.length, 3);
  assert.ok(ends.every((d) => attr(d, 'fill') === undefined));
  const two = plot({ ...base, links: { data: [{ from: 'c0', to: 'c5', value: 3, k: '#aa0000' }, { from: 'c0', to: 'c9', value: 1, k: '#00aa00' }], color: 'k', ends: true } });
  assert.match(attr(group(two, 'pa-link-ends'), 'class'), /-dots$/);
  assert.match(two, /<circle class="pk\d"/);
});

test('the runtime reads the color of a lean dot from its computed fill and lights a one-color group\'s dots', () => {
  assert.match(attachSource, /closest\('\.pa-markers,\.pa-link-ends'\)/);
  assert.match(attachSource, /classList\.contains\('pa-markers'\)/);
  assert.doesNotThrow(() => new Function(`return ${attachSource}`)());
});

// ── 2. Marcadores por vista ────────────────────────────────────────────────
test('views[].markers: one batch of points per view, in its pv group; markers: false leaves a view without', () => {
  const views = [
    { id: 'a', markers: { data: pts.slice(0, 2), lon: 'x', lat: 'y', labels: false } },
    { id: 'b', value: 'b', markers: { data: pts, lon: 'x', lat: 'y', labels: false, maxRadius: 4 } },
    { id: 'c', value: 'b', markers: false },
  ];
  const svg = plot({ ...base, views, viewSelector: '#m:has(input[value={id}]:checked)' });
  const by = (i) => (svg.match(new RegExp(`<g class="pv${i}"><g class="pa-markers[^]*?</g></g>`)) || [''])[0];
  assert.equal((by(0).match(/<circle/g) || []).length, 2);
  assert.equal((by(1).match(/<circle/g) || []).length, 3);
  assert.equal(by(2), '');
  // Las vistas ocultas se esconden con la regla de siempre.
  assert.match(css(svg), /\.pv1,[^{]*\{display:none\}/);
  assert.match(css(svg), /#m:has\(input\[value=b\]:checked\) \.pa-v[a-z0-9]+ \.pv1\{display:inline\}/);
  // Sin marcadores propios en ninguna vista: los del spec, una vez, como siempre.
  const shared = plot({ ...base, views: [{ id: 'a' }, { id: 'b', value: 'b' }], markers: { data: pts, lon: 'x', lat: 'y', labels: false } });
  assert.equal(dots(shared).length, 3);
  assert.doesNotMatch(shared, /<g class="pv\d"><g class="pa-markers/);
});

test('views[].markers: a view without its own takes the spec\'s', () => {
  const svg = plot({ ...base, markers: { data: pts.slice(0, 1), lon: 'x', lat: 'y', labels: false }, views: [{ id: 'a' }, { id: 'b', value: 'b', markers: { data: pts, lon: 'x', lat: 'y', labels: false } }] });
  assert.equal((svg.match(/<g class="pv0"><g class="pa-markers[^]*?<\/g><\/g>/)[0].match(/<circle/g) || []).length, 1);
  assert.equal((svg.match(/<g class="pv1"><g class="pa-markers[^]*?<\/g><\/g>/)[0].match(/<circle/g) || []).length, 3);
});

test('views[].markers share one class per color across views', () => {
  const v = (c) => ({ data: pts.map((p, i) => ({ ...p, c: i ? c : '#123456' })), lon: 'x', lat: 'y', color: 'c', labels: false });
  const svg = plot({ ...base, views: [{ id: 'a', markers: v('#aa0000') }, { id: 'b', value: 'b', markers: v('#aa0000') }] });
  assert.equal((css(svg).match(/\.pk\d\{fill/g) || []).length, 2);
});

// ── 3. Radio mínimo ─────────────────────────────────────────────────────────
test('markers.minRadius: the smallest dot of a size field (default 3)', () => {
  const m = { data: [{ x: 5, y: 5, s: 100 }, { x: 15, y: 5, s: 0.01 }], lon: 'x', lat: 'y', size: 's', maxRadius: 8, labels: false };
  const rs = (svg) => dots(svg).map((d) => +attr(d, 'r')).sort((a, b) => a - b);
  assert.deepEqual(rs(plot({ ...base, markers: m })), [3, 8]);
  assert.deepEqual(rs(plot({ ...base, markers: { ...m, minRadius: 0.75 } })), [0.75, 8]);
  assert.throws(() => plot({ ...base, markers: { ...m, minRadius: -1 } }), /minRadius/);
  assert.ok(codes(lint({ ...base, markers: { ...m, minRadius: 9 } })).includes('markers-min-radius'));
});

// ── 4. Tarjeta propia ───────────────────────────────────────────────────────
test('markers.tooltip: a function, fields or text over the marker row; markers.format apart from the map\'s', () => {
  const m = { data: pts, lon: 'x', lat: 'y', size: 's', label: 't', labels: false };
  const tips = (svg) => dots(svg).map((d) => attr(d, 'data-tip'));
  // Por omisión: rótulo y tamaño con el formato del mapa.
  assert.ok(tips(plot({ ...base, format: { suffix: ' u' }, markers: m })).includes('first\n10 u'));
  // `format` propio: el del mapa no lo toca.
  assert.ok(tips(plot({ ...base, format: { suffix: ' u' }, markers: { ...m, format: { suffix: ' pts' } } })).includes('first\n10 pts'));
  const fn = tips(plot({ ...base, markers: { ...m, tooltip: (d) => ({ title: d.title.toUpperCase(), lines: [`size ${d.row.s}`] }) } }));
  assert.ok(fn.includes('FIRST\nsize 10'));
  const fields = tips(plot({ ...base, markers: { ...m, tooltip: { fields: [{ field: 'c', label: 'Color' }] } } }));
  assert.ok(fields.includes('first\n10\nColor: #aa0000'));
  const text = tips(plot({ ...base, markers: { ...m, tooltip: { text: 't', replace: true } } }));
  assert.ok(text.includes('first\nfirst'));
  const none = plot({ ...base, markers: { ...m, tooltip: false } });
  assert.ok(dots(none).every((d) => attr(d, 'data-tip') === undefined));
});

// ── 5. Un subconjunto de un sprite ──────────────────────────────────────────
test('only + sprite: a region drawn alone keeps the whole file\'s frame, so the transform matches the full map\'s', () => {
  const box = [0, 0, 39, 9];
  const full = plot({ ...base, sprite: '/s.svg', fitTo: box, fitPadding: 0 });
  const sub = plot({ ...base, sprite: '/s.svg', fitTo: box, fitPadding: 0, only: ['c0', 'c1', 'c2', 'c3'] });
  const mat = (svg) => svg.match(/<g transform="(matrix\([^)]*\))"/)[1];
  assert.equal(mat(sub), mat(full));
  assert.equal((sub.match(/<use /g) || []).length, 4);
  // Los datos de lo que no se dibuja no son «sin coincidencia».
  assert.doesNotMatch(sub, /Unmatched/);
  // Sin `only` y con sólo esas formas en `geo`, el encuadre del archivo sería otro (el problema de antes).
  const alone = plot({ ...base, geo: { paths: Object.fromEntries(Object.entries(strip.paths).slice(0, 4)) }, sprite: '/s.svg', fitTo: box, fitPadding: 0 });
  assert.notEqual(mat(alone), mat(full));
});

test('only: without a sprite it is a subset; one that matches nothing fails with a fix; the sprite file stays whole', () => {
  const svg = plot({ ...base, only: 'c3' });
  assert.equal((svg.match(/<path class="pa-m"/g) || []).length, 1);
  assert.throws(() => plot({ ...base, only: ['zz'] }), /only/);
  assert.equal((mapSprite({ geo: strip, only: ['c3'] }).match(/<path id=/g) || []).length, 10);
  assert.throws(() => plot({ ...base, views: [{ id: 'a' }, { id: 'b', only: ['c1'] }] }), /only/);
});

// ── 6. Extremos de las líneas ───────────────────────────────────────────────
const lk = [{ from: 'c0', to: 'c5', value: 9 }, { from: 'c0', to: 'c9', value: 1 }, { from: 'c3', to: 'c9', value: 3 }];
const endR = (svg) => Object.fromEntries([...svg.matchAll(/<circle [^>]*?r="([\d.]+)" data-key="(c\d)"/g)].map((m) => [m[2], +m[1]]));

test('links.ends.radius [min, max]: sized by the sum of the lines meeting there (sqrt by default, or linear)', () => {
  const r = endR(plot({ ...base, links: { data: lk, ends: { radius: [1, 6] } } }));
  // c0: 9 + 1 = 10 (la mayor), c5: 9, c9: 1 + 3 = 4, c3: 3.
  assert.equal(r.c0, 6);
  assert.equal(r.c5, Math.round(6 * Math.sqrt(0.9) * 100) / 100);
  assert.equal(r.c9, Math.round(6 * Math.sqrt(0.4) * 100) / 100);
  const lin = endR(plot({ ...base, links: { data: lk, ends: { radius: [2, 6], scale: 'linear' } } }));
  assert.equal(lin.c3, 2);
  assert.equal(lin.c9, Math.round(6 * 0.4 * 100) / 100);
  assert.throws(() => plot({ ...base, links: { data: lk, ends: { radius: [6, 1] } } }), /radius/);
  assert.throws(() => plot({ ...base, links: { data: lk, ends: { scale: 'log' } } }), /scale/);
  assert.ok(codes(lint({ ...base, links: { data: lk, ends: { scale: 'log' } } })).includes('enum-ends.scale'));
});

test('links.ends.skip and skipPoints: no dot at those ends', () => {
  const r = endR(plot({ ...base, links: { data: lk, ends: { skip: ['c0'] } } }));
  assert.equal(r.c0, undefined);
  assert.ok(r.c5 && r.c9 && r.c3);
  const geo = { paths: strip.paths, points: { o: [50, 30] } };
  const svg = plot({ ...base, geo, links: { data: [{ from: 'o', to: 'c2', value: 1 }, { from: 'o', to: 'c7', value: 2 }], ends: { skipPoints: true } } });
  const ends = svg.match(/<g class="pa-link-ends[^]*?<\/g>/)[0];
  assert.doesNotMatch(ends, /data-key="o"/);
  assert.match(ends, /data-key="c2"/);
});

// ── 7. Tamaño sin style en línea ────────────────────────────────────────────
test('inlineSize: false drops max-width and height:auto from the root style; default unchanged', () => {
  const root = (svg) => svg.match(/^<svg[^>]*>/)[0];
  assert.match(attr(root(plot(base)), 'style'), /max-width:100%;height:auto/);
  const st = attr(root(plot({ ...base, inlineSize: false })), 'style');
  assert.equal(st, 'font-variant-numeric:lining-nums');
  const bar = root(plot({ type: 'bar', data: [{ a: 'x', b: 1 }], x: 'a', y: 'b', inlineSize: false }));
  assert.doesNotMatch(bar, /max-width/);
  assert.match(bar, /width="\d+" height="[\d.]+"/);
  assert.ok(codes(lint({ ...base, inlineSize: 'no' })).includes('inline-size'));
});

// ── 8. Rótulos en el borde ──────────────────────────────────────────────────
test('edgeLabels: a rail under the map, a tick per place; names in order, colliding ones written hidden', () => {
  const plain = plot(base);
  const items = [{ at: 'c0', label: 'Zero' }, { at: 'c9', label: 'Nine' }, { at: 'c1', label: 'Overlapping name' }, { at: [55, 5], label: 'Point', key: 'p' }];
  const svg = plot({ ...base, edgeLabels: items });
  const h = (s) => +attr(s.match(/^<svg[^>]*>/)[0], 'height');
  assert.ok(h(svg) > h(plain), 'the band adds height');
  const E = [...svg.matchAll(/<g class="(pa-edge[^"]*)" data-key="([^"]+)">(.*?)<\/g>/g)].map((m) => ({ cls: m[1], key: m[2], body: m[3] }));
  assert.deepEqual(E.map((e) => e.key), ['c0', 'c9', 'c1', 'p']);
  assert.ok(E.every((e) => /<line /.test(e.body)));
  assert.equal(E.find((e) => e.key === 'c1').cls, 'pa-edge pa-edge-off');
  assert.match(E.find((e) => e.key === 'c1').body, /display="none"/);
  assert.equal(E.find((e) => e.key === 'c0').cls, 'pa-edge');
  // Las marcas quedan bajo la tierra: su y empieza donde termina el mapa.
  const y1 = +E[0].body.match(/y1="([\d.]+)"/)[1];
  const land = Math.max(...[...svg.matchAll(/<path class="pa-m" d="M[\d.]+,([\d.]+)/g)].map((m) => +m[1]));
  assert.ok(y1 > land);
});

test('edgeLabels: max, side and errors', () => {
  const items = Array.from({ length: 10 }, (_, i) => ({ at: `c${i}`, label: `R${i}` }));
  const one = plot({ ...base, edgeLabels: { data: items, max: 2 } });
  assert.equal((one.match(/class="pa-edge"/g) || []).length, 2);
  const right = plot({ ...base, edgeLabels: { data: items.slice(0, 2), side: 'right' } });
  assert.match(right, /<text [^>]*text-anchor="start"[^>]*>R0<\/text>/);
  assert.throws(() => plot({ ...base, edgeLabels: { data: items, side: 'middle' } }), /side/);
  assert.ok(codes(lint({ ...base, edgeLabels: { data: items, side: 'botom' } })).includes('enum-edgeLabels.side'));
  assert.ok(codes(lint({ ...base, edgeLabels: 'x' })).includes('edge-labels'));
  assert.ok(!codes(lint({ ...base, edgeLabels: items, only: ['c1'], inlineSize: false })).includes('unknown-option'));
});

// ── Sin opciones nuevas, nada cambia fuera de los puntos ────────────────────
test('a map without markers or link ends renders exactly as before the lean-dot change', () => {
  const a = plot(base);
  assert.doesNotMatch(a, /-dots/);
  assert.doesNotMatch(a, /pa-edge/);
});

test('views that only switch markers (no data, same ground) cost the regions nothing: no view classes, rules or data-vtip', () => {
  const land = rows.map((r) => ({ id: r.id, v: null }));
  const mk = (n) => ({ data: pts.slice(0, n), lon: 'x', lat: 'y', labels: false });
  const svg = plot({ ...base, data: land, value: 'v', missing: 'context', views: [{ id: 'a', markers: mk(1) }, { id: 'b', markers: mk(2) }, { id: 'c', markers: mk(3) }], viewSelector: '.s-{id}' });
  const regs = [...svg.matchAll(/<path class="pa-m[^"]*"[^>]*>/g)].map((m) => m[0]);
  assert.equal(regs.length, 10);
  for (const r of regs) { assert.equal(attr(r, 'class'), 'pa-m'); assert.doesNotMatch(r, /data-vtip/); }
  assert.doesNotMatch(css(svg), /\.pv\d-n/);
  // Una vista con datos sigue repintando: sus clases y sus tarjetas vuelven.
  const mixed = plot({ ...base, views: [{ id: 'a', markers: mk(1) }, { id: 'b', value: 'b', markers: mk(2) }] });
  assert.match(mixed, /class="pa-m pv1-\d"/);
  assert.match(mixed, /data-vtip-b="/);
});
