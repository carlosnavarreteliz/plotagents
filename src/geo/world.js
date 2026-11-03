// Registra los países del mundo (Natural Earth 1:110m) como 'world' (alias 'mundo').
import { registerGeo } from './registry.js';
import world, { attribution } from './data/world.js';

registerGeo('world', world, ['mundo', 'countries', 'paises', 'países']);
export { world, attribution };
export default world;
