import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plot, safePlot } from '../src/index.js';
import { fromParents, fromLinkage, leaves, cutTree } from '../src/tree.js';

const Z = [[0, 1, 0.2, 2], [2, 3, 0.3, 2], [4, 5, 0.7, 4], [6, 7, 1.1, 5]];
const labels = ['Arica', 'Iquique', 'Calama', 'Antofagasta', 'Copiapó'];
const spec = { type: 'dendrogram', linkage: Z, labels, width: 640, locale: 'en' };

test('tree helpers: linkage, parents, cut', () => {
  const t = fromLinkage(Z);
  assert.deepEqual(leaves(t), [2, 3, 4, 0, 1]);
  assert.deepEqual(cutTree(t, 0.5).map((n) => leaves(n)), [[2, 3], [4], [0, 1]]);
  const p = fromParents([{ id: 'r', parent: null, height: 2 }, { id: 'a', parent: 'r', height: 1 }, { id: 'x', parent: 'a' }, { id: 'y', parent: 'a' }, { id: 'z', parent: 'r' }, { id: 'w', parent: 'r' }]);
  assert.deepEqual(leaves(p), ['x', 'y', 'z', 'w']);
  assert.equal(p.h, 2);
  // A parent with a single child passes straight through.
  assert.deepEqual(leaves(fromParents([{ id: 'r', parent: null, height: 1 }, { id: 'm', parent: 'r', height: 0.5 }, { id: 'x', parent: 'm' }, { id: 'y', parent: 'r' }])), ['x', 'y']);
  assert.throws(() => fromParents([{ id: 'a', parent: 'b' }, { id: 'b', parent: 'a' }]));
});

test('dendrogram: leaves labelled, linkage-only spec is valid, height axis', () => {
  const r = safePlot(spec);
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  for (const l of labels) assert.match(r.svg, new RegExp(`>${l}<`));
  assert.match(r.svg, /data-pa-type="dendrogram"/);
  assert.equal(safePlot({ linkage: Z, labels }).svg.includes('data-pa-type="dendrogram"'), true); // inferred
  assert.equal(safePlot({ ...spec, labels: ['a'] }).ok, false);
});

test('dendrogram: cut colors groups and names them', () => {
  const svg = plot({ ...spec, cut: 0.5, clusters: ['Copper', 'Atacama', 'Far north'] });
  assert.match(svg, />Far north · 2</);
  assert.match(svg, />Atacama · 1</);
  assert.match(svg, /stroke-dasharray="4 3"/); // the cut line
  assert.match(svg, /data-tip="Calama\nCopper"/);
  assert.match(svg, /Cut at 0\.5 gives 3 groups/);
});

test('dendrogram: rows input, vertical, thinned labels, skins, deterministic', () => {
  const many = Array.from({ length: 120 }, (_, i) => ({ id: 'L' + i, parent: 'g' + (i % 6) }))
    .concat(Array.from({ length: 6 }, (_, i) => ({ id: 'g' + i, parent: 'root', height: 1 })), [{ id: 'root', parent: null, height: 2 }]);
  const svg = plot({ type: 'dendrogram', data: many, height: 400, width: 640 });
  const shown = (svg.match(/>L\d+</g) || []).length;
  assert.ok(shown > 0 && shown < 120, `thinned: ${shown}`);
  assert.match(plot({ ...spec, orientation: 'vertical' }), /rotate\(90/);
  const sk = plot({ ...spec, cut: 0.5, skins: [{ palette: ['#6e86c8', '#d9714f', '#19a17d'] }, { when: 'html.classic', palette: ['#0b3f8c', '#d52b1e', '#1d7a74'] }] });
  assert.match(sk, /html\.classic \.pa-skin-[a-z0-9]+\{[^}]*#0b3f8c/);
  assert.equal(plot(spec), plot(spec));
});
