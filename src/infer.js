// Elige el tipo de gráfico cuando el agente no lo indica (type: "auto").
import { fieldsOf, fieldKind } from './data.js';

export const TYPES = ['bar', 'column', 'count', 'line', 'area', 'scatter', 'bubble', 'treemap', 'sunburst', 'donut', 'pie', 'heatmap', 'sankey', 'kpi', 'hist', 'kde', 'ecdf', 'regplot', 'residplot', 'jointplot', 'box', 'violin', 'strip', 'swarm', 'point', 'radar', 'network', 'chord', 'pyramid', 'flowchart', 'gantt', 'wordcloud', 'choropleth', 'symbolmap', 'pointmap', 'table', 'corr', 'pairplot', 'spark', 'bump', 'waffle', 'dendrogram', 'dotplot', 'rail'];

// Nombres de seaborn, d3plus y otros: el agente puede usar el que conozca.
export const ALIASES = {
  barplot: ['bar', { ci: true }], countplot: 'count', columns: 'column', lineplot: 'line', areaplot: 'area',
  scatterplot: 'scatter', histplot: 'hist', histogram: 'hist', kdeplot: 'kde', density: 'kde', ecdfplot: 'ecdf',
  lmplot: 'regplot', reg: 'regplot', regression: 'regplot', joint: 'jointplot', boxplot: 'box', violinplot: 'violin',
  stripplot: 'strip', swarmplot: 'swarm', beeswarm: 'swarm', pointplot: 'point', spider: 'radar', doughnut: 'donut',
  pointmap: 'pointmap', dotmap: 'pointmap', 'dot-map': 'pointmap', tilemap: 'pointmap', basemap: 'pointmap', 'mapa-puntos': 'pointmap', 'mapa-de-puntos': 'pointmap', latlon: 'pointmap',
  graph: 'network', force: 'network', red: 'network', 'chord-diagram': 'chord', cuerdas: 'chord',
  populationpyramid: 'pyramid', population: 'pyramid', piramide: 'pyramid', 'pirámide': 'pyramid',
  diagram: 'flowchart', process: 'flowchart', diagrama: 'flowchart',
  map: 'choropleth', mapa: 'choropleth', choroplethmap: 'choropleth', symbol: 'symbolmap', bubblemap: 'symbolmap', 'mapa-simbolos': 'symbolmap',
  words: 'wordcloud', 'word-cloud': 'wordcloud', wordclouds: 'wordcloud', tagcloud: 'wordcloud', 'tag-cloud': 'wordcloud', nube: 'wordcloud', 'nube-de-palabras': 'wordcloud', cloud: 'wordcloud',
  timeline: 'gantt', roadmap: 'gantt', schedule: 'gantt', cronograma: 'gantt', 'carta-gantt': 'gantt', ganttchart: 'gantt', 'gantt-chart': 'gantt', planning: 'gantt',
  tabla: 'table', tables: 'table', datatable: 'table', 'data-table': 'table', grid: 'table', tableau: 'table', tabelle: 'table', tabela: 'table', spreadsheet: 'table', planilla: 'table',
  correlation: 'corr', correlations: 'corr', corrplot: 'corr', corrmatrix: 'corr', 'corr-matrix': 'corr', 'correlation-matrix': 'corr', correlogram: 'corr', correlograma: 'corr',
  correlacion: 'corr', 'correlación': 'corr', 'matriz-correlacion': 'corr', 'matriz-de-correlacion': 'corr', 'matriz-de-correlación': 'corr',
  clustermap: ['corr', { cluster: true }], 'cluster-map': ['corr', { cluster: true }],
  pairs: 'pairplot', pairgrid: 'pairplot', splom: 'pairplot', scattermatrix: 'pairplot', 'scatter-matrix': 'pairplot', 'scatterplot-matrix': 'pairplot', 'matriz-de-dispersion': 'pairplot', 'matriz-de-dispersión': 'pairplot',
  sparkline: 'spark', sparklines: 'spark', microchart: 'spark',
  bumpchart: 'bump', 'bump-chart': 'bump', rank: 'bump', ranking: 'bump', slope: ['bump', { ends: 'first-last' }], slopegraph: ['bump', { ends: 'first-last' }], 'slope-chart': ['bump', { ends: 'first-last' }],
  'waffle-chart': 'waffle', squares: 'waffle', unitchart: 'waffle', 'unit-chart': 'waffle', cuadros: 'waffle',
  dendrograma: 'dendrogram', linkage: 'dendrogram', hclust: 'dendrogram', 'cluster-tree': 'dendrogram',
  riel: 'rail', 'range-rail': 'rail', 'field-rail': 'rail',
  'dot-plot': 'dotplot', wilkinson: 'dotplot', 'dot-histogram': 'dotplot', 'puntos-apilados': 'dotplot',
  tree: 'treemap', stat: 'kpi', stats: 'kpi', number: 'kpi', heat: 'heatmap', flow: 'sankey',
};

/** Tipo canónico + opciones implícitas del alias (p. ej. barplot → bar con ci). */
export function normalizeType(t) {
  const k = String(t || '').toLowerCase();
  const al = ALIASES[k];
  if (!al) return [k, {}];
  return Array.isArray(al) ? [al[0], al[1]] : [al, {}];
}

export function inferType(spec, data = []) {
  if (spec.items) return 'kpi';
  if (Array.isArray(spec.linkage)) return 'dendrogram';
  if (Array.isArray(spec.columns) || spec.pageSize !== undefined) return 'table';
  if (spec.geo) return 'choropleth';
  if (spec.lat || spec.lon || spec.tiles !== undefined) return 'pointmap';
  { const f = fieldsOf(data); if (f.some((k) => /^(lat|latitude|latitud)$/i.test(k)) && f.some((k) => /^(lon|lng|long|longitude|longitud)$/i.test(k))) return 'pointmap'; }
  if ((typeof spec.text === 'string' && !(data[0] && spec.text in data[0])) || (Array.isArray(spec.text) && spec.text.length && typeof spec.text[0] === 'string') || spec.textField) return 'wordcloud';
  if (spec.start !== undefined && (spec.end !== undefined || spec.duration !== undefined) && typeof spec.start === 'string') return 'gantt';
  if (spec.nodes && spec.nodes.some?.((n) => n && n.type)) return 'flowchart';
  if (spec.nodes) return 'network';
  if (spec.matrix) return 'chord';
  if (spec.from || spec.to) return 'sankey';
  if (spec.path || spec.group) return 'treemap';
  if (spec.triangle !== undefined || spec.cluster !== undefined || spec.method !== undefined) return 'corr';
  if (spec.diag !== undefined || spec.corner !== undefined || spec.upper !== undefined) return 'pairplot';
  if (spec.size) return 'bubble';
  const fields = fieldsOf(data);
  if ((fields.includes('source') && fields.includes('target')) || (fields.includes('from') && fields.includes('to'))) return 'sankey';
  const kinds = Object.fromEntries(fields.map((f) => [f, fieldKind(data, f)]));
  // Dos fechas por fila (inicio y fin) y un nombre: un cronograma.
  if (fields.filter((f) => kinds[f] === 'date').length >= 2 && fields.some((f) => kinds[f] === 'category') && !spec.y && !spec.series) return 'gantt';
  const x = spec.x ?? fields[0];
  const xk = kinds[x];
  if (xk === 'date' || xk === 'year') return 'line';
  if (xk === 'number') {
    const y = spec.y ?? fields.find((f) => f !== x && kinds[f] === 'number');
    if (y && kinds[y] === 'number') return 'scatter';
  }
  const cats = fields.filter((f) => kinds[f] === 'category');
  if (cats.length >= 2 && !spec.series && fields.some((f) => kinds[f] === 'number') && spec.value) return 'heatmap';
  return 'bar';
}
