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

// ── Disposiciones (`layout`) ────────────────────────────────────────────────
import { NETWORK_LAYOUTS, layoutName } from '../src/charts/network.js';
import { escenas, nodosElenco } from '../examples/specs-network.js';
import { measure } from '../src/text.js';

const elenco = { type: 'network', title: 't', data: escenas, nodes: nodosElenco, value: 'escenas', group: 'circulo' };
const circles = (svg) => [...svg.matchAll(/<circle class="pa-m" cx="([\d.-]+)" cy="([\d.-]+)" r="([\d.]+)"[^>]*data-node="([^"]+)"/g)].map((m) => ({ cx: +m[1], cy: +m[2], r: +m[3], id: m[4] }));
const viewBox = (svg) => /viewBox="([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+)"/.exec(svg).slice(1).map(Number);

test('layout: alias y valores desconocidos', () => {
  assert.deepEqual(NETWORK_LAYOUTS, ['force', 'circular', 'radial', 'concentric', 'clusters', 'tree', 'grid']);
  assert.equal(layoutName('circle'), 'circular');
  assert.equal(layoutName('CLUSTER'), 'clusters');
  assert.equal(layoutName('nope'), 'force');
  assert.equal(layoutName(undefined), 'force');
  assert.equal(draw({ ...elenco, layout: 'nope' }), draw({ ...elenco, layout: 'force' }));
  assert.equal(draw({ ...elenco, layout: 'circle' }), draw({ ...elenco, layout: 'circular' }));
});

test('layout: cada disposición dibuja, es determinista y no deja NaN ni nodos fuera', () => {
  for (const layout of NETWORK_LAYOUTS)
    for (const extra of [{}, { width: 390 }, { theme: 'noche' }, { focus: 'Andrés' }]) {
      const spec = { ...elenco, layout, ...extra };
      const svg = draw(spec);
      const tag = `${layout} ${JSON.stringify(extra)}`;
      assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'), tag);
      assert.ok(!/NaN|undefined|Infinity|object Object/.test(svg), tag);
      assert.equal(svg, draw(spec), `no determinista: ${tag}`);
      assert.match(svg, new RegExp(`<g class="pa-net" data-layout="${layout}">`), tag);
      const [, , W, H] = viewBox(svg);
      const cs = circles(svg);
      assert.equal(cs.length, nodosElenco.length, tag);
      for (const c of cs) assert.ok(c.cx - c.r >= 0 && c.cx + c.r <= W && c.cy - c.r >= 0 && c.cy + c.r <= H, `${tag}: ${c.id} fuera`);
    }
});

test('layout: redes mínimas, componentes sueltos y nodos aislados', () => {
  for (const layout of NETWORK_LAYOUTS) {
    for (const spec of [
      { data: [{ from: 'a', to: 'b' }] },
      { data: [{ from: 'a', to: 'b' }, { from: 'c', to: 'd' }], nodes: [{ id: 'e' }] },
      { data: [{ from: 'a', to: 'b' }, { from: 'c', to: 'd' }], focus: 'c' },
    ]) {
      const svg = draw({ type: 'network', layout, ...spec });
      assert.ok(!/NaN|undefined|Infinity/.test(svg), `${layout} ${JSON.stringify(spec)}`);
    }
  }
});

test('layout: el foco queda al centro en las disposiciones centradas', () => {
  for (const layout of ['force', 'circular', 'radial', 'concentric', 'clusters']) {
    const svg = draw({ ...elenco, layout, focus: 'Andrés', legend: false, title: undefined });
    const f = circles(svg).find((c) => c.id === 'Andrés');
    const mid = viewBox(svg)[2] / 2; // márgenes simétricos: el centro del área es el del lienzo
    assert.ok(Math.abs(f.cx - mid) < 25, `${layout}: foco en x=${f.cx}, centro ${mid}`);
    assert.match(svg, /font-weight="600" stroke="[^"]+" stroke-width="2" paint-order="stroke" stroke-linejoin="round" data-node="Andrés"/, layout);
  }
});

test('aristas: color del origen, ancho 1 sin campo de valor, data-s/data-t para el hover', () => {
  const plain = draw({ type: 'network', data: [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }, { from: 'c', to: 'a' }] });
  const paths = [...plain.matchAll(/<path class="pa-m" d="[^"]+"([^>]*)>/g)].map((m) => m[1]);
  assert.equal(paths.length, 3);
  for (const p of paths) { assert.ok(!/stroke-width/.test(p), 'sin valor: ancho 1 (heredado del grupo)'); assert.match(p, /data-s="\w" data-t="\w"/); }
  assert.match(plain, /<g class="pa-links" fill="none" stroke-linecap="round" stroke-opacity="0.5" stroke-width="1">/);
  const weighted = draw({ type: 'network', data: [{ from: 'a', to: 'b', value: 1 }, { from: 'b', to: 'c', value: 100 }] });
  const ws = [...weighted.matchAll(/<path class="pa-m"[^>]*stroke-width="([\d.]+)"/g)].map((m) => +m[1]);
  assert.ok(ws.length && Math.max(...ws) <= 3 && Math.min(...ws) >= 0.6, ws.join());
  // Muchas aristas: opacidad base 0,3. Color = nodo de origen.
  const svg = draw({ ...elenco });
  assert.match(svg, /<g class="pa-links" [^>]*stroke-opacity="0.3"/);
  assert.match(svg, /class="pa-net"/);
  // Rectas con curveness 0.
  assert.ok(!/<path class="pa-m" d="M[\d.,]+Q/.test(draw({ type: 'network', data: [{ from: 'a', to: 'b' }], curveness: 0 })));
});

test('etiquetas: tinta con halo, data-node, sin choques entre sí; nombres ocultos siguen en el tooltip', () => {
  for (const layout of ['force', 'radial', 'concentric', 'clusters', 'tree', 'grid']) {
    const svg = draw({ ...elenco, layout });
    const labels = [...svg.matchAll(/<text x="([\d.-]+)" y="([\d.-]+)" text-anchor="(\w+)" fill="[^"]+" font-size="([\d.]+)" font-weight="(\d+)"[^>]*data-node="([^"]+)">([^<]*)<\/text>/g)]
      .map((m) => { const [x, y, a, fs, fw, id, t] = [+m[1], +m[2], m[3], +m[4], +m[5], m[6], m[7]]; const w = measure(t, fs, fw); const x0 = a === 'start' ? x : a === 'end' ? x - w : x - w / 2; return { id, box: [x0, y - fs * 0.85, x0 + w, y + fs * 0.25] }; });
    assert.ok(labels.length >= 3, `${layout}: ${labels.length} etiquetas`);
    for (let i = 0; i < labels.length; i++)
      for (let j = i + 1; j < labels.length; j++) {
        const a = labels[i].box, b = labels[j].box;
        assert.ok(a[2] <= b[0] || b[2] <= a[0] || a[3] <= b[1] || b[3] <= a[1], `${layout}: ${labels[i].id} pisa ${labels[j].id}`);
      }
    for (const n of nodosElenco) assert.ok(svg.includes(`data-tip="${n.id}&#10;`) || svg.includes(`data-tip="${n.id}\n`), `${n.id} sin tooltip`);
  }
});

test('circular: nombres girados hacia afuera, volteados a la izquierda', () => {
  const svg = draw({ ...elenco, layout: 'circular' });
  const rot = [...svg.matchAll(/text-anchor="(start|end)" transform="rotate\(([-\d.]+) /g)];
  assert.ok(rot.length > 30, `${rot.length} etiquetas giradas`);
  assert.ok(rot.some((m) => m[1] === 'end') && rot.some((m) => m[1] === 'start'));
});

test('árbol: las conexiones fuera del árbol quedan tenues', () => {
  const svg = draw({ ...elenco, layout: 'tree' });
  assert.match(svg, /<path class="pa-m" d="M[\d.,]+C/); // conectores en S
  assert.match(svg, /stroke-opacity="0.15"/);
});

test('rendimiento: red grande (Barnes–Hut + grilla) sin NaN y dentro del área', () => {
  let s = 11; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const data = [];
  for (let i = 1; i < 400; i++) { data.push({ from: 'n' + i, to: 'n' + Math.floor(Math.pow(r(), 2) * i) }); if (r() < 0.4) data.push({ from: 'n' + i, to: 'n' + Math.floor(r() * 400) }); }
  const t = Date.now();
  const svg = draw({ type: 'network', data });
  assert.ok(Date.now() - t < 3000);
  assert.ok(!/NaN/.test(svg));
  const [, , W, H] = viewBox(svg);
  for (const c of circles(svg)) assert.ok(c.cx - c.r >= 0 && c.cx + c.r <= W && c.cy - c.r >= 0 && c.cy + c.r <= H);
});
