// Registra las 16 regiones de Chile como 'chile' (alias 'chile-regiones').
import { registerGeo } from './registry.js';
import regiones, { attribution } from './data/chile-regiones.js';

registerGeo('chile', regiones, ['chile-regiones', 'regiones']);
export { regiones, attribution };
export default regiones;
