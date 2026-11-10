// Proyecciones y trazado de GeoJSON a SVG (sin dependencias).
// mercator (países alargados como Chile), equalEarth (mapamundi de áreas
// iguales, Šavrič et al. 2018) y albersUsa (EE. UU. con Alaska, Hawái y
// Puerto Rico en recuadros, como d3.geoAlbersUsa). fit() ajusta una
// colección a un rectángulo.

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

/**
 * Cónica de áreas iguales (Albers) con rotación y centro, en escala unitaria:
 * misma fórmula que d3.geoConicEqualArea. Devuelve [x, y] con y hacia abajo.
 */
function conic(rot, center, [p0, p1], k = 1, [tx, ty] = [0, 0]) {
  const sy0 = Math.sin(p0 * RAD), n = (sy0 + Math.sin(p1 * RAD)) / 2;
  const c = 1 + sy0 * (2 * n - sy0), r0 = Math.sqrt(c) / n;
  const raw = (lon, lat) => {
    let l = lon + rot;
    l = ((((l + 180) % 360) + 360) % 360) - 180;
    const r = Math.sqrt(Math.max(0, c - 2 * n * Math.sin(lat * RAD))) / n;
    const a = l * RAD * n;
    return [r * Math.sin(a), r0 - r * Math.cos(a)];
  };
  const [cx, cy] = raw(center[0], center[1]);
  return (lon, lat) => { const [x, y] = raw(lon, lat); return [tx + k * (x - cx), ty - k * (y - cy)]; };
}

/**
 * EE. UU. compuesto: 48 estados contiguos en Albers y recuadros para Alaska
 * (a 0,35×), Hawái y Puerto Rico abajo, como en d3 / d3-composite-projections.
 * Cada punto va al recuadro de su territorio (las geometrías no cruzan).
 */
export function albersUsa() {
  const lower48 = conic(96, [-96.6, 38.7], [29.5, 45.5]);
  const alaska = conic(154, [-156, 58.5], [55, 65], 0.35, [-0.307, 0.201]);
  const hawaii = conic(157, [-160, 19.9], [8, 18], 1, [-0.205, 0.212]);
  const puertoRico = conic(66, [-66, 18], [8, 18], 1, [0.35, 0.224]);
  const which = ([lon, lat]) => (lat > 50 ? 'AK' : lat < 23 && lon < -150 ? 'HI' : lon > -68.5 && lon < -64 && lat < 19.5 ? 'PR' : null);
  const P = { AK: alaska, HI: hawaii, PR: puertoRico };
  const f = (p) => (P[which(p)] || lower48)(p[0], p[1]);
  f.continuous = true; // sin corte en el antimeridiano: los recuadros ya son continuos
  f.inset = which;
  return f;
}

/** Equirectangular (placa carré): lon/lat tal cual. Útil para mapas chicos o datos ya en grados. */
export function equirectangular() {
  return ([lon, lat]) => [lon * RAD, -lat * RAD];
}

/**
 * Coordenadas planas, sin proyectar: para GeoJSON en metros (UTM), en
 * píxeles o dibujado a mano. `identity` deja el eje y hacia abajo (como
 * SVG); `planar` lo invierte (y hacia arriba, como un plano cartesiano o UTM).
 */
export function identity() { const f = ([x, y]) => [x, y]; f.continuous = true; return f; }
export function planar() { const f = ([x, y]) => [x, -y]; f.continuous = true; return f; }

/** Cónica de áreas iguales con paralelos y meridiano central propios. */
export function conicEqualArea({ parallels = [29.5, 45.5], rotate, center = [0, 0] } = {}) {
  const lon0 = rotate !== undefined ? -[].concat(rotate)[0] : center[0];
  const f = conic(-lon0, [lon0, center[1] ?? 0], parallels);
  return ([lon, lat]) => f(lon, lat);
}

export const projections = {
  mercator, equalEarth, 'equal-earth': equalEarth, albersUsa, 'albers-usa': albersUsa, albers: albersUsa,
  equirectangular, 'plate-carree': equirectangular, latlon: equirectangular,
  identity, none: identity, pixels: identity, planar, cartesian: planar, utm: planar,
  conic: conicEqualArea, conicEqualArea, 'conic-equal-area': conicEqualArea,
};

/**
 * Proyección desde el spec: un nombre ("mercator", "identity"…) o un objeto
 * { type: "conic", parallels: [-30, -45], rotate: 72 }. Devuelve null si no
 * se reconoce (se elige una automáticamente).
 */
export function makeProjection(p) {
  if (!p) return null;
  // Sin distinguir mayúsculas ni guiones: "equalearth", "Equal-Earth" y "equalEarth" son lo mismo.
  const find = (n) => { const k = String(n ?? '').toLowerCase().replace(/[-_\s]/g, ''); const hit = Object.keys(projections).find((x) => x.toLowerCase().replace(/[-_\s]/g, '') === k); return hit ? projections[hit] : null; };
  if (typeof p === 'string') { const f = projections[p] || find(p); return f ? f() : null; }
  if (typeof p === 'object') { const f = projections[p.type || p.name] || find(p.type || p.name); return f ? f(p) : null; }
  return null;
}

/**
 * Todas las secuencias de puntos de una geometría (anillos de polígonos,
 * líneas y puntos): sirve para encuadrar y para saber si la forma existe.
 */
export function rings(geom) {
  if (!geom || !geom.type) return [];
  const c = geom.coordinates;
  switch (geom.type) {
    case 'Polygon': case 'MultiLineString': return c || [];
    case 'MultiPolygon': return (c || []).flat();
    case 'LineString': case 'MultiPoint': return c && c.length ? [c] : [];
    case 'Point': return c && c.length >= 2 ? [[c]] : [];
    case 'GeometryCollection': return (geom.geometries || []).flatMap(rings);
    default: return [];
  }
}
/** ¿La geometría es de puntos o de líneas (sin área)? */
export const isPointGeom = (geom) => !!geom && (geom.type === 'Point' || geom.type === 'MultiPoint');
export const isLineGeom = (geom) => !!geom && (geom.type === 'LineString' || geom.type === 'MultiLineString');
export function polygonsOf(geom) {
  if (!geom) return [];
  if (geom.type === 'Polygon') return [geom.coordinates];
  if (geom.type === 'MultiPolygon') return geom.coordinates;
  if (geom.type === 'GeometryCollection') return (geom.geometries || []).flatMap(polygonsOf);
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
  // De coordenadas ya proyectadas (la salida de `raw`) a la pantalla: lo que encaja una geometría externa (`sprite`).
  proj.post = ([x, y]) => [ox + (x - bx0) * k, oy + (y - by0) * k];
  proj.bounds = { x: ox, y: oy, w: mw, h: mh };
  proj.continuous = !!raw.continuous;
  proj.inset = raw.inset;
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
 * longitud (antimeridiano) se cortan para no cruzar el mapa entero. Las
 * líneas quedan abiertas y los puntos se dibujan como círculos de radio `r`.
 */
export function pathD(geom, proj, { r = 4.5, compact = null } = {}) {
  if (!geom) return '';
  if (compact) return compactD(geom, proj, r, compact);
  if (geom.type === 'GeometryCollection') return (geom.geometries || []).map((x) => pathD(x, proj, { r })).join('');
  if (isPointGeom(geom)) {
    const pts = geom.type === 'Point' ? [geom.coordinates] : geom.coordinates || [];
    return pts.map((p) => { const [x, y] = proj(p); return `M${r1(x - r)},${r1(y)}a${r},${r} 0 1,0 ${2 * r},0a${r},${r} 0 1,0 ${-2 * r},0`; }).join('');
  }
  const open = isLineGeom(geom);
  let d = '';
  const cut = !proj.continuous;
  for (const ring of rings(geom)) {
    let started = false, lastLon = null, lx = null, ly = null, n = 0;
    for (const p of ring) {
      if (cut && lastLon !== null && Math.abs(p[0] - lastLon) > 180) started = false;
      lastLon = p[0];
      const [x, y] = proj(p);
      const X = r1(x), Y = r1(y);
      if (started && X === lx && Y === ly) continue;
      d += (started ? 'L' : 'M') + X + ',' + Y;
      started = true; lx = X; ly = Y; n++;
    }
    if (n && !open) d += 'Z';
  }
  return d;
}

/** Área (en px²) y centroide del polígono proyectado más grande. */
export function centroid(geom, proj) {
  if (!polygonsOf(geom).length) {
    // Puntos y líneas: el promedio de sus vértices (área chica fija para las etiquetas).
    const pts = rings(geom).flat().map(proj);
    if (!pts.length) return { x: 0, y: 0, area: 0 };
    const mid = isLineGeom(geom) ? pts[Math.floor(pts.length / 2)] : [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length];
    return { x: mid[0], y: mid[1], area: 0, point: true };
  }
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

// ── Trazos compactos (`precision`, `simplify`) ──────────────────────────────
//
// Un mapa de cientos de formas pesa por sus coordenadas. Con `precision` (los
// decimales, en píxeles) y `simplify` (la tolerancia, en píxeles), cada anillo
// se simplifica en la pantalla (Douglas–Peucker), se redondea a la grilla y se
// escribe en coordenadas relativas ("l1.2-.3"), que es lo que más ahorra. Sin
// esas opciones el trazo es el de siempre.

/** Douglas–Peucker sobre una lista abierta de puntos [x, y]: los que quedan. */
function simplifyLine(pts, tol) {
  if (pts.length < 3 || !(tol > 0)) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const t2 = tol * tol;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
    let far = -1, best = t2;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = pts[i];
      let d;
      if (!L) d = (px - ax) ** 2 + (py - ay) ** 2;
      else { const c = dx * (py - ay) - dy * (px - ax); d = (c * c) / L; }
      if (d > best) { best = d; far = i; }
    }
    if (far > 0) { keep[far] = 1; stack.push([a, far], [far, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

/** Un anillo cerrado: se corta en su punto más lejano al primero y se simplifica por mitades. */
function simplifyRing(pts, tol) {
  if (pts.length < 4 || !(tol > 0)) return pts;
  const [x0, y0] = pts[0];
  let far = 0, best = -1;
  for (let i = 1; i < pts.length; i++) { const d = (pts[i][0] - x0) ** 2 + (pts[i][1] - y0) ** 2; if (d > best) { best = d; far = i; } }
  if (far === 0) return pts;
  const a = simplifyLine(pts.slice(0, far + 1), tol), b = simplifyLine(pts.slice(far), tol);
  return a.concat(b.slice(1));
}

/** Un número de la grilla (entero en unidades de 10^-p) como texto corto: 12 → "1.2", -3 → "-.3". */
function gridNum(n, p) {
  if (!p) return String(n);
  const neg = n < 0, s = String(Math.abs(n)).padStart(p + 1, '0');
  let int = s.slice(0, s.length - p), dec = s.slice(s.length - p).replace(/0+$/, '');
  if (int === '0' && dec) int = '';
  return (neg ? '-' : '') + int + (dec ? '.' + dec : '') || '0';
}

/** Une números de un trazo sin separadores de más ("1.2-.3.5"). */
function joinNums(list) {
  let s = '';
  for (let i = 0; i < list.length; i++) {
    const t = list[i];
    if (i && !(t[0] === '-' || (t[0] === '.' && list[i - 1].includes('.')))) s += ' ';
    s += t;
  }
  return s;
}

function compactD(geom, proj, r, { precision = 1, simplify = 0 } = {}) {
  const p = Math.max(0, Math.min(3, Math.round(+precision || 0)));
  const q = 10 ** p;
  const G = (v) => Math.round(v * q);
  if (geom.type === 'GeometryCollection') return (geom.geometries || []).map((x) => compactD(x, proj, r, { precision, simplify })).join('');
  if (isPointGeom(geom)) {
    const pts = geom.type === 'Point' ? [geom.coordinates] : geom.coordinates || [];
    const R = gridNum(G(r), p), D = gridNum(G(2 * r), p);
    return pts.map((pt) => { const [x, y] = proj(pt); return `M${gridNum(G(x - r), p)},${gridNum(G(y), p)}a${R} ${R} 0 1 0 ${D} 0a${R} ${R} 0 1 0 -${D} 0`; }).join('');
  }
  const open = isLineGeom(geom);
  const cut = !proj.continuous;
  const runs = [];
  for (const ring of rings(geom)) {
    // Como en pathD: un anillo que cruza el antimeridiano se corta en tramos y sólo el último cierra.
    let run = [], lastLon = null;
    for (const pt of ring) {
      if (cut && lastLon !== null && Math.abs(pt[0] - lastLon) > 180 && run.length) { runs.push({ pts: run, closed: false }); run = []; }
      lastLon = pt[0];
      run.push(proj(pt));
    }
    if (run.length) runs.push({ pts: run, closed: !open });
  }
  const parts = [];
  let biggest = null;
  for (const run of runs) {
    const s = run.closed ? simplifyRing(run.pts, simplify) : simplifyLine(run.pts, simplify);
    const g = [];
    for (const [x, y] of s) { const X = G(x), Y = G(y); const l = g[g.length - 1]; if (!l || l[0] !== X || l[1] !== Y) g.push([X, Y]); }
    if (run.closed && g.length > 1 && g[0][0] === g[g.length - 1][0] && g[0][1] === g[g.length - 1][1]) g.pop();
    const part = { g, closed: run.closed };
    if (!biggest || g.length > biggest.g.length) biggest = part;
    // Un anillo que en la pantalla es menos que un triángulo no se ve: se omite.
    if (run.closed ? g.length >= 3 : g.length >= 2) parts.push(part);
  }
  if (!parts.length && biggest && biggest.g.length) parts.push(biggest);
  let d = '';
  for (const { g, closed } of parts) {
    d += 'M' + gridNum(g[0][0], p) + ',' + gridNum(g[0][1], p);
    if (g.length > 1) {
      const nums = [];
      for (let i = 1; i < g.length; i++) nums.push(gridNum(g[i][0] - g[i - 1][0], p), gridNum(g[i][1] - g[i - 1][1], p));
      d += 'l' + joinNums(nums);
    }
    if (closed) d += 'z';
  }
  return d;
}
