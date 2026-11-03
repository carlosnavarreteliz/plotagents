// Proyecciones y trazado de GeoJSON a SVG (sin dependencias).
// mercator (países alargados como Chile) y equalEarth (mapamundi de áreas
// iguales, Šavrič et al. 2018). fit() ajusta una colección a un rectángulo.

const RAD = Math.PI / 180;

export function mercator() {
  return ([lon, lat]) => {
    const phi = Math.max(-85, Math.min(85, lat)) * RAD;
    return [lon * RAD, -Math.log(Math.tan(Math.PI / 4 + phi / 2))];
  };
}

const A1 = 1.340264, A2 = -0.081106, A3 = 0.000893, A4 = 0.003796, M = Math.sqrt(3) / 2;
export function equalEarth() {
  return ([lon, lat]) => {
    const l = lon * RAD;
    const th = Math.asin(M * Math.sin(lat * RAD));
    const t2 = th * th, t6 = t2 * t2 * t2;
    const x = (l * Math.cos(th)) / (M * (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2)));
    const y = th * (A1 + A2 * t2 + t6 * (A3 + A4 * t2));
    return [x, -y];
  };
}

export const projections = { mercator, equalEarth, 'equal-earth': equalEarth };

/** Recorre todos los anillos de una geometría. */
export function rings(geom) {
  if (!geom) return [];
  if (geom.type === 'Polygon') return geom.coordinates;
  if (geom.type === 'MultiPolygon') return geom.coordinates.flat();
  return [];
}
export function polygonsOf(geom) {
  if (!geom) return [];
  if (geom.type === 'Polygon') return [geom.coordinates];
  if (geom.type === 'MultiPolygon') return geom.coordinates;
  return [];
}

/**
 * Proyección ajustada a [x0, y0, x1, y1] conservando la proporción.
 * Devuelve una función lon/lat → [x, y] con .bounds (ancho/alto usados).
 */
export function fit(features, raw, [x0, y0, x1, y1], { align = 'center' } = {}) {
  let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
  for (const f of features) for (const r of rings(f.geometry)) for (const p of r) {
    const [x, y] = raw(p);
    if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y;
  }
  const w = x1 - x0, h = y1 - y0;
  const k = Math.min(w / (bx1 - bx0 || 1), h / (by1 - by0 || 1));
  const mw = (bx1 - bx0) * k, mh = (by1 - by0) * k;
  const ox = align === 'left' ? x0 : x0 + (w - mw) / 2;
  const oy = y0 + (h - mh) / 2;
  const proj = (p) => { const [x, y] = raw(p); return [ox + (x - bx0) * k, oy + (y - by0) * k]; };
  proj.bounds = { x: ox, y: oy, w: mw, h: mh };
  proj.aspect = (by1 - by0) / (bx1 - bx0 || 1);
  return proj;
}

/** Proporción alto/ancho de la colección proyectada (para elegir el alto). */
export function aspectOf(features, raw) {
  let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
  for (const f of features) for (const r of rings(f.geometry)) for (const p of r) {
    const [x, y] = raw(p);
    if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y;
  }
  return (by1 - by0) / (bx1 - bx0 || 1);
}

const r1 = (v) => Math.round(v * 10) / 10;

/**
 * Geometría → atributo d de SVG. Los anillos que saltan más de 180° de
 * longitud (antimeridiano) se cortan para no cruzar el mapa entero.
 */
export function pathD(geom, proj) {
  let d = '';
  for (const ring of rings(geom)) {
    let started = false, lastLon = null, lx = null, ly = null, n = 0;
    for (const p of ring) {
      if (lastLon !== null && Math.abs(p[0] - lastLon) > 180) started = false;
      lastLon = p[0];
      const [x, y] = proj(p);
      const X = r1(x), Y = r1(y);
      if (started && X === lx && Y === ly) continue;
      d += (started ? 'L' : 'M') + X + ',' + Y;
      started = true; lx = X; ly = Y; n++;
    }
    if (n) d += 'Z';
  }
  return d;
}

/** Área (en px²) y centroide del polígono proyectado más grande. */
export function centroid(geom, proj) {
  let best = null;
  for (const poly of polygonsOf(geom)) {
    const pts = poly[0].map(proj);
    let a = 0, cx = 0, cy = 0;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const f = pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1];
      a += f; cx += (pts[j][0] + pts[i][0]) * f; cy += (pts[j][1] + pts[i][1]) * f;
    }
    a /= 2;
    if (!best || Math.abs(a) > Math.abs(best.area)) best = { area: a, x: a ? cx / (6 * a) : pts[0][0], y: a ? cy / (6 * a) : pts[0][1] };
  }
  return best ? { x: best.x, y: best.y, area: Math.abs(best.area) } : { x: 0, y: 0, area: 0 };
}
