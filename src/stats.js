// Estadística liviana para los gráficos tipo seaborn: cuantiles, intervalos
// de confianza, histogramas, densidad (KDE), regresiones y ECDF.
// Determinista (sin bootstrap aleatorio) para que el SVG sea reproducible.

export const finite = (vs) => vs.filter((v) => Number.isFinite(v));
export const sum = (vs) => vs.reduce((a, b) => a + b, 0);
export const mean = (vs) => (vs.length ? sum(vs) / vs.length : NaN);

/**
 * [mín, máx] de los valores finitos con un bucle: `Math.min(...arr)` desborda
 * la pila con ~150 mil elementos. Vacío → [Infinity, -Infinity] (como Math.min()).
 */
export function extent(vs) {
  let lo = Infinity, hi = -Infinity;
  for (const v of vs) {
    if (!Number.isFinite(v)) continue;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return [lo, hi];
}

export function variance(vs) {
  const n = vs.length;
  if (n < 2) return 0;
  const m = mean(vs);
  return vs.reduce((a, v) => a + (v - m) ** 2, 0) / (n - 1);
}
export const sd = (vs) => Math.sqrt(variance(vs));

/** Cuantil con interpolación lineal (tipo 7, como numpy/R). `sorted` ordenado. */
export function quantile(sorted, p) {
  if (!sorted.length) return NaN;
  const h = (sorted.length - 1) * p;
  const lo = Math.floor(h), hi = Math.ceil(h);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (h - lo);
}
export const median = (vs) => quantile([...vs].sort((a, b) => a - b), 0.5);

/** Cuantil de la normal estándar (Acklam). */
export function zQuantile(p) {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const pl = 0.02425;
  let q, r;
  if (p < pl) { q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  if (p > 1 - pl) { q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  q = p - 0.5; r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

/** Cuantil de la t de Student (expansión de Cornish-Fisher; exacta a ~1e-3 para df ≥ 3). */
export function tQuantile(df, p = 0.975) {
  if (df <= 0) return NaN;
  if (df === 1) return Math.tan(Math.PI * (p - 0.5));
  if (df === 2) { const a = 4 * p * (1 - p); return (2 * p - 1) * Math.sqrt(2 / a); }
  const z = zQuantile(p);
  const z3 = z ** 3, z5 = z ** 5, z7 = z ** 7, z9 = z ** 9;
  return z + (z3 + z) / (4 * df) + (5 * z5 + 16 * z3 + 3 * z) / (96 * df ** 2) + (3 * z7 + 19 * z5 + 17 * z3 - 15 * z) / (384 * df ** 3) + (79 * z9 + 776 * z7 + 1482 * z5 - 1920 * z3 - 945 * z) / (92160 * df ** 4);
}

/** Intervalo de confianza de la media (t de Student). */
export function meanCI(vs, level = 0.95) {
  const v = finite(vs);
  const m = mean(v);
  if (v.length < 2) return [m, m];
  const h = tQuantile(v.length - 1, 0.5 + level / 2) * sd(v) / Math.sqrt(v.length);
  return [m - h, m + h];
}

/** Resumen para cajas: cuartiles, bigotes a 1,5·RIC y atípicos. */
export function fiveNumber(vs) {
  const s = finite(vs).sort((a, b) => a - b);
  const q1 = quantile(s, 0.25), med = quantile(s, 0.5), q3 = quantile(s, 0.75);
  const iqr = q3 - q1;
  const loF = q1 - 1.5 * iqr, hiF = q3 + 1.5 * iqr;
  const inside = s.filter((v) => v >= loF && v <= hiF);
  return {
    n: s.length, min: s[0], max: s[s.length - 1], q1, median: med, q3, iqr, mean: mean(s),
    whiskerLo: inside.length ? inside[0] : q1, whiskerHi: inside.length ? inside[inside.length - 1] : q3,
    outliers: s.filter((v) => v < loF || v > hiF),
  };
}

const niceBinStep = (span, n) => {
  const raw = span / Math.max(1, n);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const f = raw / mag;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag;
};

/**
 * Histograma con anchos "bonitos". Por defecto, regla de Freedman–Diaconis
 * acotada a 5–50 barras. Opciones: bins (número), binWidth, domain [a,b].
 */
export function histogram(vs, { bins, binWidth, domain } = {}) {
  const s = finite(vs).sort((a, b) => a - b);
  if (!s.length) return [];
  let [lo, hi] = domain || [s[0], s[s.length - 1]];
  if (lo === hi) { lo -= 0.5; hi += 0.5; }
  let step = binWidth;
  if (!step) {
    let n = bins;
    if (!n) {
      const iqr = quantile(s, 0.75) - quantile(s, 0.25);
      const fd = iqr > 0 ? 2 * iqr / Math.cbrt(s.length) : 0;
      n = fd > 0 ? Math.ceil((hi - lo) / fd) : Math.ceil(Math.log2(s.length) + 1);
      n = Math.max(5, Math.min(50, n));
    }
    step = bins ? (hi - lo) / bins : niceBinStep(hi - lo, n);
  }
  const start = bins ? lo : Math.floor(lo / step + 1e-9) * step;
  const count = Math.max(1, Math.ceil((hi - start) / step - 1e-9));
  const out = Array.from({ length: count }, (_, i) => ({ x0: start + i * step, x1: start + (i + 1) * step, count: 0 }));
  for (const v of s) {
    let i = Math.floor((v - start) / step);
    if (i >= count) i = count - 1;
    if (i >= 0) out[i].count++;
  }
  return out;
}

/** Ancho de banda de Scott (el de seaborn por defecto). */
export function scottBandwidth(vs) {
  const v = finite(vs);
  const s = sd(v);
  const sorted = [...v].sort((a, b) => a - b);
  const iqr = quantile(sorted, 0.75) - quantile(sorted, 0.25);
  const sigma = Math.min(s, iqr / 1.349) || s || 1;
  return 1.06 * sigma * v.length ** -0.2;
}

const extentOf = extent;
/** Sobre este número de valores, la KDE usa binning lineal. */
export const KDE_BIN_MIN = 2048;

/**
 * Densidad por kernel gaussiano. Devuelve [[x, densidad], ...] en una grilla.
 * `cut` extiende la grilla `cut` anchos de banda más allá de los extremos.
 */
export function kde(vs, { bandwidth, adjust = 1, gridSize = 160, extent, cut = 3, clip } = {}) {
  const v = finite(vs);
  if (!v.length) return [];
  const bw = (bandwidth ?? scottBandwidth(v)) * adjust || 1;
  const [vmin, vmax] = extentOf(v);
  let [lo, hi] = extent || [vmin - cut * bw, vmax + cut * bw];
  if (clip) { lo = Math.max(lo, clip[0]); hi = Math.min(hi, clip[1]); }
  const k = 1 / (v.length * bw * Math.sqrt(2 * Math.PI));
  // Muchos valores: binning lineal en ~1024 nodos (cada valor reparte su peso
  // entre los dos nodos vecinos). Error despreciable frente al ancho de banda.
  let xsK = v, ws = null;
  if (v.length > KDE_BIN_MIN && vmax > vmin) {
    const B = 1024, dx = (vmax - vmin) / (B - 1);
    ws = new Float64Array(B);
    for (const xi of v) {
      const t = (xi - vmin) / dx, j = Math.min(B - 2, Math.floor(t)), f = t - j;
      ws[j] += 1 - f; ws[j + 1] += f;
    }
    xsK = Array.from({ length: B }, (_, j) => vmin + j * dx);
  }
  const out = [];
  for (let i = 0; i < gridSize; i++) {
    const x = lo + ((hi - lo) * i) / (gridSize - 1);
    let d = 0;
    if (ws) {
      for (let j = 0; j < xsK.length; j++) { if (!ws[j]) continue; const u = (x - xsK[j]) / bw; if (u > -6 && u < 6) d += ws[j] * Math.exp(-0.5 * u * u); }
    } else for (const xi of v) { const u = (x - xi) / bw; if (u > -6 && u < 6) d += Math.exp(-0.5 * u * u); }
    out.push([x, d * k]);
  }
  return out;
}

/** Función de distribución empírica: [[x, proporción acumulada], ...]. */
export function ecdf(vs) {
  const s = finite(vs).sort((a, b) => a - b);
  return s.map((x, i) => [x, (i + 1) / s.length]);
}

// ── Regresión ──────────────────────────────────────────────────────────────

function solve(A, b) {
  // Gauss-Jordan con pivoteo parcial. Devuelve x tal que A·x = b.
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    const d = M[c][c] || 1e-12;
    for (let k = c; k <= n; k++) M[c][k] /= d;
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  return M.map((row) => row[n]);
}

function inverse(A) {
  const n = A.length;
  return A.map((_, j) => solve(A, A.map((__, i) => (i === j ? 1 : 0)))).reduce((acc, col, j) => {
    col.forEach((v, i) => { acc[i][j] = v; });
    return acc;
  }, A.map(() => new Array(n).fill(0)));
}

/**
 * Regresión polinomial por mínimos cuadrados (order 1 = lineal), con banda de
 * confianza para la media de y. Devuelve { coef, predict(x), band(x) → [lo,hi], r2, n }.
 */
export function polyfit(xs, ys, { order = 1, level = 0.95 } = {}) {
  const pts = xs.map((x, i) => [x, ys[i]]).filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  const n = pts.length;
  const p = order + 1;
  if (n <= p) {
    const my = mean(pts.map((q) => q[1]));
    return { coef: [my], predict: () => my, band: () => [my, my], r2: 0, n };
  }
  // Centrar x mejora la estabilidad numérica.
  const mx = mean(pts.map((q) => q[0]));
  const row = (x) => Array.from({ length: p }, (_, k) => (x - mx) ** k);
  const X = pts.map(([x]) => row(x));
  const XtX = Array.from({ length: p }, (_, i) => Array.from({ length: p }, (_, j) => X.reduce((a, r) => a + r[i] * r[j], 0)));
  const Xty = Array.from({ length: p }, (_, i) => X.reduce((a, r, k) => a + r[i] * pts[k][1], 0));
  const beta = solve(XtX, Xty);
  const predict = (x) => row(x).reduce((a, v, k) => a + v * beta[k], 0);
  const resid = pts.map(([x, y]) => y - predict(x));
  const sse = sum(resid.map((r) => r * r));
  const my = mean(pts.map((q) => q[1]));
  const sst = sum(pts.map(([, y]) => (y - my) ** 2));
  const s2 = sse / (n - p);
  const inv = inverse(XtX);
  const t = tQuantile(n - p, 0.5 + level / 2);
  const band = (x) => {
    const r = row(x);
    let v = 0;
    for (let i = 0; i < p; i++) for (let j = 0; j < p; j++) v += r[i] * inv[i][j] * r[j];
    const h = t * Math.sqrt(Math.max(0, s2 * v));
    const yh = predict(x);
    return [yh - h, yh + h];
  };
  return { coef: beta, center: mx, predict, band, r2: sst ? 1 - sse / sst : 0, n };
}

/** Pearson r. */
export function pearson(xs, ys) {
  const pts = xs.map((x, i) => [x, ys[i]]).filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  const mx = mean(pts.map((p) => p[0])), my = mean(pts.map((p) => p[1]));
  let sxy = 0, sxx = 0, syy = 0;
  for (const [x, y] of pts) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0;
}

/**
 * LOWESS (Cleveland): suavizado local robusto. Devuelve [[x, y], ...] ordenado.
 * Como x está ordenado, los r vecinos más cercanos forman una ventana contigua
 * (dos punteros, sin ordenar distancias). Con muchos puntos (> 400) se ajusta
 * solo en ~200 anclas y se interpola entre ellas (el `delta` de statsmodels).
 */
export function lowess(xs, ys, { frac = 2 / 3, iters = 2, delta } = {}) {
  const pts = xs.map((x, i) => [x, ys[i]]).filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y)).sort((a, b) => a[0] - b[0]);
  const n = pts.length;
  if (n < 3) return pts;
  const X = pts.map((p) => p[0]), Y = pts.map((p) => p[1]);
  const r = Math.min(n, Math.max(2, Math.ceil(frac * n)));
  const dl = delta ?? (n > 400 ? (X[n - 1] - X[0]) / 200 : 0);
  // Anclas: el primero, luego el primer punto a más de `dl` del ancla anterior, y el último.
  const anchors = [0];
  if (dl > 0) {
    for (let i = 1; i < n; i++) if (X[i] > X[anchors[anchors.length - 1]] + dl) anchors.push(i);
    if (anchors[anchors.length - 1] !== n - 1) anchors.push(n - 1);
  } else for (let i = 1; i < n; i++) anchors.push(i);
  let robust = new Array(n).fill(1);
  const fit = new Array(n).fill(0);
  for (let it = 0; it <= iters; it++) {
    let lo = 0;
    for (const i of anchors) {
      const x0 = X[i];
      while (lo + r < n && X[lo + r] - x0 < x0 - X[lo]) lo++;
      const hiI = lo + r - 1;
      const h = Math.max(x0 - X[lo], X[hiI] - x0) || 1e-12;
      let sw = 0, swx = 0, swy = 0, swxx = 0, swxy = 0;
      for (let j = lo; j <= hiI; j++) {
        const u = Math.abs(X[j] - x0) / h;
        const w = u < 1 ? (1 - u ** 3) ** 3 * robust[j] : 0;
        sw += w; swx += w * X[j]; swy += w * Y[j]; swxx += w * X[j] ** 2; swxy += w * X[j] * Y[j];
      }
      const den = sw * swxx - swx * swx;
      fit[i] = Math.abs(den) < 1e-12 ? swy / (sw || 1) : ((swxx * swy - swx * swxy) + (sw * swxy - swx * swy) * x0) / den;
    }
    // Entre anclas: interpolación lineal (mismo x → mismo valor).
    for (let a = 0; a < anchors.length - 1; a++) {
      const i0 = anchors[a], i1 = anchors[a + 1];
      for (let i = i0 + 1; i < i1; i++) {
        const span = X[i1] - X[i0];
        fit[i] = span ? fit[i0] + ((fit[i1] - fit[i0]) * (X[i] - X[i0])) / span : fit[i0];
      }
    }
    const res = pts.map(([, y], i) => Math.abs(y - fit[i]));
    const m = median(res) || 1e-12;
    robust = res.map((e) => { const u = e / (6 * m); return u < 1 ? (1 - u * u) ** 2 : 0; });
  }
  return pts.map(([x], i) => [x, fit[i]]);
}
