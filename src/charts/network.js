// Red (grafo): nodos y conexiones, con disposición a elección y determinista.
// El tamaño del nodo es su peso (o su grado ponderado); el color, su grupo.
// Cada disposición llena coordenadas propias; luego un mismo ajuste al área y
// una misma pasada contra encimados sirven a todas.
//
// Para un mapa ya calculado (`layout: "preset"`, MDS del espacio de productos):
// `hollow`/`filled` dibujan huecos los nodos de un campo o lista (una segunda
// codificación sin un segundo color); `edgeColor: "neutral"` (o un color) deja
// las aristas en una sola tinta, con `edgeOpacity`/`edgeWidth` fijos o por
// valor; `colors["a→b"]` fija una arista; `href` enlaza cada nodo; `stretch`
// estira x e y por separado; `minRadius` pone un piso al radio.
import { tipper } from '../tooltip.js';
import { el, g, tip, esc, linkWrap } from '../svg.js';
import { measure, truncate } from '../text.js';
import { makeFormat } from '../format.js';
import { colorMap } from '../theme.js';
import { ctx } from '../context.js';
import { ensureData, requireField, num, fieldsOf, fieldKind, PlotError } from '../data.js';
import { createFrame } from '../frame.js';

const pick = (fields, cands) => cands.find((c) => fields.includes(c));
const GOLDEN = 2.399963229728653;
const f1 = (v) => (Math.round(v * 10) / 10).toString();

/** Disposiciones disponibles (`layout`). `circle` es alias de `circular`. */
export const NETWORK_LAYOUTS = ['force', 'circular', 'radial', 'concentric', 'clusters', 'tree', 'grid'];
const ALIAS = { circle: 'circular', ring: 'circular', cluster: 'clusters', groups: 'clusters', hierarchy: 'tree', concentrico: 'concentric', arbol: 'tree', 'árbol': 'tree', grilla: 'grid', fuerzas: 'force', fixed: 'preset', fija: 'preset', posiciones: 'preset' };
export function layoutName(v) {
  const s = String(v ?? 'force').toLowerCase();
  const k = ALIAS[s] ?? s;
  // `preset` no calcula nada: usa las posiciones de `nodes` (por eso no está en la lista de disposiciones).
  return NETWORK_LAYOUTS.includes(k) || k === 'preset' ? k : 'force';
}

/** Prepara nodos y aristas a partir del spec. */
export function prepareNetwork(spec) {
  // Con posiciones dadas (`layout: "preset"`) las aristas son opcionales: una
  // tabla `nodes` con x, y basta (un mapa de puntos ya calculado: MDS, UMAP, Gephi).
  const preset = layoutName(spec.layout) === 'preset';
  const noEdges = preset && Array.isArray(spec.nodes) && spec.nodes.length && (spec.data === undefined || spec.data === null || (Array.isArray(spec.data) && !spec.data.length));
  const data = noEdges ? [] : ensureData(spec);
  const fields = fieldsOf(data);
  const from = spec.from ?? pick(fields, ['from', 'source', 'origen', 'desde']) ?? fields[0];
  const to = spec.to ?? pick(fields, ['to', 'target', 'destino', 'hasta']) ?? fields[1];
  if (!noEdges) {
    requireField(data, from, 'from');
    requireField(data, to, 'to');
  }
  const vf = spec.value ?? pick(fields, ['value', 'weight', 'peso', 'valor']) ?? fields.find((f) => f !== from && f !== to && fieldKind(data, f) === 'number');
  if (spec.value && !noEdges) requireField(data, vf, 'value');

  // Aristas: pares no dirigidos agregados (A–B y B–A se suman). `src`/`dst`
  // guardan el sentido de la primera fila (el color sale del origen).
  const emap = new Map();
  for (const r of data) {
    const a = r[from], b = r[to];
    if (a === null || a === undefined || b === null || b === undefined) continue;
    const s = String(a), t = String(b);
    if (s === t) continue;
    const w = vf ? num(r[vf]) : 1;
    if (!(w > 0)) continue;
    const key = s < t ? s + '\u0000' + t : t + '\u0000' + s;
    if (!emap.has(key)) emap.set(key, { s: s < t ? s : t, t: s < t ? t : s, src: s, dst: t, v: 0 });
    emap.get(key).v += w;
  }
  const edges = [...emap.values()];

  // Nodos: de la tabla `nodes` si viene; si no, de las aristas.
  const nodes = new Map();
  const add = (id) => { if (!nodes.has(id)) nodes.set(id, { id, label: id, group: null, size: null, deg: 0, wdeg: 0 }); return nodes.get(id); };
  if (Array.isArray(spec.nodes) && spec.nodes.length) {
    const nf = fieldsOf(spec.nodes);
    const idF = spec.nodeId ?? pick(nf, ['id', 'name', 'nombre', 'node', 'nodo']) ?? nf[0];
    const labF = spec.nodeLabel ?? pick(nf, ['label', 'etiqueta']) ?? idF;
    const grF = spec.group ?? pick(nf, ['group', 'grupo', 'type', 'tipo', 'category', 'categoria']);
    const szF = spec.size ?? pick(nf, ['size', 'value', 'valor', 'tamaño', 'weight']);
    const xF = spec.nodeX ?? pick(nf, ['x']);
    const yF = spec.nodeY ?? pick(nf, ['y']);
    if (!nf.includes(idF)) throw new PlotError(`El campo "${idF}" (nodeId) no existe en nodes.`, `Campos disponibles: ${nf.join(', ')}`);
    for (const r of spec.nodes) {
      if (r[idF] === null || r[idF] === undefined) continue;
      const n = add(String(r[idF]));
      n.row = r;
      if (labF && r[labF] !== undefined) n.label = String(r[labF]);
      if (grF && r[grF] !== undefined && r[grF] !== null) n.group = String(r[grF]);
      if (szF && Number.isFinite(num(r[szF]))) n.size = num(r[szF]);
      if (xF && yF && Number.isFinite(num(r[xF])) && Number.isFinite(num(r[yF]))) { n.fx = num(r[xF]); n.fy = num(r[yF]); }
    }
  }
  for (const e of edges) {
    const a = add(e.s), b = add(e.t);
    a.deg++; b.deg++; a.wdeg += e.v; b.wdeg += e.v;
  }
  const list = [...nodes.values()];
  // Sin aristas ni tamaño, todos pesan lo mismo.
  for (const n of list) n.w = n.size ?? (edges.length ? n.wdeg : 1);
  if (preset) {
    const missing = list.filter((n) => n.fx === undefined).map((n) => n.id);
    if (missing.length) {
      throw new PlotError(
        `layout: "preset" necesita x e y para cada nodo; faltan en ${missing.length}: ${missing.slice(0, 4).join(', ')}${missing.length > 4 ? '…' : ''}.`,
        'nodes: [{ id: "A", x: 0.2, y: 1.4 }, …] (o nodeX / nodeY con los nombres de tus campos)',
      );
    }
  }
  return { edges, nodes: list, byId: nodes, valueField: vf };
}

// Orden determinista: grupo, peso (mayor primero), id.
const byGroup = (a, b) => a.gi - b.gi || b.w - a.w || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const byWeight = (a, b) => b.w - a.w || a.gi - b.gi || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

// ── Disposiciones: cada una llena n.x, n.y en sus propias unidades ─────────

// ── Vecindad: grilla uniforme y árbol de cuadrantes (rendimiento) ─────────

/** Llama fn(p, q) para cada par a menos de `cell` en la grilla (3×3 celdas). */
function forNearPairs(nodes, X, Y, cell, fn) {
  const n = nodes.length;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of nodes) { if (p[X] < x0) x0 = p[X]; if (p[X] > x1) x1 = p[X]; if (p[Y] < y0) y0 = p[Y]; if (p[Y] > y1) y1 = p[Y]; }
  // Celdas en listas enlazadas sobre arreglos tipados: sin objetos por paso.
  cell = Math.max(cell, Math.sqrt(((x1 - x0 + 1) * (y1 - y0 + 1)) / 4e5));
  const W = Math.floor((x1 - x0) / cell) + 1, H = Math.floor((y1 - y0) / cell) + 1;
  const head = new Int32Array(W * H).fill(-1), next = new Int32Array(n), gx = new Int32Array(n), gy = new Int32Array(n);
  for (let i = n - 1; i >= 0; i--) {
    gx[i] = Math.floor((nodes[i][X] - x0) / cell); gy[i] = Math.floor((nodes[i][Y] - y0) / cell);
    const c = gy[i] * W + gx[i];
    next[i] = head[c]; head[c] = i;
  }
  for (let i = 0; i < n; i++) {
    for (let cy = Math.max(0, gy[i] - 1); cy <= Math.min(H - 1, gy[i] + 1); cy++)
      for (let cx = Math.max(0, gx[i] - 1); cx <= Math.min(W - 1, gx[i] + 1); cx++)
        for (let j = head[cy * W + cx]; j !== -1; j = next[j]) if (j > i) fn(nodes[i], nodes[j]);
  }
}

/** Separa nodos encimados (radio + `extra`), en las coordenadas X, Y. */
function collide(nodes, X, Y, extra, cell) {
  forNearPairs(nodes, X, Y, cell, (p, q) => {
    const dx = q[X] - p[X], dy = q[Y] - p[Y], min = p.r + q.r + extra, d2 = dx * dx + dy * dy;
    if (d2 < min * min) { const d = Math.sqrt(d2) || 1e-6, s = ((min - d) / d) * 0.5; p[X] -= dx * s; p[Y] -= dy * s; q[X] += dx * s; q[Y] += dy * s; }
  });
}

/** Repulsión Barnes–Hut: cada celda lejana actúa como una sola masa en su centroide. */
function repelBH(nodes, strength, minD2, theta = 0.9) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of nodes) { if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x; if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y; }
  const size = Math.max(x1 - x0, y1 - y0, 1e-3) * 1.0001;
  const mk = (x, y, s) => ({ x, y, s, m: 0, cx: 0, cy: 0, kids: null, pts: null });
  const root = mk(x0, y0, size);
  const insert = (q, p, depth) => {
    for (;;) {
      q.cx = (q.cx * q.m + p.x) / (q.m + 1); q.cy = (q.cy * q.m + p.y) / (q.m + 1); q.m++;
      if (!q.kids) {
        if (!q.pts) { q.pts = [p]; return; }
        if (depth > 24) { q.pts.push(p); return; } // puntos coincidentes
        const h = q.s / 2;
        q.kids = [mk(q.x, q.y, h), mk(q.x + h, q.y, h), mk(q.x, q.y + h, h), mk(q.x + h, q.y + h, h)];
        for (const o of q.pts) {
          const k = q.kids[(o.x >= q.x + h ? 1 : 0) + (o.y >= q.y + h ? 2 : 0)];
          k.cx = (k.cx * k.m + o.x) / (k.m + 1); k.cy = (k.cy * k.m + o.y) / (k.m + 1); k.m++;
          (k.pts ||= []).push(o);
        }
        q.pts = null;
      }
      const h = q.s / 2;
      q = q.kids[(p.x >= q.x + h ? 1 : 0) + (p.y >= q.y + h ? 2 : 0)];
      depth++;
    }
  };
  for (const p of nodes) insert(root, p, 0);
  const th2 = theta * theta;
  const stack = [];
  for (const p of nodes) {
    stack.length = 0;
    stack.push(root);
    while (stack.length) {
      const q = stack.pop();
      if (!q.m) continue;
      if (q.pts) {
        for (const o of q.pts) {
          if (o === p) continue;
          let dx = p.x - o.x, dy = p.y - o.y, d2 = dx * dx + dy * dy;
          if (d2 < 1e-6) { dx = ((p._i * 7 + o._i * 13) % 11) / 11 - 0.5; dy = ((p._i * 5 + o._i * 3) % 7) / 7 - 0.5; if (p._i < o._i) { dx = -dx; dy = -dy; } d2 = dx * dx + dy * dy; }
          const d = Math.sqrt(d2), f = -strength / Math.max(d2, minD2);
          p.vx += (dx / d) * f; p.vy += (dy / d) * f;
        }
        continue;
      }
      const dx = p.x - q.cx, dy = p.y - q.cy, d2 = dx * dx + dy * dy;
      if (q.s * q.s < th2 * d2) {
        const d = Math.sqrt(d2) || 1e-6, f = (-strength * q.m) / Math.max(d2, minD2);
        p.vx += (dx / d) * f; p.vy += (dy / d) * f;
      } else stack.push(q.kids[0], q.kids[1], q.kids[2], q.kids[3]);
    }
  }
}

/** Fuerzas (velocity Verlet simplificado, al estilo d3-force). Unidades ≈ px. */
function forceLayout(nodes, edges, byId, { iterations = 320, spacing = 40, pin = null, rotate = true, wide = true } = {}) {
  const n = nodes.length;
  // Posiciones iniciales en filotaxis (deterministas), agrupadas por grupo.
  [...nodes].sort(byGroup).forEach((nd, i) => {
    const r = spacing * 0.6 * Math.sqrt(i + 0.5), a = i * GOLDEN;
    nd.x = r * Math.cos(a); nd.y = r * Math.sin(a); nd.vx = 0; nd.vy = 0;
  });
  // Nodo en foco: parte y se queda en el centro; el resto se acomoda a su alrededor.
  if (pin) { const c = { x: pin.x, y: pin.y }; for (const nd of nodes) { nd.x -= c.x; nd.y -= c.y; } }
  const links = edges.map((e) => ({ a: byId.get(e.s), b: byId.get(e.t), v: e.v }));
  const maxV = Math.max(1, ...links.map((l) => l.v));
  let alpha = 1;
  const decay = 1 - Math.pow(0.001, 1 / iterations);
  const charge = -spacing * spacing * 0.9;
  const cell = 2 * Math.max(...nodes.map((q) => q.r)) + 3;
  nodes.forEach((q, i) => { q._i = i; });
  for (let it = 0; it < iterations; it++) {
    // Repulsión: exacta hasta ~150 nodos; Barnes–Hut (θ = 0,9) por encima.
    if (n > 150) repelBH(nodes, charge * alpha, spacing * 0.25);
    else
      for (let i = 0; i < n; i++) {
        const p = nodes[i];
        for (let j = i + 1; j < n; j++) {
          const q = nodes[j];
          let dx = q.x - p.x, dy = q.y - p.y;
          let d2 = dx * dx + dy * dy;
          if (d2 < 1e-6) { dx = ((i * 7 + j * 13) % 11) / 11 - 0.5; dy = ((i * 5 + j * 3) % 7) / 7 - 0.5; d2 = dx * dx + dy * dy; }
          const f = (charge * alpha) / Math.max(d2, spacing * 0.25);
          const d = Math.sqrt(d2);
          const fx = (dx / d) * f, fy = (dy / d) * f;
          p.vx += fx; p.vy += fy; q.vx -= fx; q.vy -= fy;
        }
      }
    // Resortes en las conexiones (más fuertes si el peso es mayor).
    for (const l of links) {
      const dx = l.b.x + l.b.vx - l.a.x - l.a.vx, dy = l.b.y + l.b.vy - l.a.y - l.a.vy;
      const d = Math.sqrt(dx * dx + dy * dy) || 1e-6;
      const target = spacing * (1.05 - 0.35 * Math.sqrt(l.v / maxV)) + (l.a.r + l.b.r) * 0.8;
      const k = (alpha * (0.35 + 0.65 * Math.sqrt(l.v / maxV))) / Math.max(1, Math.min(l.a.deg, l.b.deg));
      const f = ((d - target) / d) * k;
      const bias = l.a.deg / (l.a.deg + l.b.deg);
      l.b.vx -= dx * f * bias; l.b.vy -= dy * f * bias;
      l.a.vx += dx * f * (1 - bias); l.a.vy += dy * f * (1 - bias);
    }
    // Gravedad suave hacia el centro (mantiene juntos los componentes sueltos).
    for (const p of nodes) { p.vx -= p.x * 0.02 * alpha; p.vy -= p.y * 0.02 * alpha; }
    for (const p of nodes) { p.vx *= 0.6; p.vy *= 0.6; p.x += p.vx; p.y += p.vy; }
    if (pin) { pin.x = 0; pin.y = 0; pin.vx = 0; pin.vy = 0; }
    // Colisión por radio (grilla uniforme: solo pares vecinos).
    for (let pass = 0; pass < 2; pass++) collide(nodes, 'x', 'y', 3, cell);
    if (pin) { pin.x = 0; pin.y = 0; }
    alpha -= alpha * decay;
  }
  // Rota la red para que su eje principal siga el lado largo del área (sin foco).
  if (rotate && !pin) {
    const mx = nodes.reduce((a, q) => a + q.x, 0) / n, my = nodes.reduce((a, q) => a + q.y, 0) / n;
    let sxx = 0, syy = 0, sxy = 0;
    for (const q of nodes) { const dx = q.x - mx, dy = q.y - my; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
    let th = 0.5 * Math.atan2(2 * sxy, sxx - syy);
    if (!wide) th -= Math.PI / 2;
    const c = Math.cos(-th), si = Math.sin(-th);
    for (const q of nodes) { const dx = q.x - mx, dy = q.y - my; q.x = dx * c - dy * si; q.y = dx * si + dy * c; }
  }
}

/** Círculo ordenado por grupo y peso, con un hueco entre grupos. El foco va al centro. */
function circularLayout(nodes, { pin }) {
  const ring = nodes.filter((n) => n !== pin).sort(byGroup);
  const gaps = new Set(ring.map((n) => n.gi)).size > 1;
  const slots = [];
  ring.forEach((n, i) => { if (gaps && i > 0 && n.gi !== ring[i - 1].gi) slots.push(null); slots.push(n); });
  if (gaps && slots.length > 1) slots.push(null); // hueco entre el último y el primero
  const S = slots.length;
  slots.forEach((n, i) => {
    if (!n) return;
    const a = -Math.PI / 2 + (i / S) * Math.PI * 2;
    n.x = Math.cos(a); n.y = Math.sin(a); n.ring = true;
  });
  if (pin) { pin.x = 0; pin.y = 0; pin.ring = false; }
}

/**
 * Árbol de expansión por BFS desde `root`: hijos en orden de peso de la
 * conexión, luego grupo, peso e id. Devuelve hijos, profundidad y las aristas
 * del árbol; los nodos inalcanzables quedan fuera de `depth`.
 */
function spanningTree(nodes, edges, byId, root) {
  const adj = new Map(nodes.map((n) => [n.id, []]));
  for (const e of edges) { adj.get(e.s).push([e.t, e.v]); adj.get(e.t).push([e.s, e.v]); }
  for (const list of adj.values()) list.sort((a, b) => b[1] - a[1] || byGroup(byId.get(a[0]), byId.get(b[0])));
  const depth = new Map([[root.id, 0]]), children = new Map(nodes.map((n) => [n.id, []]));
  const treeEdges = new Set();
  const queue = [root.id];
  for (let qi = 0; qi < queue.length; qi++) {
    const id = queue[qi];
    for (const [nb] of adj.get(id)) {
      if (depth.has(nb)) continue;
      depth.set(nb, depth.get(id) + 1);
      children.get(id).push(nb);
      treeEdges.add(id < nb ? id + '\u0000' + nb : nb + '\u0000' + id);
      queue.push(nb);
    }
  }
  // Hojas numeradas en orden DFS; cada padre queda en el promedio de sus hijos.
  const pos = new Map();
  let leaf = 0;
  // Iterativo: una cadena larga (miles de niveles) desbordaría la pila.
  const stack = [[root.id, 0]];
  while (stack.length) {
    const top = stack[stack.length - 1];
    const ch = children.get(top[0]);
    if (!ch.length) { pos.set(top[0], leaf++); stack.pop(); continue; }
    if (top[1] < ch.length) { stack.push([ch[top[1]++], 0]); continue; }
    pos.set(top[0], ch.reduce((a, c) => a + pos.get(c), 0) / ch.length);
    stack.pop();
  }
  const maxDepth = Math.max(0, ...depth.values());
  const rest = nodes.filter((n) => !depth.has(n.id)).sort(byGroup);
  return { depth, pos, leaves: leaf, maxDepth, rest, treeEdges, children };
}

function treeRoot(nodes, pin) {
  return pin ?? [...nodes].sort((a, b) => b.wdeg - a.wdeg || b.w - a.w || (a.id < b.id ? -1 : 1))[0];
}

/**
 * Árbol radial: raíz al centro, hojas repartidas en ángulo y radio según la
 * profundidad. Cada anillo se abre lo justo para que sus nodos vecinos no se
 * pisen (unidades ≈ px).
 */
function radialLayout(nodes, edges, byId, { pin, gap }) {
  const root = treeRoot(nodes, pin);
  const T = spanningTree(nodes, edges, byId, root);
  const L = Math.max(1, T.leaves);
  const levels = [];
  for (const n of nodes) if (T.depth.has(n.id)) (levels[T.depth.get(n.id)] ||= []).push(n);
  const R = [0];
  const rmax = (list) => Math.max(0, ...(list || []).map((n) => n.r));
  for (let d = 1; d < levels.length; d++) {
    const list = levels[d].sort((a, b) => T.pos.get(a.id) - T.pos.get(b.id));
    const cap = (L * (2 * rmax(list) + gap)) / (2 * Math.PI);
    let need = 0;
    for (let i = 0; i < list.length; i++) {
      const p = list[i], q = list[(i + 1) % list.length];
      if (p === q) break;
      let da = ((T.pos.get(q.id) - T.pos.get(p.id)) * 2 * Math.PI) / L;
      if (da <= 0) da += 2 * Math.PI;
      need = Math.max(need, Math.min(cap, (p.r + q.r + gap) / Math.min(da, Math.PI)));
    }
    R[d] = Math.max(R[d - 1] + rmax(levels[d - 1]) + rmax(list) + gap * 3, need);
  }
  for (const n of nodes) {
    if (!T.depth.has(n.id)) continue;
    const a = -Math.PI / 2 + (2 * Math.PI * T.pos.get(n.id)) / L, rr = R[T.depth.get(n.id)];
    n.x = rr * Math.cos(a); n.y = rr * Math.sin(a);
  }
  // Inalcanzables: un anillo exterior.
  const Rout = R[R.length - 1] + rmax(levels[levels.length - 1]) + rmax(T.rest) + gap * 3;
  T.rest.forEach((n, i) => {
    const a = -Math.PI / 2 + (2 * Math.PI * (i + 0.5)) / T.rest.length;
    n.x = Rout * Math.cos(a); n.y = Rout * Math.sin(a);
  });
  return T;
}

/** Árbol plano: profundidad en un eje, hojas en el otro. */
function treeLayout(nodes, edges, byId, { pin, wide }) {
  const root = treeRoot(nodes, pin);
  const T = spanningTree(nodes, edges, byId, root);
  const L = Math.max(1, T.leaves);
  const put = (n, depth, along) => { if (wide) { n.x = depth; n.y = along; } else { n.x = along; n.y = depth; } };
  for (const n of nodes) if (T.depth.has(n.id)) put(n, T.depth.get(n.id), T.pos.get(n.id));
  T.rest.forEach((n, i) => put(n, T.maxDepth + 1, T.rest.length > 1 ? (i * (L - 1)) / (T.rest.length - 1) : (L - 1) / 2));
  return T;
}

/** Anillos por peso: el mayor (o el foco) al centro; dentro de cada anillo, por grupo. */
function concentricLayout(nodes, { pin, gap }) {
  const order = [...nodes].sort(byWeight);
  if (pin) { order.splice(order.indexOf(pin), 1); order.unshift(pin); }
  const rings = [[order[0]]];
  let R = 0, i = 1;
  while (i < order.length) {
    const prev = rings[rings.length - 1];
    const rPrev = Math.max(...prev.map((n) => n.r));
    const rHere = order[i].r; // el mayor del anillo (vienen ordenados)
    R += rPrev + rHere + gap * 3;
    const room = 2 * Math.PI * R;
    const ring = [];
    let used = 0;
    while (i < order.length && (ring.length === 0 || used + 2 * order[i].r + gap <= room)) { used += 2 * order[i].r + gap; ring.push(order[i++]); }
    ring.R = R;
    rings.push(ring);
  }
  order[0].x = 0; order[0].y = 0;
  rings.slice(1).forEach((ring, k) => {
    ring.sort(byGroup);
    const off = k % 2 ? Math.PI / ring.length : 0; // anillos alternados, para no alinear radios
    ring.forEach((n, j) => { const a = -Math.PI / 2 + off + (2 * Math.PI * j) / ring.length; n.x = ring.R * Math.cos(a); n.y = ring.R * Math.sin(a); });
  });
}

/** Un racimo por grupo (espiral de girasol), con los centros en una elipse. */
function clustersLayout(nodes, groupsCount, { pin, gap, aspect }) {
  const by = new Map();
  for (const n of [...nodes].sort(byGroup)) { if (n === pin) continue; if (!by.has(n.gi)) by.set(n.gi, []); by.get(n.gi).push(n); }
  const cl = [...by.entries()].map(([gi, list]) => {
    const c = 2 * Math.sqrt(list.reduce((a, n) => a + n.r * n.r, 0) / list.length) + gap;
    const offs = list.map((n, i) => [c * Math.sqrt(i) * Math.cos(i * GOLDEN), c * Math.sqrt(i) * Math.sin(i * GOLDEN)]);
    const rad = Math.max(...list.map((n, i) => Math.hypot(...offs[i]) + n.r));
    return { gi, list, offs, rad };
  });
  const spacing = gap * 3;
  if (cl.length === 1) {
    cl[0].cx = 0; cl[0].cy = 0;
  } else {
    // Cada grupo ocupa en la circunferencia un arco ∝ su diámetro (∝ √cantidad).
    const total = cl.reduce((a, c) => a + 2 * c.rad + spacing, 0);
    let R = total / (2 * Math.PI);
    // Con pocos grupos, el círculo debe al menos separar a los vecinos.
    const need = Math.max(...cl.map((c) => c.rad)) * (cl.length === 2 ? 1.05 : 1) + spacing / 2 + (pin ? pin.r * 2 : 0);
    R = Math.max(R, need);
    let acc = 0;
    for (const c of cl) {
      const a = -Math.PI / 2 + (2 * Math.PI * (acc + c.rad + spacing / 2)) / total;
      acc += 2 * c.rad + spacing;
      c.cx = R * Math.cos(a) * aspect; c.cy = R * Math.sin(a);
    }
  }
  for (const c of cl) c.list.forEach((n, i) => { n.x = c.cx + c.offs[i][0]; n.y = c.cy + c.offs[i][1]; });
  if (pin) { pin.x = 0; pin.y = 0; }
  return groupsCount;
}

/** Grilla ordenada por grupo y peso; el foco, en la celda central. */
function gridLayout(nodes, { pin, aw, ah }) {
  const n = nodes.length;
  const cols = Math.max(1, Math.ceil(Math.sqrt((n * aw) / Math.max(1, ah))));
  const rows = Math.ceil(n / cols);
  const order = nodes.filter((q) => q !== pin).sort(byGroup);
  if (pin) order.splice(Math.min(order.length, Math.floor(rows / 2) * cols + Math.floor(cols / 2)), 0, pin);
  order.forEach((q, i) => { q.x = i % cols; q.y = Math.floor(i / cols); });
  return { cols, rows };
}

// ── Ajuste al área (común a todas) ─────────────────────────────────────────

function fitToArea(nodes, area, { pad, lim, center, withR }) {
  const aw = Math.max(10, area.w - pad.l - pad.r), ah = Math.max(10, area.h - pad.t - pad.b);
  const ox = area.x + pad.l, oy = area.y + pad.t;
  const ext = withR ? (n) => n.r : () => 0;
  const limit = (sx, sy) => {
    if (!Number.isFinite(sx)) sx = Number.isFinite(sy) ? sy : 1;
    if (!Number.isFinite(sy)) sy = sx;
    if (sx / sy > lim) sx = sy * lim; else if (sy / sx > lim) sy = sx * lim;
    return [sx, sy];
  };
  if (center) {
    // Escala simétrica alrededor del origen (el foco queda en el centro exacto).
    const ex = Math.max(...nodes.map((n) => Math.abs(n.x) + ext(n))), ey = Math.max(...nodes.map((n) => Math.abs(n.y) + ext(n)));
    const [fx, fy] = limit(ex > 1e-9 ? aw / 2 / ex : Infinity, ey > 1e-9 ? ah / 2 / ey : Infinity);
    for (const n of nodes) { n.px = ox + aw / 2 + n.x * fx; n.py = oy + ah / 2 + n.y * fy; }
    return [fx, fy];
  }
  const x0 = Math.min(...nodes.map((n) => n.x - ext(n))), x1 = Math.max(...nodes.map((n) => n.x + ext(n)));
  const y0 = Math.min(...nodes.map((n) => n.y - ext(n))), y1 = Math.max(...nodes.map((n) => n.y + ext(n)));
  const [sx, sy] = limit(x1 - x0 > 1e-9 ? aw / (x1 - x0) : Infinity, y1 - y0 > 1e-9 ? ah / (y1 - y0) : Infinity);
  const bx = ox + (aw - (x1 - x0) * sx) / 2, by = oy + (ah - (y1 - y0) * sy) / 2;
  for (const n of nodes) { n.px = bx + (n.x - x0) * sx; n.py = by + (n.y - y0) * sy; }
  return [sx, sy];
}

/** Achica los radios si la disposición geométrica deja nodos encimados. */
function shrinkToFit(nodes) {
  let k = 1;
  const cell = 2 * Math.max(...nodes.map((q) => q.r)) + 2;
  forNearPairs(nodes, 'px', 'py', cell, (p, q) => {
    const d = Math.hypot(q.px - p.px, q.py - p.py);
    if (d < (p.r + q.r) * k + 1.5) k = Math.max(0.35, (d - 1.5) / (p.r + q.r));
  });
  if (k < 1) for (const n of nodes) n.r = Math.max(1.5, n.r * k);
}

function separate(nodes, area, passes = 6) {
  const cell = 2 * Math.max(...nodes.map((q) => q.r)) + 2;
  for (let pass = 0; pass < passes; pass++) collide(nodes, 'px', 'py', 1.5, cell);
  for (const n of nodes) {
    n.px = Math.max(area.x + n.r + 1, Math.min(area.x + area.w - n.r - 1, n.px));
    n.py = Math.max(area.y + n.r + 1, Math.min(area.y + area.h - n.r - 1, n.py));
  }
}

// ── Etiquetas ──────────────────────────────────────────────────────────────

const hitsCircle = (b, c) => {
  const x = Math.max(b[0], Math.min(c.px, b[2])), y = Math.max(b[1], Math.min(c.py, b[3]));
  const dx = c.px - x, dy = c.py - y;
  return dx * dx + dy * dy < (c.r + 0.5) * (c.r + 0.5);
};
const hitsBox = (a, b) => !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3]);

export function network(spec, theme) {
  const locale = spec.locale || 'es';
  const en = String(locale).startsWith('en');
  const { edges, nodes, byId, valueField } = prepareNetwork(spec);
  if (!nodes.length) throw new PlotError('La red no tiene conexiones válidas.', 'Entrega filas con { from, to, value }.');
  const layout = layoutName(spec.layout);

  // Grupos en orden de peso total (color estable por entidad).
  const gtot = new Map();
  for (const n of nodes) { const k = n.group ?? ''; gtot.set(k, (gtot.get(k) || 0) + n.w); }
  const groups = [...gtot.keys()].sort((a, b) => gtot.get(b) - gtot.get(a) || (a < b ? -1 : a > b ? 1 : 0));
  for (const n of nodes) n.gi = groups.indexOf(n.group ?? '');
  const hasGroups = groups.length > 1 || (groups.length === 1 && groups[0] !== '');
  const cmap = colorMap(groups, theme, spec.colors);
  const colorOf = (n) => (spec.colors && spec.colors[n.id]) || (hasGroups ? cmap.get(n.group ?? '') : theme.categorical[0]);
  const fmt = makeFormat(spec.format, locale, nodes.map((n) => n.w));
  const fmtE = makeFormat(spec.format, locale, edges.map((e) => e.v));

  const legend = hasGroups && spec.legend !== false ? groups.map((k) => ({ label: k || (en ? 'No group' : 'Sin grupo'), color: cmap.get(k) })) : [];
  const W = spec.width || 720;
  // El círculo rotula hacia afuera en todas direcciones: con muchos nodos pide más alto.
  const tall = layout === 'circular' && nodes.length > 30;
  const frame = createFrame(spec, theme, { height: W < 560 ? Math.round(W * 1.05 + 150) : tall ? 600 : 520 });
  const area = frame.layout(legend);
  const wide = area.w >= area.h;

  // Radios: área ∝ peso, de 2,5 px hasta un máximo que depende del espacio por nodo (≤ 30).
  const maxW = Math.max(...nodes.map((n) => n.w), 1e-9);
  const rMax = spec.maxRadius ?? Math.max(8, Math.min(30, Math.sqrt((area.w * area.h) / nodes.length) * 0.32));
  const rMin = Number.isFinite(spec.minRadius) && spec.minRadius > 0 ? Math.min(spec.minRadius, rMax) : Math.min(2.5, rMax / 2);
  // En anillos concéntricos los mayores van juntos al centro: algo más chicos, para que se lean los anillos.
  const rTop = layout === 'concentric' && spec.maxRadius === undefined ? rMax * 0.75 : rMax;
  for (const n of nodes) { n.r = Math.max(rMin, rTop * Math.sqrt(Math.max(0, n.w) / maxW)); n.r0 = n.r; n.ring = false; }

  // Foco (clic en un nodo): va al centro y se destacan sus vecinos, con nombre.
  const focusNode = spec.focus !== undefined && spec.focus !== null ? byId.get(String([].concat(spec.focus)[0])) ?? null : null;
  // Un `highlight` que no existe en la red se ignora (si no, todo quedaría atenuado).
  const hlIds = spec.highlight === undefined || spec.highlight === null ? [] : [].concat(spec.highlight).map(String).filter((id) => byId.has(id));
  const hl = focusNode ? new Set([focusNode.id]) : hlIds.length ? new Set(hlIds) : null;
  const near = new Set();
  if (hl) { for (const id of hl) near.add(id); for (const e of edges) { if (hl.has(e.s)) near.add(e.t); if (hl.has(e.t)) near.add(e.s); } }
  const on = (n) => !hl || near.has(n.id);
  // `hollow` / `filled`: un campo de `nodes` o una lista de ids.
  const flag = (opt, n) => (Array.isArray(opt) ? opt.map(String).includes(n.id) : !!(n.row && n.row[opt]));
  const hasHollow = (spec.hollow !== undefined && spec.hollow !== null && spec.hollow !== false) || (spec.filled !== undefined && spec.filled !== null && spec.filled !== false);
  const isHollow = (n) => (!hasHollow ? false : spec.hollow !== undefined && spec.hollow !== null && spec.hollow !== false ? flag(spec.hollow, n) : !flag(spec.filled, n));

  // Etiquetas candidatas.
  const labelSize = (theme.type?.label ?? 12) - 0.5;
  const labelPx = labelSize * ctx.textScale;
  let cand;
  if (Array.isArray(spec.labels)) { const s = new Set(spec.labels.map(String)); cand = nodes.filter((n) => s.has(n.id) || s.has(n.label)); }
  else if (spec.labels === false) cand = [];
  else if (typeof spec.labels === 'number') cand = [...nodes].sort(byWeight).slice(0, Math.max(0, spec.labels));
  else if (spec.labels === true || nodes.length <= 14 || layout === 'circular' || layout === 'grid') cand = [...nodes];
  else {
    const big = nodes.filter((n) => n.r0 >= 0.45 * rTop);
    cand = big.length >= 8 ? big : [...nodes].sort(byWeight).slice(0, 8);
  }
  if (focusNode) { const s = new Set(cand); for (const id of near) s.add(byId.get(id)); cand = [...s]; }

  // ── Disposición + ajuste al área ──────────────────────────────────────────
  const gap = Math.max(3, rMax * 0.25);
  const pad0 = rMax + 4;
  let pad = { l: pad0, r: pad0, t: pad0, b: pad0 }, lim = 2.4, center = !!focusNode, withR = false, geometric = true, tree = null;
  let circ = null;
  if (layout === 'force') {
    const spacing = Math.max(26, Math.sqrt((area.w * area.h) / nodes.length) * 0.75);
    forceLayout(nodes, edges, byId, { spacing, pin: focusNode, wide, iterations: +spec.iterations > 0 ? Math.min(2000, Math.round(+spec.iterations)) : nodes.length > 5000 ? 80 : nodes.length > 1000 ? 140 : nodes.length > 200 ? 200 : 320 });
    withR = true; geometric = false;
  } else if (layout === 'circular') {
    circularLayout(nodes, { pin: focusNode });
    const ringLab = cand.filter((n) => n.ring);
    const cap = Math.min(130, Math.min(area.w, area.h) * (area.w < 480 ? 0.17 : nodes.length > 40 ? 0.19 : 0.24));
    const lw = Math.min(cap, Math.max(0, ...ringLab.map((n) => measure(n.label, labelSize, 500))));
    const rGuess = Math.min(rMax, 12);
    const p = (ringLab.length ? lw + 6 : 0) + rGuess + 2;
    pad = { l: p, r: p, t: p, b: p };
    circ = { lw: Math.max(24, lw) };
    lim = 1.5; center = true;
  } else if (layout === 'radial') {
    tree = radialLayout(nodes, edges, byId, { pin: focusNode, gap });
    lim = 1.4; center = true;
  } else if (layout === 'concentric') {
    concentricLayout(nodes, { pin: focusNode, gap });
    lim = 1.35; center = true;
  } else if (layout === 'clusters') {
    const aspect = Math.max(1, Math.min(1.9, area.w / area.h));
    clustersLayout(nodes, groups.length, { pin: focusNode, gap, aspect });
    lim = 1.15; withR = true; geometric = false;
  } else if (layout === 'tree') {
    tree = treeLayout(nodes, edges, byId, { pin: focusNode, wide });
    lim = Infinity; center = false;
    if (wide) {
      // Las hojas del último nivel rotulan a la derecha: se les deja espacio.
      const last = cand.filter((n) => n.x === Math.max(...nodes.map((q) => q.x)));
      const lw = Math.min(area.w * 0.18, Math.max(0, ...last.map((n) => measure(n.label, labelSize, 500))));
      pad = { ...pad, r: pad0 + (lw ? lw + 6 : 0) };
    } else pad = { ...pad, b: pad0 + labelPx + 4 };
  } else if (layout === 'preset') {
    // Posiciones dadas, en sus unidades: la misma escala en x e y (no se deforma
    // la nube) y y hacia abajo como en SVG, salvo `flipY: true` (y hacia arriba).
    for (const n of nodes) { n.x = n.fx; n.y = spec.flipY ? -n.fy : n.fy; }
    // `stretch`: posiciones ya normalizadas por eje (0–1): cada eje llena el área.
    // Sin `withR`: las posiciones vienen en sus unidades (0–1 de un MDS, ±10 de
    // un UMAP) y el radio en px; sumarlos encogía la nube. El margen `pad` ya
    // reserva el radio mayor.
    lim = spec.stretch === true ? Infinity : 1; center = false; withR = false; geometric = false;
  } else if (layout === 'grid') {
    gridLayout(nodes, { pin: focusNode, aw: area.w, ah: area.h });
    lim = Infinity; center = false;
    // Nombres centrados bajo cada nodo: los de los bordes necesitan medio ancho de margen.
    const half = Math.min(area.w * 0.12, Math.max(0, ...cand.map((n) => measure(n.label, labelSize, 500) / 2)));
    pad = { l: Math.max(pad0, half + 2), r: Math.max(pad0, half + 2), t: pad0, b: pad0 + labelPx + 2 };
  }
  fitToArea(nodes, area, { pad, lim, center, withR });
  if (geometric) shrinkToFit(nodes);
  // Con posiciones dadas sólo se despegan los nodos encimados: el lugar es el dato.
  separate(nodes, area, layout === 'preset' ? 1 : layout === 'circular' || layout === 'grid' || layout === 'tree' ? 2 : 6);
  const cx = area.x + pad.l + (area.w - pad.l - pad.r) / 2, cy = area.y + pad.t + (area.h - pad.t - pad.b) / 2;
  const body = [];

  // ── Conexiones: curvas del color del nodo de origen, ancho ∝ √peso ───────
  const maxE = Math.max(...edges.map((e) => e.v), 1e-9);
  const baseOp = edges.length > 150 ? 0.3 : 0.5;
  // `edgeColor`: "source" (por omisión), "neutral" (la tinta tenue del tema) o un color.
  const ec = spec.edgeColor;
  const edgeInk = ec === undefined || ec === null || ec === 'source' ? null : ec === 'neutral' ? theme.muted : String(ec);
  const pinE = (e) => spec.colors && (spec.colors[`${e.src}→${e.dst}`] ?? spec.colors[`${e.dst}→${e.src}`]);
  // `edgeOpacity` / `edgeWidth`: un número fijo, o [mín, máx] según el valor (√ para el ancho).
  const pair = (v) => Array.isArray(v) && v.length === 2 && v.every(Number.isFinite);
  const eOp = spec.edgeOpacity, eW = spec.edgeWidth;
  // Curvatura al estilo ECharts (0,3); en la grilla, más suave para no salirse de las filas.
  const curv = spec.curveness !== undefined && spec.curveness !== null && spec.curveness !== '' && Number.isFinite(+spec.curveness) ? +spec.curveness : layout === 'grid' ? 0.18 : layout === 'preset' ? 0.15 : 0.3;
  const P = (x, y) => `${f1(x)},${f1(y)}`;
  const linkG = [];
  // Las aristas fijadas con `colors["a→b"]` van encima.
  // `edgeTip: false` (o `tooltip: false`): aristas sin tooltip; en una red de
  // cientos de aristas el texto repetido pesa más que el dibujo.
  const edgeTips = spec.edgeTip !== false && spec.tooltip !== false;
  for (const e of [...edges].sort((a, b) => (!!pinE(a) - !!pinE(b)) || a.v - b.v)) {
    const a = byId.get(e.src), b = byId.get(e.dst);
    const w = Number.isFinite(eW) ? eW : pair(eW) ? eW[0] + (eW[1] - eW[0]) * Math.sqrt(e.v / maxE) : valueField ? 0.6 + 2.4 * Math.sqrt(e.v / maxE) : 1;
    const isTree = tree ? tree.treeEdges.has(e.s + '\u0000' + e.t) : true;
    let d;
    if (layout === 'tree' && isTree) {
      // Conector de árbol: curva en S entre padre e hijo.
      if (wide) { const mx = (a.px + b.px) / 2; d = `M${P(a.px, a.py)}C${P(mx, a.py)} ${P(mx, b.py)} ${P(b.px, b.py)}`; }
      else { const my = (a.py + b.py) / 2; d = `M${P(a.px, a.py)}C${P(a.px, my)} ${P(b.px, my)} ${P(b.px, b.py)}`; }
    } else if (layout === 'circular' && a.ring && b.ring) {
      const mx = (a.px + b.px) / 2, my = (a.py + b.py) / 2, k = Math.min(0.9, (0.55 * curv) / 0.3);
      d = `M${P(a.px, a.py)}Q${P(mx + (cx - mx) * k, my + (cy - my) * k)} ${P(b.px, b.py)}`;
    } else if (curv === 0) {
      d = `M${P(a.px, a.py)}L${P(b.px, b.py)}`;
    } else {
      const dx = b.px - a.px, dy = b.py - a.py, len = Math.hypot(dx, dy) || 1;
      const bend = curv * len * (layout === 'radial' && isTree ? 0.35 : 1); // radios del árbol, casi rectos
      d = `M${P(a.px, a.py)}Q${P((a.px + b.px) / 2 - (dy / len) * bend, (a.py + b.py) / 2 + (dx / len) * bend)} ${P(b.px, b.py)}`;
    }
    const active = hl ? hl.has(e.s) || hl.has(e.t) : true;
    const own = Number.isFinite(eOp) ? eOp : pair(eOp) ? eOp[0] + (eOp[1] - eOp[0]) * (e.v / maxE) : null;
    const op = hl ? (active ? 0.8 : 0.06) : !isTree ? 0.15 : own ?? baseOp;
    const sw = hl && active ? Math.max(1.2, w) : w;
    // Lo común (relleno, extremos, opacidad y ancho base) va en el <g>; cada arista lleva solo lo propio.
    linkG.push(el('path', {
      class: 'pa-m', d, stroke: hl && !active ? theme.muted : pinE(e) || edgeInk || colorOf(a),
      strokeOpacity: op === baseOp ? undefined : op, strokeWidth: sw === 1 ? undefined : sw,
      'data-s': e.src, 'data-t': e.dst,
      'data-tip': edgeTips ? tip(`${a.label} — ${b.label}`, fmtE(e.v)) : undefined,
    }));
  }
  const links = g({ class: 'pa-links', fill: 'none', strokeLinecap: 'round', strokeOpacity: baseOp, strokeWidth: 1 }, linkG);

  // ── Nodos: grandes debajo, chicos encima ──────────────────────────────────
  const ring = nodes.length > 60 ? 0 : 0.75;
  const nodeG = [];
  const TN = tipper(spec, null, locale);
  const nodeRows = new Map(nodes.filter((n) => n.row).map((n) => [String(n.id), [n.row]]));
  for (const n of [...nodes].sort((a, b) => (on(a) - on(b)) || b.r - a.r || (a.id < b.id ? -1 : 1))) {
    const lines = [n.label];
    if (hasGroups && n.group) lines.push(n.group);
    lines.push(`${en ? 'Connections' : 'Conexiones'}: ${n.deg}`);
    lines.push(`${n.size !== null ? (en ? 'Size' : 'Tamaño') : en ? 'Weighted degree' : 'Grado ponderado'}: ${fmt(n.w)}`);
    const isF = focusNode && n.id === focusNode.id;
    const tipN = TN(nodeRows.get(String(n.id)) || [], ...lines);
    const href = spec.href && n.row ? n.row[spec.href] : undefined;
    // Hueco: el color en el borde y el fondo adentro (apagado si queda fuera del foco).
    const circle = isHollow(n)
      ? el('circle', {
        class: 'pa-m', cx: n.px, cy: n.py, r: Math.max(1.5, n.r - 0.75), fill: theme.surface,
        stroke: isF ? theme.ink : on(n) ? colorOf(n) : theme.dim, strokeWidth: isF ? 2.5 : n.r < 4 ? 1 : 1.5,
        'data-tip': tipN, 'data-node': n.id, style: 'cursor:pointer',
      })
      : el('circle', {
        class: 'pa-m', cx: n.px, cy: n.py, r: n.r, fill: on(n) ? colorOf(n) : theme.dim,
        stroke: isF ? theme.ink : ring ? theme.surface : undefined, strokeWidth: isF ? 2.5 : ring || undefined,
        'data-tip': tipN, 'data-node': n.id, style: 'cursor:pointer',
      });
    nodeG.push(linkWrap(href, circle));
  }
  const nodesSvg = g({ class: 'pa-nodes' }, nodeG);

  // ── Etiquetas: tinta con halo, sin choques con otras etiquetas ni nodos ──
  const prio = (a, b) => (focusNode ? (b === focusNode) - (a === focusNode) : 0) || (hl ? hl.has(b.id) - hl.has(a.id) : 0) || (hasHollow ? isHollow(a) - isHollow(b) : 0) || byWeight(a, b);
  const lbls = cand.filter((n) => on(n) || hl?.has(n.id)).sort(prio);
  const placed = [];
  const topIds = new Set([...nodes].sort(byWeight).slice(0, 3).map((n) => n.id));
  const angles = []; // etiquetas radiales ya puestas: [ángulo, medio alto angular]
  const labG = [];
  const h = labelPx + 1;
  // `labelWidth`: el ancho máximo de un rótulo en px (150 por omisión).
  const labelMax = Number.isFinite(+spec.labelWidth) && spec.labelWidth !== null && +spec.labelWidth > 0 ? +spec.labelWidth : 150;
  const inArea = (b) => b[0] >= area.x - 2 && b[2] <= area.x + area.w + 2 && b[1] >= area.y - 6 && b[3] <= area.y + area.h + 6;
  for (const n of lbls) {
    const isF = focusNode && n === focusNode;
    // Con huecos, los rellenos se nombran primero y los huecos en tinta tenue.
    const quiet = hasHollow && isHollow(n) && !isF;
    const weight = isF ? 600 : quiet ? 400 : 500;
    const attrs = { fill: quiet ? theme.muted : theme.ink, fontSize: labelSize, fontWeight: weight, stroke: theme.surface, strokeWidth: 2, paintOrder: 'stroke', strokeLinejoin: 'round', 'data-node': n.id };
    if (circ && n.ring) {
      // En el círculo: radial hacia afuera, girada; a la izquierda, volteada para leerse.
      const a = Math.atan2(n.py - cy, n.px - cx), rr = Math.hypot(n.px - cx, n.py - cy) + n.r + 5;
      const half = (h * 0.5 + 0.5) / rr;
      if (angles.some(([b, hb]) => { let dA = Math.abs(a - b) % (2 * Math.PI); if (dA > Math.PI) dA = 2 * Math.PI - dA; return dA < half + hb; })) continue;
      angles.push([a, half]);
      const label = truncate(n.label, circ.lw, labelSize, weight);
      const lx = n.px + Math.cos(a) * (n.r + 5), ly = n.py + Math.sin(a) * (n.r + 5);
      const flip = Math.cos(a) < 0;
      const deg = ((a * 180) / Math.PI + (flip ? 180 : 0));
      labG.push(el('text', { x: lx, y: ly, dy: '0.35em', textAnchor: flip ? 'end' : 'start', transform: `rotate(${f1(deg)} ${f1(lx)} ${f1(ly)})`, ...attrs }, esc(label)));
      continue;
    }
    const label = truncate(n.label, labelMax, labelSize, weight);
    const w = measure(label, labelSize, weight);
    const cands = [
      [n.px + n.r + 5, n.py + labelPx * 0.35, 'start'],
      [n.px - n.r - 5, n.py + labelPx * 0.35, 'end'],
      [n.px, n.py - n.r - 4, 'middle'],
      [n.px, n.py + n.r + labelPx + 1, 'middle'],
      [n.px + n.r * 0.7 + 4, n.py - n.r * 0.7 - 2, 'start'],
      [n.px - n.r * 0.7 - 4, n.py - n.r * 0.7 - 2, 'end'],
      [n.px + n.r * 0.7 + 4, n.py + n.r * 0.7 + labelPx * 0.8, 'start'],
      [n.px - n.r * 0.7 - 4, n.py + n.r * 0.7 + labelPx * 0.8, 'end'],
    ];
    // Árbol horizontal: a los nodos con hijos, el nombre arriba o abajo (a la derecha salen sus conectores).
    if (layout === 'tree' && wide && tree.children.get(n.id)?.length) cands.unshift(cands[2], cands[3]);
    // Grilla: el nombre bajo el nodo, centrado en su celda.
    if (layout === 'grid') cands.unshift(cands[3]);
    let done = false, fallback = null;
    // Los tres mayores (y el foco) pueden, en segunda vuelta, pisar nodos chicos: el halo los mantiene legibles.
    const tries = isF || topIds.has(n.id) ? [0, 0.35 * rTop] : [0];
    for (const minR of tries) {
      for (const [lx, ly, anchor] of cands) {
        const bx0 = anchor === 'start' ? lx : anchor === 'end' ? lx - w : lx - w / 2;
        const box = [bx0 - 1, ly - labelPx * 0.85, bx0 + w + 1, ly + labelPx * 0.25];
        if (!inArea(box)) continue;
        if (!fallback) fallback = [lx, ly, anchor, box];
        if (placed.some((b) => hitsBox(box, b))) continue;
        if (nodes.some((q) => q !== n && q.r >= minR && hitsCircle(box, q))) continue;
        placed.push(box);
        labG.push(el('text', { x: lx, y: ly, textAnchor: anchor, ...attrs }, esc(label)));
        done = true;
        break;
      }
      if (done) break;
    }
    // El nodo en foco siempre lleva su nombre.
    if (!done && isF && fallback) {
      placed.push(fallback[3]);
      labG.push(el('text', { x: fallback[0], y: fallback[1], textAnchor: fallback[2], ...attrs }, esc(label)));
    }
  }
  const labels = g({ class: 'pa-labels' }, labG);
  body.push(g({ class: 'pa-net', 'data-layout': layout }, [links, nodesSvg, labels]));

  const top = [...nodes].sort((a, b) => b.deg - a.deg || b.w - a.w).slice(0, 3);
  const desc = en
    ? `Network of ${nodes.length} nodes and ${edges.length} connections. Most connected: ${top.map((n) => `${n.label} (${n.deg})`).join(', ')}.`
    : `Red de ${nodes.length} nodos y ${edges.length} conexiones. Más conectados: ${top.map((n) => `${n.label} (${n.deg})`).join(', ')}.`;
  return frame.finish(body, { desc, type: 'network' });
}
