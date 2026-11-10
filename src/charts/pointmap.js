// Mapa de puntos sobre un mapa base real: teselas de OpenStreetMap (por
// defecto), Esri, CARTO o Mapbox, en Web Mercator, con puntos lon/lat encima.
// Las teselas se apagan con un filtro SVG (casi sin saturación y teñidas con
// los colores del tema) para que el mapa acompañe y los datos manden. Debajo
// va un respaldo vectorial (el mundo registrado, si lo hay) para que el mapa
// se lea aunque las teselas no carguen. En el navegador: zoom con clic, Ctrl/⌘
// + rueda o pellizco (la misma estructura .pa-zoom de los coropléticos).
//
// Ojo: un SVG usado como <img> no carga recursos externos (las teselas). Usa el
// SVG en línea, toHTML(), o embedTiles() para incrustarlas como data: URI.
import { el, g, text, tip, dotLayer, esc } from '../svg.js';
import { measure } from '../text.js';
import { makeFormat, formatNumber } from '../format.js';
import { colorMap, ramp, hexToRgb, rgbToHex } from '../theme.js';
import { ensureData, requireField, num, fieldsOf, fieldKind, humanize, PlotError } from '../data.js';
import { createFrame, chartId } from '../frame.js';
import { getGeo, registeredGeo } from '../geo/registry.js';
import { pathD, rings } from '../geo/projection.js';

const T = (locale, es, en) => (String(locale || 'es').startsWith('en') ? en : es);
const RAD = Math.PI / 180;
const MAX_LAT = 85.0511287798;
const TILE = 256;
const MAX_TILES = 48;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
// Mínimo y máximo sin `...` (con cientos de miles de puntos desborda la pila).
const lo = (a) => a.reduce((m, v) => (v < m ? v : m), Infinity);
const hi = (a) => a.reduce((m, v) => (v > m ? v : m), -Infinity);

// ── Web Mercator (EPSG:3857) en coordenadas normalizadas [0, 1] ─────────────
/** Longitud → x de Web Mercator en [0, 1] (0 = 180° O). */
export const mercX = (lon) => (lon + 180) / 360;
/** Latitud → y de Web Mercator en [0, 1] (0 = 85,05° N, y hacia abajo). */
export function mercY(lat) {
  const s = Math.sin(clamp(lat, -MAX_LAT, MAX_LAT) * RAD);
  return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
}
const lonOf = (x) => x * 360 - 180;
const latOf = (y) => Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) / RAD;

// ── Proveedores de teselas ──────────────────────────────────────────────────
const OSM_ATTR = '© OpenStreetMap contributors';
/**
 * Mapas base con nombre. `dark` dice si las teselas ya vienen oscuras (el
 * filtro "muted" las invierte solo cuando no calzan con el tema). `{r}` es el
 * sufijo @2x de las teselas retina; `{key}`, la clave o token.
 */
export const TILE_PROVIDERS = {
  osm: { name: 'OpenStreetMap', url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: OSM_ATTR, link: 'https://www.openstreetmap.org/copyright', maxZoom: 19 },
  'esri-gray': { name: 'Esri Light Gray Canvas', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', attribution: 'Esri, HERE, Garmin, © OpenStreetMap contributors', link: 'https://www.esri.com/en-us/legal/terms/full-master-agreement', maxZoom: 16, keyParam: 'token' },
  'esri-dark': { name: 'Esri Dark Gray Canvas', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', attribution: 'Esri, HERE, Garmin, © OpenStreetMap contributors', link: 'https://www.esri.com/en-us/legal/terms/full-master-agreement', maxZoom: 16, dark: true, keyParam: 'token' },
  // CARTO pide una clave gratuita (carto.com/basemaps/apikey): sin ella, las teselas traen una marca de agua.
  'carto-light': { name: 'CARTO Positron', url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', subdomains: 'abcd', retina: true, attribution: '© OpenStreetMap contributors © CARTO', link: 'https://carto.com/attributions', maxZoom: 20, needsKey: true, keyParam: 'key', keyHelp: 'carto.com/basemaps/apikey' },
  'carto-dark': { name: 'CARTO Dark Matter', url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', subdomains: 'abcd', retina: true, attribution: '© OpenStreetMap contributors © CARTO', link: 'https://carto.com/attributions', maxZoom: 20, dark: true, needsKey: true, keyParam: 'key', keyHelp: 'carto.com/basemaps/apikey' },
  'mapbox-light': { name: 'Mapbox Light', url: 'https://api.mapbox.com/styles/v1/mapbox/light-v11/tiles/256/{z}/{x}/{y}@2x?access_token={key}', attribution: '© Mapbox © OpenStreetMap', link: 'https://www.mapbox.com/about/maps/', maxZoom: 22, needsKey: true, keyHelp: 'account.mapbox.com' },
  'mapbox-dark': { name: 'Mapbox Dark', url: 'https://api.mapbox.com/styles/v1/mapbox/dark-v11/tiles/256/{z}/{x}/{y}@2x?access_token={key}', attribution: '© Mapbox © OpenStreetMap', link: 'https://www.mapbox.com/about/maps/', maxZoom: 22, needsKey: true, dark: true, keyHelp: 'account.mapbox.com' },
};
// Atajos: el claro o el oscuro según el tema.
const FAMILY = { esri: 'esri', carto: 'carto', mapbox: 'mapbox' };
const ALIASES = { openstreetmap: 'osm', 'esri-light': 'esri-gray', 'esri-grey': 'esri-gray', positron: 'carto-light', 'dark-matter': 'carto-dark', darkmatter: 'carto-dark' };

const safeUrl = (u) => typeof u === 'string' && (/^(https?:)?\/\//i.test(u.trim()) || /^\.{0,2}\/(?!\/)/.test(u.trim()));

/** `tiles` del spec → proveedor resuelto ({ url, attribution, link, … }) o null. */
export function tileProvider(spec, theme = {}) {
  const locale = spec.locale || 'es';
  const t = spec.tiles === undefined || spec.tiles === null || spec.tiles === true ? 'osm' : spec.tiles;
  if (t === false || t === 'none') return null;
  const key = spec.tilesKey ?? (typeof t === 'object' ? t.key : undefined);
  if (key !== undefined && key !== null && String(key).trim().startsWith('sk.')) {
    throw new PlotError(
      T(locale, '`tilesKey` es un token secreto de Mapbox (empieza con "sk."): quedaría a la vista de cualquiera en el SVG.', '`tilesKey` is a secret Mapbox token (it starts with "sk."): anyone could read it in the SVG.'),
      T(locale, 'Crea un token público (empieza con "pk.") en account.mapbox.com, restringido a tu dominio.', 'Create a public token (it starts with "pk.") at account.mapbox.com, restricted to your domain.'),
    );
  }
  let p;
  if (typeof t === 'string') {
    const name = t.trim().toLowerCase();
    const id = FAMILY[name] ? `${name}-${theme.mode === 'dark' ? 'dark' : name === 'esri' ? 'gray' : 'light'}` : ALIASES[name] || name;
    p = TILE_PROVIDERS[id];
    if (!p) {
      throw new PlotError(
        T(locale, `No conozco el mapa base "${t}".`, `Unknown basemap "${t}".`),
        T(locale, `Usa uno de ${Object.keys(TILE_PROVIDERS).map((k) => `"${k}"`).join(', ')}, un objeto { url, attribution } o false.`, `Use one of ${Object.keys(TILE_PROVIDERS).map((k) => `"${k}"`).join(', ')}, an object { url, attribution } or false.`),
      );
    }
    p = { id, ...p };
  } else if (typeof t === 'object') {
    if (!safeUrl(t.url) || !/\{z\}/.test(t.url) || !/\{x\}/.test(t.url) || !/\{-?y\}/.test(t.url)) {
      throw new PlotError(
        T(locale, '`tiles.url` debe ser una URL http(s) con {z}, {x} e {y}.', '`tiles.url` must be an http(s) URL with {z}, {x} and {y}.'),
        'tiles: { url: "https://tile.example.com/{z}/{x}/{y}.png", attribution: "© OpenStreetMap contributors" }',
      );
    }
    p = { id: 'custom', name: t.name, url: t.url.trim(), attribution: t.attribution, link: t.link ?? t.attributionUrl, subdomains: t.subdomains ?? 'abc', maxZoom: t.maxZoom ?? 19, minZoom: t.minZoom ?? 0, retina: !!t.retina, dark: !!t.dark };
    if (!p.attribution) { try { p.attribution = new URL(p.url.replace(/\{[^}]*\}/g, '0'), 'https://x.invalid/').host.replace(/^x\.invalid$/, ''); } catch { p.attribution = ''; } }
  } else {
    throw new PlotError(T(locale, '`tiles` debe ser un nombre, un objeto { url, attribution } o false.', '`tiles` must be a name, an object { url, attribution } or false.'));
  }
  if (p.needsKey && !key) {
    const mb = /^mapbox/.test(p.id);
    throw new PlotError(
      T(locale, `"${p.id}" necesita ${mb ? 'un token público de Mapbox' : 'una clave'} en \`tilesKey\`.`, `"${p.id}" needs ${mb ? 'a public Mapbox token' : 'a key'} in \`tilesKey\`.`),
      T(locale, `tilesKey: "${mb ? 'pk.…' : '…'}" (gratis en ${p.keyHelp}), o usa tiles: "osm" o "esri-gray", que no piden clave.`, `tilesKey: "${mb ? 'pk.…' : '…'}" (free at ${p.keyHelp}), or use tiles: "osm" or "esri-gray", which need no key.`),
    );
  }
  if (p.link && !/^https?:\/\//i.test(p.link)) p.link = null;
  return { ...p, key: key ?? null };
}

/** URL de una tesela: {z} {x} {y} {-y} {s} {r} {key}. */
export function tileUrl(p, z, x, y) {
  const n = 2 ** z;
  const subs = Array.isArray(p.subdomains) ? p.subdomains : String(p.subdomains || 'abc').split('');
  let u = p.url
    .replace(/\{z\}/g, z).replace(/\{x\}/g, x).replace(/\{y\}/g, y).replace(/\{-y\}/g, n - 1 - y)
    .replace(/\{s\}/g, subs[Math.abs(x + y) % subs.length] || '')
    .replace(/\{r\}/g, p.retina ? '@2x' : '')
    .replace(/\{key\}/g, encodeURIComponent(p.key ?? ''));
  if (p.key && p.keyParam && !/\{key\}/.test(p.url)) u += (u.includes('?') ? '&' : '?') + p.keyParam + '=' + encodeURIComponent(p.key);
  return u;
}

// ── Color ───────────────────────────────────────────────────────────────────
const mix = (a, b, t) => { const A = hexToRgb(a), B = hexToRgb(b); return rgbToHex(A.map((v, i) => v + (B[i] - v) * t)); };
const isHex = (c) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(c || ''));

/**
 * Filtro "muted": casi sin saturación y llevado a dos tonos del tema. Los
 * mapas claros (OSM, Positron, Light Gray) se invierten en el tema oscuro y
 * los oscuros en el claro; el fondo del mapa (tierra) cae cerca de la
 * superficie y el texto de las teselas, en un gris tinta suave.
 */
function tileFilter(id, theme, provider, box) {
  const dark = theme.mode === 'dark';
  const surface = isHex(theme.surface) ? theme.surface : dark ? '#0B0F2B' : '#FCFBF9';
  const ink = isHex(theme.ink) ? theme.ink : dark ? '#F2F3FA' : '#141A3F';
  const tint = isHex(theme.tint) ? theme.tint : surface;
  // base: lo que toma el fondo de la tesela; mark: lo que toma su trazo más intenso.
  const base = dark ? mix(surface, tint, 0.75) : mix(surface, tint, 0.18);
  const mark = dark ? mix(surface, ink, 0.5) : mix(surface, ink, 0.62);
  const lightTiles = !provider.dark;
  let f;
  if (dark && lightTiles) {
    // Teselas claras en tema oscuro: se invierten con una tabla (no lineal) para
    // que el agua quede más oscura que la tierra, como en un mapa nocturno.
    //   entrada: 0 (texto) … 0,8 (agua, bosques) … 0,94 (tierra) … 1 (calles)
    const water = mix(surface, '#000000', 0.12);
    const T9 = [0.56, 0.53, 0.49, 0.45, 0.39, 0.27, 0.02, 0.05, 0.12];
    const stops = T9.map((t) => hexToRgb(t <= 0.02 ? water : mix(mix(surface, tint, 0.5), ink, t - 0.02)).map((v) => v / 255));
    f = (i) => `type="table" tableValues="${stops.map((c) => +c[i].toFixed(4)).join(' ')}"`;
  } else {
    // Lineal: teselas claras, blanco → base y negro → mark; oscuras, al revés.
    const [c0, c1] = lightTiles ? [mark, base] : [base, mark];
    const A = hexToRgb(c0).map((v) => v / 255), B = hexToRgb(c1).map((v) => v / 255);
    f = (i) => `type="linear" slope="${+(B[i] - A[i]).toFixed(4)}" intercept="${+A[i].toFixed(4)}"`;
  }
  // filterUnits y tableValues van escritos a mano: el() pasaría el camelCase a guiones.
  const open = el('filter', { id, x: box.x, y: box.y, width: box.w, height: box.h, colorInterpolationFilters: 'sRGB' }, 'X').replace(/>X<\/filter>$/, '');
  return `${open} filterUnits="userSpaceOnUse">`
    + el('feColorMatrix', { type: 'saturate', values: dark ? 0.1 : 0.14 })
    + `<feComponentTransfer><feFuncR ${f(0)}/><feFuncG ${f(1)}/><feFuncB ${f(2)}/></feComponentTransfer>`
    + '</filter>';
}

// ── Respaldo vectorial (mundo registrado) ───────────────────────────────────
const bboxCache = new WeakMap();
function lonLatBox(f) {
  let b = bboxCache.get(f);
  if (b) return b;
  b = [Infinity, Infinity, -Infinity, -Infinity];
  for (const r of rings(f.geometry)) for (const p of r) { if (p[0] < b[0]) b[0] = p[0]; if (p[0] > b[2]) b[2] = p[0]; if (p[1] < b[1]) b[1] = p[1]; if (p[1] > b[3]) b[3] = p[1]; }
  bboxCache.set(f, b);
  return b;
}
function worldGeo() {
  try { return registeredGeo().includes('world') ? getGeo('world') : null; } catch { return null; }
}

// ── Etiquetas ───────────────────────────────────────────────────────────────
const hits = (box, boxes) => boxes.some((b) => !(box[2] < b[0] || box[0] > b[2] || box[3] < b[1] || box[1] > b[3]));

/** Valor "redondo" para la leyenda de tamaños (1, 2, 2,5 o 5 × 10ⁿ, hacia abajo). */
function niceDown(v) {
  if (!(v > 0)) return v;
  const m = 10 ** Math.floor(Math.log10(v));
  return [10, 5, 2.5, 2, 1].map((k) => k * m).find((x) => x <= v * 1.0001) || m;
}

const deg = (v, pos, neg, locale) => `${formatNumber(Math.abs(v), 1, locale, true)}° ${v < 0 ? neg : pos}`;

/** Mapa de puntos (lon/lat) sobre teselas reales. */
export function pointmap(spec, theme) {
  const locale = spec.locale || 'es';
  const en = String(locale).startsWith('en');
  const dark = theme.mode === 'dark';
  const data = ensureData(spec);
  const fields = fieldsOf(data);
  const find = (re) => fields.find((f) => re.test(f));
  const named = (v) => (typeof v === 'string' && fields.includes(v) ? v : null);
  const lonF = spec.lon ?? spec.lng ?? spec.longitude ?? find(/^(lon|lng|long|longitude|longitud)$/i) ?? named(spec.x);
  const latF = spec.lat ?? spec.latitude ?? find(/^(lat|latitude|latitud)$/i) ?? named(spec.y);
  if (!lonF || !latF) {
    throw new PlotError(
      T(locale, 'Un mapa de puntos necesita longitud y latitud.', 'A point map needs longitude and latitude.'),
      T(locale, `Nombra los campos "lon" y "lat" (o "lng", "longitude", "latitud") o indícalos con lon: "…", lat: "…". Campos: ${fields.map((f) => `"${f}"`).join(', ') || '(ninguno)'}.`, `Name the fields "lon" and "lat" (or "lng", "longitude", "latitude") or pass lon: "…", lat: "…". Fields: ${fields.map((f) => `"${f}"`).join(', ') || '(none)'}.`),
    );
  }
  requireField(data, lonF, 'lon');
  requireField(data, latF, 'lat');
  const sizeF = named(spec.size);
  if (spec.size !== undefined && typeof spec.size === 'string') requireField(data, spec.size, 'size');
  let hueF = spec.hue ?? spec.series ?? named(spec.color);
  let valueF = spec.value ?? null;
  if (hueF) requireField(data, hueF, 'hue');
  if (valueF) requireField(data, valueF, 'value');
  // Un `hue` numérico se lee como rampa; un `value` de texto, como categorías.
  const numeric = (f) => ['number', 'year'].includes(fieldKind(data, f));
  if (hueF && !valueF && numeric(hueF) && spec.scale !== 'categorical') { valueF = hueF; hueF = null; }
  if (valueF && !hueF && !numeric(valueF)) { hueF = valueF; valueF = null; }
  const used = new Set([lonF, latF, sizeF, hueF, valueF]);
  const labelF = spec.label ?? find(/^(label|name|nombre|city|ciudad|title|titulo|título|place|lugar|comuna|station|estacion|estación)$/i) ?? fields.find((f) => !used.has(f) && fieldKind(data, f) === 'category');
  if (spec.label) requireField(data, spec.label, 'label');

  // Puntos válidos; longitudes llevadas a [-180, 180) y "desenvueltas" si cruzan el antimeridiano.
  const pts = [];
  for (const r of data) {
    const lon = num(r[lonF]), lat = num(r[latF]);
    if (!Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lat) > 90) continue;
    pts.push({ r, lon: ((((lon + 180) % 360) + 360) % 360) - 180, lat, s: sizeF ? num(r[sizeF]) : NaN, v: valueF ? num(r[valueF]) : NaN, k: hueF ? String(r[hueF] ?? '') : '', name: labelF && r[labelF] !== undefined && r[labelF] !== null ? String(r[labelF]) : '' });
  }
  if (!pts.length) {
    throw new PlotError(
      T(locale, `No hay filas con "${lonF}" y "${latF}" numéricos (lat entre −90 y 90).`, `No rows with numeric "${lonF}" and "${latF}" (lat between −90 and 90).`),
      T(locale, '¿Están invertidas? La latitud de Santiago es −33,4 y su longitud, −70,6.', 'Swapped? Santiago\'s latitude is −33.4 and its longitude −70.6.'),
    );
  }
  let unwrapped = false;
  {
    const lons = pts.map((p) => p.lon);
    const span = hi(lons) - lo(lons);
    if (span > 180) {
      const alt = lons.map((l) => (l < 0 ? l + 360 : l));
      if (hi(alt) - lo(alt) < span) { for (const p of pts) if (p.lon < 0) p.lon += 360; unwrapped = true; }
    }
  }
  for (const p of pts) { p.mx = mercX(p.lon); p.my = mercY(p.lat); }
  const n = pts.length;
  const dense = n > 1500;
  const provider = tileProvider(spec, theme);
  const muted = (spec.tileStyle ?? 'muted') !== 'original';

  // Formatos: `format` va al tamaño si no hay `value`; `sizeFormat` / `valueFormat` los separan.
  const sizes = pts.map((p) => p.s).filter(Number.isFinite);
  const values = pts.map((p) => p.v).filter(Number.isFinite);
  const fs = makeFormat(spec.sizeFormat ?? (valueF ? undefined : spec.format), locale, sizes);
  const fv = makeFormat(spec.valueFormat ?? spec.format, locale, values);

  // Color: por categoría (hue), por valor (rampa) o uno solo.
  const hl = spec.highlight === undefined || spec.highlight === null ? null : new Set([].concat(spec.highlight).map(String));
  const focus = (p) => !hl || hl.has(p.name) || hl.has(p.k);
  let legend = [];
  let colorOf;
  let keys = [];
  if (hueF) {
    const count = new Map();
    for (const p of pts) count.set(p.k, (count.get(p.k) || 0) + 1);
    keys = Array.isArray(spec.order) ? spec.order.map(String).filter((k) => count.has(k)).concat([...count.keys()].filter((k) => !spec.order.map(String).includes(k))) : [...count.keys()].sort((a, b) => count.get(b) - count.get(a));
    const cmap = colorMap(keys, theme, spec.colors);
    colorOf = (p) => cmap.get(p.k) || theme.other;
    if (keys.length > 1) legend = keys.map((k) => ({ label: k, color: cmap.get(k) }));
  } else if (valueF && values.length) {
    const vmin = lo(values), vmax = hi(values);
    const mid = spec.midpoint ?? (spec.diverging ? 0 : undefined);
    let stops, at;
    if (mid !== undefined) {
      const dev = Math.max(Math.abs(vmax - mid), Math.abs(vmin - mid)) || 1;
      stops = theme.diverging;
      at = (v) => 0.5 + (v - mid) / dev / 2;
      legend = [{ type: 'ramp', stops, min: fv(mid - dev), max: fv(mid + dev), title: spec.legendTitle ?? humanize(valueF) }];
    } else {
      // La rampa de fábrica pierde sus tonos más claros (u oscuros, en el tema oscuro), que se
      // perderían sobre el mapa; una escala pedida (colorScale/cmap/ramp) se usa completa.
      const own = theme.cmap || spec.ramp || spec.colorScale || spec.cmap || spec.colormap;
      stops = own ? theme.sequential.slice(1) : theme.sequential.slice(dark ? 3 : 2);
      at = (v) => (v - vmin) / (vmax - vmin || 1);
      legend = [{ type: 'ramp', stops, min: fv(vmin), max: fv(vmax), title: spec.legendTitle ?? humanize(valueF) }];
    }
    colorOf = (p) => (Number.isFinite(p.v) ? ramp(stops, at(p.v)) : theme.other);
  } else {
    const one = (typeof spec.color === 'string' && !named(spec.color) && spec.color) || (spec.colors && typeof spec.colors === 'string' && spec.colors) || theme.categorical[0];
    colorOf = () => one;
  }
  if (spec.legend === false) legend = [];

  const W = spec.width || 720;
  const frame = createFrame(spec, theme, { height: Math.round(W * 0.8) });
  let area = frame.layout(legend);

  // Radios: área proporcional a `size` (raíz cuadrada), o uno fijo según la densidad.
  const maxS = sizes.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
  const wk = Math.max(0.6, Math.min(1.2, area.w / 672));
  const rMax = sizeF && maxS ? spec.maxRadius ?? Math.round((n <= 40 ? 22 : n <= 150 ? 15 : n <= 600 ? 10 : 6) * wk) : 0;
  const rBase = spec.radius ?? (dense ? 2.2 : n > 500 ? 3 : n > 120 ? 4 : 5.5);
  const rOf = (p) => (rMax ? (Number.isFinite(p.s) ? Math.max(dense ? 1.5 : 2.5, Math.sqrt(Math.abs(p.s) / maxS) * rMax) : 2) : rBase);
  const rTop = rMax || rBase;

  // Extensión de los datos en Mercator.
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of pts) { if (p.mx < x0) x0 = p.mx; if (p.mx > x1) x1 = p.mx; if (p.my < y0) y0 = p.my; if (p.my > y1) y1 = p.my; }
  const spanX = x1 - x0, spanY = y1 - y0;
  const tiny = 1e-9;
  // Alto del mapa según la forma de los datos (si el agente no fijó `height`).
  if (spec.height === undefined) {
    const aspect = spanX > tiny || spanY > tiny ? spanY / Math.max(spanX, tiny) : 0.62;
    const ratio = clamp(aspect, W < 560 ? 0.8 : 0.56, W < 560 ? 1.15 : 0.92);
    frame.setHeight(area.y + area.w * ratio + frame.chrome);
    area = { ...area, h: frame.bottom - area.y };
  }
  const box = { x: area.x, y: area.y, w: area.w, h: area.h };

  // Zoom (fraccionario) que encuadra los datos con margen para círculos y etiquetas.
  const padX = Math.max(26, rTop + 12), padT = Math.max(30, rTop + 20), padB = Math.max(26, rTop + 12) + (rMax ? 0 : 6);
  const availW = Math.max(40, box.w - 2 * padX), availH = Math.max(40, box.h - padT - padB);
  const maxZ = provider ? provider.maxZoom ?? 19 : 19;
  let z;
  if (Number.isFinite(+spec.zoom) && spec.zoom !== null && spec.zoom !== '') z = clamp(+spec.zoom, 0, 22);
  else if (spanX < tiny && spanY < tiny) z = 12;
  else z = Math.min(17, maxZ, Math.log2(Math.min(spanX > tiny ? availW / (spanX * TILE) : Infinity, spanY > tiny ? availH / (spanY * TILE) : Infinity)));
  z = Math.max(z, Math.log2(box.h / TILE), 0); // el mundo llena el alto: nunca hay franjas vacías arriba o abajo
  const k = TILE * 2 ** z;
  // Centro: el de los datos (o `center`), en el centro del área útil; sin salirse del mundo en vertical.
  let mcx, mcy;
  if (Array.isArray(spec.center) && spec.center.length >= 2 && spec.center.every((v) => Number.isFinite(+v))) {
    let lon = +spec.center[0];
    if (unwrapped && lon < 0) lon += 360;
    mcx = mercX(lon); mcy = mercY(+spec.center[1]);
  } else { mcx = (x0 + x1) / 2; mcy = (y0 + y1) / 2; }
  const cxp = box.x + box.w / 2;
  let cyp = box.y + padT + availH / 2;
  {
    const top = mcy - (cyp - box.y) / k, bottom = mcy + (box.y + box.h - cyp) / k;
    if (top < 0) mcy -= top; else if (bottom > 1) mcy -= bottom - 1;
  }
  const P = (mx, my) => [cxp + (mx - mcx) * k, cyp + (my - mcy) * k];
  const proj = ([lon, lat]) => P(mercX(lon), mercY(lat));
  for (const p of pts) [p.x, p.y] = P(p.mx, p.my);
  const view = { mx0: mcx - (cxp - box.x) / k, mx1: mcx + (box.x + box.w - cxp) / k, my0: mcy - (cyp - box.y) / k, my1: mcy + (box.y + box.h - cyp) / k };

  const gid = chartId(spec, 'pm');
  const defs = [];
  const layer = [];
  // 1) Agua (tinte del tema) y respaldo vectorial: se ve si las teselas no cargan.
  layer.push(el('rect', { x: box.x, y: box.y, width: box.w, height: box.h, fill: theme.tint }));
  const world = worldGeo();
  if (world) {
    const land = dark ? mix(theme.tint, theme.tint2 || theme.tint, 0.6) : theme.surface;
    const offsets = [0, ...(view.mx0 < 0 ? [-1] : []), ...(view.mx1 > 1 ? [1] : [])];
    const lon0 = lonOf(view.mx0), lon1 = lonOf(view.mx1), latT = latOf(clamp(view.my0, 0, 1)), latB = latOf(clamp(view.my1, 0, 1));
    const copies = offsets.map((o) => {
      const paths = [];
      for (const f of world.features) {
        if (!f || !f.geometry) continue;
        const b = lonLatBox(f);
        if (b[2] + 360 * o < lon0 || b[0] + 360 * o > lon1 || b[3] < latB || b[1] > latT) continue;
        const d = pathD(f.geometry, proj);
        if (d) paths.push(el('path', { d, fill: land, stroke: theme.axis, strokeWidth: 0.6, strokeLinejoin: 'round' }));
      }
      return paths.length ? g(o ? { transform: `translate(${Math.round(o * k * 100) / 100},0)` } : {}, paths) : '';
    });
    layer.push(g({ class: 'pa-basemap', 'pointer-events': 'none' }, copies));
  }
  // 2) Teselas.
  let tileCount = 0;
  if (provider) {
    let zt = clamp(Math.round(z), provider.minZoom ?? 0, maxZ);
    let grid;
    for (;;) {
      const N = 2 ** zt;
      const tx0 = Math.floor(view.mx0 * N), tx1 = Math.floor(view.mx1 * N - tiny);
      const ty0 = Math.max(0, Math.floor(view.my0 * N)), ty1 = Math.min(N - 1, Math.floor(view.my1 * N - tiny));
      grid = { N, tx0, tx1, ty0, ty1 };
      if ((tx1 - tx0 + 1) * (ty1 - ty0 + 1) <= MAX_TILES || zt <= 0) break;
      zt--;
    }
    const { N, tx0, tx1, ty0, ty1 } = grid;
    const ts = k / N;
    const imgs = [];
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const [x, y] = P(tx / N, ty / N);
      const wx = ((tx % N) + N) % N;
      // +0,5 px: sin costuras entre teselas al escalar.
      imgs.push(el('image', { class: 'pa-tile', href: tileUrl(provider, zt, wx, ty), x, y, width: ts + 0.5, height: ts + 0.5, preserveAspectRatio: 'none' }));
    }
    tileCount = imgs.length;
    if (muted) defs.push(tileFilter(`${gid}-tf`, theme, provider, box));
    const op = spec.tileOpacity !== undefined && Number.isFinite(+spec.tileOpacity) ? clamp(+spec.tileOpacity, 0, 1) : null;
    layer.push(g({ class: 'pa-tiles', 'pointer-events': 'none', filter: muted ? `url(#${gid}-tf)` : null, opacity: op }, imgs));
    // Velo del color de fondo: en el tema oscuro funde las teselas con la superficie.
    if (muted && dark) layer.push(el('rect', { x: box.x, y: box.y, width: box.w, height: box.h, fill: theme.surface, opacity: 0.16, 'pointer-events': 'none' }));
  }

  // 3) Puntos: grandes abajo, chicos encima; los fuera de foco, al fondo.
  const ring = theme.surface;
  const sorted = [...pts].sort((a, b) => focus(a) - focus(b) || rOf(b) - rOf(a));
  const circles = sorted.map((p) => {
    const c = focus(p) ? colorOf(p) : theme.dim;
    const lines = [p.name || `${deg(p.lat, 'N', 'S', locale)}, ${deg(p.lon > 180 ? p.lon - 360 : p.lon, 'E', en ? 'W' : 'O', locale)}`];
    if (hueF) lines.push(`${humanize(hueF)}: ${p.k}`);
    if (sizeF && Number.isFinite(p.s)) lines.push(`${humanize(sizeF)}: ${fs(p.s)}`);
    if (valueF && Number.isFinite(p.v)) lines.push(`${humanize(valueF)}: ${fv(p.v)}`);
    return { class: 'pa-m', cx: p.x, cy: p.y, r: rOf(p), fill: c, fillOpacity: !focus(p) ? 0.75 : dense ? 0.6 : rMax ? 0.82 : 0.92, stroke: dense ? 'none' : ring, strokeWidth: dense ? null : rMax ? 1.25 : 1.5, 'data-tip': tip(...lines), 'data-color': c };
  });
  layer.push(g({ class: 'pa-points' }, dotLayer(circles)));

  // 4) Leyenda de tamaños (círculos anidados) en una tarjeta abajo a la izquierda.
  const obstacles = [];
  const overlay = [];
  const fsz = 10.5;
  if (rMax && spec.legend !== false) {
    const vs = [...new Set([niceDown(maxS), niceDown(maxS / 4), niceDown(maxS / 16)])].filter((v) => v > 0);
    const items = vs.map((v) => ({ v, r: Math.max(2.5, Math.sqrt(v / maxS) * rMax), s: fs(v) }));
    const title = humanize(sizeF);
    const labW = Math.max(...items.map((it) => measure(it.s, fsz))) * 1.06;
    // Rótulos separados al menos 11 px (de abajo hacia arriba), con línea guía.
    const gap = 11.5;
    const rel = [...items].sort((a, b) => a.r - b.r).map((it) => ({ ...it, top: 2 * it.r, ly: 2 * it.r }));
    for (let i = 1; i < rel.length; i++) rel[i].ly = Math.max(rel[i].ly, rel[i - 1].ly + gap);
    const above = Math.max(2 * rMax, ...rel.map((it) => it.ly + 4));
    const cw = Math.max(16 + 2 * rMax + 16 + labW, measure(title, fsz, 600) * 1.06 + 16);
    const ch = above + 32;
    const lx = box.x + 8, ly = box.y + box.h - ch - 8;
    const cx = lx + 8 + rMax, base = ly + ch - 8;
    const parts = [el('rect', { x: lx, y: ly, width: cw, height: ch, rx: 6, fill: theme.surface, fillOpacity: 0.88 }), text(lx + 8, ly + 15, title, { fill: theme.lede, fontSize: fsz, fontWeight: 600 })];
    for (const it of rel) parts.push(el('circle', { cx, cy: base - it.r, r: it.r, fill: 'none', stroke: theme.muted, strokeWidth: 0.8 }));
    for (const it of rel) {
      const yT = base - it.top, yL = base - it.ly;
      parts.push(el('path', { d: `M${cx},${yT}H${cx + rMax + 3}L${cx + rMax + 10},${yL}`, fill: 'none', stroke: theme.muted, strokeWidth: 0.5 }));
      parts.push(text(cx + rMax + 13, yL + 3.6, it.s, { fill: theme.lede, fontSize: fsz }));
    }
    overlay.push(g({ class: 'pa-legend pa-size-legend', 'pointer-events': 'none' }, parts));
    obstacles.push([lx, ly, lx + cw, ly + ch]);
  }

  // 5) Atribución: siempre, abajo a la derecha, con enlace a la licencia.
  const attrText = provider ? provider.attribution : world ? 'Natural Earth' : '';
  if (attrText) {
    const af = 9.5;
    // Ancho con holgura (la fuente real puede ser más ancha que la medida); el texto se ancla a la derecha.
    const aw = measure(attrText, af) * 1.08 + 12;
    const ax = box.x + box.w - aw - 4, ay = box.y + box.h - 19;
    const inner = [el('rect', { x: ax, y: ay, width: aw, height: 15, rx: 3, fill: theme.surface, fillOpacity: 0.82 }), text(ax + aw - 6, ay + 11, attrText, { fill: dark ? theme.muted : theme.lede, fontSize: af, textAnchor: 'end' })];
    const link = provider ? provider.link : 'https://www.naturalearthdata.com/';
    overlay.push(g({ class: 'pa-attribution' }, link ? el('a', { href: link, target: '_blank', rel: 'noopener' }, inner) : inner));
    obstacles.push([ax, ay, ax + aw, ay + 15]);
  }

  // 6) Etiquetas: las mayores (o las pedidas), con halo y sin choques.
  const labs = [];
  if (labelF && spec.labels !== false) {
    let chosen;
    if (Array.isArray(spec.labels)) { const want = new Set(spec.labels.map(String)); chosen = pts.filter((p) => want.has(p.name)); }
    else {
      const def = dense ? 0 : rMax ? Math.min(8, n) : valueF ? Math.min(5, n) : n <= 15 ? n : 0;
      const nLab = typeof spec.labels === 'number' ? spec.labels : hl ? 0 : def;
      const rank = rMax ? (p) => Math.abs(p.s) || 0 : valueF ? (p) => (Number.isFinite(p.v) ? p.v : -Infinity) : () => 0;
      chosen = [...pts].sort((a, b) => rank(b) - rank(a)).slice(0, nLab);
      if (hl) chosen = [...new Set([...pts.filter((p) => hl.has(p.name) || hl.has(p.k)), ...chosen])];
    }
    const showVal = spec.labelValues !== false && (rMax || valueF);
    const placed = [...obstacles];
    if (n <= 400) for (const p of pts) { const r = rOf(p); if (r >= 3.5 || chosen.includes(p)) placed.push([p.x - r * 0.7, p.y - r * 0.7, p.x + r * 0.7, p.y + r * 0.7]); }
    const halo = { stroke: theme.surface, strokeWidth: 3, strokeOpacity: 0.92, paintOrder: 'stroke', strokeLinejoin: 'round' };
    const fl = 11.5;
    for (const p of chosen) {
      if (!p.name) continue;
      const r = rOf(p);
      const val = showVal ? (rMax ? (Number.isFinite(p.s) ? fs(p.s) : '') : Number.isFinite(p.v) ? fv(p.v) : '') : '';
      const w = measure(p.name, fl, 600) + (val ? measure(' ' + val, fl - 1) : 0);
      // Derecha, izquierda, arriba o abajo del punto; dentro del mapa y sin pisar otra etiqueta.
      const cands = [
        { box: [p.x + r + 3, p.y - 7, p.x + r + 5 + w, p.y + 7], x: p.x + r + 4, y: p.y + 4, anchor: 'start' },
        { box: [p.x - r - 5 - w, p.y - 7, p.x - r - 3, p.y + 7], x: p.x - r - 4, y: p.y + 4, anchor: 'end' },
        { box: [p.x - w / 2 - 2, p.y - r - 18, p.x + w / 2 + 2, p.y - r - 3], x: p.x, y: p.y - r - 6, anchor: 'middle' },
        { box: [p.x - w / 2 - 2, p.y + r + 3, p.x + w / 2 + 2, p.y + r + 18], x: p.x, y: p.y + r + 14, anchor: 'middle' },
      ];
      const own = (b) => b[0] >= p.x - r * 0.7 - 0.01 && b[2] <= p.x + r * 0.7 + 0.01 && b[1] >= p.y - r * 0.7 - 0.01 && b[3] <= p.y + r * 0.7 + 0.01;
      const others = placed.filter((b) => !own(b));
      const inside = (b) => b[0] >= box.x + 2 && b[2] <= box.x + box.w - 2 && b[1] >= box.y + 2 && b[3] <= box.y + box.h - 2;
      const c = cands.find((cd) => inside(cd.box) && !hits(cd.box, others));
      if (!c) continue;
      placed.push(c.box);
      const kids = [esc(p.name)];
      if (val) kids.push(el('tspan', { fill: theme.lede, fontWeight: 400, fontSize: fl - 1 }, esc(' ' + val)));
      labs.push(el('text', { x: c.x, y: c.y, fill: theme.ink, fontSize: fl, fontWeight: 600, textAnchor: c.anchor, ...halo }, kids));
    }
  }
  if (labs.length) layer.push(g({ class: 'pa-map-label pa-zoom-hide', 'pointer-events': 'none' }, labs));

  // Capa con recorte y zoom (la misma estructura que choropleth: interact.js la reconoce).
  const zb = [box.x, box.y, box.w, box.h].map((v) => Math.round(v * 10) / 10);
  defs.push(el('clipPath', { id: `${gid}-clip` }, el('rect', { x: zb[0], y: zb[1], width: zb[2], height: zb[3], rx: 6 })));
  const body = [
    g({ class: 'pa-zoom-clip pa-pointmap', 'clip-path': `url(#${gid}-clip)` }, [
      el('rect', { x: zb[0], y: zb[1], width: zb[2], height: zb[3], fill: 'transparent' }),
      g({ class: 'pa-zoom', 'data-zoom': zb.join(',') }, layer),
    ]),
    ...overlay,
  ];

  const desc = describePointmap({ pts, n, provider, world, hueF, keys, sizeF, valueF, fs, fv, locale, tileCount });
  return frame.finish(body, { desc, type: 'pointmap', defs: defs.join('') });
}

function describePointmap({ pts, n, provider, world, hueF, keys, sizeF, valueF, fs, fv, locale, tileCount }) {
  const en = String(locale).startsWith('en');
  const W = en ? 'W' : 'O';
  const lats = pts.map((p) => p.lat), lons = pts.map((p) => (p.lon > 180 ? p.lon - 360 : p.lon));
  const la0 = lo(lats), la1 = hi(lats);
  const lo0 = lo(lons), lo1 = hi(lons);
  const base = provider ? provider.name || provider.attribution : world ? (en ? 'a world outline' : 'un contorno del mundo') : '';
  const where = n === 1 || (la1 - la0 < 0.05 && lo1 - lo0 < 0.05)
    ? (en ? ` at ${deg(la0, 'N', 'S', locale)}, ${deg(lo0, 'E', W, locale)}` : ` en ${deg(la0, 'N', 'S', locale)}, ${deg(lo0, 'E', W, locale)}`)
    : en
      ? ` between latitudes ${deg(la0, 'N', 'S', locale)} and ${deg(la1, 'N', 'S', locale)} and longitudes ${deg(lo0, 'E', W, locale)} and ${deg(lo1, 'E', W, locale)}`
      : ` entre las latitudes ${deg(la0, 'N', 'S', locale)} y ${deg(la1, 'N', 'S', locale)} y las longitudes ${deg(lo0, 'E', W, locale)} y ${deg(lo1, 'E', W, locale)}`;
  let s = en ? `Map of ${n} point${n === 1 ? '' : 's'}${where}` : `Mapa de ${n} punto${n === 1 ? '' : 's'}${where}`;
  s += base ? (en ? `, over ${base}${tileCount ? ' tiles' : ''}.` : `, sobre ${tileCount ? 'teselas de ' : ''}${base}.`) : '.';
  if (sizeF) {
    const top = [...pts].filter((p) => Number.isFinite(p.s)).sort((a, b) => b.s - a.s).slice(0, 3);
    if (top.length) s += en ? ` Largest ${humanize(sizeF)}: ${top.map((p) => `${p.name || '—'} (${fs(p.s)})`).join(', ')}.` : ` Mayor ${humanize(sizeF).toLowerCase()}: ${top.map((p) => `${p.name || '—'} (${fs(p.s)})`).join(', ')}.`;
  }
  if (hueF && keys.length) {
    const c = new Map();
    for (const p of pts) c.set(p.k, (c.get(p.k) || 0) + 1);
    s += ` ${humanize(hueF)}: ${keys.slice(0, 8).map((k) => `${k} (${c.get(k)})`).join(', ')}.`;
  }
  if (valueF) {
    const vs = pts.filter((p) => Number.isFinite(p.v)).sort((a, b) => b.v - a.v);
    if (vs.length) s += en ? ` ${humanize(valueF)} from ${fv(vs.at(-1).v)} (${vs.at(-1).name || '—'}) to ${fv(vs[0].v)} (${vs[0].name || '—'}).` : ` ${humanize(valueF)} de ${fv(vs.at(-1).v)} (${vs.at(-1).name || '—'}) a ${fv(vs[0].v)} (${vs[0].name || '—'}).`;
  }
  return s;
}

// ── Incrustar teselas (para PDF, <img>, correo) ─────────────────────────────
const unesc = (s) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const hostOf = (u) => { try { return new URL(u, 'https://x.invalid/').host.toLowerCase(); } catch { return ''; } };
/** Las teselas de OpenStreetMap no se descargan en lote (política de uso de tile.openstreetmap.org). */
export const refusesPrefetch = (u) => /(^|\.)openstreetmap\.(org|fr|de)$/.test(hostOf(u));

function toBase64(buf) {
  const bytes = new Uint8Array(buf);
  if (typeof globalThis.Buffer === 'function') return globalThis.Buffer.from(bytes).toString('base64');
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return globalThis.btoa(bin);
}

/**
 * Reemplaza el href de cada tesela por un data: URI, para que el SVG se vea
 * igual como <img>, en un PDF o sin conexión. Las teselas de OpenStreetMap se
 * dejan tal cual: su política prohíbe la descarga en lote (usa "esri-gray",
 * "carto-light" o un servidor propio si necesitas incrustar).
 * Devuelve el SVG (texto). Las teselas que fallan quedan con su URL.
 */
export async function embedTiles(svg, { fetch: fetchFn = globalThis.fetch, userAgent, concurrency = 6 } = {}) {
  const src = String(svg ?? '');
  if (typeof fetchFn !== 'function') throw new PlotError('embedTiles necesita fetch (Node 18+ o un navegador), o pásalo en { fetch }.', 'await embedTiles(svg, { fetch })');
  const tagRe = /<image\b[^>]*>/g;
  const hrefRe = /\shref="([^"]*)"/;
  const urls = new Set();
  for (const tag of src.match(tagRe) || []) {
    if (!/class="[^"]*\bpa-tile\b/.test(tag)) continue;
    const m = hrefRe.exec(tag);
    if (!m) continue;
    const u = unesc(m[1]);
    if (/^data:/i.test(u) || refusesPrefetch(u)) continue;
    urls.add(u);
  }
  const out = new Map();
  const list = [...urls];
  let i = 0;
  const headers = userAgent ? { 'User-Agent': userAgent } : undefined;
  const worker = async () => {
    while (i < list.length) {
      const u = list[i++];
      try {
        const res = await fetchFn(u, headers ? { headers } : undefined);
        if (!res || !res.ok) continue;
        const type = (res.headers && typeof res.headers.get === 'function' && res.headers.get('content-type')) || (/\.jpe?g(\?|$)/i.test(u) ? 'image/jpeg' : /\.webp(\?|$)/i.test(u) ? 'image/webp' : 'image/png');
        const buf = await res.arrayBuffer();
        out.set(u, `data:${String(type).split(';')[0].trim()};base64,${toBase64(buf)}`);
      } catch { /* la tesela queda con su URL */ }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, list.length)) }, worker));
  if (!out.size) return src;
  return src.replace(tagRe, (tag) => {
    if (!/class="[^"]*\bpa-tile\b/.test(tag)) return tag;
    return tag.replace(hrefRe, (all, h) => { const d = out.get(unesc(h)); return d ? ` href="${d}"` : all; });
  });
}
