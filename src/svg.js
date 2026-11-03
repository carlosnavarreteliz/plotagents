// Constructor mínimo de SVG como texto (funciona en Node y en el navegador).

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

/** Redondea a 2 decimales para SVG compactos. */
export const r2 = (n) => Math.round(n * 100) / 100;

const ATTR_ALIAS = { className: 'class' };
const KEEP_CASE = new Set(['viewBox', 'preserveAspectRatio', 'gradientUnits', 'gradientTransform', 'patternUnits', 'clipPathUnits']);

export function el(tag, attrs = {}, children) {
  let s = '<' + tag;
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    const name = ATTR_ALIAS[k] || (KEEP_CASE.has(k) ? k : k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase()));
    const val = typeof v === 'number' ? r2(v) : v;
    s += ` ${name}="${esc(val)}"`;
  }
  if (children === undefined || children === null || children === '') return s + '/>';
  const inner = Array.isArray(children) ? children.flat(Infinity).filter(Boolean).join('') : children;
  return s + '>' + inner + '</' + tag + '>';
}

export const g = (attrs, children) => el('g', attrs, children);

/** Texto SVG. `children` se escapa. */
export function text(x, y, str, attrs = {}) {
  return el('text', { x, y, ...attrs }, esc(str));
}

/**
 * Barra con extremo de dato redondeado (4px) y base recta.
 * dir: hacia dónde crece la barra: 'up' | 'down' | 'right' | 'left'.
 */
export function barPath(x, y, w, h, dir = 'up', radius = 4) {
  if (w <= 0 || h <= 0) return '';
  const r = Math.max(0, Math.min(radius, (dir === 'up' || dir === 'down' ? w : h) / 2, dir === 'up' || dir === 'down' ? h : w));
  const R = r2;
  const x1 = x + w, y1 = y + h;
  if (r === 0) return `M${R(x)},${R(y)}H${R(x1)}V${R(y1)}H${R(x)}Z`;
  switch (dir) {
    case 'up':
      return `M${R(x)},${R(y1)}V${R(y + r)}Q${R(x)},${R(y)} ${R(x + r)},${R(y)}H${R(x1 - r)}Q${R(x1)},${R(y)} ${R(x1)},${R(y + r)}V${R(y1)}Z`;
    case 'down':
      return `M${R(x)},${R(y)}V${R(y1 - r)}Q${R(x)},${R(y1)} ${R(x + r)},${R(y1)}H${R(x1 - r)}Q${R(x1)},${R(y1)} ${R(x1)},${R(y1 - r)}V${R(y)}Z`;
    case 'right':
      return `M${R(x)},${R(y)}H${R(x1 - r)}Q${R(x1)},${R(y)} ${R(x1)},${R(y + r)}V${R(y1 - r)}Q${R(x1)},${R(y1)} ${R(x1 - r)},${R(y1)}H${R(x)}Z`;
    case 'left':
      return `M${R(x1)},${R(y)}H${R(x + r)}Q${R(x)},${R(y)} ${R(x)},${R(y + r)}V${R(y1 - r)}Q${R(x)},${R(y1)} ${R(x + r)},${R(y1)}H${R(x1)}Z`;
    default:
      return `M${R(x)},${R(y)}H${R(x1)}V${R(y1)}H${R(x)}Z`;
  }
}

/** Texto de tooltip: líneas unidas por \n en un atributo data-tip. */
export const tip = (...lines) => lines.filter((l) => l !== undefined && l !== null && l !== '').join('\n');
