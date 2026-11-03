import { test } from 'node:test';
import assert from 'node:assert/strict';
import { themeFor } from '../src/theme.js';
import { pyramid } from '../src/charts/pyramid.js';
import { flowchart } from '../src/charts/flowchart.js';
import { flowGallery, poblacion2024 } from '../examples/specs-flow.js';

const render = (spec) => ({ pyramid, flowchart })[spec.type](spec, themeFor(spec));
const clean = (svg) => !/NaN|undefined|object Object/.test(svg);

test('galería: SVG válido en ambos temas y anchos', () => {
  for (const ex of flowGallery) for (const theme of ['papel', 'noche']) for (const width of [720, 390]) {
    const svg = render({ ...ex.spec, theme, width });
    assert.match(svg, /^<svg[^>]+viewBox="0 0 \d+ [\d.]+"/, ex.id);
    assert.ok(svg.endsWith('</svg>'), ex.id);
    assert.ok(clean(svg), `${ex.id} ${theme} ${width}`);
    assert.match(svg, /<desc[^>]*>[^<]{20,}<\/desc>/, ex.id);
  }
});

test('determinista: el mismo spec da el mismo SVG', () => {
  for (const ex of flowGallery) assert.equal(render(ex.spec), render(ex.spec), ex.id);
});

test('pirámide: dos lados, edades al centro, comparación y porcentajes', () => {
  const svg = pyramid({ data: poblacion2024, age: 'edad', sex: 'sexo', value: 'personas' }, themeFor({}));
  assert.ok(svg.includes('>80+<') && svg.includes('>0-4<'));
  assert.ok(svg.indexOf('>80+<') < svg.indexOf('>0-4<'), 'los mayores van arriba');
  const cmp = render(flowGallery.find((g) => g.id === 'piramide-comparada').spec);
  assert.equal((cmp.match(/class="pa-compare"/g) || []).length, 2);
  assert.match(cmp, /%</);
  assert.throws(() => pyramid({ data: [{ e: '0-4', s: 'A', v: 1 }, { e: '0-4', s: 'B', v: 1 }, { e: '0-4', s: 'C', v: 1 }], age: 'e', sex: 's', value: 'v' }, themeFor({})), /exactamente 2/);
});

test('pirámide: inglés y etiquetas de valor', () => {
  const svg = pyramid({ data: poblacion2024, age: 'edad', sex: 'sexo', value: 'personas', labels: true, locale: 'en' }, themeFor({}));
  assert.match(svg, /Population pyramid/);
  assert.ok(clean(svg));
});

test('flujo: sin nodos superpuestos y dentro del ancho, en todas las direcciones', () => {
  const base = flowGallery.find((g) => g.id === 'flujo-compra').spec;
  for (const width of [390, 720, 1150]) for (const direction of [undefined, 'TB', 'LR']) {
    const spec = { ...base, width, direction, _layout: {} };
    const svg = flowchart(spec, themeFor(spec));
    assert.ok(clean(svg));
    const ns = spec._layout.nodes;
    assert.equal(ns.length, 13);
    for (let i = 0; i < ns.length; i++) for (let j = i + 1; j < ns.length; j++) {
      const a = ns[i], b = ns[j];
      const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
      assert.ok(!overlap, `${a.id} y ${b.id} se superponen (${width}, ${direction})`);
    }
    for (const n of ns) assert.ok(n.x >= 0 && n.x + n.w <= width, `${n.id} fuera del ancho (${width}, ${direction})`);
  }
});

test('flujo: nodos derivados de las conexiones, ciclos y etiquetas', () => {
  const spec = { data: [{ from: 'A', to: 'B' }, { from: 'B', to: 'C', label: 'Sí' }, { from: 'C', to: 'A', label: 'Reintentar' }], _layout: {} };
  const svg = flowchart(spec, themeFor(spec));
  assert.ok(clean(svg));
  assert.equal(spec._layout.nodes.length, 3);
  assert.ok(svg.includes('>Reintentar<') && svg.includes('>Sí<'));
  assert.match(svg, /<marker id="pa-arrow-[a-z0-9]+" viewBox="0 0 10 10" refX=/);
  assert.throws(() => flowchart({ data: [] }, themeFor({})), /no tiene nodos/);
});
