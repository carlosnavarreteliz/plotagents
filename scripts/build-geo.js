// Genera las geometrías simplificadas que trae plotagents (sin dependencias).
//   node scripts/build-geo.js --world countries-110m.json --chile Regional.geojson
// - Mundo: world-atlas 2.0.2 (Natural Earth 1:110m, dominio público), TopoJSON.
// - Chile: regiones de la Biblioteca del Congreso Nacional (BCN, mapas
//   vectoriales), vía github.com/fcortes/Chile-GeoJSON.
// - Estados Unidos: us-atlas 3.0.1 (ISC), límites cartográficos del U.S.
//   Census Bureau 1:10m (dominio público), TopoJSON states-10m.json.
//     node scripts/build-geo.js --usa states-10m.json
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const q = (v) => Math.round(v * 100) / 100;

// ── TopoJSON → GeoJSON ────────────────────────────────────────────────────
function topoToGeo(topo, objName) {
  const { scale, translate } = topo.transform || { scale: [1, 1], translate: [0, 0] };
  const arcs = topo.arcs.map((arc) => {
    let x = 0, y = 0;
    return arc.map(([dx, dy]) => { x += dx; y += dy; return [x * scale[0] + translate[0], y * scale[1] + translate[1]]; });
  });
  const ring = (idx) => {
    const out = [];
    idx.forEach((i, k) => {
      const a = i < 0 ? [...arcs[~i]].reverse() : arcs[i];
      out.push(...(k ? a.slice(1) : a));
    });
    return out;
  };
  const geom = (g) => {
    if (g.type === 'Polygon') return { type: 'Polygon', coordinates: g.arcs.map(ring) };
    if (g.type === 'MultiPolygon') return { type: 'MultiPolygon', coordinates: g.arcs.map((p) => p.map(ring)) };
    return null;
  };
  return topo.objects[objName].geometries.map((g) => ({ id: g.id, properties: g.properties || {}, geometry: geom(g) })).filter((f) => f.geometry);
}

// ── Simplificación (Douglas–Peucker) y área ───────────────────────────────
function dp(pts, tol) {
  if (pts.length < 4) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let md = 0, mi = -1;
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1e-12;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / L;
      if (d > md) { md = d; mi = i; }
    }
    if (md > tol) { keep[mi] = 1; stack.push([a, mi], [mi, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
const ringArea = (r) => { let s = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) s += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]); return Math.abs(s / 2); };
const centroidLon = (r) => r.reduce((a, p) => a + p[0], 0) / r.length;
// Anillo cerrado: se parte en el punto más lejano del inicio y se simplifica cada mitad.
function dpRing(r, tol) {
  if (r.length < 5) return r;
  let far = 1, fd = -1;
  for (let i = 1; i < r.length - 1; i++) { const d = (r[i][0] - r[0][0]) ** 2 + (r[i][1] - r[0][1]) ** 2; if (d > fd) { fd = d; far = i; } }
  const a = dp(r.slice(0, far + 1), tol), b = dp(r.slice(far), tol);
  return [...a, ...b.slice(1)];
}
function cleanRing(r, tol) {
  const s = tol ? dpRing(r, tol) : r;
  const out = [];
  for (const p of s) { const qp = [q(p[0]), q(p[1])]; const l = out[out.length - 1]; if (!l || l[0] !== qp[0] || l[1] !== qp[1]) out.push(qp); }
  if (out.length && (out[0][0] !== out[out.length - 1][0] || out[0][1] !== out[out.length - 1][1])) out.push(out[0]);
  return out.length >= 4 ? out : null;
}
function polygons(geom) { return geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates; }
function toGeom(polys) { return polys.length === 1 ? { type: 'Polygon', coordinates: polys[0] } : { type: 'MultiPolygon', coordinates: polys }; }

// ── Mundo ─────────────────────────────────────────────────────────────────
// numérico ISO 3166-1 → [alfa-3, nombre en español]
const ISO = {
  4: ['AFG', 'Afganistán'], 8: ['ALB', 'Albania'], 10: ['ATA', 'Antártida'], 12: ['DZA', 'Argelia'], 24: ['AGO', 'Angola'], 31: ['AZE', 'Azerbaiyán'], 32: ['ARG', 'Argentina'], 36: ['AUS', 'Australia'], 40: ['AUT', 'Austria'], 44: ['BHS', 'Bahamas'], 50: ['BGD', 'Bangladés'], 51: ['ARM', 'Armenia'], 56: ['BEL', 'Bélgica'], 64: ['BTN', 'Bután'], 68: ['BOL', 'Bolivia'], 70: ['BIH', 'Bosnia y Herzegovina'], 72: ['BWA', 'Botsuana'], 76: ['BRA', 'Brasil'], 84: ['BLZ', 'Belice'], 90: ['SLB', 'Islas Salomón'], 96: ['BRN', 'Brunéi'], 100: ['BGR', 'Bulgaria'], 104: ['MMR', 'Myanmar'], 108: ['BDI', 'Burundi'], 112: ['BLR', 'Bielorrusia'], 116: ['KHM', 'Camboya'], 120: ['CMR', 'Camerún'], 124: ['CAN', 'Canadá'], 140: ['CAF', 'República Centroafricana'], 144: ['LKA', 'Sri Lanka'], 148: ['TCD', 'Chad'], 152: ['CHL', 'Chile'], 156: ['CHN', 'China'], 158: ['TWN', 'Taiwán'], 170: ['COL', 'Colombia'], 178: ['COG', 'Congo'], 180: ['COD', 'República Democrática del Congo'], 188: ['CRI', 'Costa Rica'], 191: ['HRV', 'Croacia'], 192: ['CUB', 'Cuba'], 196: ['CYP', 'Chipre'], 203: ['CZE', 'Chequia'], 204: ['BEN', 'Benín'], 208: ['DNK', 'Dinamarca'], 214: ['DOM', 'República Dominicana'], 218: ['ECU', 'Ecuador'], 222: ['SLV', 'El Salvador'], 226: ['GNQ', 'Guinea Ecuatorial'], 231: ['ETH', 'Etiopía'], 232: ['ERI', 'Eritrea'], 233: ['EST', 'Estonia'], 238: ['FLK', 'Islas Malvinas'], 242: ['FJI', 'Fiyi'], 246: ['FIN', 'Finlandia'], 250: ['FRA', 'Francia'], 260: ['ATF', 'Tierras Australes Francesas'], 262: ['DJI', 'Yibuti'], 266: ['GAB', 'Gabón'], 268: ['GEO', 'Georgia'], 270: ['GMB', 'Gambia'], 275: ['PSE', 'Palestina'], 276: ['DEU', 'Alemania'], 288: ['GHA', 'Ghana'], 300: ['GRC', 'Grecia'], 304: ['GRL', 'Groenlandia'], 320: ['GTM', 'Guatemala'], 324: ['GIN', 'Guinea'], 328: ['GUY', 'Guyana'], 332: ['HTI', 'Haití'], 340: ['HND', 'Honduras'], 348: ['HUN', 'Hungría'], 352: ['ISL', 'Islandia'], 356: ['IND', 'India'], 360: ['IDN', 'Indonesia'], 364: ['IRN', 'Irán'], 368: ['IRQ', 'Irak'], 372: ['IRL', 'Irlanda'], 376: ['ISR', 'Israel'], 380: ['ITA', 'Italia'], 384: ['CIV', 'Costa de Marfil'], 388: ['JAM', 'Jamaica'], 392: ['JPN', 'Japón'], 398: ['KAZ', 'Kazajistán'], 400: ['JOR', 'Jordania'], 404: ['KEN', 'Kenia'], 408: ['PRK', 'Corea del Norte'], 410: ['KOR', 'Corea del Sur'], 414: ['KWT', 'Kuwait'], 417: ['KGZ', 'Kirguistán'], 418: ['LAO', 'Laos'], 422: ['LBN', 'Líbano'], 426: ['LSO', 'Lesoto'], 428: ['LVA', 'Letonia'], 430: ['LBR', 'Liberia'], 434: ['LBY', 'Libia'], 440: ['LTU', 'Lituania'], 442: ['LUX', 'Luxemburgo'], 450: ['MDG', 'Madagascar'], 454: ['MWI', 'Malaui'], 458: ['MYS', 'Malasia'], 466: ['MLI', 'Malí'], 478: ['MRT', 'Mauritania'], 484: ['MEX', 'México'], 496: ['MNG', 'Mongolia'], 498: ['MDA', 'Moldavia'], 499: ['MNE', 'Montenegro'], 504: ['MAR', 'Marruecos'], 508: ['MOZ', 'Mozambique'], 512: ['OMN', 'Omán'], 516: ['NAM', 'Namibia'], 524: ['NPL', 'Nepal'], 528: ['NLD', 'Países Bajos'], 540: ['NCL', 'Nueva Caledonia'], 548: ['VUT', 'Vanuatu'], 554: ['NZL', 'Nueva Zelanda'], 558: ['NIC', 'Nicaragua'], 562: ['NER', 'Níger'], 566: ['NGA', 'Nigeria'], 578: ['NOR', 'Noruega'], 586: ['PAK', 'Pakistán'], 591: ['PAN', 'Panamá'], 598: ['PNG', 'Papúa Nueva Guinea'], 600: ['PRY', 'Paraguay'], 604: ['PER', 'Perú'], 608: ['PHL', 'Filipinas'], 616: ['POL', 'Polonia'], 620: ['PRT', 'Portugal'], 624: ['GNB', 'Guinea-Bisáu'], 626: ['TLS', 'Timor Oriental'], 630: ['PRI', 'Puerto Rico'], 634: ['QAT', 'Catar'], 642: ['ROU', 'Rumania'], 643: ['RUS', 'Rusia'], 646: ['RWA', 'Ruanda'], 682: ['SAU', 'Arabia Saudita'], 686: ['SEN', 'Senegal'], 688: ['SRB', 'Serbia'], 694: ['SLE', 'Sierra Leona'], 703: ['SVK', 'Eslovaquia'], 704: ['VNM', 'Vietnam'], 705: ['SVN', 'Eslovenia'], 706: ['SOM', 'Somalia'], 710: ['ZAF', 'Sudáfrica'], 716: ['ZWE', 'Zimbabue'], 724: ['ESP', 'España'], 728: ['SSD', 'Sudán del Sur'], 729: ['SDN', 'Sudán'], 732: ['ESH', 'Sahara Occidental'], 740: ['SUR', 'Surinam'], 748: ['SWZ', 'Esuatini'], 752: ['SWE', 'Suecia'], 756: ['CHE', 'Suiza'], 760: ['SYR', 'Siria'], 762: ['TJK', 'Tayikistán'], 764: ['THA', 'Tailandia'], 768: ['TGO', 'Togo'], 780: ['TTO', 'Trinidad y Tobago'], 784: ['ARE', 'Emiratos Árabes Unidos'], 788: ['TUN', 'Túnez'], 792: ['TUR', 'Turquía'], 795: ['TKM', 'Turkmenistán'], 800: ['UGA', 'Uganda'], 804: ['UKR', 'Ucrania'], 807: ['MKD', 'Macedonia del Norte'], 818: ['EGY', 'Egipto'], 826: ['GBR', 'Reino Unido'], 834: ['TZA', 'Tanzania'], 840: ['USA', 'Estados Unidos'], 854: ['BFA', 'Burkina Faso'], 858: ['URY', 'Uruguay'], 860: ['UZB', 'Uzbekistán'], 862: ['VEN', 'Venezuela'], 887: ['YEM', 'Yemen'], 894: ['ZMB', 'Zambia'],
};
const EXTRA = { 'N. Cyprus': ['CYN', 'Chipre del Norte'], Somaliland: ['SOL', 'Somalilandia'], Kosovo: ['XKX', 'Kosovo'] };
const EN_ALIAS = { 'United States of America': ['United States', 'USA', 'US', 'EE.UU.', 'EEUU', 'Estados Unidos de América'], 'Dem. Rep. Congo': ['Democratic Republic of the Congo', 'DR Congo', 'RD Congo'], 'Dominican Rep.': ['Dominican Republic'], 'Central African Rep.': ['Central African Republic'], 'Eq. Guinea': ['Equatorial Guinea'], 'Bosnia and Herz.': ['Bosnia and Herzegovina'], 'S. Sudan': ['South Sudan'], 'W. Sahara': ['Western Sahara'], 'Falkland Is.': ['Falkland Islands', 'Malvinas'], 'Solomon Is.': ['Solomon Islands'], 'Macedonia': ['North Macedonia'], 'eSwatini': ['Eswatini', 'Swaziland', 'Suazilandia'], "Côte d'Ivoire": ['Ivory Coast'], Czechia: ['Czech Republic', 'República Checa'], 'United Kingdom': ['UK', 'Great Britain', 'Gran Bretaña', 'Inglaterra'], Russia: ['Russian Federation', 'Federación Rusa'], 'South Korea': ['Korea, Republic of', 'Corea'], 'North Korea': ["Korea, Dem. People's Rep."], Myanmar: ['Birmania', 'Burma'], Netherlands: ['Holanda', 'Holland'], Iran: ['Persia'] };

function buildWorld(path) {
  const topo = JSON.parse(readFileSync(path, 'utf8'));
  const feats = topoToGeo(topo, 'countries').map((f) => {
    const nameEn = f.properties.name;
    const num = f.id === undefined ? null : +f.id;
    const [iso3, es] = (num !== null && ISO[num]) || EXTRA[nameEn] || [null, nameEn];
    const polys = polygons(f.geometry).map((p) => p.map((r) => cleanRing(r, 0.02)).filter(Boolean)).filter((p) => p.length);
    return { type: 'Feature', properties: { id: num, iso3, name: es, nameEn, aliases: EN_ALIAS[nameEn] || [] }, geometry: toGeom(polys) };
  });
  return { type: 'FeatureCollection', features: feats };
}

// ── Chile ─────────────────────────────────────────────────────────────────
const REG = {
  15: ['XV', 'Arica y Parinacota', ['Arica', 'Región de Arica y Parinacota'], 1],
  1: ['I', 'Tarapacá', ['Region de Tarapaca'], 2],
  2: ['II', 'Antofagasta', [], 3],
  3: ['III', 'Atacama', [], 4],
  4: ['IV', 'Coquimbo', [], 5],
  5: ['V', 'Valparaíso', [], 6],
  13: ['XIII', 'Metropolitana', ['RM', 'Región Metropolitana', 'Región Metropolitana de Santiago', 'Santiago', 'Metropolitana de Santiago', 'R.M.'], 7],
  6: ['VI', "O'Higgins", ["Libertador General Bernardo O'Higgins", "Libertador Bernardo O'Higgins", 'OHiggins', 'O’Higgins', "Bernardo O'Higgins"], 8],
  7: ['VII', 'Maule', [], 9],
  16: ['XVI', 'Ñuble', ['Nuble'], 10],
  8: ['VIII', 'Biobío', ['Bío-Bío', 'Bío Bío', 'Bio Bio', 'Biobio', 'Del Biobío'], 11],
  9: ['IX', 'Araucanía', ['La Araucanía', 'Araucania'], 12],
  14: ['XIV', 'Los Ríos', ['Los Rios'], 13],
  10: ['X', 'Los Lagos', [], 14],
  11: ['XI', 'Aysén', ['Aisén', 'Aysen', "Aysén del General Carlos Ibáñez del Campo", 'Aysén del Gral. Ibáñez del Campo'], 15],
  12: ['XII', 'Magallanes', ['Magallanes y de la Antártica Chilena', 'Magallanes y Antártica Chilena', 'Magallanes y la Antártica Chilena'], 16],
};
function buildChile(path) {
  const g = JSON.parse(readFileSync(path, 'utf8'));
  const feats = [];
  for (const f of g.features) {
    const code = f.properties.codregion;
    if (!REG[code]) continue; // "Zona sin demarcar"
    const [roman, name, aliases, order] = REG[code];
    let polys = polygons(f.geometry)
      .filter((p) => centroidLon(p[0]) > -77) // fuera: Isla de Pascua, Juan Fernández, islas oceánicas
      .map((p) => [p[0]]) // sin agujeros: a esta escala no se ven
      .map((p) => ({ p, a: ringArea(p[0]) }))
      .sort((a, b) => b.a - a.a);
    const maxA = polys[0].a;
    polys = polys.filter((o, i) => i === 0 || o.a > Math.max(0.02, maxA * 0.008)).map((o) => o.p);
    const clean = polys.map((p) => p.map((r) => cleanRing(r, 0.018)).filter(Boolean)).filter((p) => p.length);
    feats.push({ type: 'Feature', properties: { code: roman, num: code, name, aliases: [`Región de ${name}`, `Región del ${name}`, roman, `Región ${roman}`, String(code), f.properties.Region, ...aliases], order }, geometry: toGeom(clean) });
  }
  feats.sort((a, b) => a.properties.order - b.properties.order);
  return { type: 'FeatureCollection', features: feats };
}

// ── Estados Unidos ────────────────────────────────────────────────────────
// FIPS → [postal, nombre en español (si difiere del inglés)]
const US = {
  1: ['AL'], 2: ['AK'], 4: ['AZ'], 5: ['AR'], 6: ['CA'], 8: ['CO'], 9: ['CT'], 10: ['DE'], 11: ['DC', 'Distrito de Columbia'], 12: ['FL', 'Florida'],
  13: ['GA'], 15: ['HI', 'Hawái'], 16: ['ID'], 17: ['IL'], 18: ['IN'], 19: ['IA'], 20: ['KS'], 21: ['KY'], 22: ['LA', 'Luisiana'], 23: ['ME'],
  24: ['MD'], 25: ['MA'], 26: ['MI', 'Míchigan'], 27: ['MN'], 28: ['MS', 'Misisipi'], 29: ['MO', 'Misuri'], 30: ['MT'], 31: ['NE'], 32: ['NV'],
  33: ['NH', 'Nuevo Hampshire'], 34: ['NJ', 'Nueva Jersey'], 35: ['NM', 'Nuevo México'], 36: ['NY', 'Nueva York'], 37: ['NC', 'Carolina del Norte'],
  38: ['ND', 'Dakota del Norte'], 39: ['OH'], 40: ['OK'], 41: ['OR', 'Oregón'], 42: ['PA', 'Pensilvania'], 44: ['RI'], 45: ['SC', 'Carolina del Sur'],
  46: ['SD', 'Dakota del Sur'], 47: ['TN'], 48: ['TX', 'Texas'], 49: ['UT'], 50: ['VT'], 51: ['VA'], 53: ['WA'], 54: ['WV', 'Virginia Occidental'],
  55: ['WI'], 56: ['WY'], 72: ['PR', 'Puerto Rico'],
};
// Estados chicos del noreste: su etiqueta va afuera, con línea guía.
const US_CALLOUT = new Set(['VT', 'NH', 'MA', 'RI', 'CT', 'NJ', 'DE', 'MD', 'DC']);
// Punto de anclaje de la etiqueta cuando el centroide queda mal (forma rara o recuadro).
const US_LABEL_AT = { FL: [-81.6, 28.3], LA: [-92.4, 31.0], MI: [-84.7, 43.5], CA: [-119.7, 37.1], KY: [-85.1, 37.6], VA: [-78.7, 37.6], NY: [-75.3, 42.9], ID: [-114.6, 43.9], AK: [-152, 64.3], HI: [-155.5, 19.65], TN: [-86.4, 35.85], WV: [-80.7, 38.65], OK: [-97.4, 35.5], TX: [-99.2, 31.3], MN: [-94.4, 46.1], NC: [-79.3, 35.6], MD: [-76.8, 39.3], PR: [-66.5, 18.2] };
const US_ALIAS = { DC: ['Washington DC', 'Washington, D.C.', 'D.C.'], NY: ['New York State'], PR: ['Puerto Rico, Commonwealth of'], GA: ['Georgia (US)'] };
function buildUsa(path) {
  const topo = JSON.parse(readFileSync(path, 'utf8'));
  const feats = [];
  for (const f of topoToGeo(topo, 'states')) {
    const fips = +f.id;
    if (!US[fips]) continue; // sin territorios del Pacífico ni Islas Vírgenes
    const [code, es] = US[fips];
    const nameEn = f.properties.name;
    // Alaska: fuera las Aleutianas que cruzan el antimeridiano (lon > 0) y los islotes.
    let polys = polygons(f.geometry)
      .filter((p) => centroidLon(p[0]) < 0)
      .map((p) => [p[0]])
      .map((p) => ({ p, a: ringArea(p[0]) }))
      .sort((a, b) => b.a - a.a);
    const maxA = polys[0].a;
    const minA = code === 'AK' ? maxA * 0.004 : code === 'HI' ? maxA * 0.02 : Math.max(0.004, maxA * 0.004);
    polys = polys.filter((o, i) => i === 0 || o.a > minA).map((o) => o.p);
    const tol = code === 'AK' ? 0.06 : code === 'HI' || code === 'PR' ? 0.008 : US_CALLOUT.has(code) ? 0.006 : 0.016;
    const clean = polys.map((p) => p.map((r) => cleanRing(r, tol)).filter(Boolean)).filter((p) => p.length);
    const fipsS = String(fips).padStart(2, '0');
    const name = es || nameEn;
    feats.push({ type: 'Feature', properties: { code, fips: fipsS, num: fips, name, nameEn, abbr: code, ...(US_CALLOUT.has(code) ? { callout: true } : {}), ...(US_LABEL_AT[code] ? { labelAt: US_LABEL_AT[code] } : {}), ...(code === 'PR' ? { optional: true } : {}), aliases: [...new Set([nameEn, fipsS, `US-${code}`, `State of ${nameEn}`, `Estado de ${name}`, ...(US_ALIAS[code] || [])])].filter((a) => a !== name) }, geometry: toGeom(clean) });
  }
  feats.sort((a, b) => a.properties.nameEn.localeCompare(b.properties.nameEn));
  return { type: 'FeatureCollection', projection: 'albersUsa', features: feats };
}

// Codificación compacta: cada anillo es un arreglo plano de enteros (×100)
// con deltas; se decodifica al cargar el módulo (~3× más liviano que JSON).
function encodeRing(r) {
  const out = [];
  let px = 0, py = 0;
  for (const [x, y] of r) { const ix = Math.round(x * 100), iy = Math.round(y * 100); out.push(ix - px, iy - py); px = ix; py = iy; }
  return out;
}
const DECODE = `function decode(fc) {
  const ring = (a) => { const r = []; let x = 0, y = 0; for (let i = 0; i < a.length; i += 2) { x += a[i]; y += a[i + 1]; r.push([x / 100, y / 100]); } return r; };
  for (const f of fc.features) {
    const g = f.geometry;
    g.coordinates = g.type === 'Polygon' ? g.coordinates.map(ring) : g.coordinates.map((p) => p.map(ring));
  }
  return fc;
}
`;
const out = (file, fc, attribution) => {
  mkdirSync(join(root, 'src/geo/data'), { recursive: true });
  const enc = { type: 'FeatureCollection', ...(fc.projection ? { projection: fc.projection } : {}), features: fc.features.map((f) => ({ type: 'Feature', properties: f.properties, geometry: { type: f.geometry.type, coordinates: f.geometry.type === 'Polygon' ? f.geometry.coordinates.map(encodeRing) : f.geometry.coordinates.map((p) => p.map(encodeRing)) } })) };
  const body = `// Generado por scripts/build-geo.js — no editar a mano.\n// ${attribution}\nexport const attribution = ${JSON.stringify(attribution)};\n${DECODE}export default decode(${JSON.stringify(enc)});\n`;
  writeFileSync(join(root, 'src/geo/data', file), body);
  console.log(`${file}: ${fc.features.length} entidades · ${(body.length / 1024).toFixed(0)} kB`);
};
const w = arg('--world'), c = arg('--chile'), u = arg('--usa');
if (w) out('world.js', buildWorld(w), 'Natural Earth 1:110m (dominio público), vía world-atlas 2.0.2 (ISC).');
if (c) out('chile-regiones.js', buildChile(c), 'Regiones de Chile: Biblioteca del Congreso Nacional (BCN), mapas vectoriales, vía github.com/fcortes/Chile-GeoJSON. Simplificado; sin territorios insulares oceánicos.');
if (u) out('usa-estados.js', buildUsa(u), 'Estados de EE. UU.: U.S. Census Bureau, límites cartográficos 1:10m (dominio público), vía us-atlas 3.0.1 (ISC). Simplificado; Alaska, Hawái y Puerto Rico en recuadros.');
