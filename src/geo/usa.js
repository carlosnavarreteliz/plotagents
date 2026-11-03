// Registra los 50 estados de EE. UU., DC y Puerto Rico como 'usa'
// (alias 'us', 'eeuu', 'estados-unidos', 'united-states', 'states').
import { registerGeo } from './registry.js';
import estados, { attribution } from './data/usa-estados.js';

registerGeo('usa', estados, ['us', 'eeuu', 'ee.uu.', 'estados-unidos', 'estados unidos', 'united-states', 'united states', 'states', 'us-states']);
export { estados, attribution };
export default estados;
