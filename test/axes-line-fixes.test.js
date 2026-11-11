// Ejes, formato, líneas y dispersión: regresiones de la auditoría.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plot } from '../src/index.js';
import { niceDomain, linear, log, logDomain, timeTicks, dateUnit } from '../src/scale.js';
import { makeFormat, smartDecimals, parseDate, formatDate } from '../src/format.js';
import { extent, lowess, kde } from '../src/stats.js';
import { lttb } from '../src/charts/line.js';

const H = 36e5, D = 864e5;
const cross = (svg) => JSON.parse(svg.match(/data-cross="([^"]*)"/)[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
const yRange = (svg) => [+svg.match(/class="pa-cross"[^>]*data-y0="([\d.]+)"/)[1], +svg.match(/class="pa-cross"[^>]*data-y1="([\d.]+)"/)[1]];
const svgH = (svg) => +svg.match(/viewBox="0 0 [\d.]+ ([\d.]+)"/)[1];

// ── 1. Ejes de tiempo ──────────────────────────────────────────────────────

test('eje de tiempo por hora: "HH:mm" y la fecha cuando cambia el día', () => {
  const t0 = Date.UTC(2024, 2, 3, 6), t1 = Date.UTC(2024, 2, 4, 18);
  const { ticks, unit } = timeTicks(t0, t1, 6, 'es');
  assert.equal(unit, 'hour');
  assert.ok(ticks.length >= 4 && ticks.length <= 7, String(ticks.length));
  assert.ok(ticks.some((t) => /^\d{2}:\d{2}$/.test(t.label)));
  assert.ok(ticks.some((t) => t.label === '4 mar'), ticks.map((t) => t.label).join(' | '));
  assert.match(ticks[0].label, /^3 mar \d{2}:\d{2}$/);
});

test('eje de tiempo por minuto y tooltips con hora', () => {
  const { ticks, unit } = timeTicks(Date.UTC(2024, 0, 1, 9), Date.UTC(2024, 0, 1, 11), 6, 'en');
  assert.equal(unit, 'minute');
  assert.ok(ticks.length >= 3);
  assert.equal(dateUnit([Date.UTC(2024, 0, 1, 9), Date.UTC(2024, 0, 1, 10)]), 'hour');
  assert.equal(dateUnit([Date.UTC(2024, 0, 1, 9, 15)]), 'minute');
  assert.equal(formatDate(Date.UTC(2024, 0, 1, 9, 5), 'minute', 'es'), '1 ene 2024 09:05');
  const data = Array.from({ length: 24 }, (_, i) => ({ t: `2024-03-03T${String(i).padStart(2, '0')}:00`, v: i }));
  const svg = plot({ type: 'line', data, x: 't', y: 'v' });
  const c = cross(svg);
  assert.equal(new Set(c.map((e) => e.t)).size, 24, 'cada hora con su propia etiqueta');
  assert.match(c[5].t, /05:00$/);
  assert.ok((svg.match(/>\d{2}:\d{2}</g) || []).length >= 2, 'etiquetas de hora en el eje x');
});

test('pasos de 2 días y de siglos', () => {
  const days = timeTicks(Date.UTC(2024, 0, 1), Date.UTC(2024, 0, 11), 6).ticks;
  assert.ok(days.length >= 4, `10 días → ${days.length} marcas`);
  const cent = timeTicks(Date.UTC(1500, 0, 1), Date.UTC(2080, 0, 1), 6).ticks;
  assert.ok(cent.length <= 7, `1500–2080 → ${cent.length} marcas`);
  assert.deepEqual(cent.map((t) => t.label).slice(0, 2), ['1500', '1600']);
});

// ── 2. Una sola unidad compacta por eje ────────────────────────────────────

test('miles de millones en español: una sola unidad, sin "1.000,00 M"', () => {
  const f = makeFormat(undefined, 'es', [2e8, 1.1e9]);
  const ticks = [0, 2.5e8, 5e8, 7.5e8, 1e9, 1.25e9];
  const labels = ticks.map(f.tick(2.5e8, ticks));
  assert.deepEqual(labels, ['0', '250 M', '500 M', '750 M', '1.000 M', '1.250 M']);
  // Sin las marcas, la unidad sale de la mayor marca estimada.
  assert.ok([0, 5e8, 1e9].map(f.tick(5e8)).every((l) => !/,00/.test(l)));
  // Inglés: la unidad de la mayor marca (B) y sin ceros finales.
  assert.deepEqual([0, 5e8, 1e9].map(makeFormat(undefined, 'en', [2e8, 1.1e9]).tick(5e8, [0, 5e8, 1e9])), ['0', '0.5B', '1B']);
  // Área apilada: el eje no mezcla "500 M" con "1.000,0 M".
  const data = [];
  for (const s of ['A', 'B', 'C']) for (let y = 2018; y <= 2025; y++) data.push({ y, s, v: 3e8 + (y - 2018) * 1e7 });
  const svg = plot({ type: 'area', data, x: 'y', y: 'v', series: 's' });
  const yl = [...svg.matchAll(/<text[^>]*stroke-linejoin="round">([^<]*)<\/text>/g)].map((m) => m[1]).filter((t) => / M$|^0$/.test(t));
  assert.ok(!yl.some((t) => /,0 M/.test(t)), yl.join(' | '));
});

// ── 3. Dominio con paso entero ─────────────────────────────────────────────

test('niceDomain({ integer }) nunca da pasos < 1 ni 2,5', () => {
  assert.equal(niceDomain(0, 3, 6).step, 0.5);
  assert.deepEqual(niceDomain(0, 3, 6, { integer: true }), { min: 0, max: 3, step: 1 });
  assert.equal(niceDomain(0, 12, 5, { integer: true }).step, 2);
  assert.deepEqual(niceDomain(0, 0, 5, { integer: true }), { min: 0, max: 1, step: 1 });
  const svg = plot({ type: 'line', data: [{ m: '2024-01', n: 0 }, { m: '2024-02', n: 2 }, { m: '2024-03', n: 1 }, { m: '2024-04', n: 3 }], x: 'm', y: 'n', height: 420 });
  assert.ok(!/>[0-9],5</.test(svg), 'conteos sin marcas en 0,5');
  const hist = plot({ type: 'hist', data: [1, 2, 2, 3, 7].map((v) => ({ v })), x: 'v', height: 500 });
  assert.ok(!/class="pa-axis pa-axis-y">.*>\d,5</.test(hist), 'histograma de conteo sin marcas en 0,5');
});

// ── 4. Log estrecho ────────────────────────────────────────────────────────

test('escala log en rango estrecho: al menos 3 marcas dentro del dominio', () => {
  const t = log(100, 200, 0, 1).ticks();
  assert.ok(t.length >= 3, t.join(','));
  assert.ok(t.every((v) => v >= 100 && v <= 200));
  // Rangos amplios: sin cambios (1-3 o potencias de 10).
  assert.deepEqual(log(1, 1000, 0, 1).ticks(), [1, 3, 10, 30, 100, 300, 1000]);
});

// ── 5. Detalles de formato ─────────────────────────────────────────────────

test('valores diminutos, cero en eje decimal y zonas horarias', () => {
  assert.equal(makeFormat(undefined, 'es', [0.00001, 0.00002])(0.000012), '0,000012');
  assert.ok(smartDecimals(1e-7) >= 8);
  assert.equal(makeFormat(undefined, 'es', [0.5, 2]).tick(0.5)(0), '0');
  assert.equal(makeFormat(undefined, 'es', [0.5, 2]).tick(0.5)(1.5), '1,5');
  assert.equal(parseDate('2024-03-01T10:00-03:00'), Date.UTC(2024, 2, 1, 13));
  assert.equal(parseDate('2024-03-01T10:00:00Z'), Date.UTC(2024, 2, 1, 10));
  assert.equal(parseDate('2024-03-01T10:00:00.250+05:30'), Date.UTC(2024, 2, 1, 4, 30, 0, 250));
  assert.equal(parseDate('2024-03-01T10:00'), Date.UTC(2024, 2, 1, 10)); // sin zona: igual que antes
});

// ── 6. Dispersión log con ceros ────────────────────────────────────────────

test('dispersión log con ceros: dominio positivo, sin NaN', () => {
  const spec = { type: 'scatter', data: [{ a: 0, b: 1 }, { a: 10, b: 20 }, { a: 100, b: 300 }], x: 'a', y: 'b', xScale: 'log', _domains: {} };
  const svg = plot(spec);
  assert.ok(!/NaN|Infinity/.test(svg));
  assert.ok(spec._domains.x[0] >= 1, String(spec._domains.x));
  assert.equal((svg.match(/class="pa-m"/g) || []).length, 2, 'el punto con x = 0 no tiene posición en log');
});

// ── 7. x numérico grande se compacta ───────────────────────────────────────

test('x numérico entero ≥ 10.000 usa formato compacto', () => {
  const data = Array.from({ length: 6 }, (_, i) => ({ x: i * 50000, v: i }));
  const svg = plot({ type: 'line', data, x: 'x', y: 'v' });
  assert.ok(/>\d+ mil</.test(svg) || / M</.test(svg), 'marcas compactas');
  assert.ok(!/>100\.000</.test(svg));
  const small = plot({ type: 'line', data: Array.from({ length: 6 }, (_, i) => ({ x: i * 1000, v: i })), x: 'x', y: 'v' });
  assert.ok(/>2\.000</.test(small), 'bajo 10.000, enteros con separador');
});

// ── 8. Área apilada con negativos ──────────────────────────────────────────

test('área apilada con negativos: positivos y negativos se apilan por separado', () => {
  const data = [];
  for (const s of ['A', 'B', 'C']) for (let y = 2018; y <= 2021; y++) data.push({ y, s, v: s === 'C' ? -20 : 30 });
  const spec = { type: 'area', data, x: 'y', y: 'v', series: 's', _domains: {} };
  const svg = plot(spec);
  assert.ok(spec._domains.y[0] <= -20, `mín ${spec._domains.y[0]}`);
  assert.ok(spec._domains.y[1] >= 60, `máx ${spec._domains.y[1]}`);
  assert.ok(/−20</.test(svg), 'la etiqueta muestra el valor negativo');
  const pct = { ...spec, stack: 'percent', _domains: {} };
  assert.ok(!/NaN/.test(plot(pct)));
});

// ── 9. Serie toda nula ─────────────────────────────────────────────────────

test('una serie sin datos no rompe el gráfico; todo nulo da un error útil', () => {
  const data = [{ t: 2020, s: 'A', v: 1 }, { t: 2021, s: 'A', v: 2 }, { t: 2020, s: 'B', v: null }, { t: 2021, s: 'B', v: null }];
  const svg = plot({ type: 'line', data, x: 't', y: 'v', series: 's' });
  assert.equal((svg.match(/class="pa-endlabel"/g) || []).length, 1);
  assert.throws(() => plot({ type: 'line', data: [{ t: '2024-01', v: null }], x: 't', y: 'v' }), (e) => e.name === 'PlotError' && /`v`/.test(e.message) && !!e.hint);
});

// ── 10 y P1. Sin puntos válidos ─────────────────────────────────────────────

test('dispersión sin puntos válidos: PlotError con pista (sin bucle infinito)', () => {
  const t0 = Date.now();
  assert.throws(() => plot({ type: 'scatter', data: [{ a: 'x', v: 'y' }], x: 'a', y: 'v' }), (e) => e.name === 'PlotError' && !!e.hint);
  assert.throws(() => plot({ type: 'hist', data: [{ v: null }, { v: 'n/a' }], x: 'v' }), (e) => e.name === 'PlotError');
  assert.throws(() => plot({ type: 'ecdf', data: [{ v: null }], x: 'v' }), (e) => e.name === 'PlotError');
  assert.ok(Date.now() - t0 < 1000);
});

test('escalas seguras con dominios no finitos', () => {
  assert.deepEqual(linear(NaN, NaN, 0, 1).ticks(), []);
  assert.deepEqual(linear(0, Infinity, 0, 1).ticks(1), []);
  assert.ok(linear(0, 10, 0, 1).ticks(1e-12).length <= 1001);
  assert.ok(linear(0, 10, 0, 1).ticks(0).length > 0);
  assert.deepEqual(niceDomain(NaN, NaN), { min: 0, max: 1, step: 0.2 });
  assert.deepEqual(niceDomain(Infinity, -Infinity), { min: 0, max: 1, step: 0.2 });
  assert.deepEqual(log(NaN, NaN, 0, 1).ticks(), []);
  const ld = logDomain(0, 0);
  assert.ok(Number.isFinite(ld.min) && ld.max > ld.min);
  assert.deepEqual(timeTicks(NaN, NaN).ticks, []);
});

// ── 11. id del recorte de tendencia ────────────────────────────────────────

test('la línea de tendencia usa un clipPath con id único', () => {
  const d = [{ x: 1, y: 2 }, { x: 2, y: 3 }, { x: 3, y: 5 }];
  const a = plot({ type: 'scatter', data: d, x: 'x', y: 'y', trend: true, title: 'A' });
  const b = plot({ type: 'scatter', data: d, x: 'x', y: 'y', trend: true, title: 'B' });
  const id = (s) => s.match(/<clipPath id="(pa-clip-trend[^"]*)"/)[1];
  assert.notEqual(id(a), 'pa-clip-trend');
  assert.notEqual(id(a), id(b));
  assert.ok(a.includes(`url(#${id(a)})`));
});

// ── 12. Puntos aislados ────────────────────────────────────────────────────

test('un punto aislado entre vacíos se dibuja aunque haya > 12 puntos', () => {
  const data = Array.from({ length: 20 }, (_, i) => ({ x: 2000 + i, v: i === 9 || i === 11 ? null : 10 + i }));
  data[10].v = 50; // 2010 queda solo entre dos nulos
  const svg = plot({ type: 'line', data, x: 'x', y: 'v' });
  const circles = svg.match(/<circle[^>]*>/g) || [];
  assert.equal(circles.length, 2, 'el punto aislado + el punto final');
});

// ── 13. Años sin marcas impares ────────────────────────────────────────────

test('marcas de años en pasos 1/2/5/10 (nunca 2001, 2004…)', () => {
  const data = Array.from({ length: 12 }, (_, i) => ({ y: 2000 + i, v: i }));
  for (const width of [360, 420, 520]) {
    const svg = plot({ type: 'line', data, x: 'y', y: 'v', width });
    const years = [...svg.matchAll(/text-anchor="(?:middle|start|end)">(20\d\d)</g)].map((m) => +m[1]);
    assert.ok(years.length >= 2);
    const steps = new Set(years.slice(1).map((y, i) => y - years[i]));
    assert.equal(steps.size, 1);
    assert.ok([1, 2, 5, 10].includes([...steps][0]), `${width}: ${years}`);
  }
});

// ── 14. Primer punto vs etiquetas interiores del eje y ─────────────────────

test('el primer punto no queda bajo una etiqueta interior del eje y', () => {
  const data = [];
  for (const s of ['A', 'B']) for (let y = 2018; y <= 2025; y++) data.push({ y, s, v: 100 + (y - 2018) * (s === 'A' ? 10 : 3) });
  const svg = plot({ type: 'line', data, x: 'y', y: 'v', series: 's', index: true });
  const rx = +svg.match(/class="pa-cross" x="(-?[\d.]+)"/)[1];
  assert.ok(cross(svg)[0].x > rx + 4 + 15, 'el trazado arranca pasada la etiqueta "100"');
  // Sin choque, el trazado sigue arrancando en el borde (aspecto por defecto intacto).
  const free = plot({ type: 'line', data: data.map((r) => ({ ...r, v: r.v + 7 })), x: 'y', y: 'v', series: 's' });
  const rx2 = +free.match(/class="pa-cross" x="(-?[\d.]+)"/)[1];
  assert.ok(Math.abs(cross(free)[0].x - (rx2 + 4)) < 0.2);
});

// ── 15. Serie que termina antes ────────────────────────────────────────────

test('serie que termina antes: su etiqueta lleva línea guía', () => {
  const data = [];
  for (const s of ['Full', 'Early']) for (let y = 2010; y <= 2024; y++) if (s === 'Full' || y <= 2016) data.push({ y, s, v: (s === 'Full' ? 50 : 20) + y - 2010 });
  const svg = plot({ type: 'line', data, x: 'y', y: 'v', series: 's' });
  const groups = svg.match(/<g class="pa-endlabel">.*?<\/g>/g);
  const early = groups.find((gr) => gr.includes('>Early<'));
  assert.ok(early.includes('<path'), 'guía desde el último punto hasta la etiqueta');
});

// ── 16. Anotaciones sin superposición ──────────────────────────────────────

test('rótulos de anotaciones cercanas bajan de fila en vez de superponerse', () => {
  const data = Array.from({ length: 20 }, (_, i) => ({ y: 2000 + i, v: 100 + i }));
  const svg = plot({ type: 'line', data, x: 'y', y: 'v', annotations: [{ x: 2007, label: 'Crisis' }, { x: 2008, label: 'Stimulus' }, { x: 2009, label: 'Recovery' }] });
  const pos = ['Crisis', 'Stimulus', 'Recovery'].map((l) => +svg.match(new RegExp(`y="([\\d.]+)"[^>]*>${l}<`))[1]);
  assert.notEqual(pos[0], pos[1]);
  assert.notEqual(pos[1], pos[2]);
});

// ── 17. Muchas series en poco alto ─────────────────────────────────────────

test('12 series largas a 260 px: el trazado no colapsa y las etiquetas no se salen', () => {
  const data = [];
  for (let k = 0; k < 12; k++) for (let y = 2015; y <= 2024; y++) data.push({ y, s: `A rather long series name number ${k + 1}`, v: k * 3 + y - 2015 });
  const svg = plot({ type: 'line', data, x: 'y', y: 'v', series: 's', height: 260 });
  const [y0, y1] = yRange(svg);
  assert.ok(y1 - y0 >= 89, `alto del trazado ${y1 - y0}`);
  const ys = [...svg.matchAll(/<g class="pa-endlabel">.*?<text x="[\d.]+" y="([\d.]+)"/g)].map((m) => +m[1]);
  assert.ok(ys.length > 0);
  assert.ok(ys.every((y) => y <= y1 + 12 && y <= svgH(svg)), `etiquetas dentro: ${ys} (y1 ${y1})`);
});

// ── 18. Un solo x ──────────────────────────────────────────────────────────

test('un solo valor de x queda centrado; el área de un x se ve', () => {
  const svg = plot({ type: 'line', data: [{ m: '2024-03', a: 5 }], x: 'm', y: 'a' });
  const rx = +svg.match(/class="pa-cross" x="(-?[\d.]+)" y="[\d.]+" width="([\d.]+)"/)[1];
  const rw = +svg.match(/class="pa-cross" x="-?[\d.]+" y="[\d.]+" width="([\d.]+)"/)[1];
  const cx = cross(svg)[0].x;
  assert.ok(Math.abs(cx - (rx + rw / 2)) < 2, `centro ${cx} vs ${rx + rw / 2}`);
  assert.ok(svg.includes('>mar 2024<'));
  const ar = plot({ type: 'area', data: [{ m: 2024, s: 'A', a: 5 }, { m: 2024, s: 'B', a: 3 }], x: 'm', y: 'a', series: 's' });
  const d = [...ar.matchAll(/<path d="(M[^"]*Z)"/g)].map((m) => m[1]);
  assert.ok(d.length >= 2);
  const xs = d[0].match(/[MLH]([\d.]+)/g).map((t) => +t.slice(1));
  assert.ok(Math.max(...xs) - Math.min(...xs) > 20, 'la columna tiene ancho');
});

// ── 19. Clave de tamaños en burbujas ───────────────────────────────────────

test('burbujas: clave de tamaños con 2–3 círculos de referencia', () => {
  const data = [10, 40, 90, 160, 330].map((p, i) => ({ x: i, y: i * i, p }));
  const svg = plot({ type: 'bubble', data, x: 'x', y: 'y', size: 'p' });
  const key = svg.match(/<g class="pa-sizekey">.*?<\/g>/);
  assert.ok(key, 'hay clave');
  const n = (key[0].match(/<circle/g) || []).length;
  assert.ok(n >= 2 && n <= 3, String(n));
  assert.ok(!plot({ type: 'bubble', data, x: 'x', y: 'y', size: 'p', sizeKey: false }).includes('pa-sizekey'));
  assert.ok(!plot({ type: 'scatter', data, x: 'x', y: 'y' }).includes('pa-sizekey'));
});

// ── 20. Grises de desborde debajo ──────────────────────────────────────────

test('las series grises de desborde (9.ª en adelante) se dibujan primero', () => {
  const data = [];
  for (let k = 1; k <= 11; k++) for (let y = 2015; y <= 2020; y++) data.push({ y, s: `S${k}`, v: k + y - 2015 });
  const svg = plot({ type: 'line', data, x: 'y', y: 'v', series: 's', height: 480 });
  const at = (k) => svg.indexOf(`data-series="${k}"`);
  assert.ok(at('S9') < at('S1') && at('S11') < at('S1'));
});

// ── Rendimiento ────────────────────────────────────────────────────────────

test('50 mil puntos en línea: rápido y SVG liviano (LTTB + crosshair por píxel)', () => {
  const data = Array.from({ length: 50000 }, (_, i) => ({ t: i, v: Math.sin(i / 500) * 100 + (i % 37) }));
  const t0 = Date.now();
  const svg = plot({ type: 'line', data, x: 't', y: 'v' });
  assert.ok(Date.now() - t0 < 3000, `${Date.now() - t0} ms`);
  assert.ok(svg.length < 500e3, `${svg.length} bytes`);
  assert.ok(cross(svg).length <= 760);
});

test('LTTB conserva extremos y largo pedido', () => {
  const pts = Array.from({ length: 1000 }, (_, i) => [i, i === 500 ? 999 : Math.sin(i / 10), null]);
  const r = lttb(pts, 100);
  assert.equal(r.length, 100);
  assert.equal(r[0], pts[0]);
  assert.equal(r[99], pts[999]);
  assert.ok(r.some((p) => p[1] === 999), 'el pico sobrevive');
});

test('150 mil filas: sin desborde de pila en dispersión, histograma, kde y ecdf', () => {
  const data = Array.from({ length: 150000 }, (_, i) => ({ x: (i * 7919) % 10007, y: (i * 104729) % 1009 }));
  for (const type of ['scatter', 'hist', 'kde', 'ecdf']) {
    const svg = plot({ type, data, x: 'x', ...(type === 'scatter' ? { y: 'y' } : {}) });
    assert.ok(svg.startsWith('<svg') && !/NaN/.test(svg), type);
  }
  assert.deepEqual(extent([3, NaN, -1, 7, null]), [-1, 7]);
  assert.deepEqual(extent([]), [Infinity, -Infinity]);
});

test('ecdf con muchos valores: escalones fundidos por píxel', () => {
  const data = Array.from({ length: 50000 }, (_, i) => ({ v: (i * 7919) % 10007 }));
  const svg = plot({ type: 'ecdf', data, x: 'v' });
  assert.ok(svg.length < 200e3, `${svg.length} bytes`);
});

test('lowess: igual al método exacto con pocos puntos y rápido con 2 mil', () => {
  const xs = Array.from({ length: 60 }, (_, i) => i), ys = xs.map((x) => Math.sin(x / 8) + ((x * 7) % 5) / 10);
  // Valores del método original (ordenaba todas las distancias por punto).
  const ref = { 0: 0.9806052777058902, 13: 0.7692517130323275, 29: -0.0852507844632026, 46: -0.022922490821239934, 59: 0.8565089223314405 };
  const got = lowess(xs, ys);
  for (const [i, v] of Object.entries(ref)) assert.ok(Math.abs(got[i][1] - v) < 1e-12, `i=${i}`);
  const X = Array.from({ length: 2000 }, (_, i) => i), Y = X.map((x) => Math.sin(x / 100));
  const t0 = Date.now();
  const big = lowess(X, Y);
  assert.ok(Date.now() - t0 < 1000, `${Date.now() - t0} ms`);
  const exact = lowess(X, Y, { delta: 0 });
  assert.ok(big.every(([, y], i) => Math.abs(y - exact[i][1]) < 1e-3), 'anclas + interpolación ≈ ajuste en cada punto');
});

test('kde con binning lineal ≈ kde exacta', () => {
  const v = Array.from({ length: 5000 }, (_, i) => Math.sin(i) * 3 + (i % 17));
  const bw = 0.8;
  const a = kde(v, { bandwidth: bw, gridSize: 120 });
  const k = 1 / (v.length * bw * Math.sqrt(2 * Math.PI));
  let worst = 0, peak = 0;
  for (const [x, d] of a) {
    let e = 0;
    for (const xi of v) { const u = (x - xi) / bw; if (u > -6 && u < 6) e += Math.exp(-0.5 * u * u); }
    worst = Math.max(worst, Math.abs(d - e * k)); peak = Math.max(peak, e * k);
  }
  assert.ok(worst / peak < 1e-3, `error relativo ${worst / peak}`);
});
