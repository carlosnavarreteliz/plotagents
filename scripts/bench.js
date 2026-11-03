// Benchmark: SVG (un nodo por punto) vs Canvas vs SVG en un solo <path> vs plotagents.
//   node scripts/bench.js        (necesita Playwright con Chromium)
import { plot } from '../src/index.js';

let pw;
try { pw = await import('playwright'); } catch { console.error('Instala Playwright: npm i -D playwright && npx playwright install chromium'); process.exit(1); }
const { chromium } = pw.default || pw;
let seed = 1;
const u = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 700 } });
await p.setContent('<div id=h style="width:720px"></div><canvas id=c width=1440 height=900 style="width:720px"></canvas>');
const paint = (svg) => p.evaluate((svg) => new Promise((res) => { const h = document.getElementById('h'); h.innerHTML = ''; const t = performance.now(); h.innerHTML = svg; h.getBoundingClientRect(); requestAnimationFrame(() => requestAnimationFrame(() => res(performance.now() - t))); }), svg);
const rows = [];
for (const n of [1000, 5000, 20000, 50000]) {
  const data = Array.from({ length: n }, () => ({ x: u() * 100, y: u() * 100 + u() * 20, g: u() < 0.5 ? 'A' : 'B' }));
  const naive = `<svg width="720" height="420">${data.map((d, i) => `<circle cx="${(d.x * 7).toFixed(1)}" cy="${(d.y * 3.5).toFixed(1)}" r="3" fill="${i % 2 ? '#3A47B8' : '#D42A5E'}"/>`).join('')}</svg>`;
  const ours = plot({ type: 'scatter', data, x: 'x', y: 'y', series: 'g', title: 'bench' });
  const canvas = await p.evaluate((n) => new Promise((res) => { const c = document.getElementById('c').getContext('2d'); let s = 1; const r = () => (s = (s * 16807) % 2147483647) / 2147483647; const t = performance.now(); c.clearRect(0, 0, 1440, 900); for (let i = 0; i < n; i++) { c.fillStyle = i % 2 ? '#3A47B8' : '#D42A5E'; c.beginPath(); c.arc(r() * 1400, r() * 800, 6, 0, 6.283); c.fill(); } requestAnimationFrame(() => requestAnimationFrame(() => res(performance.now() - t))); }), n);
  rows.push({ points: n, svgPerNode_ms: Math.round(await paint(naive)), canvas_ms: Math.round(canvas), plotagents_ms: Math.round(await paint(ours)), plotagents_kB: Math.round(ours.length / 1024) });
}
console.table(rows);
await b.close();
