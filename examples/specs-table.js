// Tablas: el número exacto, con un indicador por columna. Datos ILUSTRATIVOS.
const SRC = 'datos ilustrativos';

const regiones = [
  ['Metropolitana', 18420, 0.041, [15.1, 15.8, 16.4, 17.2, 17.7, 18.4], 0.96, 'Completado'],
  ['Valparaíso', 4210, 0.021, [3.7, 3.8, 3.9, 4.0, 4.1, 4.2], 0.88, 'En curso'],
  ['Biobío', 3890, -0.012, [4.1, 4.0, 4.0, 3.9, 3.9, 3.9], 0.71, 'En riesgo'],
  ['Antofagasta', 3120, 0.051, [2.5, 2.6, 2.8, 2.9, 3.0, 3.1], 1.04, 'Completado'],
  ['Maule', 1530, 0.08, [1.2, 1.3, 1.3, 1.4, 1.5, 1.5], 0.79, 'En curso'],
  ['Araucanía', 1310, -0.034, [1.4, 1.4, 1.3, 1.3, 1.3, 1.3], 0.58, 'Atrasado'],
  ['Los Lagos', 1240, 0.012, [1.1, 1.2, 1.2, 1.2, 1.2, 1.2], 0.83, 'En curso'],
  ['Ñuble', 720, 0.15, [0.5, 0.55, 0.6, 0.64, 0.68, 0.72], 0.92, 'Completado'],
].map(([region, ventas, variacion, tendencia, meta, estado]) => ({ region, ventas, variacion, tendencia, meta, estado }));

const countries = [
  ['Guyana', 'Caribbean', 33.9, 2.1, 0.83],
  ['Panama', 'Central America', 7.3, 1.1, 4.4],
  ['Dominican Republic', 'Caribbean', 5.1, 3.3, 11.3],
  ['Costa Rica', 'Central America', 4.6, 0.5, 5.2],
  ['Paraguay', 'South America', 4.2, 4.3, 6.9],
  ['Mexico', 'Central America', 3.2, 4.6, 129],
  ['Colombia', 'South America', 1.8, 9.3, 52.2],
  ['Peru', 'South America', 2.7, 2.4, 34.4],
  ['Chile', 'South America', 2.3, 4.5, 19.7],
  ['Brazil', 'South America', 3.1, 4.4, 216],
  ['Uruguay', 'South America', 1.0, 5.1, 3.4],
  ['Ecuador', 'South America', 1.6, 2.2, 18.2],
  ['Bolivia', 'South America', 1.4, 2.6, 12.4],
  ['Jamaica', 'Caribbean', 2.0, 6.5, 2.8],
  ['Honduras', 'Central America', 3.6, 6.7, 10.6],
  ['Guatemala', 'Central America', 3.5, 6.2, 18.1],
  ['Argentina', 'South America', -1.6, 133.5, 46.7],
  ['Haiti', 'Caribbean', -1.9, 26.9, 11.7],
].map(([country, region, growth, inflation, population]) => ({ country, region, growth, inflation, population }));

const proyectos = [
  ['Migración ERP', 'Finanzas', '2026-03-31', 0.82, 'En curso', 410, 380, true],
  ['Portal de clientes', 'Comercial', '2026-02-15', 1, 'Completado', 220, 205, true],
  ['Agente de soporte', 'Operaciones', '2026-05-30', 0.35, 'En riesgo', 160, 190, false],
  ['Data lake', 'TI', '2026-06-30', 0.48, 'En curso', 540, 528, true],
  ['App de terreno', 'Operaciones', '2026-01-31', 0.9, 'Atrasado', 130, 175, false],
  ['Firma electrónica', 'Legal', '2026-04-15', 0.6, 'Pendiente', 60, 42, true],
].map(([proyecto, area, entrega, avance, estado, presupuesto, gasto, prioritario]) => ({ proyecto, area, entrega, avance, estado, presupuesto, gasto, prioritario }));

export const tableGallery = [
  {
    id: 'tabla',
    name: 'Tabla con indicadores',
    nameEn: 'Table with indicators',
    note: 'Sin `columns`, cada columna toma su indicador: barra en la medida principal, ▲/▼ en la variación, minigráfico en las listas de números, avance en la meta y píldora en el estado (los estados se reconocen en español, inglés, portugués, francés y alemán). Números a la derecha, con los mismos decimales. En el teléfono, cada fila es una tarjeta.',
    noteEn: 'Without `columns`, each column picks its indicator: a bar on the main measure, ▲/▼ on the change, a sparkline on lists of numbers, a meter on the target and a pill on the status (statuses are recognized in Spanish, English, Portuguese, French and German). Numbers right-aligned with matching decimals. On a phone, each row becomes a card.',
    spec: { type: 'table', title: 'La Metropolitana vende más que las siete regiones siguientes juntas', subtitle: 'Ventas 2025 en millones de pesos, variación anual, tendencia 2020–2025 y cumplimiento de la meta', source: SRC, data: regiones, highlight: 'Ñuble', total: true },
  },
  {
    id: 'tabla-paginada',
    name: 'Tabla paginada, en inglés',
    nameEn: 'Paginated table, in English',
    note: 'Más de 15 filas se paginan de a 10; el paginador usa solo cifras y flechas. Sin `locale`, el idioma se reconoce del título y los datos (aquí inglés: 1,234.5). En el navegador, clic en un encabezado ordena y hay búsqueda sobre 20 filas.',
    noteEn: 'More than 15 rows are paginated 10 at a time; the pager uses only numbers and arrows. Without `locale`, the language is recognized from the title and the data (English here: 1,234.5). In the browser a click on a header sorts, and a search box appears above 20 rows.',
    spec: {
      type: 'table', title: 'Guyana grew five times faster than any other economy in the region', subtitle: 'Real GDP growth and inflation, percent, 2024; population in millions', source: 'illustrative data', data: countries,
      columns: ['country', 'region', { field: 'growth', label: 'GDP growth', type: 'delta', format: { type: 'percent', scale: 1, decimals: 1 } }, { field: 'inflation', label: 'Inflation', type: 'heat', colorScale: 'Oranges', format: { type: 'percent', scale: 1, decimals: 1 } }, { field: 'population', label: 'Population (M)', type: 'bar', format: { decimals: 1 } }],
      sortBy: 'growth', rank: true,
    },
  },
  {
    id: 'tabla-proyectos',
    name: 'Cartera de proyectos',
    nameEn: 'Project portfolio',
    note: '`columns` fija el orden y el tipo: `progress` contra un campo `target` (con `good: "down"` pasarse es malo), `check` para booleanos y fechas legibles. `group` agrupa las filas bajo una banda.',
    noteEn: '`columns` sets order and type: `progress` against a `target` field (with `good: "down"` going over is bad), `check` for booleans and readable dates. `group` puts rows under a band.',
    spec: {
      type: 'table', title: 'Dos de seis proyectos ya gastaron más de lo presupuestado', subtitle: 'Cartera digital 2026: avance, gasto contra presupuesto (millones de pesos) y estado', source: SRC, data: proyectos,
      columns: ['proyecto', 'area', { field: 'entrega', label: 'Entrega' }, { field: 'avance', type: 'progress' }, { field: 'gasto', label: 'Gasto / presupuesto', type: 'progress', target: 'presupuesto', good: 'down' }, 'estado', { field: 'prioritario', label: 'Prioritario' }],
      sortBy: 'avance',
    },
  },
];
