// Lista ordenada de ejemplos de la galería, compartida por examples/build.js
// (galería del repo) y scripts/build-site.js (sitio de GitHub Pages).
import { gallery as base } from './specs.js';
import { statsGallery } from './specs-stats.js';
import { catGallery } from './specs-cat.js';
import { partsGallery } from './specs-parts.js';
import { moreGallery } from './specs-more.js';
import { NOTES_EN, SECTIONS_EN } from './notes-en.js';
import { geoGallery } from './specs-geo.js';
import { networkGallery } from './specs-network.js';
import { flowGallery } from './specs-flow.js';
import { dashedGallery } from './specs-dashed.js';
import { ganttGallery } from './specs-gantt.js';
import { customGeoGallery } from './specs-geo-custom.js';

export { NOTES_EN, SECTIONS_EN };

// Galería por secciones. Orden pensado para leer de lo simple a lo avanzado.
const SECTION = {
  barras: 'Comparar', 'barras-horizontales': 'Comparar', 'barras-agrupadas': 'Comparar', 'barras-100': 'Comparar',
  lineas: 'Tiempo', indice: 'Tiempo', 'area-meta': 'Tiempo', 'area-apilada': 'Tiempo', noche: 'Configuración',
  burbujas: 'Relaciones', calor: 'Flujos y números', sankey: 'Redes y flujos', kpi: 'Flujos y números',
};
export const ORDER = ['Comparar', 'Tiempo', 'Proyectos', 'Partes de un todo', 'Mapas', 'Distribuciones', 'Relaciones', 'Redes y flujos', 'Flujos y números', 'Configuración'];
const drop = new Set(['treemap', 'dona', 'slider-rango']); // reemplazados por versiones nuevas
const tag = (list, sec) => list.map((e) => ({ ...e, section: e.section || sec }));
const all = [
  ...base.filter((e) => !drop.has(e.id)).map((e) => ({ ...e, section: SECTION[e.id] || 'Comparar' })),
  ...tag(moreGallery, 'Tiempo'),
  ...tag(partsGallery, 'Partes de un todo'),
  ...statsGallery.map((e) => ({ ...e, section: ['regplot', 'residplot', 'jointplot'].includes(e.spec.type) ? 'Relaciones' : 'Distribuciones' })),
  ...catGallery.map((e) => ({ ...e, section: e.spec.type === 'radar' ? 'Relaciones' : 'Distribuciones' })),
  ...tag(geoGallery, 'Mapas'),
  ...tag(customGeoGallery, 'Mapas'),
  ...tag(ganttGallery, 'Proyectos'),
  ...tag(networkGallery, 'Redes y flujos'),
  ...flowGallery.map((e) => ({ ...e, section: e.spec.type === 'pyramid' ? 'Distribuciones' : 'Redes y flujos' })),
  ...dashedGallery,
];

export const gallery = ORDER.flatMap((sec) => all.filter((e) => e.section === sec && !drop.has(e.id)));
gallery.push(...all.filter((e) => !ORDER.includes(e.section)));

/** English name and note of an example. */
export const nameOf = (ex) => (NOTES_EN[ex.id] || [ex.nameEn || ex.name])[0];
export const noteOf = (ex) => (NOTES_EN[ex.id] || [, ex.noteEn || ex.note])[1];
export const sectionName = (sec) => SECTIONS_EN[sec] || sec;

export const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** Código de ejemplo legible: los datos se abrevian a 2 filas. */
export function snippet(spec, { more = 'filas más' } = {}) {
  const short = { ...spec };
  let rows = '';
  if (Array.isArray(spec.data)) {
    rows = spec.data.slice(0, 2).map((r) => '    ' + JSON.stringify(r).replace(/"(\w+)":/g, '$1: ').replace(/,(?=\w+:)/g, ', ')).join(',\n');
    short.data = '__DATA__';
  }
  if (Array.isArray(spec.items)) {
    short.items = '__ITEMS__';
  }
  let s = JSON.stringify(short, null, 2).replace(/"(\w+)":/g, '$1:');
  if (Array.isArray(spec.data)) s = s.replace('"__DATA__"', `[\n${rows},\n    // … ${spec.data.length - 2} ${more}\n  ]`);
  if (spec.items) s = s.replace('"__ITEMS__"', '[\n' + spec.items.map((it) => '    ' + JSON.stringify(it).replace(/"(\w+)":/g, '$1: ').replace(/,(?=\w+:)/g, ', ')).join(',\n') + '\n  ]');
  return `plot(${s})`;
}
