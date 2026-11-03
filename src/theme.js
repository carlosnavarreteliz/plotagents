// Temas de plotagents.
//
// Las paletas categóricas están validadas (no a ojo) con el validador de
// paletas OKLab: banda de luminosidad, piso de croma, separación bajo
// daltonismo (protan/deutan) entre vecinos y piso de visión normal.
//   papel  · adyacentes ΔE CVD 13,7 · visión normal 22,6 · primeros 3 todos-los-pares 16,5
//   noche  · adyacentes ΔE CVD 9,1  · visión normal 19,6 · primeros 3 todos-los-pares 9,1
// El ORDEN de los colores es parte de la seguridad: no lo cambies sin volver
// a validar.

export const FONT =
  "'Mozilla Text', 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
export const MONO = "'Fragment Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace";
export const FONT_CSS =
  'https://fonts.googleapis.com/css2?family=Mozilla+Text:wght@400;500;600;700&display=swap';

const papel = {
  name: 'papel',
  mode: 'light',
  surface: '#FCFBF9',
  ink: '#141A3F',
  lede: '#4A5070',
  muted: '#7C819C',
  grid: '#E9EBF3',
  axis: '#C9CDE0',
  tint: '#ECEEF8',
  tint2: '#D9DDF3',
  dim: '#CDD1E3', // marcas fuera de foco (highlight)
  other: '#A5AAC0', // "Otros"
  link: 0.32,
  categorical: [
    '#3A47B8', // índigo
    '#D42A5E', // magenta
    '#E8A33D', // ámbar
    '#1E9C89', // turquesa
    '#7B5CD6', // violeta
    '#B5562E', // óxido
    '#5BA3E0', // cielo
    '#8E9A2F', // oliva
  ],
  // Secuencial: un solo tono, claro → oscuro.
  sequential: ['#EEF0FA', '#D9DDF3', '#B3BAE8', '#8590D8', '#5A66C7', '#3A47B8', '#26307F', '#141A3F'],
  // Divergente: índigo ↔ gris neutro ↔ magenta.
  diverging: ['#26307F', '#5A66C7', '#A9B0E2', '#ECEBE6', '#EFA9BE', '#D9557E', '#9E1D45'],
  status: { good: '#178A68', warning: '#B87A00', critical: '#C9531A' },
};

const noche = {
  name: 'noche',
  mode: 'dark',
  surface: '#0B0F2B',
  ink: '#F2F3FA',
  lede: '#B4BAE0',
  muted: '#8A90B4',
  grid: '#1B2147',
  axis: '#2E3666',
  tint: '#151A3D',
  tint2: '#1F2654',
  dim: '#2A3160',
  other: '#4A5280',
  link: 0.4,
  categorical: ['#6170E0', '#E63369', '#C4851C', '#22A892', '#9780E8', '#D06A3E', '#499BDA', '#909D2D'],
  sequential: ['#141A3F', '#1F2862', '#2C3888', '#3A47B8', '#6170E0', '#8E99EA', '#BEC5F3', '#E6E9FB'],
  diverging: ['#BEC5F3', '#7F8BE6', '#3F4CA8', '#2A2E48', '#A3294F', '#E8577F', '#F7B3C7'],
  status: { good: '#2BB38A', warning: '#E0A030', critical: '#E8743F' },
};

export const themes = { papel, noche, light: papel, dark: noche };

export function getTheme(t) {
  if (!t) return papel;
  if (typeof t === 'string') return themes[t] || papel;
  const base = themes[t.extends] || papel;
  return { ...base, ...t, status: { ...base.status, ...(t.status || {}) } };
}

// ---------------------------------------------------------------------------
// Utilidades de color

export function hexToRgb(hex) {
  let h = String(hex).replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]) {
  const f = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return ('#' + f(r) + f(g) + f(b)).toUpperCase();
}

const lin = (c) => {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const delin = (c) => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

export function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Texto blanco o tinta según qué contraste mejor sobre el relleno. */
export function textOn(fill, theme) {
  const dark = theme.mode === 'dark' ? '#0B0F2B' : theme.ink;
  return contrast('#FFFFFF', fill) >= contrast(dark, fill) ? '#FFFFFF' : dark;
}

/** Interpola en RGB lineal a lo largo de una rampa de colores. t ∈ [0,1]. */
export function ramp(stops, t) {
  t = Math.max(0, Math.min(1, Number.isFinite(t) ? t : 0));
  const p = t * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(p));
  const f = p - i;
  const a = hexToRgb(stops[i]).map(lin);
  const b = hexToRgb(stops[i + 1]).map(lin);
  return rgbToHex(a.map((v, k) => delin(v + (b[k] - v) * f)));
}

/**
 * Asigna colores a entidades en orden fijo. El color sigue a la entidad,
 * nunca a su posición: pasar `colors: {"Biobío": "#..."}` fija el color.
 * Más allá de 8 entidades no se inventan tonos: el resto va en gris "Otros".
 */
export function colorMap(keys, theme, overrides = {}) {
  const map = new Map();
  let i = 0;
  for (const k of keys) {
    if (overrides && overrides[k]) map.set(k, overrides[k]);
    else map.set(k, i < theme.categorical.length ? theme.categorical[i] : theme.other);
    if (!(overrides && overrides[k])) i++;
  }
  return map;
}
