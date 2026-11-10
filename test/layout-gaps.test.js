// Layout gaps found migrating a real site: facets, thinned category labels,
// axis-only formats, narrow time axes, treemap labels and per-series strokes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plot, lint } from '../src/index.js';
import { measure } from '../src/text.js';
import { contrast } from '../src/theme.js';

const panelsOf = (svg) => svg.split('<svg x=').slice(1).map((p) => '<svg x=' + p);
const attr = (tag, name) => +(new RegExp(`\\s${name}="([\\d.-]+)"`).exec(tag) || [])[1];
const rootTag = (svg) => svg.slice(0, svg.indexOf('>'));

/** Overlapping text on one baseline, with real anchors and measured widths. */
function collisions(svg, gap = 2) {
  const out = [];
  const parts = svg.includes('<svg x=') ? panelsOf(svg) : [svg];
  for (const part of parts) {
    const rows = new Map();
    for (const m of part.matchAll(/<text x="([\d.-]+)" y="([\d.-]+)"([^>]*)>([^<]*)<\/text>/g)) {
      const size = +(m[3].match(/font-size="([\d.]+)"/) || [0, 12])[1];
      const anchor = (m[3].match(/text-anchor="(\w+)"/) || [0, 'start'])[1];
      const w = measure(m[4], size);
      const x0 = anchor === 'middle' ? +m[1] - w / 2 : anchor === 'end' ? +m[1] - w : +m[1];
      if (!rows.has(m[2])) rows.set(m[2], []);
      rows.get(m[2]).push({ x0, x1: x0 + w, t: m[4] });
    }
    for (const row of rows.values()) {
      row.sort((a, b) => a.x0 - b.x0);
      for (let i = 1; i < row.length; i++) if (row[i].x0 < row[i - 1].x1 + gap) out.push(`${row[i - 1].t} | ${row[i].t}`);
    }
  }
  return out;
}

const months = (from, to) => {
  const out = [];
  for (let t = from; t <= to; t++) out.push(`${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`);
  return out;
};

// Three labour-force rates over sixteen years: different levels, one shock.
function rates() {
  const rows = [];
  const base = { Participación: 59, Ocupación: 54, Desocupación: 8 };
  months(2010 * 12, 2026 * 12 + 1).forEach((d, i) => {
    for (const [s, b] of Object.entries(base)) {
      let v = b + Math.sin(i * 1.7 + b) * 0.6;
      if (d >= '2020-04' && d <= '2020-09') v += s === 'Desocupación' ? 5 : -10;
      rows.push({ d, s, v: +v.toFixed(1), note: s === 'Desocupación' ? '8,9 % · +0,2 pts' : '61,2 % · −0,4 pts en un año, la cifra más baja desde que hay registro' });
    }
  });
  return rows;
}

// Trade balance by region: different magnitudes, one negative, one missing year.
function balances() {
  const rows = [];
  const mag = { Antofagasta: 4000, Biobío: 300, Metropolitana: -2500 };
  for (const [region, b] of Object.entries(mag)) for (let year = 2015; year <= 2024; year++) {
    rows.push({ region, year, v: region === 'Biobío' && year === 2019 ? null : Math.round(b * (1 + Math.sin(year) * 0.3)) });
  }
  return rows;
}

// ── 1. facet + legend: false ─────────────────────────────────────────────────
test('facet: legend false hides the shared legend, labels stay as before', () => {
  const data = rates().map((r) => ({ ...r, g: r.d < '2018' ? 'Antes' : 'Después' }));
  const spec = { type: 'line', data, x: 'd', y: 'v', series: 's', facet: 'g', width: 720 };
  assert.match(plot(spec), /class="pa-legend"/);
  const off = plot({ ...spec, legend: false });
  assert.doesNotMatch(off, /class="pa-legend"/);
  // Multi-series panels still have no end labels (the page brings its own key).
  assert.doesNotMatch(off, />Participación</);
});

// ── 2. panelNote reserves its own room ───────────────────────────────────────
test('facet: panelNote never makes panels overlap and keeps plot heights equal', () => {
  const data = rates();
  for (const width of [900, 358]) for (const columns of [1, 3]) {
    const svg = plot({ type: 'line', data, x: 'd', y: 'v', facet: 's', columns, width, panelNote: 'note', panelHeight: 128 });
    const ps = panelsOf(svg).map((p) => ({ y: attr(rootTag(p), 'y'), h: attr(rootTag(p), 'height'), top: attr(rootTag(p), 'data-pa-top'), grid: [...p.matchAll(/<line x1="[\d.]+" x2="[\d.]+" y1="([\d.]+)" y2="\1"/g)].map((m) => +m[1]) }));
    const ys = [...new Set(ps.map((p) => p.y))].sort((a, b) => a - b);
    for (const p of ps) {
      const below = ys.find((y) => y > p.y);
      if (below !== undefined) assert.ok(p.y + p.h <= below, `panel at ${p.y} (${p.h} px) runs into the row at ${below} (width ${width})`);
    }
    // Same header in every panel (the longest note), so every plot starts at the same height.
    assert.equal(new Set(ps.map((p) => p.top)).size, 1);
    // And the total height covers the last row.
    const total = attr(rootTag(svg), 'height');
    assert.ok(Math.max(...ps.map((p) => p.y + p.h)) <= total);
  }
});

test('facet: a note on some panels only does not shrink their plots', () => {
  const data = balances().map((r) => ({ ...r, n: r.region === 'Biobío' ? 'Sin dato en 2019' : null }));
  const svg = plot({ type: 'line', data, x: 'year', y: 'v', facet: 'region', panelNote: 'n', width: 900 });
  const extent = panelsOf(svg).map((p) => { const g = [...p.matchAll(/<line x1="[\d.]+" x2="[\d.]+" y1="([\d.]+)" y2="\1"/g)].map((m) => +m[1]); return Math.max(...g) - Math.min(...g); });
  assert.equal(new Set(extent).size, 1);
  assert.match(svg, />Sin dato en 2019</);
});

test('facet: without notes or wrapped names the layout is unchanged', () => {
  const data = balances();
  const svg = plot({ type: 'line', data, x: 'year', y: 'v', facet: 'region', width: 900 });
  assert.doesNotMatch(svg, /_headerMin/);
  const hs = panelsOf(svg).map((p) => attr(rootTag(p), 'height'));
  assert.ok(hs.every((h) => h === hs[0]));
});

// ── 3. sharey: "span" — equal spans in units *and* pixels ────────────────────
test('facet span (regression): bars with different magnitudes, a negative panel and a null keep one scale', () => {
  for (const width of [900, 358]) {
    const svg = plot({ type: 'column', data: balances(), x: 'year', y: 'v', facet: 'region', sharey: 'span', width, columns: width < 400 ? 1 : 3 });
    // The hit areas of the bars are the plot height: equal in every panel.
    const heights = panelsOf(svg).map((p) => [...p.matchAll(/<rect x="[\d.-]+" y="([\d.]+)" width="[\d.]+" height="([\d.]+)" fill="transparent"/g)].map((m) => +m[2])[0]);
    assert.equal(new Set(heights).size, 1, `plot heights differ at ${width}: ${heights}`);
    // A missing value is written, never drawn as a zero bar.
    assert.match(svg, />sin dato</);
  }
  // With the axis drawn, the labelled span is the same in every panel.
  const svg = plot({ type: 'column', data: balances(), x: 'year', y: 'v', facet: 'region', sharey: 'span', labels: false, width: 900 });
  const scale = panelsOf(svg).map((p) => {
    const lines = [...p.matchAll(/<line x1="[\d.]+" x2="[\d.]+" y1="([\d.]+)" y2="\1"/g)].map((m) => +m[1]);
    const labels = [...p.matchAll(/text-anchor="end">([^<]+)</g)].map((m) => +m[1].replace(/\./g, '').replace('−', '-'));
    const ticks = [...new Set(lines)].sort((a, b) => a - b);
    return Math.round(((ticks[ticks.length - 1] - ticks[0]) / (Math.max(...labels) - Math.min(...labels))) * 1e4);
  });
  assert.equal(new Set(scale).size, 1, `px per unit differ: ${scale}`);
});

test('facet span (regression): lines keep one x scale too, and an all-null panel does not turn span off', () => {
  const data = rates();
  const svg = plot({ type: 'line', data, x: 'd', y: 'v', facet: 's', columns: 1, sharey: 'span', width: 900, panelNote: 'note' });
  const widths = panelsOf(svg).map((p) => { const m = /<line x1="([\d.]+)" x2="([\d.]+)" y1="([\d.]+)" y2="\3"/.exec(p); return +m[2] - +m[1]; });
  assert.equal(new Set(widths).size, 1, `plot widths differ: ${widths}`);
  const spans = panelsOf(svg).map((p) => { const t = [...p.matchAll(/paint-order="stroke" stroke-linejoin="round">(\d+)</g)].map((m) => +m[1]); return Math.max(...t) - Math.min(...t); });
  assert.equal(new Set(spans).size, 1);
  const withEmpty = [...balances(), ...[2015, 2016].map((year) => ({ region: 'Ñuble', year, v: null }))];
  const svg2 = plot({ type: 'line', data: withEmpty, x: 'year', y: 'v', facet: 'region', sharey: 'span', width: 900, columns: 4 });
  const lows = panelsOf(svg2).slice(0, 3).map((p) => [...p.matchAll(/paint-order="stroke" stroke-linejoin="round">([^<]+)</g)].map((m) => m[1])[0]);
  assert.notEqual(lows[0], lows[2], 'each panel keeps its own floor');
});

// ── 4. thinned category labels are not cut to one category's width ───────────
test('bar: with xTicks every N the labels shown use the room of N categories', () => {
  const M = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const data = [24, 25].flatMap((yy) => M.map((m, i) => ({ m: `${m}. ${yy}`, v: 100 + i })));
  const svg = plot({ type: 'column', data, x: 'm', y: 'v', sort: 'none', width: 358, labels: false, xTicks: { every: 4 } });
  const shown = [...svg.matchAll(/fill="#4A5070" font-size="12"[^>]*>([^<]+)</g)].map((m) => m[1]);
  assert.deepEqual(shown, ['ene. 24', 'may. 24', 'sep. 24', 'ene. 25', 'may. 25', 'sep. 25']);
  assert.deepEqual(collisions(svg), []);
  // Wide enough for every label: nothing changes.
  const wide = plot({ type: 'column', data: data.slice(0, 6), x: 'm', y: 'v', sort: 'none', width: 720 });
  assert.match(wide, />ene\. 24</);
});

// ── 5. yFormat: the axis apart from labels and tooltips ──────────────────────
test('yFormat writes axis ticks only; format keeps labels and tooltips; default unchanged', () => {
  const data = [2019, 2020, 2021, 2022, 2023].map((t, i) => ({ t, v: 1.5e9 * (1 + i / 4) }));
  const spec = { type: 'line', data, x: 't', y: 'v', width: 500, format: (v) => `US$ ${Math.round(v / 1e6)} millones` };
  const svg = plot({ ...spec, yFormat: (v) => `${v / 1e9}`, crosshair: false });
  assert.match(svg, /stroke-linejoin="round">2<\/text>/); // tick
  assert.match(svg, />US\$ 3000 millones</); // end label
  assert.doesNotMatch(svg, /stroke-linejoin="round">US\$/);
  assert.equal(plot(spec), plot({ ...spec, yFormat: undefined }));
  const bars = { type: 'column', data, x: 't', y: 'v', labels: false, width: 500, format: (v) => `${v} u.` };
  const b = plot({ ...bars, yFormat: (v) => `${v / 1e9} mil M` });
  assert.match(b, />3 mil M</);
  assert.match(b, /data-tip="[^"]*3000000000 u\./);
  assert.equal(plot(bars), plot({ ...bars, yFormat: undefined }));
});

// ── 6. narrow time axes ─────────────────────────────────────────────────────
test('time axis at phone width: no colliding labels, thinned to calendar steps', () => {
  for (const width of [300, 358, 420]) for (const [a, b] of [[2010 * 12, 2026 * 12 + 1], [2023 * 12, 2025 * 12 + 5], [2024 * 12, 2025 * 12 + 11]]) {
    const data = months(a, b).map((d, i) => ({ d, v: 10 + (i % 5) }));
    for (const type of ['line', 'column']) {
      const svg = plot({ type, data, x: 'd', y: 'v', width, sort: 'none', labels: false });
      assert.deepEqual(collisions(svg), [], `${type} ${width}px ${data[0].d}…`);
    }
    const col = plot({ type: 'column', data, x: 'd', y: 'v', width, sort: 'none', labels: false });
    const shown = [...col.matchAll(/fill="#4A5070" font-size="12"[^>]*>([^<]+)</g)].map((m) => m[1].split(' ')[0]);
    // Months on the calendar: January and July, or January only — never Jan, Sep, May.
    const idx = shown.map((m) => ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'].indexOf(m));
    const gaps = new Set(idx.slice(1).map((v, i) => (v - idx[i] + 12) % 12));
    assert.ok(gaps.size <= 1 && [...gaps].every((g) => [0, 1, 2, 3, 4, 6].includes(g)), `${width}: ${shown}`);
  }
});

// ── 7. treemap labels ───────────────────────────────────────────────────────
const tree = [
  ['Minería', 'Cobre', 5000], ['Minería', 'Litio', 900], ['Minería', 'Hierro y otros minerales metálicos', 320], ['Minería', 'Oro', 3],
  ['Servicios', 'Comercio al por mayor y al por menor', 2600], ['Servicios', 'Transporte y almacenamiento', 800], ['Servicios', 'Actividades financieras y de seguros', 1500], ['Servicios', 'Administración pública', 5],
  ['Agro', 'Fruta', 1100],
].map(([fam, leaf, v]) => ({ fam, leaf, v }));

test('treemap: tileLabels "wrap" writes long names on several lines, then truncates', () => {
  const spec = { type: 'treemap', data: tree, path: ['fam', 'leaf'], value: 'v', width: 400, height: 420, legend: false };
  const auto = plot(spec);
  const wrap = plot({ ...spec, tileLabels: 'wrap' });
  assert.doesNotMatch(auto, />Hierro y</);
  assert.match(wrap, />Hierro y</);
  assert.match(wrap, />minerales…<|>minerales</);
  // Default unchanged.
  assert.equal(auto, plot({ ...spec, tileLabels: 'auto' }));
  assert.deepEqual(lint({ ...spec, tileLabels: 'wrapped' }).errors.map((e) => e.code ?? e.id ?? e.rule ?? e.message).length > 0, true);
});

test('treemap: a share that is not zero never prints as 0%', () => {
  // A group of 0,04 % of the whole: its legend key says so, in each locale.
  const data = [...tree, { fam: 'Pesca', leaf: 'Algas', v: 5 }];
  const svg = plot({ type: 'treemap', data, path: ['fam', 'leaf'], value: 'v', width: 720 });
  assert.match(svg, />Pesca &lt;0,1%</);
  assert.doesNotMatch(svg, />Pesca 0%</);
  const en = plot({ type: 'treemap', data, path: ['fam', 'leaf'], value: 'v', width: 720, locale: 'en' });
  assert.match(en, />Pesca &lt;0\.1%</);
  // Shares of 0,05 % and up keep their figure.
  assert.match(plot({ type: 'treemap', data: [...tree, { fam: 'Pesca', leaf: 'Algas', v: 12 }], path: ['fam', 'leaf'], value: 'v', width: 720 }), />Pesca 0,1%</);
});

test('treemap: label ink follows each skin — ink on light fills, white on dark ones', () => {
  const pale = { Cobre: '#e9c98f', Litio: '#ead2a6', Fruta: '#bfe3d5', Minería: '#e9c98f', Servicios: '#c9d3ea', Agro: '#bfe3d5' };
  const dark = { Cobre: '#5a3a0c', Litio: '#6b4a18', Fruta: '#0f4d48', Minería: '#5a3a0c', Servicios: '#0b3f8c', Agro: '#0f4d48' };
  const ink = ['#2f2a24', '#10202f'];
  const svg = plot({
    type: 'treemap', data: tree, path: ['fam', 'leaf'], value: 'v', width: 640, height: 340, legend: false,
    skins: [
      { colors: pale, theme: { ink: `var(--ink, ${ink[0]})` } },
      { when: 'html.classic', colors: dark, theme: { ink: `var(--ink, ${ink[1]})` } },
    ],
  });
  const css = /<style>([\s\S]*?)<\/style>/.exec(svg)[1];
  const block = (sel) => Object.fromEntries((new RegExp(sel + '\\{([^}]*)\\}').exec(css)[1]).split(';').map((d) => [d.slice(0, d.indexOf(':')), d.slice(d.indexOf(':') + 1)]));
  const skins = [block('\\.pa-skin-[a-z0-9]+'), block('html\\.classic \\.pa-skin-[a-z0-9]+')];
  const value = (attrV, style, k) => { const v = /fill:var\((--pa-s\d+)\)/.exec(style || ''); if (!v) return attrV; const c = skins[k][v[1]]; const m = /^var\(--[\w-]+,\s*(.+)\)$/.exec(c); return m ? m[1] : c; };
  let checked = 0;
  for (const m of svg.matchAll(/<g class="pa-m"[^>]*>(<rect [^>]*>)((?:<text [^>]*>[^<]*<\/text>)+)/g)) {
    const rf = /fill="([^"]+)"/.exec(m[1])[1], rs = (/style="([^"]*)"/.exec(m[1]) || [])[1];
    for (const t of m[2].matchAll(/<text ([^>]*)>/g)) {
      const tf = /fill="([^"]+)"/.exec(t[1])[1], ts = (/style="([^"]*)"/.exec(t[1]) || [])[1];
      for (const k of [0, 1]) {
        const fg = value(tf, ts, k), bg = value(rf, rs, k);
        assert.equal(fg.toLowerCase(), k === 0 ? ink[0] : '#ffffff', `skin ${k}: ${fg} on ${bg}`);
        assert.ok(contrast(fg, bg) >= 4.5, `skin ${k}: ${fg} on ${bg} is ${contrast(fg, bg).toFixed(2)}`);
        checked++;
      }
    }
  }
  assert.ok(checked >= 8);
});

test('treemap: shareOf prints the share of the group, of the whole, or both when focused', () => {
  const spec = { type: 'treemap', data: tree, path: ['fam', 'leaf'], value: 'v', width: 720, focus: ['Minería'] };
  assert.match(plot(spec), />80%</);
  assert.equal(plot(spec), plot({ ...spec, shareOf: 'group' }));
  assert.match(plot({ ...spec, shareOf: 'total' }), />41% del total</);
  assert.match(plot({ ...spec, shareOf: 'both' }), />80% · 41% del total</);
  assert.match(plot({ ...spec, shareOf: 'both', locale: 'en' }), />80% · 41% of total</);
  // Not focused: one share, whatever shareOf says.
  const top = { ...spec, focus: undefined };
  assert.equal(plot(top), plot({ ...top, shareOf: 'both' }));
});

// ── per-series strokes and markers ──────────────────────────────────────────
test('line: lineWidths and points per series', () => {
  const data = [];
  for (let y = 1991; y <= 2024; y++) data.push({ y, s: 'Anual', v: 14 + Math.sin(y) });
  for (const [s, a, b, v] of [['1991–2020', 1991, 2020, 14.1], ['2015–2024', 2015, 2024, 14.6]]) for (const y of [a, b]) data.push({ y, s, v });
  const spec = { type: 'line', data, x: 'y', y: 'v', series: 's', width: 640, crosshair: false };
  const base = plot(spec);
  const wide = plot({ ...spec, lineWidths: { '1991–2020': 4, '2015–2024': 6 } });
  const group = (svg, s) => new RegExp(`<g class="pa-m" data-series="${s}"[^>]*>([\\s\\S]*?)</g>`).exec(svg)[1];
  assert.match(group(wide, '1991–2020'), /stroke-width="4"/);
  assert.match(group(wide, '2015–2024'), /stroke-width="6"/);
  assert.equal(group(wide, 'Anual'), group(base, 'Anual'));
  assert.equal(plot({ ...spec, lineWidths: {} }), base);
  // Dots only on the series named (a list or an object).
  const dots = (svg, s) => (group(svg, s).match(/<circle/g) || []).length;
  const listed = plot({ ...spec, points: ['Anual'] });
  assert.ok(dots(listed, 'Anual') > 30);
  assert.equal(dots(listed, '1991–2020'), 1); // only the end marker
  const obj = plot({ ...spec, points: { '1991–2020': true } });
  assert.equal(dots(obj, 'Anual'), 1);
  assert.equal(dots(obj, '1991–2020'), 3); // two points and the end marker
  assert.equal(plot({ ...spec, points: true }), plot({ ...spec, points: ['Anual', '1991–2020', '2015–2024'] }));
  assert.ok(lint({ ...spec, lineWidths: { Anual: -1 } }).errors.length > 0);
});
