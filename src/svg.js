// Constructor mínimo de SVG como texto (funciona en Node y en el navegador).

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

/** Redondea a 2 decimales para SVG compactos. */
export const r2 = (n) => Math.round(n * 100) / 100;

const ATTR_ALIAS = { className: 'class' };
const KEEP_CASE = new Set(['viewBox', 'preserveAspectRatio', 'gradientUnits', 'gradientTransform', 'patternUnits', 'patternTransform', 'patternContentUnits', 'clipPathUnits', 'refX', 'refY', 'markerWidth', 'markerHeight', 'markerUnits', 'textLength', 'lengthAdjust', 'startOffset']);

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

/**
 * Capa de puntos. Con pocos puntos, un <circle> por punto (tooltip propio).
 * Con muchos (> threshold), un solo <path> por estilo —los círculos como
 * arcos— y una capa invisible que busca el punto más cercano al pasar el
 * mouse. Es tan rápido como Canvas y conserva lo vectorial (ver docs).
 */
export function dotLayer(circles, { threshold = 1500, maxTips = 20000 } = {}) {
  if (circles.length <= threshold) return circles.map((c) => el('circle', c)).join('');
  const groups = new Map();
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const near = [];
  for (const c of circles) {
    const k = [c.fill, c.fillOpacity, c.r, c.stroke, c.strokeWidth].join('|');
    if (!groups.has(k)) groups.set(k, { attrs: c, d: [] });
    const r = +c.r, cx = +c.cx, cy = +c.cy;
    groups.get(k).d.push(`M${r2(cx - r)},${r2(cy)}a${r},${r} 0 1,0 ${r2(2 * r)},0a${r},${r} 0 1,0 ${r2(-2 * r)},0`);
    x0 = Math.min(x0, cx - r); y0 = Math.min(y0, cy - r); x1 = Math.max(x1, cx + r); y1 = Math.max(y1, cy + r);
    if (near.length < maxTips) near.push([r2(cx), r2(cy), c['data-tip'] || '', c.fill]);
  }
  const paths = [...groups.values()].map(({ attrs, d }) =>
    el('path', { d: d.join(''), fill: attrs.fill, fillOpacity: attrs.fillOpacity, stroke: attrs.stroke && attrs.stroke !== 'none' ? attrs.stroke : null, strokeWidth: attrs.stroke && attrs.stroke !== 'none' ? Math.min(+attrs.strokeWidth || 1, 0.75) : null }));
  const hover = el('rect', { class: 'pa-near', x: x0, y: y0, width: Math.max(1, x1 - x0), height: Math.max(1, y1 - y0), fill: 'transparent', 'data-near': JSON.stringify(near) });
  return g({ class: 'pa-dense' }, [...paths, hover]);
}
