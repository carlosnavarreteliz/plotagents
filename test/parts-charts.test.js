import { test } from 'node:test';
import assert from 'node:assert/strict';
import { treemap, squarify } from '../src/charts/treemap.js';
import { sunburst } from '../src/charts/sunburst.js';
import { donut, pie } from '../src/charts/donut.js';
import { buildHierarchy, findNode } from '../src/hierarchy.js';
import { themeFor } from '../src/theme.js';
import { partsGallery, exportaciones3 } from '../examples/specs-parts.js';

const R = { treemap, sunburst, donut, pie };
const draw = (s) => R[s.type](s, themeFor(s));

test('la galería de partes produce SVG válido en ambos temas y anchos', () => {
  for (const ex of partsGallery) for (const theme of ['papel', 'noche']) for (const width of [720, 420]) {
    const svg = draw({ ...ex.spec, theme, width });
    const tag = `${ex.id}/${theme}/${width}`;
    assert.match(svg, /^<svg[^>]+viewBox="0 0 \d+ [\d.]+"/, tag);
    assert.ok(svg.endsWith('</svg>'), tag);
    assert.ok(!/NaN|undefined|Infinity/.test(svg), `${tag} contiene NaN/undefined/Infinity`);
    assert.match(svg, /<desc[^>]*>[^<]+<\/desc>/, tag);
  }
});

test('squarify anidado conserva el área en cada nivel', () => {
  const { root } = buildHierarchy({ data: exportaciones3, path: ['sector', 'subsector', 'producto'], value: 'valor' });
  const check = (node, x, y, w, h) => {
    if (!node.children.length) return;
    const rects = squarify(node.children, x, y, w, h);
    const area = rects.reduce((a, r) => a + r.w * r.h, 0);
    assert.ok(Math.abs(area - w * h) < 1e-6 * w * h + 1e-6);
    for (const r of rects) {
      assert.ok(r.x >= x - 1e-9 && r.y >= y - 1e-9 && r.x + r.w <= x + w + 1e-6 && r.y + r.h <= y + h + 1e-6);
      check(r, r.x, r.y, r.w, r.h);
    }
  };
  check(root, 0, 0, 640, 400);
});

test('la jerarquía agrega filas repetidas y respeta depth', () => {
  const data = [{ a: 'X', b: 'p', v: 1 }, { a: 'X', b: 'p', v: 2 }, { a: 'X', b: 'q', v: 3 }, { a: 'Y', b: 'r', v: 10 }, { a: 'Y', b: 'r', v: -5 }];
  const { root } = buildHierarchy({ data, path: ['a', 'b'], value: 'v' });
  assert.equal(root.value, 16);
  assert.deepEqual(root.children.map((c) => c.name), ['Y', 'X']);
  assert.equal(findNode(root, ['X', 'p']).value, 3);
  const flat = buildHierarchy({ data, path: ['a', 'b'], value: 'v', depth: 1 }).root;
  assert.ok(flat.children.every((c) => c.children.length === 0));
});

test('treemap: data-drill en grupos y foco con migas de pan', () => {
  const base = { type: 'treemap', data: exportaciones3, path: ['sector', 'subsector', 'producto'], value: 'valor' };
  const svg = draw(base);
  assert.ok(svg.includes('data-drill="[&quot;Minería&quot;]"'));
  const focused = draw({ ...base, focus: ['Agro'] });
  assert.ok(focused.includes('data-drill="[]"'), 'miga raíz');
  assert.ok(focused.includes('>Cerezas<'));
  assert.ok(!focused.includes('>Cobre<'));
  assert.ok(focused.includes('data-drill="[&quot;Agro&quot;,&quot;Fruta fresca&quot;]"'));
});

test('sunburst: arcos con hijos llevan data-drill y el foco sube con el centro', () => {
  const base = { type: 'sunburst', data: exportaciones3, path: ['sector', 'subsector', 'producto'], value: 'valor' };
  assert.ok(draw(base).includes('data-drill="[&quot;Minería&quot;,&quot;Metálica&quot;]"'));
  const f = draw({ ...base, focus: ['Minería'] });
  assert.ok(f.includes('class="pa-center" data-drill="[]"'));
});

test('dona: agrupa en Otros, etiquetas exteriores y media dona', () => {
  const data = Array.from({ length: 9 }, (_, i) => ({ k: 'Cat ' + i, v: 10 - i }));
  const svg = draw({ type: 'donut', data, label: 'k', value: 'v' });
  assert.ok(svg.includes('>Otros<'));
  const out = draw({ type: 'donut', data: data.slice(0, 5), label: 'k', value: 'v', labels: 'outside', width: 760 });
  assert.ok((out.match(/<path d="M[^"]+L[^"]+L[^"]+" fill="none"/g) || []).length === 5, 'una línea guía por segmento');
  const half = draw({ type: 'donut', half: true, data: data.slice(0, 3), label: 'k', value: 'v' });
  assert.ok(half.includes('Total'));
  const p = draw({ type: 'pie', data: data.slice(0, 4), label: 'k', value: 'v' });
  assert.ok(p.includes('data-pa-type="pie"'));
});
