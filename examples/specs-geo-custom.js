// Mapas con geometría propia: un GeoJSON cualquiera en `geo`, con
// marcadores, capas y encuadre. La geometría de Sudamérica sale de Natural
// Earth (dominio público), con los nombres de propiedad que trae ese
// archivo (ADMIN, ISO_A3), como llegaría desde afuera.
import world from '../src/geo/data/world.js';

const SA = { ARG: 'Argentina', BOL: 'Bolivia', BRA: 'Brasil', CHL: 'Chile', COL: 'Colombia', ECU: 'Ecuador', GUY: 'Guyana', PRY: 'Paraguay', PER: 'Perú', SUR: 'Surinam', URY: 'Uruguay', VEN: 'Venezuela' };
const SA_EN = { BRA: 'Brazil', PER: 'Peru', SUR: 'Suriname' };

/** GeoJSON de Sudamérica "ajeno": propiedades ADMIN / ISO_A3, sin `name`. */
export function southAmerica(locale = 'es') {
  const en = locale === 'en';
  return {
    type: 'FeatureCollection',
    features: world.features.filter((f) => SA[f.properties.iso3]).map((f) => ({
      type: 'Feature',
      properties: { ADMIN: en ? SA_EN[f.properties.iso3] || SA[f.properties.iso3] : SA[f.properties.iso3], ISO_A3: f.properties.iso3 },
      geometry: f.geometry,
    })),
  };
}

const LANG = { BRA: ['Portugués', 'Portuguese'], GUY: ['Inglés', 'English'], SUR: ['Neerlandés', 'Dutch'] };
export const idiomas = (locale = 'es') => Object.keys(SA).map((c) => ({ pais: locale === 'en' ? SA_EN[c] || SA[c] : SA[c], idioma: (LANG[c] || ['Español', 'Spanish'])[locale === 'en' ? 1 : 0] }));

export const capitales = [
  { ciudad: 'Buenos Aires', lon: -58.38, lat: -34.6 }, { ciudad: 'Santiago', lon: -70.67, lat: -33.45 }, { ciudad: 'Lima', lon: -77.04, lat: -12.05 },
  { ciudad: 'Bogotá', lon: -74.07, lat: 4.71 }, { ciudad: 'Brasília', lon: -47.88, lat: -15.79 }, { ciudad: 'Caracas', lon: -66.9, lat: 10.48 },
  { ciudad: 'Quito', lon: -78.47, lat: -0.18 }, { ciudad: 'La Paz', lon: -68.15, lat: -16.5 }, { ciudad: 'Asunción', lon: -57.58, lat: -25.26 },
  { ciudad: 'Montevideo', lon: -56.16, lat: -34.9 }, { ciudad: 'Georgetown', lon: -58.16, lat: 6.8 }, { ciudad: 'Paramaribo', lon: -55.2, lat: 5.85 },
];

/** Una línea (capa): el trópico de Capricornio. */
export const tropico = (label) => ({ type: 'Feature', properties: { name: label }, geometry: { type: 'LineString', coordinates: [[-71, -23.44], [-40.5, -23.44]] } });

// Puertos del Gran Concepción (toneladas ilustrativas) y exportaciones regionales ilustrativas.
const puertos = [
  { puerto: 'Talcahuano y San Vicente', lon: -73.12, lat: -36.72, mt: 10.9 },
  { puerto: 'Coronel', lon: -73.16, lat: -37.03, mt: 7.4 },
  { puerto: 'Lirquén', lon: -72.97, lat: -36.71, mt: 4.1 },
];
const exportaciones = [{ region: 'Maule', mm: 3.1 }, { region: 'Ñuble', mm: 1.2 }, { region: 'Biobío', mm: 6.8 }, { region: 'La Araucanía', mm: 1.0 }];

export const customGeoGallery = [
  {
    id: 'geojson-propio',
    name: 'Tu propio GeoJSON',
    nameEn: 'Your own GeoJSON',
    note: 'Pasa cualquier GeoJSON o TopoJSON en `geo`. La propiedad que calza con tus datos se detecta sola (aquí `ADMIN`); un `value` de texto colorea por categoría. `markers` agrega puntos por lon/lat y `layers` superpone líneas.',
    noteEn: 'Pass any GeoJSON or TopoJSON in `geo`. The property that matches your data is detected for you (here `ADMIN`); a text `value` colors by category. `markers` adds points by lon/lat and `layers` overlays lines.',
    spec: {
      type: 'choropleth',
      geo: southAmerica('es'),
      title: 'El español es lengua oficial en 9 de los 12 países de Sudamérica',
      subtitle: 'Principal lengua oficial por país, con sus capitales',
      source: 'Natural Earth (dominio público)',
      data: idiomas('es'), key: 'pais', value: 'idioma',
      markers: { data: capitales, label: 'ciudad', legend: 'Capital' },
      layers: [{ geo: tropico('Trópico de Capricornio'), label: 'Trópico de Capricornio', dash: true, width: 1 }],
    },
  },
  {
    id: 'mapa-encuadre',
    name: 'Encuadre y marcadores',
    nameEn: 'Framing and markers',
    note: '`fitTo` encuadra unas regiones (o una caja [lon, lat, lon, lat]) y deja el resto como contexto. Los marcadores con `size` tienen área proporcional al valor.',
    noteEn: '`fitTo` frames a few regions (or a [lon, lat, lon, lat] box) and keeps the rest as context. Markers with `size` get an area proportional to the value.',
    spec: {
      type: 'choropleth',
      geo: 'chile',
      title: 'Biobío exporta más que sus tres vecinas juntas, y lo hace por tres puertos',
      subtitle: 'Exportaciones por región, miles de millones de US$, y carga por puerto, millones de toneladas',
      source: 'datos ilustrativos',
      data: exportaciones, key: 'region', value: 'mm', legendTitle: 'Exportaciones', format: { decimals: 1 },
      fitTo: ['Biobío', 'Ñuble'],
      markers: { data: puertos, label: 'puerto', size: 'mt', legend: 'Puerto (área ∝ toneladas)', color: '#E8A33D', maxRadius: 16 },
      missing: 'plain',
    },
  },
];
