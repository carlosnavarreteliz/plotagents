// Mapas, cuarta tanda: lo que el sitio PuroChile tuvo que rodear al pasar sus
// mapas a la biblioteca (vistas por CSS, destacado sin texto ni atenuado,
// cortes en datos sesgados, nombre accesible, líneas, ids y peso).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plot, lint } from '../src/index.js';

const sq = (x, y, s = 9) => `M${x},${y}L${x + s},${y}L${x + s},${y + s}L${x},${y + s}Z`;
const strip = { paths: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`c${i}`, sq(0, i * 10)])) };
const rows = Array.from({ length: 10 }, (_, i) => ({ id: `c${i}`, a: i + 1, b: 10 - i }));
const base = { type: 'choropleth', geo: strip, data: rows, key: 'id', value: 'a', width: 600, labels: false, locale: 'en' };
const views = [{ id: 'a', label: 'Alpha' }, { id: 'b', value: 'b', label: 'Beta' }];
const regions = (svg) => [...svg.matchAll(/<(?:path|use) class="pa-m[^"]*"[^>]*>/g)].map((m) => m[0]);
const attr = (tag, a) => (tag.match(new RegExp(`\\s${a}="([^"]*)"`)) || [])[1];
const css = (svg) => svg.match(/<style>(.*?)<\/style>/s)[1];
const codes = (r) => [...r.errors, ...r.warnings].map((x) => x.code);

// ── 1. Vistas por CSS desde fuera del SVG ─────────────────────────────────
test('viewSelector: the view rules key on an ancestor selector instead of data-view', () => {
  const svg = plot({ ...base, views, viewSelector: '#blk:has(input[value={id}]:checked)' });
  const c = css(svg);
  const scope = attr(svg.match(/^<svg[^>]*>/)[0], 'class').split(' ')[2];
  assert.doesNotMatch(c, /data-view/);
  assert.ok(c.includes(`.${scope} .pv1{display:none}`));
  assert.ok(c.includes(`#blk:has(input[value=b]:checked) .${scope} .pv0{display:none}`));
  assert.ok(c.includes(`#blk:has(input[value=b]:checked) .${scope} .pv1{display:inline}`));
  assert.match(c, new RegExp(`#blk:has\\(input\\[value=b\\]:checked\\) \\.${scope} \\.pv1-\\d+\\{fill:#[0-9A-F]{6}!important\\}`));
  // El root conserva data-view y los tooltips por vista: setView sigue cambiando las tarjetas.
  assert.match(svg, /data-view="a" data-views="a b"/);
  assert.match(svg, /data-vtip-b="/);
  // Desde JS, una función; una lista de selectores se agrupa con :is().
  const fn = plot({ ...base, views, viewSelector: (id, i) => `.show-${id}, .pick-${i}` });
  assert.ok(css(fn).includes(':is(.show-b, .pick-1) .'));
  // Sin viewSelector, lo de siempre.
  assert.match(css(plot({ ...base, views })), /:not\(\[data-view="b"\]\) \.pv1\{display:none\}/);
});

test('viewSelector: refused without {id} or with characters that would leave the <style>', () => {
  assert.throws(() => plot({ ...base, views, viewSelector: '.x' }), /\{id\}/);
  assert.throws(() => plot({ ...base, views, viewSelector: '.x-{id}}body{color:red' }), /selector/);
  assert.throws(() => plot({ ...base, views, viewSelector: '.x-{id}</style>' }), /selector/);
  const r = lint({ ...base, views, viewSelector: '.x' });
  assert.ok(codes(r).includes('view-selector'));
  assert.ok(codes(lint({ ...base, viewSelector: '.x-{id}' })).includes('view-selector-alone'));
  assert.throws(() => plot({ ...base, views: [{ id: 'a' }, { id: 'b', value: 'b', viewSelector: '.y-{id}' }] }), /viewSelector/);
});

// ── 2–4. Lo destacado ─────────────────────────────────────────────────────
test('highlight respects labels: false (no name or value written on the map)', () => {
  const svg = plot({ ...base, highlight: 'c3' });
  assert.doesNotMatch(svg, /<text[^>]*>c3<\/text>/);
  assert.doesNotMatch(svg, /class="pa-map-label"/);
  // Sin labels: false se sigue rotulando.
  assert.match(plot({ ...base, labels: undefined, highlight: 'c3' }), /<text[^>]*>c3<\/text>/);
});

test('highlightMode: "outline" keeps the ring and does not dim the rest', () => {
  const dim = plot({ ...base, highlight: 'c3' });
  assert.equal(regions(dim).filter((t) => attr(t, 'opacity') === '0.5').length, 9);
  const out = plot({ ...base, highlight: 'c3', highlightMode: 'outline' });
  assert.equal(regions(out).filter((t) => attr(t, 'opacity')).length, 0);
  assert.match(out, /<g class="pa-outlines"[^>]*><path d="/);
  assert.throws(() => plot({ ...base, highlight: 'c3', highlightMode: 'fade' }), /highlightMode/);
  assert.ok(codes(lint({ ...base, highlight: 'c3', highlightMode: 'outlne' })).includes('enum-highlightMode'));
});

test('highlightColor and highlightWidth: on the ring group, per view, under skins and CSS variables', () => {
  const svg = plot({ ...base, highlight: 'c3', highlightColor: '#ff0000', highlightWidth: 4 });
  const ring = svg.match(/<g class="pa-outlines"[^>]*>/)[0];
  assert.equal(attr(ring, 'stroke'), '#ff0000');
  assert.equal(attr(ring, 'stroke-width'), '4');
  assert.equal(attr(ring, 'pointer-events'), 'none');
  // Por omisión: la tinta del tema, 1,5 px.
  const def = plot({ ...base, highlight: 'c3' }).match(/<g class="pa-outlines"[^>]*>/)[0];
  assert.equal(attr(def, 'stroke-width'), '1.5');
  // Una vista con su color.
  const v = plot({ ...base, views: [{ id: 'a' }, { id: 'b', value: 'b', highlight: 'c2', highlightColor: '#00ff00' }] });
  assert.equal(attr(v.match(/<g class="pa-outlines pv1"[^>]*>/)[0], 'stroke'), '#00ff00');
  // Pieles con variables: el color de cada piel en su variable.
  const sk = plot({ ...base, highlight: 'c3', skins: [{ highlightColor: 'var(--rojo, #c0463c)' }, { when: 'html.x', highlightColor: 'var(--rojo, #d52b1e)' }] });
  const g = sk.match(/<g class="pa-outlines"[^>]*>/)[0];
  assert.equal(attr(g, 'stroke'), '#c0463c');
  assert.match(attr(g, 'style'), /^stroke:var\(--pa-s\d+\)$/);
  assert.match(sk, /html\.x \.pa-skin-[a-z0-9]+\{[^}]*var\(--rojo, #d52b1e\)/);
  assert.throws(() => plot({ ...base, highlight: 'c3', highlightWidth: 0 }), /highlightWidth/);
});

// ── 5. Cortes de cuantiles en datos sesgados ──────────────────────────────
test('quantile breaks on skewed data keep their classes (rounded to their own magnitude)', () => {
  // De 100 mil a 27.000 millones: redondear al rango daba 0 en todos los cortes bajos.
  const vals = [1e5, 3e5, 8e5, 2e6, 6e6, 1.5e7, 4e7, 1.2e8, 5e8, 2.7e10];
  const data = rows.map((r, i) => ({ ...r, a: vals[i] }));
  const svg = plot({ ...base, data, classes: 5, legend: true });
  const fills = new Set(regions(svg).map((t) => attr(t, 'fill')));
  assert.equal(fills.size, 5);
  // Datos sin sesgo: los cortes de siempre (2 cifras del rango).
  const even = plot({ ...base, classes: 5, legend: true });
  assert.match(even, />2\.8<\/text>/);
});

// ── 6. Cortes dados: closed "right", repetidos y vacíos, con vistas ──────────
test('colorScale breaks with closed "right", repeated and empty breaks hold in every view', () => {
  // Como el sitio: sube de clase cuando el valor supera el corte; los cortes son valores de los datos.
  const ramp = ['#000001', '#000002', '#000003', '#000004', '#000005', '#000006'];
  const binColor = (v, br) => { let i = 0; while (i < br.length && v > br[i]) i++; return ramp[i]; };
  const data = rows.map((r, i) => ({ ...r, a: [0, 0, 0, 1, 2, 2, 5, 7, 9, 9][i], b: [3, 3, 3, 3, 3, 3, 3, 4, 8, 8][i] }));
  const brA = [0, 0, 2, 5, 9], brB = [3, 3, 3, 3, 4];
  const svg = plot({ ...base, data, colorScale: { breaks: brA, colors: ramp, closed: 'right' }, views: [{ id: 'a' }, { id: 'b', value: 'b', colorScale: { breaks: brB, colors: ramp, closed: 'right' } }] });
  const r = regions(svg);
  assert.deepEqual(r.map((t) => attr(t, 'fill')), data.map((d) => binColor(d.a, brA)));
  // La vista b: la clase de cada región y la regla que la pinta.
  const rule = new Map([...css(svg).matchAll(/\[data-view="b"\] \.(pv1-\d+)\{fill:(#[0-9a-f]{6})!important\}/gi)].map((m) => [m[1], m[2]]));
  const inB = r.map((t) => rule.get(attr(t, 'class').split(' ').find((c) => c.startsWith('pv1-'))));
  assert.deepEqual(inB, data.map((d) => binColor(d.b, brB)));
  // Sin cortes: una sola clase.
  const one = plot({ ...base, colorScale: { breaks: [], colors: ['#123456'] } });
  assert.deepEqual([...new Set(regions(one).map((t) => attr(t, 'fill')))], ['#123456']);
  assert.throws(() => plot({ ...base, colorScale: { breaks: [], colors: ['#123456', '#654321'] } }), /0 cortes van 1/);
});

// ── 7. Nombre accesible ──────────────────────────────────────────────────
test('ariaLabel names any chart in <title> without drawing a title', () => {
  const svg = plot({ ...base, ariaLabel: 'Map of Chile' });
  assert.match(svg, /<title id="[^"]+">Map of Chile<\/title>/);
  assert.doesNotMatch(svg, /<text[^>]*>Map of Chile</);
  assert.match(plot(base), /<title id="[^"]+">choropleth<\/title>/);
  const bar = plot({ type: 'bar', data: [{ x: 'a', y: 1 }], x: 'x', y: 'y', title: 'Drawn title', ariaLabel: 'Spoken name' });
  assert.match(bar, /<title id="[^"]+">Spoken name<\/title>/);
  assert.match(bar, />Drawn title<\/text>/);
});

// ── 8. Líneas ────────────────────────────────────────────────────────────
const lk = (o) => plot({ ...base, links: { data: [{ f: 'c0', t: 'c9', v: 100 }, { f: [4, 4], t: 'c5', v: 25, n: 'Port' }], from: 'f', to: 't', value: 'v', ...o } });
const lines = (svg) => [...svg.matchAll(/<path class="pa-m pa-link"[^>]*>/g)].map((m) => m[0]);
test('links: widthScale "sqrt", end labels, own format and end dots', () => {
  const lin = lines(lk({})).map((t) => +attr(t, 'stroke-width'));
  const sqr = lines(lk({ widthScale: 'sqrt' })).map((t) => +attr(t, 'stroke-width'));
  assert.deepEqual(lin, [6, 1.5]);
  assert.deepEqual(sqr, [6, 3]);
  // Un punto [x, y] en trazos ya proyectados se nombra «x, y»; con fromLabel, por su nombre.
  assert.match(lines(lk({}))[1], /data-tip="4, 4 → c5\n25"/);
  assert.match(lines(lk({ fromLabel: 'n' }))[1], /data-tip="Port → c5\n25"/);
  assert.match(lines(lk({ format: { suffix: ' t' } }))[0], /data-tip="c0 → c9\n100 t"/);
  const e = lk({ ends: true });
  const dots = e.match(/<g class="pa-link-ends"[^>]*>(.*?)<\/g>/)[1];
  assert.equal([...dots.matchAll(/<circle /g)].length, 4);
  assert.match(lk({ ends: { radius: 4 } }), /<circle [^>]*r="4"/);
  assert.doesNotMatch(lk({}), /pa-link-ends/);
  assert.throws(() => lk({ widthScale: 'log' }), /widthScale/);
});

test('links: a [lon, lat] end on a lon/lat map keeps the «lat, lon» name', () => {
  const svg = plot({ type: 'choropleth', geo: 'world', data: [{ k: 'CHL', v: 1 }], key: 'k', value: 'v', links: [{ from: [-70.5, -33.4], to: 'CHN', value: 1 }] });
  assert.match(svg, /data-tip="-33\.4, -70\.5 → China\n1"/);
});

// ── 9. Ids internos ──────────────────────────────────────────────────────
test('two untitled maps of the same width get different internal ids; idPrefix fixes them', () => {
  const ids = (svg) => [...svg.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const a = ids(plot({ ...base, tall: false, data: rows.slice(0, 8) }));
  const b = ids(plot({ ...base, tall: false, data: rows.slice(0, 8).map((r) => ({ ...r, a: r.a * 2 })) }));
  assert.ok(a.some((x) => x.endsWith('-clip')));
  assert.equal(a.filter((x) => b.includes(x)).length, 0);
  const p = ids(plot({ ...base, tall: false, idPrefix: 'mapa 1' }));
  assert.ok(p.includes('mapa-1-t') && p.includes('mapa-1-map-clip'));
  // Pieles: el mismo id en cada una (si no, no se pueden unir).
  assert.doesNotThrow(() => plot({ ...base, skins: [{}, { when: 'html.x', theme: { sequential: ['#eeeeee', '#000000'] } }] }));
});

// ── 10. Margen del encuadre ──────────────────────────────────────────────
test('fitPadding: a fraction of the framed extent, or pixels', () => {
  const width = (o) => { const svg = plot({ ...base, fitTo: ['c2', 'c3', 'c4'], ...o }); const d = regions(svg).find((t) => attr(t, 'data-key') === 'c3'); const n = attr(d, 'd').match(/-?[\d.]+/g).map(Number); return n[2] - n[0]; };
  const w6 = width({}), w0 = width({ fitPadding: 0 }), w2 = width({ fitPadding: 0.02 }), wp = width({ fitPadding: '40px' });
  assert.ok(w0 > w2 && w2 > w6, `${w0} ${w2} ${w6}`);
  assert.ok(wp < w0);
  assert.equal(width({ fitPadding: 0.06 }), w6);
  assert.throws(() => plot({ ...base, fitTo: ['c2'], fitPadding: 3 }), /fitPadding/);
  assert.ok(codes(lint({ ...base, fitPadding: 0.02 })).includes('fit-padding-alone'));
});

// ── 11. Peso ─────────────────────────────────────────────────────────────
test('weight: shared strokes on the group, one key attribute, no data-color that repeats the fill', () => {
  const svg = plot({ ...base, href: undefined });
  const g = svg.match(/<g class="pa-regions"[^>]*>/)[0];
  assert.equal(attr(g, 'stroke-linejoin'), 'round');
  assert.ok(attr(g, 'stroke') && attr(g, 'stroke-width'));
  for (const t of regions(svg)) {
    for (const a of ['stroke', 'stroke-width', 'stroke-linejoin', 'data-k', 'data-color']) assert.equal(attr(t, a), undefined, `${a} in ${t}`);
    assert.ok(attr(t, 'data-key') && attr(t, 'fill'));
  }
  // Las líneas (fill none) y lo punteado conservan data-color: es su color.
  assert.match(plot({ ...base, dashed: 'c2' }), /data-dashed="1" data-color="#/);
  // borderColor / borderWidth van al grupo.
  const b = plot({ ...base, borderColor: '#ff00ff', borderWidth: 2 }).match(/<g class="pa-regions"[^>]*>/)[0];
  assert.equal(attr(b, 'stroke'), '#ff00ff');
  assert.equal(attr(b, 'stroke-width'), '2');
});
