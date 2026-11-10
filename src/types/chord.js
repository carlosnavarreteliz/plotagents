// plotagents · chord sobre la base (ver src/base.js).
import { registerRenderer } from '../base.js';
import { chord } from '../charts/chord.js';

registerRenderer('chord', (s, t) => chord(s, t));

export * from '../base.js';
export { default } from '../base.js';
