// plotagents · radar sobre la base (ver src/base.js).
import { registerRenderer } from '../base.js';
import { radar } from '../charts/radar.js';

registerRenderer('radar', (s, t) => radar(s, t));

export * from '../base.js';
export { default } from '../base.js';
