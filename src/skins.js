// Pieles: un mismo SVG con varios juegos de colores, y el CSS elige cuál se ve.
//
//   plot({ ...spec, skins: [
//     { palette: [...], colors: {...} },                        // la primera: la de siempre
//     { when: 'html.classic', palette: [...], theme: {...} },   // otra, bajo un selector
//   ] })
//
// Un sitio estático no puede entregar otro relleno cuando el lector cambia de
// aspecto: el relleno ya está en el archivo. Así que cada marca lleva todos.
// Cada piel es un parche del spec (theme, palette, ramp, colors, colorScale…)
// y se dibuja aparte; como sólo cambian colores, los dibujos son idénticos
// salvo en los colores. Donde difieren, el color pasa a una variable CSS:
//
//   <path fill="#3A47B8" style="fill:var(--pa-s0)"/>
//   <style>.pa-skin-x{--pa-s0:#3A47B8} html.classic .pa-skin-x{--pa-s0:#0B3F8C}</style>
//
// El atributo conserva el color de la primera piel: un SVG dentro de un <img>
// (sin CSS de la página) se ve con ella, y el runtime sigue comparando
// atributos para iluminar una entrada de la leyenda. Lo que no es un color
// (posiciones, textos, orden) tiene que salir igual en todas las pieles; si
// no, se lanza un error en vez de mezclar dos dibujos distintos.

import { PlotError } from './data.js';

// Colores como aparecen en la salida: hex, rgb()/rgba(), hsl()/hsla().
const COLOR = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/g;
// Atributos de presentación: una propiedad CSS del mismo nombre puede pisarlos.
const PRESENTATION = new Set(['fill', 'stroke', 'stop-color', 'flood-color', 'lighting-color', 'color']);
// Claves del parche que no son del spec.
const OWN = new Set(['when', 'name']);

/** Parte un SVG en [texto, color, texto, color, …, texto]. */
function tokens(svg) {
  const out = [];
  let last = 0;
  for (const m of svg.matchAll(COLOR)) {
    out.push(svg.slice(last, m.index), m[0]);
    last = m.index + m[0].length;
  }
  out.push(svg.slice(last));
  return out;
}

/** Dónde cae la posición `at` de `svg`: dentro de una etiqueta (con su atributo), de un <style> o en texto. */
function contextAt(svg, at) {
  const lt = svg.lastIndexOf('<', at);
  const gt = svg.lastIndexOf('>', at);
  if (lt > gt) {
    // Dentro de una etiqueta: el atributo es el último `nombre="` antes del color.
    const head = svg.slice(lt, at);
    const m = head.match(/([\w:-]+)="[^"]*$/);
    return { kind: 'tag', start: lt, attr: m ? m[1] : null };
  }
  const open = svg.lastIndexOf('<style', at);
  const close = svg.lastIndexOf('</style', at);
  return { kind: open > close ? 'css' : 'text' };
}

/** Suma `prop:valor` al atributo style de la etiqueta que empieza en `start`. */
function addStyle(svg, start, decl) {
  const end = svg.indexOf('>', start);
  const tag = svg.slice(start, end);
  const m = tag.match(/\sstyle="([^"]*)"/);
  let next;
  if (m) {
    // Si el style ya declara la propiedad (un color `var(--x, …)`), esa manda.
    const prop = decl.slice(0, decl.indexOf(':'));
    if (new RegExp('(?:^|;)\\s*' + prop + '\\s*:').test(m[1])) return svg;
    const body = m[1].trim().replace(/;$/, '');
    next = tag.replace(m[0], ` style="${body ? body + ';' : ''}${decl}"`);
  } else {
    const selfClose = tag.endsWith('/');
    next = (selfClose ? tag.slice(0, -1) : tag) + ` style="${decl}"` + (selfClose ? '/' : '');
  }
  return svg.slice(0, start) + next + svg.slice(end);
}

/** Lanza si los dibujos difieren en algo que no sea un color. */
function same(parts, msg, fix) {
  const n = parts[0].length;
  for (let i = 1; i < parts.length; i++) {
    const p = parts[i];
    if (!(p.length === n && p.every((t, j) => j % 2 === 1 || t === parts[0][j]))) throw new PlotError(msg(i), fix);
  }
}

/**
 * Reescribe los colores `at` = [[índice del token, css(color), decl]] de `svg`
 * (cuyas piezas son `base`). En CSS y en atributos style, el color pasa a
 * `css(color)`; en un atributo de presentación se suma `prop:decl` al style y
 * el atributo conserva el literal. En data-* y en el texto no se toca.
 */
function rewrite(svg, base, at) {
  const offsets = [];
  let pos = 0;
  for (const t of base) { offsets.push(pos); pos += t.length; }
  // De atrás hacia adelante: lo ya reescrito queda después de lo que falta.
  for (let k = at.length - 1; k >= 0; k--) {
    const [j, css, decl] = at[k];
    const start = offsets[j];
    const color = base[j];
    const c = contextAt(svg, start);
    if (c.kind === 'css' || (c.kind === 'tag' && c.attr === 'style')) {
      svg = svg.slice(0, start) + css(color) + svg.slice(start + color.length);
    } else if (c.kind === 'tag' && PRESENTATION.has(c.attr)) {
      svg = addStyle(svg, c.start, `${c.attr}:${decl}`);
    }
  }
  return svg;
}

// ── Colores como variables CSS ──────────────────────────────────────────────
//
//   plot({ ...spec, colors: { Minería: 'var(--accent, #0b3f8c)' } })
//
// La página decide el color (por sección, por modo); el respaldo es el que se
// usa para calcular (contraste del texto sobre la marca, tintes, el <img>
// sin CSS). Se dibuja dos veces: con los respaldos y con una «sonda» casi
// igual por variable. Donde aparece la sonda exacta, la marca lleva el color
// mismo y se escribe la variable; donde aparece otro color (un tinte o un
// texto elegido por contraste), es un derivado y queda calculado con el respaldo.

const VAR = /^var\(\s*(--[\w-]+)\s*(?:,\s*(.+?))?\s*\)$/;
const NOT_STYLE = new Set(['data', 'compareData', 'geo', 'layers', 'markers']);

function rgbOf(c) {
  const h = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c);
  if (h) {
    const x = h[1].length === 3 ? h[1].replace(/./g, (d) => d + d) : h[1];
    return [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16));
  }
  const m = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i.exec(c);
  return m ? [+m[1], +m[2], +m[3]] : null;
}
const hex6 = (rgb) => '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('');

/** Las variables de color del spec: expresión → { name, fallback, probe }. */
export function cssVars(spec) {
  const found = new Map();
  const walk = (v, key) => {
    if (typeof v === 'string') {
      const m = VAR.exec(v.trim());
      if (!m || found.has(v)) return;
      const fb = m[2] && m[2].trim();
      if (!fb || !rgbOf(fb)) {
        throw new PlotError(`El color \`${v}\` necesita un respaldo hex o rgb(): con él se calculan contrastes y tintes.`, `var(${m[1]}, #3A47B8)`);
      }
      found.set(v, { name: m[1], fallback: fb });
    } else if (Array.isArray(v)) v.forEach((x) => walk(x));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (!(key === undefined && NOT_STYLE.has(k))) walk(x, k);
  };
  walk(spec);
  // Sondas: el respaldo con el azul corrido lo mínimo, distinta para cada variable.
  const taken = new Set([...found.values()].map((v) => hex6(rgbOf(v.fallback))));
  let k = 0;
  for (const v of found.values()) {
    const [r, g, b] = rgbOf(v.fallback);
    let probe;
    do { k++; probe = hex6([r, g ^ (k >> 8 & 1), b ^ (k & 255)]); } while (taken.has(probe));
    taken.add(probe);
    v.probe = probe;
  }
  return found;
}

function replaceVars(v, map, which, key) {
  if (typeof v === 'string') return map.has(v) ? map.get(v)[which] : v;
  if (Array.isArray(v)) return v.map((x) => replaceVars(x, map, which));
  if (v && typeof v === 'object' && !(v instanceof Date)) {
    const out = {};
    for (const [k, x] of Object.entries(v)) out[k] = key === undefined && NOT_STYLE.has(k) ? x : replaceVars(x, map, which, k);
    return out;
  }
  return v;
}

/** Dibuja un spec con colores `var(--x, respaldo)`; `draw` es plot() sin variables. */
export function plotWithVars(spec, map, draw) {
  const a = draw(replaceVars(spec, map, 'fallback'));
  const b = draw(replaceVars(spec, map, 'probe'));
  const pa = tokens(a);
  const pb = tokens(b);
  same([pa, pb], () => 'Un color `var()` cambió algo más que colores al dibujarse.', 'Usa un respaldo cercano al color que la página va a dar.');
  const byProbe = new Map([...map.values()].map((v) => [v.probe, v]));
  const at = [];
  for (let j = 1; j < pa.length; j += 2) {
    if (pa[j].toLowerCase() === pb[j].toLowerCase()) continue;
    const v = byProbe.get(pb[j].toLowerCase());
    if (!v) continue; // un derivado: queda calculado con el respaldo
    at.push([j, (c) => `var(${v.name}, ${c})`, `var(${v.name}, ${pa[j]})`]);
  }
  return rewrite(a, pa, at);
}

/** Un hash corto y estable (para el nombre de la clase de la piel). */
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

/** El spec de una piel: el spec sin `skins`, con el parche encima (theme se fusiona). */
export function skinSpec(spec, patch) {
  const { skins, ...base } = spec;
  // `skins: null` también tapa unas pieles globales de configure().
  const s = { ...base, skins: null };
  for (const [k, v] of Object.entries(patch || {})) {
    if (OWN.has(k)) continue;
    if (k === 'colors' && v && typeof v === 'object') s.colors = { ...(base.colors || {}), ...v };
    else if (k === 'theme' && v && typeof v === 'object' && base.theme && typeof base.theme === 'object' && v.extends === undefined) s.theme = { ...base.theme, ...v };
    else s[k] = v;
  }
  return s;
}

/**
 * Une los SVG de varias pieles en uno. `svgs[0]` es la piel por defecto;
 * `whens[i]` es el selector CSS (de un ancestro) bajo el que rige la piel i.
 */
export function mergeSkins(svgs, whens) {
  if (svgs.length === 1) return svgs[0];
  const parts = svgs.map(tokens);
  const n = parts[0].length;
  same(parts, (i) => `La piel ${i + 1} cambia algo más que colores (posiciones, textos u orden).`,
    'Una piel sólo puede traer theme, palette, ramp, colorScale y colors: lo demás va en el spec.');
  // Colores que difieren entre pieles → una variable por combinación, en orden de aparición.
  const vars = new Map();
  const at = []; // [índice del token, nombre de la variable]
  for (let j = 1; j < n; j += 2) {
    const combo = parts.map((p) => p[j]);
    if (combo.every((c) => c.toLowerCase() === combo[0].toLowerCase())) continue;
    const key = combo.join('|');
    if (!vars.has(key)) vars.set(key, { name: `--pa-s${vars.size}`, combo });
    at.push([j, vars.get(key).name]);
  }
  if (!vars.size) return svgs[0];

  let svg = rewrite(svgs[0], parts[0], at.map(([j, name]) => [j, (c) => `var(${name}, ${c})`, `var(${name})`]));

  // El nombre sale de la geometría, no de los colores: dos pasadas que sólo
  // difieren en color (las de `var()`) dan la misma clase.
  const cls = 'pa-skin-' + hash(parts[0].filter((_, j) => j % 2 === 0).join('\u0000') + '\u0000' + whens.join('|'));
  const decl = (i) => [...vars.values()].map((v) => `${v.name}:${v.combo[i]}`).join(';');
  const rules = [`.${cls}{${decl(0)}}`];
  for (let i = 0; i < svgs.length; i++) {
    if (whens[i]) rules.push(`${whens[i]} .${cls}{${decl(i)}}`);
  }
  // La clase va en la raíz; las reglas, en el <style> del SVG (o uno nuevo).
  svg = svg.replace(/^<svg\b([^>]*?)\sclass="([^"]*)"/, (m, a, c) => `<svg${a} class="${c} ${cls}"`);
  if (!svg.includes(cls)) svg = svg.replace(/^<svg\b/, `<svg class="${cls}"`);
  const css = rules.join('');
  if (svg.includes('</style>')) svg = svg.replace('</style>', css + '</style>');
  else svg = svg.replace(/^(<svg\b[^>]*>)/, `$1<style>${css}</style>`);
  return svg;
}

/** Valida `skins` y devuelve [specs, whens]. */
export function expandSkins(spec) {
  const list = spec.skins;
  if (!Array.isArray(list) || !list.length) throw new PlotError('`skins` debe ser una lista de parches del spec.', 'skins: [{ palette: [...] }, { when: "html.dark", palette: [...] }]');
  list.forEach((p, i) => {
    if (!p || typeof p !== 'object') throw new PlotError(`skins[${i}] debe ser un objeto.`, 'skins: [{ palette: [...] }, { when: "html.dark", palette: [...] }]');
    if (i > 0 && (typeof p.when !== 'string' || !p.when.trim())) throw new PlotError(`skins[${i}] necesita \`when\`: el selector CSS bajo el que rige.`, 'when: "html.dark"');
    for (const k of ['data', 'type', 'x', 'y', 'series', 'path', 'value', 'width', 'height']) {
      if (k in p) throw new PlotError(`skins[${i}] no puede cambiar \`${k}\`: una piel sólo cambia colores.`, 'Mueve ese campo al spec.');
    }
  });
  return [list.map((p) => skinSpec(spec, p)), list.map((p) => (p.when ? p.when.trim() : null))];
}
