// plotagents · wordcloud sobre la base (ver src/base.js).
import { registerRenderer } from '../base.js';
import { wordcloud } from '../charts/wordcloud.js';

registerRenderer('wordcloud', (s, t) => wordcloud(s, t));

export * from '../base.js';
export { default } from '../base.js';
