// Dashboards con buenas prácticas por defecto.
//
//   import { dashboard } from 'plotagents';
//   const html = dashboard({
//     title: 'Ventas del sur, 2025', source: 'ERP comercial', locale: 'es',
//     data: ventas,                                   // filas compartidas (opcional)
//     kpis: [{ label: 'Ventas', field: 'monto', agg: 'sum', format: 'compact' }, …],
//     charts: [{ type: 'line', x: 'mes', y: 'monto', series: 'region', title: '…' }, …],
//     filters: ['region', 'canal'],
//   });
//
// Lo que se decide aquí para que cualquier dashboard empiece bien:
// · Lectura en Z: KPIs arriba (a lo más 5), luego el gráfico principal ancho
//   (la serie de tiempo, si hay una), luego el detalle.
// · Grilla de 12 columnas con filas completas (sin huecos): el ancho de cada
//   panel sale de su tipo (series y flujos anchos; donas y rankings angostos).
// · Mismo color para la misma entidad en todos los gráficos.
// · Un solo tema, idioma y fuente tipográfica; la fuente de datos va una vez,
//   al pie (salvo la de un gráfico que diga otra cosa).
// · Filtros como botones (o lista si hay muchos valores) que afectan a todos
//   los gráficos que tienen ese campo y a los KPIs calculados.
// · En teléfonos, una columna en el orden de lectura.
import { themeFor, colorMap } from './theme.js';
import { ensureData, num, uniq, fieldKind, aggregate, PlotError } from './data.js';
import { makeFormat, formatNumber, parseDate } from './format.js';
import { esc } from './svg.js';
import { render } from './runtime.js';

let core = null;
/** index.js registra plot/resolve/lint aquí (evita una importación circular). */
export function _bindDashboard(fns) { core = fns; }

const T = (locale, es, en) => (String(locale || 'es').startsWith('en') ? en : es);

// Ancho (de 12) según el tipo: lo que se lee de izquierda a derecha, ancho.
const WIDE = new Set(['line', 'area', 'gantt', 'heatmap', 'sankey', 'flowchart', 'network', 'jointplot']);
const NARROW = new Set(['donut', 'pie', 'radar', 'kpi', 'hist', 'kde', 'ecdf', 'count']);
const AUTO_HEIGHT = new Set(['kpi', 'gantt', 'flowchart', 'table']);

function spanFor(s) {
  if (s.size === 'full' || s.span === 12) return 12;
  if (Number.isFinite(+s.span)) return Math.max(3, Math.min(12, Math.round(+s.span)));
  if (s.size === 'large') return 8;
  if (s.size === 'medium') return 6;
  if (s.size === 'small') return 4;
  if (s.facet) return 12;
  if (s.type === 'flowchart' || s.type === 'sankey') return 12;
  if (WIDE.has(s.type)) return 8;
  if (s.type === 'choropleth' || s.type === 'symbolmap') return s.geo === 'chile' || s.geo === undefined ? 4 : 6;
  if (NARROW.has(s.type)) return 4;
  if (s.type === 'bar') {
    try {
      const d = ensureData(s);
      const n = s.x && d.length ? uniq(d.map((r) => String(r[s.x]))).length : d.length;
      return n <= 6 && !s.series ? 4 : 6;
    } catch { return 6; }
  }
  return 6;
}

/** Filas completas de 12: si el siguiente no cabe, los de la fila se estiran. */
export function packRows(spans) {
  const rows = [];
  let row = [];
  const close = () => {
    if (!row.length) return;
    let left = 12 - row.reduce((a, r) => a + r.span, 0);
    for (let k = 0; left > 0; k = (k + 1) % row.length) { row[k].span++; left--; }
    rows.push(row);
    row = [];
  };
  spans.forEach((span, i) => {
    const used = row.reduce((a, r) => a + r.span, 0);
    if (used + span > 12) close();
    row.push({ i, span });
  });
  close();
  return rows;
}

/**
 * Filas balanceadas: el principal solo (o con un compañero angosto) y el
 * resto en filas de 2 o 3, siempre completas: 2 → 6+6 (8+4 si uno es ancho),
 * 3 → 4+4+4, 4 → 2+2, 5 → 3+2, 7 → 3+2+2…
 */
export function balancedRows(spans, hasPrimary) {
  const rows = [];
  let idx = spans.map((_, i) => i);
  if (hasPrimary && idx.length) {
    const p = idx.shift();
    if (spans[p] >= 8 || !idx.length) rows.push([{ i: p, span: 12 }]);
    else { const q = idx.shift(); rows.push([{ i: p, span: 8 }, { i: q, span: 4 }]); }
  }
  const n = idx.length;
  const sizes = n === 1 ? [1] : n === 2 ? [2] : n === 4 ? [2, 2] : [];
  if (!sizes.length) { let m = n; while (m > 0) { if (m === 4) { sizes.push(2, 2); m = 0; } else if (m === 2) { sizes.push(2); m = 0; } else if (m === 1) { sizes.push(1); m = 0; } else { sizes.push(3); m -= 3; } } }
  for (const k of sizes) {
    const row = idx.splice(0, k);
    if (k === 1) rows.push([{ i: row[0], span: 12 }]);
    else if (k === 2) {
      const [a, b] = row;
      const wideA = spans[a] >= 8, wideB = spans[b] >= 8;
      rows.push(wideA && !wideB ? [{ i: a, span: 8 }, { i: b, span: 4 }] : wideB && !wideA ? [{ i: a, span: 4 }, { i: b, span: 8 }] : [{ i: a, span: 6 }, { i: b, span: 6 }]);
    } else rows.push(row.map((i) => ({ i, span: 4 })));
  }
  return rows;
}

/** Valores de un KPI calculado: { field, agg } sobre las filas. */
export function computeKpi(def, rows) {
  if (def.value !== undefined) return num(def.value);
  const v = rawKpi(def, rows);
  return Number.isFinite(v) && def.scale ? v * def.scale : v;
}
function rawKpi(def, rows) {
  const agg = def.agg ?? def.aggregate ?? (def.field ? 'sum' : 'count');
  if (agg === 'count') return rows.length;
  if (agg === 'distinct') return uniq(rows.map((r) => r[def.field])).length;
  const vals = rows.map((r) => num(r[def.field])).filter(Number.isFinite);
  if (agg === 'ratio' && def.over) { const a = vals.reduce((x, y) => x + y, 0); const b = rows.map((r) => num(r[def.over])).filter(Number.isFinite).reduce((x, y) => x + y, 0); return b ? a / b : NaN; }
  return vals.length ? aggregate(vals, agg) : NaN;
}

/** Campo que identifica las entidades coloreadas de un gráfico. */
const colorField = (s) => s.series ?? s.hue ?? (Array.isArray(s.path) ? s.path[0] : null) ?? s.group ?? (['donut', 'pie'].includes(s.type) ? s.label ?? s.x : null) ?? (s.type === 'treemap' ? s.label : null);

/**
 * Plan del dashboard: decide orden, anchos, colores comunes, filtros y KPIs.
 * Es puro (sin DOM): dashboard() y renderDashboard() lo dibujan.
 */
export function planDashboard(spec = {}) {
  if (!core) throw new PlotError('plotagents no está inicializado.');
  if (!spec || typeof spec !== 'object') throw new PlotError('El dashboard debe ser un objeto.', 'dashboard({ title, kpis, charts: [...] })');
  const locale = spec.locale || 'es';
  const shared = spec.data ? ensureData(spec) : null;
  const base = {};
  for (const k of ['locale', 'theme', 'font', 'palette', 'ramp', 'textScale']) if (spec[k] !== undefined) base[k] = spec[k];
  // Gráficos: heredan datos, idioma y tema; el tipo se resuelve para decidir su ancho.
  let charts = (spec.charts || []).map((c, i) => {
    const s0 = { ...base, ...c, ...(c.data === undefined && shared ? { data: shared } : {}) };
    if (spec.theme !== undefined && c.theme === undefined) s0.theme = spec.theme;
    let s;
    try { s = core.resolve(s0); } catch (e) { s = { ...s0, _error: e.message }; }
    return { i, spec: s, primary: !!c.primary };
  });
  // El principal: el marcado, o la primera serie de tiempo; va primero.
  let primary = charts.find((c) => c.primary) || charts.find((c) => ['line', 'area'].includes(c.spec.type));
  if (spec.layout === 'grid') primary = null;
  if (primary && spec.order !== 'given') charts = [primary, ...charts.filter((c) => c !== primary)];
  // Colores comunes: misma entidad, mismo color en todos los gráficos.
  const theme = themeFor(core.resolveDefaults ? core.resolveDefaults({ ...base }) : { ...base });
  const tot = new Map();
  for (const c of charts) {
    const f = colorField(c.spec);
    if (!f || !Array.isArray(c.spec.data)) continue;
    const vf = c.spec.value ?? (typeof c.spec.y === 'string' ? c.spec.y : null);
    for (const r of c.spec.data) { const k = r[f]; if (k === undefined || k === null) continue; tot.set(String(k), (tot.get(String(k)) || 0) + (vf && Number.isFinite(num(r[vf])) ? Math.abs(num(r[vf])) : 1)); }
  }
  const keys = [...tot.keys()].sort((a, b) => tot.get(b) - tot.get(a));
  const colors = { ...Object.fromEntries(colorMap(keys, theme, spec.colors || {})), ...(spec.colors || {}) };
  // Fuente común: una vez al pie; se quita de los gráficos que la repiten.
  const source = spec.source;
  // Anchos y filas.
  const layout = spec.layout || 'auto';
  const explicit = (spec.charts || []).some((c) => c.span !== undefined || c.size !== undefined);
  let rows;
  if (explicit || layout === 'grid' || layout === 'executive') {
    const spans = charts.map((c, k) => {
      if (layout === 'grid') return charts.length % 3 === 0 && charts.length > 4 ? 4 : 6;
      let sp = spanFor(c.spec);
      if (k === 0 && c === primary) sp = Math.max(sp, layout === 'executive' || WIDE.has(c.spec.type) ? 12 : 8);
      if (layout === 'executive' && k > 0) sp = 6;
      return sp;
    });
    rows = packRows(spans);
  } else rows = balancedRows(charts.map((c) => spanFor(c.spec)), !!primary);
  const panels = [];
  rows.forEach((row, r) => row.forEach(({ i, span }) => {
    const c = charts[i];
    const s = { ...c.spec, colors: { ...colors, ...(c.spec.colors || {}) } };
    if (source && s.source === source) delete s.source;
    // Alto común por fila (los que se dimensionan solos, se respetan).
    if (s.height === undefined && !AUTO_HEIGHT.has(s.type)) s.height = span >= 12 ? 380 : row.length >= 3 ? 340 : 360;
    if (s.padding === undefined) s.padding = 16;
    delete s.primary; delete s.size; delete s.span;
    panels.push({ id: `p${c.i}`, row: r, span, spec: s, error: c.spec._error || null });
  }));
  // KPIs: fijos ({ value }) o calculados ({ field, agg }) sobre los datos compartidos.
  const kpis = (spec.kpis || []).map((k) => (typeof k === 'object' ? { ...k } : { label: String(k) }));
  // Filtros: campos presentes en los datos; botones con ≤ 6 valores.
  const filters = [].concat(spec.filters || []).map((f) => {
    const o = typeof f === 'string' ? { field: f } : { ...f };
    const pool = [...(shared || []), ...panels.flatMap((p) => (Array.isArray(p.spec.data) && p.spec.data !== shared ? p.spec.data : []))];
    const vals = uniq(pool.map((r) => r[o.field]).filter((v) => v !== undefined && v !== null && v !== ''));
    const kind = pool.length ? fieldKind(pool, o.field) : 'category';
    vals.sort((a, b) => (kind === 'date' ? parseDate(a) - parseDate(b) : kind === 'year' || kind === 'number' ? num(a) - num(b) : 0));
    return { field: o.field, label: o.label ?? o.field.charAt(0).toUpperCase() + o.field.slice(1), values: vals.map(String), control: o.control ?? (vals.length <= 6 ? 'buttons' : 'select'), value: o.value ?? o.default ?? null, all: o.all ?? T(locale, 'Todos', 'All') };
  }).filter((f) => f.values.length > 1);
  return {
    title: spec.title ?? '', subtitle: spec.subtitle ?? '', source, updated: spec.updated ?? null, note: spec.note ?? null,
    locale, base, theme: { mode: theme.mode, surface: theme.surface, ink: theme.ink, lede: theme.lede, muted: theme.muted, grid: theme.grid, axis: theme.axis, tint: theme.tint, accent: theme.categorical[0], good: theme.status.good, bad: theme.status.critical, font: theme.font?.family, fontImport: theme.font?.import },
    kpis, data: shared, panels, filters, colors,
  };
}

// ── Revisión (lint) ────────────────────────────────────────────────────────
export function lintDashboard(spec = {}) {
  const locale = spec.locale || 'es';
  const L = (es, en) => T(locale, es, en);
  const errors = [], warnings = [], suggestions = [];
  const charts = spec.charts || [];
  if (!charts.length && !(spec.kpis || []).length) errors.push({ code: 'dash-empty', message: L('El dashboard no tiene gráficos ni KPIs.', 'The dashboard has no charts or KPIs.'), fix: L('Agrega `charts: [spec, …]` y/o `kpis: [{ label, value }]`.', 'Add `charts: [spec, …]` and/or `kpis: [{ label, value }]`.') });
  if (!spec.title) suggestions.push({ code: 'dash-title', message: L('Falta el título del dashboard.', 'The dashboard has no title.'), fix: L('Di qué pregunta responde: "¿Cómo van las ventas del sur en 2025?"', 'Say what question it answers: "How are southern sales doing in 2025?"') });
  if (!spec.source && !charts.every((c) => c.source)) suggestions.push({ code: 'dash-source', message: L('Falta la fuente de los datos.', 'The data source is missing.'), fix: L('Agrega `source` al dashboard: se muestra una vez, al pie.', 'Add `source` to the dashboard: it is shown once, at the bottom.') });
  if (charts.length > 9) warnings.push({ code: 'dash-many-charts', message: L(`${charts.length} gráficos: un dashboard que lo muestra todo no destaca nada.`, `${charts.length} charts: a dashboard that shows everything highlights nothing.`), fix: L('Quédate con 4–6 que respondan una pregunta; el resto, en otra página.', 'Keep the 4–6 that answer one question; move the rest to another page.') });
  else if (charts.length > 6) suggestions.push({ code: 'dash-charts', message: L(`${charts.length} gráficos: sobre 6 cuesta leer el dashboard de un vistazo.`, `${charts.length} charts: beyond 6 the dashboard is hard to read at a glance.`), fix: L('Prioriza o agrupa en pestañas/páginas.', 'Prioritize, or split into pages.') });
  const nk = (spec.kpis || []).length;
  if (nk > 5) warnings.push({ code: 'dash-many-kpis', message: L(`${nk} KPIs: sobre 5 ninguno destaca.`, `${nk} KPIs: beyond 5 none stands out.`), fix: L('Deja los 3–5 que mueven decisiones.', 'Keep the 3–5 that drive decisions.') });
  let types = [];
  try { types = charts.map((c) => (core ? core.resolve({ ...c, ...(c.data === undefined && spec.data ? { data: spec.data } : {}) }).type : c.type)); } catch { types = charts.map((c) => c.type); }
  const pies = types.filter((t) => t === 'donut' || t === 'pie').length;
  if (pies > 1) suggestions.push({ code: 'dash-pies', message: L(`${pies} donas o tortas: compararlas entre sí es difícil.`, `${pies} donuts or pies: comparing them with each other is hard.`), fix: L('Usa una sola, o barras apiladas al 100% (`stack: "percent"`).', 'Keep one, or use 100% stacked bars (`stack: "percent"`).') });
  const themes = new Set(charts.map((c) => (typeof c.theme === 'string' ? c.theme : c.theme ? 'custom' : null)).filter(Boolean));
  if (themes.size > 1) warnings.push({ code: 'dash-themes', message: L('Los gráficos usan temas distintos.', 'Charts use different themes.'), fix: L('Fija `theme` en el dashboard y quítalo de los gráficos.', 'Set `theme` on the dashboard and remove it from the charts.') });
  const untitled = charts.filter((c) => !c.title).length;
  if (untitled) suggestions.push({ code: 'dash-chart-titles', message: L(`${untitled} gráfico(s) sin título.`, `${untitled} chart(s) without a title.`), fix: L('Cada panel necesita su hallazgo como título.', 'Every panel needs its finding as the title.') });
  for (const f of [].concat(spec.filters || [])) {
    const field = typeof f === 'string' ? f : f.field;
    const has = [spec.data, ...charts.map((c) => c.data)].some((d) => Array.isArray(d) && d.some((r) => r && field in r));
    if (!has) warnings.push({ code: 'dash-filter-field', message: L(`El filtro "${field}" no existe en los datos de ningún gráfico.`, `The filter "${field}" is not in any chart's data.`), fix: L('Usa un campo de `data`.', 'Use a field of `data`.') });
  }
  // Revisión de cada gráfico, con su número y título.
  charts.forEach((c, i) => {
    const r = core ? core.lint({ locale, ...c, ...(c.data === undefined && spec.data ? { data: spec.data } : {}), source: c.source ?? spec.source ?? 'dashboard' }) : null;
    if (!r) return;
    const tag = `${L('Gráfico', 'Chart')} ${i + 1}${c.title ? ` («${String(c.title).slice(0, 40)}»)` : ''}: `;
    for (const [list, out] of [[r.errors, errors], [r.warnings, warnings], [r.suggestions, suggestions]]) for (const it of list) if (it.code !== 'title') out.push({ ...it, chart: i, message: tag + it.message });
  });
  return { ok: errors.length === 0, errors, warnings, suggestions };
}

// ── Marcado (HTML) ─────────────────────────────────────────────────────────
export const DASH_CSS = `
.pa-dash{--g:24px;max-width:1440px;margin:0 auto;padding:clamp(16px,3vw,40px);color:var(--d-ink);background:var(--d-surface);font-family:var(--d-font);font-variant-numeric:lining-nums tabular-nums}
.pa-dash *{box-sizing:border-box}
.pa-dash header.pa-dh{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-end;gap:12px 32px;padding-bottom:16px;border-bottom:1px solid var(--d-ink)}
.pa-dash h1{font-size:clamp(26px,3.2vw,40px);line-height:1.08;letter-spacing:-.03em;font-weight:600;margin:0}
.pa-dash .pa-dsub{color:var(--d-lede);font-size:15px;margin:6px 0 0;max-width:70ch}
.pa-dash .pa-dmeta{font-size:12.5px;color:var(--d-muted);text-align:right}
.pa-dfilters{display:flex;flex-wrap:wrap;gap:8px 28px;align-items:center;padding:10px 0;border-bottom:1px solid var(--d-grid);position:sticky;top:0;z-index:5;background:var(--d-surface)}
.pa-dfilter{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:13px}
.pa-dfilter>span{color:var(--d-muted);margin-right:4px}
.pa-dfilter button{font:inherit;font-size:13px;color:var(--d-muted);background:none;border:0;padding:5px 6px;cursor:pointer;border-radius:0;box-shadow:inset 0 -1px 0 transparent}
.pa-dfilter button:hover{color:var(--d-ink)}
.pa-dfilter button[aria-pressed=true]{color:var(--d-ink);font-weight:600;box-shadow:inset 0 -2px 0 var(--d-accent)}
.pa-dfilter select{font:inherit;font-size:13px;color:var(--d-ink);background:transparent;border:0;border-bottom:1px solid var(--d-axis);padding:4px 2px}
.pa-dfilter button:focus-visible,.pa-dfilter select:focus-visible{outline:2px solid var(--d-accent);outline-offset:2px}
.pa-kpis{display:grid;grid-template-columns:repeat(var(--n,4),minmax(0,1fr));border-bottom:1px solid var(--d-grid)}
.pa-kpi{padding:18px 20px 18px 0;min-width:0}
.pa-kpi+.pa-kpi{padding-left:20px;border-left:1px solid var(--d-grid)}
.pa-kpi .l{font-size:13px;color:var(--d-lede);margin:0}
.pa-kpi .v{font-size:clamp(26px,2.6vw,36px);font-weight:600;letter-spacing:-.02em;line-height:1.15;margin:4px 0 2px;white-space:nowrap}
.pa-kpi .d{font-size:12.5px;font-weight:600}
.pa-kpi .d small{font-weight:400;color:var(--d-muted);margin-left:6px}
.pa-kpi svg{display:block;width:100%;height:28px;margin-top:6px;overflow:visible}
.pa-grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:0 var(--g)}
.pa-panel{grid-column:span var(--s);min-width:0;padding-top:20px;margin-top:4px;border-top:1px solid var(--d-grid)}
.pa-panel figure{margin:0}
.pa-panel figure svg{width:100%;height:auto;display:block}
.pa-panel .pa-err{font-size:13px;color:var(--d-bad);padding:12px 0}
.pa-dfoot{display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px 24px;font-size:12.5px;color:var(--d-muted);margin-top:24px;padding-top:12px;border-top:1px solid var(--d-ink)}
@media (max-width:1000px){.pa-panel{grid-column:span max(6,var(--s))}}
@media (max-width:1000px){.pa-kpis[data-n='4'],.pa-kpis[data-n='5']{grid-template-columns:repeat(2,minmax(0,1fr))}.pa-kpis[data-n='4'] .pa-kpi:nth-child(n+3),.pa-kpis[data-n='5'] .pa-kpi:nth-child(n+3){border-top:1px solid var(--d-grid)}.pa-kpis[data-n='4'] .pa-kpi:nth-child(2n+1),.pa-kpis[data-n='5'] .pa-kpi:nth-child(2n+1){padding-left:0;border-left:0}}
@media (max-width:700px){.pa-grid{grid-template-columns:minmax(0,1fr)}.pa-panel{grid-column:auto}.pa-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.pa-kpi,.pa-kpi+.pa-kpi{padding:14px 12px 14px 0;border-left:0}.pa-kpi:nth-child(2n){padding-left:12px;border-left:1px solid var(--d-grid)}.pa-kpi:nth-child(n+3){border-top:1px solid var(--d-grid)}.pa-kpi .v{font-size:26px}}
@media print{.pa-dfilters{position:static}.pa-panel{break-inside:avoid}}
`;

const cssVars = (t) => `--d-surface:${t.surface};--d-ink:${t.ink};--d-lede:${t.lede};--d-muted:${t.muted};--d-grid:${t.grid};--d-axis:${t.axis};--d-tint:${t.tint};--d-accent:${t.accent};--d-good:${t.good};--d-bad:${t.bad};--d-font:${(t.font || 'system-ui').replace(/"/g, "'")}`;

/** KPIs en HTML: etiqueta, cifra, variación con flecha y texto, tendencia. */
export function kpiMarkup(plan, rows) {
  if (!plan.kpis.length) return '';
  const { locale } = plan;
  const cells = plan.kpis.map((k) => {
    // `compare: { field, current, previous }`: el valor del periodo actual y su variación frente al anterior.
    const cmp = k.compare && k.value === undefined ? k.compare : null;
    const inPeriod = (p) => (rows || []).filter((r) => String(r[cmp.field]) === String(p));
    const v = cmp ? computeKpi(k, inPeriod(cmp.current)) : computeKpi(k, rows || []);
    if (cmp && k.delta === undefined) { const pv = computeKpi(k, inPeriod(cmp.previous)); k = { ...k, delta: Number.isFinite(pv) && pv ? (v - pv) / Math.abs(pv) : undefined, period: k.period ?? `vs ${cmp.previous}` }; }
    // `trendBy: "mes"`: minigráfico calculado (mismo agregado por periodo).
    if (k.trendBy && !k.trend && rows && rows.length) {
      const by = new Map();
      for (const r of cmp ? inPeriod(cmp.current) : rows) { const key = r[k.trendBy]; if (!by.has(key)) by.set(key, []); by.get(key).push(r); }
      const ks = [...by.keys()].sort((x, y) => (String(x) < String(y) ? -1 : 1));
      k = { ...k, trend: ks.map((x) => computeKpi(k, by.get(x))) };
    }
    const fmt = makeFormat(k.format, locale, [v]);
    const shown = k.display ?? (Number.isFinite(v) ? fmt(v) : '—');
    let d = '';
    let delta = k.delta !== undefined ? num(k.delta) : k.previous !== undefined && num(k.previous) ? (v - num(k.previous)) / Math.abs(num(k.previous)) : NaN;
    if (Number.isFinite(delta)) {
      if (Math.abs(delta) > 1.5 && k.delta !== undefined && !cmp) delta /= 100;
      // Una variación que se redondea a 0% se muestra como estable (sin flecha verde engañosa).
      const flat = Math.abs(delta) < (Math.abs(delta) < 0.1 ? 0.0005 : 0.005), up = delta > 0 && !flat, good = flat ? null : up === ((k.good ?? 'up') === 'up');
      const c = good === null ? 'var(--d-lede)' : good ? 'var(--d-good)' : 'var(--d-bad)';
      d = `<p class="d" style="color:${c};margin:0">${flat ? '■' : up ? '▲' : '▼'} ${up ? '+' : flat ? '' : '−'}${formatNumber(Math.abs(delta) * 100, Math.abs(delta) < 0.1 ? 1 : 0, locale, true)}%${k.period ? `<small>${esc(k.period)}</small>` : ''}</p>`;
    } else if (k.period) d = `<p class="d" style="margin:0"><small style="margin:0">${esc(k.period)}</small></p>`;
    let spark = '';
    if (Array.isArray(k.trend) && k.trend.length > 1) {
      const ts = k.trend.map(num), mn = Math.min(...ts), mx = Math.max(...ts);
      const pts = ts.map((y, i) => `${((i / (ts.length - 1)) * 100).toFixed(2)},${(26 - ((y - mn) / (mx - mn || 1)) * 24).toFixed(2)}`).join(' ');
      spark = `<svg viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="var(--d-accent)" stroke-width="1.6" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg>`;
    }
    return `<div class="pa-kpi"><p class="l">${esc(k.label ?? '')}</p><p class="v">${esc(shown)}</p>${d}${spark}</div>`;
  });
  return `<section class="pa-kpis" data-n="${cells.length}" style="--n:${cells.length}" aria-label="${T(locale, 'Indicadores', 'Key figures')}">${cells.join('')}</section>`;
}

/** HTML del dashboard. `svgs` (opcional) trae los gráficos ya dibujados (servidor). */
export function dashboardMarkup(plan, svgs = {}) {
  const { locale } = plan;
  const filters = plan.filters.map((f, i) => {
    const opts = f.control === 'buttons'
      ? [`<button type="button" data-f="${i}" data-v="" aria-pressed="${f.value === null}">${esc(f.all)}</button>`, ...f.values.map((v) => `<button type="button" data-f="${i}" data-v="${esc(v)}" aria-pressed="${String(f.value) === v}">${esc(v)}</button>`)].join('')
      : `<select data-f="${i}" aria-label="${esc(f.label)}"><option value="">${esc(f.all)}</option>${f.values.map((v) => `<option${String(f.value) === v ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select>`;
    return `<div class="pa-dfilter" role="group" aria-label="${esc(f.label)}"><span>${esc(f.label)}</span>${opts}</div>`;
  }).join('');
  const panels = plan.panels.map((p) => `<section class="pa-panel" style="--s:${p.span}" aria-label="${esc(p.spec.title || p.spec.type)}">${p.error ? `<p class="pa-err">${esc(p.error)}</p>` : `<figure class="pa" data-panel="${p.id}">${svgs[p.id] || ''}</figure>`}</section>`).join('');
  const meta = [plan.updated ? `${T(locale, 'Actualizado', 'Updated')}: ${esc(plan.updated)}` : '', `${plan.panels.length} ${T(locale, plan.panels.length === 1 ? 'gráfico' : 'gráficos', plan.panels.length === 1 ? 'chart' : 'charts')}`].filter(Boolean).join(' · ');
  return `<div class="pa-dash" style="${cssVars(plan.theme)}">
<header class="pa-dh"><div>${plan.title ? `<h1>${esc(plan.title)}</h1>` : ''}${plan.subtitle ? `<p class="pa-dsub">${esc(plan.subtitle)}</p>` : ''}</div><div class="pa-dmeta">${meta}</div></header>
${filters ? `<nav class="pa-dfilters" aria-label="${T(locale, 'Filtros', 'Filters')}">${filters}</nav>` : ''}
<div class="pa-kslot">${kpiMarkup(plan, plan.data)}</div>
<div class="pa-grid">${panels}</div>
<footer class="pa-dfoot"><span>${plan.source ? `${T(locale, 'Fuente', 'Source')}: ${esc(plan.source)}` : ''}${plan.note ? ` · ${esc(plan.note)}` : ''}</span><span>plotagents</span></footer>
</div>`;
}

/** Aplica los filtros activos a un panel (datos, o el periodo si es su campo `time`). */
export function filterSpec(spec, plan, active, locale) {
  let s = spec;
  const tags = [];
  plan.filters.forEach((f, i) => {
    const v = active[i];
    if (v === null || v === undefined || v === '') return;
    if (s.time === f.field) { s = { ...s, timeValue: v }; return; }
    if (Array.isArray(s.data) && s.data.some((r) => r && f.field in r)) { s = { ...s, data: s.data.filter((r) => String(r[f.field]) === String(v)) }; tags.push(`${f.label}: ${v}`); }
  });
  if (tags.length) s = { ...s, subtitle: [s.subtitle, tags.join(' · ')].filter(Boolean).join(' · ') };
  return s;
}

// ── Navegador: interacción (filtros) ───────────────────────────────────────
/** Conecta filtros y gráficos de un dashboard ya en el DOM (lo hace dashboard() en su página). */
export function mountDashboard(root, plan) {
  const handles = {};
  const active = plan.filters.map((f) => f.value);
  const draw = () => {
    for (const p of plan.panels) {
      if (p.error) continue;
      const fig = root.querySelector(`[data-panel="${p.id}"]`);
      if (!fig) continue;
      const s = filterSpec(p.spec, plan, active, plan.locale);
      try {
        if (handles[p.id]) handles[p.id] = handles[p.id].update(s);
        else handles[p.id] = render(fig, s);
      } catch (e) { fig.innerHTML = `<p class="pa-err">${esc(e.message)}</p>`; }
    }
    // KPIs calculados: se recalculan con los filtros.
    if (plan.data && plan.kpis.some((k) => k.value === undefined)) {
      const rows = plan.data.filter((r) => plan.filters.every((f, i) => active[i] === null || active[i] === '' || !(f.field in r) || String(r[f.field]) === String(active[i])));
      const slot = root.querySelector('.pa-kslot');
      if (slot) slot.innerHTML = kpiMarkup(plan, rows);
    }
  };
  root.querySelectorAll('.pa-dfilter button').forEach((b) => b.addEventListener('click', () => {
    const i = +b.dataset.f;
    active[i] = b.dataset.v || null;
    root.querySelectorAll(`.pa-dfilter button[data-f="${i}"]`).forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
    draw();
  }));
  root.querySelectorAll('.pa-dfilter select').forEach((sel) => sel.addEventListener('change', () => { active[+sel.dataset.f] = sel.value || null; draw(); }));
  draw();
  return { plan, update: draw, destroy() { Object.values(handles).forEach((h) => h && h.destroy && h.destroy()); } };
}

/** Navegador: dibuja un dashboard dentro de un elemento. */
export function renderDashboard(target, spec) {
  const host = typeof target === 'string' ? document.querySelector(target) : target;
  if (!host) throw new PlotError('No encontré el elemento destino.', 'renderDashboard("#tablero", spec)');
  if (typeof document !== 'undefined' && !document.getElementById('pa-dash-css')) {
    const st = document.createElement('style'); st.id = 'pa-dash-css'; st.textContent = DASH_CSS; document.head.appendChild(st);
  }
  const plan = planDashboard(spec);
  host.innerHTML = dashboardMarkup(plan);
  return mountDashboard(host.firstElementChild, plan);
}

// ── Servidor: página HTML autónoma ─────────────────────────────────────────
/**
 * Página HTML de un archivo con el dashboard: gráficos ya dibujados (se ven
 * sin JavaScript, sirven para PDF) y, si está la biblioteca para el
 * navegador, tooltips y filtros.
 */
export function dashboard(spec) {
  const plan = planDashboard(spec);
  const svgs = {};
  for (const p of plan.panels) if (!p.error) {
    try { svgs[p.id] = core.plot({ ...p.spec, width: p.span >= 12 ? 1200 : p.span >= 8 ? 800 : p.span >= 6 ? 600 : 400 }); }
    catch (e) { p.error = e.message.split('\n')[0]; }
  }
  const needsGeo = plan.panels.some((p) => ['choropleth', 'symbolmap'].includes(p.spec.type) && typeof p.spec.geo !== 'object');
  const lib = core.bundleSource && core.bundleSource();
  const bundle = lib && (needsGeo ? lib + '\n' + (core.bundleSource('plotagents-geo.js') || '') : lib);
  const json = JSON.stringify(plan).replace(/</g, '\\u003c');
  const lang = String(plan.locale).slice(0, 2);
  const fonts = [...new Set([plan.theme.fontImport, 'https://fonts.googleapis.com/css2?family=Mozilla+Text:wght@400;500;600;700&display=swap'].filter(Boolean))];
  return `<!doctype html>
<html lang="${esc(lang)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(plan.title || 'Dashboard')}</title>
${fonts.map((u) => `<link rel="stylesheet" href="${esc(u)}">`).join('\n')}
<style>:root{color-scheme:${plan.theme.mode === 'dark' ? 'dark' : 'light'}}body{margin:0;background:${plan.theme.surface}}${DASH_CSS}</style>
</head><body>
${dashboardMarkup(plan, svgs)}
${bundle ? `<script>${bundle.replace(/<\/(script)/gi, '<\\/$1')}</script>
<script type="application/json" id="pa-dash-plan">${json}</script>
<script>plotagents.mountDashboard(document.querySelector('.pa-dash'),JSON.parse(document.getElementById('pa-dash-plan').textContent));</script>` : ''}
</body></html>`;
}

/** Nunca lanza: { ok, html, plan, errors, warnings, suggestions } (para agentes). */
export function safeDashboard(spec) {
  const rep = lintDashboard(spec || {});
  if (!rep.ok) return { ...rep, html: null, plan: null };
  try { const html = dashboard(spec); return { ...rep, ok: true, html, plan: planDashboard(spec) }; }
  catch (e) { return { ...rep, ok: false, html: null, plan: null, errors: [...rep.errors, { code: 'render', message: e.message.split('\n')[0], fix: e.hint }] }; }
}

