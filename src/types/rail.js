// plotagents · rail sobre la base (ver src/base.js).
import { registerRenderer } from '../base.js';
import { rail } from '../charts/rail.js';

registerRenderer('rail', (s, t) => rail(s, t));

export * from '../base.js';
export { default } from '../base.js';
