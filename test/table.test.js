import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plot, safePlot, resolve, lint, schema, toolDefinition, detectLocale, formatNumber } from '../src/index.js';
import { statusOf, pagerItems } from '../src/charts/table.js';
import { tableGallery } from '../examples/specs-table.js';

const clean = (svg) => !/NaN|undefined|object Object|Infinity/.test(svg);
const texts = (svg) => [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);

const regiones = [
  { region: 'Biobío', ventas: 3890, variacion: -0.012, estado: 'En riesgo', tendencia: [12, 11, 11, 10, 10], avance: 0.7, activo: true, web: 'https://biobio.cl' },
  { region: 'Ñuble', ventas: 720.5, variacion: 0.15, estado: 'Completado', tendencia: [1, 2, 2, 3, 4], avance: 0.55, activo: false, web: 'javascript:alert(1)' },
  { region: 'Maule', ventas: 1530, variacion: 0.08, estado: 'Atrasado', tendencia: [4, 5, 5, 6, 6], avance: 1.05, activo: true, web: 'https://maule.cl' },
  { region: 'Araucanía', ventas: null, variacion: 0, estado: 'En curso', tendencia: [3, 3, 2, 3, 3], avance: 0.4, activo: false, web: 'https://araucania.cl' },
];
const base = { type: 'table', title: 'Biobío concentra la mitad de las ventas del sur', subtitle: 'Ventas, millones de pesos, 2025', source: 'datos ilustrativos', data: regiones };

test('table: infiere el indicador de cada columna', () => {
  const svg = plot({ ...base, width: 1100 });
  assert.ok(clean(svg));
  assert.match(svg, /data-pa-type="table"/);
  assert.match(svg, /role="table"/);
  assert.match(svg, /role="columnheader"/);
  const t = texts(svg);
  // Decimales parejos por columna (720,5 → 721 porque hay miles), variación con signo, avance en %.
  assert.ok(t.includes('3.890') && t.includes('721'), t.join('|'));
  assert.ok(t.includes('+15,0%') && t.includes('−1,2%') && t.includes('0,0%'));
  assert.ok(t.includes('70%') && t.includes('105%'));
  assert.ok(t.includes('—'), 'vacío como raya');
  // Estado como píldora, booleano como ✓ accesible, enlace seguro.
  assert.ok(t.includes('En riesgo'));
  assert.match(svg, /aria-label="Sí"/);
  // Enlaces: solo http(s) y mailto llevan href.
  const links = plot({ ...base, columns: ['region', { field: 'web', type: 'link' }] });
  assert.match(links, /href="https:\/\/biobio.cl"/);
  assert.doesNotMatch(links, /href="javascript/);
  assert.ok(texts(links).includes('biobio.cl'));
});

test('table: estados reconocidos en varios idiomas', () => {
  assert.equal(statusOf('Completado'), 'good');
  assert.equal(statusOf('at risk'), 'warning');
  assert.equal(statusOf('Atrasado'), 'critical');
  assert.equal(statusOf('em andamento'), 'info');
  assert.equal(statusOf('Abgeschlossen'), 'good');
  assert.equal(statusOf('Biobío'), null);
});

test('table: paginación por defecto, orden y búsqueda', () => {
  const data = Array.from({ length: 37 }, (_, i) => ({ nombre: `Comuna ${i + 1}`, poblacion: (i * 7919) % 1000 + 10, zona: i % 2 ? 'Norte' : 'Sur' }));
  const svg = plot({ ...base, data });
  assert.match(svg, /data-page="2"/);
  assert.match(svg, /aria-current="page"/);
  assert.ok(texts(svg).includes('1–10 / 37'));
  assert.equal((svg.match(/class="pa-tr"/g) || []).length, 10);
  // Última página: 7 filas, flecha siguiente apagada.
  const last = plot({ ...base, data, page: 99 });
  assert.ok(texts(last).includes('31–37 / 37'));
  assert.equal((last.match(/class="pa-tr"/g) || []).length, 7);
  assert.match(last, /pa-pg-off/);
  // Sin paginar.
  assert.equal((plot({ ...base, data, pageSize: false }).match(/class="pa-tr"/g) || []).length, 37);
  // Orden: mayor primero; "-campo" también vale.
  const sorted = plot({ ...base, data, sortBy: 'poblacion' });
  const firstPob = Math.max(...data.map((d) => d.poblacion));
  assert.ok(texts(sorted).includes(String(firstPob)));
  assert.match(sorted, /aria-sort="descending"/);
  const asc = plot({ ...base, data, sort: '+nombre', pageSize: 3 });
  assert.ok(texts(asc).includes('Comuna 1') && texts(asc).includes('Comuna 2') && texts(asc).includes('Comuna 3'), 'orden natural de números en texto');
  // Búsqueda sin tildes ni mayúsculas.
  const q = plot({ ...base, query: 'nuble' });
  assert.equal((q.match(/class="pa-tr[ "]/g) || []).length, 1);
  assert.match(plot({ ...base, query: 'zzz' }), />Sin resultados</);
});

test('table: vacíos al final al ordenar y filas de total', () => {
  const svg = plot({ ...base, sortBy: 'ventas', sort: 'asc', total: true });
  const t = texts(svg);
  assert.ok(t.indexOf('721') < t.indexOf('3.890'));
  assert.ok(t.indexOf('Araucanía') > t.indexOf('Biobío'), 'la fila sin ventas va al final');
  assert.ok(t.includes('Total'));
  assert.ok(t.includes('6.141'), 'suma de ventas');
  assert.ok(!t.includes('+5,5%'), 'la variación no se suma');
});

test('table: tarjetas en pantallas angostas, columnas en escritorio', () => {
  const wide = plot({ ...base, width: 900 });
  assert.doesNotMatch(wide, /pa-cards/);
  const narrow = plot({ ...base, width: 360 });
  assert.match(narrow, /pa-cards/);
  assert.ok(clean(narrow));
  assert.doesNotMatch(plot({ ...base, width: 360, cards: false }), /pa-cards/);
  assert.match(plot({ ...base, cards: true }), /pa-cards/);
  // Escala de texto grande y tema oscuro: sin valores rotos.
  for (const theme of ['papel', 'noche']) for (const textScale of [1, 1.6]) assert.ok(clean(plot({ ...base, theme, textScale, highlight: 'Maule', rank: true, total: true, group: 'estado' })));
});

test('table: idioma reconocido del texto', () => {
  assert.equal(detectLocale(['Sales grew 12% in the South', 'Region']), 'en');
  assert.equal(detectLocale(['Las ventas del sur crecieron']), 'es');
  assert.equal(detectLocale(['As vendas da região cresceram não só no sul']), 'pt');
  assert.equal(detectLocale(['Les ventes de la région ont augmenté depuis']), 'fr');
  assert.equal(detectLocale(['Der Umsatz ist im Süden gewachsen und die Region']), 'de');
  assert.equal(detectLocale(['12345']), null);
  const data = [{ team: 'North', revenue: 12345.5 }, { team: 'South', revenue: 9876 }, { team: 'East', revenue: 4321 }];
  const en = { type: 'table', title: 'The North team leads revenue', source: 'illustrative data', data };
  assert.equal(resolve(en).locale, 'en');
  assert.ok(texts(plot(en)).includes('12,346'));
  assert.match(plot(en), /Source: illustrative data/);
  // locale explícito siempre gana; "auto" funciona en cualquier gráfico.
  assert.equal(resolve({ ...en, locale: 'es' }).locale, 'es');
  assert.equal(resolve({ type: 'bar', title: 'Revenue by team, the North leads', data, locale: 'auto' }).locale, 'en');
  assert.equal(resolve({ type: 'bar', data }).locale, undefined, 'los demás gráficos no cambian su valor por defecto');
  // Formatos de otros idiomas.
  assert.equal(formatNumber(1234.5, 1, 'fr'), '1 234,5');
  assert.equal(formatNumber(1234.5, 1, 'pt-BR'), '1.234,5');
  const de = plot({ ...en, title: 'Der Umsatz ist im Norden am höchsten', source: 'Beispieldaten', total: true });
  assert.match(de, />Gesamt</);
  assert.match(de, /Quelle: Beispieldaten/);
});

test('table: lint revisa columnas, orden y habla el idioma de la tabla', () => {
  const bad = lint({ type: 'table', data: regiones, columns: ['region', 'ventaz', { field: 'variacion', type: 'arrows' }], sortBy: 'venta' });
  const codes = bad.errors.map((e) => e.code);
  assert.ok(codes.includes('field'));
  assert.ok(codes.includes('table-column-type'));
  assert.ok(codes.includes('table-sort'));
  assert.ok(bad.errors.find((e) => e.code === 'table-sort').fix.includes('ventas'));
  const en = lint({ type: 'table', title: 'Sales by team', data: [{ team: 'A', sales: 1 }], columns: ['team', { field: 'sales', type: 'barz' }] });
  assert.match(en.errors.find((e) => e.code === 'table-column-type').message, /Unknown column type/);
  const ok = safePlot({ ...base, columns: ['region', { field: 'ventas', type: 'bar' }, { field: 'variacion', type: 'delta', good: 'down' }], sortBy: 'ventas', pageSize: 5, total: true, rank: true });
  assert.ok(ok.ok, JSON.stringify(ok.errors));
  assert.deepEqual(ok.warnings, []);
  assert.match(ok.description, /^Tabla de 4 filas/);
  assert.ok(lint({ ...base, columns: Array.from({ length: 10 }, () => 'region') }).warnings.some((w) => w.code === 'table-wide'));
});

test('table: columnas explícitas, calor, meta y escape de texto', () => {
  const data = [
    { proyecto: 'Planta <norte>', gasto: 120, presupuesto: 100, nota: 6.5 },
    { proyecto: 'Planta "sur"', gasto: 80, presupuesto: 100, nota: 4.2 },
    { proyecto: 'Centro & datos', gasto: 95, presupuesto: 90, nota: 5.8 },
  ];
  const svg = plot({ type: 'table', data, columns: ['proyecto', { field: 'gasto', type: 'progress', target: 'presupuesto', good: 'down', label: 'Gasto vs. presupuesto' }, { field: 'nota', type: 'heat', colorScale: 'RdYlGn', format: { decimals: 1 } }] });
  assert.ok(clean(svg));
  assert.match(svg, /Planta &lt;norte&gt;/);
  assert.doesNotMatch(svg, /<norte>/);
  assert.ok(texts(svg).includes('120%'));
  assert.ok(texts(svg).includes('6,5'));
  assert.match(svg, /Gasto vs\. presupuesto/);
});

test('table: paginador compacto y schema', () => {
  assert.deepEqual(pagerItems(1, 5), [1, 2, 3, 4, 5]);
  assert.deepEqual(pagerItems(10, 20), [1, '…', 9, 10, 11, '…', 20]);
  assert.deepEqual(pagerItems(19, 20), [1, '…', 16, 17, 18, 19, 20]);
  assert.ok(schema.properties.type.enum.includes('table'));
  assert.ok(schema.properties.columns.anyOf.some((a) => a.type === 'array'));
  assert.ok(schema.properties.locale.enum.includes('auto'));
  assert.match(toolDefinition().description, /table/);
  assert.equal(resolve({ type: 'tabla', data: regiones }).type, 'table');
  assert.equal(resolve({ data: regiones, columns: ['region'] }).type, 'table');
  // `columns` como número sigue siendo paneles por fila en facet.
  assert.ok(clean(plot({ type: 'bar', data: regiones.map((r) => ({ ...r, ventas: r.ventas ?? 0 })), x: 'region', y: 'ventas', facet: 'estado', columns: 2 })));
});

test('table: galería en ambos temas y anchos', () => {
  for (const ex of tableGallery) for (const theme of ['papel', 'noche']) for (const width of [760, 390]) {
    const r = safePlot({ ...ex.spec, theme, width });
    assert.ok(r.ok && clean(r.svg), `${ex.id} ${theme} ${width}: ${JSON.stringify(r.errors)}`);
    assert.deepEqual(r.warnings, [], ex.id);
  }
});

test('table: sin texto reconocible, el servidor usa el idioma por defecto (no el de Node)', () => {
  const svg = plot({ type: 'table', data: [{ v: '12%' }, { v: '3,5%' }, { v: '0,5%' }] });
  assert.ok(texts(svg).includes('12,0%') && texts(svg).includes('0,5%'), texts(svg).join('|'));
  const cur = plot({ type: 'table', data: [{ p: '$ 3.000' }, { p: '$ 12.500' }, { p: '$ 990' }] });
  assert.ok(texts(cur).includes('$12.500'));
});
