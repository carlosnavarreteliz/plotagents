// Elige el tipo de gráfico cuando el agente no lo indica (type: "auto").
import { fieldsOf, fieldKind } from './data.js';

export const TYPES = ['bar', 'column', 'line', 'area', 'scatter', 'bubble', 'treemap', 'donut', 'pie', 'heatmap', 'sankey', 'kpi'];

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
