// plotagents · gantt sobre la base (ver src/base.js).
import { registerRenderer } from '../base.js';
import { gantt } from '../charts/gantt.js';

registerRenderer('gantt', (s, t) => gantt(s, t));

export * from '../base.js';
export { default } from '../base.js';
