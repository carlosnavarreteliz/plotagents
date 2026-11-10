// Mapas: coroplético (color por valor) y de símbolos (círculos proporcionales).
// Geometrías por nombre registrado ('chile', 'usa', 'world') o GeoJSON propio.
// Países alargados como Chile se dibujan a la izquierda con una columna de
// etiquetas (nombre, barra y valor) ordenada de norte a sur; mapas anchos
// usan todo el ancho con etiquetas solo donde importan. Los estados de EE. UU.
// llevan su sigla (y el valor, si cabe); los chicos del noreste, afuera con
// línea guía. En el navegador: zoom con clic, rueda (+ Ctrl/⌘) o pellizco.
import { binnedScale } from '../colorscales.js';
import { el, g, text } from '../svg.js';
import { measure, truncate } from '../text.js';
import { makeFormat } from '../format.js';
import { ramp, textOn, colorMap } from '../theme.js';
import { ensureData, requireField, num, fieldsOf, fieldKind, humanize, aggregate, PlotError } from '../data.js';
import { createFrame, hash } from '../frame.js';
import { niceStep } from '../scale.js';
import { getGeo } from '../geo/registry.js';
import { mercator, equalEarth, planar, projections, makeProjection, fit, aspectOf, pathD, centroid, rings, isPointGeom, isLineGeom } from '../geo/projection.js';
import { dashedMatcher, hatcher, dashedAttrs, dashedDefaultLabel, DASH } from '../dashed.js';

const T = (locale, es, en) => (String(locale || 'es').startsWith('en') ? en : es);

/** Normaliza nombres para que "Región del Bío-Bío", "Biobio" y "BIOBÍO" coincidan. */
export function normKey(s) {
  return String(s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/^\s*(region|provincia|comuna)\s+(metropolitana\s+de\s+)?(de\s+la\s+|del\s+|de\s+los\s+|de\s+las\s+|de\s+)?/, (m, a, metro) => (metro ? 'metropolitana' : ''))
    .replace(/[^a-z0-9]/g, '')
    .replace(/^0+(?=\d)/, ''); // códigos con cero a la izquierda: "08" = 8, "004" = 4
}

function featureIndex(features, featureKey) {
  const idx = new Map();
  const add = (k, f) => { const n = normKey(k); if (n && !idx.has(n)) idx.set(n, f); };
  for (const f of features) {
    const p = f.properties || {};
    if (featureKey) { add(featureKey === 'id' && p.id === undefined ? f.id : p[featureKey], f); continue; }
    if (f.id !== undefined && f.id !== null) add(f.id, f);
    for (const k of ['code', 'num', 'id', 'iso3', 'iso_a3', 'name', 'nameEn', 'NAME', 'nombre']) if (p[k] !== undefined && p[k] !== null) add(p[k], f);
    for (const a of p.aliases || []) add(a, f);
  }
  return idx;
}

const nameOf = (f, locale) => {
  const p = f.properties || {};
  return (String(locale).startsWith('en') ? p.nameEn || p.name : p.name || p.nameEn) || p.NAME || p.nombre || String(p.code ?? p.id ?? f.id ?? '');
};

// Propiedades que suelen traer el nombre en GeoJSON de otras fuentes (INE, IGM, Natural Earth, GADM, censos).
const NAME_PROPS = ['name', 'nameEn', 'NAME', 'nombre', 'Nombre', 'NOMBRE', 'name_en', 'NAME_EN', 'NAME_1', 'NAME_2', 'NAME_3', 'ADMIN', 'admin', 'NOM_REG', 'NOM_REGION', 'Region', 'REGION', 'region', 'NOM_PROV', 'NOM_COM', 'NOM_COMUNA', 'COMUNA', 'Comuna', 'comuna', 'provincia', 'PROVINCIA', 'label', 'title', 'NAMELSAD', 'GEN', 'NUTS_NAME', 'shapeName'];
const primitive = (v) => typeof v === 'string' || typeof v === 'number';

/**
 * GeoJSON ajeno: busca la propiedad cuyos valores calzan con más filas de
 * los datos (p. ej. "CUT_REG", "NOM_COM" o "GEOID"). Devuelve null si
 * ninguna mejora lo que ya calzaba.
 */
function bestProperty(features, keys, already) {
  const want = new Set(keys.map(normKey).filter(Boolean));
  if (!want.size) return null;
  const props = new Set();
  for (const f of features.slice(0, 80)) for (const [k, v] of Object.entries(f.properties || {})) if (primitive(v)) props.add(k);
  let best = null, bestN = already;
  for (const k of props) {
    let n = 0;
    const seen = new Set(features.map((f) => normKey(f.properties?.[k])));
    for (const w of want) if (seen.has(w)) n++;
    if (n > bestN) { best = k; bestN = n; }
  }
  return best;
}

/** Copia las features con `name` resuelto (nameKey explícito o adivinado). */
function withNames(features, nameKey) {
  return features.map((f) => {
    const p = f.properties || {};
    const v = p[nameKey];
    return primitive(v) && p.name !== v ? { ...f, properties: { ...p, name: String(v) } } : f;
  });
}

/** Redondeo "bonito" de un corte de clase (2 cifras relativas al rango). */
function niceRound(v, range) {
  if (!range) return v;
  const step = 10 ** (Math.floor(Math.log10(range)) - 1);
  return Math.round(v / step) * step;
}

function quantile(sorted, p) {
  const h = (sorted.length - 1) * p, lo = Math.floor(h), hi = Math.ceil(h);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (h - lo);
}

/** Escala de color: clases (cuantiles, intervalos iguales o cortes dados) o continua. */
export function colorScale(values, spec, theme) {
  const v = values.filter(Number.isFinite).sort((a, b) => a - b);
  const min = v[0], max = v[v.length - 1], range = max - min;
  // `colorScale: { colors, breaks }`: las clases las fija quien llama.
  const bins = binnedScale(spec);
  if (bins) return classed(bins.breaks, bins.colors, min, max);
  const mid = spec.midpoint ?? (spec.diverging ? 0 : undefined);
  const mode = Array.isArray(spec.scale) || Array.isArray(spec.thresholds) ? 'thresholds' : spec.scale || 'quantile';
  if (mid !== undefined) {
    const stops = theme.diverging;
    const dev = Math.max(Math.abs(max - mid), Math.abs(min - mid)) || 1;
    if (mode === 'continuous') return { mode, min: mid - dev, max: mid + dev, mid, color: (x) => ramp(stops, 0.5 + (x - mid) / dev / 2), stops };
    // Clases simétricas: el paso "bonito" más chico que cubre la desviación
    // con a lo más `classes/2` clases por lado (sin cortes fuera de los datos).
    const perSide = Math.max(2, Math.floor((spec.classes ?? 6) / 2));
    const mag = 10 ** Math.floor(Math.log10(dev / perSide));
    const step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((st) => Math.ceil(dev / st - 1e-9) <= perSide) || 10 * mag;
    const k = Math.max(1, Math.ceil(dev / step - 1e-9));
    const breaks = Array.from({ length: 2 * k - 1 }, (_, j) => +(mid + step * (j + 1 - k)).toPrecision(12));
    const n = 2 * k;
    const colors = Array.from({ length: n }, (_, i) => ramp(stops, 0.5 + ((i + 0.5 - k) / k) * 0.5));
    // Extremos simétricos (mid ± k·paso): la leyenda se lee igual hacia ambos lados.
    return { ...classed(breaks, colors, Math.min(min, +(mid - k * step).toPrecision(12)), Math.max(max, +(mid + k * step).toPrecision(12))), mid };
  }
  const stops = theme.sequential;
  if (mode === 'continuous') return { mode, min, max, color: (x) => ramp(stops.slice(1), (x - min) / (range || 1)), stops: stops.slice(1) };
  let breaks;
  if (mode === 'thresholds') breaks = [...(Array.isArray(spec.scale) ? spec.scale : spec.thresholds)].map(Number).sort((a, b) => a - b);
  else {
    const n = Math.max(2, Math.min(9, spec.classes ?? Math.min(5, v.length)));
    if (mode === 'equal') breaks = Array.from({ length: n - 1 }, (_, k) => niceRound(min + (range * (k + 1)) / n, range));
    else breaks = Array.from({ length: n - 1 }, (_, k) => niceRound(quantile(v, (k + 1) / n), range));
    breaks = [...new Set(breaks)].filter((b) => b > min && b <= max);
  }
  const n = breaks.length + 1;
  const t0 = theme.cmap ? 0 : theme.mode === 'dark' ? 0.26 : 0.16;
  const colors = Array.from({ length: n }, (_, i) => ramp(stops, n === 1 ? 0.6 : t0 + ((1 - t0) * i) / (n - 1)));
  return classed(breaks, colors, min, max);
}

function classed(breaks, colors, min, max) {
  const cls = (x) => { let i = 0; while (i < breaks.length && x >= breaks[i]) i++; return i; };
  return { mode: 'classes', breaks, colors, min, max, cls, color: (x) => colors[cls(x)] };
}

/** Leyenda escalonada (o degradado), pegada al mapa. Devuelve { svg, h }. */
function legendBar(sc, x, y, maxW, theme, fmt, { title, missing, locale, gid, dashed }) {
  const out = [];
  let lx = x;
  const size = theme.type?.axis ?? 11.5;
  if (title) {
    const tw = Math.min(measure(title, 12, 500), maxW * 0.4);
    out.push(text(lx, y + 13, truncate(title, tw, 12, 500), { fill: theme.lede, fontSize: 12, fontWeight: 500 }));
    lx += tw + 12;
  }
  // Anchos con su separación: cuadro + texto (+ espacio hasta la siguiente clave).
  const missW = missing ? measure(T(locale, 'Sin dato', 'No data'), size) + 14 + (dashed ? 14 : 0) : 0;
  const dashW = dashed ? measure(dashed.label, size) + 16 : 0;
  // Si "Sin dato" y la clave punteada no caben junto a la escala, bajan a una segunda fila.
  const extra = missW + dashW ? 14 + missW + dashW : 0;
  const wrapX = 140 + extra > x + maxW - lx;
  const barW = Math.max(120, Math.min(360, x + maxW - lx - (wrapX ? 0 : extra)));
  const by = y + 4;
  if (sc.mode === 'classes') {
    const n = sc.colors.length, gap = 2;
    const sw = (barW - gap * (n - 1)) / n;
    // Cada clase es una clave conectada: al pasar encima se destacan sus regiones.
    sc.colors.forEach((c, i) => out.push(g({ class: 'pa-key', 'data-color': c, style: 'cursor:pointer' }, [
      el('rect', { x: lx + i * (sw + gap), y: by - 4, width: sw + gap, height: 18, fill: 'transparent' }),
      el('rect', { x: lx + i * (sw + gap), y: by, width: sw, height: 10, rx: i === 0 || i === n - 1 ? 3 : 1, fill: c }),
    ])));
    // Etiquetas en los cortes; los extremos (mín. y máx.) en las puntas.
    // Los extremos solo se rotulan si caen fuera de los cortes (con cortes fijos, un año puede no llegar a la última clase).
    const labels = [
      ...(sc.min < sc.breaks[0] || !sc.breaks.length ? [{ x: lx, v: sc.min, anchor: 'start' }] : []),
      ...sc.breaks.map((b, i) => ({ x: lx + (i + 1) * (sw + gap) - gap / 2, v: b, anchor: 'middle' })),
      ...(sc.max >= sc.breaks[sc.breaks.length - 1] || !sc.breaks.length ? [{ x: lx + barW, v: sc.max, anchor: 'end' }] : []),
    ];
    let last = -Infinity;
    for (const L of labels) {
      const s = fmt(L.v), w = measure(s, size);
      const left = L.anchor === 'start' ? L.x : L.anchor === 'end' ? L.x - w : L.x - w / 2;
      if (left < last + 6) continue;
      out.push(text(L.x, by + 24, s, { fill: theme.muted, fontSize: size, textAnchor: L.anchor }));
      last = left + w;
    }
  } else {
    const id = gid + '-grad';
    const stops = Array.from({ length: 9 }, (_, i) => el('stop', { offset: `${i * 12.5}%`, stopColor: sc.color(sc.min + ((sc.max - sc.min) * i) / 8) }));
    out.push(el('defs', {}, el('linearGradient', { id }, stops)));
    out.push(el('rect', { x: lx, y: by, width: barW, height: 10, rx: 3, fill: `url(#${id})` }));
    out.push(text(lx, by + 24, fmt(sc.min), { fill: theme.muted, fontSize: size }));
    if (sc.mid !== undefined) out.push(text(lx + barW / 2, by + 24, fmt(sc.mid), { fill: theme.muted, fontSize: size, textAnchor: 'middle' }));
    out.push(text(lx + barW, by + 24, fmt(sc.max), { fill: theme.muted, fontSize: size, textAnchor: 'end' }));
  }
  let mx = wrapX ? x : lx + barW + 14;
  const ey = wrapX ? by + 32 : by;
  if (missing) {
    out.push(g({ class: 'pa-key', 'data-color': `url(#${gid}-nd)`, style: 'cursor:pointer' }, [
      el('rect', { x: mx, y: ey, width: 10, height: 10, rx: 2, fill: `url(#${gid}-nd)`, stroke: theme.axis, strokeWidth: 0.5 }),
      text(mx + 14, ey + 9, T(locale, 'Sin dato', 'No data'), { fill: theme.muted, fontSize: size }),
    ]));
    mx += missW;
  }
  if (dashed) {
    out.push(g({ class: 'pa-key', 'data-color': 'dashed', style: 'cursor:pointer' }, [
      el('rect', { x: mx + 0.6, y: ey + 0.6, width: 9.8, height: 9.8, rx: 2, fill: dashed.fill, stroke: dashed.stroke, strokeWidth: 1.1, strokeDasharray: DASH.legend }),
      text(mx + 15, ey + 9, dashed.label, { fill: theme.lede, fontSize: size }),
    ]));
  }
  return { svg: g({ class: 'pa-legend pa-map-legend' }, out), h: wrapX && (missing || dashed) ? 50 : 34 };
}

/** Patrón rayado para regiones sin dato. */
const noDataPattern = (id, theme) =>
  `<pattern id="${id}" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" fill="${theme.tint}"/><line x1="0" y1="0" x2="0" y2="5" stroke="${theme.muted}" stroke-width="1" stroke-opacity="0.35"/></pattern>`;

/** Datos + geometría emparejados. */
function prepare(spec, locale) {
  const fc = getGeo(spec.geo ?? 'chile', spec.geoObject);
  const data = ensureData(spec);
  const fields = fieldsOf(data);
  const key = spec.key ?? spec.region ?? spec.x ?? spec.label ?? fields.find((f) => fieldKind(data, f) === 'category');
  const valueF = spec.value ?? spec.y ?? (typeof spec.size === 'string' ? spec.size : null) ?? fields.find((f) => f !== key && fieldKind(data, f) === 'number');
  requireField(data, key, 'key');
  requireField(data, valueF, 'value');
  // Valores de texto ("Izquierda", "Derecha"…): un color por categoría.
  const categorical = spec.scale === 'categorical' || (data.length > 0 && fieldKind(data, valueF) === 'category');
  let features = fc.features.filter((f) => f && f.geometry && rings(f.geometry).length);
  if (!spec.antarctica) features = features.filter((f) => (f.properties || {}).iso3 !== 'ATA');
  if (!features.length) throw new PlotError(T(locale, 'El `geo` no tiene geometrías para dibujar.', 'The `geo` has no geometries to draw.'), T(locale, 'Pasa un GeoJSON con al menos un Feature con geometría.', 'Pass a GeoJSON with at least one Feature that has a geometry.'));
  // Nombres: `nameKey` o la primera propiedad conocida (NOMBRE, NAME_1, ADMIN…).
  const hasName = (f) => { const p = f.properties || {}; return primitive(p.name) || primitive(p.nameEn) || primitive(p.NAME) || primitive(p.nombre); };
  const firstText = () => { for (const f of features.slice(0, 20)) for (const [k, v] of Object.entries(f.properties || {})) if (typeof v === 'string' && v.trim()) return k; return null; };
  const nameKey = spec.nameKey ?? (features.length && !features.some(hasName) ? NAME_PROPS.find((k) => features.some((f) => primitive(f.properties?.[k]))) ?? spec.featureKey ?? firstText() : null);
  if (nameKey) features = withNames(features, nameKey);
  let idx = featureIndex(features, spec.featureKey);
  // Sin `featureKey`: si las filas no calzan con las claves de siempre, se busca la propiedad que sí calza.
  let autoKey = null;
  if (!spec.featureKey && data.length) {
    const keys = data.map((r) => r[key]).filter(primitive);
    const matched = keys.filter((k) => idx.has(normKey(k))).length;
    if (matched < new Set(keys.map(normKey)).size) {
      autoKey = bestProperty(features, keys, new Set(keys.filter((k) => idx.has(normKey(k))).map(normKey)).size);
      if (autoKey) for (const [k, f] of featureIndex(features, autoKey)) if (!idx.has(k)) idx.set(k, f);
      if (autoKey && !nameKey && !features.some(hasName)) features = withNames(features, autoKey), idx = new Map([...featureIndex(features, null), ...featureIndex(features, autoKey)]);
    }
  }
  // Territorios opcionales (Puerto Rico en 'usa'): solo se dibujan si hay datos para ellos.
  if (features.some((f) => f.properties?.optional)) {
    const used = new Set(data.map((r) => idx.get(normKey(r[key]))).filter(Boolean));
    features = features.filter((f) => !f.properties?.optional || used.has(f) || spec.territories === true);
    idx = featureIndex(features, spec.featureKey ?? autoKey);
    if (!spec.featureKey && autoKey) for (const [k, f] of featureIndex(features, null)) if (!idx.has(k)) idx.set(k, f);
  }
  const buckets = new Map();
  const unmatched = [];
  // La clave con que los datos nombran cada región (CUT, ISO, sigla…): va al SVG como data-key.
  const keyOf = new Map();
  for (const r of data) {
    const f = idx.get(normKey(r[key]));
    if (!f) { if (r[key] !== undefined && r[key] !== null && r[key] !== '') unmatched.push(String(r[key])); continue; }
    if (!keyOf.has(f)) keyOf.set(f, String(r[key]));
    if (!buckets.has(f)) buckets.set(f, []);
    buckets.get(f).push(categorical ? r[valueF] : num(r[valueF]));
  }
  const values = new Map();
  const mode = (vs) => { const c = new Map(); for (const v of vs) if (primitive(v) && v !== '') c.set(String(v), (c.get(String(v)) || 0) + 1); return [...c].sort((a, b) => b[1] - a[1])[0]?.[0]; };
  for (const [f, vs] of buckets) {
    const v = categorical ? mode(vs) : aggregate(vs, spec.aggregate || 'mean');
    if (categorical ? v !== undefined : Number.isFinite(v)) values.set(f, v);
  }
  if (Array.isArray(spec._unmatched)) spec._unmatched.push(...new Set(unmatched));
  // Categorías ordenadas por cuántas áreas cubren (o el orden dado en `order`).
  const count = new Map();
  for (const v of values.values()) count.set(v, (count.get(v) || 0) + 1);
  const categories = categorical ? (Array.isArray(spec.order) ? spec.order.map(String).filter((c) => count.has(c)).concat([...count.keys()].filter((c) => !spec.order.map(String).includes(c))) : [...count.keys()].sort((a, b) => count.get(b) - count.get(a))) : null;
  const ranked = categorical ? [] : [...values.entries()].sort((a, b) => b[1] - a[1]);
  const rank = new Map(ranked.map(([f], i) => [f, i + 1]));
  // Proyección: la pedida; si no, una según la geometría (coordenadas fuera de
  // lon/lat → plano cartesiano, p. ej. UTM; mundo → Equal Earth; resto → Mercator).
  const projName = typeof spec.projection === 'string' ? spec.projection : fc.projection ?? (/^(world|mundo|countries|paises|países)$/i.test(String(spec.geo)) ? 'equalEarth' : null);
  let lon0 = Infinity, lon1 = -Infinity, latMax = 0;
  for (const f of features) for (const r of rings(f.geometry)) for (const p of r) { if (p[0] < lon0) lon0 = p[0]; if (p[0] > lon1) lon1 = p[0]; if (Math.abs(p[1]) > latMax) latMax = Math.abs(p[1]); }
  const projected = Math.max(Math.abs(lon0), Math.abs(lon1)) > 180.5 || latMax > 90.5;
  let raw = makeProjection(spec.projection) ?? (projName && projections[projName] ? projections[projName]() : projected ? planar() : lon1 - lon0 > 100 ? equalEarth() : mercator());
  // Geometría ya proyectada con y hacia arriba: `identity` + `flipY` es el plano cartesiano.
  if (spec.flipY && /^(identity|none|pixels)$/i.test(String(spec.projection))) raw = planar();
  // Un cuarto de vuelta después de proyectar (Chile acostado): encuadre, zonas de
  // clic, marcadores y etiquetas quedan en el espacio de la pantalla y el texto, derecho.
  const turn = mapTurn(spec, features, raw);
  if (turn) raw = rotated(raw, turn);
  // `dashed`: por nombre de región (con los mismos alias) o por un campo de los datos.
  const dm = dashedMatcher(spec, data, key, null, normKey);
  const dashed = new Set(dm ? features.filter((f) => featureKeys(f).some((k) => dm(k))) : []);
  return { fc, features, values, rank, ranked, unmatched: [...new Set(unmatched)], key, valueF, raw, data, dashed, categorical, categories, keyOf, idx };
}

/**
 * Cuánto girar el mapa ya proyectado, en grados (horario, y hacia abajo).
 * `rotate: 90 | -90 | 180`; `orientation: "landscape"` acuesta una forma más
 * alta que ancha con el norte a la izquierda (el orden norte→sur se lee de
 * izquierda a derecha) y `"portrait"` para la que es más ancha que alta.
 */
export function mapTurn(spec, features, raw) {
  const r = Number(spec.rotate);
  if ([90, -90, 180, 270, -180].includes(r)) return r === 270 ? -90 : r === -180 ? 180 : r;
  const o = String(spec.orientation ?? '').toLowerCase();
  if (o !== 'landscape' && o !== 'portrait') return 0;
  const a = aspectOf(features, raw);
  if (o === 'landscape' && a > 1) return -90;
  if (o === 'portrait' && a < 1) return 90;
  return 0;
}

/** La proyección `raw` seguida de un giro de `deg` grados (90, -90 o 180). */
export function rotated(raw, deg) {
  const f = deg === 90 ? (p) => { const [x, y] = raw(p); return [-y, x]; }
    : deg === -90 ? (p) => { const [x, y] = raw(p); return [y, -x]; }
      : (p) => { const [x, y] = raw(p); return [-x, -y]; };
  f.continuous = raw.continuous;
  f.turn = deg;
  return f;
}

/** La clave estable de una región: la de los datos; si no tiene datos, su código, ISO o nombre. */
function regionKey(m, f, locale) {
  const p = f.properties || {};
  return m.keyOf.get(f) ?? String(p.code ?? p.iso3 ?? p.iso_a3 ?? f.id ?? nameOf(f, locale) ?? '');
}

// ── Líneas entre lugares (`links`) ─────────────────────────────────────────
//
// Una línea es una relación entre dos lugares (comercio, migración, vuelos),
// no una ruta: va curva, sin punta de flecha, de un solo color y con ancho
// proporcional al valor. Los extremos son claves de región (las mismas que
// `key`) o [lon, lat].

/** `links`: [{ from, to, value }] o { data, from, to, value, color, curveness, width: [min, max], opacity }. */
function linkList(spec, m, theme, locale) {
  const lk = spec.links;
  if (!lk) return null;
  const o = Array.isArray(lk) ? {} : lk;
  const rows = ensureData({ data: Array.isArray(lk) ? lk : lk.data || [] });
  const fields = fieldsOf(rows);
  const fromF = o.from ?? pickF(fields, ['from', 'source', 'origen', 'desde']);
  const toF = o.to ?? pickF(fields, ['to', 'target', 'destino', 'hasta']);
  const valF = o.value ?? pickF(fields, ['value', 'valor', 'weight', 'peso']);
  if (!fromF || !toF) throw new PlotError(T(locale, 'Las líneas (`links`) necesitan un origen y un destino.', 'Lines (`links`) need an origin and a destination.'), 'links: [{ from: "CHL", to: "CHN", value: 120 }]');
  const end = (v) => {
    if (Array.isArray(v) && v.length === 2 && v.every((x) => Number.isFinite(num(x)))) return { lonlat: [num(v[0]), num(v[1])], name: `${num(v[1])}, ${num(v[0])}`, key: `${num(v[0])},${num(v[1])}` };
    const f = v === undefined || v === null ? null : m.idx.get(normKey(v));
    return f ? { f, name: nameOf(f, locale), key: String(v) } : null;
  };
  const items = [];
  const unmatched = [];
  for (const r of rows) {
    const a = end(r[fromF]), b = end(r[toF]);
    if (!a || !b) { unmatched.push(String(!a ? r[fromF] : r[toF])); continue; }
    const v = valF ? num(r[valF]) : 1;
    if (valF && !(Number.isFinite(v) && v > 0)) continue;
    items.push({ a, b, v, row: r });
  }
  const w = Array.isArray(o.width) && o.width.length === 2 ? o.width.map(Number) : [0.75, 6];
  const color = (typeof o.color === 'string' && !fields.includes(o.color) && o.color) || theme.categorical[0];
  const colorF = typeof o.color === 'string' && fields.includes(o.color) ? o.color : null;
  return { items, unmatched: [...new Set(unmatched)], valF, width: w, color, colorF, curveness: Number.isFinite(+o.curveness) ? +o.curveness : 0.2, opacity: o.opacity ?? 0.7, label: o.label ?? o.legend ?? null };
}

function drawLinks(L, proj, theme, fmt, locale) {
  if (!L || !L.items.length) return '';
  const at = (e) => {
    if (e.lonlat) return proj(e.lonlat);
    const p = e.f.properties || {};
    if (p.labelAt) return proj(p.labelAt);
    const c = centroid(e.f.geometry, proj);
    return [c.x, c.y];
  };
  const maxV = Math.max(...L.items.map((i) => i.v), 1e-9);
  const f1 = (v) => Math.round(v * 10) / 10;
  const out = [];
  // Las gruesas atrás: las finas quedan encima y se pueden señalar.
  for (const it of [...L.items].sort((p, q) => q.v - p.v || (p.b.key < q.b.key ? -1 : 1))) {
    const [x0, y0] = at(it.a), [x1, y1] = at(it.b);
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy);
    if (!(len > 0.5)) continue;
    // Curva hacia la izquierda del sentido origen → destino: ida y vuelta no se pisan.
    const mx = (x0 + x1) / 2 - dy * L.curveness, my = (y0 + y1) / 2 + dx * L.curveness;
    const sw = L.valF ? Math.max(L.width[0], L.width[1] * (it.v / maxV)) : L.width[0] + 0.75;
    const c = (L.colorF && it.row[L.colorF]) || L.color;
    const tip = `${it.a.name} → ${it.b.name}` + (L.valF ? `\n${fmt(it.v)}` : '');
    out.push(el('path', { class: 'pa-m pa-link', d: `M${f1(x0)},${f1(y0)}Q${f1(mx)},${f1(my)} ${f1(x1)},${f1(y1)}`, fill: 'none', stroke: c, strokeWidth: Math.round(sw * 100) / 100, strokeLinecap: 'round', strokeOpacity: L.opacity, 'data-tip': tip, 'data-color': c, 'data-key': `${it.a.key}→${it.b.key}`, 'data-from': it.a.key, 'data-to': it.b.key }));
  }
  return g({ class: 'pa-links' }, out);
}

// ── Capas extra: marcadores (lon/lat) y GeoJSON superpuesto ─────────────────
const pickF = (fields, names) => names.find((n) => fields.includes(n));

/** `markers`: [{ lon, lat, label, value }] o { data, lon, lat, label, size, color, legend }. */
function markerList(spec, theme) {
  const mk = spec.markers;
  if (!mk) return null;
  const o = Array.isArray(mk) ? {} : mk;
  const rows = ensureData({ data: Array.isArray(mk) ? mk : mk.data || [] });
  const fields = fieldsOf(rows);
  const lonF = o.lon ?? pickF(fields, ['lon', 'lng', 'long', 'longitude', 'longitud', 'x']);
  const latF = o.lat ?? pickF(fields, ['lat', 'latitude', 'latitud', 'y']);
  const labelF = o.label ?? pickF(fields, ['label', 'name', 'nombre', 'city', 'ciudad', 'title']);
  const sizeF = o.size ?? pickF(fields, ['size', 'value', 'valor']);
  const colorF = typeof o.color === 'string' && fields.includes(o.color) ? o.color : pickF(fields, ['color']);
  const keyF = o.key ?? pickF(fields, ['key', 'id', 'code', 'codigo', 'código']);
  if (!lonF || !latF) throw new PlotError('Los marcadores necesitan longitud y latitud.', 'markers: [{ lon: -73.05, lat: -36.82, label: "Concepción" }]');
  const items = rows.map((r) => ({ lon: num(r[lonF]), lat: num(r[latF]), label: labelF ? r[labelF] : undefined, size: sizeF ? num(r[sizeF]) : NaN, color: (colorF && r[colorF]) || (typeof o.color === 'string' && !fields.includes(o.color) ? o.color : null), row: r, key: keyF && r[keyF] !== undefined && r[keyF] !== null ? String(r[keyF]) : labelF && r[labelF] !== undefined ? String(r[labelF]) : null }))
    .filter((m) => Number.isFinite(m.lon) && Number.isFinite(m.lat));
  const maxS = Math.max(0, ...items.map((m) => Math.abs(m.size)).filter(Number.isFinite));
  for (const m of items) m.r = Number.isFinite(m.size) && maxS ? Math.max(3, Math.sqrt(Math.abs(m.size) / maxS) * (o.maxRadius ?? 14)) : o.radius ?? 4.5;
  return { items, color: (typeof o.color === 'string' && !fields.includes(o.color) && o.color) || theme.ink, legend: o.legend ?? o.title ?? null, labels: o.labels !== false, sizeF };
}

/** `layers`: [{ geo, stroke, fill, width, dash, opacity, label, below }]. */
function layerList(spec, theme) {
  return [].concat(spec.layers || []).filter(Boolean).map((L, i) => {
    const fc = getGeo(L.geo ?? L.data, L.object ?? L.geoObject);
    const fs = fc.features.filter((f) => f && f.geometry && rings(f.geometry).length);
    const lines = fs.every((f) => isLineGeom(f.geometry));
    return { ...L, features: fs, i, stroke: L.stroke ?? L.color ?? (lines ? theme.ink : theme.lede), width: L.width ?? L.strokeWidth ?? (lines ? 1.5 : 1), fill: L.fill ?? 'none' };
  });
}

function drawLayer(L, proj, theme, locale) {
  return g({ class: 'pa-layer', 'pointer-events': L.label || L.tooltip !== false ? null : 'none' }, L.features.map((f) => {
    const pt = isPointGeom(f.geometry);
    const nm = nameOf(f, locale);
    const tipT = [L.label, nm && nm !== String(f.id ?? '') ? nm : null].filter(Boolean).join('\n');
    return el('path', {
      class: tipT ? 'pa-m' : null, 'data-tip': tipT || null, d: pathD(f.geometry, proj, { r: L.radius ?? 3 }),
      fill: pt ? (L.fill !== 'none' ? L.fill : L.stroke) : L.fill, fillOpacity: L.fillOpacity ?? null,
      stroke: pt ? theme.surface : L.stroke, strokeWidth: pt ? 1 : L.width, strokeDasharray: L.dash === true ? '5 4' : L.dash || null,
      strokeLinejoin: 'round', strokeLinecap: 'round', opacity: L.opacity ?? null, 'data-color': L.stroke,
    });
  }));
}

function drawMarkers(mk, proj, theme, fmt, placed) {
  const dots = [], labs = [];
  const halo = { stroke: theme.surface, strokeWidth: 3, paintOrder: 'stroke', strokeLinejoin: 'round' };
  for (const m of [...mk.items].sort((a, b) => b.r - a.r)) {
    const [x, y] = proj([m.lon, m.lat]);
    m.x = x; m.y = y;
    const c = m.color || mk.color;
    const tipT = [m.label, Number.isFinite(m.size) && mk.sizeF ? fmt(m.size) : null].filter((v) => v !== undefined && v !== null && v !== '').join('\n');
    dots.push(el('circle', { class: 'pa-m', cx: x, cy: y, r: m.r, fill: c, fillOpacity: m.r > 6 ? 0.8 : 1, stroke: theme.surface, strokeWidth: 1.5, 'data-tip': tipT || null, 'data-color': c, 'data-key': m.key }));
  }
  for (const m of mk.items) placed.push([m.x - m.r - 2, m.y - m.r - 2, m.x + m.r + 2, m.y + m.r + 2]);
  if (mk.labels) for (const m of mk.items) {
    if (m.label === undefined || m.label === null || m.label === '') continue;
    const w = measure(String(m.label), 11, 600);
    const hit = (box) => placed.some((b) => !(box[2] < b[0] || box[0] > b[2] || box[3] < b[1] || box[1] > b[3]));
    // A la derecha del punto; si choca, a la izquierda; si no, encima.
    const cands = [
      { box: [m.x + m.r + 3, m.y - 8, m.x + m.r + 6 + w, m.y + 8], x: m.x + m.r + 4, y: m.y + 4, anchor: 'start' },
      { box: [m.x - m.r - 6 - w, m.y - 8, m.x - m.r - 3, m.y + 8], x: m.x - m.r - 4, y: m.y + 4, anchor: 'end' },
      { box: [m.x - w / 2 - 2, m.y - m.r - 20, m.x + w / 2 + 2, m.y - m.r - 3], x: m.x, y: m.y - m.r - 7, anchor: 'middle' },
    ];
    const c = cands.find((k) => !hit(k.box));
    if (!c) continue;
    placed.push(c.box);
    labs.push(text(c.x, c.y, String(m.label), { fill: theme.ink, fontSize: 11, fontWeight: 600, textAnchor: c.anchor, ...halo }));
  }
  return [g({ class: 'pa-markers' }, dots), g({ class: 'pa-map-label pa-marker-labels', 'pointer-events': 'none' }, labs)];
}

/** Leyenda de categorías (mapas con valores de texto): cuadros enlazados con las regiones. */
function catLegend(sc, x, y, maxW, theme, { title, missing, locale, gid, dashed }) {
  const out = [];
  const size = theme.type?.axis ?? 11.5;
  let lx = x, ly = y, rows = 1;
  if (title) { out.push(text(lx, ly + 9.5, title, { fill: theme.lede, fontSize: 12, fontWeight: 500 })); lx += measure(title, 12, 500) + 14; }
  const item = (label, attrs, key) => {
    const w = 14 + measure(label, size) + 16;
    if (lx + w > x + maxW && lx > x) { lx = x; ly += 20; rows++; }
    out.push(g({ class: 'pa-key', 'data-color': key, style: 'cursor:pointer' }, [
      el('rect', { x: lx, y: ly, width: 10, height: 10, rx: 2, ...attrs }),
      text(lx + 14, ly + 9, label, { fill: theme.lede, fontSize: size }),
    ]));
    lx += w;
  };
  for (const c of sc.cats) item(c, { fill: sc.color(c) }, sc.color(c));
  if (missing) item(T(locale, 'Sin dato', 'No data'), { fill: `url(#${gid}-nd)`, stroke: theme.axis, strokeWidth: 0.5 }, `url(#${gid}-nd)`);
  if (dashed) item(dashed.label, { fill: dashed.fill, stroke: dashed.stroke, strokeWidth: 1.1, strokeDasharray: DASH.legend }, 'dashed');
  return { svg: g({ class: 'pa-legend pa-map-legend' }, out), h: rows * 20 + 2 };
}

/**
 * Columna de etiquetas para mapas altos: una fila por región a la altura de
 * su centroide (separadas si chocan), con línea guía, barra y valor.
 */
function labelColumn(items, x, y0, y1, w, theme, fmt, { bars = true, maxV }) {
  const out = [];
  const n = items.length;
  const rowH = Math.max(12.5, Math.min(18, (y1 - y0) / Math.max(1, n)));
  const fs = rowH < 14 ? 10.5 : 11.5;
  // Separación vertical (orden norte → sur se conserva).
  const rows = items.map((it) => ({ ...it, y: it.cy })).sort((a, b) => a.cy - b.cy);
  for (let i = 0; i < rows.length; i++) rows[i].y = Math.max(rows[i].y, i ? rows[i - 1].y + rowH : y0 + rowH / 2);
  for (let i = rows.length - 1; i >= 0; i--) { const lim = i === rows.length - 1 ? y1 - rowH / 2 : rows[i + 1].y - rowH; if (rows[i].y > lim) rows[i].y = lim; }
  for (let i = 0; i < rows.length; i++) if (rows[i].y < y0 + rowH / 2 + i * rowH) rows[i].y = y0 + rowH / 2 + i * rowH;
  const nameW = Math.min(w * (bars ? 0.46 : 0.68), Math.max(...rows.map((r) => measure(r.name, fs))));
  const valW = Math.max(...rows.map((r) => measure(r.label, fs, 600)));
  const barX = x + nameW + 8;
  const diverging = rows.some((r) => r.v < 0);
  const barMax = Math.max(0, w - nameW - valW * (diverging ? 2 : 1) - (diverging ? 26 : 18));
  const showBars = bars && barMax >= 36;
  const negMax = diverging ? Math.max(0, ...rows.filter((r) => r.v < 0).map((r) => -r.v)) : 0;
  const posMax = Math.max(0, ...rows.filter((r) => r.v > 0).map((r) => r.v));
  // Con valores negativos, eje en cero y barras hacia ambos lados.
  const zeroX = diverging ? barX + valW + 6 + (barMax * negMax) / (negMax + posMax || 1) : barX;
  const scaleW = diverging ? barMax / (negMax + posMax || 1) : barMax / (maxV || 1);
  if (showBars && diverging) out.push(el('line', { x1: zeroX, x2: zeroX, y1: y0, y2: y1, stroke: theme.axis, strokeWidth: 1 }));
  for (const r of rows) {
    const parts = [];
    // Línea guía: horizontal desde el centroide y quiebre suave a la fila.
    parts.push(el('path', { d: `M${r.cx.toFixed(1)},${r.cy.toFixed(1)}L${(x - 14).toFixed(1)},${r.cy.toFixed(1)}L${(x - 4).toFixed(1)},${r.y.toFixed(1)}`, fill: 'none', stroke: theme.muted, strokeWidth: 0.6, opacity: 0.55 }));
    parts.push(el('circle', { cx: r.cx, cy: r.cy, r: 1.8, fill: theme.ink, opacity: 0.7 }));
    parts.push(text(x, r.y + fs * 0.36, truncate(r.name, nameW, fs), { fill: r.missing ? theme.muted : theme.lede, fontSize: fs }));
    if (r.missing) parts.push(text(showBars ? barX : x + nameW + 8, r.y + fs * 0.36, r.label, { fill: theme.muted, fontSize: fs }));
    else if (showBars) {
      const bw = Math.max(2, Math.abs(r.v) * scaleW);
      const bx = r.v < 0 ? zeroX - bw : zeroX;
      parts.push(el('rect', { x: bx, y: r.y - 3.5, width: bw, height: 7, rx: 2, fill: r.barColor || r.color }));
      parts.push(text(r.v < 0 ? bx - 6 : bx + bw + 6, r.y + fs * 0.36, r.label, { fill: theme.ink, fontSize: fs, fontWeight: 600, textAnchor: r.v < 0 ? 'end' : 'start' }));
    } else parts.push(text(x + nameW + 8, r.y + fs * 0.36, r.label, { fill: theme.ink, fontSize: fs, fontWeight: 600 }));
    out.push(g({ class: 'pa-m', 'data-tip': r.tip }, parts));
  }
  return out;
}

/** Etiquetas sobre el mapa (mapas anchos): solo las elegidas y sin choques. */
function mapLabels(items, theme, placedBoxes = [], bounds = null) {
  const out = [];
  for (const it0 of items) {
    const w = Math.max(measure(it0.name, 11, 600), measure(it0.label, 11));
    // Dentro del área: un rótulo junto al borde (Arica en un Chile acostado) se corre hacia adentro.
    const it = bounds ? { ...it0, cx: Math.max(bounds.x + w / 2 + 2, Math.min(bounds.x + bounds.w - w / 2 - 2, it0.cx)) } : it0;
    const box = [it.cx - w / 2 - 2, it.cy - 13, it.cx + w / 2 + 2, it.cy + 13];
    if (placedBoxes.some((b) => !(box[2] < b[0] || box[0] > b[2] || box[3] < b[1] || box[1] > b[3]))) continue;
    placedBoxes.push(box);
    const halo = { stroke: theme.surface, strokeWidth: 3, paintOrder: 'stroke', strokeLinejoin: 'round', textAnchor: 'middle' };
    out.push(g({ class: 'pa-map-label', 'pointer-events': 'none' }, [
      text(it.cx, it.cy - 2, it.name, { fill: theme.ink, fontSize: 11, fontWeight: 600, ...halo }),
      text(it.cx, it.cy + 11, it.label, { fill: theme.lede, fontSize: 11, ...halo }),
    ]));
  }
  return out;
}

function chooseLabeled(m, spec, locale, defaultN) {
  const hl = spec.highlight === undefined ? [] : [].concat(spec.highlight).map(normKey);
  const isHl = (f) => hl.length && featureIndexHas(f, hl);
  if (Array.isArray(spec.labels)) { const want = spec.labels.map(normKey); return m.features.filter((f) => featureIndexHas(f, want)); }
  const n = typeof spec.labels === 'number' ? spec.labels : spec.labels === false ? 0 : defaultN;
  const top = m.ranked.slice(0, n).map(([f]) => f);
  return [...new Set([...m.features.filter(isHl), ...top])];
}
function featureKeys(f) {
  const p = f.properties || {};
  return [p.code, p.num, p.id, p.iso3, p.fips, p.name, p.nameEn, ...(p.aliases || [])].filter((v) => v !== undefined && v !== null).map(normKey);
}
function featureIndexHas(f, keys) {
  const own = featureKeys(f);
  return keys.some((k) => own.includes(k));
}

/**
 * Siglas sobre el mapa (estados de EE. UU. u otra geometría con `abbr`): la
 * sigla va dentro si cabe, con el valor debajo cuando hay espacio. Las
 * marcadas `callout` (estados chicos) van en una columna a la derecha con
 * línea guía, ordenadas por altura.
 */
function abbrLabels(items, proj, theme, { calloutX, showValues, top, bottom }) {
  const inside = [], callouts = [];
  const fs = Math.max(8.5, Math.min(11, proj.bounds.w / 62));
  for (const it of items) {
    const p = it.f.properties || {};
    if (!p.abbr) continue;
    const at = p.labelAt ? proj(p.labelAt) : [it.cx, it.cy];
    if (p.callout && calloutX) { callouts.push({ ...it, ax: it.cx, ay: it.cy }); continue; }
    const s = Math.sqrt(it.area);
    const aw = measure(p.abbr, fs, 600);
    if (aw + 3 > s * 0.95) {
      // Islas chicas (Hawái, Puerto Rico): la sigla al lado, fuera de la forma.
      if (!proj.inset || !proj.inset(p.labelAt || it.f.geometry && rings(it.f.geometry)[0][0])) continue;
      let x1 = -Infinity;
      for (const r of rings(it.f.geometry)) for (const pt of r) x1 = Math.max(x1, proj(pt)[0]);
      inside.push(text(x1 + 5, at[1] + fs * 0.36, p.abbr, { fill: theme.lede, fontSize: fs, fontWeight: 600 }));
      continue;
    }
    const ink = it.dashedShape ? theme.ink : textOn(it.color, theme);
    const val = showValues && !it.missing && s > fs * 3.4 && measure(it.label, fs - 1) + 4 < s * 0.92;
    const y0 = at[1] + (val ? -1 : fs * 0.36);
    const halo = it.dashedShape ? { stroke: theme.surface, strokeWidth: 2.5, paintOrder: 'stroke', strokeLinejoin: 'round' } : {};
    inside.push(text(at[0], y0, p.abbr, { fill: ink, fontSize: fs, fontWeight: 600, textAnchor: 'middle', ...halo }));
    if (val) inside.push(text(at[0], y0 + fs + 0.5, it.label, { fill: ink, fontSize: fs - 1, textAnchor: 'middle', opacity: 0.88, ...halo }));
  }
  const out = [g({ class: 'pa-map-label pa-zoom-hide', 'pointer-events': 'none' }, inside)];
  if (callouts.length) {
    const rowH = fs + 5.5;
    const rows = callouts.sort((a, b) => a.ay - b.ay).map((c) => ({ ...c, y: c.ay }));
    for (let i = 0; i < rows.length; i++) rows[i].y = Math.max(rows[i].y, i ? rows[i - 1].y + rowH : top + rowH / 2);
    for (let i = rows.length - 1; i >= 0; i--) { const lim = i === rows.length - 1 ? bottom - rowH / 2 : rows[i + 1].y - rowH; if (rows[i].y > lim) rows[i].y = lim; }
    const parts = rows.map((r) => {
      const p = r.f.properties;
      const ax = r.ax.toFixed(1), ay = r.ay.toFixed(1);
      return g({ class: 'pa-m', 'data-tip': r.tip, 'data-color': r.color }, [
        el('path', { d: `M${ax},${ay}L${(calloutX - 12).toFixed(1)},${r.y.toFixed(1)}L${(calloutX - 3).toFixed(1)},${r.y.toFixed(1)}`, fill: 'none', stroke: theme.muted, strokeWidth: 0.6, opacity: 0.7 }),
        el('circle', { cx: ax, cy: ay, r: 1.6, fill: theme.ink, opacity: 0.75 }),
        el('rect', { x: calloutX, y: r.y - 4.5, width: 9, height: 9, rx: 2, ...(r.dashedShape ? { fill: r.fill, stroke: r.stroke, strokeWidth: 1, strokeDasharray: DASH.legend } : { fill: r.missing ? r.fill : r.color }) }),
        text(calloutX + 13, r.y + fs * 0.36, p.abbr, { fill: theme.ink, fontSize: fs, fontWeight: 600 }),
        showValues ? text(calloutX + 18 + measure(p.abbr, fs, 600), r.y + fs * 0.36, r.label, { fill: theme.lede, fontSize: fs }) : '',
      ]);
    });
    out.push(g({ class: 'pa-callouts pa-zoom-hide' }, parts));
  }
  return out;
}

/** Recuadros (Alaska, Hawái, Puerto Rico): un marco fino y discontinuo. */
function insetFrames(features, proj, theme) {
  if (!proj.inset) return '';
  const boxes = new Map();
  for (const f of features) for (const r of rings(f.geometry)) {
    const k = proj.inset(r[0]);
    if (!k) continue;
    const b = boxes.get(k) || [Infinity, Infinity, -Infinity, -Infinity];
    for (const pt of r) { const [x, y] = proj(pt); b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y); }
    boxes.set(k, b);
  }
  const pad = 7;
  return g({ class: 'pa-insets', 'pointer-events': 'none' }, [...boxes.values()].map((b) => el('rect', { x: b[0] - pad, y: b[1] - pad, width: b[2] - b[0] + 2 * pad, height: b[3] - b[1] + 2 * pad, rx: 6, fill: 'none', stroke: theme.axis, strokeWidth: 0.8, strokeDasharray: '2 3' })));
}

function baseChart(spec, theme, kind) {
  const locale = spec.locale || 'es';
  const m = prepare(spec, locale);
  if (m.categorical && kind === 'symbol') throw new PlotError(T(locale, `"${m.valueF}" tiene texto, no números: un mapa de símbolos necesita cantidades.`, `"${m.valueF}" holds text, not numbers: a symbol map needs quantities.`), T(locale, 'Usa type: "choropleth" para colorear por categoría.', 'Use type: "choropleth" to color by category.'));
  const vals = m.categorical ? [] : [...m.values.values()];
  const numFmt = makeFormat(spec.format, locale, vals);
  const fmt = m.categorical ? (v) => (typeof v === 'number' ? numFmt(v) : String(v ?? '')) : numFmt;
  const W = spec.width || 720;
  const layers = layerList(spec, theme);
  const markers = markerList(spec, theme);
  // `fitTo`: encuadra unas regiones (nombres o códigos), una caja [lon0, lat0, lon1, lat1] o "markers".
  let fitFeats = m.features;
  if (spec.fitTo !== undefined && spec.fitTo !== null) {
    const ft = spec.fitTo;
    if (Array.isArray(ft) && ft.length === 4 && ft.every((v) => typeof v === 'number')) {
      const [a, b, c, d] = ft;
      fitFeats = [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[a, b], [c, b], [c, d], [a, d], [a, b]]] } }];
    } else if (ft === 'markers' && markers?.items.length) {
      fitFeats = [{ type: 'Feature', properties: {}, geometry: { type: 'MultiPoint', coordinates: markers.items.map((x) => [x.lon, x.lat]) } }];
    } else {
      const want = [].concat(ft).map(normKey);
      const hit = m.features.filter((f) => featureIndexHas(f, want));
      if (hit.length) fitFeats = hit;
    }
    // Un margen del 6 % para que lo encuadrado no toque el borde.
    if (fitFeats !== m.features) {
      let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
      for (const f of fitFeats) for (const r of rings(f.geometry)) for (const p of r) { a = Math.min(a, p[0]); b = Math.min(b, p[1]); c = Math.max(c, p[0]); d = Math.max(d, p[1]); }
      const px = (c - a) * 0.06 || 0.5, py = (d - b) * 0.06 || 0.5;
      fitFeats = [{ type: 'Feature', properties: {}, geometry: { type: 'MultiPoint', coordinates: [[a - px, b - py], [c + px, d + py], [a - px, d + py], [c + px, b - py]] } }];
    }
  }
  const aspect = aspectOf(fitFeats, m.raw);
  const tall = aspect > 1.6 && m.features.length <= 40 && fitFeats === m.features && spec.tall !== false;
  // Alto por defecto según la forma del territorio.
  const defH = tall ? (W < 560 ? 660 : 740) : Math.round(W * Math.min(1.1, aspect) + 150);
  const frame = createFrame(spec, theme, { height: defH });
  let area = frame.layout([]);
  const gid = 'pa-map-' + Math.abs(hash(String(spec.title) + kind + W)).toString(36);
  const missingAny = spec.missing !== 'plain' && m.features.some((f) => !m.values.has(f));
  const body = [];
  let sc = null;
  const H = hatcher(theme, gid);
  const dashedLabel = spec.dashedLabel ?? dashedDefaultLabel(locale);
  const dashedKey = m.dashed.size && spec.legend !== false ? { label: dashedLabel, fill: H.fill(theme.muted), stroke: H.stroke(theme.muted) } : null;
  if (kind === 'choropleth' && m.categorical && m.values.size) {
    const cmap = colorMap(m.categories, theme, spec.colors);
    sc = { mode: 'categories', cats: m.categories, color: (v) => cmap.get(String(v)) || theme.other };
    const lg = spec.legend === false ? { svg: '', h: 0 } : catLegend(sc, area.x, area.y, area.w, theme, { title: spec.legendTitle ?? null, missing: missingAny, locale, gid, dashed: dashedKey });
    body.push(lg.svg);
    area = { ...area, y: area.y + lg.h + 8, h: area.h - lg.h - 8 };
  } else if (kind === 'choropleth' && vals.length) {
    sc = colorScale(vals, spec, theme);
    const lg = legendBar(sc, area.x, area.y, area.w, theme, fmt.tick ? (v) => fmt(v) : fmt, { title: spec.legendTitle ?? humanize(m.valueF), missing: missingAny, locale, gid, dashed: dashedKey });
    body.push(lg.svg);
    area = { ...area, y: area.y + lg.h + 8, h: area.h - lg.h - 8 };
  }
  // Mapa de símbolos ancho: la leyenda de tamaños va arriba, en fila (abajo chocaría con Alaska o la Antártida).
  let rMax = null;
  if (kind === 'symbol') {
    const N = m.values.size;
    const wEst = area.w, hEst = wEst * Math.min(1.1, aspect);
    rMax = spec.maxRadius ?? Math.max(8, Math.min(30, Math.sqrt(tall ? (area.h / aspect) * area.h : wEst * hEst) / (tall ? 9 : N > 30 ? 22 : 16)));
  }
  let lx = area.x;
  const rowItems = [];
  if (kind === 'symbol' && !tall && vals.length) {
    const maxV = Math.max(...vals.map(Math.abs), 0) || 1;
    const size = theme.type?.axis ?? 11.5;
    const base = area.y + 2 * rMax + 2;
    for (const v of [maxV / 16, maxV / 4, maxV]) {
      const r = Math.sqrt(v / maxV) * rMax;
      rowItems.push(el('circle', { cx: lx + r, cy: base - r, r, fill: 'none', stroke: theme.muted, strokeWidth: 0.8 }));
      rowItems.push(text(lx + 2 * r + 5, base - 1, fmt(v), { fill: theme.muted, fontSize: size }));
      lx += 2 * r + 12 + measure(fmt(v), size);
    }
    lx += 10;
  }
  // Claves de las capas y marcadores con nombre (`label` / `legend`).
  {
    const size = theme.type?.axis ?? 11.5;
    const ky = rowItems.length ? area.y + 2 * (rMax || 0) - 9 : area.y + 4.6;
    for (const L of layers) {
      if (!L.label) continue;
      const pts = L.features.every((f) => isPointGeom(f.geometry)), poly = !pts && !L.features.every((f) => isLineGeom(f.geometry));
      rowItems.push(g({ class: 'pa-key', 'data-color': L.stroke, style: 'cursor:pointer' }, [
        pts ? el('circle', { cx: lx + 5, cy: ky + 4.9, r: 3.5, fill: L.fill !== 'none' ? L.fill : L.stroke })
          : poly ? el('rect', { x: lx + 0.5, y: ky + 0.5, width: 9.5, height: 9.5, rx: 2, fill: L.fill === 'none' ? 'none' : L.fill, stroke: L.stroke, strokeWidth: 1.2, strokeDasharray: L.dash === true ? '3 2' : L.dash || null })
            : el('line', { x1: lx, x2: lx + 14, y1: ky + 4.9, y2: ky + 4.9, stroke: L.stroke, strokeWidth: Math.min(3, L.width + 0.5), strokeDasharray: L.dash === true ? '4 3' : L.dash || null, strokeLinecap: 'round' }),
        text(lx + (pts || poly ? 15 : 19), ky + 8.4, L.label, { fill: theme.lede, fontSize: size }),
      ]));
      lx += (pts || poly ? 15 : 19) + measure(L.label, size) + 16;
    }
    if (markers?.legend) {
      rowItems.push(g({ class: 'pa-key', 'data-color': markers.color, style: 'cursor:pointer' }, [
        el('circle', { cx: lx + 5, cy: ky + 4.9, r: 4.5, fill: markers.color, stroke: theme.surface, strokeWidth: 1 }),
        text(lx + 15, ky + 8.4, markers.legend, { fill: theme.lede, fontSize: size }),
      ]));
      lx += 15 + measure(markers.legend, size) + 16;
    }
  }
  if (dashedKey && !(kind === 'choropleth' && (vals.length || m.categorical))) {
    const size = theme.type?.axis ?? 11.5;
    const ky = rowItems.length ? area.y + 2 * rMax - 9 : area.y + 4.6;
    rowItems.push(g({ class: 'pa-key', 'data-color': 'dashed', style: 'cursor:pointer' }, [
      el('rect', { x: lx + 0.6, y: ky, width: 9.8, height: 9.8, rx: 2, fill: dashedKey.fill, stroke: dashedKey.stroke, strokeWidth: 1.1, strokeDasharray: DASH.legend }),
      text(lx + 15, ky + 8.4, dashedLabel, { fill: theme.lede, fontSize: size }),
    ]));
  }
  if (rowItems.length) {
    const h = kind === 'symbol' && !tall ? 2 * rMax + 12 : 26;
    body.push(g({ class: 'pa-legend pa-size-legend' }, rowItems));
    area = { ...area, y: area.y + h, h: area.h - h };
  }
  // Columna de siglas para estados chicos (EE. UU.): se reserva a la derecha.
  const callouts = kind === 'choropleth' && !tall && spec.labels !== false ? m.features.filter((f) => f.properties?.callout && f.properties?.abbr) : [];
  const fsC = Math.max(8.5, Math.min(11, (area.w * 0.9) / 62));
  const calloutW = callouts.length
    ? 18 + Math.max(...callouts.map((f) => measure(f.properties.abbr, fsC, 600) + (kind === 'choropleth' && m.values.has(f) ? measure(fmt(m.values.get(f)), fsC) + 4 : 0)))
    : 0;
  // Mapa ancho: el alto se ajusta al ancho si el agente no fijó `height`.
  if (!tall && spec.height === undefined) {
    const mapH = (area.w - calloutW) * Math.min(1.1, aspect);
    frame.setHeight(area.y + mapH + frame.chrome);
    area = { ...area, h: frame.bottom - area.y };
  }
  let box;
  if (tall) {
    const colMin = W < 480 ? 0.56 : 0.5;
    let mapW = Math.min(area.w * (1 - colMin), area.h / aspect);
    box = [area.x, area.y, area.x + mapW, area.y + area.h];
  } else box = [area.x, area.y, area.x + area.w - calloutW, area.y + area.h];
  // Puntos y marcadores en el borde: margen para el círculo y su etiqueta.
  const inset = m.features.some((f) => isPointGeom(f.geometry)) ? (spec.pointRadius ?? 5) + 18 : markers?.items.length ? 12 : 0;
  const pts = m.features.some((f) => isPointGeom(f.geometry));
  if (inset) box = [box[0] + inset * (tall ? 0 : 1), box[1] + inset + (pts ? 12 : 0), box[2] - inset, box[3] - Math.min(inset, 10)];
  const proj = fit(fitFeats, m.raw, box, { align: tall ? 'left' : 'center' });
  const calloutX = calloutW ? proj.bounds.x + proj.bounds.w + 14 : 0;
  return { locale, m, vals, fmt, frame, area, gid, missingAny, body, sc, proj, tall, H, dashedLabel, calloutX, rMax, layers, markers };
}

const rankText = (r, n, locale) => (String(locale).startsWith('en') ? `#${r} of ${n}` : `${r}.º de ${n}`);

/** Capa del mapa con recorte: el navegador la escala y desplaza (zoom). */
function zoomLayer(B, children) {
  const { area, gid } = B;
  const box = [area.x, area.y, area.w, area.h].map((v) => Math.round(v * 10) / 10);
  return [
    el('clipPath', { id: `${gid}-clip` }, el('rect', { x: box[0], y: box[1] - 2, width: box[2], height: box[3] + 4 })),
    // Fondo transparente: la rueda, el arrastre y el pellizco funcionan también sobre el mar.
    g({ class: 'pa-zoom-clip', 'clip-path': `url(#${gid}-clip)` }, [el('rect', { x: box[0], y: box[1], width: box[2], height: box[3], fill: 'transparent' }), g({ class: 'pa-zoom', 'data-zoom': box.join(',') }, children)]),
  ];
}

export function choropleth(spec, theme) {
  const B = baseChart(spec, theme, 'choropleth');
  const { locale, m, fmt, frame, area, gid, body, sc, proj, tall, H, dashedLabel, calloutX, layers, markers } = B;
  const borderC = spec.borderColor ?? theme.surface, borderW = spec.borderWidth ?? 0.75;
  const ptR = spec.pointRadius ?? 5;
  const hl = spec.highlight === undefined ? null : [].concat(spec.highlight).map(normKey);
  const isHl = (f) => hl && featureIndexHas(f, hl);
  const N = m.values.size;
  const regions = [], dashedRegions = [], outlines = [];
  const items = [];
  for (const f of m.features) {
    const v = m.values.get(f);
    const has = v !== undefined;
    const base = has ? sc.color(v) : null;
    const isDashed = m.dashed.has(f);
    const name = nameOf(f, locale);
    const tipTxt = (has ? `${name}\n${fmt(v)}${m.categorical ? '' : ' · ' + rankText(m.rank.get(f), N, locale)}` : `${name}\n${T(locale, 'Sin dato', 'No data')}`) + (isDashed ? `\n${dashedLabel}` : '');
    const d = pathD(f.geometry, proj, { r: ptR });
    const isLine = isLineGeom(f.geometry);
    const common = { class: 'pa-m', d, strokeLinejoin: 'round', opacity: hl && !isHl(f) ? 0.5 : null, 'data-tip': tipTxt, 'data-k': normKey(f.properties?.code ?? f.properties?.iso3 ?? name), 'data-key': regionKey(m, f, locale) };
    let fill = has ? base : spec.missing === 'plain' ? theme.tint : `url(#${gid}-nd)`;
    let stroke = null;
    if (isDashed && has) {
      // Rayado del color de su clase + borde discontinuo: se lee igual en la escala.
      const a = dashedAttrs(H, base, { width: 1.2 });
      fill = a.fill; stroke = a.stroke;
      dashedRegions.push(el('path', { ...common, ...a }));
    } else if (isDashed) {
      stroke = theme.muted;
      dashedRegions.push(el('path', { ...common, fill, stroke, strokeWidth: 1.1, strokeDasharray: DASH.outline, 'data-dashed': '1', 'data-color': fill }));
    } else if (isLine) regions.push(el('path', { ...common, fill: 'none', stroke: has ? base : theme.muted, strokeWidth: spec.lineWidth ?? 2.5, strokeLinecap: 'round', 'data-color': has ? base : fill }));
    else regions.push(el('path', { ...common, fill, stroke: isPointGeom(f.geometry) ? theme.surface : borderC, strokeWidth: isPointGeom(f.geometry) ? 1.2 : borderW, 'data-color': fill }));
    if (isHl(f)) outlines.push(el('path', { d, fill: 'none', stroke: theme.ink, strokeWidth: 1.5, strokeLinejoin: 'round', 'pointer-events': 'none' }));
    const c = centroid(f.geometry, proj);
    items.push({ f, name, v, cx: c.x, cy: c.y, area: c.area, label: has ? fmt(v) : '—', color: has ? base : theme.tint, fill, stroke, dashedShape: isDashed, missing: !has, tip: tipTxt });
  }
  const layer = [...layers.filter((L) => L.below).map((L) => drawLayer(L, proj, theme, locale)), g({ class: 'pa-regions' }, regions), dashedRegions.length ? g({ class: 'pa-regions pa-dashed' }, dashedRegions) : '', g({ class: 'pa-outlines' }, outlines), insetFrames(m.features, proj, theme),
    ...layers.filter((L) => !L.below).map((L) => drawLayer(L, proj, theme, locale))];
  const links = linkList(spec, m, theme, locale);
  if (links) layer.push(drawLinks(links, proj, theme, fmt, locale));
  const placed = [];
  if (markers) layer.push(...drawMarkers(markers, proj, theme, fmt, placed));
  const after = [];
  if (tall && spec.labels !== false) {
    const x = proj.bounds.x + proj.bounds.w + 26;
    const maxV = Math.max(...[...m.values.values()].map(Math.abs));
    after.push(...labelColumn(items, x, area.y, area.y + area.h, area.x + area.w - x, theme, fmt, { bars: spec.bars !== false && !m.categorical, maxV }));
  } else if (spec.labels !== false && m.features.some((f) => f.properties?.abbr) && !Array.isArray(spec.labels) && typeof spec.labels !== 'number') {
    const [lab, ...rest] = abbrLabels(items, proj, theme, { calloutX, showValues: spec.values !== false, top: area.y, bottom: area.y + area.h });
    layer.push(lab);
    after.push(...rest);
  } else {
    const chosen = new Set(chooseLabeled(m, spec, locale, m.features.length <= 30 ? m.features.length : 0));
    const ordered = items.filter((it) => chosen.has(it.f) && !it.missing).sort((a, b) => b.area - a.area)
      .map((it) => (isPointGeom(it.f.geometry) ? { ...it, cy: it.cy - ptR - 12 } : it));
    layer.push(g({ class: 'pa-zoom-hide' }, mapLabels(ordered, theme, placed, area)));
  }
  body.push(...(tall ? layer : zoomLayer(B, layer)), ...after);
  const desc = describeMap(m, fmt, locale, T(locale, 'Mapa coroplético', 'Choropleth map')) + describeExtras(markers, layers, locale, links);
  return frame.finish(body, { desc, type: 'choropleth', defs: noDataPattern(`${gid}-nd`, theme) + H.defs() });
}

/** Mapa de símbolos: círculos de área proporcional en el centroide. */
export function symbolMap(spec, theme) {
  const B = baseChart(spec, theme, 'symbol');
  const { locale, m, fmt, frame, area, body, proj, tall, gid, H, dashedLabel, rMax, layers, markers } = B;
  const N = m.values.size;
  const maxV = Math.max(...[...m.values.values()].map(Math.abs), 0) || 1;
  const color = (spec.colors && Object.values(spec.colors)[0]) || theme.categorical[0];
  const layer = [...layers.filter((L) => L.below).map((L) => drawLayer(L, proj, theme, locale)), g({ class: 'pa-regions pa-base' }, m.features.map((f) => el('path', { d: pathD(f.geometry, proj, { r: 2.5 }), fill: isLineGeom(f.geometry) ? 'none' : theme.tint, stroke: isLineGeom(f.geometry) ? theme.axis : spec.borderColor ?? theme.surface, strokeWidth: isLineGeom(f.geometry) ? 1.5 : spec.borderWidth ?? 0.75, strokeLinejoin: 'round', 'data-k': normKey(f.properties?.code ?? f.properties?.iso3 ?? nameOf(f, locale)), 'data-key': regionKey(m, f, locale) }))), insetFrames(m.features, proj, theme),
    ...layers.filter((L) => !L.below).map((L) => drawLayer(L, proj, theme, locale))];
  const items = m.features.map((f) => {
    const c = centroid(f.geometry, proj);
    const v = m.values.get(f);
    const name = nameOf(f, locale);
    const isDashed = m.dashed.has(f);
    const at = f.properties?.labelAt ? proj(f.properties.labelAt) : [c.x, c.y];
    return { f, name, v, cx: at[0], cy: at[1], area: c.area, r: v === undefined ? 0 : Math.sqrt(Math.abs(v) / maxV) * rMax, label: v === undefined ? '—' : fmt(v), color, missing: v === undefined, dashedShape: isDashed,
      tip: (v === undefined ? `${name}\n${T(locale, 'Sin dato', 'No data')}` : `${name}\n${fmt(v)} · ${rankText(m.rank.get(f), N, locale)}`) + (isDashed ? `\n${dashedLabel}` : '') };
  });
  const circles = items.filter((it) => !it.missing).sort((a, b) => b.r - a.r)
    .map((it) => el('circle', { class: 'pa-m', cx: it.cx, cy: it.cy, r: Math.max(1.5, it.r), 'data-tip': it.tip, 'data-color': color, 'data-key': regionKey(m, it.f, locale),
      ...(it.dashedShape ? { ...dashedAttrs(H, color, { width: 1.3 }) } : { fill: color, fillOpacity: 0.75, stroke: theme.surface, strokeWidth: 1.5 }) }));
  const links = linkList(spec, m, theme, locale);
  if (links) layer.push(drawLinks(links, proj, theme, fmt, locale));
  layer.push(g({ class: 'pa-symbols' }, circles));
  if (markers) layer.push(...drawMarkers(markers, proj, theme, fmt, []));
  // Leyenda de tamaños (tres círculos anidados) en la esquina libre.
  const sizes = [maxV, maxV / 4, maxV / 16].map((v) => ({ v, r: Math.sqrt(v / maxV) * rMax }));
  const lx = tall ? proj.bounds.x + proj.bounds.w + 26 : area.x + 4, ly = tall ? area.y + area.h - 4 : area.y + area.h - 4;
  const leg = sizes.map((s) => [
    el('circle', { cx: lx + rMax, cy: ly - s.r, r: s.r, fill: 'none', stroke: theme.muted, strokeWidth: 0.75 }),
    el('line', { x1: lx + rMax, x2: lx + rMax * 2 + 8, y1: ly - 2 * s.r, y2: ly - 2 * s.r, stroke: theme.muted, strokeWidth: 0.5 }),
    text(lx + rMax * 2 + 11, ly - 2 * s.r + 3.5, fmt(s.v), { fill: theme.muted, fontSize: 10.5 }),
  ]);
  if (tall && spec.labels !== false) {
    const x = proj.bounds.x + proj.bounds.w + 26;
    const legH = rMax * 2 + 12;
    body.push(...layer, ...labelColumn(items.map((it) => ({ ...it, barColor: color })), x, area.y, area.y + area.h - legH, area.x + area.w - x, theme, fmt, { bars: spec.bars !== false, maxV }));
  } else {
    const chosen = new Set(chooseLabeled(m, spec, locale, Math.min(5, m.values.size)));
    layer.push(g({ class: 'pa-zoom-hide' }, mapLabels(items.filter((it) => chosen.has(it.f) && !it.missing).sort((a, b) => b.v - a.v).map((it) => ({ ...it, cy: it.cy - it.r - 10 })), theme, [], area)));
    body.push(...zoomLayer(B, layer));
  }
  if (tall) body.push(g({ class: 'pa-legend pa-size-legend' }, leg));
  const desc = describeMap(m, fmt, locale, T(locale, 'Mapa de símbolos', 'Proportional symbol map')) + describeExtras(markers, layers, locale, links);
  return frame.finish(body, { desc, type: 'symbolmap', defs: H.defs() });
}

function describeExtras(markers, layers, locale, links) {
  const en = String(locale).startsWith('en');
  let s = '';
  if (links?.items.length) s += en ? ` ${links.items.length} lines${links.label ? ` (${links.label})` : ''}.` : ` ${links.items.length} líneas${links.label ? ` (${links.label})` : ''}.`;
  if (links?.unmatched.length) s += en ? ` Lines with an unknown end: ${links.unmatched.slice(0, 6).join(', ')}.` : ` Líneas con un extremo desconocido: ${links.unmatched.slice(0, 6).join(', ')}.`;
  if (markers?.items.length) s += en ? ` ${markers.items.length} markers${markers.legend ? ` (${markers.legend})` : ''}.` : ` ${markers.items.length} marcadores${markers.legend ? ` (${markers.legend})` : ''}.`;
  const named = layers.filter((L) => L.label).map((L) => L.label);
  if (named.length) s += en ? ` Layers: ${named.join(', ')}.` : ` Capas: ${named.join(', ')}.`;
  return s;
}

function describeMap(m, fmt, locale, what) {
  const en = String(locale).startsWith('en');
  if (m.categorical) {
    const cnt = new Map();
    for (const v of m.values.values()) cnt.set(v, (cnt.get(v) || 0) + 1);
    const parts = m.categories.map((c) => `${c} (${cnt.get(c)})`).join(', ');
    let s = en ? `${what} of ${humanize(m.valueF)} across ${m.values.size} areas: ${parts}.` : `${what} de ${humanize(m.valueF).toLowerCase()} en ${m.values.size} territorios: ${parts}.`;
    if (m.unmatched.length) s += en ? ` Unmatched: ${m.unmatched.slice(0, 8).join(', ')}.` : ` Sin coincidencia: ${m.unmatched.slice(0, 8).join(', ')}.`;
    return s;
  }
  if (!m.ranked.length) return `${what}.`;
  const [hiF, hiV] = m.ranked[0], [loF, loV] = m.ranked[m.ranked.length - 1];
  let s = en
    ? `${what} of ${humanize(m.valueF)} across ${m.values.size} areas. Highest: ${nameOf(hiF, locale)} (${fmt(hiV)}). Lowest: ${nameOf(loF, locale)} (${fmt(loV)}).`
    : `${what} de ${humanize(m.valueF).toLowerCase()} en ${m.values.size} territorios. Mayor: ${nameOf(hiF, locale)} (${fmt(hiV)}). Menor: ${nameOf(loF, locale)} (${fmt(loV)}).`;
  if (m.unmatched.length) s += en ? ` Unmatched: ${m.unmatched.slice(0, 8).join(', ')}.` : ` Sin coincidencia: ${m.unmatched.slice(0, 8).join(', ')}.`;
  return s;
}
