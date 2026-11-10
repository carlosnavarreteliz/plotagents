// plotagents · spark sobre la base (ver src/base.js).
import { registerRenderer } from '../base.js';
import { spark } from '../charts/spark.js';

registerRenderer('spark', (s, t) => spark(s, t));

export * from '../base.js';
export { default } from '../base.js';
