// Specs en inglés para la portada del sitio. Datos ilustrativos.
const years = [2021, 2022, 2023, 2024, 2025];
const base = {
  Mining: { Copper: [380, 410, 395, 430, 470], Lithium: [20, 60, 85, 70, 95], Molybdenum: [22, 25, 24, 26, 27] },
  Agriculture: { Fruit: [62, 66, 70, 74, 80], Wine: [21, 22, 20, 19, 19], Seeds: [7, 8, 8, 9, 9] },
  Forestry: { Pulp: [32, 40, 34, 33, 36], Timber: [15, 17, 14, 14, 15] },
  Fishing: { Salmon: [52, 60, 63, 66, 70], 'Other seafood': [14, 15, 15, 16, 16] },
  Manufacturing: { Chemicals: [18, 19, 20, 21, 22], Machinery: [9, 10, 10, 11, 12] },
};
export const exportsRows = [];
for (const [sector, products] of Object.entries(base))
  for (const [product, vals] of Object.entries(products))
    years.forEach((year, i) => exportsRows.push({ year, sector, product, value: vals[i] }));

export const heroSpec = {
  type: 'treemap',
  title: 'Mining makes up two thirds of exports',
  subtitle: 'Exports by sector and product, USD billions',
  source: 'illustrative data',
  data: exportsRows,
  path: ['sector', 'product'],
  value: 'value',
  time: 'year',
  locale: 'en',
};

export const quickSpec = {
  type: 'bar',
  title: 'Biobío accounts for 30% of southern sales',
  subtitle: 'Sales by region, CLP millions, 2025',
  source: 'illustrative data',
  data: [
    { region: 'Biobío', sales: 1240 },
    { region: 'Araucanía', sales: 880 },
    { region: 'Ñuble', sales: 610 },
    { region: 'Maule', sales: 530 },
    { region: 'Los Ríos', sales: 420 },
    { region: 'Los Lagos', sales: 390 },
  ],
  x: 'region',
  y: 'sales',
  highlight: 'Biobío',
  locale: 'en',
};

export const quickCode = `import { plot } from 'plotagents';

const svg = plot({
  type: 'bar',
  title: 'Biobío accounts for 30% of southern sales',
  subtitle: 'Sales by region, CLP millions, 2025',
  source: 'illustrative data',
  data: [
    { region: 'Biobío', sales: 1240 },
    { region: 'Araucanía', sales: 880 },
    { region: 'Ñuble', sales: 610 },
    { region: 'Maule', sales: 530 },
    { region: 'Los Ríos', sales: 420 },
    { region: 'Los Lagos', sales: 390 },
  ],
  x: 'region',
  y: 'sales',
  highlight: 'Biobío',
  locale: 'en',
});`;

// ── Portada: conversaciones de ejemplo (persona → agente → plotagents) ──────
import { southAmerica, capitales, tropico } from '../examples/specs-geo-custom.js';

const plan = [
  ['Discovery', 'User interviews', '2026-01-05', '2026-01-23', 100],
  ['Discovery', 'Process map', '2026-01-19', '2026-02-06', 100, 'User interviews'],
  ['Discovery', 'Findings report', '2026-02-09', null, null, 'Process map'],
  ['Design', 'Data model', '2026-02-09', '2026-03-06', 80, 'Findings report'],
  ['Design', 'Agent prototype', '2026-02-23', '2026-03-27', 45],
  ['Build', 'ERP integration', '2026-03-16', '2026-04-30', 10, 'Data model'],
  ['Build', 'KPI dashboard', '2026-04-06', '2026-05-15', 0, 'Agent prototype'],
  ['Build', 'User testing', '2026-05-04', '2026-05-29', 0, null, true],
  ['Launch', 'Training', '2026-06-01', '2026-06-12', 0, 'User testing', true],
  ['Launch', 'Go-live', '2026-06-15', null, null, 'Training'],
].map(([phase, task, start, end, progress, after, tentative]) => ({ phase, task, start, ...(end ? { end } : {}), ...(progress !== null && progress !== undefined ? { progress } : {}), ...(after ? { after } : {}), ...(tentative ? { tentative: true } : {}) }));

export const ganttSpec = {
  type: 'gantt',
  title: 'Go-live is June 15, and the ERP integration is the critical path',
  subtitle: 'Rollout plan by phase, 2026. The filled part of each bar is progress',
  source: 'illustrative data',
  data: plan,
  task: 'task', start: 'start', end: 'end', group: 'phase', progress: 'progress', dependsOn: 'after',
  today: '2026-03-12', dashed: 'tentative', dashedLabel: 'To be confirmed',
  locale: 'en',
};

const LANG = { Brazil: 'Portuguese', Guyana: 'English', Suriname: 'Dutch' };
const saGeo = southAmerica('en');
export const languageSpec = {
  type: 'choropleth',
  geo: saGeo,
  title: 'Spanish is an official language in 9 of the 12 South American countries',
  subtitle: 'Main official language by country, with capitals',
  source: 'Natural Earth (public domain)',
  data: saGeo.features.map((f) => ({ country: f.properties.ADMIN, language: LANG[f.properties.ADMIN] || 'Spanish' })),
  key: 'country', value: 'language',
  markers: { data: capitales.map((c) => ({ city: c.ciudad, lon: c.lon, lat: c.lat })), label: 'city', legend: 'Capital' },
  layers: [{ geo: tropico('Tropic of Capricorn'), label: 'Tropic of Capricorn', dash: true, width: 1 }],
  locale: 'en',
};

// Usuarios activos mensuales de tres productos (ilustrativo, determinista).
const months = Array.from({ length: 24 }, (_, i) => `${2024 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`);
const growth = { Atlas: [12, 0.105], Beacon: [30, 0.025], Compass: [18, 0.045] };
const wave = (i, k) => 1 + 0.035 * Math.sin(i * 0.9 + k);
export const usersRows = [];
Object.entries(growth).forEach(([product, [base, g]], k) => months.forEach((month, i) => usersRows.push({ month, product, users: Math.round(base * (1 + g) ** i * wave(i, k) * 10) / 10 })));
const last = (p) => usersRows.filter((r) => r.product === p).at(-1).users;
const val = (p, m) => usersRows.find((r) => r.product === p && r.month === m).users;
const cross = months.find((m) => val('Atlas', m) > val('Beacon', m));
const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const trendSpec = {
  type: 'line',
  title: `Atlas passed Beacon in ${MONTH[+cross.slice(5) - 1]} ${cross.slice(0, 4)} and now has ${Math.round(last('Atlas') / last('Beacon'))}× its users`,
  subtitle: 'Monthly active users by product, thousands',
  source: 'illustrative data',
  data: usersRows, x: 'month', y: 'users', series: 'product', highlight: 'Atlas',
  annotations: [{ x: '2024-09', label: 'Atlas goes free' }],
  locale: 'en',
};

// El ciclo de reparación: primera llamada con errores reales, y la corregida.
export const storesRows = [['Santiago', 430], ['Valparaíso', 96], ['Concepción', 88], ['La Serena', 41], ['Antofagasta', 39], ['Temuco', 35], ['Rancagua', 30], ['Talca', 26], ['Arica', 21], ['Iquique', 19], ['Puerto Montt', 18]].map(([city, stores]) => ({ city, stores }));
export const badSpec = { type: 'donut', data: storesRows, label: 'city', value: 'store_count', locale: 'en' };
const rest = storesRows.slice(1).reduce((a, r) => a + r.stores, 0);
export const fixedSpec = {
  type: 'bar',
  title: `Santiago has more stores than the next ten cities combined: ${storesRows[0].stores} vs ${rest}`,
  subtitle: 'Stores by city, 2025',
  source: 'illustrative data',
  data: storesRows, x: 'city', y: 'stores', highlight: 'Santiago',
  locale: 'en',
};

/** Escenarios de la conversación en vivo de la portada. */
export const exchanges = [
  { id: 'plan', label: 'A plan', ask: 'Here’s our rollout plan. Where are we, and what could slip?', spec: ganttSpec, data: '/* 10 tasks: phase, task, start, end, progress, after */' },
  { id: 'map', label: 'A map', ask: 'Which South American countries don’t speak Spanish? Use this GeoJSON.', spec: languageSpec, data: '/* 12 rows: country, language */', geo: 'southAmerica, // any GeoJSON or TopoJSON', omit: ['markers', 'layers'], extra: { markers: '{ data: capitals, label: "city" }' } },
  { id: 'trend', label: 'A trend', ask: 'How did our three products grow since launch?', spec: trendSpec, data: '/* 72 rows: month, product, users */' },
  { id: 'mix', label: 'A breakdown', ask: 'Break exports down by sector and product, year by year.', spec: heroSpec, data: '/* 65 rows: year, sector, product, value */' },
];
