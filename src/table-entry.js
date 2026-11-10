// plotagents · tablas sobre la base: `import 'plotagents/table'` suma type: "table".
import { registerRenderer } from './base.js';
import { table } from './charts/table.js';

registerRenderer('table', (s, t) => table(s, t));

export * from './base.js';
export { default } from './base.js';
