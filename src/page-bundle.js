// Páginas livianas: en vez de incrustar la biblioteca entera (~1 MB) en cada
// HTML de toHTML() o dashboard(), se arma un script con solo los módulos que la
// página usa. dist/plotagents.js y dist/plotagents-geo.js traen cada módulo
// marcado con su id y sus dependencias (scripts/bundle.js); aquí se toman los
// que piden la entrada de la página, sus tipos de gráfico y sus geometrías.
import { isGeoUrl } from './geo/registry.js';

const MAP_TYPES = new Set(['choropleth', 'symbolmap', 'pointmap']);
let parsed = null;

function parse(text) {
  const first = text.indexOf('\n//#pa-mod ');
  const tailAt = text.indexOf('\n//#pa-tail');
  if (first < 0 || tailAt < 0) return null;
  const prelude = text.slice(0, first + 1).replace(/^\/\/#pa-(types|geo) .*\n/m, '');
  const meta = (k) => { const m = text.match(new RegExp(`^//#pa-${k} (.*)$`, 'm')); return m ? JSON.parse(m[1]) : null; };
  const mods = new Map();
  for (const chunk of text.slice(first + 1, tailAt).split(/\n(?=\/\/#pa-mod )/)) {
    const nl = chunk.indexOf('\n');
    const [, id, deps = ''] = chunk.slice(0, nl).split(' ');
    mods.set(id, { deps: deps ? deps.split(',') : [], code: chunk.slice(nl + 1) });
  }
  return { prelude, mods, types: meta('types'), geo: meta('geo') };
}

/**
 * Script del navegador con solo lo que necesitan `specs` (resueltos, con `type`).
 * `read(file)` devuelve el texto de dist/<file> o null. Devuelve null si los
 * archivos no traen marcas (una dist vieja): entonces se usa la biblioteca entera.
 */
export function pageBundle(specs, read, { dashboard = false } = {}) {
  const core = read('plotagents.js');
  if (!core) return null;
  if (!parsed || parsed.src !== core) {
    const a = parse(core);
    if (!a || !a.types) return null;
    const geo = read('plotagents-geo.js');
    const b = geo && parse(geo);
    parsed = { ...a, src: core, geoMods: b ? b.mods : new Map(), geo: (b && b.geo) || {} };
  }
  const P = parsed;
  const entry = dashboard ? 'src/page-dashboard.js' : 'src/page.js';
  if (!P.mods.has(entry)) return null;
  const typeEntries = new Set(), geoEntries = new Set();
  for (const s of specs) {
    if (!s || typeof s !== 'object') continue;
    const t = P.types[s.type];
    if (!t) return null; // un tipo que no se sabe dónde vive: mejor la biblioteca entera
    typeEntries.add(t);
    if (MAP_TYPES.has(s.type)) {
      const names = [];
      if (s.type === 'pointmap') names.push('world'); // contorno de respaldo bajo las teselas
      else if (s.geo === undefined) names.push('chile');
      if (typeof s.geo === 'string' && !isGeoUrl(s.geo)) names.push(s.geo);
      for (const L of [].concat(s.layers || [])) if (L && typeof L.geo === 'string' && !isGeoUrl(L.geo)) names.push(L.geo);
      for (const n of names) { const g = P.geo[String(n).toLowerCase()]; if (g) geoEntries.add(g); }
    }
  }
  const out = [], seen = new Set();
  const add = (mods, id) => {
    if (seen.has(id)) return;
    seen.add(id);
    const m = mods.get(id);
    if (!m) return;
    for (const d of m.deps) add(mods, d);
    out.push(m.code);
  };
  add(P.mods, entry);
  for (const t of typeEntries) add(P.mods, t);
  for (const g of geoEntries) add(P.geoMods, g);
  const tail = [`global.plotagents = __req(${JSON.stringify(entry)});`, ...[...typeEntries, ...geoEntries].map((id) => `__req(${JSON.stringify(id)});`)];
  return `${P.prelude}${out.join('\n')}\n${tail.join('\n')}\n})(typeof window !== 'undefined' ? window : globalThis);\n`;
}

/** Para las pruebas: olvida la dist leída. */
export function _resetPageBundle() { parsed = null; }
