// plotagents · flowchart sobre la base (ver src/base.js).
import { registerRenderer } from '../base.js';
import { flowchart } from '../charts/flowchart.js';

registerRenderer('flowchart', (s, t) => flowchart(s, t));

export * from '../base.js';
export { default } from '../base.js';
