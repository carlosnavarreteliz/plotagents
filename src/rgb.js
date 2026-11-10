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
