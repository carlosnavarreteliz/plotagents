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
