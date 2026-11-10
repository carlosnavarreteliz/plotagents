// plotagents · dotplot sobre la base (ver src/base.js).
import { registerRenderer } from '../base.js';
import { dotplot } from '../charts/dotplot.js';

registerRenderer('dotplot', (s, t) => dotplot(s, t));

export * from '../base.js';
export { default } from '../base.js';
