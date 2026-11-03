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

// Tokens no cromáticos, compartidos por ambos temas y configurables por JSON.
const STRUCT = {
  font: { family: FONT, mono: MONO, import: FONT_CSS },
  type: { title: 22, subtitle: 14.5, label: 12, axis: 11.5, legend: 12.5, source: 11, titleWeight: 600 },
  marks: { barRadius: 4, barMax: 36, barMaxH: 22, lineWidth: 2.25, pointRadius: 4, gap: 2, ring: 2, areaOpacity: 0.12, bandOpacity: 0.16, dotOpacity: 0.85 },
  axes: { inside: true, grid: true },
  layout: { padding: 24, paddingSmall: 12 },
};

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
  ...STRUCT,
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
  ...STRUCT,
};

export const themes = { papel, noche, light: papel, dark: noche };

// Paletas con nombre (categóricas). La de fábrica está validada; las demás
// son conocidas y se pueden revisar con validatePalette().
export const palettes = {
  cdia: papel.categorical,
  'cdia-noche': noche.categorical,
  'okabe-ito': ['#0072B2', '#E69F00', '#009E73', '#CC79A7', '#56B4E9', '#D55E00', '#F0E442', '#000000'],
  tableau10: ['#4E79A7', '#F28E2B', '#E15759', '#76B7B2', '#59A14F', '#EDC948', '#B07AA1', '#FF9DA7', '#9C755F', '#BAB0AC'],
  udec: ['#223C6A', '#E69B0A', '#D21428', '#5C7DB8'],
};
// Rampas secuenciales (un tono, claro → oscuro) y divergentes.
export const ramps = {
  indigo: papel.sequential,
  magenta: ['#FBEAF0', '#F6CADA', '#EE9DBA', '#E46F98', '#D42A5E', '#A81F4A', '#7A1636', '#4D0E22'],
  teal: ['#E6F5F2', '#C2E8E1', '#8CD3C6', '#52BBA8', '#1E9C89', '#167A6B', '#0F5A4F', '#093B34'],
  amber: ['#FDF3E1', '#F9E0B5', '#F4C77E', '#EEAD4E', '#E8A33D', '#BF7F1F', '#8C5C14', '#5C3C0C'],
  'indigo-magenta': papel.diverging,
  'teal-rust': ['#0F5A4F', '#1E9C89', '#8CD3C6', '#ECEBE6', '#E8B49A', '#C46A3F', '#7F3A1B'],
};

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
export function deepMerge(base, over) {
  if (!isObj(over)) return base;
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) {
    if (UNSAFE_KEYS.has(k)) continue;
    out[k] = isObj(v) && isObj(base[k]) ? deepMerge(base[k], v) : v;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Saneamiento: el spec puede venir de un agente o de un usuario, y el SVG
// termina incrustado en HTML. Todo color, familia tipográfica o URL que el
// spec aporte pasa por aquí antes de llegar al marcado o al CSS.

// Hex, nombres CSS y funciones de color (rgb, hsl, oklch…). Nada de comillas,
// `<`, `;`, `url(` ni `var(`: un color nunca puede cerrar un atributo ni
// cargar un recurso externo.
const COLOR_RE = /^(#[0-9a-f]{3,8}|[a-z]{3,30}|(rgba?|hsla?|hwb|lab|lch|oklab|oklch)\([0-9a-z\s.,%/+-]{1,80}\))$/i;
const COLOR_WORDS_BLOCKED = new Set(['url', 'var', 'expression', 'inherit', 'initial', 'unset', 'revert']);

/** Devuelve `c` si es un color CSS seguro; si no, `fallback`. */
export function safeColor(c, fallback) {
  if (typeof c !== 'string') return fallback;
  const v = c.trim();
  if (!COLOR_RE.test(v) || COLOR_WORDS_BLOCKED.has(v.toLowerCase())) return fallback;
  return v;
}

/** Familia CSS segura: solo letras, dígitos, espacios, comas, comillas simples y guiones. */
export function safeFontFamily(f, fallback = FONT) {
  if (typeof f !== 'string') return fallback;
  const v = f.replace(/"/g, "'").trim();
  return v && v.length <= 300 && /^[\p{L}\p{N}\s,'._-]+$/u.test(v) ? v : fallback;
}

/** URL de hoja de estilos segura: http(s), sin comillas, espacios ni `<>()`. */
export function safeUrl(u) {
  if (typeof u !== 'string') return undefined;
  const v = u.trim();
  return /^https?:\/\/[^\s"'<>()\\`]+$/i.test(v) && v.length <= 2000 ? v : undefined;
}

const COLOR_KEYS = ['surface', 'ink', 'lede', 'muted', 'grid', 'axis', 'tint', 'tint2', 'dim', 'other'];
const colorList = (list, fallback) => {
  if (!Array.isArray(list)) return fallback;
  const out = list.map((c, i) => safeColor(c, fallback[i % fallback.length])).slice(0, 64);
  return out.length ? out : fallback;
};

/** Tema con todos sus colores, fuentes y URLs saneados (vuelve a papel/noche si algo no sirve). */
function sanitizeTheme(t) {
  const ref = t.mode === 'dark' ? noche : papel;
  const out = { ...t };
  for (const k of COLOR_KEYS) out[k] = safeColor(t[k], ref[k]);
  out.categorical = colorList(t.categorical, ref.categorical);
  out.sequential = colorList(t.sequential, ref.sequential);
  out.diverging = colorList(t.diverging, ref.diverging);
  out.status = { ...ref.status };
  if (isObj(t.status)) for (const k of Object.keys(ref.status)) out.status[k] = safeColor(t.status[k], ref.status[k]);
  const f = isObj(t.font) ? t.font : {};
  out.font = { ...f, family: safeFontFamily(f.family, FONT), mono: safeFontFamily(f.mono, MONO), import: safeUrl(f.import) };
  out.mode = t.mode === 'dark' ? 'dark' : 'light';
  if (typeof out.link !== 'number' || !Number.isFinite(out.link)) out.link = ref.link;
  return out;
}

/** Mapa entidad → color con prototipo nulo: "toString" o "constructor" no heredan nada. */
export function safeColorMap(colors) {
  const out = Object.create(null);
  if (!isObj(colors)) return out;
  for (const [k, v] of Object.entries(colors)) {
    const c = safeColor(v);
    if (c) out[k] = c;
  }
  return out;
}

/** Lectura de un mapa de colores sin heredar de Object.prototype. */
export const own = (map, k) => (map && Object.prototype.hasOwnProperty.call(map, k) ? map[k] : undefined);

/**
 * Tema = JSON. Acepta un nombre ("papel", "noche") o un objeto parcial que se
 * fusiona en profundidad sobre `extends` (por defecto "papel"):
 *   { extends: "noche", categorical: ["#..."], type: { title: 24 }, marks: { lineWidth: 3 } }
 * `categorical`, `sequential` y `diverging` aceptan también un nombre de paleta.
 */
export function getTheme(t) {
  if (!t) return papel;
  if (typeof t === 'string') return Object.prototype.hasOwnProperty.call(themes, t) ? themes[t] : papel;
  return sanitizeTheme(mergeTheme(t));
}

function mergeTheme(t) {
  const has = (lib, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(lib, k);
  const base = has(themes, t.extends) ? themes[t.extends] : t.mode === 'dark' ? noche : papel;
  const merged = deepMerge(base, t);
  if (typeof merged.categorical === 'string') merged.categorical = has(palettes, merged.categorical) ? palettes[merged.categorical] : base.categorical;
  if (typeof merged.sequential === 'string') merged.sequential = has(ramps, merged.sequential) ? ramps[merged.sequential] : base.sequential;
  if (typeof merged.diverging === 'string') merged.diverging = has(ramps, merged.diverging) ? ramps[merged.diverging] : base.diverging;
  return merged;
}

/** Tema efectivo de un spec: `theme` + atajos `palette` y `ramp`. */
export function themeFor(spec = {}) {
  let t = getTheme(spec.theme);
  const named = (lib, k) => (typeof k === 'string' && Object.prototype.hasOwnProperty.call(lib, k) ? lib[k] : undefined);
  if (spec.palette) t = { ...t, categorical: Array.isArray(spec.palette) ? colorList(spec.palette, t.categorical) : named(palettes, spec.palette) || t.categorical };
  if (spec.ramp) t = { ...t, sequential: Array.isArray(spec.ramp) ? colorList(spec.ramp, t.sequential) : named(ramps, spec.ramp) || t.sequential };
  return t;
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
    const fixed = safeColor(own(overrides, k));
    if (fixed) map.set(k, fixed);
    else map.set(k, i < theme.categorical.length ? theme.categorical[i] : theme.other);
    if (!fixed) i++;
  }
  return map;
}

/**
 * Versión legible de un color de serie para usarlo en TEXTO: lo oscurece
 * (o aclara, en tema oscuro) hasta ≥ 4,5:1 contra el fondo. Así una etiqueta
 * puede llevar el color de su línea sin perder legibilidad.
 */
export function readable(color, theme, min = 4.5) {
  const target = theme.mode === 'dark' ? '#FFFFFF' : theme.ink;
  let c = color;
  for (let t = 0; t <= 1.0001 && contrast(c, theme.surface) < min; t += 0.05) {
    const A = hexToRgb(color), B = hexToRgb(target);
    c = rgbToHex(A.map((v, i) => v + (B[i] - v) * t));
  }
  return c;
}

/**
 * Tipografía a partir de un nombre: "Poppins" → pila con respaldo y la URL de
 * Google Fonts para cargarla. Una pila completa ("'Inter', sans-serif") se usa
 * tal cual. También acepta { family, import }.
 */
export function fontSpec(font) {
  if (!font) return null;
  if (typeof font === 'object') return { ...font };
  const f = String(font).trim();
  if (/[,'"]/.test(f)) return { family: f };
  const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(f).replace(/%20/g, '+')}:wght@400;500;600;700&display=swap`;
  return { family: `'${f}', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`, import: url };
}
