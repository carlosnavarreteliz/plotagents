// Mapas de puntos sobre teselas reales. Datos ILUSTRATIVOS (no oficiales):
// coordenadas aproximadas y poblaciones redondeadas.
const SRC = 'datos ilustrativos';

// 30 ciudades de Chile: [nombre, lat, lon, habitantes, macrozona, variación 2017–2024 %]
const CIUDADES = [
  ['Santiago', -33.45, -70.66, 6310000, 'Centro', 8.1], ['Concepción', -36.82, -73.05, 985000, 'Sur', 4.2], ['Valparaíso', -33.05, -71.62, 296000, 'Centro', 1.1],
  ['Viña del Mar', -33.02, -71.55, 334000, 'Centro', 3.0], ['Antofagasta', -23.65, -70.40, 361000, 'Norte', 9.8], ['Temuco', -38.74, -72.60, 282000, 'Sur', 7.4],
  ['La Serena', -29.90, -71.25, 249000, 'Norte', 12.6], ['Coquimbo', -29.95, -71.34, 228000, 'Norte', 11.2], ['Rancagua', -34.17, -70.74, 241000, 'Centro', 6.0],
  ['Puerto Montt', -41.47, -72.94, 245000, 'Sur', 10.3], ['Talca', -35.43, -71.66, 220000, 'Centro', 5.1], ['Arica', -18.48, -70.31, 221000, 'Norte', 6.7],
  ['Los Ángeles', -37.47, -72.35, 202000, 'Sur', 5.6], ['Iquique', -20.21, -70.15, 191000, 'Norte', 7.9], ['Chillán', -36.61, -72.10, 184000, 'Sur', 6.3],
  ['Valdivia', -39.81, -73.25, 166000, 'Sur', 4.8], ['Osorno', -40.57, -73.14, 161000, 'Sur', 2.2], ['Calama', -22.46, -68.93, 157000, 'Norte', 3.5],
  ['Copiapó', -27.37, -70.33, 153000, 'Norte', 5.9], ['Curicó', -34.98, -71.24, 149000, 'Centro', 6.8], ['Punta Arenas', -53.16, -70.91, 131000, 'Austral', 2.9],
  ['Ovalle', -30.60, -71.20, 111000, 'Norte', 4.4], ['Alto Hospicio', -20.27, -70.10, 108000, 'Norte', 14.1], ['Linares', -35.85, -71.59, 93000, 'Centro', 3.2],
  ['San Antonio', -33.59, -71.61, 91000, 'Centro', 1.8], ['Quillota', -32.88, -71.25, 90000, 'Centro', 2.5], ['Coyhaique', -45.57, -72.07, 57000, 'Austral', 3.9],
  ['Angol', -37.80, -72.71, 54000, 'Sur', -0.8], ['Vallenar', -28.58, -70.76, 51000, 'Norte', 1.6], ['Castro', -42.48, -73.76, 43000, 'Sur', 8.8],
];
export const ciudadesChile = CIUDADES.map(([ciudad, lat, lon, habitantes, macrozona, variacion]) => ({ ciudad, lat, lon, habitantes, macrozona, variacion }));

// Sucursales en el Gran Concepción (ilustrativo): tipo de local y ventas mensuales (millones de $).
export const sucursalesConcepcion = [
  ['Centro', -36.827, -73.050, 'Tienda', 182], ['Mall Plaza Trébol', -36.792, -73.068, 'Tienda', 241], ['Barrio Universitario', -36.830, -73.035, 'Tienda', 96],
  ['Lorenzo Arenas', -36.805, -73.060, 'Punto de retiro', 41], ['Talcahuano', -36.724, -73.117, 'Tienda', 133], ['Las Higueras', -36.758, -73.100, 'Punto de retiro', 35],
  ['Hualpén', -36.786, -73.095, 'Bodega', 0], ['San Pedro de la Paz', -36.842, -73.106, 'Tienda', 158], ['Andalué', -36.868, -73.090, 'Punto de retiro', 29],
  ['Chiguayante', -36.917, -73.029, 'Tienda', 87], ['Penco', -36.740, -72.996, 'Punto de retiro', 22], ['Coronel', -37.028, -73.149, 'Tienda', 74],
  ['Lomas Coloradas', -36.889, -73.135, 'Punto de retiro', 31], ['Parque Industrial', -36.770, -73.075, 'Bodega', 0], ['Tomé', -36.617, -72.957, 'Punto de retiro', 18],
  ['Pedro de Valdivia', -36.845, -73.050, 'Punto de retiro', 38],
].map(([sucursal, lat, lon, tipo, ventas]) => ({ sucursal, lat, lon, tipo, ventas }));

// Áreas metropolitanas de Sudamérica (millones de habitantes, aprox.; ilustrativo).
export const metrosSudamerica = [
  ['São Paulo', -23.55, -46.63, 22.4, 'Brazil'], ['Buenos Aires', -34.60, -58.38, 15.6, 'Argentina'], ['Rio de Janeiro', -22.91, -43.17, 13.6, 'Brazil'],
  ['Lima', -12.05, -77.04, 11.2, 'Peru'], ['Bogotá', 4.71, -74.07, 11.5, 'Colombia'], ['Santiago', -33.45, -70.66, 6.9, 'Chile'],
  ['Belo Horizonte', -19.92, -43.94, 6.2, 'Brazil'], ['Caracas', 10.48, -66.90, 3.0, 'Venezuela'], ['Medellín', 6.24, -75.58, 4.1, 'Colombia'],
  ['Guayaquil', -2.17, -79.92, 3.2, 'Ecuador'], ['Quito', -0.18, -78.47, 2.0, 'Ecuador'], ['Asunción', -25.26, -57.58, 2.5, 'Paraguay'],
  ['Montevideo', -34.90, -56.16, 1.8, 'Uruguay'], ['La Paz', -16.50, -68.15, 1.9, 'Bolivia'], ['Santa Cruz', -17.78, -63.18, 2.0, 'Bolivia'],
  ['Brasília', -15.79, -47.88, 4.8, 'Brazil'], ['Recife', -8.05, -34.88, 4.1, 'Brazil'], ['Fortaleza', -3.73, -38.53, 4.1, 'Brazil'],
  ['Salvador', -12.97, -38.50, 3.9, 'Brazil'], ['Porto Alegre', -30.03, -51.23, 4.3, 'Brazil'], ['Córdoba', -31.42, -64.18, 1.6, 'Argentina'],
  ['Cali', 3.45, -76.53, 2.8, 'Colombia'], ['Barranquilla', 10.96, -74.80, 2.4, 'Colombia'], ['Rosario', -32.95, -60.65, 1.4, 'Argentina'],
].map(([city, lat, lon, population, country]) => ({ city, lat, lon, population: population * 1e6, country }));

const tot = (rows, f) => rows.reduce((a, r) => a + r[f], 0);
const pct = (a, b) => Math.round((a / b) * 100);
const stgoShare = pct(ciudadesChile[0].habitantes, tot(ciudadesChile, 'habitantes'));
const norte = ciudadesChile.filter((r) => r.macrozona === 'Norte');
const crecNorte = (norte.reduce((a, r) => a + r.variacion, 0) / norte.length).toFixed(1).replace('.', ',');
const fastest = [...ciudadesChile].sort((a, b) => b.variacion - a.variacion)[0];
const tiendas = sucursalesConcepcion.filter((r) => r.tipo === 'Tienda');
const fuera = tiendas.filter((r) => !['Centro', 'Mall Plaza Trébol', 'Barrio Universitario'].includes(r.sucursal)).length;
const top3 = pct(metrosSudamerica.slice(0, 3).reduce((a, r) => a + r.population, 0), tot(metrosSudamerica, 'population'));

export const pointmapGallery = [
  {
    id: 'mapa-puntos',
    name: 'Mapa de puntos sobre teselas',
    nameEn: 'Point map over a basemap',
    note: '`type: "pointmap"` dibuja puntos lon/lat sobre un mapa base real (OpenStreetMap por defecto), apagado para que los datos manden. `size` da el área de cada círculo; la leyenda de tamaños va en la esquina y las ciudades mayores llevan nombre. En el navegador: clic, Ctrl + rueda o pellizco para acercarse.',
    noteEn: '`type: "pointmap"` draws lon/lat points over a real basemap (OpenStreetMap by default), muted so the data leads. `size` sets each circle\'s area; the size key sits in a corner and the largest cities are named. In the browser: click, Ctrl + scroll or pinch to zoom.',
    spec: { type: 'pointmap', title: `Santiago reúne el ${stgoShare}% de los habitantes de las 30 mayores ciudades`, subtitle: 'Habitantes por ciudad, aproximado', source: SRC, data: ciudadesChile, lon: 'lon', lat: 'lat', size: 'habitantes', label: 'ciudad', format: 'compact' },
  },
  {
    id: 'mapa-puntos-categorias',
    name: 'Puntos por categoría',
    nameEn: 'Points by category',
    note: '`hue` colorea por categoría con la paleta del tema y una leyenda conectada. A escala de ciudad el zoom sube solo (aquí ~12) y las teselas muestran calles.',
    noteEn: '`hue` colors by category with the theme palette and a linked legend. At city scale the zoom rises on its own (about 12 here) and the tiles show streets.',
    spec: { type: 'pointmap', title: `${fuera} de las ${tiendas.length} tiendas están fuera del centro de Concepción`, subtitle: 'Sucursales del Gran Concepción por tipo de local', source: SRC, data: sucursalesConcepcion, lon: 'lon', lat: 'lat', hue: 'tipo', label: 'sucursal', labels: ['Centro', 'Talcahuano', 'San Pedro de la Paz', 'Coronel', 'Tomé', 'Chiguayante'] },
  },
  {
    id: 'mapa-puntos-noche',
    name: 'Puntos con rampa en tema oscuro',
    nameEn: 'Value ramp on the dark theme',
    note: 'Con `value` numérico el color sigue una rampa secuencial. En el tema `noche` las teselas se invierten y tiñen de azul noche; `tileStyle: "original"` las deja como vienen.',
    noteEn: 'A numeric `value` colors along a sequential ramp. On the `noche` theme the tiles are inverted and tinted navy; `tileStyle: "original"` leaves them as they come.',
    spec: { type: 'pointmap', theme: 'noche', title: `Las ciudades del norte crecieron ${crecNorte}% en promedio; ${fastest.ciudad}, ${fastest.variacion.toFixed(1).replace('.', ',')}%`, subtitle: 'Variación de la población 2017–2024, %; tamaño según habitantes', source: SRC, data: ciudadesChile, lon: 'lon', lat: 'lat', size: 'habitantes', value: 'variacion', label: 'ciudad', valueFormat: { suffix: '%', decimals: 1 }, sizeFormat: 'compact', legendTitle: 'Variación' },
  },
  {
    id: 'mapa-puntos-esri',
    name: 'Otro mapa base',
    nameEn: 'Another basemap',
    note: '`tiles` elige el mapa base: "osm", "esri-gray", "esri-dark", "carto-light", "carto-dark", "mapbox-light" / "mapbox-dark" (con `tilesKey: "pk.…"`) o tu propio { url, attribution }. La atribución se dibuja siempre, con enlace.',
    noteEn: '`tiles` picks the basemap: "osm", "esri-gray", "esri-dark", "carto-light", "carto-dark", "mapbox-light" / "mapbox-dark" (with `tilesKey: "pk.…"`) or your own { url, attribution }. The attribution is always drawn, with a link.',
    spec: { type: 'pointmap', locale: 'en', tiles: 'esri-gray', title: `São Paulo, Buenos Aires and Rio hold ${top3}% of the people in these 24 metro areas`, subtitle: 'Population of the largest South American metro areas', source: 'illustrative data', data: metrosSudamerica, lon: 'lon', lat: 'lat', size: 'population', highlight: ['São Paulo', 'Buenos Aires', 'Rio de Janeiro'], label: 'city', format: 'compact' },
  },
];
