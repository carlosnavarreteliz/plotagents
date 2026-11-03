import { test } from 'node:test';
import assert from 'node:assert/strict';
import { network, prepareNetwork } from '../src/charts/network.js';
import { chord, prepareChord } from '../src/charts/chord.js';
import { themeFor } from '../src/theme.js';
import { networkGallery } from '../examples/specs-network.js';

const R = { network, chord };
const draw = (s) => R[s.type](s, themeFor(s));

test('galería de redes y cuerdas: SVG válido en ambos temas y anchos', () => {
  for (const ex of networkGallery)
    for (const theme of ['papel', 'noche'])
      for (const width of [720, 390]) {
        const svg = draw({ ...ex.spec, theme, width });
        assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'), ex.id);
        assert.ok(!/NaN|undefined|object Object/.test(svg), `${ex.id} ${theme} ${width}`);
        assert.match(svg, /<desc[^>]*>[^<]{20,}<\/desc>/);
      }
});

test('salida determinista: el mismo spec da el mismo SVG', () => {
  for (const ex of networkGallery) assert.equal(draw(ex.spec), draw(ex.spec));
});

test('los nodos quedan dentro del área del gráfico', () => {
  for (const ex of networkGallery.filter((e) => e.spec.type === 'network'))
    for (const width of [720, 390]) {
      const svg = draw({ ...ex.spec, width });
      const [, , W, H] = /viewBox="([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+)"/.exec(svg).slice(1).map(Number);
      const nodes = [...svg.matchAll(/<circle class="pa-m" cx="([\d.-]+)" cy="([\d.-]+)" r="([\d.]+)"/g)].map((m) => m.slice(1).map(Number));
      assert.ok(nodes.length > 5);
      for (const [cx, cy, r] of nodes) {
        assert.ok(cx - r >= 0 && cx + r <= W, `x fuera: ${cx}`);
        assert.ok(cy - r >= 0 && cy + r <= H, `y fuera: ${cy}`);
      }
    }
});

test('red: nodos derivados de las aristas y peso por grado ponderado', () => {
  const { nodes, edges } = prepareNetwork({ data: [{ from: 'A', to: 'B', value: 2 }, { from: 'B', to: 'A', value: 3 }, { from: 'B', to: 'C', value: 1 }] });
  assert.equal(nodes.length, 3);
  assert.equal(edges.length, 2); // A–B se agrega en un solo par
  assert.equal(nodes.find((n) => n.id === 'B').w, 6);
  const svg = network({ data: [{ from: 'A', to: 'B' }, { from: 'B', to: 'C' }], highlight: 'A', title: 't' }, themeFor({}));
  assert.ok(svg.includes('pa-m'));
});

test('red: grupos con leyenda y color exacto en los nodos', () => {
  const svg = draw({ type: 'network', data: [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }], nodes: [{ id: 'a', g: 'X' }, { id: 'b', g: 'Y' }, { id: 'c', g: 'Y' }], group: 'g' });
  assert.match(svg, /class="pa-legend"/);
  const legendColors = [...svg.matchAll(/<circle cx="[\d.]+" cy="[\d.]+" r="5" fill="(#[0-9A-F]{6})"/gi)].map((m) => m[1]);
  for (const c of legendColors) assert.ok(svg.includes(`r="`) && new RegExp(`class="pa-m" cx="[\\d.]+" cy="[\\d.]+" r="[\\d.]+" fill="${c}"`, 'i').test(svg), `nodo sin color de leyenda ${c}`);
});

test('cuerdas: matriz o filas, dirigido y no dirigido', () => {
  const { names, m } = prepareChord({ data: [{ from: 'A', to: 'B', value: 5 }, { from: 'B', to: 'A', value: 3 }, { from: 'A', to: 'C', value: 2 }] });
  assert.deepEqual(names, ['A', 'B', 'C']);
  assert.equal(m[0][1], 5);
  const a = chord({ matrix: [[0, 5, 2], [3, 0, 0], [0, 1, 0]], names: ['A', 'B', 'C'] }, themeFor({}));
  const b = chord({ matrix: [[0, 5, 2], [3, 0, 0], [0, 1, 0]], names: ['A', 'B', 'C'], directed: true, locale: 'en' }, themeFor({}));
  assert.ok(!/NaN/.test(a + b));
  assert.match(b, /A → B/);
  assert.throws(() => chord({ data: [{ from: 'A', to: 'A', value: 1 }] }, themeFor({})));
});
