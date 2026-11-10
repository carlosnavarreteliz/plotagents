// plotagents · network sobre la base (ver src/base.js).
import { registerRenderer } from '../base.js';
import { network } from '../charts/network.js';

registerRenderer('network', (s, t) => network(s, t));

export * from '../base.js';
export { default } from '../base.js';
