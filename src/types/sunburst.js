// plotagents · sunburst sobre la base (ver src/base.js).
import { registerRenderer } from '../base.js';
import { sunburst } from '../charts/sunburst.js';

registerRenderer('sunburst', (s, t) => sunburst(s, t));

export * from '../base.js';
export { default } from '../base.js';
