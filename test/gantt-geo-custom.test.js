import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plot, safePlot, lint, resolve, toFeatureCollection } from '../src/index.js';
import { ganttGallery, planProyecto, ampliacionSucursal } from '../examples/specs-gantt.js';
import { customGeoGallery, southAmerica } from '../examples/specs-geo-custom.js';
import { colorMap, themeFor } from '../src/theme.js';

const clean = (svg) => !/NaN|undefined|object Object|Infinity/.test(svg);

test('gantt: la galería se dibuja en ambos temas y anchos', () => {
  for (const ex of [...ganttGallery, ...customGeoGallery]) for (const theme of ['papel', 'noche']) for (const width of [720, 390]) {
    const svg = plot({ ...ex.spec, theme, width });
    assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'), ex.id);
    assert.ok(clean(svg), `${ex.id} ${theme} ${width}`);
  }
});

test('gantt: hitos, avance, dependencias, hoy y descripción', () => {
  const svg = plot(ganttGallery[0].spec);
  assert.match(svg, /data-pa-type="gantt"/);
  assert.equal((svg.match(/marker-end=/g) || []).length, planProyecto.filter((r) => r.depende).length);
  assert.match(svg, />Hoy · 12 mar</);
  const desc = /<desc[^>]*>([^<]+)</.exec(svg)[1];
  assert.match(desc, /10 tareas en 4 fases/);
  assert.match(desc, /Hitos: Informe de hallazgos \(9 feb\), Puesta en marcha \(15 jun\)/);
  assert.match(desc, /Avance total: \d+%/);
});

test('gantt: el fin es inclusivo y la duración en días se informa', () => {
  const svg = plot({ type: 'gantt', locale: 'en', data: [{ task: 'A', start: '2026-03-03', end: '2026-03-05' }] });
  assert.match(svg, /3 days/);
  assert.match(svg, /Mar 3, 2026 – Mar 5, 2026/);
});

test('gantt: se infiere de dos fechas por fila y acepta alias', () => {
  const data = [{ tarea: 'Diseño', inicio: '2026-01-05', fin: '2026-01-20' }, { tarea: 'Construcción', inicio: '2026-01-21', fin: '2026-02-20' }];
  assert.equal(resolve({ data }).type, 'gantt');
  for (const t of ['timeline', 'roadmap', 'cronograma']) assert.equal(resolve({ type: t, data }).type, 'gantt');
});

test('gantt: eje numérico (semanas) con duración', () => {
  const svg = plot(ganttGallery[1].spec);
  assert.ok(clean(svg));
  assert.doesNotMatch(svg, />2,5</);
});

test('gantt: lint avisa tareas al revés y sugiere la línea de hoy', () => {
  const rep = lint({ type: 'gantt', data: [{ task: 'A', start: '2026-03-10', end: '2026-03-01' }] });
  assert.ok(rep.warnings.some((w) => w.code === 'gantt-backwards'));
  assert.ok(rep.suggestions.some((w) => w.code === 'gantt-today'));
});

const arrows = (svg) => (svg.match(/marker-end=/g) || []).length;
const axisLabels = (svg) => [.../<g class="pa-axis pa-axis-x">(.*?)<\/g>/.exec(svg)[1].matchAll(/>([^<]+)<\/text>/g)].map((m) => m[1]);
const gridX = (svg) => [.../<g class="pa-grid">(.*?)<\/g>/.exec(svg)[1].matchAll(/x1="([^"]+)"/g)].map((m) => m[1]);
const descOf = (svg) => /<desc[^>]*>([^<]+)</.exec(svg)[1];

test('gantt: una fase contraída se resume en su cabecera y oculta sus tareas', () => {
  const svg = plot({ ...ganttGallery[0].spec, collapsed: ['Construcción'] });
  assert.ok(clean(svg));
  assert.match(svg, /<g class="pa-gh" data-group="Construcción" data-collapsed="true"/);
  assert.match(svg, /<g class="pa-gh" data-group="Diseño" data-collapsed="false"/);
  assert.equal((svg.match(/class="pa-chev"/g) || []).length, 4);
  assert.equal((svg.match(/class="pa-hit"/g) || []).length, 4);
  for (const t of ['Integración con el ERP', 'Panel de indicadores', 'Pruebas con usuarios']) {
    assert.doesNotMatch(svg, new RegExp(`data-task="${t}"|>${t}<`), t);
  }
  assert.match(svg, /data-task="Prototipo del agente"/);
  assert.match(svg, />· 3</);
  assert.match(svg, /3 tareas · 4%\nClic para expandir/);
  assert.match(svg, /2 tareas · 1 hito · 100%\nClic para contraer/);
  assert.match(descOf(svg), /Fase contraída: Construcción \(3\)/);
  const en = plot({ ...ganttGallery[0].spec, locale: 'en', collapsed: true });
  assert.match(en, /2 tasks · 1 milestone · 100%\nClick to expand/);
  assert.match(descOf(en), /All phases collapsed/);
  assert.doesNotMatch(en, /data-task=/);
});

test('gantt: las dependencias se remiten a la fase contraída, sin repetirse', () => {
  const spec = ganttGallery[0].spec;
  assert.equal(arrows(plot({ ...spec, collapsed: ['Construcción'] })), 7);
  // Diagnóstico pierde sus dos vínculos internos.
  assert.equal(arrows(plot({ ...spec, collapsed: ['Diagnóstico', 'Construcción'] })), 5);
  // Todas: Diagnóstico→Diseño, Diseño→Construcción (dos vínculos, una flecha) y Construcción→Cierre.
  assert.equal(arrows(plot({ ...spec, collapsed: true })), 3);
});

test('gantt: contraer no mueve el eje ni la columna de nombres', () => {
  for (const width of [720, 390]) for (const ex of [ganttGallery[0], ganttGallery[2]]) {
    const open = plot({ ...ex.spec, width, collapsed: [] });
    for (const collapsed of [true, ['Diseño'], ['Permisos', 'Apertura']]) {
      const svg = plot({ ...ex.spec, width, collapsed });
      assert.deepEqual(axisLabels(svg), axisLabels(open), `${ex.id} ${width}`);
      assert.deepEqual(gridX(svg), gridX(open), `${ex.id} ${width}`);
    }
  }
});

test('gantt: collapsible: false y sin fases no hay controles', () => {
  const svg = plot({ ...ganttGallery[0].spec, collapsible: false, collapsed: ['Cierre'] });
  assert.doesNotMatch(svg, /pa-chev|pa-hit/);
  assert.match(svg, /data-collapsed="true"/);
  const flat = plot({ ...ganttGallery[1].spec, collapsed: true });
  assert.ok(clean(flat));
  assert.doesNotMatch(flat, /data-group=|pa-chev/);
  assert.equal((flat.match(/data-task=/g) || []).length, 7);
});

test('gantt: ruta crítica (holgura cero en días hábiles) y fines de semana', () => {
  const spec = { ...ganttGallery[2].spec, collapsed: [] };
  const svg = plot(spec);
  const desc = descOf(svg);
  assert.match(desc, /Ruta crítica: Levantamiento del local → Planos y especificaciones → Permiso municipal → Permiso aprobado → Demolición interior → Tabiquería → Climatización → Pintura y pisos → Mobiliario → Marcha blanca → Apertura al público\./);
  assert.match(svg, />Ruta crítica</);
  assert.equal((svg.match(/url\(#[^)]*-arrow-c\)/g) || []).length, 10);
  assert.match(svg, /class="pa-weekends"/);
  assert.doesNotMatch(plot({ ...spec, weekends: false }), /pa-weekends/);
  assert.doesNotMatch(plot(ganttGallery[0].spec), /pa-weekends|Ruta crítica/); // más de 120 días y sin `critical`
  // Contraída, la fase crítica conserva su flecha crítica hacia la obra.
  const c = plot(ganttGallery[2].spec);
  assert.ok(clean(c));
  assert.match(c, /url\(#[^)]*-arrow-c\)/);
  assert.equal(ampliacionSucursal.filter((r) => r.fase === 'Permisos').length, 4);
});

test('geo propio: detecta la propiedad que calza (ADMIN) y colorea categorías', () => {
  const r = safePlot(customGeoGallery[0].spec);
  assert.ok(r.ok, JSON.stringify(r.errors));
  assert.equal(r.warnings.length, 0, JSON.stringify(r.warnings));
  assert.match(r.description, /Español \(9\), .*Portugués \(1\)/);
  assert.match(r.description, /12 marcadores/);
  assert.match(r.svg, /Trópico de Capricornio/);
});

test('geo propio: featureKey explícito, arreglo de features y geometría suelta', () => {
  const fc = southAmerica('en');
  const data = [{ code: 'CHL', v: 1 }, { code: 'ARG', v: 2 }];
  for (const geo of [fc, fc.features]) {
    const r = safePlot({ type: 'choropleth', geo, data, key: 'code', value: 'v', featureKey: 'ISO_A3' });
    assert.ok(r.ok && r.warnings.length === 0, JSON.stringify([r.errors, r.warnings]));
  }
  const one = toFeatureCollection({ type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] });
  assert.equal(one.features.length, 1);
});

test('geo propio: TopoJSON con transformación y arcos compartidos', () => {
  const topo = {
    type: 'Topology', transform: { scale: [1, 1], translate: [0, 0] },
    objects: { zonas: { type: 'GeometryCollection', geometries: [
      { type: 'Polygon', arcs: [[0, 1]], properties: { nombre: 'Oeste' } },
      { type: 'Polygon', arcs: [[-1, 2]], properties: { nombre: 'Este' } },
    ] } },
    arcs: [[[10, 0], [0, 10]], [[10, 10], [-10, 0], [0, -10], [10, 0]], [[10, 0], [10, 0], [0, 10], [-10, 0]]],
  };
  const fc = toFeatureCollection(topo);
  assert.deepEqual(fc.features[1].geometry.coordinates[0], [[10, 10], [10, 0], [20, 0], [20, 10], [10, 10]]);
  const r = safePlot({ geo: topo, projection: 'planar', data: [{ z: 'Oeste', v: 1 }, { z: 'Este', v: 4 }], key: 'z', value: 'v' });
  assert.ok(r.ok && r.warnings.length === 0, JSON.stringify([r.errors, r.warnings]));
  assert.ok(clean(r.svg));
});

test('geo propio: puntos, líneas y coordenadas planas (UTM)', () => {
  const pts = { type: 'FeatureCollection', features: [['A', -70, -33], ['B', -73, -37]].map(([n, x, y]) => ({ type: 'Feature', properties: { NOMBRE: n }, geometry: { type: 'Point', coordinates: [x, y] } })) };
  const r1 = safePlot({ geo: pts, data: [{ n: 'A', v: 1 }, { n: 'B', v: 2 }], key: 'n', value: 'v' });
  assert.ok(r1.ok && clean(r1.svg));
  assert.match(r1.svg, /a5,5 0 1,0/);
  const utm = { type: 'FeatureCollection', features: [0, 1].map((i) => ({ type: 'Feature', properties: { id: 'Z' + i }, geometry: { type: 'Polygon', coordinates: [[[670000 + i * 1000, 5920000], [671000 + i * 1000, 5920000], [671000 + i * 1000, 5921000], [670000 + i * 1000, 5920000]]] } })) };
  const r2 = safePlot({ geo: utm, data: [{ z: 'Z0', v: 1 }, { z: 'Z1', v: 3 }], key: 'z', value: 'v' });
  assert.ok(r2.ok && clean(r2.svg), JSON.stringify(r2.errors));
  const line = { type: 'Feature', properties: { name: 'Ruta' }, geometry: { type: 'LineString', coordinates: [[-72, -36], [-73, -37]] } };
  const r3 = safePlot({ geo: 'chile', data: [{ r: 'Biobío', v: 1 }], key: 'r', value: 'v', layers: [{ geo: line, label: 'Ruta' }], fitTo: [-74, -38, -71, -36] });
  assert.ok(r3.ok && clean(r3.svg));
});

test('geo propio: una URL en Node explica cómo cargar el archivo', () => {
  const r = safePlot({ geo: 'https://example.com/comunas.geojson', data: [{ a: 'x', v: 1 }], key: 'a', value: 'v' });
  assert.equal(r.ok, false);
  assert.match(r.errors[0].fix || r.errors[0].message, /readFileSync|URL/);
});

test('colorMap no repite un color fijado por el usuario', () => {
  const t = themeFor({});
  const m = colorMap(['A', 'B', 'C'], t, { A: t.categorical[1] });
  assert.notEqual(m.get('B'), t.categorical[1]);
  assert.notEqual(m.get('C'), t.categorical[1]);
});
