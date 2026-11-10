// plotagents · corr, pairplot sobre la base (ver src/base.js).
import { registerRenderer } from '../base.js';
import { corr, pairplot } from '../charts/corr.js';

registerRenderer('corr', (s, t) => corr(s, t));
registerRenderer('pairplot', (s, t) => pairplot(s, t));

export * from '../base.js';
export { default } from '../base.js';
