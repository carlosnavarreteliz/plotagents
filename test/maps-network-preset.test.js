import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plot, safePlot } from '../src/index.js';

// ── network layout: "preset" ─────────────────────────────────────────────
const nodes = [
  { id: 'oeste', x: -10, y: 0, group: 'a', size: 4 },
  { id: 'este', x: 10, y: 0, group: 'b', size: 2 },
  { id: 'norte', x: 0, y: -5, group: 'a', size: 1 },
  { id: 'sur', x: 0, y: 5, group: 'b', size: 1 },
];
const pos = (svg) => Object.fromEntries([...svg.matchAll(/<circle class="pa-m" cx="([\d.-]+)" cy="([\d.-]+)"[^>]*data-node="([^"]+)"/g)].map((m) => [m[3], [+m[1], +m[2]]]));

test('preset: nodes keep their own positions, one scale for both axes', () => {
  const svg = plot({ type: 'network', layout: 'preset', nodes, width: 600, height: 400, legend: false });
  const p = pos(svg);
  assert.equal(Object.keys(p).length, 4);
  assert.ok(p.oeste[0] < p.norte[0] && p.norte[0] < p.este[0]);
  assert.ok(p.norte[1] < p.oeste[1] && p.oeste[1] < p.sur[1]); // y hacia abajo, como en SVG
  // Misma escala: 20 unidades en x valen el doble que 10 en y.
  const sx = (p.este[0] - p.oeste[0]) / 20, sy = (p.sur[1] - p.norte[1]) / 10;
  assert.ok(Math.abs(sx - sy) / sx < 0.08, `${sx} vs ${sy}`);
  assert.equal(svg, plot({ type: 'network', layout: 'preset', nodes, width: 600, height: 400, legend: false }));
});

test('preset: flipY, custom fields, edges optional or present', () => {
  const up = pos(plot({ type: 'network', layout: 'preset', nodes, flipY: true, width: 600, height: 400 }));
  assert.ok(up.norte[1] > up.sur[1]);
  const custom = nodes.map(({ x, y, ...n }) => ({ ...n, px: x, py: y }));
  assert.deepEqual(pos(plot({ type: 'network', layout: 'preset', nodes: custom, nodeX: 'px', nodeY: 'py', width: 600, height: 400 })), pos(plot({ type: 'network', layout: 'preset', nodes, width: 600, height: 400 })));
  const withEdges = plot({ type: 'network', layout: 'preset', nodes, data: [{ from: 'oeste', to: 'este', value: 3 }], width: 600, height: 400 });
  assert.match(withEdges, /<path/);
  assert.ok(!/NaN|undefined/.test(withEdges));
});

test('preset: a node without x, y is an error with a fix', () => {
  const r = safePlot({ type: 'network', layout: 'preset', nodes: [...nodes, { id: 'suelto' }] });
  assert.equal(r.ok, false);
  assert.match(r.errors[0].message, /suelto/);
  assert.equal(safePlot({ type: 'network', layout: 'preset', nodes, title: 'Mapa' }).ok, true);
});

// ── links ────────────────────────────────────────────────────────────────
const world = { type: 'choropleth', geo: 'world', key: 'k', value: 'v', width: 720, labels: false, locale: 'en',
  data: [{ k: 'CHL', v: 1 }, { k: 'CHN', v: 5 }, { k: 'USA', v: 3 }] };

test('links: one mark per relation, width proportional to value, keys on every end', () => {
  const svg = plot({ ...world, links: { data: [{ from: 'CHL', to: 'CHN', value: 40 }, { from: 'CHL', to: 'USA', value: 10 }, { from: 'CHL', to: [2.35, 48.85], value: 5 }, { from: 'CHL', to: 'ZZZ', value: 1 }] } });
  const links = [...svg.matchAll(/<path class="pa-m pa-link"[^>]*>/g)].map((m) => m[0]);
  assert.equal(links.length, 3);
  const w = (k) => +links.find((l) => l.includes(`data-key="${k}"`)).match(/stroke-width="([\d.]+)"/)[1];
  assert.ok(Math.abs(w('CHL→CHN') / w('CHL→USA') - 4) < 0.01);
  assert.match(svg, /data-tip="Chile → China\n40"/);
  assert.ok(links.every((l) => !/marker-end/.test(l)));
  // Lo que no calza se dice, no se dibuja.
  assert.match(svg, /unknown end: ZZZ/);
  // labels: false → ningún texto dentro del mapa de líneas.
  assert.doesNotMatch(svg.match(/<g class="pa-links">.*?<\/g>/s)[0], /<text/);
});

test('links: on symbol maps too, and they follow skins', () => {
  const svg = plot({ ...world, type: 'symbolmap', links: [{ from: 'CHL', to: 'CHN', value: 3 }], skins: [{ palette: ['#6e86c8'] }, { when: 'html.c', palette: ['#0b3f8c'] }] });
  assert.match(svg, /pa-link[^>]*stroke="#6e86c8"[^>]*style="[^"]*stroke:var\(--pa-s\d+\)/);
});

// ── data-key ─────────────────────────────────────────────────────────────
test('data-key: regions carry the key the data used; markers theirs', () => {
  const svg = plot({ type: 'choropleth', geo: 'chile', data: [{ cut: 'Biobío', v: 3 }], key: 'cut', value: 'v',
    markers: [{ lon: -73.05, lat: -36.82, label: 'Concepción', id: '8101' }] });
  assert.match(svg, /data-key="Biobío"/);
  assert.match(svg, /data-key="8101"/);
  // Las regiones sin dato también llevan una clave estable.
  const keys = [...svg.matchAll(/<path class="pa-m"[^>]*data-key="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(keys.length, 16);
  assert.equal(new Set(keys).size, 16);
});

// ── orientation / rotate / identity ──────────────────────────────────────
const chile = { type: 'choropleth', geo: 'chile', key: 'r', value: 'v', width: 900,
  data: [{ r: 'Arica y Parinacota', v: 1 }, { r: 'Magallanes', v: 2 }, { r: 'Biobío', v: 3 }] };
const vb = (svg) => svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/).slice(1).map(Number);
const cx = (svg, k) => { const d = svg.match(new RegExp(`d="M([\\d.-]+),([\\d.-]+)[^"]*"[^>]*data-key="${k}"`)); return [+d[1], +d[2]]; };

test('orientation: landscape lays Chile on its side, north on the left', () => {
  const svg = plot({ ...chile, orientation: 'landscape' });
  const [w, h] = vb(svg);
  assert.ok(w > h * 2, `${w}x${h}`);
  assert.ok(cx(svg, 'Arica y Parinacota')[0] < cx(svg, 'Biobío')[0]);
  assert.ok(cx(svg, 'Biobío')[0] < cx(svg, 'Magallanes')[0]);
  // El texto queda derecho: nada rota las etiquetas.
  assert.doesNotMatch(svg, /<text[^>]*rotate\(/);
  // rotate: 90 lo acuesta al revés (norte a la derecha); landscape sobre algo ya ancho no hace nada.
  const r90 = plot({ ...chile, rotate: 90 });
  assert.ok(cx(r90, 'Arica y Parinacota')[0] > cx(r90, 'Magallanes')[0]);
  const world0 = plot({ ...world });
  assert.equal(plot({ ...world, orientation: 'landscape' }), world0);
});

test('projection identity: coordinates as given, flipY for y-up geometry', () => {
  const geo = { type: 'FeatureCollection', features: [
    { type: 'Feature', properties: { name: 'Arriba' }, geometry: { type: 'Polygon', coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]] } },
    { type: 'Feature', properties: { name: 'Abajo' }, geometry: { type: 'Polygon', coordinates: [[[0, 100], [10, 100], [10, 110], [0, 110], [0, 100]]] } },
  ] };
  const spec = { type: 'choropleth', geo, projection: 'identity', key: 'n', value: 'v', data: [{ n: 'Arriba', v: 1 }, { n: 'Abajo', v: 2 }], width: 400, legend: false };
  const down = plot(spec);
  assert.ok(cx(down, 'Arriba')[1] < cx(down, 'Abajo')[1]);
  const up = plot({ ...spec, flipY: true });
  assert.ok(cx(up, 'Arriba')[1] > cx(up, 'Abajo')[1]);
});
