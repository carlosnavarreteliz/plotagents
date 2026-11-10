import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plot, safePlot, lint } from '../src/index.js';
import { parsePath, pathsToFeatures } from '../src/geo/paths.js';
import { pathD, identity } from '../src/geo/projection.js';
import { mainlandBox } from '../src/charts/choropleth.js';
import { setView, currentView, bindViews } from '../src/views-client.js';

// Una franja de diez cuadrados (norte arriba, y hacia abajo) y una isla lejana.
const sq = (x, y, s = 9) => `M${x},${y}L${x + s},${y}L${x + s},${y + s}L${x},${y + s}Z`;
const strip = { paths: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`c${i}`, sq(0, i * 10)])) };
const island = { paths: { ...strip.paths, far: sq(-400, 40, 3) }, names: { c0: ['Norte', 'norte'], c9: 'Sur' } };
const rows = Array.from({ length: 10 }, (_, i) => ({ id: `c${i}`, a: i + 1, b: 10 - i, c: i % 2 ? 'par' : 'impar', url: `/es/comuna/c${i}/` }));
const base = { type: 'choropleth', geo: strip, data: rows, key: 'id', value: 'a', width: 600, labels: false, locale: 'en' };
const regions = (svg) => [...svg.matchAll(/<path class="pa-m[^"]*"[^>]*>/g)].map((m) => m[0]);
const attr = (tag, a) => (tag.match(new RegExp(`\\s${a}="([^"]*)"`)) || [])[1];

// ── Trazos ya proyectados ────────────────────────────────────────────────
test('parsePath reads absolute, relative, H/V, curves and closes rings', () => {
  const [a] = parsePath('M10,10l5,0 0 5h-5z');
  assert.deepEqual(a.pts, [[10, 10], [15, 10], [15, 15], [10, 15]]);
  assert.equal(a.closed, true);
  const [b, c] = parsePath('M0 0H4V4L0 4ZM10-1.5.5.5'); // números pegados: "-1.5.5.5" = -1.5, .5, .5
  assert.deepEqual(b.pts.at(-1), [0, 4]);
  assert.deepEqual(c.pts, [[10, -1.5], [0.5, 0.5]]);
  const [q] = parsePath('M0,0Q5,10 10,0');
  assert.equal(q.pts.length, 7); // 6 tramos
  assert.deepEqual(q.pts.at(-1), [10, 0]);
  assert.ok(q.pts.some((p) => p[1] > 4)); // pasa cerca del control
  const [cc] = parsePath('M0,0C0,10 10,10 10,0S20,-10 20,0');
  assert.deepEqual(cc.pts.at(-1), [20, 0]);
  assert.throws(() => parsePath('L5 5', 'x'), /"x"/);
});

test('pathsToFeatures: polygons, lines, dots, names and label points; projection identity', () => {
  const fc = pathsToFeatures({ paths: { a: sq(0, 0), b: { d: 'M0,0L5,5', at: [2, 2] } }, points: { p: [3, 4] }, names: { a: ['Alfa', 'alfa'], p: 'Punto' } });
  assert.equal(fc.projection, 'identity');
  const [a, b, p] = fc.features;
  assert.equal(a.geometry.type, 'MultiPolygon');
  assert.equal(a.properties.name, 'Alfa');
  assert.equal(b.geometry.type, 'LineString');
  assert.deepEqual(b.properties.labelAt, [2, 2]);
  assert.equal(p.geometry.type, 'Point');
  assert.equal(p.properties.dot, true);
});

test('geo: { paths } draws without projection: same order, ids as keys, names in tooltips', () => {
  const svg = plot(base);
  const r = regions(svg);
  assert.equal(r.length, 10);
  assert.deepEqual(r.map((t) => attr(t, 'data-key')), rows.map((x) => x.id));
  // Identidad: el primero (y = 0) queda arriba del último.
  const y0 = (t) => +attr(t, 'd').match(/^M[\d.]+,([\d.]+)/)[1];
  assert.ok(y0(r[0]) < y0(r[9]));
  const named = plot({ ...base, geo: island });
  assert.match(named, /data-tip="Norte\n1 · #10 of 10"/);
});

test('orientation "landscape" lays a tall paths map on its side, north on the left', () => {
  const svg = plot({ ...base, orientation: 'landscape' });
  const x0 = (t) => +attr(t, 'd').match(/^M([\d.]+),/)[1];
  const r = regions(svg);
  assert.ok(x0(r[0]) < x0(r[9]));
  assert.ok(+attr(svg, 'height') < 400);
});

// ── Trazos compactos ─────────────────────────────────────────────────────
test('pathPrecision / simplify: relative, rounded, smaller; the default paths do not change', () => {
  const plain = plot(base);
  const tight = plot({ ...base, pathPrecision: 0, simplify: 0.5 });
  assert.ok(tight.length < plain.length);
  assert.match(attr(regions(tight)[0], 'd'), /^M\d+,\d+l[-\d .]+z$/);
  assert.doesNotMatch(plain, /d="M[^"]*l/); // sin opciones: absolutas, como siempre
  assert.equal(plot(base), plain);
  // La simplificación quita puntos casi alineados y deja los vértices.
  const proj = identity();
  const wiggle = { type: 'Polygon', coordinates: [[[0, 0], [5, 0.1], [10, 0], [10, 10], [0, 10], [0, 0]]] };
  assert.equal(pathD(wiggle, proj, { compact: { precision: 0, simplify: 0.5 } }), 'M0,0l10 0 0 10-10 0z');
  assert.equal(pathD(wiggle, proj, { compact: { precision: 1, simplify: 0 } }), 'M0,0l5 .1 5-.1 0 10-10 0z');
});

// ── fitTo: "mainland" ────────────────────────────────────────────────────
test('fitTo "mainland" frames on what is not cut off by sea', () => {
  const fc = pathsToFeatures(island);
  assert.deepEqual(mainlandBox(fc.features), [0, 0, 9, 99]);
  const near = pathsToFeatures({ paths: { ...strip.paths, edge: sq(9, 40, 30) } }); // grande, pero toca a su vecino
  assert.equal(mainlandBox(near.features)[2], 39);
  assert.equal(mainlandBox(fc.features.slice(0, 3)), null);
  const framed = plot({ ...base, geo: island, fitTo: 'mainland' });
  const all = plot({ ...base, geo: island });
  const w = (svg, id) => { const d = attr(regions(svg).find((t) => attr(t, 'data-key') === id), 'd'); const xs = [...d.matchAll(/[ML]([\d.-]+),/g)].map((m) => +m[1]); return Math.max(...xs) - Math.min(...xs); };
  assert.ok(w(framed, 'c0') > 3 * w(all, 'c0')); // la isla sale del encuadre: el país se agranda
});

// ── Vistas ───────────────────────────────────────────────────────────────
const views = [{ id: 'a', label: 'Alpha' }, { id: 'b', label: 'Beta', value: 'b', colorScale: 'viridis' }, { id: 'c', value: 'c', highlight: 'c3' }];

test('views: one geometry, the first view in the attributes, the others as classes, tooltips and CSS', () => {
  const svg = plot({ ...base, views });
  const root = svg.match(/^<svg[^>]*>/)[0];
  assert.equal(attr(root, 'data-view'), 'a');
  assert.equal(attr(root, 'data-views'), 'a b c');
  assert.match(attr(root, 'class'), /^pa-chart pa-views pa-v[0-9a-z]+$/);
  const r = regions(svg);
  assert.equal(r.length, 10); // la geometría una sola vez
  assert.match(attr(r[0], 'class'), /^pa-m pv1-\d+ pv2-\d+$/);
  assert.equal(attr(r[0], 'data-tip'), 'c0\nAlpha: 1 · #10 of 10');
  assert.equal(attr(r[0], 'data-vtip-b'), 'c0\nBeta: 10 · #1 of 10');
  assert.equal(attr(r[0], 'data-vtip-c'), 'c0\nimpar');
  const scope = attr(root, 'class').split(' ')[2];
  const css = svg.match(/<style>(.*?)<\/style>/s)[1];
  for (const [i, id] of ['a', 'b', 'c'].entries()) assert.ok(css.includes(`.${scope}:not([data-view="${id}"]) .pv${i}{display:none}`));
  assert.match(css, new RegExp(`\\.${scope}\\[data-view="b"\\] \\.pv1-\\d+\\{fill:#[0-9A-F]{6}!important\\}`));
  // Una leyenda por vista, cada una con su título.
  assert.equal([...svg.matchAll(/<g class="pv\d"><g class="pa-legend pa-map-legend">/g)].length, 3);
  assert.match(svg, /Alpha<\/text>/);
  // El resaltado de una vista va en su grupo.
  assert.match(svg, /<g class="pa-outlines pv2"[^>]*><path/);
  assert.match(svg, /3 views: Alpha, Beta, c\./);
});

test('views: the first view draws exactly what the plain map draws', () => {
  const one = regions(plot({ ...base, colorScale: undefined })).map((t) => attr(t, 'fill'));
  const many = regions(plot({ ...base, views: [{ id: 'a' }, { id: 'b', value: 'b' }] })).map((t) => attr(t, 'fill'));
  assert.deepEqual(many, one);
});

test('views: classes follow the color class of each value, the same in every skin', () => {
  const skins = [{ theme: { sequential: ['#eeeeee', '#111111'] } }, { when: 'html.dark', theme: { sequential: ['#ffeeee', '#330000'] } }];
  const svg = plot({ ...base, views, skins });
  assert.match(svg, /--pa-s\d+:#/);
  assert.match(svg, /html\.dark \.pa-skin-/);
  // Las reglas de las vistas usan las variables de la piel.
  assert.match(svg, /\.pv1-\d+\{fill:#[0-9A-F]{6}!important\}/); // viridis: igual en las dos pieles
  const r = plot({ ...base, views: [{ id: 'a' }, { id: 'b', value: 'b' }], skins });
  assert.match(r, /\[data-view="b"\] \.pv1-\d+\{fill:var\(--pa-s\d+, #[0-9A-Fa-f]{6}\)!important\}/);
  // Y con colores var(--x, respaldo) de la página, dentro de una vista.
  const v = plot({ ...base, views: [{ id: 'a' }, { id: 'c', value: 'c', colors: { par: 'var(--par, #112233)' } }] });
  assert.match(v, /\.pv1-\d+\{fill:var\(--par, #112233\)!important\}/);
});

test('views: lines per view, missing "context", invalid views', () => {
  const svg = plot({ ...base, views: [{ id: 'a', links: [{ from: 'c0', to: 'c9', value: 2 }] }, { id: 'b', value: 'b', links: [{ from: 'c0', to: 'c5', value: 1 }] }] });
  assert.match(svg, /<g class="pv0"><g class="pa-links"><path[^>]*data-key="c0→c9"/);
  assert.match(svg, /<g class="pv1"><g class="pa-links"><path[^>]*data-key="c0→c5"/);
  const ctx = plot({ ...base, data: rows.slice(0, 5), missing: 'context' });
  const r = regions(ctx);
  assert.equal(attr(r[9], 'data-tip'), undefined);
  assert.ok(attr(r[0], 'data-tip'));
  assert.doesNotMatch(ctx, /No data</);
  for (const [bad, re] of [[[{ id: 'A' }], /attribute/], [[{ id: 'a' }, { id: 'a' }], /Two views/], [[{ id: 'a', geo: 'chile' }], /cannot change `geo`/], [[], /list of views/]]) {
    const out = safePlot({ ...base, views: bad, title: 't', source: 's' });
    assert.equal(out.ok, false);
    assert.match(out.errors[0].message, re);
  }
  assert.throws(() => plot({ ...base, type: 'symbolmap', views }), /choropleth/);
});

test('views: lint checks ids, fields and size', () => {
  const r = lint({ ...base, title: 't', source: 's', views: [{ id: 'Bad' }, { id: 'b', value: 'nope' }] });
  assert.deepEqual(r.errors.map((e) => e.code).sort(), ['views-field', 'views-id']);
  assert.equal(lint({ ...base, title: 't', source: 's', views }).errors.length, 0);
  assert.ok(lint({ ...base, type: 'bar', x: 'id', y: 'a', views }).warnings.some((w) => w.code === 'views-type'));
  assert.ok(lint({ ...base, simplify: -1 }).errors.some((e) => e.code === 'simplify'));
  assert.ok(lint({ ...base, pathPrecision: 7 }).errors.some((e) => e.code === 'path-precision'));
  assert.ok(lint({ ...base, microstates: 'some' }).errors.some((e) => e.code === 'enum-microstates'));
  for (const k of ['views', 'pathPrecision', 'simplify', 'microstates']) assert.ok(!lint({ ...base, [k]: k === 'views' ? views : k === 'microstates' ? true : 1 }).warnings.some((w) => w.code === 'unknown-option'), k);
});

// ── El cliente: cambiar de vista es cambiar un atributo ──────────────────
function fakeDom(svg) {
  const node = (tag) => {
    const a = new Map(Object.entries(tag.attrs));
    return { getAttribute: (k) => (a.has(k) ? a.get(k) : null), setAttribute: (k, v) => a.set(k, String(v)), removeAttribute: (k) => a.delete(k), hasAttribute: (k) => a.has(k), attrs: a };
  };
  const parse = (t) => ({ attrs: Object.fromEntries([...t.matchAll(/\s([\w:-]+)="([^"]*)"/g)].map((m) => [m[1], m[2].replace(/&#10;/g, '\n')])) });
  const root = node(parse(svg.match(/^<svg[^>]*>/)[0]));
  const marks = regions(svg).map((t) => node(parse(t)));
  root.matches = (sel) => sel === 'svg[data-views]';
  root.querySelectorAll = (sel) => { if (sel === 'style') return []; const k = sel.match(/\[([\w-]+)\]/)[1]; return marks.filter((m) => m.hasAttribute(k)); };
  return { root, marks };
}

test('plotagents/views: setView flips data-view and the tooltips, and back', () => {
  const svg = plot({ ...base, views });
  const { root, marks } = fakeDom(svg);
  assert.equal(currentView(root), 'a');
  assert.equal(setView(root, 'b'), 1);
  assert.equal(root.getAttribute('data-view'), 'b');
  assert.equal(marks[0].getAttribute('data-tip'), 'c0\nBeta: 10 · #1 of 10');
  assert.equal(setView(root, 'b'), 0); // ya estaba
  assert.equal(setView(root, 'zz'), 0); // no existe: no se toca
  setView(root, 'a');
  assert.equal(marks[0].getAttribute('data-tip'), 'c0\nAlpha: 1 · #10 of 10');
  // Una región sin dato en una vista "context" pierde el tooltip en esa vista.
  const ctx = fakeDom(plot({ ...base, views: [{ id: 'a' }, { id: 'b', value: 'b', data: rows.slice(0, 3), missing: 'context' }] }));
  setView(ctx.root, 'b');
  assert.equal(ctx.marks[9].getAttribute('data-tip'), null);
  assert.equal(typeof bindViews(null), 'function');
});

// ── Mundo: ISO-2, microestados y enlaces ─────────────────────────────────
const wbase = { type: 'choropleth', geo: 'world', key: 'k', value: 'v', width: 720, labels: false, locale: 'en' };

test('world: ISO-2 codes match like ISO-3 and names', () => {
  const two = plot({ ...wbase, data: [{ k: 'CL', v: 1 }, { k: 'CN', v: 5 }, { k: 'US', v: 3 }] });
  const three = plot({ ...wbase, data: [{ k: 'CHL', v: 1 }, { k: 'CHN', v: 5 }, { k: 'USA', v: 3 }] });
  const fills = (s) => regions(s).map((t) => attr(t, 'fill'));
  assert.deepEqual(fills(two), fills(three));
  assert.match(two, /data-key="CL"/);
  assert.doesNotMatch(two, /Unmatched/);
});

test('world: microstates become dots, only with data unless "all"', () => {
  const data = [{ k: 'SG', v: 4 }, { k: 'MLT', v: 2 }, { k: 'Chile', v: 1 }];
  const off = plot({ ...wbase, data });
  assert.match(off, /Unmatched: SG, MLT/);
  const on = plot({ ...wbase, data, microstates: true });
  assert.doesNotMatch(on, /Unmatched/);
  const dots = regions(on).filter((t) => /a2\.5,2\.5 0 1,0/.test(attr(t, 'd')));
  assert.deepEqual(dots.map((t) => attr(t, 'data-key')).sort(), ['MLT', 'SG']);
  assert.match(on, /data-tip="Singapore\n4/);
  const all = plot({ ...wbase, data, microstates: 'all', pointRadius: 3 });
  assert.ok(regions(all).filter((t) => /a3,3 0 1,0/.test(attr(t, 'd'))).length > 60);
  // Una línea llega al punto del microestado.
  const lk = plot({ ...wbase, data, microstates: true, links: [{ from: 'CL', to: 'SG', value: 3 }] });
  assert.match(lk, /data-key="CL→SG"/);
});

test('href: regions link to their row (paths and http only)', () => {
  const svg = plot({ ...base, href: 'url' });
  assert.match(svg, /<a href="\/es\/comuna\/c0\/" class="pa-link"><path class="pa-m"/);
  const evil = plot({ ...base, data: rows.map((r) => ({ ...r, url: 'javascript:alert(1)' })), href: 'url' });
  assert.doesNotMatch(evil, /javascript:/);
  assert.doesNotMatch(plot(base), /<a href/);
});

// ── sprite: los contornos en un archivo aparte ───────────────────────────
import { mapSprite } from '../src/index.js';

test('mapSprite writes one <path id> per region; sprite draws <use> through one matrix', () => {
  const file = mapSprite({ geo: island });
  const ids = [...file.matchAll(/<path id="([^"]+)" d="([^"]+)"/g)];
  assert.equal(ids.length, 11);
  assert.ok(ids.every(([, id]) => /^gc\d$|^gfar$/.test(id)));
  assert.match(file, /vector-effect="non-scaling-stroke"/);
  for (const orientation of [undefined, 'landscape']) {
    const inline = plot({ ...base, geo: island, orientation });
    const viaFile = plot({ ...base, geo: island, orientation, sprite: '/maps/strip.svg' });
    assert.doesNotMatch(viaFile, /<path class="pa-m/);
    const uses = [...viaFile.matchAll(/<use class="pa-m"[^>]*href="\/maps\/strip\.svg#(g[^"]+)"/g)].map((m) => m[1]);
    assert.equal(uses.length, 11);
    // La matriz lleva el primer punto del sprite al primer punto del trazo en línea.
    const [a, b, c, d, e, f] = viaFile.match(/<g transform="matrix\(([^)]+)\)"><use/)[1].split(' ').map(Number);
    const [, qx, qy] = file.match(/id="gc3" d="M([\d.-]+),([\d.-]+)/).map(Number);
    const tag = regions(inline).find((t) => attr(t, 'data-key') === 'c3');
    const [, sx, sy] = attr(tag, 'd').match(/^M([\d.-]+),([\d.-]+)/).map(Number);
    assert.ok(Math.abs(a * qx + c * qy + e - sx) < 0.3 && Math.abs(b * qx + d * qy + f - sy) < 0.3, `${orientation}: ${a * qx + c * qy + e},${b * qx + d * qy + f} vs ${sx},${sy}`);
  }
  // Con vistas y enlaces: clases, tooltips y <a> van en el <use>.
  const v = plot({ ...base, sprite: '/m.svg', views, href: 'url' });
  assert.match(v, /<a href="\/es\/comuna\/c0\/" class="pa-link"><use class="pa-m pv1-\d+ pv2-\d+"[^>]*data-vtip-b="c0\nBeta/);
  assert.throws(() => plot({ ...base, sprite: 'javascript:alert(1)' }), /sprite/);
  assert.throws(() => plot({ ...base, sprite: '/m.svg#x' }), /sprite/);
  assert.match(lint({ ...base, title: 't', source: 's', sprite: 'x.svg#a' }).errors.map((e) => e.code).join(), /sprite/);
});

test('choropleth: legend false also drops a numeric scale bar', () => {
  const data = [{ r: 'Antofagasta', v: 1 }, { r: 'Biobío', v: 5 }, { r: 'Los Lagos', v: 9 }];
  const on = plot({ type: 'choropleth', geo: 'chile', data, key: 'r', value: 'v' });
  const off = plot({ type: 'choropleth', geo: 'chile', data, key: 'r', value: 'v', legend: false });
  assert.match(on, /pa-map-legend/);
  assert.doesNotMatch(off, /pa-map-legend/);
});
