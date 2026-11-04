// Registro de geometrías. El núcleo no trae mapas pesados: se registran al
// importar 'plotagents/geo/chile', 'plotagents/geo/usa' o 'plotagents/geo/world', o se pasa un
// GeoJSON propio en spec.geo.
//
// `geo` acepta, además de un nombre registrado:
//   · un GeoJSON FeatureCollection, un Feature, un arreglo de Features o una geometría suelta
//   · un TopoJSON (Topology); `geoObject` elige el objeto (por defecto, el primero)
//   · en el navegador, una URL (render() la descarga; ver runtime.js)
import { PlotError } from '../data.js';

const REG = new Map();

export function registerGeo(name, geo, aliases = []) {
  const fc = toFeatureCollection(geo);
  for (const n of [name, ...aliases]) REG.set(String(n).toLowerCase(), fc);
  return fc;
}

/** ¿Parece una URL o una ruta a un archivo .json / .geojson / .topojson? */
export const isGeoUrl = (s) => typeof s === 'string' && (/^(https?:)?\/\//i.test(s) || /^(\.{0,2}\/|data:)/.test(s) || /\.(geo|topo)?json(\?.*)?$/i.test(s));

export function getGeo(geo, objectName) {
  if (geo && typeof geo === 'object') return toFeatureCollection(geo, objectName);
  if (isGeoUrl(geo)) {
    throw new PlotError(
      `"${geo}" es una URL o un archivo: plot() es sincrónico y no descarga nada.`,
      "En Node, lee el archivo y pásalo como objeto: geo: JSON.parse(fs.readFileSync('mapa.geojson', 'utf8')). En el navegador, render(el, spec) sí acepta la URL."
    );
  }
  const fc = REG.get(String(geo || '').toLowerCase());
  if (!fc) {
    const known = [...new Set(REG.keys())];
    throw new PlotError(
      `No hay una geometría registrada con el nombre "${geo}".`,
      known.length ? `Disponibles: ${known.join(', ')}. O pasa un GeoJSON o TopoJSON en \`geo\`.` : "Importa 'plotagents/geo/chile', 'plotagents/geo/usa' o 'plotagents/geo/world', o pasa un GeoJSON en `geo`."
    );
  }
  return fc;
}

export const registeredGeo = () => [...new Set(REG.keys())];

const GEOMS = new Set(['Point', 'MultiPoint', 'LineString', 'MultiLineString', 'Polygon', 'MultiPolygon', 'GeometryCollection']);
const cache = new WeakMap();

/** Cualquier forma de GeoJSON / TopoJSON → FeatureCollection. */
export function toFeatureCollection(geo, objectName) {
  if (!geo || typeof geo !== 'object') throw new PlotError('`geo` debe ser un nombre registrado, un GeoJSON o un TopoJSON.', 'geo: "chile" | "usa" | "world" | { type: "FeatureCollection", features: [...] }');
  if (Array.isArray(geo)) return { type: 'FeatureCollection', features: geo.map(asFeature) };
  if (geo.type === 'FeatureCollection') {
    if (!Array.isArray(geo.features)) throw new PlotError('El FeatureCollection no tiene `features`.');
    return geo.features.every((f) => f && f.type === 'Feature') ? geo : { ...geo, features: geo.features.map(asFeature) };
  }
  if (geo.type === 'Feature') return { type: 'FeatureCollection', features: [geo] };
  if (GEOMS.has(geo.type)) return { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: geo }] };
  if (geo.type === 'Topology') {
    const key = objectName ?? '';
    const memo = cache.get(geo) || {};
    if (!memo[key]) { memo[key] = topoFeatures(geo, objectName); cache.set(geo, memo); }
    return memo[key];
  }
  throw new PlotError(`No reconozco este \`geo\` (type: "${geo.type}").`, 'Usa un GeoJSON (FeatureCollection, Feature o geometría) o un TopoJSON (type: "Topology").');
}

function asFeature(f) {
  if (f && f.type === 'Feature') return f;
  if (f && GEOMS.has(f.type)) return { type: 'Feature', properties: {}, geometry: f };
  throw new PlotError('Cada elemento de `geo` debe ser un Feature de GeoJSON.');
}

// ── TopoJSON (decodificador mínimo, sin dependencias) ──────────────────────
function topoFeatures(topo, objectName) {
  const names = Object.keys(topo.objects || {});
  if (!names.length) throw new PlotError('El TopoJSON no tiene objetos.');
  const name = objectName ?? names[0];
  const obj = topo.objects[name];
  if (!obj) throw new PlotError(`El TopoJSON no tiene el objeto "${name}".`, `Objetos disponibles: ${names.join(', ')}. Indícalo con \`geoObject\`.`);
  const tf = topo.transform;
  // Arcos absolutos (deshace la cuantización y la codificación delta).
  const arcs = (topo.arcs || []).map((arc) => {
    if (!tf) return arc.map((p) => p.slice(0, 2));
    let x = 0, y = 0;
    return arc.map((p) => { x += p[0]; y += p[1]; return [x * tf.scale[0] + tf.translate[0], y * tf.scale[1] + tf.translate[1]]; });
  });
  const point = (p) => (tf ? [p[0] * tf.scale[0] + tf.translate[0], p[1] * tf.scale[1] + tf.translate[1]] : p.slice(0, 2));
  const line = (ids) => {
    const out = [];
    for (const i of ids) {
      const a = i < 0 ? arcs[~i].slice().reverse() : arcs[i];
      if (!a) continue;
      for (let k = out.length ? 1 : 0; k < a.length; k++) out.push(a[k]);
    }
    return out;
  };
  const ring = (ids) => { const r = line(ids); if (r.length && (r[0][0] !== r[r.length - 1][0] || r[0][1] !== r[r.length - 1][1])) r.push(r[0]); return r; };
  const geom = (o) => {
    switch (o.type) {
      case 'Point': return { type: 'Point', coordinates: point(o.coordinates) };
      case 'MultiPoint': return { type: 'MultiPoint', coordinates: o.coordinates.map(point) };
      case 'LineString': return { type: 'LineString', coordinates: line(o.arcs) };
      case 'MultiLineString': return { type: 'MultiLineString', coordinates: o.arcs.map(line) };
      case 'Polygon': return { type: 'Polygon', coordinates: o.arcs.map(ring) };
      case 'MultiPolygon': return { type: 'MultiPolygon', coordinates: o.arcs.map((p) => p.map(ring)) };
      default: return null;
    }
  };
  const feat = (o) => ({ type: 'Feature', id: o.id, properties: { ...(o.properties || {}), ...(o.id !== undefined && (o.properties || {}).id === undefined ? { id: o.id } : {}) }, geometry: geom(o) });
  const list = obj.type === 'GeometryCollection' ? obj.geometries.map(feat) : [feat(obj)];
  return { type: 'FeatureCollection', features: list.filter((f) => f.geometry) };
}
