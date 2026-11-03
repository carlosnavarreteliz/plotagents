// Revisión de un spec ANTES de dibujar: errores que impiden el gráfico y
// sugerencias de diseño (de los cursos de visualización para la gestión).
// Pensado para que un agente corrija su propio spec en un segundo intento.
import { ensureData, fieldsOf, fieldKind, uniq, num, PlotError } from './data.js';
import { inferType, TYPES } from './infer.js';

export function lint(spec = {}) {
  const errors = [];
  const warnings = [];
  const tips = [];
  const err = (code, message, fix) => errors.push({ code, message, fix });
  const warn = (code, message, fix) => warnings.push({ code, message, fix });
  const sug = (code, message, fix) => tips.push({ code, message, fix });

  let data = [];
  try { data = spec.type === 'kpi' || spec.items ? [] : ensureData(spec); } catch (e) { err('data', e.message.split('\n')[0], 'Pasa `data` como arreglo de filas: [{ categoria: "A", valor: 10 }]'); }
  const type = spec.type && spec.type !== 'auto' ? spec.type : inferType(spec, data);
  if (!TYPES.includes(type)) err('type', `Tipo "${spec.type}" no soportado.`, `Usa uno de: ${TYPES.join(', ')}`);
  const fields = fieldsOf(data);
  const check = (f, role) => {
    for (const ff of [].concat(f ?? [])) if (ff && !fields.includes(ff)) err('field', `El campo "${ff}" (${role}) no existe.`, `Campos disponibles: ${fields.join(', ')}`);
  };
  if (data.length) {
    check(spec.x, 'x'); check(spec.y, 'y'); check(spec.series ?? spec.color, 'series'); check(spec.size, 'size');
    check(spec.value, 'value'); check(spec.label, 'label'); check(spec.group, 'group'); check(spec.path, 'path');
    check(spec.from, 'from'); check(spec.to, 'to');
  } else if (type !== 'kpi' && !errors.length) err('empty', 'No hay filas en `data`.', 'Entrega al menos una fila.');

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
  if (type === 'kpi' && !(spec.items || spec.data || []).length) err('items', 'El KPI necesita `items`.', 'items: [{ label: "Ventas", value: 1250, delta: 0.12, period: "vs 2025" }]');

  return { ok: errors.length === 0, type, errors, warnings, suggestions: tips };
}

export { PlotError };
