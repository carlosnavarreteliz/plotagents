// plotagents · bar, column, count sobre la base (ver src/base.js).
import { registerRenderer } from '../base.js';
import { bar } from '../charts/bar.js';

registerRenderer('bar', (s, t) => bar(s, t));
registerRenderer('column', (s, t) => bar({ ...s, horizontal: false }, t));
registerRenderer('count', (s, t) => bar({ aggregate: 'count', ...s }, t));

export * from '../base.js';
export { default } from '../base.js';
