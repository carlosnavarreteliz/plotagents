// plotagents · bump sobre la base (ver src/base.js).
import { registerRenderer } from '../base.js';
import { bump } from '../charts/bump.js';

registerRenderer('bump', (s, t) => bump(s, t));

export * from '../base.js';
export { default } from '../base.js';
