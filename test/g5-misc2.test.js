import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plot, lint, schema } from '../src/index.js';
import { activeTip, currentView } from '../src/views-client.js';
import { measure } from '../src/text.js';

const ids = (svg) => [...svg.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
const count = (s, re) => (s.match(re) || []).length;

// ── 1. Ids internos por contenido ───────────────────────────────────────────
const series = (k) => Array.from({ length: 12 }, (_, i) => ({ year: 2013 + i, v: Math.sin(i + k) * 10 + 20 }));
const untitled = (k, extra = {}) => ({ type: 'line', data: series(k), x: 'year', y: 'v', width: 902, height: 176, yDomain: [0, 40], ...extra });

test('ids: two untitled 902×176 line charts with other data share no id (clip, aria)', () => {
  const a = plot(untitled(0)), b = plot(untitled(1));
  assert.match(a, /<clipPath id="pa-clip-[a-z0-9]+"/);
  for (const id of ids(a)) assert.ok(!ids(b).includes(id), id);
  // Same drawing → same ids: stable across builds.
  assert.equal(plot(untitled(0)), a);
  // An option that does not change the drawing does not change the ids.
  assert.equal(plot(untitled(0, { bare: false, yFormat: undefined })), a);
});

test('ids: small untitled charts with the same description get their own -t / -d', () => {
  const spark = (k) => plot({ type: 'bar', data: [{ a: 'x', v: k }, { a: 'y', v: 2 }], x: 'a', y: 'v', width: 300, height: 160 });
  const t = (s) => /aria-labelledby="([^"]+)"/.exec(s)[1];
  assert.notEqual(t(spark(1)), t(spark(3)));
});

test('ids: skins and CSS-variable colors keep the ids of the plain drawing', () => {
  const spec = untitled(0, { dashedFrom: 2020, dashedLabel: 'Proj.', type: 'area' });
  const plain = ids(plot(spec));
  const skinned = plot({ ...spec, skins: [{}, { when: 'html.x', palette: ['#0b3f8c'] }] });
  assert.deepEqual(ids(skinned), plain);
  const vars = plot({ ...spec, colors: { v: 'var(--accent, #3a47b8)' } });
  assert.deepEqual(ids(vars), plain);
});

test('ids: idPrefix names every internal id (clip, gradient, hatch, ramp, marker, pattern, gantt)', () => {
  const pre = (s) => ids(s).every((id) => id.startsWith('blk-'));
  assert.ok(pre(plot(untitled(0, { idPrefix: 'blk', dashedFrom: 2020, dashedLabel: 'P' }))));
  assert.match(plot(untitled(0, { idPrefix: 'blk' })), /id="blk-clip"/);
  assert.match(plot({ ...untitled(0, { idPrefix: 'blk' }), yDomain: undefined }), /id="blk-grad"/);
  const hm = plot({ type: 'heatmap', data: [{ x: 'a', y: 'p', v: 1 }, { x: 'b', y: 'p', v: null }, { x: 'a', y: 'q', v: 3 }], x: 'x', y: 'y', value: 'v', missing: 'hatch', idPrefix: 'blk' });
  assert.ok(pre(hm), ids(hm).join());
  assert.match(hm, /id="blk-ramp"/);
  assert.match(hm, /id="blk-hm-nd"/);
  const bar = plot({ type: 'bar', data: [{ a: 'x', v: 1 }, { a: 'y', v: 2 }], x: 'a', y: 'v', dashed: 'y', dashedLabel: 'P', idPrefix: 'blk' });
  assert.ok(pre(bar), ids(bar).join());
  const flow = plot({ type: 'flowchart', data: [{ from: 'A', to: 'B' }], idPrefix: 'blk' });
  assert.match(flow, /<marker id="blk-arrow"/);
  const gantt = plot({ type: 'gantt', data: [{ task: 'a', start: '2024-01-01', end: '2024-01-10', progress: 0.5 }, { task: 'b', start: '2024-01-11', end: '2024-01-20', dependsOn: 'a' }], idPrefix: 'blk' });
  assert.ok(pre(gantt), ids(gantt).join());
  // Without idPrefix no id keeps the placeholder.
  for (const s of [plot(untitled(0)), plot({ ...gantt && { type: 'gantt', data: [{ task: 'a', start: '2024-01-01', end: '2024-01-10', progress: 0.5 }] } })]) assert.doesNotMatch(s, //);
});

test('ids: facet panels resolve their own ids', () => {
  const data = [...series(0).map((r) => ({ ...r, g: 'A' })), ...series(2).map((r) => ({ ...r, g: 'B' }))];
  const svg = plot({ type: 'line', data, x: 'year', y: 'v', facet: 'g', yDomain: [0, 40] });
  const clips = ids(svg).filter((id) => id.startsWith('pa-clip-'));
  assert.equal(clips.length, 2);
  assert.notEqual(clips[0], clips[1]);
  assert.doesNotMatch(svg, //);
});

// ── 2. strip / swarm ────────────────────────────────────────────────────────
const runs = ['Censo', 'Casen', 'SII'];
const rel = runs.flatMap((run, j) => Array.from({ length: 30 }, (_, i) => ({ run, rel: 10 ** (((i * 37 + j * 11) % 60) / 10 - 4) })));
const sw = { type: 'swarm', data: rel, x: 'rel', y: 'run', xScale: 'log', xDomain: [1e-4, 100], clamp: 'always', radius: 4.2, fixedRadius: true, rowHeight: 30, xLabel: '', width: 920, locale: 'en' };

test('strip/swarm leanDots: the style goes once on the group; dots carry cx/cy (1 decimal), r and their tooltip', () => {
  const plain = plot(sw), lean = plot({ ...sw, leanDots: true });
  assert.doesNotMatch(plain, /pa-dots/);
  const dots = [...lean.matchAll(/<circle class="pa-m"[^>]*>/g)].map((m) => m[0]);
  assert.equal(dots.length, rel.length);
  for (const d of dots) {
    assert.doesNotMatch(d, /\s(fill|stroke|fill-opacity|stroke-width|style)=/);
    assert.match(d, /cx="-?\d+(\.\d)?" cy="-?\d+(\.\d)?" r="[\d.]+" data-tip="/);
  }
  assert.match(lean, /<g class="pa-dots" fill="#[0-9A-Fa-f]{6}" fill-opacity="[\d.]+" stroke="#[0-9A-Fa-f]{6}" stroke-width="1">/);
  assert.match(lean, /\.pa-dots \.pa-m:hover\{stroke:currentColor/);
  assert.ok(lean.length < plain.length * 0.7, `${lean.length} vs ${plain.length}`);
  // Skins: the variable once per group, not per dot.
  const skins = [{ palette: ['#3a47b8'] }, { when: 'html.classic', palette: ['#0b3f8c'] }];
  const sk = plot({ ...sw, leanDots: true, skins });
  assert.equal(count(sk, /style="fill:var\(--pa-s0\)"/g), count(sk, /<g class="pa-dots"/g));
  const skPlain = plot({ ...sw, skins });
  assert.ok(sk.length < skPlain.length * 0.6, `${sk.length} vs ${skPlain.length}`);
  // strip, with hue: one group per run of the same color.
  const st = plot({ type: 'strip', data: rel.map((r, i) => ({ ...r, h: i % 2 ? 'a' : 'b' })), x: 'rel', y: 'run', hue: 'h', leanDots: true });
  assert.ok(count(st, /<g class="pa-dots"/g) >= 2);
  assert.equal(count(st, /<circle class="pa-m"/g), rel.length);
});

test('strip/swarm xLabelPosition "top": the value axis over the rows, same height', () => {
  const bottom = plot(sw), top = plot({ ...sw, xLabelPosition: 'top' });
  const h = (s) => /viewBox="0 0 \d+ ([\d.]+)"/.exec(s)[1];
  assert.equal(h(top), h(bottom));
  const tickY = (s) => +/<g class="pa-axis pa-axis-x">.*?<text[^>]*y="([\d.]+)"/.exec(s)[1];
  const dotY = (s) => Math.min(...[...s.matchAll(/<circle class="pa-m" cx="[\d.]+" cy="([\d.]+)"/g)].map((m) => +m[1]));
  assert.ok(tickY(top) < dotY(top), `${tickY(top)} < ${dotY(top)}`);
  assert.ok(tickY(bottom) > dotY(bottom));
  // With an axis title, it goes above the ticks.
  const titled = plot({ ...sw, xLabel: 'Off by', xLabelPosition: 'top' });
  const ty = +/<text[^>]*y="([\d.]+)"[^>]*>Off by</.exec(titled)[1];
  assert.ok(ty < tickY(titled));
});

// ── 3. dendrogram subWidth ──────────────────────────────────────────────────
const tree = [
  { id: 'r', parent: null, height: 3 },
  { id: 'ab', parent: 'r', height: 2 },
  { id: 'a', parent: 'ab', height: 0, label: 'Minería', sub: 'Exportaciones mineras: 58 % del total regional del país', n: 70 },
  { id: 'b', parent: 'ab', height: 0, label: 'Salud', sub: 'Egresos hospitalarios: 12 por mil habitantes al año', n: 9 },
  { id: 'c', parent: 'r', height: 0, label: 'Educación', sub: 'Matrícula superior: 41 mil estudiantes en 2024', n: 30 },
];
const dg = { type: 'dendrogram', data: tree, label: 'label', sub: 'sub', size: 'n', labels: true, width: 358, treeWidth: 48, locale: 'en' };

test('dendrogram subWidth "full": sub lines run under the size column; the bar moves to the name line', () => {
  const subs = (s) => [...s.matchAll(/<text[^>]*font-size="11"[^>]*>([^<]+)</g)].map((m) => m[1]).filter((t) => !/^\d+$/.test(t));
  const plain = plot(dg), full = plot({ ...dg, subWidth: 'full' });
  const longer = subs(full).join('').length;
  assert.ok(longer > subs(plain).join('').length, `${subs(full)} vs ${subs(plain)}`);
  assert.ok(subs(full).some((t) => !t.endsWith('…')));
  // The count still shows.
  assert.match(full, />70</);
  // Without `size`, "full" changes nothing.
  assert.equal(plot({ ...dg, size: undefined, subWidth: 'full' }), plot({ ...dg, size: undefined }));
  assert.ok(lint({ ...dg, subWidth: 'wide' }).errors.some((e) => e.code === 'enum-subWidth'));
});

// ── 4 & 11. heatmap ─────────────────────────────────────────────────────────
const hmData = ['Arica', 'Biobío', 'Magallanes'].flatMap((y, j) => ['Minería', 'Comercio', 'Salud', 'Educación'].map((x, i) => ({ y, x, v: i + j, fam: i < 2 ? 'Industria y comercio' : 'Servicios' })));
const hm = { type: 'heatmap', data: hmData, x: 'x', y: 'y', value: 'v', xGroup: 'fam', groupColors: { 'Industria y comercio': '#aa3300', Servicios: '#118844' }, groupStripe: 'labels', xLabelPosition: 'top', width: 358 };

test('heatmap groupLabels: false drops the group-name band and keeps the colored stripes (named in their tooltip)', () => {
  const on = plot(hm), off = plot({ ...hm, groupLabels: false });
  assert.match(on, /pa-groups-x/);
  assert.doesNotMatch(off, /pa-groups/);
  assert.match(off, /<g class="pa-group-stripes"><rect[^>]*fill="#aa3300" data-tip="Industria y comercio"\/>/);
  const h = (s) => +/viewBox="0 0 \d+ ([\d.]+)"/.exec(s)[1];
  assert.ok(h(off) < h(on));
  // Without groupStripe, the stripes also move next to the labels.
  assert.match(plot({ ...hm, groupStripe: undefined, groupLabels: false }), /pa-group-stripes/);
});

test('heatmap rowLabelWidth caps the row-label column; yLabelPosition "above" writes the name over its row', () => {
  const long = hmData.map((r) => ({ ...r, y: r.y + ' y Antártica Chilena, región' }));
  const base = { type: 'heatmap', data: long, x: 'x', y: 'y', value: 'v', width: 720 };
  const firstCell = (s) => +/<g class="pa-m"[^>]*><rect x="([\d.]+)"/.exec(s)[1];
  assert.ok(firstCell(plot({ ...base, rowLabelWidth: 0.45 })) > firstCell(plot(base)));
  assert.equal(firstCell(plot({ ...base, rowLabelWidth: 0.45 })), firstCell(plot({ ...base, rowLabelWidth: 0.45 * 672 })));
  const above = plot({ ...base, yLabelPosition: 'above' });
  assert.ok(firstCell(above) < 40);
  assert.match(above, new RegExp(`>${long[0].y}<`)); // whole name, full width
  const cellY = +/<g class="pa-m"[^>]*><rect x="[\d.]+" y="([\d.]+)"/.exec(above)[1];
  const nameY = +new RegExp(`<text[^>]*y="([\\d.]+)"[^>]*>${long[0].y}<`).exec(above)[1];
  assert.ok(nameY < cellY);
  assert.ok(lint({ ...base, rowLabelWidth: -1 }).errors.some((e) => e.code === 'enum-rowLabelWidth'));
});

// ── 5. plotagents/views: activeTip ──────────────────────────────────────────
function dom({ style = '', views = 'a b c', view = 'a', active = null }) {
  const mk = (attrs, parent) => {
    const a = new Map(Object.entries(attrs));
    const n = {
      parentNode: parent, getAttribute: (k) => (a.has(k) ? a.get(k) : null), hasAttribute: (k) => a.has(k), getAttributeNames: () => [...a.keys()],
      closest: (sel) => { for (let x = n; x; x = x.parentNode) if (x.matches && x.matches(sel)) return x; return null; },
    };
    return n;
  };
  const svg = mk({ 'data-views': views, 'data-view': view }, null);
  svg.matches = (sel) => (sel === 'svg[data-views]' ? true : active !== null && sel.includes(`value=${active}`));
  svg.querySelectorAll = (sel) => (sel === 'style' ? [{ textContent: style }] : []);
  const mark = mk({ 'data-tip': 'Arica\nA: 1', 'data-vtip-b': 'Arica\nB: 2', 'data-vtip-c': '' }, svg);
  mark.matches = () => false;
  const child = mk({}, mark);
  child.matches = () => false;
  return { svg, mark, child };
}
const selCss = '.pa-m{}.pa-vx .pv1,.pa-vx .pv2{display:none}#blk:has(input[value=b]:checked) .pa-vx .pv0{display:none}#blk:has(input[value=b]:checked) .pa-vx .pv1{display:inline}#blk:has(input[value=c]:checked) .pa-vx .pv0{display:none}';

test('plotagents/views activeTip: the tooltip of the view shown, with viewSelector or data-view', () => {
  // CSS-only switching: the checked radio decides, data-view stays at the first view.
  assert.equal(activeTip(dom({ style: selCss, active: 'b' }).child), 'Arica\nB: 2');
  assert.equal(currentView(dom({ style: selCss, active: 'b' }).svg), 'b');
  assert.equal(activeTip(dom({ style: selCss, active: null }).mark), 'Arica\nA: 1');
  assert.equal(activeTip(dom({ style: selCss, active: 'c' }).mark), null); // no tip in that view
  // data-view switching (setView / bindViews).
  const dv = '.pa-vx:not([data-view="a"]) .pv0{display:none}';
  assert.equal(activeTip(dom({ style: dv, view: 'b' }).mark), 'Arica\nB: 2');
  assert.equal(activeTip(dom({ style: dv, view: 'a' }).mark), 'Arica\nA: 1');
  assert.equal(activeTip(null), null);
});

test('plotagents/views activeTip on a real map with viewSelector: the selectors come from its <style>', () => {
  const geo = { paths: { a: 'M0,0L9,0L9,9Z', b: 'M10,0L19,0L19,9Z' } };
  const svg = plot({ type: 'choropleth', geo, data: [{ id: 'a', p: 1, q: 5 }, { id: 'b', p: 2, q: 6 }], key: 'id', value: 'p', views: [{ id: 'p' }, { id: 'q', value: 'q' }], viewSelector: '#m:has(input[value={id}]:checked)', labels: false, locale: 'en' });
  const style = /<style>(.*?)<\/style>/s.exec(svg)[1];
  const sels = [...style.matchAll(/(?:^|\})([^{}]+?) \.pv0\{display:none\}/g)].map((m) => m[1]);
  assert.equal(sels.length, 1);
  assert.match(sels[0], /input\[value=q\]:checked/);
});

// ── 6. spark ────────────────────────────────────────────────────────────────
test('spark tooltip: false writes no hover strips; bare stays minimal', () => {
  const d = Array.from({ length: 12 }, (_, i) => ({ x: 2010 + i, y: (i * i) % 7 }));
  const s = { type: 'spark', data: d, x: 'x', y: 'y', width: 108, height: 26 };
  assert.equal(count(plot(s), /fill="transparent"/g), 12);
  assert.equal(count(plot({ ...s, tooltip: false }), /fill="transparent"/g), 0);
  const bare = plot({ ...s, tooltip: false, bare: true });
  assert.doesNotMatch(bare, /<g\b|transparent|data-tip/);
  assert.ok(bare.length < 450, String(bare.length));
});

// ── 7 & 8. sankey ───────────────────────────────────────────────────────────
test('sankey: the widest end label is not cut by rounding; labelWidth sets each side', () => {
  for (const w of [640, 720, 902, 1100]) {
    const svg = plot({ type: 'sankey', width: w, data: [{ from: 'Censo', to: 'Población y territorio', value: 3 }, { from: 'Casen', to: 'Población y territorio', value: 2 }, { from: 'Casen', to: 'X', value: 1 }] });
    assert.match(svg, />Población y territorio</, String(w));
  }
  const data = [{ from: 'Encuesta de caracterización socioeconómica', to: 'Empleo e ingresos del hogar', value: 3 }, { from: 'B', to: 'C', value: 1 }];
  const cut = plot({ type: 'sankey', width: 640, data });
  assert.doesNotMatch(cut, />Empleo e ingresos del hogar</);
  const wide = plot({ type: 'sankey', width: 640, data, labelWidth: { right: 0.35 } });
  assert.match(wide, />Empleo e ingresos del hogar</);
  assert.equal(plot({ type: 'sankey', width: 640, data, labelWidth: [0.22, 0.35] }), wide);
  const px = plot({ type: 'sankey', width: 640, data, labelWidth: 300 });
  assert.match(px, />Encuesta de caracterización socioeconómica</);
  assert.ok(lint({ type: 'sankey', data, labelWidth: [0.3] }).errors.some((e) => e.code === 'sankey-label-width'));
});

test('truncate keeps a text whose width equals the room up to rounding', async () => {
  const { truncate } = await import('../src/text.js');
  const t = 'Población y territorio';
  const w = measure(t, 12.5, 500);
  assert.equal(truncate(t, w - 1e-12, 12.5, 500), t);
  assert.notEqual(truncate(t, w - 1, 12.5, 500), t);
});

// ── 9. colorScale rgb() ─────────────────────────────────────────────────────
test('colorScale reads rgb() / rgba() colors instead of dropping them', () => {
  const d = [{ x: 'a', y: 'p', v: 1 }, { x: 'b', y: 'p', v: 5 }, { x: 'c', y: 'p', v: 3 }];
  const s = { type: 'heatmap', data: d, x: 'x', y: 'y', value: 'v' };
  assert.equal(plot({ ...s, colorScale: ['rgb(255, 255, 255)', 'rgba(0,0,255,0.5)'] }), plot({ ...s, colorScale: ['#ffffff', '#0000ff'] }));
  assert.equal(plot({ ...s, colorScale: { colors: ['rgb(255,255,255)', 'rgb(0,0,255)'] } }), plot({ ...s, colorScale: { colors: ['#ffffff', '#0000ff'] } }));
  const r = lint({ ...s, title: 't', source: 's', colorScale: ['#fff', 'rgb(0,0,255)', 'nocolor'] });
  assert.ok(r.warnings.some((w) => w.code === 'colorscale-color' && /nocolor/.test(w.message)));
});

// ── 10. stackGap ────────────────────────────────────────────────────────────
test('stackGap: px between stacked segments; 0 joins them; default 2', () => {
  const data = ['a', 'b', 'c'].flatMap((s, i) => [{ k: 'x', s, v: 10 + i }, { k: 'y', s, v: 5 + i }]);
  const base = { type: 'bar', data, x: 'k', y: 'v', series: 's', stack: true, horizontal: true };
  assert.equal(plot({ ...base, stackGap: 2 }), plot(base));
  const segs = (s) => [...s.matchAll(/<path d="M([\d.]+),[\d.]+H([\d.]+)/g)].map((m) => [+m[1], +m[2]]);
  const z = segs(plot({ ...base, stackGap: 0 }));
  assert.ok(z.some(([a], i) => z.some(([, b], j) => j !== i && Math.abs(a - b) < 0.02)));
  const vert = { ...base, horizontal: false };
  assert.notEqual(plot({ ...vert, stackGap: 0 }), plot(vert));
  assert.ok(lint({ ...base, stackGap: -1 }).errors.some((e) => e.code === 'enum-stackGap'));
});

test('schema and lint know the new options', () => {
  for (const k of ['leanDots', 'subWidth', 'groupLabels', 'rowLabelWidth', 'stackGap', 'labelWidth', 'xLabelPosition', 'yLabelPosition']) assert.ok(schema.properties[k], k);
  const spec = { ...sw, title: 't', source: 's', leanDots: true, xLabelPosition: 'top' };
  assert.ok(!lint(spec).warnings.some((w) => w.code === 'unknown-option'));
  assert.ok(lint({ type: 'bar', data: [{ a: 'x', v: 1 }], x: 'a', y: 'v', leanDots: true }).suggestions.some((s) => s.code === 'lean-dots-type'));
});
