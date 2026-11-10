import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pointmap, embedTiles, tileProvider, tileUrl, mercX, mercY, TILE_PROVIDERS } from '../src/charts/pointmap.js';
import { getTheme } from '../src/theme.js';
import { pointmapGallery, ciudadesChile } from '../examples/specs-pointmap.js';

// Sin red: nada aquí descarga teselas (embedTiles recibe un fetch falso).
const render = (s) => pointmap(s, getTheme(s.theme));
const clean = (svg) => !/NaN|undefined|object Object|Infinity/.test(svg);
const tiles = (svg) => [...svg.matchAll(/<image class="pa-tile" href="([^"]+)" x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)"/g)].map((m) => ({ href: m[1], x: +m[2], y: +m[3], w: +m[4], h: +m[5] }));
const circles = (svg) => [...svg.matchAll(/<circle class="pa-m" cx="([^"]+)" cy="([^"]+)" r="([^"]+)"[^>]*data-tip="([^"]*)"/g)].map((m) => ({ cx: +m[1], cy: +m[2], r: +m[3], tip: m[4] }));
const city = (name) => ciudadesChile.find((c) => c.ciudad === name);

test('la galería de mapas de puntos se dibuja en ambos temas y anchos', () => {
  for (const ex of pointmapGallery) for (const theme of ['papel', 'noche']) for (const width of [720, 390]) {
    const svg = render({ ...ex.spec, theme, width });
    assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'), ex.id);
    assert.ok(clean(svg), `${ex.id} ${theme} ${width}`);
    assert.match(svg, /data-pa-type="pointmap"/);
    assert.match(svg, /<desc[^>]*>[^<]+<\/desc>/);
    assert.ok(tiles(svg).length > 0 && tiles(svg).length <= 48, `${ex.id}: ${tiles(svg).length} teselas`);
    // Estructura de zoom de los mapas (interact.js) y atribución con enlace.
    assert.match(svg, /class="pa-zoom-clip[^"]*" clip-path="url\(#[^)]+\)"/);
    assert.match(svg, /class="pa-zoom" data-zoom="[\d.]+,[\d.]+,[\d.]+,[\d.]+"/);
    assert.match(svg, /<g class="pa-attribution"><a href="https:\/\/[^"]+" target="_blank"/);
    assert.equal(circles(svg).length, ex.spec.data.length, ex.id);
  }
});

test('Web Mercator: fórmulas y teselas en la posición estándar (slippy map)', () => {
  assert.equal(mercX(-180), 0); assert.equal(mercX(0), 0.5); assert.equal(mercX(180), 1);
  assert.ok(Math.abs(mercY(0) - 0.5) < 1e-12);
  assert.ok(Math.abs(mercY(85.0511287798)) < 1e-9 && Math.abs(mercY(-85.0511287798) - 1) < 1e-9);
  assert.ok(mercY(89) >= 0 && mercY(-89) <= 1, 'latitudes extremas se recortan');
  // Cada punto cae dentro de la tesela que el estándar le asigna.
  const svg = render({ type: 'pointmap', data: ciudadesChile, title: 't', source: 's' });
  const dots = circles(svg);
  const ts = tiles(svg);
  const zt = +/\/(\d+)\/\d+\/\d+\.png$/.exec(ts[0].href)[1];
  for (const name of ['Santiago', 'Concepción', 'Arica', 'Punta Arenas']) {
    const c = city(name);
    const n = 2 ** zt;
    const tx = Math.floor(mercX(c.lon) * n), ty = Math.floor(mercY(c.lat) * n);
    const dot = dots.find((d) => d.tip.startsWith(name));
    const t = ts.find((q) => q.href.endsWith(`/${zt}/${tx}/${ty}.png`));
    assert.ok(t, `${name}: falta la tesela ${zt}/${tx}/${ty}`);
    assert.ok(dot.cx >= t.x - 0.01 && dot.cx <= t.x + t.w && dot.cy >= t.y - 0.01 && dot.cy <= t.y + t.h, `${name} fuera de su tesela`);
  }
  // Las teselas cubren todo el cuadro del mapa (sin huecos).
  const [bx, by, bw, bh] = /data-zoom="([^"]+)"/.exec(svg)[1].split(',').map(Number);
  assert.ok(Math.min(...ts.map((t) => t.x)) <= bx && Math.max(...ts.map((t) => t.x + t.w)) >= bx + bw);
  assert.ok(Math.min(...ts.map((t) => t.y)) <= by && Math.max(...ts.map((t) => t.y + t.h)) >= by + bh);
});

test('lon/lat se detectan por nombre (lng, longitude, Latitud…) y los errores orientan', () => {
  for (const [lo, la] of [['lng', 'lat'], ['longitude', 'latitude'], ['Longitud', 'Latitud'], ['LON', 'LAT']]) {
    const svg = render({ type: 'pointmap', data: [{ nombre: 'Concepción', [lo]: -73.05, [la]: -36.82 }, { nombre: 'Talca', [lo]: -71.66, [la]: -35.43 }] });
    assert.equal(circles(svg).length, 2, lo);
    assert.ok(circles(svg)[0].tip.match(/Concepción|Talca/));
  }
  assert.throws(() => render({ type: 'pointmap', data: [{ a: 1, b: 2 }] }), (e) => e.name === 'PlotError' && /longitud y latitud/.test(e.message));
  assert.throws(() => render({ type: 'pointmap', locale: 'en', data: [{ lon: 'x', lat: 'y' }] }), (e) => e.name === 'PlotError' && /Swapped/.test(e.message));
  assert.throws(() => render({ type: 'pointmap', data: [{ lon: 1, lat: 2 }], size: 'pop' }), /pop/);
});

test('proveedores: orden {y}/{x} de Esri, claves, tokens secretos y URLs propias', () => {
  const th = getTheme();
  const esri = render({ type: 'pointmap', tiles: 'esri-gray', data: ciudadesChile });
  assert.ok(tiles(esri).every((t) => /World_Light_Gray_Base\/MapServer\/tile\/\d+\/\d+\/\d+$/.test(t.href)));
  assert.match(esri, /Esri, HERE, Garmin, © OpenStreetMap contributors/);
  // Atajo por familia según el tema.
  assert.equal(tileProvider({ tiles: 'esri' }, getTheme('noche')).id, 'esri-dark');
  // Mapbox: sin token, error; token secreto, error; token público, en la URL y escapado.
  assert.throws(() => render({ type: 'pointmap', tiles: 'mapbox-light', data: ciudadesChile }), (e) => e.name === 'PlotError' && /tilesKey/.test(e.message));
  assert.throws(() => render({ type: 'pointmap', tiles: 'mapbox-dark', tilesKey: 'sk.eyJsecret', data: ciudadesChile }), (e) => e.name === 'PlotError' && /secret|secreto/.test(e.message));
  const mb = render({ type: 'pointmap', tiles: 'mapbox-light', tilesKey: 'pk.abc&x="1"', data: ciudadesChile });
  assert.ok(tiles(mb).every((t) => /api\.mapbox\.com\/styles\/v1\/mapbox\/light-v11\/tiles\/256\/\d+\/\d+\/\d+@2x\?access_token=pk\.abc%26x%3D%221%22$/.test(t.href)), tiles(mb)[0].href);
  // CARTO: clave gratuita obligatoria (sin ella las teselas traen marca de agua); retina y subdominios.
  assert.throws(() => render({ type: 'pointmap', tiles: 'carto-light', data: ciudadesChile }), /carto\.com\/basemaps\/apikey/);
  const carto = render({ type: 'pointmap', tiles: 'carto-light', tilesKey: 'abc123', data: ciudadesChile });
  assert.ok(tiles(carto).every((t) => /^https:\/\/[abcd]\.basemaps\.cartocdn\.com\/light_all\/\d+\/\d+\/\d+@2x\.png\?key=abc123$/.test(t.href)));
  // Proveedor propio: URL validada; atribución propia.
  const own = render({ type: 'pointmap', tiles: { url: 'https://tiles.example.org/{z}/{x}/{-y}.png', attribution: '© Example', maxZoom: 10 }, data: ciudadesChile });
  assert.ok(tiles(own).every((t) => t.href.startsWith('https://tiles.example.org/')));
  assert.match(own, />© Example</);
  assert.throws(() => render({ type: 'pointmap', tiles: { url: 'javascript:alert(1)//{z}/{x}/{y}' }, data: ciudadesChile }), /tiles\.url/);
  assert.throws(() => render({ type: 'pointmap', tiles: 'google', data: ciudadesChile }), /google/);
  assert.equal(tileUrl({ ...TILE_PROVIDERS.osm, key: null }, 3, 2, 5), 'https://tile.openstreetmap.org/3/2/5.png');
  assert.equal(tileUrl({ url: 'https://t/{z}/{x}/{-y}.png' }, 3, 2, 5), 'https://t/3/2/2.png');
  assert.ok(th);
});

test('estilo: filtro "muted" por defecto (tabla invertida en tema oscuro), "original" sin filtro', () => {
  const light = render({ type: 'pointmap', data: ciudadesChile });
  assert.match(light, /<filter id="([^"]+)"[^>]*filterUnits="userSpaceOnUse">.*?feColorMatrix type="saturate".*?feFuncR type="linear"/s);
  const id = /<filter id="([^"]+)"/.exec(light)[1];
  assert.match(light, new RegExp(`<g class="pa-tiles" pointer-events="none" filter="url\\(#${id}\\)">`));
  const dark = render({ type: 'pointmap', theme: 'noche', data: ciudadesChile });
  assert.match(dark, /feFuncR type="table" tableValues="[\d. ]+"/);
  const darkTiles = render({ type: 'pointmap', theme: 'noche', tiles: 'esri-dark', data: ciudadesChile });
  assert.match(darkTiles, /feFuncR type="linear"/);
  const orig = render({ type: 'pointmap', tileStyle: 'original', tileOpacity: 0.6, data: ciudadesChile });
  assert.ok(!/<filter/.test(orig));
  assert.match(orig, /class="pa-tiles" pointer-events="none" opacity="0.6"/);
});

test('sin teselas: agua del tema y, si el mundo está registrado, el contorno vectorial', async () => {
  const bare = render({ type: 'pointmap', tiles: false, data: ciudadesChile });
  assert.ok(!/<image/.test(bare));
  await import('../src/geo/world.js');
  const withWorld = render({ type: 'pointmap', tiles: false, data: ciudadesChile });
  assert.match(withWorld, /<g class="pa-basemap" pointer-events="none"><g><path d="M/);
  assert.match(withWorld, />Natural Earth</);
  // Con teselas, el respaldo queda debajo de ellas.
  const both = render({ type: 'pointmap', data: ciudadesChile });
  assert.ok(both.indexOf('pa-basemap') < both.indexOf('pa-tiles'));
});

test('color: hue con leyenda, value con rampa, hue numérico → rampa, highlight atenúa', () => {
  const t = getTheme();
  const hue = render({ type: 'pointmap', data: ciudadesChile, hue: 'macrozona' });
  assert.match(hue, /class="pa-key"[^>]*data-color="#3A47B8"/);
  for (const z of ['Norte', 'Sur', 'Centro', 'Austral']) assert.match(hue, new RegExp(`>${z}</text>`));
  const val = render({ type: 'pointmap', data: ciudadesChile, value: 'variacion' });
  assert.match(val, /<linearGradient id="pa-ramp-/);
  const numHue = render({ type: 'pointmap', data: ciudadesChile, hue: 'variacion' });
  assert.match(numHue, /<linearGradient id="pa-ramp-/);
  const hl = render({ type: 'pointmap', data: ciudadesChile, size: 'habitantes', highlight: 'Concepción' });
  const dim = circles(hl).filter((c) => !c.tip.startsWith('Concepción'));
  assert.ok(dim.length === 29);
  assert.match(hl, new RegExp(`fill="${t.dim}"`));
  assert.match(hl, />Concepción<tspan/);
});

test('tamaño: área proporcional, leyenda de tamaños y etiquetas de los mayores', () => {
  const svg = render({ type: 'pointmap', data: ciudadesChile, size: 'habitantes', label: 'ciudad', format: 'compact' });
  const d = circles(svg);
  const stgo = d.find((c) => c.tip.startsWith('Santiago')), conce = d.find((c) => c.tip.startsWith('Concepción'));
  const ratio = (stgo.r / conce.r) ** 2;
  assert.ok(Math.abs(ratio - city('Santiago').habitantes / city('Concepción').habitantes) < 0.2, `área ∝ valor (${ratio})`);
  assert.match(svg, /class="pa-legend pa-size-legend"/);
  assert.match(svg, />Santiago<tspan[^>]*> 6,3 M<\/tspan>/);
  // Grandes debajo: el primer círculo es el mayor.
  assert.equal(d[0].r, Math.max(...d.map((c) => c.r)));
});

test('muchos puntos → capa densa; nunca más de 48 teselas', () => {
  let s = 3; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const data = Array.from({ length: 2000 }, () => ({ lon: -75 + rnd() * 10, lat: -45 + rnd() * 25 }));
  const svg = render({ type: 'pointmap', data });
  assert.match(svg, /class="pa-dense"/);
  assert.match(svg, /class="pa-near"/);
  const wide = render({ type: 'pointmap', width: 1800, height: 1400, data: [{ lon: -70, lat: -33 }, { lon: 120, lat: 40 }] });
  assert.ok(tiles(wide).length <= 48, String(tiles(wide).length));
  assert.ok(clean(wide));
});

test('un punto: zoom 12 centrado; `zoom` y `center` fijan la vista', () => {
  const one = render({ type: 'pointmap', data: [{ name: 'UdeC', lat: -36.83, lon: -73.037 }] });
  assert.ok(tiles(one).every((t) => /\/12\/\d+\/\d+\.png$/.test(t.href)));
  const [bx, by, bw, bh] = /data-zoom="([^"]+)"/.exec(one)[1].split(',').map(Number);
  const c = circles(one)[0];
  assert.ok(Math.abs(c.cx - (bx + bw / 2)) < 1 && c.cy > by && c.cy < by + bh);
  const fixed = render({ type: 'pointmap', zoom: 5, center: [-70, -30], data: ciudadesChile });
  assert.ok(tiles(fixed).every((t) => /\/5\/\d+\/\d+\.png$/.test(t.href)));
});

test('antimeridiano: puntos a ambos lados quedan juntos', () => {
  const svg = render({ type: 'pointmap', data: [{ name: 'Suva', lat: -18.14, lon: 178.44 }, { name: 'Apia', lat: -13.83, lon: -171.76 }] });
  const [bx, , bw] = /data-zoom="([^"]+)"/.exec(svg)[1].split(',').map(Number);
  for (const c of circles(svg)) assert.ok(c.cx > bx && c.cx < bx + bw, 'ambos dentro del mapa, no a un mundo de distancia');
  // ~10° de longitud entre ambos: el zoom es alto (no un mapamundi).
  assert.ok(tiles(svg).every((t) => +/\/(\d+)\/\d+\/\d+\.png$/.exec(t.href)[1] >= 5));
  assert.ok(tiles(svg).every((t) => { const m = /\/(\d+)\/(\d+)\/\d+\.png$/.exec(t.href); return +m[2] >= 0 && +m[2] < 2 ** +m[1]; }), 'índices de tesela envueltos');
});

test('texto del usuario escapado; descripción en español e inglés', () => {
  const svg = render({ type: 'pointmap', data: [{ name: '<script>x</script> & "co"', lat: -33.4, lon: -70.6 }, { name: 'B', lat: -36.8, lon: -73.0 }] });
  assert.ok(!svg.includes('<script>'));
  assert.match(svg, /&lt;script&gt;/);
  const es = render({ type: 'pointmap', data: ciudadesChile, size: 'habitantes', label: 'ciudad' });
  assert.match(es, /<desc[^>]*>Mapa de 30 puntos entre las latitudes 53,2° S y 18,5° S y las longitudes 73,8° O y 68,9° O, sobre teselas de OpenStreetMap\. Mayor habitantes: Santiago/);
  const en = render({ type: 'pointmap', locale: 'en', data: ciudadesChile, hue: 'macrozona' });
  assert.match(en, /<desc[^>]*>Map of 30 points between latitudes 53\.2° S and 18\.5° S and longitudes 73\.8° W and 68\.9° W, over OpenStreetMap tiles\. Macrozona: Norte \(10\), Centro \(9\)/);
});

test('embedTiles: incrusta teselas como data: URI y respeta la política de OSM', async () => {
  const esri = render({ type: 'pointmap', tiles: 'esri-gray', data: ciudadesChile });
  const n = tiles(esri).length;
  const seen = [];
  const fakeFetch = async (url, init) => {
    seen.push([url, init]);
    return { ok: true, headers: { get: (h) => (h === 'content-type' ? 'image/jpeg' : null) }, arrayBuffer: async () => new Uint8Array([255, 216, 255]).buffer };
  };
  const out = await embedTiles(esri, { fetch: fakeFetch, userAgent: 'plotagents-test' });
  assert.equal(seen.length, n);
  assert.equal(seen[0][1].headers['User-Agent'], 'plotagents-test');
  assert.equal((out.match(/href="data:image\/jpeg;base64,\/9j\/"/g) || []).length, n);
  assert.ok(!/server\.arcgisonline\.com/.test(out.replace(/<a href="[^"]*"/g, '')));
  // OSM: no se descarga en lote; el SVG vuelve igual.
  const osm = render({ type: 'pointmap', data: ciudadesChile });
  let calls = 0;
  const same = await embedTiles(osm, { fetch: async () => { calls++; throw new Error('no'); } });
  assert.equal(calls, 0);
  assert.equal(same, osm);
  // Las teselas que fallan quedan con su URL.
  const failed = await embedTiles(esri, { fetch: async () => ({ ok: false }) });
  assert.equal(failed, esri);
});

test('colorScale (matplotlib) se usa completa en los valores', async () => {
  const { themeFor } = await import('../src/theme.js');
  const spec = { type: 'pointmap', data: ciudadesChile, value: 'variacion', colorScale: 'viridis' };
  const svg = pointmap(spec, themeFor(spec));
  const fills = new Set([...svg.matchAll(/<circle class="pa-m"[^>]*fill="(#[0-9A-F]{6})"/g)].map((m) => m[1]));
  assert.equal(circles(svg).length, 30);
  // viridis va de morado oscuro (#440154) a amarillo (#FDE725): el mínimo queda cerca del morado.
  assert.ok([...fills].some((c) => parseInt(c.slice(1, 3), 16) > 0x40 && parseInt(c.slice(5, 7), 16) > 0x40 && parseInt(c.slice(3, 5), 16) < 0x20), [...fills].join(' '));
});
