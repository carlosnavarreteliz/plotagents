// Small multiples (seaborn: col / col_wrap): un panel por valor de `facet`,
// con escalas y colores compartidos y una sola leyenda. Es la alternativa
// correcta a 8 líneas enredadas o a un doble eje.
import { el, g } from './svg.js';
import { createFrame } from './frame.js';
import { colorMap } from './theme.js';
import { ensureData, requireField, uniq, fieldKind, num } from './data.js';
import { niceDomain } from './scale.js';

const LINE_LIKE = new Set(['line', 'area', 'kde', 'ecdf', 'point', 'regplot', 'residplot']);

export function facet(spec, theme, renderOne) {
  const data = ensureData(spec);
  const f = spec.facet ?? spec.col;
  requireField(data, f, 'facet');
  let keys = uniq(data.map((r) => String(r[f])));
  const fk = fieldKind(data, f);
  if (fk === 'year' || fk === 'number') keys.sort((a, b) => num(a) - num(b));
  if (spec.facetOrder) keys = [...spec.facetOrder.map(String).filter((k) => keys.includes(k)), ...keys.filter((k) => !spec.facetOrder.map(String).includes(k))];

  // Colores globales: la misma serie tiene el mismo color en todos los paneles.
  const sf = spec.series ?? spec.hue ?? (typeof spec.color === 'string' && !spec.color.startsWith('#') ? spec.color : null);
  const colors = { ...(spec.colors || {}) };
  let legend = [];
  if (sf && data.length && Object.prototype.hasOwnProperty.call(data[0], sf)) {
    const sk = uniq(data.map((r) => String(r[sf])));
    const cm = colorMap(sk, theme, spec.colors);
    for (const k of sk) colors[k] = cm.get(k);
    if (sk.length > 1) legend = sk.map((k) => ({ label: k, color: cm.get(k), shape: LINE_LIKE.has(spec.type) ? 'line' : 'square' }));
  }

  const frame = createFrame({ ...spec, height: 200 }, theme, { width: 720 });
  const area = frame.layout(legend);
  const gap = spec.panelGap ?? 14;
  // Columnas pedidas, pero nunca paneles de menos de ~150 px (en móvil se apilan).
  const fit = Math.max(1, Math.floor((area.w + gap) / 150));
  const want = (typeof spec.columns === 'number' ? spec.columns : undefined) ?? spec.colWrap ?? spec.col_wrap ?? Math.max(1, Math.floor((area.w + gap) / 230));
  const cols = Math.max(1, Math.min(keys.length, want, fit));
  const pw = (area.w - gap * (cols - 1)) / cols;
  const ph = spec.panelHeight ?? Math.round(Math.min(300, Math.max(160, pw * 0.66)));
  const rows = Math.ceil(keys.length / cols);
  frame.setHeight(area.y + rows * ph + (rows - 1) * gap + frame.chrome);

  const panelTheme = { ...theme, type: { ...(theme.type || {}), title: Math.min(13.5, theme.type?.title ?? 13.5), titleWeight: 600 } };
  const multiSeries = legend.length > 1;
  const base = {
    ...spec, facet: undefined, col: undefined, title: undefined, subtitle: undefined, source: undefined, refLines: spec.refLines,
    width: Math.floor(pw), height: ph, padding: 0, colors, legend: false, theme: panelTheme, palette: undefined,
    labels: spec.panelLabels ?? (multiSeries && LINE_LIKE.has(spec.type) ? false : spec.labels),
  };
  const subsets = keys.map((k) => data.filter((r) => String(r[f]) === k));

  // Escalas compartidas: primera pasada para conocer el dominio de cada panel.
  const shareY = spec.sharey ?? spec.shareY ?? true;
  const shareX = spec.sharex ?? spec.shareX ?? true;
  let yDomain = spec.yDomain, xDomain = spec.xDomain;
  if ((shareY && !yDomain) || (shareX && !xDomain)) {
    const ds = subsets.map((d, i) => { const _domains = {}; try { renderOne({ ...base, data: d, title: keys[i], _domains }); } catch { /* panel vacío */ } return _domains; });
    const ys = ds.filter((d) => d.y).map((d) => d.y), xs = ds.filter((d) => d.x).map((d) => d.x);
    if (shareY && !yDomain && ys.length) {
      const lo = Math.min(...ys.map((d) => d[0])), hi = Math.max(...ys.map((d) => d[1]));
      yDomain = spec.yScale === 'log' ? [lo, hi] : (({ min, max }) => [min, max])(niceDomain(lo, hi, 4));
    }
    if (shareX && !xDomain && xs.length) xDomain = [Math.min(...xs.map((d) => d[0])), Math.max(...xs.map((d) => d[1]))];
  }

  const body = [];
  keys.forEach((k, i) => {
    const c = i % cols, r = Math.floor(i / cols);
    const px = area.x + c * (pw + gap), py = area.y + r * (ph + gap);
    let svg;
    try {
      svg = renderOne({ ...base, data: subsets[i], title: k, yDomain, xDomain });
    } catch (e) {
      svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${pw}" height="${ph}"></svg>`;
    }
    // Panel anidado: se quita el estilo responsivo del SVG raíz del panel.
    svg = svg.replace(/^<svg /, `<svg x="${px.toFixed(1)}" y="${py.toFixed(1)}" `).replace(/ style="[^"]*"/, '');
    body.push(svg);
  });
  const en = String(spec.locale || 'es').startsWith('en');
  const desc = (en ? `Small multiples by ${f}: ` : `Paneles por ${f}: `) + keys.join(', ') + '.';
  return frame.finish(g({ class: 'pa-facets' }, body), { desc, type: 'facet' });
}
