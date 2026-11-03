// Validador de paletas categóricas: lo mismo que se usó para validar las
// paletas de fábrica, disponible para que un agente revise la suya.
// Umbrales: banda de luminosidad OKLCH, croma mínimo, separación ΔE (OKLab×100)
// entre vecinos bajo protanopía/deuteranopía (Machado 2009) y con visión normal.

const BAND = { light: [0.43, 0.77], dark: [0.48, 0.67] };
const CHROMA_FLOOR = 0.1;
const CVD_TARGET = 8, CVD_FLOOR = 6, NORMAL_FLOOR = 15;
const MACHADO = {
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
};

const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const rgbLin = (hex) => { const h = hex.replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(lin); };
function oklab([r, g, b]) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
const sim = (rgb, M) => M.map((row) => Math.max(0, Math.min(1, row[0] * rgb[0] + row[1] * rgb[1] + row[2] * rgb[2])));
function dE(a, b, kind) {
  let A = rgbLin(a), B = rgbLin(b);
  if (kind) { A = sim(A, MACHADO[kind]); B = sim(B, MACHADO[kind]); }
  const p = oklab(A), q = oklab(B);
  return 100 * Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}
const lum = (hex) => { const [r, g, b] = rgbLin(hex); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

/**
 * Revisa una paleta categórica. Devuelve { ok, checks: [{ name, status, detail }] }.
 * status: 'pass' | 'warn' | 'fail'. `pairs: 'all'` para dispersión y mapas.
 */
export function validatePalette(colors, { mode = 'light', surface, pairs = 'adjacent' } = {}) {
  const pal = colors.map(String);
  surface = surface || (mode === 'dark' ? '#0B0F2B' : '#FCFBF9');
  const checks = [];
  const [lo, hi] = BAND[mode] || BAND.light;
  const Ls = pal.map((c) => oklab(rgbLin(c)));
  const off = pal.filter((c, i) => Ls[i][0] < lo || Ls[i][0] > hi);
  checks.push({ name: 'lightness', status: off.length ? 'fail' : 'pass', detail: off.length ? `Fuera de la banda de luminosidad ${lo}–${hi}: ${off.join(', ')}` : 'Todos dentro de la banda de luminosidad.' });
  const gray = pal.filter((c, i) => Math.hypot(Ls[i][1], Ls[i][2]) < CHROMA_FLOOR);
  checks.push({ name: 'chroma', status: gray.length ? 'fail' : 'pass', detail: gray.length ? `Se leen como gris: ${gray.join(', ')}` : 'Todos con color suficiente.' });
  const list = pairs === 'all' ? pal.flatMap((_, i) => pal.slice(i + 1).map((__, k) => [i, i + 1 + k])) : pal.slice(1).map((_, i) => [i, i + 1]);
  let worst = null, nworst = null;
  for (const [i, j] of list) {
    for (const k of ['protan', 'deutan']) { const d = dE(pal[i], pal[j], k); if (!worst || d < worst[0]) worst = [d, pal[i], pal[j], k]; }
    const n = dE(pal[i], pal[j]);
    if (!nworst || n < nworst[0]) nworst = [n, pal[i], pal[j]];
  }
  if (worst) checks.push({ name: 'cvd', status: worst[0] >= CVD_TARGET ? 'pass' : worst[0] >= CVD_FLOOR ? 'warn' : 'fail', detail: `Peor par para daltonismo (${worst[3]}): ${worst[1]} ↔ ${worst[2]}, ΔE ${worst[0].toFixed(1)} (meta ≥ ${CVD_TARGET}).` });
  if (nworst) checks.push({ name: 'normal', status: nworst[0] >= NORMAL_FLOOR ? 'pass' : 'fail', detail: `Peor par con visión normal: ${nworst[1]} ↔ ${nworst[2]}, ΔE ${nworst[0].toFixed(1)} (mínimo ${NORMAL_FLOOR}).` });
  const low = pal.filter((c) => contrast(c, surface) < 3);
  checks.push({ name: 'contrast', status: low.length ? 'warn' : 'pass', detail: low.length ? `Bajo 3:1 contra el fondo (usa etiquetas visibles): ${low.join(', ')}` : 'Todos ≥ 3:1 contra el fondo.' });
  return { ok: !checks.some((c) => c.status === 'fail'), checks };
}
