// plotagents · entrada mínima para las páginas de toHTML(): la base, el
// dibujo en el navegador (tooltips, sliders, búsqueda) y nada más. Cada página
// suma solo los tipos de gráfico y las geometrías que usa (src/page-bundle.js).
import { plot, resolve } from './base.js';
import { render, _bind } from './runtime.js';
import { attach } from './interact.js';
import { registerGeo, getGeo, registeredGeo } from './geo/registry.js';

_bind(plot, resolve);

export { plot, resolve, render, attach, registerGeo, getGeo, registeredGeo };
