// Registro de geometrías. El núcleo no trae mapas pesados: se registran al
// importar 'plotagents/geo/chile', 'plotagents/geo/usa' o 'plotagents/geo/world', o se pasa un
// GeoJSON propio en spec.geo.
import { PlotError } from '../data.js';

const REG = new Map();

export function registerGeo(name, fc, aliases = []) {
  if (!fc || fc.type !== 'FeatureCollection') throw new PlotError(`La geometría "${name}" debe ser un GeoJSON FeatureCollection.`);
  for (const n of [name, ...aliases]) REG.set(String(n).toLowerCase(), fc);
  return fc;
}

export function getGeo(geo) {
  if (geo && typeof geo === 'object') {
    if (geo.type === 'FeatureCollection') return geo;
    if (geo.type === 'Feature') return { type: 'FeatureCollection', features: [geo] };
    throw new PlotError('`geo` debe ser un nombre registrado o un GeoJSON FeatureCollection.');
  }
  const fc = REG.get(String(geo || '').toLowerCase());
  if (!fc) {
    const known = [...new Set(REG.keys())];
    throw new PlotError(
      `No hay una geometría registrada con el nombre "${geo}".`,
      known.length ? `Disponibles: ${known.join(', ')}. O pasa un GeoJSON en \`geo\`.` : "Importa 'plotagents/geo/chile', 'plotagents/geo/usa' o 'plotagents/geo/world', o pasa un GeoJSON en `geo`."
    );
  }
  return fc;
}

export const registeredGeo = () => [...new Set(REG.keys())];
