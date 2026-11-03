// Mapas: coroplético y de símbolos. Datos ILUSTRATIVOS (no oficiales).
const SRC = 'datos ilustrativos';

export const desempleoRegional = [
  ['Arica y Parinacota', 8.9], ['Tarapacá', 7.8], ['Antofagasta', 7.4], ['Atacama', 8.6], ['Coquimbo', 8.8], ['Valparaíso', 9.3],
  ['Región Metropolitana', 8.7], ["O'Higgins", 7.6], ['Maule', 7.9], ['Ñuble', 8.3], ['Biobío', 9.0], ['La Araucanía', 7.7],
  ['Los Ríos', 5.9], ['Los Lagos', 4.6], ['Aysén', 4.1], ['Magallanes', 3.8],
].map(([region, tasa]) => ({ region, tasa }));

export const empleoVariacion = [
  ['Arica y Parinacota', -1.8], ['Tarapacá', 0.6], ['Antofagasta', 2.9], ['Atacama', 1.4], ['Coquimbo', -0.7], ['Valparaíso', 0.9],
  ['RM', 1.6], ["Libertador General Bernardo O'Higgins", 2.2], ['Maule', -2.4], ['Ñuble', -1.1], ['Bío-Bío', 0.3], ['Araucanía', -0.4],
  ['Los Ríos', 1.1], ['Los Lagos', 3.1], ['Aisén', -3.0], ['Magallanes y de la Antártica Chilena', 0.8],
].map(([region, variacion]) => ({ region, variacion }));

export const poblacionRegional = [
  ['Arica y Parinacota', 253], ['Tarapacá', 391], ['Antofagasta', 703], ['Atacama', 316], ['Coquimbo', 869], ['Valparaíso', 2010],
  ['Metropolitana', 8420], ["O'Higgins", 1020], ['Maule', 1150], ['Ñuble', 515], ['Biobío', 1660], ['Araucanía', 1020],
  ['Los Ríos', 410], ['Los Lagos', 900], ['Aysén', 108], ['Magallanes', 178],
].map(([region, miles]) => ({ region, habitantes: miles * 1000 }));

// Destinos de las exportaciones de cobre (miles de millones de US$, ilustrativo).
export const destinosCobre = [
  ['CHN', 26.1], ['JPN', 4.6], ['KOR', 3.9], ['USA', 3.1], ['IND', 2.2], ['BRA', 1.6], ['DEU', 1.1], ['ITA', 0.9], ['ESP', 0.8], ['TWN', 1.4],
  ['MEX', 0.7], ['NLD', 0.6], ['FRA', 0.5], ['THA', 0.6], ['VNM', 0.9], ['CAN', 0.3], ['GBR', 0.3], ['TUR', 0.4], ['MYS', 0.5], ['PER', 0.2], ['ARG', 0.2],
].map(([iso3, valor]) => ({ iso3, valor }));

const tot = (rows, f) => rows.reduce((a, r) => a + r[f], 0);
const pct = (a, b) => Math.round((a / b) * 100);
const sorted = [...desempleoRegional].sort((a, b) => b.tasa - a.tasa);
const fmt1 = (v) => v.toFixed(1).replace('.', ',');
const sur = desempleoRegional.filter((r) => ['Los Lagos', 'Aysén', 'Magallanes'].includes(r.region));
const pos = empleoVariacion.filter((r) => r.variacion > 0).length;
const rmShare = pct(poblacionRegional.find((r) => r.region === 'Metropolitana').habitantes, tot(poblacionRegional, 'habitantes'));
const chinaShare = pct(destinosCobre.find((r) => r.iso3 === 'CHN').valor, tot(destinosCobre, 'valor'));

export const geoGallery = [
  {
    id: 'mapa-chile',
    name: 'Mapa coroplético de Chile',
    nameEn: 'Chile choropleth',
    note: 'Regiones por nombre, código o alias ("RM", "Biobio", "Aisén"). El mapa va a la izquierda y una columna ordenada de norte a sur muestra nombre, barra y valor.',
    noteEn: 'Regions matched by name, code or alias ("RM", "Biobio", "Aisén"). The map sits on the left and a north-to-south column shows name, bar and value.',
    spec: { type: 'choropleth', geo: 'chile', title: `El sur austral tiene el menor desempleo: ${fmt1(Math.min(...sur.map((r) => r.tasa)))}% en ${sorted.at(-1).region}`, subtitle: 'Tasa de desocupación por región, %', source: SRC, data: desempleoRegional, key: 'region', value: 'tasa', format: { suffix: '%', decimals: 1 }, legendTitle: 'Desocupación' },
  },
  {
    id: 'mapa-divergente',
    name: 'Mapa divergente',
    nameEn: 'Diverging map',
    note: 'Con `midpoint: 0` la escala es divergente: un color para las alzas, otro para las caídas y gris neutro cerca de cero.',
    noteEn: 'With `midpoint: 0` the scale diverges: one color for gains, another for losses and a neutral gray near zero.',
    spec: { type: 'choropleth', geo: 'chile', title: `${pos} de 16 regiones aumentaron su empleo en el año`, subtitle: 'Variación anual de ocupados, %', source: SRC, data: empleoVariacion, key: 'region', value: 'variacion', midpoint: 0, format: { suffix: '%', decimals: 1 }, legendTitle: 'Variación' },
  },
  {
    id: 'mapa-simbolos',
    name: 'Mapa de símbolos',
    nameEn: 'Proportional symbol map',
    note: 'Para cantidades absolutas (personas, montos) el área del círculo es proporcional al valor; el color por región engaña cuando las regiones tienen tamaños distintos.',
    noteEn: 'For absolute amounts (people, money) the circle area is proportional to the value; coloring regions misleads when their sizes differ.',
    spec: { type: 'symbolmap', geo: 'chile', title: `La Región Metropolitana concentra el ${rmShare}% de los habitantes`, subtitle: 'Población por región', source: SRC, data: poblacionRegional, key: 'region', value: 'habitantes', format: 'compact' },
  },
  {
    id: 'mapa-mundo',
    name: 'Mapamundi',
    nameEn: 'World map',
    note: 'Proyección Equal Earth (áreas reales). Países por código ISO-3, nombre en español o en inglés. `missing: "plain"` deja sin rayado a los países sin dato.',
    noteEn: 'Equal Earth projection (true areas). Countries by ISO-3 code, Spanish or English name. `missing: "plain"` leaves countries without data unhatched.',
    spec: { type: 'choropleth', geo: 'world', title: `China compra el ${chinaShare}% del cobre exportado`, subtitle: 'Exportaciones de cobre por destino, miles de millones de US$', source: SRC, data: destinosCobre, key: 'iso3', value: 'valor', missing: 'plain', labels: 4, format: { prefix: 'US$', decimals: 1 }, legendTitle: 'Miles de millones' },
  },
];
