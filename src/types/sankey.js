// plotagents · sankey sobre la base (ver src/base.js).
import { registerRenderer } from '../base.js';
import { sankey } from '../charts/sankey.js';

registerRenderer('sankey', (s, t) => sankey(s, t));

export * from '../base.js';
export { default } from '../base.js';
