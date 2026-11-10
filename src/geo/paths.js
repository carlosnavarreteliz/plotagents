// Geometría ya proyectada: trazos SVG por id, sin TopoJSON ni proyección.
//
//   geo: {
//     paths: { c01101: "M-56.7 20.1l…Z", CL: { d: "M…", at: [311, 318] } },
//     points: { VA: [530.3, 92.2] },          // lo que no alcanza a tener contorno: un punto
//     names: { c01101: "Arica" },              // o [nombre, …]: se usa el primero
//   }
//
// Un sitio que ya proyectó y simplificó su mapa al construir (un `map.json`
// con un trazo por comuna) lo entrega tal cual. Cada trazo se lee a puntos
// —M, L, H, V, Z, C, S, Q, T y A, absolutos o relativos— y queda como un
// Feature con coordenadas planas, y hacia abajo como en SVG (`projection:
// "identity"`). Desde ahí el mapa es uno más: encuadre, giro (`orientation`),
// datos, vistas, líneas y marcadores en las mismas coordenadas.
import { PlotError } from '../data.js';

const TOKEN = /([MmLlHhVvZzCcSsQqTtAa])|([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/g;
// Tramos con que se aproxima una curva (Bézier); un arco va recto a su punto final.
const STEPS = 6;
const ARITY = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };

/**
 * Un atributo `d` → sus subtrazos como listas de puntos absolutos:
 * [{ pts: [[x, y], …], closed }]. Lanza si el trazo no se puede leer.
 */
export function parsePath(d, id = '') {
  const toks = [];
  for (const m of String(d ?? '').matchAll(TOKEN)) toks.push(m[1] ?? +m[2]);
  const out = [];
  let cur = null, x = 0, y = 0, sx = 0, sy = 0, cmd = null, i = 0;
  let qx = null, qy = null, cx2 = null, cy2 = null; // último control (S, T)
  const start = () => { cur = { pts: [[x, y]], closed: false }; out.push(cur); };
  const to = (nx, ny) => { if (!cur) start(); cur.pts.push([nx, ny]); x = nx; y = ny; };
  // De Casteljau en STEPS puntos; el último es el extremo exacto.
  const bez = (P) => {
    for (let s = 1; s <= STEPS; s++) {
      const t = s / STEPS;
      const p = P.map((q) => q.slice());
      for (let k = p.length - 1; k > 0; k--) for (let j = 0; j < k; j++) p[j] = [p[j][0] + (p[j + 1][0] - p[j][0]) * t, p[j][1] + (p[j + 1][1] - p[j][1]) * t];
      cur.pts.push(s === STEPS ? P[P.length - 1].slice() : p[0]);
    }
    x = P[P.length - 1][0]; y = P[P.length - 1][1];
  };
  // Un trazo empieza con M (o m).
  if (toks.length && !(toks[0] === 'M' || toks[0] === 'm')) throw bad(id, d);
  while (i < toks.length) {
    if (typeof toks[i] === 'string') cmd = toks[i++];
    else if (cmd === null) throw bad(id, d);
    else if (cmd === 'M') cmd = 'L';
    else if (cmd === 'm') cmd = 'l';
    const C = cmd.toUpperCase(), rel = cmd !== C;
    if (C === 'Z') {
      if (cur) { cur.closed = true; x = sx; y = sy; cur = null; }
      qx = cx2 = null;
      continue;
    }
    const a = toks.slice(i, i + ARITY[C]);
    if (a.length < ARITY[C] || a.some((v) => typeof v !== 'number')) throw bad(id, d);
    i += ARITY[C];
    const ox = rel ? x : 0, oy = rel ? y : 0;
    if (C === 'M') { x = ox + a[0]; y = oy + a[1]; sx = x; sy = y; start(); qx = cx2 = null; continue; }
    if (!cur) start();
    if (C === 'L') to(ox + a[0], oy + a[1]);
    else if (C === 'H') to(ox + a[0], y);
    else if (C === 'V') to(x, oy + a[0]);
    else if (C === 'A') to(ox + a[5], oy + a[6]);
    else if (C === 'C' || C === 'S') {
      const p1 = C === 'C' ? [ox + a[0], oy + a[1]] : cx2 === null ? [x, y] : [2 * x - cx2, 2 * y - cy2];
      const p2 = C === 'C' ? [ox + a[2], oy + a[3]] : [ox + a[0], oy + a[1]];
      const p3 = C === 'C' ? [ox + a[4], oy + a[5]] : [ox + a[2], oy + a[3]];
      bez([[x, y], p1, p2, p3]);
      cx2 = p2[0]; cy2 = p2[1]; qx = null;
      continue;
    } else if (C === 'Q' || C === 'T') {
      const p1 = C === 'Q' ? [ox + a[0], oy + a[1]] : qx === null ? [x, y] : [2 * x - qx, 2 * y - qy];
      const p2 = C === 'Q' ? [ox + a[2], oy + a[3]] : [ox + a[0], oy + a[1]];
      bez([[x, y], p1, p2]);
      qx = p1[0]; qy = p1[1]; cx2 = null;
      continue;
    }
    qx = cx2 = null;
  }
  return out.filter((s) => s.pts.length > 1 || s.closed);
}

const bad = (id, d) => new PlotError(
  `El trazo${id ? ` de "${id}"` : ''} no es un atributo d de SVG válido: ${String(d).slice(0, 40)}…`,
  'Cada valor de `paths` es un d de SVG ("M10,10L20,10L20,20Z") o { d, at: [x, y] }.'
);

/** Un trazo → geometría GeoJSON plana: polígonos si cierra, líneas si no. */
export function pathGeometry(d, id) {
  const subs = parsePath(d, id);
  const closed = subs.filter((s) => s.closed);
  if (closed.length) {
    // Cada subtrazo cerrado, un anillo: el orden y el sentido se conservan, así
    // que el relleno (nonzero) cubre lo mismo que el trazo original, agujeros incluidos.
    const ring = (s) => { const p = s.pts; const [a, b] = [p[0], p[p.length - 1]]; return a[0] === b[0] && a[1] === b[1] ? p : [...p, a]; };
    return { type: 'MultiPolygon', coordinates: closed.map((s) => [ring(s)]) };
  }
  if (subs.length === 1) return { type: 'LineString', coordinates: subs[0].pts };
  return { type: 'MultiLineString', coordinates: subs.map((s) => s.pts) };
}

/** ¿Es un objeto de trazos ya proyectados ({ paths: { id: d } })? */
export const isPathsGeo = (geo) => !!geo && typeof geo === 'object' && !Array.isArray(geo) && geo.type === undefined && geo.paths && typeof geo.paths === 'object';

const nameOf = (v) => (Array.isArray(v) ? v[0] : v);
const pt = (v) => (Array.isArray(v) && v.length >= 2 && v.slice(0, 2).every((n) => Number.isFinite(+n)) ? [+v[0], +v[1]] : null);

/** { paths, points?, names? } → FeatureCollection plana (projection: "identity"). */
export function pathsToFeatures(geo) {
  const names = geo.names && typeof geo.names === 'object' ? geo.names : {};
  const features = [];
  for (const [id, v] of Object.entries(geo.paths)) {
    const d = typeof v === 'string' ? v : v && typeof v === 'object' ? v.d : null;
    if (typeof d !== 'string') throw new PlotError(`\`paths.${id}\` debe ser un d de SVG o { d, at }.`, 'paths: { a: "M0,0L10,0L10,10Z" }');
    const geometry = pathGeometry(d, id);
    if (!geometry.coordinates.length) continue;
    const at = v && typeof v === 'object' ? pt(v.at ?? v.p) : null;
    const name = nameOf(names[id] ?? (v && typeof v === 'object' ? v.name : undefined));
    features.push({ type: 'Feature', id, properties: { id, code: id, ...(name !== undefined && name !== null ? { name: String(name) } : {}), ...(at ? { labelAt: at } : {}) }, geometry });
  }
  for (const [id, v] of Object.entries(geo.points && typeof geo.points === 'object' ? geo.points : {})) {
    const p = pt(v);
    if (!p) throw new PlotError(`\`points.${id}\` debe ser [x, y].`, 'points: { VA: [530.3, 92.2] }');
    const name = nameOf(names[id]);
    features.push({ type: 'Feature', id, properties: { id, code: id, ...(name !== undefined && name !== null ? { name: String(name) } : {}), dot: true }, geometry: { type: 'Point', coordinates: p } });
  }
  return { type: 'FeatureCollection', features, projection: 'identity' };
}
