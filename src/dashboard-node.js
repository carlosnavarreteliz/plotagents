// plotagents · tableros, lado servidor: revisión (lint), página HTML autónoma
// y el plan empacado que va dentro. Vive aparte de src/dashboard.js para que
// las páginas (src/page-dashboard.js) no carguen código que nunca corre en el navegador.
import { _core as core, tidy, hasField, planDashboard, dashboardMarkup, DASH_CSS } from './dashboard.js';
import { packTable } from './data.js';
import { esc } from './svg.js';
import { esEn as T } from './i18n.js';

// ── Revisión (lint) ────────────────────────────────────────────────────────
export function lintDashboard(spec = {}) {
  spec = tidy(spec && typeof spec === 'object' ? spec : {});
  const locale = spec.locale || 'es';
  const L = (es, en) => T(locale, es, en);
  const errors = [], warnings = [], suggestions = [];
  const charts = spec.charts || [];
  if (!charts.length && !(spec.kpis || []).length) errors.push({ code: 'dash-empty', message: L('El dashboard no tiene gráficos ni KPIs.', 'The dashboard has no charts or KPIs.'), fix: L('Agrega `charts: [spec, …]` y/o `kpis: [{ label, value }]`.', 'Add `charts: [spec, …]` and/or `kpis: [{ label, value }]`.') });
  if (charts.length > 9) warnings.push({ code: 'dash-many-charts', message: L(`${charts.length} gráficos: un dashboard que lo muestra todo no destaca nada.`, `${charts.length} charts: a dashboard that shows everything highlights nothing.`), fix: L('Quédate con 4–6 que respondan una pregunta; el resto, en otra página.', 'Keep the 4–6 that answer one question; move the rest to another page.') });
  else if (charts.length > 6) suggestions.push({ code: 'dash-charts', message: L(`${charts.length} gráficos: sobre 6 cuesta leer el dashboard de un vistazo.`, `${charts.length} charts: beyond 6 the dashboard is hard to read at a glance.`), fix: L('Prioriza o agrupa en pestañas/páginas.', 'Prioritize, or split into pages.') });
  const nk = (spec.kpis || []).length;
  if (nk > 5) warnings.push({ code: 'dash-many-kpis', message: L(`${nk} KPIs: sobre 5 ninguno destaca.`, `${nk} KPIs: beyond 5 none stands out.`), fix: L('Deja los 3–5 que mueven decisiones.', 'Keep the 3–5 that drive decisions.') });
  let types = [];
  try { types = charts.map((c) => (core() ? core().resolve({ ...c, ...(c.data === undefined && spec.data ? { data: spec.data } : {}) }).type : c.type)); } catch { types = charts.map((c) => c.type); }
  const pies = types.filter((t) => t === 'donut' || t === 'pie').length;
  if (pies > 1) suggestions.push({ code: 'dash-pies', message: L(`${pies} donas o tortas: compararlas entre sí es difícil.`, `${pies} donuts or pies: comparing them with each other is hard.`), fix: L('Usa una sola, o barras apiladas al 100% (`stack: "percent"`).', 'Keep one, or use 100% stacked bars (`stack: "percent"`).') });
  const themes = new Set(charts.map((c) => (typeof c.theme === 'string' ? c.theme : c.theme ? 'custom' : null)).filter(Boolean));
  if (themes.size > 1) warnings.push({ code: 'dash-themes', message: L('Los gráficos usan temas distintos.', 'Charts use different themes.'), fix: L('Fija `theme` en el dashboard y quítalo de los gráficos.', 'Set `theme` on the dashboard and remove it from the charts.') });
  for (const f of [].concat(spec.filters || [])) {
    const field = typeof f === 'string' ? f : f.field;
    const has = [spec.data, ...charts.map((c) => c.data)].some((d) => Array.isArray(d) && d.some((r) => hasField(r, field)));
    if (!has) warnings.push({ code: 'dash-filter-field', message: L(`El filtro "${field}" no existe en los datos de ningún gráfico.`, `The filter "${field}" is not in any chart's data.`), fix: L('Usa un campo de `data`.', 'Use a field of `data`.') });
  }
  // Revisión de cada gráfico, con su número y título.
  charts.forEach((c, i) => {
    const r = core() ? core().lint({ locale, ...c, ...(c.data === undefined && spec.data ? { data: spec.data } : {}), source: c.source ?? spec.source ?? 'dashboard' }) : null;
    if (!r) return;
    const tag = `${L('Gráfico', 'Chart')} ${i + 1}${c.title ? ` («${String(c.title).slice(0, 40)}»)` : ''}: `;
    for (const [list, out] of [[r.errors, errors], [r.warnings, warnings], [r.suggestions, suggestions]]) for (const it of list) if (it.code !== 'title') out.push({ ...it, chart: i, message: tag + it.message });
  });
  return { ok: errors.length === 0, errors, warnings, suggestions };
}

/**
 * Plan para incrustar en la página: los datos compartidos van una sola vez
 * (los gráficos que los usan solo lo marcan) y como encabezado + filas.
 */
export function packPlan(plan) {
  const shared = plan.data;
  return {
    ...plan,
    data: packTable(shared),
    panels: plan.panels.map((p) => {
      if (shared && p.spec.data === shared) { const { data: _d, ...spec } = p.spec; return { ...p, spec, sharedData: true }; }
      return Array.isArray(p.spec.data) ? { ...p, spec: { ...p.spec, data: packTable(p.spec.data) } } : p;
    }),
  };
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
    try { svgs[p.id] = core().plot({ ...p.spec, width: p.span >= 12 ? 1200 : p.span >= 8 ? 800 : p.span >= 6 ? 600 : 400 }); }
    catch (e) { p.error = e.message.split('\n')[0]; }
  }
  // Solo los módulos de los tipos de gráfico del tablero (no la biblioteca entera).
  const live = plan.panels.filter((p) => !p.error).map((p) => p.spec);
  let bundle = core().pageScript ? core().pageScript(live, { dashboard: true }) : null;
  if (!bundle && core().bundleSource) {
    const lib = core().bundleSource();
    const needsGeo = plan.panels.some((p) => ['choropleth', 'symbolmap', 'pointmap'].includes(p.spec.type) && typeof p.spec.geo !== 'object');
    bundle = lib && (needsGeo ? lib + '\n' + (core().bundleSource('plotagents-geo.js') || '') : lib);
  }
  const json = JSON.stringify(packPlan(plan)).replace(/</g, '\\u003c');
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
  let rep;
  try { rep = lintDashboard(spec || {}); }
  catch (e) { return { ok: false, html: null, plan: null, errors: [{ code: 'render', message: String(e.message).split('\n')[0], fix: e.hint || 'Revisa que `charts` sea una lista de specs y `kpis` una lista de objetos.' }], warnings: [], suggestions: [] }; }
  if (!rep.ok) return { ...rep, html: null, plan: null };
  try { const html = dashboard(spec); return { ...rep, ok: true, html, plan: planDashboard(spec) }; }
  catch (e) { return { ...rep, ok: false, html: null, plan: null, errors: [...rep.errors, { code: 'render', message: e.message.split('\n')[0], fix: e.hint || 'Revisa `charts`, `kpis` y `data` del dashboard.' }] }; }
}
