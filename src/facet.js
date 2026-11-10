// Small multiples (seaborn: col / col_wrap): un panel por valor de `facet`,
// con escalas y colores compartidos y una sola leyenda. Es la alternativa
// correcta a 8 líneas enredadas o a un doble eje.
import { el, g } from './svg.js';
import { createFrame } from './frame.js';
import { colorMap, themeFor, readable } from './theme.js';
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
  let legend = [], nSeries = 0;
  if (sf && data.length && Object.prototype.hasOwnProperty.call(data[0], sf)) {
    const sk = uniq(data.map((r) => String(r[sf])));
    nSeries = sk.length;
    const cm = colorMap(sk, theme, spec.colors);
    for (const k of sk) colors[k] = cm.get(k);
    // `legend: false` vale también aquí: el sitio pone su propia leyenda.
    if (sk.length > 1 && spec.legend !== false) legend = sk.map((k) => ({ label: k, color: cm.get(k), shape: LINE_LIKE.has(spec.type) ? 'line' : 'square' }));
  }

  const frame = createFrame({ ...spec, height: 200 }, theme, { width: 720 });
  const area = frame.layout(legend);
  const gap = spec.panelGap ?? 14;
  // Columnas pedidas, pero nunca paneles más angostos que el mínimo de un gráfico
  // (240 px, ver createFrame): más angostos se montarían unos sobre otros.
  const fit = Math.max(1, Math.floor((area.w + gap) / 240));
  const want = (typeof spec.columns === 'number' ? spec.columns : undefined) ?? spec.colWrap ?? spec.col_wrap ?? Math.max(1, Math.floor((area.w + gap) / 230));
  const cols = Math.max(1, Math.min(keys.length, want, fit));
  const pw = (area.w - gap * (cols - 1)) / cols;
  let ph = spec.panelHeight ?? Math.round(Math.min(300, Math.max(160, pw * 0.66)));
  const rows = Math.ceil(keys.length / cols);

  const panelTheme = { ...theme, type: { ...(theme.type || {}), title: Math.min(13.5, theme.type?.title ?? 13.5), titleWeight: 600 } };
  const multiSeries = nSeries > 1;
  const base = {
    ...spec, facet: undefined, col: undefined, title: undefined, subtitle: undefined, source: undefined, refLines: spec.refLines,
    width: Math.floor(pw), height: ph, padding: 0, colors, legend: false, theme: panelTheme, palette: undefined,
    labels: spec.panelLabels ?? (multiSeries && LINE_LIKE.has(spec.type) ? false : spec.labels),
  };
  const subsets = keys.map((k) => data.filter((r) => String(r[f]) === k));
  // `panelNote`: una línea bajo el nombre del panel (un campo o una función).
  const notes = subsets.map((d, i) => {
    const note = typeof spec.panelNote === 'function' ? spec.panelNote(keys[i], d) : spec.panelNote ? d.map((r) => r[spec.panelNote]).find((v) => v !== undefined && v !== null && v !== '') : undefined;
    return note !== undefined && note !== null ? String(note) : undefined;
  });

  // Encabezados parejos: una nota (o un nombre que salta de línea) no le quita
  // alto al trazado de su panel. Todos los paneles llevan el encabezado más
  // alto y el panel crece lo que haga falta: mismos píxeles por unidad en
  // todos y ningún panel encima del de abajo.
  const themeP = themeFor(base);
  const topOf = (title, subtitle) => createFrame({ ...base, title, subtitle }, themeP).top;
  const tops = keys.map((k, i) => topOf(k, notes[i]));
  const plainTop = Math.min(...keys.map((k) => topOf(k, undefined)));
  const headTop = Math.max(...tops);
  const headerMin = headTop > Math.min(...tops) || headTop > plainTop ? headTop : undefined;
  if (headerMin !== undefined) {
    ph += Math.ceil(headTop - plainTop);
    base.height = ph;
    base._headerMin = headerMin;
  }

  // Escalas compartidas: primera pasada para conocer el dominio de cada panel.
  const shareY = spec.sharey ?? spec.shareY ?? true;
  const shareX = spec.sharex ?? spec.shareX ?? true;
  let yDomain = spec.yDomain, xDomain = spec.xDomain, spanDomains = null, pads = null;
  if ((shareY && !yDomain) || (shareX && !xDomain)) {
    const ds = subsets.map((d, i) => { const _domains = {}; try { renderOne({ ...base, data: d, title: keys[i], subtitle: notes[i], _domains }); } catch { /* panel vacío */ } return _domains; });
    const ys = ds.filter((d) => d.y).map((d) => d.y), xs = ds.filter((d) => d.x).map((d) => d.x);
    if (shareY === 'span' && !yDomain && ys.length && spec.yScale !== 'log') {
      // Mismo largo en todos, cada uno con su piso: una pendiente dice el mismo
      // cambio en cada panel aunque los niveles no se parezcan. Un panel sin
      // valores (todo nulo) no cuenta ni se rellena: queda vacío.
      const step = niceDomain(0, Math.max(...ys.map((d) => d[1] - d[0])) || 1, 4).step;
      const lo = ds.map((d) => (d.y ? Math.floor(d.y[0] / step) * step : null));
      const span = Math.max(...ds.map((d, j) => (d.y ? Math.ceil(d.y[1] / step) * step - lo[j] : 0)));
      spanDomains = lo.map((l) => (l === null ? undefined : [l, l + span]));
      // Mismo largo en unidades no basta: también el mismo alto y ancho en
      // píxeles. Lo que cada panel reserva alrededor del trazado (rótulos bajo
      // barras negativas, el eje y, los rótulos finales) se iguala al mayor.
      pads = maxPads(ds);
    } else if (shareY && !yDomain && ys.length) {
      const lo = Math.min(...ys.map((d) => d[0])), hi = Math.max(...ys.map((d) => d[1]));
      yDomain = spec.yScale === 'log' ? [lo, hi] : (({ min, max }) => [min, max])(niceDomain(lo, hi, 4));
    }
    if (shareX && !xDomain && xs.length) xDomain = [Math.min(...xs.map((d) => d[0])), Math.max(...xs.map((d) => d[1]))];
  }

  // `panelColor`: el nombre de cada panel en el color de su serie (true), en
  // el de un objeto { panel: color } o en el que diga una función (panel, filas).
  const pc = spec.panelColor;
  const titleColors = keys.map((k, i) => {
    if (!pc) return undefined;
    let c;
    if (typeof pc === 'function') c = pc(k, subsets[i]);
    else if (typeof pc === 'object') c = pc[k];
    else if (pc === true || typeof pc === 'string') {
      const own = sf ? uniq(subsets[i].map((r) => String(r[sf]))) : [];
      c = colors[k] ?? (own.length === 1 ? colors[own[0]] : undefined) ?? (typeof pc === 'string' ? pc : undefined);
    }
    if (typeof c !== 'string' || !c) return undefined;
    return /^#[0-9a-f]{3,8}$/i.test(c) ? readable(c, theme) : c;
  });

  // Con el eje x compartido, cada panel deja lugar a las marcas del eje y como
  // un gráfico suelto (`_xShared`); si los paneles piden distinto, se dibujan
  // otra vez con el mayor, para que todos tengan la misma escala x.
  const draw = (k, i, extra = {}) => {
    try {
      // Anotaciones con `panel` van sólo a ese panel; sin `panel`, a todos.
      const ann = (spec.annotations || []).filter((a) => a.panel === undefined || String(a.panel) === k);
      return renderOne({ ...base, data: subsets[i], title: k, subtitle: notes[i], annotations: ann, yDomain: spanDomains ? spanDomains[i] : yDomain, xDomain, ...(pads || {}), ...(titleColors[i] ? { _titleColor: titleColors[i] } : {}), ...extra });
    } catch (e) {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${pw}" height="${ph}"></svg>`;
    }
  };
  const xd = keys.map(() => ({}));
  let svgs = keys.map((k, i) => draw(k, i, xDomain ? { _xShared: true, _domains: xd[i] } : {}));
  const xPads = xd.map((d) => d.xPad).filter((v) => Number.isFinite(v));
  const xPadMax = xPads.length ? Math.max(...xPads) : 0;
  if (xPadMax > 0 && xPads.some((v) => v !== xPadMax)) svgs = keys.map((k, i) => draw(k, i, { _xShared: true, _xPad: xPadMax }));
  // Cada fila mide lo que su panel más alto: un panel que creció (un trazado
  // que no cabía) empuja la fila de abajo en vez de montarse encima.
  const heightOf = (svg) => +((/^<svg\b[^>]*?\sheight="([\d.]+)"/.exec(svg) || [])[1]) || ph;
  const rowH = Array.from({ length: rows }, (_, r) => Math.max(ph, ...svgs.slice(r * cols, (r + 1) * cols).map(heightOf)));
  const rowY = rowH.map((_, r) => area.y + rowH.slice(0, r).reduce((a, h) => a + h + gap, 0));
  frame.setHeight(area.y + rowH.reduce((a, h) => a + h, 0) + (rows - 1) * gap + frame.chrome);
  const body = svgs.map((svg, i) => {
    const c = i % cols, r = Math.floor(i / cols);
    const px = area.x + c * (pw + gap), py = rowY[r];
    // Panel anidado: se quita el estilo responsivo del SVG raíz del panel.
    return svg.replace(/^<svg /, `<svg x="${px.toFixed(1)}" y="${py.toFixed(1)}" `).replace(/^(<svg\b[^>]*?) style="[^"]*"/, '$1'); // sólo el de la raíz (con `bare` la raíz no lo trae y el primero sería de una marca)
  });
  const en = String(spec.locale || 'es').startsWith('en');
  const desc = (en ? `Small multiples by ${f}: ` : `Paneles por ${f}: `) + keys.join(', ') + '.';
  return frame.finish(g({ class: 'pa-facets' }, body), { desc, type: 'facet' });
}

/**
 * Lo que cada panel reserva alrededor de su trazado (`_domains.pad`: arriba y
 * abajo; `_domains.padX`: izquierda y derecha), igualado al mayor. Sólo se
 * devuelve si difieren: con paneles iguales el dibujo no cambia.
 */
function maxPads(ds) {
  const out = {};
  for (const [k, key] of [['pad', '_pad'], ['padX', '_padX']]) {
    const ps = ds.filter((d) => d[k]).map((d) => d[k]);
    if (ps.length < 2) continue;
    const m = [Math.max(...ps.map((p) => p[0])), Math.max(...ps.map((p) => p[1]))];
    if (ps.some((p) => p[0] !== m[0] || p[1] !== m[1])) out[key] = m;
  }
  return Object.keys(out).length ? out : null;
}
