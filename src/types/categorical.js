// plotagents · box, violin, strip, swarm, point sobre la base (ver src/base.js).
import { registerRenderer } from '../base.js';
import { box, violin, strip, swarm, point } from '../charts/categorical.js';

registerRenderer('box', (s, t) => box(s, t));
registerRenderer('violin', (s, t) => violin(s, t));
registerRenderer('strip', (s, t) => strip(s, t));
registerRenderer('swarm', (s, t) => swarm(s, t));
registerRenderer('point', (s, t) => point(s, t));

export * from '../base.js';
export { default } from '../base.js';
