// plotagents · mapas sobre el núcleo, sin geometrías incluidas.
//
//   import { plot, registerGeo } from 'plotagents/maps';
//   plot({ type: 'choropleth', geo: miGeoJSON, key: 'cut', value: 'v' });
//
// Suma choropleth, symbolmap y pointmap a la base (src/base.js). Las geometrías de
// Chile, EE. UU. y el mundo (~190 kB) no vienen: se pasa un GeoJSON o TopoJSON
// en `geo`, o se registra con registerGeo(). Para tenerlas, importa además
// 'plotagents/geo/chile' (o world, usa), o usa la entrada completa 'plotagents'.
import { registerRenderer } from './base.js';
import { choropleth, symbolMap } from './charts/choropleth.js';
import { pointmap } from './charts/pointmap.js';

registerRenderer('choropleth', (s, t) => choropleth(s, t));
registerRenderer('symbolmap', (s, t) => symbolMap(s, t));
registerRenderer('pointmap', (s, t) => pointmap(s, t));

export * from './base.js';
export { default } from './base.js';
export { registerGeo, getGeo, registeredGeo, toFeatureCollection } from './geo/registry.js';
export { embedTiles, TILE_PROVIDERS } from './charts/pointmap.js';
