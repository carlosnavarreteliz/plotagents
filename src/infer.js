// Elige el tipo de gráfico cuando el agente no lo indica (type: "auto").
import { fieldsOf, fieldKind } from './data.js';

export const TYPES = ['bar', 'column', 'count', 'line', 'area', 'scatter', 'bubble', 'treemap', 'sunburst', 'donut', 'pie', 'heatmap', 'sankey', 'kpi', 'hist', 'kde', 'ecdf', 'regplot', 'residplot', 'jointplot', 'box', 'violin', 'strip', 'swarm', 'point', 'radar'];

// Nombres de seaborn, d3plus y otros: el agente puede usar el que conozca.
export const ALIASES = {
  barplot: ['bar', { ci: true }], countplot: 'count', columns: 'column', lineplot: 'line', areaplot: 'area',
  scatterplot: 'scatter', histplot: 'hist', histogram: 'hist', kdeplot: 'kde', density: 'kde', ecdfplot: 'ecdf',
  lmplot: 'regplot', reg: 'regplot', regression: 'regplot', joint: 'jointplot', boxplot: 'box', violinplot: 'violin',
  stripplot: 'strip', swarmplot: 'swarm', beeswarm: 'swarm', pointplot: 'point', spider: 'radar', doughnut: 'donut',
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
  if (spec.from || spec.to) return 'sankey';
  if (spec.path || spec.group) return 'treemap';
  if (spec.size) return 'bubble';
  const fields = fieldsOf(data);
  if ((fields.includes('source') && fields.includes('target')) || (fields.includes('from') && fields.includes('to'))) return 'sankey';
  const kinds = Object.fromEntries(fields.map((f) => [f, fieldKind(data, f)]));
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
