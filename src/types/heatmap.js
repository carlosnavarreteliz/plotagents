// plotagents · heatmap sobre la base (ver src/base.js).
import { registerRenderer } from '../base.js';
import { heatmap } from '../charts/heatmap.js';

registerRenderer('heatmap', (s, t) => heatmap(s, t));

export * from '../base.js';
export { default } from '../base.js';
