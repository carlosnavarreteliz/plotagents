// plotagents · waffle sobre la base (ver src/base.js).
import { registerRenderer } from '../base.js';
import { waffle } from '../charts/waffle.js';

registerRenderer('waffle', (s, t) => waffle(s, t));

export * from '../base.js';
export { default } from '../base.js';
