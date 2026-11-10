// plotagents · scatter, bubble sobre la base (ver src/base.js).
import { registerRenderer } from '../base.js';
import { scatter } from '../charts/scatter.js';

registerRenderer('scatter', (s, t) => scatter(s, t));
registerRenderer('bubble', (s, t) => scatter(s, t));

export * from '../base.js';
export { default } from '../base.js';
