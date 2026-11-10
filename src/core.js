// plotagents · núcleo: la base más todos los tipos que no necesitan mapas ni tablas.
//
//   import { plot } from 'plotagents/core';
//
// No importa las geometrías incluidas (Chile, EE. UU., mundo), ni las tablas, ni
// el lint, el esquema o los tableros. Los mapas se suman con 'plotagents/maps',
// las tablas con 'plotagents/table'; un solo tipo, con 'plotagents/types/<tipo>'.
// `plotagents` (la entrada de siempre) lo trae todo.
import './types/bar.js';
import './types/line.js';
import './types/scatter.js';
import './types/treemap.js';
import './types/sunburst.js';
import './types/donut.js';
import './types/dist.js';
import './types/regplot.js';
import './types/categorical.js';
import './types/radar.js';
import './types/network.js';
import './types/chord.js';
import './types/pyramid.js';
import './types/flowchart.js';
import './types/gantt.js';
import './types/wordcloud.js';
import './types/heatmap.js';
import './types/corr.js';
import './types/sankey.js';
import './types/kpi.js';

export * from './base.js';
export { default } from './base.js';
