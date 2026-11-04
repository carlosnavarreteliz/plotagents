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

// ── Estados Unidos (datos ILUSTRATIVOS) ──────────────────────────────────
const US_CODES = ['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'];
// Crecimiento de población 2020–2024 (%, ilustrativo): el sur y el oeste interior crecen; el noreste y el medio oeste, poco.
const US_GROWTH = { AL: 2.1, AK: -0.4, AZ: 5.6, AR: 2.4, CA: -1.2, CO: 3.8, CT: 0.9, DE: 5.9, DC: -1.9, FL: 7.4, GA: 4.6, HI: -1.1, ID: 8.9, IL: -1.6, IN: 1.6, IA: 1.0, KS: 0.8, KY: 1.2, LA: -2.3, ME: 2.8, MD: 0.6, MA: 0.8, MI: -0.3, MN: 1.3, MS: -1.0, MO: 0.9, MT: 5.3, NE: 1.5, NV: 4.9, NH: 2.6, NJ: 1.2, NM: 0.5, NY: -2.6, NC: 5.7, ND: 2.7, OH: -0.2, OK: 2.9, OR: 0.4, PA: -0.1, RI: 0.7, SC: 7.6, SD: 4.5, TN: 5.0, TX: 7.2, UT: 6.6, VT: 0.9, VA: 1.9, WA: 2.4, WV: -2.0, WI: 0.6, WY: 1.7 };
export const usaCrecimiento = US_CODES.map((estado) => ({ estado, crecimiento: US_GROWTH[estado], preliminar: ['TX', 'FL', 'NC', 'SC', 'GA'].includes(estado) }));

// Desempleo por estado y año (%, ilustrativo) para el slider temporal.
const usRand = (() => { let s = 11; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
const US_SHOCK = { 2019: 0, 2020: 4.1, 2021: 1.8, 2022: 0.1, 2023: -0.1, 2024: 0.3 };
export const usaDesempleo = US_CODES.flatMap((estado) => {
  const base = 2.6 + usRand() * 2.4, sens = 0.6 + usRand() * 0.9;
  return Object.entries(US_SHOCK).map(([año, sh]) => ({ estado, año: +año, tasa: Math.round((base + sh * sens + (usRand() - 0.5) * 0.5) * 10) / 10 }));
});

// Población 2024 en millones (aprox.; ilustrativo) para el mapa de símbolos.
const US_POP = { AL: 5.1, AK: 0.7, AZ: 7.6, AR: 3.1, CA: 39.4, CO: 6.0, CT: 3.7, DE: 1.0, DC: 0.7, FL: 23.4, GA: 11.2, HI: 1.4, ID: 2.0, IL: 12.7, IN: 6.9, IA: 3.2, KS: 3.0, KY: 4.6, LA: 4.6, ME: 1.4, MD: 6.3, MA: 7.1, MI: 10.1, MN: 5.8, MS: 2.9, MO: 6.2, MT: 1.1, NE: 2.0, NV: 3.3, NH: 1.4, NJ: 9.5, NM: 2.1, NY: 19.9, NC: 11.0, ND: 0.8, OH: 11.9, OK: 4.1, OR: 4.3, PA: 13.1, RI: 1.1, SC: 5.5, SD: 0.9, TN: 7.2, TX: 31.3, UT: 3.5, VT: 0.6, VA: 8.8, WA: 8.0, WV: 1.8, WI: 6.0, WY: 0.6 };
export const usaPoblacion = US_CODES.map((estado) => ({ estado, habitantes: US_POP[estado] * 1e6 }));

const fastest = [...usaCrecimiento].sort((a, b) => b.crecimiento - a.crecimiento)[0];
const shrinking = usaCrecimiento.filter((r) => r.crecimiento < 0).length;
const top4 = Math.round(((US_POP.CA + US_POP.TX + US_POP.FL + US_POP.NY) / Object.values(US_POP).reduce((a, b) => a + b, 0)) * 100);

geoGallery.push(
  {
    id: 'mapa-eeuu',
    name: 'Mapa de Estados Unidos',
    nameEn: 'United States map',
    note: '`geo: "usa"`: 50 estados, DC y Puerto Rico en proyección Albers con Alaska y Hawái en recuadros. Estados por sigla, nombre en inglés o español o código FIPS. Los estados chicos del noreste se rotulan afuera con línea guía. `dashed` raya los que tienen cifra preliminar. En el navegador: clic en un estado para acercarse, Ctrl + rueda o pellizco para zoom, arrastre para moverse.',
    noteEn: '`geo: "usa"`: 50 states, DC and Puerto Rico in an Albers projection with Alaska and Hawaii insets. States match by postal code, English or Spanish name, or FIPS code. Small northeastern states get labels outside with leader lines. `dashed` hatches the ones with preliminary figures. In the browser: click a state to zoom in, Ctrl + scroll or pinch to zoom, drag to pan.',
    spec: { type: 'choropleth', geo: 'usa', title: `${fastest.estado === 'ID' ? 'Idaho' : fastest.estado} creció más rápido (${fmt1(fastest.crecimiento)}%) y ${shrinking} estados perdieron población`, subtitle: 'Variación de la población 2020–2024, %', source: SRC, data: usaCrecimiento, key: 'estado', value: 'crecimiento', midpoint: 0, dashed: 'preliminar', dashedLabel: 'Cifra preliminar', format: { suffix: '%', decimals: 1 }, legendTitle: 'Variación' },
  },
  {
    id: 'mapa-eeuu-tiempo',
    name: 'Mapa con slider temporal',
    nameEn: 'Map with a time slider',
    note: '`time: "año"` muestra un año a la vez; con `slider: true` aparecen los controles y, con "play", el color de cada estado transita suavemente al del año siguiente. La escala de color se mantiene fija entre años (`scale` con cortes) para que los colores sean comparables.',
    noteEn: '`time: "año"` shows one year at a time; `slider: true` adds the controls and, with play, each state\'s color glides into the next year\'s. The color scale stays fixed across years (`scale` with breaks) so colors are comparable.',
    spec: { type: 'choropleth', geo: 'usa', time: 'año', slider: true, title: 'El desempleo saltó en 2020 en todos los estados y volvió a su nivel en 2022', subtitle: 'Tasa de desempleo por estado, %', source: SRC, data: usaDesempleo, key: 'estado', value: 'tasa', scale: [3, 4, 5, 6, 8], format: { suffix: '%', decimals: 1 }, legendTitle: 'Desempleo' },
  },
  {
    id: 'mapa-eeuu-simbolos',
    name: 'Mapa de símbolos de EE. UU.',
    nameEn: 'US proportional symbol map',
    note: 'Para totales, círculos de área proporcional en cada estado. La leyenda de tamaños va arriba, en fila, para no chocar con los recuadros de Alaska y Hawái.',
    noteEn: 'For totals, area-proportional circles on each state. The size legend sits on top, in a row, so it never collides with the Alaska and Hawaii insets.',
    spec: { type: 'symbolmap', geo: 'usa', title: `Cuatro estados reúnen el ${top4}% de la población`, subtitle: 'Habitantes por estado, 2024', source: SRC, data: usaPoblacion, key: 'estado', value: 'habitantes', format: 'compact', labels: ['CA', 'TX', 'FL', 'NY'] },
  },
);
