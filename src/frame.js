// Marco común de cada gráfico: título (un hecho), bajada, leyenda, área de
// trazado y línea de fuente chica a la derecha. Nada de cajas ni filetes.
import { el, esc, g, text, r2 } from './svg.js';
import { measure, wrap } from './text.js';
import { FONT, FONT_CSS } from './theme.js';

export const SIZES = {
  title: 20,
  subtitle: 14,
  label: 12,
  axis: 12,
  legend: 12.5,
  source: 11,
};

export function createFrame(spec, theme, defaults = {}) {
  const width = Math.max(240, +spec.width || defaults.width || 720);
  let height = Math.max(160, +spec.height || defaults.height || 420);
  const pad = spec.padding ?? (width < 420 ? 16 : 24);
  const innerW = width - pad * 2;
  const parts = [];
  let y = pad;

  const titleLines = spec.title ? wrap(spec.title, innerW, SIZES.title, 600, 2) : [];
  const subLines = spec.subtitle ? wrap(spec.subtitle, innerW, SIZES.subtitle, 400, 3) : [];
  const header = [];
  titleLines.forEach((l, i) => {
    header.push(text(pad, y + 18 + i * 26, l, { fill: theme.ink, fontSize: SIZES.title, fontWeight: 600, letterSpacing: '-0.01em' }));
  });
  if (titleLines.length) y += titleLines.length * 26 + 2;
  subLines.forEach((l, i) => {
    header.push(text(pad, y + 14 + i * 20, l, { fill: theme.lede, fontSize: SIZES.subtitle }));
  });
  if (subLines.length) y += subLines.length * 20 + 2;
  if (titleLines.length || subLines.length) y += 12;

  const sourceH = spec.source ? 22 : 0;

  const frame = {
    width,
    pad,
    theme,
    get height() { return height; },
    top: y,
    get bottom() { return height - pad - sourceH; },
    /** Alto extra fuera del área de trazado (pie + margen). */
    chrome: pad + sourceH,
    /** Dibuja la leyenda y devuelve el área de trazado restante. */
    layout(legend = [], opts = {}) {
      let ly = y;
      if (legend && legend.length) {
        const { svg, h } = drawLegend(legend, pad, ly, innerW, theme, opts);
        header.push(svg);
        ly += h + 14;
      }
      return { x: pad, y: ly, w: innerW, h: Math.max(40, frame.bottom - ly) };
    },
    /** Permite a gráficos de alto automático (kpi) fijar el alto final. */
    setHeight(h) { height = h; },
    finish(body, { desc = '', type = 'chart', defs = '' } = {}) {
      if (spec.source) {
        const src = /^fuente|^source/i.test(spec.source) ? spec.source : (String(spec.locale || 'es').startsWith('en') ? 'Source: ' : 'Fuente: ') + spec.source;
        parts.push(text(width - pad, height - pad - 2, src, { fill: theme.muted, fontSize: SIZES.source, textAnchor: 'end' }));
      }
      const id = 'pa' + Math.abs(hash((spec.title || '') + type + width)).toString(36);
      const fontImport = spec.fontImport ? `@import url('${FONT_CSS}');` : '';
      const style = `${fontImport}.pa-m{transition:opacity .15s ease}.pa-focus .pa-m{opacity:.28}.pa-focus .pa-m.pa-on{opacity:1}`;
      return el(
        'svg',
        {
          xmlns: 'http://www.w3.org/2000/svg',
          viewBox: `0 0 ${width} ${r2(height)}`,
          width,
          height: r2(height),
          role: 'img',
          'aria-labelledby': `${id}-t ${id}-d`,
          fontFamily: spec.fontFamily || FONT,
          class: 'pa-chart',
          'data-pa-type': type,
          'data-pa-mode': theme.mode,
          style: 'max-width:100%;height:auto;font-variant-numeric:lining-nums',
        },
        [
          el('title', { id: `${id}-t` }, esc(spec.title || type)),
          el('desc', { id: `${id}-d` }, esc(desc)),
          el('style', {}, style),
          defs ? el('defs', {}, defs) : '',
          spec.background === false ? '' : el('rect', { width, height: r2(height), fill: theme.surface }),
          g({ class: 'pa-header' }, header),
          g({ class: 'pa-body' }, body),
          parts.join(''),
        ]
      );
    },
  };
  return frame;
}

function drawLegend(items, x0, y0, maxW, theme, opts) {
  const out = [];
  const size = SIZES.legend;
  const rowH = 20;
  let x = x0, y = y0, rows = 1;
  for (const it of items) {
    if (it.type === 'ramp') {
      const w = Math.min(220, maxW);
      const gid = 'pa-ramp-' + Math.abs(hash(it.stops.join(''))).toString(36);
      const stops = it.stops.map((c, i) => el('stop', { offset: `${(i / (it.stops.length - 1)) * 100}%`, stopColor: c }));
      out.push(el('defs', {}, el('linearGradient', { id: gid }, stops)));
      if (it.title) { out.push(text(x, y + 10, it.title, { fill: theme.lede, fontSize: size })); x += measure(it.title, size) + 10; }
      out.push(text(x, y + 10, it.min, { fill: theme.muted, fontSize: SIZES.axis }));
      x += measure(it.min, SIZES.axis) + 6;
      out.push(el('rect', { x, y: y + 2, width: w * 0.6, height: 10, rx: 5, fill: `url(#${gid})` }));
      x += w * 0.6 + 6;
      out.push(text(x, y + 10, it.max, { fill: theme.muted, fontSize: SIZES.axis }));
      x += measure(it.max, SIZES.axis) + 18;
      continue;
    }
    const label = String(it.label);
    const w = 18 + measure(label, size) + 18;
    if (x + w > x0 + maxW && x > x0) { x = x0; y += rowH; rows++; }
    const cy = y + 6.5;
    if (it.shape === 'line') out.push(el('line', { x1: x, x2: x + 12, y1: cy, y2: cy, stroke: it.color, strokeWidth: 2.5, strokeLinecap: 'round' }));
    else if (it.shape === 'square') out.push(el('rect', { x, y: cy - 5, width: 10, height: 10, rx: 2.5, fill: it.color }));
    else out.push(el('circle', { cx: x + 5, cy, r: 5, fill: it.color }));
    out.push(text(x + 16, y + 11, label, { fill: theme.lede, fontSize: size }));
    x += w;
  }
  return { svg: g({ class: 'pa-legend' }, out), h: rows * rowH - 6 };
}

export function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}
