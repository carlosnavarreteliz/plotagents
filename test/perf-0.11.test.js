// Presupuestos de tamaño para datos grandes, y que marcas y tooltips sigan ahí.
import test from 'node:test';
import assert from 'node:assert/strict';
import { plot } from '../src/index.js';
import { dotLayer } from '../src/svg.js';

let s = 1;
const u = () => (s = (s * 16807) % 2147483647) / 2147483647;
const rows = (n) => Array.from({ length: n }, (_, i) => ({ x: u() * 100, y: u() * 100, v: u() * 1000, g: 'ABCD'[i % 4] }));
const kB = (str) => str.length / 1024;
const near = (svg) => {
  const m = /data-near='([^']*)'/.exec(svg);
  assert.ok(m, 'falta data-near');
  return JSON.parse(m[1].replace(/&lt;/g, '<').replace(/&#39;/g, "'").replace(/&amp;/g, '&'));
};

test('dotLayer: el path relativo cae a ≤ 0.1 px de cada centro y data-near conserva el tooltip', () => {
  const cs = Array.from({ length: 2000 }, (_, i) => ({ class: 'pa-m', cx: 10 + u() * 500, cy: 10 + u() * 300, r: 3, fill: i % 2 ? '#111111' : '#222222', fillOpacity: 0.9, stroke: '#fff', strokeWidth: 1, 'data-tip': `p${i}\nX: ${i}` }));
  const out = dotLayer(cs.map((c) => ({ ...c })));
  const paths = [...out.matchAll(/<path d="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(paths.length, 2);
  // Lee los centros: M/m con (dx dy) y luego dos arcos que vuelven al punto de partida.
  const centers = [];
  for (const d of paths) {
    let px = 0, py = 0;
    for (const m of d.matchAll(/([Mm])(-?[\d.]+)[ ,]?(-?[\d.]+)/g)) {
      if (m[1] === 'M') { px = +m[2]; py = +m[3]; } else { px += +m[2]; py += +m[3]; }
      centers.push([px + 3, py]);
    }
  }
  assert.equal(centers.length, 2000);
  for (const c of cs) assert.ok(centers.some(([x, y]) => Math.abs(x - c.cx) <= 0.1 && Math.abs(y - c.cy) <= 0.1));
  const n = near(out);
  assert.equal(n.p.length, 2000);
  assert.equal(n.c.length, 2);
  assert.match(n.p[5][2], /^p5\nX: 5$/);
  assert.equal(n.c[n.p[5][3]], cs[5].fill);
});

test('scatter 20 mil puntos: bajo 1700 kB, con un tooltip por punto', () => {
  const svg = plot({ type: 'scatter', data: rows(20000), x: 'x', y: 'y', series: 'g' });
  assert.ok(kB(svg) < 1700, `${kB(svg)} kB`);
  assert.ok((svg.match(/<circle/g) || []).length <= 4); // solo la leyenda
  const n = near(svg);
  assert.equal(n.p.length, 20000);
  assert.match(n.p[0][2], /X: /);
});

test('regplot 5 mil puntos: bajo 450 kB', () => {
  const svg = plot({ type: 'regplot', data: rows(5000), x: 'x', y: 'y' });
  assert.ok(kB(svg) < 450, `${kB(svg)} kB`);
  assert.equal(near(svg).p.length, 5000);
});

test('pairplot 3 mil filas: bajo 850 kB', () => {
  const svg = plot({ type: 'pairplot', data: rows(3000), vars: ['x', 'y', 'v'] });
  assert.ok(kB(svg) < 850, `${kB(svg)} kB`);
});

test('ecdf 20 mil valores en 4 grupos: bajo 80 kB y conserva el tooltip de cuantiles', () => {
  const svg = plot({ type: 'ecdf', data: rows(20000), x: 'x', hue: 'g' });
  assert.ok(kB(svg) < 80, `${kB(svg)} kB`);
  assert.equal((svg.match(/data-tip="/g) || []).length, 4);
  assert.match(svg, /P25: /);
});

test('ecdf: el trazo relativo sube de 0 a 1 en escalones', () => {
  const svg = plot({ type: 'ecdf', data: [{ x: 1 }, { x: 2 }, { x: 3 }, { x: 4 }], x: 'x' });
  const d = [...svg.matchAll(/<path d="([^"]+)" fill="none" stroke="(?!transparent)/g)][0][1];
  let y = 0; const ys = new Set();
  for (const m of d.matchAll(/([Mhv])(-?[\d.]+)(?:,(-?[\d.]+))?/g)) {
    if (m[1] === 'M') y = +m[3]; else if (m[1] === 'v') { y += +m[2]; ys.add(y.toFixed(1)); }
  }
  assert.ok(ys.size >= 4);
});
