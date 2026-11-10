// plotagents · treemap sobre la base (ver src/base.js).
import { registerRenderer } from '../base.js';
import { treemap } from '../charts/treemap.js';

registerRenderer('treemap', (s, t) => treemap(s, t));

export * from '../base.js';
export { default } from '../base.js';
