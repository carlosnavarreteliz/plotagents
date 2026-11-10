// Revisión de un spec ANTES de dibujar: errores que impiden el gráfico y
// sugerencias de diseño (de los cursos de visualización para la gestión).
// Pensado para que un agente corrija su propio spec en un segundo intento.
import { ensureData, fieldsOf, fieldKind, uniq, num, PlotError } from './data.js';
import { inferType, TYPES, normalizeType } from './infer.js';
import { validatePalette } from './palette.js';
import { themeFor, themes, palettes, ramps } from './theme.js';
import { resolveColorScale, colorScaleNames, RAINBOW } from './colorscales.js';
import { schema } from './schema.js';
import { parseDate } from './format.js';
import { binnedScale } from './colorscales.js';
import { autoLocale } from './i18n.js';
import { COLUMN_TYPES, columnType } from './charts/table.js';

/** El índice registra aquí un dibujo de prueba (para revisar coincidencias de mapas). */
let RENDER_PROBE = null;
export const _setProbe = (fn) => { RENDER_PROBE = fn; };

/** Nunca lanza: si la revisión misma falla con un spec raro, lo dice como aviso y sigue. */
export function lint(spec = {}) {
  try { return lintSpec(spec); }
  catch (e) {
    const type = spec && typeof spec === 'object' && typeof spec.type === 'string' ? spec.type : 'auto';
    return { ok: true, type, errors: [], warnings: [{ code: 'lint-failed', message: `No se pudo revisar el spec por completo: ${String(e && e.message).split('\n')[0]}`, fix: 'Revisa que cada opción tenga el tipo del schema (`toolDefinition()`): textos donde van textos, listas donde van listas.' }], suggestions: [] };
  }
}

function lintSpec(spec = {}) {
  if (!spec || typeof spec !== 'object') spec = {};
  // Idioma de los mensajes: el del gráfico (con `locale: "auto"`, y en tablas sin locale, el reconocido del texto).
  const autoLang = spec.locale === 'auto' || (spec.locale === undefined && /^(table|tabla|tables|datatable|data-table|grid)$/i.test(String(spec.type || '')));
  const en = (autoLang ? autoLocale(spec, Array.isArray(spec.data) ? spec.data : []) : String(spec.locale || '')).toLowerCase().startsWith('en');
  /** Mensajes nuevos: se escriben directo en ambos idiomas. */
  const L = (es, english) => (en ? english : es);
  const errors = [];
  const warnings = [];
  const tips = [];
  const err = (code, message, fix) => errors.push({ code, message, fix });
  const warn = (code, message, fix) => warnings.push({ code, message, fix });
  const sug = (code, message, fix) => tips.push({ code, message, fix });

  let data = [];
  const rawWords = !spec.data && (typeof spec.text === 'string' || Array.isArray(spec.text));
  const linkageOnly = Array.isArray(spec.linkage) && !spec.data;
  // Una red con posiciones dadas puede venir sin aristas: basta la tabla `nodes`.
  const presetNodes = spec.data === undefined && Array.isArray(spec.nodes) && spec.nodes.length && /^(preset|fixed|fija|posiciones)$/i.test(String(spec.layout ?? ''));
  try { data = spec.type === 'kpi' || spec.items || rawWords || presetNodes || linkageOnly ? [] : ensureData(spec); } catch (e) { err('data', e.message.split('\n')[0], 'Pasa `data` como arreglo de filas: [{ categoria: "A", valor: 10 }]'); }
  const type = spec.type && spec.type !== 'auto' ? normalizeType(String(spec.type).trim())[0] : inferType(spec, data);
  if (!KNOWN_TYPES.has(type)) err('type', `Tipo "${spec.type}" no soportado.`, `Usa uno de: ${[...KNOWN_TYPES].join(', ')}`);
  const fields = fieldsOf(data);
  const check = (f, role) => {
    for (const ff of [].concat(f ?? [])) if (ff && !fields.includes(ff)) err('field', `El campo "${ff}" (${role}) no existe.`, `Campos disponibles: ${fields.join(', ')}`);
  };
  if (data.length) {
    check(spec.x, 'x'); check(spec.y, 'y'); check(spec.series ?? spec.color, 'series'); if (type !== 'network') check(spec.size, 'size');
    check(spec.value, 'value'); check(spec.label, 'label'); if (!['network', 'flowchart'].includes(type)) check(spec.group, 'group'); check(spec.path, 'path');
    check(spec.from, 'from'); check(spec.to, 'to');
  } else if (type !== 'kpi' && !rawWords && !linkageOnly && !errors.length && !(type === 'network' && Array.isArray(spec.nodes) && spec.nodes.length && /^(preset|fixed|fija|posiciones)$/i.test(String(spec.layout ?? '')))) err('empty', 'No hay filas en `data`.', 'Entrega al menos una fila.');

  if (!spec.title) sug('title', 'Falta el título.', 'Escribe el hallazgo como una frase completa: "Biobío concentra el 32% de las ventas", no "Ventas por región".');
  else if (typeof spec.title === 'string' && !/\d/.test(spec.title) && /^(evoluci[oó]n|distribuci[oó]n|comparaci[oó]n|ranking|gr[aá]fico|ventas|total|resumen)\b|\b(por|seg[uú]n|vs\.?)\s+\w+$/i.test(spec.title.trim())) sug('title-fact', 'El título describe el gráfico pero no dice qué muestra.', 'Un buen título es un hecho, idealmente con la cifra clave.');
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
  if (type === 'donut' || type === 'pie') {
    const shape = type === 'pie' ? 'torta' : 'dona';
    const lf = spec.label ?? spec.x ?? fields.find((f) => fieldKind(data, f) === 'category');
    const vf = spec.value ?? spec.y ?? fields.find((f) => fieldKind(data, f) === 'number');
    const n = lf ? uniq(data.map((r) => String(r[lf]))).length : 0;
    if (n > 6) warn('donut-slices', `${n} segmentos: sobre 6 la ${shape} no se lee; se agrupan en "Otros".`, 'Usa `type: "bar"` o `type: "treemap"`.');
    if (n === 2) sug('donut-two', 'Dos segmentos son un solo número.', 'Usa `type: "kpi"` con el porcentaje.');
    if (vf && n >= 3) {
      const vals = data.map((r) => num(r[vf])).filter((v) => v > 0).sort((a, b) => b - a);
      if (vals.length >= 3 && vals[0] / vals[vals.length - 1] < 1.35) sug('donut-close', 'Los valores son muy parecidos: los ángulos no permiten compararlos.', 'Usa `type: "bar"` ordenado.');
    }
    if (vf && data.some((r) => num(r[vf]) < 0)) err('negative', `La ${shape} no admite valores negativos.`, 'Usa barras.');
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
  if ((type === 'corr' || type === 'pairplot') && data.length) {
    const longForm = type === 'corr' && typeof spec.x === 'string' && typeof spec.y === 'string' && typeof spec.value === 'string';
    if (!longForm) {
      const list = spec.vars ?? (Array.isArray(spec.y) ? spec.y : null);
      if (spec.vars !== undefined && !Array.isArray(spec.vars)) err('corr-vars', L('`vars` debe ser una lista de campos.', '`vars` must be a list of fields.'), 'vars: ["precio", "superficie", "antiguedad"]');
      if (Array.isArray(spec.vars)) check(spec.vars, 'vars');
      const hueF = spec.hue ?? spec.series;
      const nums = (Array.isArray(list) ? list : fields.filter((f) => f !== hueF && f !== spec.label && fieldKind(data, f) === 'number')).filter((f) => fields.includes(f));
      if (Array.isArray(list)) for (const f of list) if (fields.includes(f) && fieldKind(data, f) !== 'number') err('corr-numeric', L(`"${f}" no es numérico: una correlación necesita medidas.`, `"${f}" is not numeric: a correlation needs measures.`), L('Quítalo de `vars`; para comparar una medida entre categorías usa `type: "box"`.', 'Drop it from `vars`; to compare a measure across categories use `type: "box"`.'));
      if (nums.length < 2) err('corr-vars', L(`Hay ${nums.length} campo(s) numérico(s): se necesitan al menos dos.`, `There are ${nums.length} numeric field(s): at least two are needed.`), L('Entrega filas con dos o más medidas, o indícalas en `vars: [...]`.', 'Pass rows with two or more measures, or list them in `vars: [...]`.'));
      const constant = nums.filter((f) => { const vs = data.map((r) => num(r[f])).filter(Number.isFinite); return vs.length > 1 && vs.every((v) => v === vs[0]); });
      if (constant.length) warn('corr-constant', L(`Sin variación: ${constant.join(', ')}. Su correlación no está definida (celda vacía).`, `No variation: ${constant.join(', ')}. Its correlation is undefined (empty cell).`), L('Quítalos de `vars`.', 'Drop them from `vars`.'));
      if (data.length < 10) warn('corr-few-rows', L(`Solo ${data.length} filas: una correlación con tan pocos casos es inestable.`, `Only ${data.length} rows: a correlation from so few cases is unstable.`), L('Muestra los puntos con `type: "scatter"`, o agrega `alpha: 0.05` para apagar lo no significativo.', 'Show the points with `type: "scatter"`, or add `alpha: 0.05` to grey out what is not significant.'));
      if (type === 'corr' && nums.length > 12 && !spec.cluster) sug('corr-many', L(`${nums.length} variables: el orden de los datos esconde los grupos que se mueven juntos.`, `${nums.length} variables: data order hides the groups that move together.`), L('Agrega `cluster: true` (o usa `type: "clustermap"`).', 'Add `cluster: true` (or use `type: "clustermap"`).'));
      if (type === 'corr' && nums.length > 30) warn('corr-too-many', L(`${nums.length} variables: las celdas quedan demasiado chicas para leerse.`, `${nums.length} variables: cells get too small to read.`), L('Elige las que importan con `vars: [...]`.', 'Pick the ones that matter with `vars: [...]`.'));
      if (type === 'pairplot' && !Array.isArray(list) && nums.length > 6) warn('pairplot-many', L(`${nums.length} campos numéricos: se dibujan solo los 6 primeros (${nums.slice(0, 6).join(', ')}).`, `${nums.length} numeric fields: only the first 6 are drawn (${nums.slice(0, 6).join(', ')}).`), L('Elige con `vars: [...]`, o usa `type: "corr"` para verlos todos.', 'Choose with `vars: [...]`, or use `type: "corr"` to see them all.'));
      if (type === 'pairplot' && Array.isArray(list) && list.length > 7) warn('pairplot-many', L(`${list.length} variables son ${list.length * list.length} paneles diminutos.`, `${list.length} variables make ${list.length * list.length} tiny panels.`), L('Deja 3–6 en `vars`, o usa `type: "corr"`.', 'Keep 3–6 in `vars`, or use `type: "corr"`.'));
      if (type === 'pairplot' && data.length > 3000) sug('pairplot-dense', L(`${data.length} filas: los puntos se tapan en cada panel.`, `${data.length} rows: points hide each other in every panel.`), L('Usa `type: "corr"`, o `radius: 1` con una muestra.', 'Use `type: "corr"`, or `radius: 1` with a sample.'));
    }
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
  // Red: `size`, `href`, `hollow` y `filled` son campos de la tabla `nodes`.
  if (type === 'network' && Array.isArray(spec.nodes) && spec.nodes.length) {
    const nf = fieldsOf(spec.nodes);
    for (const k of ['size', 'href', 'hollow', 'filled']) if (typeof spec[k] === 'string' && !nf.includes(spec[k])) err('node-field', L(`El campo "${spec[k]}" (${k}) no existe en \`nodes\`.`, `The field "${spec[k]}" (${k}) is not in \`nodes\`.`), L(`Campos de nodes: ${nf.join(', ')}`, `Fields of nodes: ${nf.join(', ')}`));
  }
  if (type === 'network' && spec.stretch === true && !/^(preset|fixed|fija|posiciones)$/i.test(String(spec.layout ?? ''))) warn('network-stretch', L('`stretch` sólo aplica a `layout: "preset"`.', '`stretch` only applies to `layout: "preset"`.'), L('Quita `stretch` o usa posiciones dadas.', 'Drop `stretch` or use given positions.'));
  if (type === 'network' && data.length > 2000) sug('network-big', `${data.length} conexiones: la red puede verse como una mancha.`, 'Filtra las conexiones débiles o usa `layout: "circular"` o `layout: "clusters"`.');

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
    if (spec.today === undefined && ![].concat(spec.refLines ?? []).length) sug('gantt-today', 'Una línea de "hoy" dice de un vistazo qué va atrasado.', 'Agrega `today: "2026-03-12"` (o `today: true`).');
  }
  if (type === 'gantt' && data.length) {
    const gF = spec.group ?? spec.series ?? spec.hue;
    if (gF && fields.includes(gF)) {
      const phases = uniq(data.map((r) => String(r[gF] ?? '')));
      if (spec.collapsed !== undefined && spec.collapsed !== true && spec.collapsed !== false) {
        const bad = [].concat(spec.collapsed).map(String).filter((v) => !phases.includes(v));
        if (bad.length) warn('gantt-collapsed-unknown', L(`\`collapsed\` nombra fases que no existen: ${bad.slice(0, 4).join(', ')}.`, `\`collapsed\` names phases that do not exist: ${bad.slice(0, 4).join(', ')}.`), L(`Usa valores de \`${gF}\`: ${phases.slice(0, 6).join(', ')}.`, `Use values of \`${gF}\`: ${phases.slice(0, 6).join(', ')}.`));
      }
      if (data.length > 25 && spec.collapsed === undefined) sug('gantt-collapse', L(`${data.length} tareas: plegar las fases terminadas acorta la carta.`, `${data.length} tasks: collapsing finished phases shortens the chart.`), L(`Agrega \`collapsed: ["${phases[0]}"]\` (o \`true\` para ver solo el resumen).`, `Add \`collapsed: ["${phases[0]}"]\` (or \`true\` for the summary only).`));
    }
  }
  if (type === 'table' && data.length) {
    const cols = Array.isArray(spec.columns) ? spec.columns : [];
    for (const c of cols) {
      const f = typeof c === 'string' ? c : c && typeof c === 'object' ? c.field ?? c.key ?? c.name : undefined;
      if (c && typeof c === 'object' && c.type !== undefined && !columnType(c.type)) {
        const near = didYouMean(String(c.type), COLUMN_TYPES);
        err('table-column-type', L(`Tipo de columna "${c.type}" desconocido${f ? ` (columna "${f}")` : ''}.`, `Unknown column type "${c.type}"${f ? ` (column "${f}")` : ''}.`), (near ? L(`¿Quisiste decir "${near}"? `, `Did you mean "${near}"? `) : '') + L(`Tipos: ${COLUMN_TYPES.join(', ')}.`, `Types: ${COLUMN_TYPES.join(', ')}.`));
      }
      if (f === undefined && !(c && typeof c === 'object' && columnType(c.type) === 'rank')) err('table-column', L('Una columna no dice qué campo muestra.', 'A column does not say which field it shows.'), L('Usa `columns: ["region", { field: "ventas", type: "bar" }]`.', 'Use `columns: ["region", { field: "sales", type: "bar" }]`.'));
      else if (f !== undefined) check(f, 'columns');
      if (c && typeof c === 'object' && typeof c.target === 'string') check(c.target, 'columns.target');
    }
    const by = spec.sortBy ?? spec.orderBy;
    if (by !== undefined && !fields.includes(by) && !cols.some((c) => c && typeof c === 'object' && String(c.label) === String(by)) && !['#', 'rank'].includes(String(by))) {
      const near = didYouMean(String(by), fields);
      err('table-sort', L(`\`sortBy: "${by}"\` no es una columna.`, `\`sortBy: "${by}"\` is not a column.`), (near ? L(`¿Quisiste decir "${near}"? `, `Did you mean "${near}"? `) : '') + L(`Campos: ${fields.join(', ')}.`, `Fields: ${fields.join(', ')}.`));
    }
    if (spec.pageSize !== undefined && spec.pageSize !== false && !(Number.isFinite(+spec.pageSize) && +spec.pageSize >= 1)) err('table-page-size', L('`pageSize` debe ser un entero positivo (o false).', '`pageSize` must be a positive integer (or false).'), 'pageSize: 10');
    const nCols = cols.length || fields.length;
    if (nCols > 8) warn('table-wide', L(`${nCols} columnas: en pantallas angostas la tabla pasa a tarjetas largas y en escritorio se aprieta.`, `${nCols} columns: on narrow screens the table turns into long cards, and it gets cramped on desktop.`), L('Deja las 4–7 columnas que responden la pregunta del título con `columns: [...]`.', 'Keep the 4–7 columns that answer the title\'s question with `columns: [...]`.'));
    if (data.length > 15 && spec.pageSize === false) sug('table-long', L(`${data.length} filas sin paginar hacen una imagen muy alta.`, `${data.length} unpaginated rows make a very tall image.`), L('Quita `pageSize: false` (páginas de 10), o usa `top: 15` con un orden.', 'Drop `pageSize: false` (pages of 10), or use `top: 15` with a sort.'));
    if (data.length > 0 && data.length <= 3 && nCols <= 2) sug('table-tiny', L('Una tabla de pocas cifras dice más como indicadores.', 'A table with so few numbers works better as indicators.'), L('Usa `type: "kpi"` con `items`.', 'Use `type: "kpi"` with `items`.'));
  }
  if (type === 'kpi' && ![].concat(spec.items || spec.data || []).length) err('items', 'El KPI necesita `items`.', 'items: [{ label: "Ventas", value: 1250, delta: 0.12, period: "vs 2025" }]');

  checkOptions(spec, { type, data, fields, err, warn, sug, L });

  if (en) for (const list of [errors, warnings, tips]) list.forEach((it, i) => { list[i] = toEnglish(it); });
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
  'donut-slices': (m) => [`${n0(m.message)} slices: beyond 6 a ${/torta/.test(m.message) ? 'pie' : 'donut'} cannot be read; the rest fold into "Other".`, 'Use `type: "bar"` or `type: "treemap"`.'],
  'donut-two': () => ['Two slices are a single number.', 'Use `type: "kpi"` with the percentage.'],
  'donut-close': () => ['The values are very similar: angles cannot tell them apart.', 'Use a sorted `type: "bar"`.'],
  negative: (m) => (/dona|torta/.test(m.message) ? [`${/torta/.test(m.message) ? 'Pies' : 'Donuts'} cannot show negative values.`, 'Use bars.'] : ['Negative values are left out of the treemap.', 'Use bars for signed data.']),
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
  'network-big': (m) => [`${n0(m.message)} links: the network may look like a blob.`, 'Filter weak links or use `layout: "circular"` or `layout: "clusters"`.'],
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

// ── Opciones: nombres desconocidos, valores fuera de catálogo ─────────────
// Solo avisan (warnings) salvo cuando el valor no puede funcionar (errors).

export const KNOWN_TYPES = new Set([...TYPES, 'pointmap']);

/**
 * Opciones de primer nivel que el código lee además de las del schema
 * (alias, atajos, opciones avanzadas e internas). Mejor de más que de menos:
 * un nombre válido marcado como desconocido confunde al agente.
 */
const EXTRA_OPTIONS = `
  ageOrder aggregate annotate antarctica axisInside background bandwidth barHeight barWidth bars bw_adjust bwAdjust
  cellHeight center centerLabel centerValue change changeDomain clip cmap col colWrap col_wrap collapsed collapsible
  color colorScale colormap commonNorm common_norm compareData compareField compareLabel complementary controls
  critical criticalColor cumulative current curveness cut densityNorm diverging dodge domain edgeLabel element
  endLabels exclude facetOrder fontFamily fontImport fontScale frac grid hole hueOrder invert iterations jitter join
  labelOrientation labelScale labelValues labelsFor lane lanes lat latitude legend legendPosition legendTitle level
  lineWidth lng lon longitude maxRadius maxSlices mean missing nodeId nodeLabel nodeWidth note orient orientation
  other padding panelGap panelHeight panelLabels playInterval radius region ribbonColor rug scatter shareX shareY sharex
  showMeans showValues sides size sizeFormat sizeTitle source_field span swimlanes territories thickness thresholds
  tileOpacity tileStyle tiles tilesKey todayColor truncate unit valueDomain valueFormat valueScale weekends word
  xFormat yFormat yTicks zoom curveness exclude colorScale filters kpis charts updated primary layout
  after area good minLength sizeKey x2
  orderBy perPage paginate stacked totalLabel
  id name description notes meta alt $schema comment
`.trim().split(/\s+/);

let KNOWN_OPTIONS = null;
const knownOptions = () => (KNOWN_OPTIONS ??= new Set([...Object.keys(schema.properties || {}), ...EXTRA_OPTIONS]));

/** Distancia de edición (Levenshtein), con corte temprano en `max`. */
export function editDistance(a, b, max = 3) {
  a = String(a); b = String(b);
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (cur[j] < best) best = cur[j];
    }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

/** Candidato más parecido (≤ 2 ediciones, sin distinguir mayúsculas) o null. */
export function didYouMean(value, candidates, max = 2) {
  const v = String(value).toLowerCase();
  let best = null, bestD = max + 1;
  // "percentage" → "percent": un prefijo largo cuenta como parecido.
  for (const c of candidates) { const lc = String(c).toLowerCase(); if (lc.length >= 4 && v.length >= 4 && (v.startsWith(lc) || lc.startsWith(v))) return c; }
  for (const c of candidates) {
    const d = editDistance(v, String(c).toLowerCase(), max);
    if (d < bestD) { best = c; bestD = d; }
  }
  return best;
}

const FORMAT_TYPES = ['number', 'compact', 'percent', 'currency', 'integer', 'year'];
const SCALES = ['linear', 'log'];
const CURVES = ['linear', 'smooth', 'step'];
const LEGEND_POS = ['top', 'bottom', 'left', 'right', 'arriba', 'abajo', 'izquierda', 'derecha'];
const NETWORK_LAYOUTS = ['force', 'circular', 'circle', 'radial', 'concentric', 'clusters', 'tree', 'grid', 'ring', 'cluster', 'groups', 'hierarchy', 'concentrico', 'arbol', 'árbol', 'grilla', 'fuerzas', 'preset', 'fixed', 'fija', 'posiciones'];
const TILES = ['osm', 'esri-gray', 'esri-dark', 'carto-light', 'carto-dark', 'mapbox-light', 'mapbox-dark', 'esri', 'carto', 'mapbox', 'none', 'openstreetmap', 'esri-light', 'esri-grey', 'positron', 'dark-matter', 'darkmatter'];
const THEME_KEYS = 'extends mode name surface background ink text lede muted grid axis tint tint2 dim other link accent categorical sequential diverging status font type marks axes layout tooltip radius barRadius'.split(' ');
const PALETTE_NAMES = () => [...Object.keys(palettes), ...Object.values(colorScaleNames()).flat()];
const MAPS = new Set(['choropleth', 'symbolmap', 'pointmap']);

function checkOptions(spec, { type, data, fields, err, warn, L }) {
  const q = (v) => (typeof v === 'string' ? `"${v}"` : JSON.stringify(v));
  const enumCheck = (key, value, allowed, example) => {
    if (typeof value !== 'string' || allowed.includes(value)) return;
    const near = didYouMean(value, allowed);
    err('enum-' + key, L(`\`${key}: ${q(value)}\` no es un valor válido.`, `\`${key}: ${q(value)}\` is not a valid value.`),
      (near ? L(`¿Quisiste decir \`${key}: "${near}"\`? `, `Did you mean \`${key}: "${near}"\`? `) : '') + L(`Valores: ${example ?? allowed.map((a) => `"${a}"`).join(', ')}.`, `Values: ${example ?? allowed.map((a) => `"${a}"`).join(', ')}.`));
  };

  // 1. Nombres de opciones desconocidos (probablemente un error de tipeo).
  const known = knownOptions();
  for (const k of Object.keys(spec)) {
    if (known.has(k) || k.startsWith('_')) continue;
    const near = didYouMean(k, known);
    warn('unknown-option', L(`Opción desconocida \`${k}\`: se ignora.`, `Unknown option \`${k}\`: it is ignored.`),
      near ? L(`¿Quisiste decir \`${near}\`?`, `Did you mean \`${near}\`?`) : L('Revisa el nombre en el schema (`plotagents --schema`).', 'Check the name in the schema (`plotagents --schema`).'));
  }

  // 2. Valores fuera de catálogo.
  // Escala por clases: cortes en orden y un color más que cortes.
  try { binnedScale(spec); } catch (e) {
    err('colorscale-breaks', e.message.split('\n')[0], e.hint || 'colorScale: { colors: [a, b, c], breaks: [0, 10] }');
  }
  const f = spec.format;
  if (typeof f === 'string') enumCheck('format', f, FORMAT_TYPES, '"number", "compact", "percent", "currency", "integer" o { prefix, suffix, decimals }');
  else if (f && typeof f === 'object') {
    if (f.type !== undefined) enumCheck('format', f.type, FORMAT_TYPES);
    if (f.decimals !== undefined && !(Number.isInteger(f.decimals) && f.decimals >= 0 && f.decimals <= 20)) {
      err('format-decimals', L(`\`format.decimals: ${q(f.decimals)}\` debe ser un entero entre 0 y 20.`, `\`format.decimals: ${q(f.decimals)}\` must be an integer between 0 and 20.`), L('Usa entre 0 y 3 decimales: `format: { decimals: 1 }`.', 'Use 0 to 3 decimals: `format: { decimals: 1 }`.'));
    }
  } else if (f !== undefined && f !== null && typeof f !== 'function') err('enum-format', L('`format` debe ser un texto o un objeto.', '`format` must be a string or an object.'), 'format: "percent" | { prefix: "$", decimals: 0 }');
  if (spec.stack !== undefined && typeof spec.stack !== 'boolean') {
    if (spec.stack !== 'percent') {
      const near = typeof spec.stack === 'string' ? didYouMean(spec.stack, ['percent']) : null;
      err('enum-stack', L(`\`stack: ${q(spec.stack)}\` no es válido.`, `\`stack: ${q(spec.stack)}\` is not valid.`), (near ? L('¿Quisiste decir `stack: "percent"`? ', 'Did you mean `stack: "percent"`? ') : '') + L('Usa `stack: true` (apilar) o `stack: "percent"` (100%).', 'Use `stack: true` (stacked) or `stack: "percent"` (100%).'));
    }
  }
  for (const k of ['xScale', 'yScale']) if (spec[k] !== undefined) enumCheck(k, spec[k], SCALES, '"linear", "log"');
  if (spec.curve !== undefined) enumCheck('curve', spec.curve, CURVES);
  if (spec.legend !== undefined && typeof spec.legend !== 'boolean') {
    const pos = typeof spec.legend === 'string' ? spec.legend : spec.legend && typeof spec.legend === 'object' ? spec.legend.position : undefined;
    if (pos !== undefined) enumCheck('legend', String(pos).toLowerCase(), LEGEND_POS, 'true, false, "top", "bottom", "left", "right" o { position }');
  }
  if (type === 'sankey' && spec.relax !== undefined && spec.relax !== null && typeof spec.relax !== 'boolean' && !(typeof spec.relax === 'number' && spec.relax > 0)) err('enum-relax', L('`relax` es true o la distancia en px entre rótulos.', '`relax` is true or the distance in px between labels.'), 'relax: true | 31');
  if (type === 'network' && spec.layout !== undefined) enumCheck('layout', String(spec.layout).toLowerCase(), NETWORK_LAYOUTS, '"force", "circular", "radial", "concentric", "clusters", "tree", "grid", "preset"');
  if (type === 'corr' && spec.method !== undefined) enumCheck('method', String(spec.method).toLowerCase(), ['pearson', 'spearman']);
  if (type === 'corr' && typeof spec.triangle === 'string') enumCheck('triangle', spec.triangle, ['lower', 'full']);
  if (type === 'corr' && spec.alpha !== undefined && !(+spec.alpha > 0 && +spec.alpha < 1)) err('corr-alpha', L('`alpha` es un nivel de significancia entre 0 y 1.', '`alpha` is a significance level between 0 and 1.'), 'alpha: 0.05');
  if (type === 'pairplot' && spec.diag !== undefined) enumCheck('diag', spec.diag, ['hist', 'kde']);
  if (type === 'pairplot' && typeof spec.upper === 'string') enumCheck('upper', spec.upper, ['corr', 'scatter']);
  if (type === 'pointmap') {
    if (typeof spec.tiles === 'string') enumCheck('tiles', spec.tiles.toLowerCase(), TILES, '"osm", "esri-gray", "esri-dark", "carto-light", "carto-dark", "mapbox-light", "mapbox-dark", { url, attribution } o false');
    if (spec.tileStyle !== undefined) enumCheck('tileStyle', spec.tileStyle, ['muted', 'original']);
  }
  // Un token secreto de Mapbox quedaría a la vista en el SVG.
  const token = spec.tilesKey ?? (spec.tiles && typeof spec.tiles === 'object' ? spec.tiles.key ?? (/[?&]access_token=([^&]+)/.exec(String(spec.tiles.url || '')) || [])[1] : undefined);
  if (token !== undefined && token !== null && String(token).trim().startsWith('sk.')) err('tiles-secret', L('El token de Mapbox es secreto (empieza con "sk."): quedaría a la vista de cualquiera en el SVG.', 'The Mapbox token is secret (it starts with "sk."): anyone could read it in the SVG.'), L('Usa un token público ("pk.…") restringido a tu dominio, de account.mapbox.com.', 'Use a public token ("pk.…") restricted to your domain, from account.mapbox.com.'));

  // 3. Escalas de color (matplotlib).
  for (const key of ['colorScale', 'cmap', 'colormap']) {
    const v = spec[key];
    if (v === undefined || v === null || v === false) continue;
    const nameOf = typeof v === 'string' ? v : v && typeof v === 'object' && !Array.isArray(v) && typeof (v.name ?? v.colors) === 'string' ? v.name ?? v.colors : null;
    const cs = resolveColorScale(v);
    if (!cs) {
      if (nameOf !== null) {
        const all = Object.values(colorScaleNames()).flat();
        const base = String(nameOf).replace(/_r$/i, '');
        const near = didYouMean(base, all);
        err('colorscale-unknown', L(`La escala de color "${nameOf}" no existe.`, `The color scale "${nameOf}" does not exist.`), (near ? L(`¿Quisiste decir "${near}"? `, `Did you mean "${near}"? `) : '') + L('Usa un nombre de matplotlib ("viridis", "Blues", "RdBu", "coolwarm"…; `_r` invierte) o una lista de colores hex.', 'Use a matplotlib name ("viridis", "Blues", "RdBu", "coolwarm"…; `_r` reverses) or a list of hex colors.'));
      } else err('colorscale-unknown', L(`\`${key}\` no se entiende.`, `\`${key}\` is not understood.`), L('Usa un nombre ("viridis"), al menos dos colores (["#FFF", "steelblue"]) o { name, reverse, mid }.', 'Use a name ("viridis"), at least two colors (["#FFF", "steelblue"]) or { name, reverse, mid }.'));
    } else if (cs.kind === 'qualitative') {
      err('colorscale-qualitative', L(`"${cs.name}" es una paleta cualitativa: no sirve para una escala continua.`, `"${cs.name}" is a qualitative palette: it cannot be a continuous scale.`), L(`Usa \`palette: "${cs.name}"\` para categorías, o una escala como "viridis" o "Blues".`, `Use \`palette: "${cs.name}"\` for categories, or a scale such as "viridis" or "Blues".`));
    } else if (RAINBOW.has(cs.name.replace(/_r$/, ''))) {
      warn('colorscale-rainbow', L(`"${cs.name}" es un arcoíris: inventa bordes, no se lee en escala de grises ni con daltonismo.`, `"${cs.name}" is a rainbow map: it invents edges and fails in grayscale and for color-blind readers.`), L('Usa "viridis" (o "turbo" si necesitas muchos tonos).', 'Use "viridis" (or "turbo" if you need many hues).'));
    }
  }
  if (typeof spec.palette === 'string' && !palettes[spec.palette] && !resolveColorScale(spec.palette)) {
    const near = didYouMean(spec.palette, PALETTE_NAMES());
    warn('palette-unknown', L(`La paleta "${spec.palette}" no existe: se usa la de fábrica.`, `The palette "${spec.palette}" does not exist: the default is used.`), (near ? L(`¿Quisiste decir "${near}"? `, `Did you mean "${near}"? `) : '') + L('Nombres: "okabe-ito", "tab10", "Set2", "Dark2"… o una lista de colores.', 'Names: "okabe-ito", "tab10", "Set2", "Dark2"… or a list of colors.'));
  }
  if (typeof spec.ramp === 'string' && !ramps[spec.ramp] && !resolveColorScale(spec.ramp)) {
    const near = didYouMean(spec.ramp, [...Object.keys(ramps), ...Object.values(colorScaleNames()).flat()]);
    warn('ramp-unknown', L(`La rampa "${spec.ramp}" no existe: se usa la de fábrica.`, `The ramp "${spec.ramp}" does not exist: the default is used.`), near ? L(`¿Quisiste decir "${near}"?`, `Did you mean "${near}"?`) : L('Usa "indigo", "teal", "viridis", "Blues"…', 'Use "indigo", "teal", "viridis", "Blues"…'));
  }
  if (typeof spec.theme === 'string' && !themes[spec.theme]) {
    const near = didYouMean(spec.theme, Object.keys(themes));
    warn('theme-unknown', L(`El tema "${spec.theme}" no existe: se usa "papel".`, `The theme "${spec.theme}" does not exist: "papel" is used.`), (near ? L(`¿Quisiste decir "${near}"? `, `Did you mean "${near}"? `) : '') + L('Usa "papel", "noche", un tema de registerTheme() o un objeto.', 'Use "papel", "noche", a theme from registerTheme() or an object.'));
  } else if (spec.theme && typeof spec.theme === 'object') {
    for (const k of Object.keys(spec.theme)) {
      if (THEME_KEYS.includes(k)) continue;
      const near = didYouMean(k, THEME_KEYS);
      warn('theme-key', L(`\`theme.${k}\` no es un token del tema: se ignora.`, `\`theme.${k}\` is not a theme token: it is ignored.`), near ? L(`¿Quisiste decir \`theme.${near}\`?`, `Did you mean \`theme.${near}\`?`) : L(`Tokens: ${THEME_KEYS.join(', ')}.`, `Tokens: ${THEME_KEYS.join(', ')}.`));
    }
  }

  // 4. Formas: refLines y annotations van como lista.
  for (const k of ['refLines', 'annotations']) {
    const v = spec[k];
    if (v !== undefined && v !== null && !Array.isArray(v)) warn('not-a-list', L(`\`${k}\` debe ser una lista.`, `\`${k}\` must be a list.`), `${k}: [${typeof v === 'object' ? JSON.stringify(v) : '{ y: 600, label: "Meta" }'}]`);
  }

  // 5. highlight / dashed / exclude que no nombran nada de los datos.
  if (!data.length || MAPS.has(type)) return;
  let names = null;
  const has = (v) => {
    if (!names) {
      names = new Set(fields.map((x) => x.toLowerCase()));
      for (const r of data) for (const x of fields) { const c = r[x]; if (c !== null && c !== undefined && typeof c !== 'object') names.add(String(c).toLowerCase()); }
      for (const n of [].concat(spec.nodes || [])) if (n && typeof n === 'object') for (const c of [n.id, n.label, n.name]) if (c !== undefined) names.add(String(c).toLowerCase());
      for (const y of [].concat(spec.y || [])) names.add(String(y).toLowerCase());
    }
    return names.has(String(v).toLowerCase());
  };
  for (const key of ['highlight', 'exclude', 'dashed']) {
    const v = spec[key];
    if (v === undefined || v === null || typeof v === 'boolean' || (typeof v === 'object' && !Array.isArray(v))) continue;
    // Fechas y "Otros" pueden no estar escritas igual en los datos: no se marcan.
    const bad = [].concat(v).filter((x) => x !== null && x !== undefined && typeof x !== 'object' && !has(x) && !/^\d{4}(-\d{1,2}){0,2}$/.test(String(x)) && !/^(otros|other|others)$/i.test(String(x))).map(String);
    if (!bad.length) continue;
    warn(key + '-unknown', L(`\`${key}\` nombra valores que no están en los datos: ${bad.slice(0, 4).map((b) => `"${b}"`).join(', ')}.`, `\`${key}\` names values that are not in the data: ${bad.slice(0, 4).map((b) => `"${b}"`).join(', ')}.`),
      L('Usa el texto exacto de una categoría o serie (se distinguen tildes y espacios).', 'Use the exact text of a category or series (accents and spaces count).'));
  }
}
