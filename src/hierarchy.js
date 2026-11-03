// Jerarquías para treemap y sunburst: filas planas + campos de ruta → árbol
// agregado, ordenado de mayor a menor. También colores por familia, foco
// (drill-down) y migas de pan.
import { ensureData, requireField, num, fieldsOf, fieldKind, PlotError } from './data.js';
import { hexToRgb, rgbToHex } from './theme.js';
import { formatNumber } from './format.js';
import { el, g, text } from './svg.js';
import { measure, truncate } from './text.js';
import { otherLabel, thresholdOf, splitOther } from './other.js';

/** Resuelve los campos de ruta y valor desde el spec (path | group+label | label | x). */
export function hierarchyFields(spec, data) {
  const fields = fieldsOf(data);
  const cats = fields.filter((f) => fieldKind(data, f) === 'category');
  let path = spec.path ? [].concat(spec.path) : null;
  if (!path) {
    const leaf = spec.label ?? spec.x;
    path = spec.group ? [spec.group, leaf ?? cats.find((f) => f !== spec.group)] : [leaf ?? cats[0]];
  }
  path = path.filter(Boolean);
  const value = spec.value ?? spec.y ?? (typeof spec.size === 'string' ? spec.size : null) ?? fields.find((f) => fieldKind(data, f) === 'number');
  if (!path.length) throw new PlotError('No encontré un campo de categorías para la jerarquía.', 'Indica path: ["grupo", "elemento"] o label: "campo".');
  path.forEach((p, i) => requireField(data, p, `path[${i}]`));
  requireField(data, value, 'value');
  return { path, value };
}

/**
 * Construye el árbol. Nodo: { name, path, depth, value, children, parent }.
 * `depth` (opcional) agrega todo bajo ese nivel.
 */
export function buildHierarchy(spec) {
  const data = ensureData(spec);
  const { path, value } = hierarchyFields(spec, data);
  const levels = Math.max(1, Math.min(path.length, spec.depth ?? path.length));
  const root = { name: '', path: [], depth: 0, value: 0, children: [], map: new Map() };
  for (const r of data) {
    const v = num(r[value]);
    if (!(v > 0)) continue;
    let node = root;
    root.value += v;
    for (let d = 0; d < levels; d++) {
      const raw = r[path[d]];
      const name = raw === null || raw === undefined || raw === '' ? '—' : String(raw);
      if (!node.map.has(name)) {
        const child = { name, path: [...node.path, name], depth: d + 1, value: 0, children: [], map: new Map(), parent: node };
        node.map.set(name, child);
        node.children.push(child);
      }
      node = node.map.get(name);
      node.value += v;
    }
  }
  const sortRec = (n) => { n.children.sort((a, b) => b.value - a.value); n.children.forEach(sortRec); delete n.map; };
  sortRec(root);
  foldOther(root, spec);
  return { root, fields: path.slice(0, levels), valueField: value, data };
}

/**
 * En cada nivel, los hermanos bajo el umbral (fracción del padre) se agrupan
 * en una hoja "Otros" que va siempre al final. Un "Otros" que ya venga en los
 * datos también baja al final (y recibe a los agrupados). No se agrupan los
 * nodos destacados, con color fijo o en la ruta de `focus`.
 */
function foldOther(root, spec) {
  const threshold = thresholdOf(spec);
  const label = otherLabel(spec);
  const hl = spec.highlight === undefined ? null : new Set([].concat(spec.highlight).map(String));
  const focus = (spec.focus || []).map(String);
  const rec = (n) => {
    if (!n.children.length) return;
    const sp = splitOther(n.children, {
      value: (c) => c.value, name: (c) => c.name, total: n.value, threshold, label,
      protect: (c) => (hl && hl.has(c.name)) || !!(spec.colors && spec.colors[c.name]) || focus[c.depth - 1] === c.name,
    });
    sp.keep.forEach(rec);
    if (!sp.fold.length) {
      sp.others.forEach(rec);
      n.children = [...sp.keep, ...sp.others];
      return;
    }
    const merge = [...sp.others, ...sp.fold];
    const name = sp.others.length === 1 ? sp.others[0].name : label;
    const other = {
      name, path: [...n.path, name], depth: n.depth + 1, parent: n, children: [], other: true,
      value: merge.reduce((a, c) => a + c.value, 0),
      members: merge.map((c) => ({ name: c.name, path: c.path, value: c.value })),
    };
    n.children = [...sp.keep, other];
  };
  rec(root);
}

/** Línea de tooltip para un "Otros": cuántos agrupa y cuáles. */
export function otherNote(n, locale = 'es') {
  if (!n.other || !n.members) return '';
  const en = String(locale).startsWith('en');
  const L = n.members.map((m) => m.name);
  const names = L.slice(0, 6).join(', ') + (L.length > 6 ? (en ? ` and ${L.length - 6} more` : ` y ${L.length - 6} más`) : '');
  return `${L.length} ${en ? (L.length === 1 ? 'item' : 'items') : L.length === 1 ? 'elemento' : 'elementos'}: ${names}`;
}

/** Busca un nodo por ruta; si no existe, devuelve el más profundo que coincida. */
export function findNode(root, focus = []) {
  let node = root;
  for (const name of focus || []) {
    const next = node.children.find((c) => c.name === String(name));
    if (!next) break;
    node = next;
  }
  return node;
}

export const height = (n) => (n.children.length ? 1 + Math.max(...n.children.map(height)) : 0);
export const descendants = (n) => [n, ...n.children.flatMap(descendants)];

/** Mezcla un color hacia otro (t ∈ [0,1]). */
export function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex(A.map((v, i) => v + (B[i] - v) * t));
}

/**
 * Colores por familia: el primer nivel visible toma la paleta categórica en
 * orden de tamaño (desde el 8.º, "Otros" en gris); los descendientes heredan
 * el color con una variación de luminosidad sutil por hermano.
 */
export function assignColors(displayRoot, theme, spec, { single = false } = {}) {
  // El "Otros" agrupado va en gris y no gasta un color de la paleta.
  const top = displayRoot.children.filter((c) => !c.other);
  const n = theme.categorical.length;
  const fold = top.length > n;
  top.forEach((c, i) => {
    const fixed = spec.colors && spec.colors[c.name];
    c.color = fixed || (single ? theme.categorical[0] : fold && i >= n - 1 ? theme.other : theme.categorical[i] || theme.other);
    c.folded = !fixed && !single && fold && i >= n - 1;
  });
  for (const c of displayRoot.children) if (c.other) { c.color = (spec.colors && spec.colors[c.name]) || theme.other; c.folded = !single; }
  const steps = [0, 0.14, 0.07, 0.2, 0.1];
  const toward = theme.surface;
  const rec = (node) => node.children.forEach((c, i) => {
    // Color sólido por categoría completa (por defecto); `shade: true` vuelve a los tonos por hermano.
    if (node !== displayRoot) c.color = (spec.colors && spec.colors[c.name]) || (c.other ? mix(node.color, toward, 0.4) : spec.shade ? mix(node.color, toward, steps[i % steps.length]) : node.color);
    rec(c);
  });
  rec(displayRoot);
}

export function shareFmt(locale) {
  return (v, total) => {
    const p = total > 0 ? (v / total) * 100 : 0;
    return formatNumber(p, p < 1 ? 1 : p < 10 ? 1 : 0, locale, true) + '%';
  };
}

export const SEP = ' › ';

/**
 * Migas de pan de foco: "Todo › Minería › Cobre". Cada miga lleva data-drill
 * con la ruta de su ancestro (la raíz, "[]"). Devuelve { svg, h }.
 */
export function breadcrumb(focusNode, x, y, w, theme, locale = 'es') {
  if (!focusNode || !focusNode.path.length) return { svg: '', h: 0 };
  const en = String(locale).startsWith('en');
  const crumbs = [{ name: en ? 'All' : 'Todo', path: [] }, ...focusNode.path.map((name, i) => ({ name, path: focusNode.path.slice(0, i + 1) }))];
  const out = [];
  let cx = x;
  const size = 12.5;
  crumbs.forEach((c, i) => {
    const last = i === crumbs.length - 1;
    const label = truncate(c.name, Math.max(60, w / crumbs.length), size, last ? 600 : 400);
    const wLab = measure(label, size, last ? 600 : 400);
    const attrs = { fill: last ? theme.ink : theme.lede, fontSize: size, fontWeight: last ? 600 : 400 };
    if (last) out.push(text(cx, y + 13, label, attrs));
    else out.push(g({ class: 'pa-crumb', 'data-drill': JSON.stringify(c.path), style: 'cursor:pointer' }, [
      el('rect', { x: cx - 3, y, width: wLab + 6, height: 18, fill: 'transparent' }),
      text(cx, y + 13, label, { ...attrs, textDecoration: 'underline', 'text-decoration-color': theme.axis }),
    ]));
    cx += wLab;
    if (!last) {
      out.push(text(cx + 6, y + 13, '›', { fill: theme.muted, fontSize: size }));
      cx += 18;
    }
  });
  return { svg: g({ class: 'pa-breadcrumb' }, out), h: 26 };
}
