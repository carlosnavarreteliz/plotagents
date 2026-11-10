// Marco común de cada gráfico: título (un hecho), bajada, leyenda, área de
// trazado y línea de fuente chica a la derecha. Nada de cajas ni filetes.
import { el, esc, g, text, r2 } from './svg.js';
import { measure, wrap, truncate } from './text.js';
import { FONT, FONT_CSS } from './theme.js';
import { ctx } from './context.js';
import { words } from './i18n.js';

export const SIZES = {
  title: 22,
  subtitle: 14.5,
  label: 12,
  axis: 12,
  legend: 12.5,
  source: 11,
};

export function createFrame(spec, theme, defaults = {}) {
  // `chrome: false` (sparklines): sin título, bajada ni fuente dibujados (el
  // título sigue en <title> para lectores de pantalla) y sin tamaño mínimo.
  const chrome = defaults.chrome !== false;
  const width = Math.max(defaults.minWidth ?? 240, +spec.width || defaults.width || 720);
  // Con textos más grandes (textScale), el alto por defecto crece para no aplastar los datos.
  const XS = ctx.textScale;
  // En gráficos anchos el alto por defecto crece con el ancho (hasta ~2,8:1),
  // para que una lámina de 1500 px no quede como una franja vacía.
  const h0 = defaults.height || 420;
  const hW = defaults.fixedHeight ? h0 : Math.max(h0, Math.min(Math.round(h0 * 1.35), Math.round(width * 0.36)));
  let height = Math.max(defaults.minHeight ?? 160, +spec.height || Math.round(hW * (1 + 0.55 * (XS - 1))));
  // Responsivo: en pantallas angostas, menos margen y títulos algo menores
  // (nunca bajo 11 px en ejes). El ancho útil es lo que más importa en móvil.
  const k = width < 420 ? 0.86 : width < 560 ? 0.93 : 1;
  const T0 = { ...SIZES, ...(theme.type || {}) };
  const T = { ...T0, title: Math.round(T0.title * k * 2) / 2, subtitle: Math.max(12, Math.round(T0.subtitle * (k < 1 ? 0.95 : 1) * 2) / 2) };
  const pad = spec.padding ?? defaults.padding ?? (width < 420 ? theme.layout?.paddingSmall ?? 12 : width < 640 ? 16 : theme.layout?.padding ?? 24);
  const innerW = width - pad * 2;
  const parts = [];
  let y = pad;

  const tw = T.titleWeight ?? 600;
  const titleLines = chrome && spec.title ? wrap(spec.title, innerW, T.title, tw, 5) : [];
  const subLines = chrome && spec.subtitle ? wrap(spec.subtitle, innerW, T.subtitle, 400, 5) : [];
  const header = [];
  const X = ctx.textScale; // alturas de línea crecen con la escala de texto
  const tlh = Math.round(T.title * X * 1.3), slh = Math.round(T.subtitle * X * 1.42);
  titleLines.forEach((l, i) => {
    header.push(text(pad, y + T.title * X * 0.9 + i * tlh, l, { fill: spec._titleColor ?? theme.ink, fontSize: T.title, fontWeight: tw, letterSpacing: '-0.01em' }));
  });
  if (titleLines.length) y += titleLines.length * tlh + 2;
  subLines.forEach((l, i) => {
    header.push(text(pad, y + T.subtitle * X * 1.0 + i * slh, l, { fill: theme.lede, fontSize: T.subtitle }));
  });
  if (subLines.length) y += subLines.length * slh + 2;
  if (titleLines.length || subLines.length) y += 10;
  // Paneles de un facet: el encabezado de todos mide lo que el más alto, para
  // que el trazado empiece a la misma altura en cada uno.
  if (spec._headerMin > y) y = spec._headerMin;

  const srcText = chrome && spec.source ? (/^(fuente|source|fonte|quelle)/i.test(spec.source) ? spec.source : words(spec.locale).source + spec.source) : '';
  // Una fuente larga salta a una segunda línea en vez de salirse por la izquierda.
  const srcLines = srcText ? wrap(srcText, innerW, T.source, 400, 2) : [];
  const srcLH = Math.round(T.source * X * 1.35);
  const sourceH = srcText ? Math.round(18 * Math.max(1, X * 0.95)) + (srcLines.length - 1) * srcLH : 0;
  const legendPos = legendPosition(spec, width);
  let legendBottom = null; // leyenda inferior: se dibuja en finish(), cuando el alto es definitivo

  const frame = {
    width,
    pad,
    theme,
    legendPosition: legendPos,
    get height() { return height; },
    top: y,
    get bottom() { return height - pad - sourceH - (legendBottom ? legendBottom.h + 12 : 0); },
    /** Alto extra fuera del área de trazado (pie + margen + leyenda inferior). */
    get chrome() { return pad + sourceH + (legendBottom ? legendBottom.h + 12 : 0); },
    /**
     * Dibuja la leyenda y devuelve el área de trazado restante. La leyenda va
     * arriba por defecto; `legend: "bottom" | "left" | "right"` la mueve.
     */
    layout(legend = [], opts = {}) {
      let ly = y;
      const items = withExcluded(legend, spec, theme);
      const extraBottom = Math.max(0, (XS - 1) * 22);
      if (items.length && (legendPos === 'left' || legendPos === 'right')) {
        const colW = Math.min(innerW * 0.32, Math.max(90, legendWidth(items, T.legend)));
        const { svg } = drawLegend(items, legendPos === 'left' ? pad : width - pad - colW, ly + 2, colW, theme, { ...opts, size: T.legend, vertical: true });
        header.push(svg);
        const gap = 16;
        return { x: legendPos === 'left' ? pad + colW + gap : pad, y: ly, w: innerW - colW - gap, h: Math.max(40, frame.bottom - ly - extraBottom) };
      }
      if (items.length && legendPos === 'bottom') {
        const probe = drawLegend(items, pad, 0, innerW, theme, { ...opts, size: T.legend });
        legendBottom = { items, opts, h: probe.h };
        return { x: pad, y: ly, w: innerW, h: Math.max(40, frame.bottom - ly - extraBottom) };
      }
      if (items.length) {
        const { svg, h } = drawLegend(items, pad, ly, innerW, theme, { ...opts, size: T.legend });
        header.push(svg);
        ly += h + 10; // la leyenda pegada al gráfico que explica
      }
      // Banda extra bajo el área para etiquetas y títulos de eje agrandados.
      return { x: pad, y: ly, w: innerW, h: Math.max(40, frame.bottom - ly - extraBottom) };
    },
    /** Permite a gráficos de alto automático (kpi) fijar el alto final. */
    setHeight(h) { height = h; },
    finish(body, { desc = '', type = 'chart', defs = '', role = 'img', css = '', root = null } = {}) {
      if (legendBottom) {
        const { svg } = drawLegend(legendBottom.items, pad, height - pad - sourceH - legendBottom.h - 2, innerW, theme, { ...legendBottom.opts, size: T.legend });
        header.push(svg);
      }
      srcLines.forEach((l, i) => parts.push(text(width - pad, height - pad - 2 - (srcLines.length - 1 - i) * srcLH, l, { fill: theme.muted, fontSize: T.source, textAnchor: 'end' })));
      // Id estable pero distinto entre gráficos sin título del mismo tipo (aria-labelledby).
      // `idPrefix`: una base propia (dos gráficos iguales en una página no se pisan).
      const label = spec.ariaLabel === undefined || spec.ariaLabel === null || spec.ariaLabel === '' ? null : String(spec.ariaLabel);
      const id = spec.idPrefix !== undefined && spec.idPrefix !== null && spec.idPrefix !== '' ? domId(spec.idPrefix)
        : 'pa' + Math.abs(hash((spec.title || '') + type + width + desc + (label ? '|' + label : ''))).toString(36);
      const fontImport = spec.fontImport ? `@import url('${theme.font?.import || FONT_CSS}');` : '';
      const style = `${fontImport}.pa-m{transition:opacity .15s ease}.pa-focus .pa-m{opacity:.28}.pa-focus .pa-m.pa-on{opacity:1}@media (prefers-reduced-motion:reduce){.pa-m{transition:none}}.pa-chart:focus-visible{outline:2px solid ${theme.categorical[0]};outline-offset:2px}`
        + (type === 'network' ? '.pa-focus .pa-net .pa-m{opacity:.12}.pa-focus .pa-net .pa-m.pa-on{opacity:1}' : '')
        + (/^(choropleth|symbolmap|pointmap)$/.test(type) ? '.pa-zoom path,.pa-zoom circle,.pa-zoom rect{vector-effect:non-scaling-stroke}.pa-zoom-hide{transition:opacity .2s ease}.pa-zoomed .pa-zoom-hide{opacity:0}' : '')
        + css;
      return el(
        'svg',
        {
          xmlns: 'http://www.w3.org/2000/svg',
          viewBox: `0 0 ${width} ${r2(height)}`,
          width,
          height: r2(height),
          role,
          'aria-labelledby': role === 'img' ? `${id}-t ${id}-d` : `${id}-t`,
          'aria-describedby': role === 'img' ? null : `${id}-d`,
          fontFamily: spec.fontFamily || theme.font?.family || FONT,
          class: 'pa-chart' + (root?.class ? ' ' + root.class : ''),
          'data-pa-type': type,
          'data-pa-mode': theme.mode,
          'data-pa-lang': String(spec.locale || 'es').slice(0, 2),
          'data-pa-top': r2(frame.top),
          'data-pa-tip': theme.tooltip && (theme.tooltip.bg || theme.tooltip.ink) ? `${theme.tooltip.bg || ''},${theme.tooltip.ink || ''}` : null,
          style: 'max-width:100%;height:auto;font-variant-numeric:lining-nums',
          ...(root ? Object.fromEntries(Object.entries(root).filter(([k]) => k !== 'class')) : {}),
        },
        [
          // `ariaLabel`: el nombre que lee un lector de pantalla, sin dibujar un título.
          el('title', { id: `${id}-t` }, esc(label ?? (spec.title || type))),
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

/** Posición de la leyenda: `legend: "top" | "bottom" | "left" | "right"` (o { position }). */
export function legendPosition(spec, width = 720) {
  const v = typeof spec.legend === 'string' ? spec.legend : spec.legend && typeof spec.legend === 'object' ? spec.legend.position : spec.legendPosition;
  const p = String(v || 'top').toLowerCase();
  const pos = { arriba: 'top', abajo: 'bottom', izquierda: 'left', derecha: 'right' }[p] || p;
  if (!['top', 'bottom', 'left', 'right'].includes(pos)) return 'top';
  // En pantallas angostas una columna lateral roba demasiado ancho: va abajo.
  if ((pos === 'left' || pos === 'right') && width < 520) return 'bottom';
  return pos;
}

/** Entradas excluidas con shift + clic (spec.exclude): siguen en la leyenda, apagadas, para volver a sumarlas. */
function withExcluded(items, spec, theme) {
  const ex = spec._excluded;
  if (!ex || !ex.length || !items.length) return items;
  const have = new Set(items.map((it) => String(it.value ?? it.label)));
  const extra = ex.filter((v) => !have.has(String(v))).map((v) => ({ label: String(v), value: v, color: (spec.colors && spec.colors[v]) || theme.dim, shape: items[0]?.shape === 'line' ? 'line' : items[0]?.shape || 'square', off: true }));
  return [...items, ...extra];
}

function legendWidth(items, size) {
  const X = ctx.textScale;
  return Math.max(...items.map((it) => (it.type === 'ramp' ? 220 : it.type === 'steps' ? 320 : 18 * X + measure(String(it.label), size) + 12)));
}

function drawLegend(items, x0, y0, maxW, theme, opts) {
  const out = [];
  const size = opts.size ?? SIZES.legend;
  const X = ctx.textScale;
  const rowH = Math.round((opts.vertical ? 22 : 20) * X);
  const vertical = !!opts.vertical;
  let x = x0, y = y0, rows = 1;
  for (const it of items) {
    // Clave escalonada (escala por clases): un cuadro por clase y los cortes
    // rotulados debajo, entre cuadro y cuadro. Ocupa dos filas.
    if (it.type === 'steps') {
      if (x > x0) { x = x0; y += rowH; rows++; }
      if (it.title) {
        const tw = Math.min(measure(it.title, size), maxW * 0.45);
        out.push(text(x, y + 10, truncate(it.title, tw, size), { fill: theme.lede, fontSize: size }));
        x += tw + 10;
      }
      const n = it.colors.length, gap = 2;
      const w = Math.max(60, Math.min(x0 + maxW - x, Math.max(140, n * 46)));
      const sw = (w - gap * (n - 1)) / n;
      it.colors.forEach((c, i) => out.push(g({ class: 'pa-key', 'data-color': c, style: 'cursor:pointer' }, [
        el('rect', { x: x + i * (sw + gap), y: y + 1, width: sw, height: 10, rx: i === 0 || i === n - 1 ? 3 : 1, fill: c }),
      ])));
      let last = -Infinity;
      (it.labels || []).forEach((lab, i) => {
        const cx = x + (i + 1) * (sw + gap) - gap / 2;
        const lw = measure(lab, SIZES.axis);
        if (cx - lw / 2 < last + 6) return;
        out.push(text(cx, y + 11 + rowH * 0.8, lab, { fill: theme.muted, fontSize: SIZES.axis, textAnchor: 'middle' }));
        last = cx + lw / 2;
      });
      y += rowH; rows++;
      x = x0 + maxW; // lo que siga empieza en una fila nueva
      continue;
    }
    if (it.type === 'ramp') {
      if (vertical && x > x0) { x = x0; y += rowH; rows++; }
      const w = Math.min(220, maxW);
      const gid = 'pa-ramp-' + Math.abs(hash(it.stops.join(''))).toString(36);
      const stops = it.stops.map((c, i) => el('stop', { offset: `${(i / (it.stops.length - 1)) * 100}%`, stopColor: c }));
      out.push(el('defs', {}, el('linearGradient', { id: gid }, stops)));
      if (it.title) {
        out.push(text(x, y + 10, it.title, { fill: theme.lede, fontSize: size }));
        if (vertical) { y += rowH; rows++; } else x += measure(it.title, size) + 10;
      }
      out.push(text(x, y + 10, it.min, { fill: theme.muted, fontSize: SIZES.axis }));
      x += measure(it.min, SIZES.axis) + 6;
      const rw = vertical ? Math.max(40, Math.min(w * 0.6, maxW - (x - x0) - measure(it.max, SIZES.axis) - 6)) : w * 0.6;
      out.push(el('rect', { x, y: y + 2, width: rw, height: 10, rx: 5, fill: `url(#${gid})` }));
      x += rw + 6;
      out.push(text(x, y + 10, it.max, { fill: theme.muted, fontSize: SIZES.axis }));
      x += measure(it.max, SIZES.axis) + 18;
      continue;
    }
    const sw = 10 * Math.min(1.6, X);
    let label = String(it.label);
    if (vertical) label = truncate(label, maxW - sw - 10, size);
    const w = 18 * X + measure(label, size) + 18;
    if ((vertical || x + w > x0 + maxW) && x > x0) { x = x0; y += rowH; rows++; }
    const cy = y + 6.5 * X;
    const v = it.value !== undefined ? it.value : it.key ? undefined : it.label;
    const val = v !== undefined ? ` data-value="${esc(String(v))}"` : '';
    const faded = it.off ? 0.45 : it.active === false ? 0.5 : null;
    out.push(`<g class="pa-key${it.off ? ' pa-key-off' : ''}" data-color="${esc(it.key ?? it.color)}"${val}${it.active ? ' aria-pressed="true"' : ''}${faded ? ` opacity="${faded}"` : ''} style="cursor:pointer">`);
    out.push(el('rect', { x: x - 3, y: y - 3, width: w - 10, height: rowH - 1, rx: 4, fill: 'transparent' }));
    // Entradas punteadas: línea discontinua o cuadro rayado con borde discontinuo.
    if (it.off) out.push(el('rect', { x: x + 0.75, y: cy - sw / 2 + 0.75, width: sw - 1.5, height: sw - 1.5, rx: 2, fill: 'none', stroke: it.color, strokeWidth: 1.5 }));
    else if (it.shape === 'line') out.push(el('line', { x1: x, x2: x + sw * 1.2, y1: cy, y2: cy, stroke: it.color, strokeWidth: 2.5, strokeLinecap: it.dashed ? 'butt' : 'round', strokeDasharray: it.dashed ? '4 2.5' : null }));
    else if (it.shape === 'square' && it.dashed) out.push(el('rect', { x: x + 0.6, y: cy - sw / 2 + 0.6, width: sw - 1.2, height: sw - 1.2, rx: 2, fill: it.fill || it.color, stroke: it.stroke || it.color, strokeWidth: 1.2, strokeDasharray: '3 2' }));
    else if (it.shape === 'square') out.push(el('rect', { x, y: cy - sw / 2, width: sw, height: sw, rx: 2.5, fill: it.color }));
    else if (it.shape === 'none') { /* una nota en la leyenda (p. ej. «1 cuadro = 10»): sin marca */ }
    else out.push(el('circle', { cx: x + sw / 2, cy, r: sw / 2, fill: it.color }));
    out.push(text(x + sw + 6, y + 11 * X, label, { fill: theme.lede, fontSize: size, textDecoration: it.off ? 'line-through' : null }));
    out.push('</g>');
    x += w;
  }
  return { svg: g({ class: 'pa-legend' }, out), h: rows * rowH - 6 * X };
}

/** Un id de SVG/CSS a partir de lo que dé quien llama (letras, dígitos, - y _). */
export const domId = (v) => { const s = String(v).replace(/[^A-Za-z0-9_-]+/g, '-'); return /^[A-Za-z_]/.test(s) ? s : 'pa-' + s; };

export function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}
