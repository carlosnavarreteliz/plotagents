// plotagents · dendrogram sobre la base (ver src/base.js).
import { registerRenderer } from '../base.js';
import { dendrogram } from '../charts/dendrogram.js';

registerRenderer('dendrogram', (s, t) => dendrogram(s, t));

export * from '../base.js';
export { default } from '../base.js';
