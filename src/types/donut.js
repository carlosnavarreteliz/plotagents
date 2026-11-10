// plotagents · donut, pie sobre la base (ver src/base.js).
import { registerRenderer } from '../base.js';
import { donut, pie } from '../charts/donut.js';

registerRenderer('donut', (s, t) => donut(s, t));
registerRenderer('pie', (s, t) => pie(s, t));

export * from '../base.js';
export { default } from '../base.js';
