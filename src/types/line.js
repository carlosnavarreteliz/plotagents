// plotagents · line, area sobre la base (ver src/base.js).
import { registerRenderer } from '../base.js';
import { line } from '../charts/line.js';

registerRenderer('line', (s, t) => line(s, t, 'line'));
registerRenderer('area', (s, t) => line(s, t, 'area'));

export * from '../base.js';
export { default } from '../base.js';
