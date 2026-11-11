// Diagrama de flujo: nodos y conexiones con capas automáticas (Sugiyama
// simplificado), carriles opcionales por unidad, formas por tipo y
// conectores ortogonales con esquinas suaves que no atraviesan nodos.
import { el, g, text, tip } from '../svg.js';
import { measure, wrap } from '../text.js';
import { colorMap, readable, textOn, mix } from '../theme.js';
import { ensureData, uniq, PlotError } from '../data.js';
import { createFrame, hash } from '../frame.js';
import { esEn } from '../i18n.js';

const T = (en, es, locale) => esEn(locale, es, en);
const FS = 12.5, LH = 16, EDGE_FS = 11;

export function flowchart(spec, theme) {
  const locale = spec.locale || 'es';
  const en = String(locale).startsWith('en');

  // ── Entrada ───────────────────────────────────────────────────────────────
  const edgeRows = spec.edges ? ensureData({ data: spec.edges }) : spec.data ? ensureData(spec) : [];
  const ff = spec.from ?? (edgeRows[0] && ('from' in edgeRows[0] ? 'from' : 'source' in edgeRows[0] ? 'source' : 'from'));
  const tf = spec.to ?? (edgeRows[0] && ('to' in edgeRows[0] ? 'to' : 'target' in edgeRows[0] ? 'target' : 'to'));
  const lf = spec.edgeLabel ?? 'label';
  const nodeRows = spec.nodes ? ensureData({ data: spec.nodes }) : [];
  const idF = spec.id ?? 'id';
  const nodes = new Map();
  for (const r of nodeRows) {
    const id = String(r[idF] ?? r.label);
    nodes.set(id, { id, label: String(r.label ?? r.name ?? id), type: String(r.type || 'process').toLowerCase(), lane: r.lane ?? r[spec.lane] ?? null, group: r.group ?? r[spec.group] ?? null, detail: r.detail ?? r.description ?? '' });
  }
  const edges = [];
  for (const r of edgeRows) {
    const a = r[ff], b = r[tf];
    if (a === undefined || b === undefined || a === null || b === null) continue;
    for (const id of [String(a), String(b)]) if (!nodes.has(id)) nodes.set(id, { id, label: id, type: 'process', lane: null, group: null, detail: '' });
    edges.push({ s: String(a), t: String(b), label: r[lf] != null ? String(r[lf]) : '' });
  }
  if (!nodes.size) throw new PlotError(T('The flow chart has no nodes.', 'El diagrama de flujo no tiene nodos.', locale), T('Pass `nodes: [{ id, label, type }]` and `data: [{ from, to }]`.', 'Entrega `nodes: [{ id, label, type }]` y `data: [{ from, to }]`.', locale));
  const N = [...nodes.values()];
  const out = new Map(N.map((n) => [n.id, []])), inc = new Map(N.map((n) => [n.id, []]));
  for (const e of edges) { out.get(e.s).push(e); inc.get(e.t).push(e); }

  // ── Ciclos: DFS marca aristas de retorno ─────────────────────────────────
  const state = new Map();
  const roots = N.filter((n) => !inc.get(n.id).length);
  const visit = (id) => {
    state.set(id, 1);
    for (const e of out.get(id)) {
      const st = state.get(e.t);
      if (st === 1) e.back = true;
      else if (!st) visit(e.t);
    }
    state.set(id, 2);
  };
  for (const n of [...roots, ...N]) if (!state.get(n.id)) visit(n.id);
  const fwd = edges.filter((e) => !e.back && e.s !== e.t);

  // ── Capas: camino más largo ──────────────────────────────────────────────
  const layer = new Map(N.map((n) => [n.id, 0]));
  for (let it = 0; it < N.length; it++) {
    let ch = false;
    for (const e of fwd) if (layer.get(e.t) < layer.get(e.s) + 1) { layer.set(e.t, layer.get(e.s) + 1); ch = true; }
    if (!ch) break;
  }
  // Los nodos sin entradas bajan junto a su primer sucesor (más compacto).
  for (const n of N) if (!inc.get(n.id).length && out.get(n.id).length && n.type !== 'start') {
    const m = Math.min(...out.get(n.id).filter((e) => !e.back).map((e) => layer.get(e.t)));
    if (Number.isFinite(m)) layer.set(n.id, Math.max(0, m - 1));
  }
  const L = Math.max(...layer.values()) + 1;

  // ── Carriles y orden dentro de cada capa (baricentros) ───────────────────
  const laneKeys = spec.lanes ?? uniq(N.map((n) => n.lane).filter((v) => v !== null && v !== undefined && v !== '').map(String));
  const hasLanes = laneKeys.length > 0 && spec.swimlanes !== false;
  // Índice de carril con un Map (indexOf por nodo era cuadrático con miles de carriles).
  const laneIdx = new Map();
  laneKeys.forEach((k, i) => { if (!laneIdx.has(String(k))) laneIdx.set(String(k), i); });
  const laneOf = (n) => (hasLanes ? laneIdx.get(String(n.lane ?? laneKeys[0])) ?? 0 : 0);
  // Nodos de cada celda (capa × carril), armados una vez cuando las capas ya están ordenadas.
  let cells = null;
  const cellOf = (l, k) => {
    if (!cells) { cells = new Map(); layers.forEach((ls, li) => ls.forEach((n) => { const key = li * nLanes + laneOf(n); const c = cells.get(key); if (c) c.push(n); else cells.set(key, [n]); })); }
    return cells.get(l * nLanes + k) || [];
  };
  const layers = Array.from({ length: L }, () => []);
  for (const n of N) layers[layer.get(n.id)].push(n);
  const pos = new Map();
  const reindex = () => layers.forEach((ls) => ls.forEach((n, i) => pos.set(n.id, laneOf(n) * 1000 + i)));
  layers.forEach((ls) => ls.sort((a, b) => laneOf(a) - laneOf(b)));
  reindex();
  const bary = (n, nbrs) => { const ps = nbrs.map((id) => pos.get(id)).filter((v) => v !== undefined); return ps.length ? ps.reduce((a, b) => a + b, 0) / ps.length : pos.get(n.id); };
  for (let sweep = 0; sweep < 6; sweep++) {
    for (let l = 1; l < L; l++) { layers[l].sort((a, b) => laneOf(a) - laneOf(b) || bary(a, inc.get(a.id).filter((e) => !e.back).map((e) => e.s)) - bary(b, inc.get(b.id).filter((e) => !e.back).map((e) => e.s))); reindex(); }
    for (let l = L - 2; l >= 0; l--) { layers[l].sort((a, b) => laneOf(a) - laneOf(b) || bary(a, out.get(a.id).filter((e) => !e.back).map((e) => e.t)) - bary(b, out.get(b.id).filter((e) => !e.back).map((e) => e.t))); reindex(); }
  }

  // ── Colores por grupo (o neutros) ────────────────────────────────────────
  const groupKeys = uniq(N.map((n) => n.group).filter((v) => v !== null && v !== undefined && v !== '').map(String));
  const cmap = groupKeys.length ? colorMap(groupKeys, theme, spec.colors) : null;
  const colorOf = (n) => (cmap && n.group != null ? cmap.get(String(n.group)) : null);
  const legend = cmap && spec.legend !== false && groupKeys.length > 1 ? groupKeys.map((k) => ({ label: k, color: cmap.get(k), shape: 'square' })) : [];

  const frame = createFrame(spec, theme, { height: 520 });
  let area = frame.layout(legend);
  const backs = edges.filter((e) => e.back || e.s === e.t);
  // Los retornos rodean por el margen más cercano (izquierda/arriba o derecha/abajo).
  const relPos = (n) => { const ls = layers[layer.get(n.id)]; return hasLanes ? (laneOf(n) + 0.5) / laneKeys.length : (ls.indexOf(n) + 0.5) / ls.length; };
  for (const e of backs) e.side = (relPos(nodes.get(e.s)) + relPos(nodes.get(e.t))) / 2 < 0.5 ? -1 : 1;
  const nBackL = backs.filter((e) => e.side < 0).length, nBackR = backs.length - nBackL;

  // ── Dirección y tamaños ──────────────────────────────────────────────────
  const maxPerCell = (lane) => Math.max(1, ...layers.map((ls) => ls.filter((n) => laneOf(n) === lane).length));
  const roomL = nBackL ? 16 + nBackL * 9 : 0, roomR = nBackR ? 16 + nBackR * 9 : 0;
  const backRoom = roomL + roomR;
  const lrColW = area.w / L;
  // LR cuando hay pocas capas y cada columna deja nodos de ≥ 92 px; si no, TB.
  const longestWord = Math.max(...N.map((n) => Math.max(...String(n.label).split(/\s+/).map((w) => measure(w, FS, 600)))));
  const dir = spec.direction ? String(spec.direction).toUpperCase() : L <= 6 && lrColW - 46 >= Math.max(hasLanes ? 110 : 80, longestWord + 26) ? 'LR' : 'TB';
  // LR imposible (columnas de menos de 60 px): se vuelve a TB.
  const TB = dir !== 'LR' || lrColW < 60;
  // Espacio entre capas: en LR se ajusta para que todas las columnas quepan.
  const gapU = TB ? 40 : Math.max(20, Math.min(46, lrColW - 64));
  const gapV = area.w < 480 ? 10 : 18; // entre nodos de una misma capa
  let laneHead = hasLanes ? 26 : 0;
  const lanePad = hasLanes ? (area.w < 480 ? 5 : 10) : 0;
  const nLanes = hasLanes ? laneKeys.length : 1;

  // Ancho de nodo (en pantalla).
  const laneBand = []; // límites del carril en el eje transversal (v)
  const laneW = []; // ancho de nodo por carril (o uno global)
  const maxW = spec.nodeWidth ?? (TB ? 220 : 200);
  if (TB) {
    const crossW = area.w - backRoom;
    const x0 = area.x + roomL;
    if (hasLanes) {
      // Carriles con más nodos por capa reciben más ancho.
      const wts = laneKeys.map((_, k) => 1 + 0.75 * (maxPerCell(k) - 1));
      const unit = crossW / wts.reduce((a, b) => a + b, 0);
      let bx = x0;
      for (let k = 0; k < nLanes; k++) {
        const bw = unit * wts[k];
        laneBand.push([bx + 3, bx + bw - 3]);
        bx += bw;
        const c = maxPerCell(k);
        laneW.push(Math.min(maxW, (bw - 6 - 2 * lanePad - (c - 1) * gapV) / c));
      }
    } else {
      const C = Math.max(...layers.map((l) => l.length));
      laneW.push(Math.min(maxW, (crossW - (C - 1) * gapV) / C));
    }
  } else {
    laneW.push(Math.max(40, Math.min(maxW, lrColW - gapU)));
  }
  const widthOf = (n) => (TB ? Math.max(64, hasLanes ? laneW[laneOf(n)] : laneW[0]) : laneW[0]);
  // Títulos de carril: hasta 2 líneas si no caben en el ancho de la banda.
  const laneTitleLines = hasLanes ? laneKeys.map((k, i) => (TB ? wrap(k, laneBand[i][1] - laneBand[i][0] - 12, 12, 600, 2) : [k])) : [];
  if (hasLanes && TB) laneHead = laneTitleLines.some((l) => l.length > 1) ? 40 : 26;

  // Texto y alto de cada nodo. Si una palabra no cabe, se achica la letra de ese nodo.
  for (const n of N) {
    const isDec = n.type === 'decision';
    const w = widthOf(n);
    const tw = Math.max(30, isDec ? w * 0.64 : n.type === 'data' ? w - 34 : w - 22);
    const wt = n.type === 'start' || n.type === 'end' ? 600 : 500;
    // Margen de seguridad: las fuentes reales pueden ser algo más anchas que la medición.
    const twSafe = tw * 0.92;
    const longest = Math.max(...String(n.label).split(/\s+/).map((wd) => measure(wd, FS, wt)));
    n.fs = longest > twSafe ? Math.max(9.5, FS * (twSafe / longest)) : FS;
    n.lh = Math.round(n.fs * 1.3);
    n.lines = wrap(n.label, twSafe, n.fs, wt);
    const th = n.lines.length * n.lh;
    n.w = w;
    n.h = isDec ? Math.max(58, Math.ceil(th / 0.4) + 4) : Math.max(n.type === 'start' || n.type === 'end' ? 36 : 42, th + 20);
  }

  // ── Posiciones en coordenadas abstractas: u = flujo, v = transversal ─────
  const fu = (n) => (TB ? n.h : n.w), fv = (n) => (TB ? n.w : n.h);
  const rowSize = layers.map((ls) => Math.max(0, ...ls.map(fu)));
  const u0 = TB ? area.y + laneHead : area.x;
  const rowStart = [];
  let acc = u0;
  for (let l = 0; l < L; l++) { rowStart.push(acc); acc += rowSize[l] + gapU; }
  const contentU = acc - gapU - u0;
  for (let l = 0; l < L; l++) for (const n of layers[l]) n.u0 = rowStart[l] + (rowSize[l] - fu(n)) / 2;

  if (TB) {
    if (hasLanes) {
      for (let l = 0; l < L; l++) for (let k = 0; k < nLanes; k++) {
        const cell = cellOf(l, k);
        const [b0, b1] = laneBand[k];
        const slot = (b1 - b0) / Math.max(1, cell.length);
        cell.forEach((n, i) => { n.vc = b0 + slot * (i + 0.5); });
      }
    } else {
      const C = Math.max(...layers.map((l) => l.length));
      const crossW = area.w - backRoom;
      const slot = crossW / C;
      for (const ls of layers) ls.forEach((n, i) => { n.vc = area.x + roomL + slot * ((C - ls.length) / 2 + i + 0.5); });
    }
  } else {
    // LR: carriles como bandas horizontales con alto según su contenido.
    const cellH = (k) => Math.max(0, ...layers.map((_, l) => { const c = cellOf(l, k); return c.reduce((a, n) => a + n.h, 0) + Math.max(0, c.length - 1) * gapV; }));
    let v = area.y + roomL;
    for (let k = 0; k < nLanes; k++) {
      const h = cellH(k) + 2 * lanePad + laneHead;
      laneBand.push([v, v + h]);
      v += h + (hasLanes ? 6 : 0);
    }
    for (let l = 0; l < L; l++) for (let k = 0; k < nLanes; k++) {
      const cell = cellOf(l, k);
      const [b0, b1] = laneBand[k];
      const inner0 = b0 + laneHead + lanePad, inner1 = b1 - lanePad;
      const tot = cell.reduce((a, n) => a + n.h, 0) + Math.max(0, cell.length - 1) * gapV;
      let y = (inner0 + inner1) / 2 - tot / 2;
      cell.forEach((n) => { n.vc = y + n.h / 2; y += n.h + gapV; });
    }
  }
  for (const n of N) { n.u1 = n.u0 + fu(n); n.uc = (n.u0 + n.u1) / 2; n.v0 = n.vc - fv(n) / 2; n.v1 = n.vc + fv(n) / 2; }

  // Alto final.
  const contentBottom = TB ? u0 + contentU : Math.max(...laneBand.map((b) => b[1]));
  const extraBack = !TB ? roomR : 0;
  if (spec.height === undefined) {
    frame.setHeight(contentBottom + extraBack + 8 + frame.chrome);
    area = { ...area, h: frame.bottom - area.y };
  }
  const P = (u, v) => (TB ? [v, u] : [u, v]); // abstracto → pantalla

  // ── Ruteo ortogonal ──────────────────────────────────────────────────────
  const free = (v, l, pad = 8) => layers[l].every((n) => v < n.v0 - pad || v > n.v1 + pad);
  const corridorCandidates = (s, t) => {
    const c = [t.vc, s.vc];
    const allV = N.flatMap((n) => [n.v0 - gapV / 2, n.v1 + gapV / 2]);
    c.push(...allV.sort((a, b) => Math.abs(a - (s.vc + t.vc) / 2) - Math.abs(b - (s.vc + t.vc) / 2)));
    return c;
  };
  let maxV = Math.max(...N.map((n) => n.v1)), minV = Math.min(...N.map((n) => n.v0));
  if (hasLanes) { maxV = Math.max(maxV, laneBand[laneBand.length - 1][1]); minV = Math.min(minV, laneBand[0][0]); }
  const routes = [];
  let kL = 0, kR = 0;
  for (const e of edges) {
    const s = nodes.get(e.s), t = nodes.get(e.t);
    let pts;
    if (e.back || e.s === e.t) {
      // Sale por el hueco tras su capa, rodea por el margen y entra por arriba del destino.
      const vb = e.side < 0 ? minV - 10 - 9 * kL++ : maxV + 10 + 9 * kR++;
      const ls = layer.get(e.s), lt = layer.get(e.t);
      const ugS = rowStart[ls] + rowSize[ls] + gapU / 2;
      const ugT = rowStart[lt] - gapU / 2;
      void ugT;
      // Entra por el costado del destino que mira al margen.
      pts = [[s.u1, s.vc], [ugS, s.vc], [ugS, vb], [t.uc, vb], [t.uc, e.side < 0 ? t.v0 : t.v1]];
      routes.push({ e, pts: simplify(pts), back: true });
      continue;
    }
    const ls = layer.get(e.s), lt = layer.get(e.t);
    const ugS = rowStart[ls] + rowSize[ls] + gapU / 2;
    const ugT = rowStart[lt] - gapU / 2;
    // Decisiones: la salida "principal" (siguiente capa, alineada) va abajo; las demás, por el costado.
    const fwdOut = out.get(s.id).filter((x) => !x.back && x.s !== x.t);
    const main = fwdOut.find((x) => layer.get(x.t) === ls + 1 && Math.abs(nodes.get(x.t).vc - s.vc) < 1) || null;
    const side = s.type === 'decision' && fwdOut.length > 1 && main !== e;
    const between = (v) => { for (let l = ls + 1; l < lt; l++) if (!free(v, l)) return false; return true; };
    if (side && Math.abs(t.vc - s.vc) < 1) {
      // Mismo eje que la decisión: sale por un costado libre y baja por un corredor.
      const dirV = layers[ls].some((n) => n !== s && n.vc < s.vc) ? 1 : -1;
      const sv = dirV > 0 ? s.v1 : s.v0;
      const lanesEdge = hasLanes ? laneBand[laneOf(s)] : null;
      let vc = sv + dirV * 22;
      if (lanesEdge) vc = dirV > 0 ? Math.min(vc, lanesEdge[1] - 6) : Math.max(vc, lanesEdge[0] + 6);
      const ok = (v) => { for (let l = ls + 1; l < lt; l++) if (!free(v, l, 6)) return false; return true; };
      if (!ok(vc)) vc = corridorCandidates(s, t).find((v) => ok(v) && Math.sign(v - s.vc) === dirV) ?? (dirV > 0 ? maxV + 12 : minV - 12);
      pts = [[s.uc, sv], [s.uc, vc], [ugT, vc], [ugT, t.vc], [t.u0, t.vc]];
    } else if (side) {
      // Decisión: sale por el costado hacia la columna del destino.
      const sv = t.vc > s.vc ? s.v1 : s.v0;
      if (between(t.vc)) {
        pts = [[s.uc, sv], [s.uc, t.vc], [t.u0, t.vc]];
        // Si el tramo transversal a la altura del nodo choca con un vecino, baja al hueco.
        const hit = layers[ls].some((n) => n !== s && Math.min(sv, t.vc) < n.v1 && Math.max(sv, t.vc) > n.v0);
        if (hit) pts = [[s.uc, sv], [s.uc, sv + (t.vc > s.vc ? 12 : -12)], [ugS, sv + (t.vc > s.vc ? 12 : -12)], [ugS, t.vc], [t.u0, t.vc]];
      }
    }
    if (!pts) {
      if (lt === ls + 1) {
        pts = Math.abs(s.vc - t.vc) < 1 ? [[s.u1, s.vc], [t.u0, t.vc]] : [[s.u1, s.vc], [ugS, s.vc], [ugS, t.vc], [t.u0, t.vc]];
      } else {
        const vc = corridorCandidates(s, t).find(between) ?? maxV + 14;
        pts = [[s.u1, s.vc], [ugS, s.vc], [ugS, vc], [ugT, vc], [ugT, t.vc], [t.u0, t.vc]];
      }
    }
    routes.push({ e, pts: simplify(pts), back: false });
  }

  // ── Dibujo ───────────────────────────────────────────────────────────────
  const body = [];
  const mid = 'pa-arrow-' + Math.abs(hash(String(spec.title) + N.length + area.w)).toString(36);
  const edgeColor = theme.muted;
  // Marcador escrito a mano: refX/markerWidth deben conservar mayúsculas.
  const defs = `<marker id="${mid}" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="10" markerHeight="10" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M1,1.5L9,5L1,8.5Z" fill="${edgeColor}"/></marker>`;

  // Carriles: bandas tintadas con título.
  if (hasLanes) {
    const parts = [];
    laneKeys.forEach((k, i) => {
      const [b0, b1] = laneBand[i];
      if (TB) {
        const y0 = area.y, y1 = contentBottom + (backs.length ? 0 : 0) + 6;
        parts.push(el('rect', { x: b0, y: y0, width: b1 - b0, height: y1 - y0, rx: 10, fill: theme.tint, opacity: 0.7 }));
        laneTitleLines[i].forEach((ln, j) => parts.push(text((b0 + b1) / 2, y0 + 17 + j * 14, ln, { fill: theme.lede, fontSize: 12, fontWeight: 600, textAnchor: 'middle' })));
      } else {
        const x0 = area.x, x1 = area.x + area.w;
        parts.push(el('rect', { x: x0, y: b0, width: x1 - x0, height: b1 - b0, rx: 10, fill: theme.tint, opacity: 0.7 }));
        parts.push(text(x0 + 12, b0 + 17, k, { fill: theme.lede, fontSize: 12, fontWeight: 600 }));
      }
    });
    body.push(g({ class: 'pa-lanes' }, parts));
  }

  // Conectores
  const edgeParts = [], labelParts = [];
  for (const r of routes) {
    const screen = r.pts.map(([u, v]) => P(u, v));
    edgeParts.push(el('path', { d: roundPath(screen, 8), fill: 'none', stroke: edgeColor, strokeWidth: 1.4, strokeLinejoin: 'round', markerEnd: `url(#${mid})` }));
    if (r.e.label) {
      // Etiqueta sobre el tramo más largo de los dos primeros.
      let best = 0, bl = -1;
      for (let i = 0; i < Math.min(2, screen.length - 1); i++) {
        const l = Math.hypot(screen[i + 1][0] - screen[i][0], screen[i + 1][1] - screen[i][1]);
        if (l > bl) { bl = l; best = i; }
      }
      const [ax, ay] = screen[best], [bx, by] = screen[best + 1];
      const t = bl > 70 ? 0.4 : 0.5;
      const lx = ax + (bx - ax) * t, ly = ay + (by - ay) * t;
      const w = measure(r.e.label, EDGE_FS, 600) + 12;
      labelParts.push(g({ class: 'pa-edge-label' }, [
        el('rect', { x: lx - w / 2, y: ly - 9, width: w, height: 18, rx: 9, fill: theme.surface, stroke: theme.grid, strokeWidth: 1 }),
        text(lx, ly + 4, r.e.label, { fill: theme.lede, fontSize: EDGE_FS, fontWeight: 600, textAnchor: 'middle' }),
      ]));
    }
  }
  body.push(g({ class: 'pa-edges' }, edgeParts));

  // Nodos
  const nodeParts = [];
  for (const n of N) {
    const [x, y] = TB ? [n.v0, n.u0] : [n.u0, n.v0];
    const c = colorOf(n);
    const neutral = theme.ink;
    let shape, fill = theme.surface, stroke = c || (theme.mode === 'dark' ? theme.lede : theme.lede), sw = 1.5, tcol = theme.ink;
    if (n.type === 'start' || n.type === 'end') {
      fill = c || neutral; stroke = 'none'; tcol = textOn(fill, theme);
      shape = el('rect', { x, y, width: n.w, height: n.h, rx: n.h / 2, fill, stroke });
    } else if (n.type === 'decision') {
      stroke = c || theme.categorical[0];
      fill = mix(theme.surface, stroke, theme.mode === 'dark' ? 0.16 : 0.07);
      shape = el('path', { d: `M${x + n.w / 2},${y}L${x + n.w},${y + n.h / 2}L${x + n.w / 2},${y + n.h}L${x},${y + n.h / 2}Z`, fill, stroke, strokeWidth: sw, strokeLinejoin: 'round' });
    } else if (n.type === 'data') {
      const k = 10;
      shape = el('path', { d: `M${x + k},${y}H${x + n.w}L${x + n.w - k},${y + n.h}H${x}Z`, fill, stroke, strokeWidth: sw, strokeLinejoin: 'round' });
    } else if (n.type === 'note') {
      fill = c ? mix(theme.surface, c, 0.12) : theme.tint2; stroke = 'none'; tcol = theme.lede;
      shape = el('rect', { x, y, width: n.w, height: n.h, rx: 6, fill });
    } else {
      fill = c ? mix(theme.surface, c, theme.mode === 'dark' ? 0.14 : 0.06) : theme.surface;
      shape = el('rect', { x, y, width: n.w, height: n.h, rx: 9, fill, stroke, strokeWidth: sw });
    }
    const bold = n.type === 'start' || n.type === 'end' ? 600 : 500;
    const ty0 = y + n.h / 2 - (n.lines.length * n.lh) / 2 + n.lh * 0.74;
    const texts = n.lines.map((l, i) => text(x + n.w / 2, ty0 + i * n.lh, l, { fill: tcol, fontSize: n.fs, fontWeight: bold, textAnchor: 'middle' }));
    const kind = { start: T('Start', 'Inicio', locale), end: T('End', 'Fin', locale), decision: T('Decision', 'Decisión', locale), data: T('Data', 'Dato', locale), note: T('Note', 'Nota', locale), process: T('Step', 'Paso', locale) }[n.type] || '';
    nodeParts.push(g({ class: 'pa-m', 'data-tip': tip(n.label, n.detail, [kind, n.lane, n.group].filter(Boolean).join(' · ')) }, [shape, ...texts]));
  }
  body.push(g({ class: 'pa-nodes' }, nodeParts));
  body.push(g({}, labelParts));
  void readable;

  const decisions = N.filter((n) => n.type === 'decision').length;
  const desc = en
    ? `Flow chart with ${N.length} steps${decisions ? `, ${decisions} decisions` : ''}${hasLanes ? ` across ${nLanes} lanes (${laneKeys.join(', ')})` : ''}. Starts at "${(roots[0] || N[0]).label}".`
    : `Diagrama de flujo con ${N.length} pasos${decisions ? `, ${decisions} decisiones` : ''}${hasLanes ? ` en ${nLanes} carriles (${laneKeys.join(', ')})` : ''}. Comienza en "${(roots[0] || N[0]).label}".`;
  const svg = frame.finish(body, { desc, type: 'flowchart', defs });
  if (spec._layout) Object.assign(spec._layout, { direction: TB ? 'TB' : 'LR', nodes: N.map((n) => { const [x, y] = TB ? [n.v0, n.u0] : [n.u0, n.v0]; return { id: n.id, x, y, w: n.w, h: n.h }; }) });
  return svg;
}

function simplify(pts) {
  const out = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (last && Math.abs(last[0] - p[0]) < 0.5 && Math.abs(last[1] - p[1]) < 0.5) continue;
    out.push(p);
  }
  // Quita puntos colineales.
  return out.filter((p, i) => {
    if (i === 0 || i === out.length - 1) return true;
    const a = out[i - 1], b = out[i + 1];
    return !((Math.abs(a[0] - p[0]) < 0.5 && Math.abs(p[0] - b[0]) < 0.5) || (Math.abs(a[1] - p[1]) < 0.5 && Math.abs(p[1] - b[1]) < 0.5));
  });
}

/** Polilínea con esquinas redondeadas. */
function roundPath(pts, r) {
  if (pts.length < 2) return '';
  const f = (n) => n.toFixed(1);
  let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
    const l1 = Math.hypot(x1 - x0, y1 - y0), l2 = Math.hypot(x2 - x1, y2 - y1);
    const rr = Math.min(r, l1 / 2, l2 / 2);
    const ax = x1 - ((x1 - x0) / l1) * rr, ay = y1 - ((y1 - y0) / l1) * rr;
    const bx = x1 + ((x2 - x1) / l2) * rr, by = y1 + ((y2 - y1) / l2) * rr;
    d += `L${f(ax)},${f(ay)}Q${f(x1)},${f(y1)} ${f(bx)},${f(by)}`;
  }
  const [lx, ly] = pts[pts.length - 1];
  return d + `L${f(lx)},${f(ly)}`;
}
