// plotagents · pyramid sobre la base (ver src/base.js).
import { registerRenderer } from '../base.js';
import { pyramid } from '../charts/pyramid.js';

registerRenderer('pyramid', (s, t) => pyramid(s, t));

export * from '../base.js';
export { default } from '../base.js';
