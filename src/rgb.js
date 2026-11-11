// Lectura de colores, sin dependencias (la usan theme, colorscales y palette).

/**
 * [r, g, b] de un color hex (#abc, #aabbcc, #aabbccdd) o rgb()/rgba(). Todo
 * cálculo de color pasa por aquí: un `rgb(…)` que llega como hex roto da negro,
 * y un texto negro sobre una barra oscura es un rótulo que no se lee.
 */
export function parseRgb(color) {
  const c = String(color ?? '').trim();
  const m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i.exec(c);
  if (m) return [+m[1], +m[2], +m[3]].map((v) => Math.max(0, Math.min(255, Math.round(v))));
  let h = c.replace('#', '');
  if (h.length === 3 || h.length === 4) h = h.slice(0, 3).split('').map((x) => x + x).join('');
  const n = parseInt(h.slice(0, 6), 16);
  return Number.isFinite(n) ? [(n >> 16) & 255, (n >> 8) & 255, n & 255] : [0, 0, 0];
}

// Colores válidos: hex, rgb()/hsl() y nombres CSS. Cualquier otra cosa se
// descarta: los colores viajan a atributos, CSS y tooltips (sin inyección).
const COLOR_RE = /^(#[0-9a-f]{3,8}|(rgba?|hsla?)\([\d\s.,%/+-]+\)|[a-z]{3,20}|transparent|none)$/i;
export const isColor = (c) => typeof c === 'string' && COLOR_RE.test(c.trim());

// ── Matemática de color compartida (theme, palette, colorscales) ───────────
/** Canal sRGB 0–255 → lineal 0–1. */
export const lin = (c) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/** [r, g, b] 0–255 → '#RRGGBB' (redondeado y acotado). */
export function rgbToHex([r, g, b]) {
  const f = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return ('#' + f(r) + f(g) + f(b)).toUpperCase();
}

/** Luminancia relativa WCAG. */
export function luminance(color) {
  const [r, g, b] = parseRgb(color).map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Razón de contraste WCAG entre dos colores. */
export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** RGB lineal → OKLab. */
export function oklab([r, g, b]) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
