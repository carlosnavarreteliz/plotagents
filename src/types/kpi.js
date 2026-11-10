// plotagents · kpi sobre la base (ver src/base.js).
import { registerRenderer } from '../base.js';
import { kpi } from '../charts/kpi.js';

registerRenderer('kpi', (s, t) => kpi(s, t));

export * from '../base.js';
export { default } from '../base.js';
