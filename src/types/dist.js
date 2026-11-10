// plotagents · hist, kde, ecdf sobre la base (ver src/base.js).
import { registerRenderer } from '../base.js';
import { hist, kde, ecdf } from '../charts/dist.js';

registerRenderer('hist', (s, t) => hist(s, t));
registerRenderer('kde', (s, t) => kde(s, t));
registerRenderer('ecdf', (s, t) => ecdf(s, t));

export * from '../base.js';
export { default } from '../base.js';
