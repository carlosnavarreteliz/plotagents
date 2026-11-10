// plotagents · regplot, residplot, jointplot sobre la base (ver src/base.js).
import { registerRenderer } from '../base.js';
import { regplot, residplot, jointplot } from '../charts/regplot.js';

registerRenderer('regplot', (s, t) => regplot(s, t));
registerRenderer('residplot', (s, t) => residplot(s, t));
registerRenderer('jointplot', (s, t) => jointplot(s, t));

export * from '../base.js';
export { default } from '../base.js';
