// Revisión de un spec ANTES de dibujar: errores que impiden el gráfico y
// sugerencias de diseño (de los cursos de visualización para la gestión).
// Pensado para que un agente corrija su propio spec en un segundo intento.
import { ensureData, fieldsOf, fieldKind, uniq, num, PlotError } from './data.js';
import { inferType, TYPES, normalizeType } from './infer.js';
import { validatePalette } from './palette.js';
import { themeFor } from './theme.js';
import { parseDate } from './format.js';

/** El índice registra aquí un dibujo de prueba (para revisar coincidencias de mapas). */
let RENDER_PROBE = null;
export const _setProbe = (fn) => { RENDER_PROBE = fn; };

export function lint(spec = {}) {
  const errors = [];
  const warnings = [];
  const tips = [];
  const err = (code, message, fix) => errors.push({ code, message, fix });
  const warn = (code, message, fix) => warnings.push({ code, message, fix });
  const sug = (code, message, fix) => tips.push({ code, message, fix });

  let data = [];
  const rawWords = !spec.data && (typeof spec.text === 'string' || Array.isArray(spec.text));
  try { data = spec.type === 'kpi' || spec.items || rawWords ? [] : ensureData(spec); } catch (e) { err('data', e.message.split('\n')[0], 'Pasa `data` como arreglo de filas: [{ categoria: "A", valor: 10 }]'); }
  const type = spec.type && spec.type !== 'auto' ? normalizeType(spec.type)[0] : inferType(spec, data);
  if (!TYPES.includes(type)) err('type', `Tipo "${spec.type}" no soportado.`, `Usa uno de: ${TYPES.join(', ')}`);
  const fields = fieldsOf(data);
  const check = (f, role) => {
    for (const ff of [].concat(f ?? [])) if (ff && !fields.includes(ff)) err('field', `El campo "${ff}" (${role}) no existe.`, `Campos disponibles: ${fields.join(', ')}`);
  };
  if (data.length) {
    check(spec.x, 'x'); check(spec.y, 'y'); check(spec.series ?? spec.color, 'series'); check(spec.size, 'size');
    check(spec.value, 'value'); check(spec.label, 'label'); if (!['network', 'flowchart'].includes(type)) check(spec.group, 'group'); check(spec.path, 'path');
    check(spec.from, 'from'); check(spec.to, 'to');
  } else if (type !== 'kpi' && !rawWords && !errors.length) err('empty', 'No hay filas en `data`.', 'Entrega al menos una fila.');

  if (!spec.title) sug('title', 'Falta el título.', 'Escribe el hallazgo como una frase completa: "Biobío concentra el 32% de las ventas", no "Ventas por región".');
  else if (!/\d/.test(spec.title) && /^(evoluci[oó]n|distribuci[oó]n|comparaci[oó]n|ranking|gr[aá]fico|ventas|total|resumen)\b|\b(por|seg[uú]n|vs\.?)\s+\w+$/i.test(spec.title.trim())) sug('title-fact', 'El título describe el gráfico pero no dice qué muestra.', 'Un buen título es un hecho, idealmente con la cifra clave.');
  if (!spec.source) sug('source', 'Falta la fuente de los datos.', 'Agrega `source: "INE, 2025"` (o "datos ilustrativos").');

  const series = spec.series ?? spec.color;
  const nSeries = series && fields.includes(series) ? uniq(data.map((r) => String(r[series]))).length : Array.isArray(spec.y) ? spec.y.length : 1;
  if (nSeries > 8) warn('series-max', `${nSeries} series: solo hay 8 colores distinguibles; desde la 9.ª se pintan en gris.`, 'Agrupa la cola en "Otros", usa `highlight` o divide en varios gráficos.');

  if (type === 'bar') {
    const x = spec.x ?? fields.find((f) => fieldKind(data, f) === 'category');
    const nCat = x && fields.includes(x) ? uniq(data.map((r) => String(r[x]))).length : 0;
    if (nCat === 1 && nSeries === 1) sug('one-bar', 'Una sola barra no compara nada.', 'Usa `type: "kpi"` para mostrar el número.');
    if (nCat > 40 && !spec.top) warn('too-many-bars', `${nCat} categorías: se mostrarán las 25 mayores y el resto como "Otros".`, 'Fija `top: N` para controlar el corte.');
    if (spec.stack && nSeries > 5) sug('stack-many', 'Apilar más de 5 series dificulta comparar los segmentos del medio.', 'Considera barras agrupadas, `highlight` o `stack: "percent"`.');
    if (x && fieldKind(data, x) === 'date' && nCat > 24) sug('bar-time', 'Muchos periodos en barras.', 'Para tendencias largas, `type: "line"` se lee mejor.');
  }
  if (type === 'line' || type === 'area') {
    const x = spec.x;
    if (nSeries > 4 && spec.highlight === undefined) warn('line-many', `${nSeries} líneas: sobre 3-4 el gráfico se vuelve espagueti.`, 'Usa `highlight: "Serie"` para destacar una y atenuar el resto, o separa en varios gráficos.');
    if (x && fields.includes(x) && fieldKind(data, x) === 'category' && !/^(q|t)\d|^\d/i.test(String(data[0]?.[x]))) sug('line-nominal', 'El eje x tiene categorías sin orden: las líneas sugieren continuidad.', 'Para comparar categorías usa `type: "bar"`.');
    const pts = x && fields.includes(x) ? uniq(data.map((r) => String(r[x]))).length : 0;
    if (pts && pts < 3) sug('line-few', 'Menos de 3 puntos en el tiempo.', 'Con 2 periodos, barras agrupadas o un `kpi` con variación comunican mejor.');
    if (Array.isArray(spec.y) && spec.y.length === 2 && !spec.index) {
      const [a, b] = spec.y.map((f) => Math.max(...data.map((r) => Math.abs(num(r[f]))).filter(Number.isFinite)));
      if (a && b && Math.max(a, b) / Math.min(a, b) > 10) warn('dual-scale', 'Las dos medidas tienen escalas muy distintas (no hay doble eje: inventa correlaciones).', 'Usa `index: true` (base 100) o dos gráficos separados.');
    }
  }
  if (type === 'donut') {
    const lf = spec.label ?? spec.x ?? fields.find((f) => fieldKind(data, f) === 'category');
    const vf = spec.value ?? spec.y ?? fields.find((f) => fieldKind(data, f) === 'number');
    const n = lf ? uniq(data.map((r) => String(r[lf]))).length : 0;
    if (n > 6) warn('donut-slices', `${n} segmentos: sobre 6 la dona no se lee; se agrupan en "Otros".`, 'Usa `type: "bar"` o `type: "treemap"`.');
    if (n === 2) sug('donut-two', 'Dos segmentos son un solo número.', 'Usa `type: "kpi"` con el porcentaje.');
    if (vf && n >= 3) {
      const vals = data.map((r) => num(r[vf])).filter((v) => v > 0).sort((a, b) => b - a);
      if (vals.length >= 3 && vals[0] / vals[vals.length - 1] < 1.35) sug('donut-close', 'Los valores son muy parecidos: los ángulos no permiten compararlos.', 'Usa `type: "bar"` ordenado.');
    }
    if (data.some((r) => num(r[vf]) < 0)) err('negative', 'La dona no admite valores negativos.', 'Usa barras.');
  }
  if (type === 'treemap') {
    const vf = spec.value ?? spec.y ?? fields.find((f) => fieldKind(data, f) === 'number');
    if (vf && data.some((r) => num(r[vf]) < 0)) warn('negative', 'Los valores negativos se omiten en el treemap.', 'Usa barras para datos con signo.');
    const gf = spec.group ?? (Array.isArray(spec.path) && spec.path.length > 1 ? spec.path[0] : null);
    if (gf && fields.includes(gf) && uniq(data.map((r) => String(r[gf]))).length > 8) warn('groups-max', 'Más de 8 grupos: desde el 8.º van en gris "Otros".', 'Agrupa categorías o usa otro nivel de jerarquía.');
  }
  if (type === 'scatter' || type === 'bubble') {
    if (nSeries > 3) warn('scatter-colors', `${nSeries} grupos de color en dispersión: solo los 3 primeros colores son distinguibles entre todos los pares para daltonismo.`, 'Usa `highlight`, agrupa o separa en varios gráficos.');
    if (data.length > 2000) sug('overplot', `${data.length} puntos: puede haber sobreposición.`, 'Reduce `radius` o usa un mapa de calor.');
  }
  // Campos de facetas y tiempo
  if (data.length) { check(spec.facet ?? spec.col, 'facet'); check(spec.time, 'time'); check(spec.hue, 'hue'); }

  // Paleta propia: se valida con las mismas reglas que la de fábrica.
  const custom = spec.palette || (spec.theme && typeof spec.theme === 'object' && spec.theme.categorical);
  if (custom) {
    const th = themeFor(spec);
    const n = Math.max(2, Math.min(th.categorical.length, nSeries));
    const rep = validatePalette(th.categorical.slice(0, n), { mode: th.mode, surface: th.surface, pairs: type === 'scatter' || type === 'bubble' ? 'all' : 'adjacent' });
    for (const c of rep.checks) if (c.status === 'fail') warn('palette-' + c.name, `Paleta: ${c.detail}`, 'Cambia el orden o los tonos, o usa la paleta de fábrica.');
  }

  const numericIn = (f) => f && fields.includes(f) && ['number', 'year'].includes(fieldKind(data, f));
  if (['hist', 'kde', 'ecdf'].includes(type)) {
    const f = spec.x ?? spec.y;
    if (f && fields.includes(f) && !numericIn(f)) err('numeric', `"${f}" no es numérico: ${type} necesita una medida.`, 'Para contar categorías usa `type: "countplot"`.');
    if (data.length < 20) sug('few-obs', `Solo ${data.length} observaciones: la forma de la distribución es poco confiable.`, 'Con pocos datos, `type: "strip"` muestra cada punto.');
  }
  if (['regplot', 'residplot', 'jointplot'].includes(type)) {
    for (const f of [spec.x, spec.y]) if (f && fields.includes(f) && !numericIn(f)) err('numeric', `"${f}" no es numérico: la regresión necesita dos medidas.`, 'Usa `type: "box"` para comparar una medida entre categorías.');
    if (data.length < 8) warn('few-obs', `Solo ${data.length} puntos: la recta y su intervalo son poco confiables.`, 'Muestra los puntos con `type: "scatter"`.');
  }
  if (['box', 'violin'].includes(type) && data.length && spec.x && fields.includes(spec.x)) {
    const counts = new Map();
    for (const r of data) counts.set(String(r[spec.x]), (counts.get(String(r[spec.x])) || 0) + 1);
    const small = [...counts].filter(([, n]) => n < 5).map(([k]) => k);
    if (small.length) sug('few-per-group', `Grupos con menos de 5 datos: ${small.slice(0, 4).join(', ')}.`, '`type: "strip"` o `points: true` muestran cada observación.');
  }
  if (type === 'radar' && nSeries > 4) warn('radar-many', `${nSeries} series en un radar se tapan entre sí.`, 'Usa `highlight`, `facet` o barras agrupadas.');
  if ((type === 'line' || type === 'area') && spec.yScale === 'log' && data.some((r) => num(r[Array.isArray(spec.y) ? spec.y[0] : spec.y]) <= 0)) warn('log-nonpositive', 'Hay valores ≤ 0: la escala log no los puede mostrar.', 'Quita la escala log o filtra esos valores.');

  if (type === 'choropleth' || type === 'symbolmap') {
    const _unmatched = [];
    try { RENDER_PROBE?.({ ...spec, _unmatched }); } catch { /* el error ya se reporta al dibujar */ }
    if (_unmatched.length) warn('geo-unmatched', `${_unmatched.length} fila(s) no coinciden con el mapa: ${_unmatched.slice(0, 5).join(', ')}.`, 'Revisa los nombres o usa códigos (p. ej. "XIII", "ARG", "TX"), o indica `featureKey`.');
  }
  // Formas punteadas: sin explicación, el rayado no se entiende.
  if ((spec.dashed !== undefined && spec.dashed !== false) || spec.dashedFrom !== undefined) {
    if (spec.dashedLabel === undefined) sug('dashed-label', 'Hay formas punteadas pero no se dice qué significan (la leyenda dirá "Estimado").', 'Agrega `dashedLabel: "Proyección"`, "Cifra preliminar" o lo que corresponda.');
    if (spec.dashedFrom !== undefined && !['line', 'area', 'bar', 'column', 'count'].includes(type)) warn('dashed-from-type', '`dashedFrom` solo aplica a líneas, áreas y columnas con eje de tiempo.', 'Usa `dashed` con una lista de categorías o un campo de los datos.');
  }
  if (type === 'pyramid') {
    const sf = spec.sex ?? spec.series ?? spec.hue;
    if (sf && fields.includes(sf)) { const n = uniq(data.map((r) => String(r[sf]))).length; if (n !== 2) err('pyramid-sides', `La pirámide necesita exactamente 2 grupos en "${sf}" (hay ${n}).`, 'Usa `type: "bar"` con `series` para más grupos.'); }
  }
  if (type === 'chord' && data.length && uniq(data.flatMap((r) => [r[spec.from ?? 'from'], r[spec.to ?? 'to']])).length > 16) warn('chord-many', 'Más de 16 grupos en un diagrama de cuerdas: los arcos se vuelven ilegibles.', 'Agrupa los menores en "Otros" o usa `type: "sankey"`.');
  if (type === 'network' && data.length > 2000) sug('network-big', `${data.length} conexiones: la red puede verse como una mancha.`, 'Filtra las conexiones débiles o usa `layout: "circle"`.');

  if (type === 'wordcloud') {
    if (!data.length && !spec.text) err('empty', 'La nube no tiene palabras.', 'Pasa filas { palabra, valor } o `text: "…"` con el texto a contar.');
    if (data.length && data.length <= 12) sug('wordcloud-few', `Con ${data.length} palabras, una nube compara mal los tamaños.`, 'Para ordenar y comparar, usa `type: "bar"` con `top: 15`.');
    if (!spec.subtitle) sug('wordcloud-measure', 'Una nube no dice qué mide el tamaño.', 'Escribe en `subtitle` qué se contó: "Menciones en 1.240 respuestas abiertas".');
  }
  if (type === 'gantt' && data.length) {
    const sF = spec.start ?? fields.find((f) => /^(start|inicio|desde|begin|comienzo|from)/i.test(f));
    const eF = spec.end ?? fields.find((f) => /^(end|fin|hasta|finish|termino|término|due|vence|to)$/i.test(f));
    if (!sF) err('gantt-start', 'La carta Gantt necesita una fecha de inicio por tarea.', 'Indica `start` y `end` (o `duration`): start: "inicio", end: "fin".');
    else if (eF && fields.includes(eF)) {
      const back = data.filter((r) => { const a = parseDate(r[sF]), b = parseDate(r[eF]); return Number.isFinite(a) && Number.isFinite(b) && b < a; });
      if (back.length) warn('gantt-backwards', `${back.length} tarea(s) terminan antes de empezar.`, 'Revisa si `start` y `end` están invertidos.');
    }
    if (data.length > 40) sug('gantt-many', `${data.length} tareas en una sola carta: cuesta encontrar la ruta crítica.`, 'Agrupa por fase con `group`, resume subtareas o usa `facet` por equipo.');
    if (spec.today === undefined && !spec.refLines) sug('gantt-today', 'Una línea de "hoy" dice de un vistazo qué va atrasado.', 'Agrega `today: "2026-03-12"` (o `today: true`).');
  }
  if (type === 'kpi' && !(spec.items || spec.data || []).length) err('items', 'El KPI necesita `items`.', 'items: [{ label: "Ventas", value: 1250, delta: 0.12, period: "vs 2025" }]');

  if (String(spec.locale || '').toLowerCase().startsWith('en')) for (const list of [errors, warnings, tips]) list.forEach((it, i) => { list[i] = toEnglish(it); });
  return { ok: errors.length === 0, type, errors, warnings, suggestions: tips };
}

// ── English messages (locale: "en") ───────────────────────────────────────
// Agents read these to repair their own spec, so they follow the chart's
// language. The Spanish message is the source; dynamic parts are reused.
const qs = (s) => [...String(s).matchAll(/"([^"]*)"/g)].map((m) => m[1]);
const n0 = (s) => (/(\d+)/.exec(String(s)) || [])[1];
const after = (s) => String(s ?? '').replace(/^[^:]*:\s*/, '');
const EN = {
  data: (m) => [m.message, 'Pass `data` as an array of rows: [{ category: "A", value: 10 }]'],
  type: (m) => [`Chart type "${qs(m.message)[0]}" is not supported.`, `Use one of: ${after(m.fix)}`],
  field: (m) => { const [f] = qs(m.message); const role = (/\(([^)]+)\)/.exec(m.message) || [])[1]; return [`The field "${f}" (${role}) does not exist.`, `Available fields: ${after(m.fix)}`]; },
  empty: () => ['`data` has no rows.', 'Pass at least one row.'],
  title: () => ['The title is missing.', 'Write the finding as a full sentence: "Biobío accounts for 32% of sales", not "Sales by region".'],
  'title-fact': () => ['The title describes the chart but does not say what it shows.', 'A good title is a fact, ideally with the key number.'],
  source: () => ['The data source is missing.', 'Add `source: "Census Bureau, 2025"` (or "illustrative data").'],
  'series-max': (m) => [`${n0(m.message)} series: there are only 8 distinguishable colors; from the 9th on they turn gray.`, 'Fold the tail into "Other", use `highlight` or split into several charts.'],
  'one-bar': () => ['A single bar compares nothing.', 'Use `type: "kpi"` to show the number.'],
  'too-many-bars': (m) => [`${n0(m.message)} categories: the 25 largest will be shown and the rest folded into "Other".`, 'Set `top: N` to control the cut.'],
  'stack-many': () => ['Stacking more than 5 series makes the middle segments hard to compare.', 'Consider grouped bars, `highlight` or `stack: "percent"`.'],
  'bar-time': () => ['Many periods drawn as bars.', 'For long trends, `type: "line"` reads better.'],
  'line-many': (m) => [`${n0(m.message)} lines: beyond 3 or 4 the chart turns into spaghetti.`, 'Use `highlight: "Series"` to emphasize one and mute the rest, or split into several charts.'],
  'line-nominal': () => ['The x axis holds unordered categories: lines suggest continuity.', 'To compare categories, use `type: "bar"`.'],
  'line-few': () => ['Fewer than 3 points in time.', 'With 2 periods, grouped bars or a `kpi` with its change say it better.'],
  'dual-scale': () => ['The two measures have very different scales (there is no dual axis: it invents correlations).', 'Use `index: true` (base 100) or two separate charts.'],
  'donut-slices': (m) => [`${n0(m.message)} slices: beyond 6 a donut cannot be read; the rest fold into "Other".`, 'Use `type: "bar"` or `type: "treemap"`.'],
  'donut-two': () => ['Two slices are a single number.', 'Use `type: "kpi"` with the percentage.'],
  'donut-close': () => ['The values are very similar: angles cannot tell them apart.', 'Use a sorted `type: "bar"`.'],
  negative: (m) => (/dona/.test(m.message) ? ['Donuts cannot show negative values.', 'Use bars.'] : ['Negative values are left out of the treemap.', 'Use bars for signed data.']),
  'groups-max': () => ['More than 8 groups: from the 8th on they go into a gray "Other".', 'Merge categories or use another hierarchy level.'],
  'scatter-colors': (m) => [`${n0(m.message)} color groups in a scatter: only the first 3 colors stay distinct across every pair for color-blind readers.`, 'Use `highlight`, merge groups or split into several charts.'],
  overplot: (m) => [`${n0(m.message)} points: they may overlap.`, 'Reduce `radius` or use a heatmap.'],
  numeric: (m) => { const [f] = qs(m.message); return /regresi/.test(m.message) ? [`"${f}" is not numeric: a regression needs two measures.`, 'Use `type: "box"` to compare a measure across categories.'] : [`"${f}" is not numeric: this chart needs a measure.`, 'To count categories, use `type: "countplot"`.']; },
  'few-obs': (m) => (/recta/.test(m.message) ? [`Only ${n0(m.message)} points: the fit and its interval are unreliable.`, 'Show the points with `type: "scatter"`.'] : [`Only ${n0(m.message)} observations: the shape of the distribution is unreliable.`, 'With little data, `type: "strip"` shows every point.']),
  'few-per-group': (m) => [`Groups with fewer than 5 observations: ${after(m.message).replace(/\.$/, '')}.`, '`type: "strip"` or `points: true` show each observation.'],
  'radar-many': (m) => [`${n0(m.message)} series on a radar hide one another.`, 'Use `highlight`, `facet` or grouped bars.'],
  'log-nonpositive': () => ['There are values ≤ 0: a log scale cannot show them.', 'Drop the log scale or filter those values.'],
  'geo-unmatched': (m) => [`${n0(m.message)} row(s) match no shape on the map: ${after(m.message).replace(/\.$/, '')}.`, 'Check the names or use codes ("XIII", "ARG", "TX"), or set `featureKey`.'],
  'dashed-label': () => ['Some shapes are dashed but nothing says what they mean (the legend will say "Estimate").', 'Add `dashedLabel: "Projection"`, "Preliminary" or whatever applies.'],
  'dashed-from-type': () => ['`dashedFrom` only applies to lines, areas and columns on a time axis.', 'Use `dashed` with a list of categories or a data field.'],
  'pyramid-sides': (m) => { const [f] = qs(m.message); return [`A population pyramid needs exactly 2 groups in "${f}" (found ${(/hay (\d+)/.exec(m.message) || [])[1]}).`, 'Use `type: "bar"` with `series` for more groups.']; },
  'chord-many': () => ['More than 16 groups in a chord diagram: the ribbons become unreadable.', 'Fold the smallest into "Other" or use `type: "sankey"`.'],
  'network-big': (m) => [`${n0(m.message)} links: the network may look like a blob.`, 'Filter weak links or use `layout: "circle"`.'],
  'gantt-start': () => ['A Gantt chart needs a start date per task.', 'Set `start` and `end` (or `duration`): start: "start", end: "end".'],
  'gantt-backwards': (m) => [`${n0(m.message)} task(s) end before they start.`, 'Check whether `start` and `end` are swapped.'],
  'gantt-many': (m) => [`${n0(m.message)} tasks in one chart: the critical path is hard to find.`, 'Group by phase with `group`, roll up subtasks or use `facet` by team.'],
  'gantt-today': () => ['A "today" line shows at a glance what is late.', 'Add `today: "2026-03-12"` (or `today: true`).'],
  'wordcloud-few': (m) => [`With ${n0(m.message)} words, a cloud compares sizes poorly.`, 'To rank and compare, use `type: "bar"` with `top: 15`.'],
  'wordcloud-measure': () => ['A word cloud does not say what its sizes measure.', 'Say what was counted in `subtitle`: "Mentions in 1,240 open answers".'],
  items: () => ['A KPI needs `items`.', 'items: [{ label: "Sales", value: 1250, delta: 0.12, period: "vs 2025" }]'],
};
function toEnglish(it) {
  const f = EN[it.code] || (it.code.startsWith('palette-') ? (m) => [m.message.replace(/^Paleta:/, 'Palette:'), 'Change the order or the hues, or use the default palette.'] : null);
  if (!f) return it;
  const [message, fix] = f(it);
  return { ...it, message, fix };
}

export { PlotError };
