// Árboles binarios de agrupamiento: { leaf } en las hojas, { left, right, h } en
// los nodos. Los usan el clustermap (corr) y el dendrograma.

/** Hojas en el orden en que se dibujan. */
export const leaves = (node) => (node.left ? [...leaves(node.left), ...leaves(node.right)] : [node.leaf]);

/**
 * Codos de un dendrograma. `leafPos(leaf)` da la posición de una hoja a lo largo
 * del eje de las hojas; `hPos(h)` la de una altura a lo largo del otro eje.
 * Con `horizontal`, las hojas van en y y las alturas en x (raíz a la izquierda
 * o a la derecha, según hPos). `colorOf(node)` (opcional) agrupa los codos por
 * color. Devuelve [{ color, d }] con un path por color, en orden de aparición.
 */
export function elbows(tree, leafPos, hPos, { horizontal = false, colorOf = () => null } = {}) {
  const byColor = new Map();
  const f = (v) => v.toFixed(1);
  const walk = (nd) => {
    const h0 = hPos(0);
    if (!nd.left) return [leafPos(nd.leaf), nd.h ? hPos(nd.h) : h0];
    const [pl, hl] = walk(nd.left), [pr, hr] = walk(nd.right);
    const hh = hPos(nd.h);
    const d = horizontal
      ? `M${f(hl)},${f(pl)}H${f(hh)}V${f(pr)}H${f(hr)}`
      : `M${f(pl)},${f(hl)}V${f(hh)}H${f(pr)}V${f(hr)}`;
    const c = colorOf(nd);
    if (!byColor.has(c)) byColor.set(c, []);
    byColor.get(c).push(d);
    return [(pl + pr) / 2, hh];
  };
  walk(tree);
  return [...byColor.entries()].map(([color, ds]) => ({ color, d: ds.join('') }));
}

/**
 * Cortes a una altura: los subárboles maximales con h ≤ cut. Devuelve una lista
 * de nodos (cada uno, un grupo), en el orden de las hojas.
 */
export function cutTree(tree, cut) {
  const out = [];
  const walk = (nd) => {
    if (!nd.left || nd.h <= cut) { out.push(nd); return; }
    walk(nd.left); walk(nd.right);
  };
  walk(tree);
  return out;
}

/**
 * Árbol desde una matriz de enlace estilo scipy (n − 1 filas [a, b, altura, n]):
 * los índices < n son hojas; n + i es el nodo formado en la fila i.
 */
export function fromLinkage(Z, n = Z.length + 1) {
  const nodes = [];
  for (let i = 0; i < n; i++) nodes.push({ leaf: i, h: 0 });
  for (const row of Z) {
    const [a, b, h] = row.map(Number);
    const L = nodes[a], R = nodes[b];
    if (!L || !R) throw new Error(`linkage: índice fuera de rango (${a}, ${b})`);
    nodes.push({ left: L, right: R, h: Math.max(h, L.h, R.h) });
  }
  return nodes[nodes.length - 1];
}

/**
 * Árbol desde filas { id, parent, height }: un nodo con más de dos hijos se
 * dibuja como una sucesión de codos a la misma altura. Las hojas son las filas
 * sin hijos; su `leaf` es el id.
 */
export function fromParents(rows, idF = 'id', parentF = 'parent', hF = 'height') {
  const kids = new Map();
  const h = new Map();
  const ids = [];
  for (const r of rows) {
    const id = String(r[idF]);
    ids.push(id);
    h.set(id, Number(r[hF]) || 0);
    const p = r[parentF];
    if (p !== null && p !== undefined && p !== '') {
      const k = String(p);
      if (!kids.has(k)) kids.set(k, []);
      kids.get(k).push(id);
    }
  }
  const known = new Set(ids);
  // Un padre que no tiene fila propia también es un nodo (altura 0 si no hay otra).
  for (const p of kids.keys()) if (!known.has(p)) { ids.push(p); known.add(p); h.set(p, h.get(p) || 0); }
  const childOf = new Set([...kids.values()].flat());
  const roots = ids.filter((id) => !childOf.has(id));
  const build = (id, seen = new Set()) => {
    if (seen.has(id)) throw new Error(`dendrogram: ciclo en "${id}"`);
    seen.add(id);
    const ch = kids.get(id) || [];
    if (!ch.length) return { leaf: id, h: 0 };
    // Un solo hijo: el nodo no agrupa nada, pasa directo al hijo.
    if (ch.length === 1) return build(ch[0], seen);
    let node = build(ch[0], seen);
    for (let i = 1; i < ch.length; i++) {
      const r = build(ch[i], seen);
      node = { left: node, right: r, h: Math.max(h.get(id), node.h, r.h) };
    }
    return node;
  };
  if (!roots.length) throw new Error('dendrogram: no hay raíz (¿ciclo?)');
  let tree = build(roots[0]);
  for (let i = 1; i < roots.length; i++) {
    const r = build(roots[i]);
    tree = { left: tree, right: r, h: Math.max(tree.h, r.h) };
  }
  return tree;
}
