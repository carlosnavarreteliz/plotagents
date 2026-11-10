// Sankey: flujos entre etapas (presupuesto → áreas, origen → destino).
// El grosor es proporcional al valor; el color sigue al origen.
import { el, g, text, tip } from '../svg.js';
import { measure, truncate } from '../text.js';
import { makeFormat } from '../format.js';
import { ensureData, requireField, num, fieldsOf, fieldKind, PlotError } from '../data.js';
import { createFrame } from '../frame.js';

export function sankey(spec, theme) {
  const data = ensureData(spec);
  const fields = fieldsOf(data);
  const from = spec.from ?? spec.source_field ?? (fields.includes('source') ? 'source' : fields.includes('from') ? 'from' : fields[0]);
  const to = spec.to ?? (fields.includes('target') ? 'target' : fields.includes('to') ? 'to' : fields[1]);
  const valueF = spec.value ?? fields.find((f) => f !== from && f !== to && fieldKind(data, f) === 'number');
  requireField(data, from, 'from');
  requireField(data, to, 'to');
  requireField(data, valueF, 'value');
  const locale = spec.locale || 'es';
  const en = String(locale).startsWith('en');

  // Enlaces agregados (valores no finitos o ≤ 0 se ignoran).
  const lmap = new Map();
  for (const r of data) {
    const v = num(r[valueF]);
    if (!(v > 0) || !Number.isFinite(v)) continue;
    const s = String(r[from]), t = String(r[to]);
    if (s === t) continue;
    const k = s + '\u0000' + t;
    lmap.set(k, (lmap.get(k) || 0) + v);
  }
  const links = [...lmap.entries()].map(([k, v]) => { const [s, t] = k.split('\u0000'); return { s, t, v }; });
  if (!links.length) {
    throw en
      ? new PlotError('The sankey has no positive flows between different nodes.', `Check \`${valueF}\`: it needs values > 0, and \`${from}\` must differ from \`${to}\` (self-loops are dropped).`)
      : new PlotError('El sankey no tiene flujos positivos entre nodos distintos.', `Revisa \`${valueF}\`: necesita valores > 0, y \`${from}\` debe ser distinto de \`${to}\` (los bucles se omiten).`);
  }
  const names = [...new Set(links.flatMap((l) => [l.s, l.t]))];
  const nodes = new Map(names.map((n) => [n, { name: n, in: [], out: [], depth: 0 }]));
  for (const l of links) { l.sn = nodes.get(l.s); l.tn = nodes.get(l.t); l.sn.out.push(l); l.tn.in.push(l); }
  for (const n of nodes.values()) n.value = Math.max(sum(n.in), sum(n.out));

  // Un sankey fluye en una dirección: un ciclo (a → b → a) no tiene etapas.
  const cycle = findCycle(nodes);
  if (cycle) {
    const path = cycle.join(' → ');
    throw en
      ? new PlotError(`The sankey has a cycle (${path}): flows must go one way, stage by stage.`, 'Name each stage apart ("Chile (origin)" → "Chile (destination)"), drop the return flows, or use `type: "chord"` for two-way exchanges.')
      : new PlotError(`El sankey tiene un ciclo (${path}): los flujos deben ir en una sola dirección, etapa por etapa.`, 'Distingue las etapas ("Chile (origen)" → "Chile (destino)"), quita los flujos de vuelta o usa `type: "chord"` para intercambios en ambos sentidos.');
  }

  // Profundidad = camino más largo desde un origen.
  for (let it = 0; it < names.length; it++) {
    let changed = false;
    for (const l of links) if (l.tn.depth < l.sn.depth + 1) { l.tn.depth = l.sn.depth + 1; changed = true; }
    if (!changed) break;
  }
  const maxDepth = Math.max(...[...nodes.values()].map((n) => n.depth));
  for (const n of nodes.values()) if (!n.out.length) n.depth = maxDepth; // sumideros a la derecha
  const cols = Array.from({ length: maxDepth + 1 }, () => []);
  for (const n of nodes.values()) cols[n.depth].push(n);
  cols.forEach((c) => c.sort((a, b) => b.value - a.value));

  const fmt = makeFormat(spec.format, locale, links.map((l) => l.v));
  const frame = createFrame(spec, theme, { height: 440 });
  const area = frame.layout([]);
  const label = (n) => n.name;
  const leftW = Math.min(area.w * 0.22, Math.max(...cols[0].map((n) => Math.max(measure(label(n), 12.5, 500), measure(fmt(n.value), 12))))) + 10;
  const last = cols[cols.length - 1];
  const rightW = Math.min(area.w * 0.22, Math.max(...last.map((n) => Math.max(measure(label(n), 12.5, 500), measure(fmt(n.value), 12))))) + 10;
  const NW = 10;
  const inner = { x: area.x + leftW, y: area.y + 4, w: area.w - leftW - rightW, h: area.h - 8 };
  const pad = Math.max(6, Math.min(18, inner.h / Math.max(...cols.map((c) => c.length)) / 4));
  const ky = Math.min(...cols.map((c) => (inner.h - (c.length - 1) * pad) / (sum(c.map((n) => ({ v: n.value }))) || 1)));
  const colX = (i) => inner.x + (cols.length === 1 ? 0 : (i * (inner.w - NW)) / (cols.length - 1));

  const place = () => {
    cols.forEach((c, i) => {
      const H = sum(c.map((n) => ({ v: n.value }))) * ky + (c.length - 1) * pad;
      let y = inner.y + (inner.h - H) / 2;
      for (const n of c) { n.x = colX(i); n.y = y; n.h = Math.max(1, n.value * ky); y += n.h + pad; }
    });
  };
  place();
  // Baricentros para reducir cruces.
  const center = (n) => n.y + n.h / 2;
  for (let it = 0; it < 6; it++) {
    for (let i = 1; i < cols.length; i++) cols[i].sort((a, b) => bary(a.in, 'sn') - bary(b.in, 'sn'));
    place();
    for (let i = cols.length - 2; i >= 0; i--) cols[i].sort((a, b) => bary(a.out, 'tn') - bary(b.out, 'tn'));
    place();
  }
  function bary(ls, key) {
    const w = sum(ls);
    return w ? ls.reduce((a, l) => a + center(l[key]) * l.v, 0) / w : Infinity;
  }

  // Color: orígenes en orden fijo; los demás heredan su mayor flujo de entrada.
  // Si hay un solo origen, el color nace en la primera etapa con 2+ nodos.
  const cc = Math.max(0, cols.findIndex((c) => c.length > 1));
  const fixed = (n) => spec.colors && spec.colors[n.name];
  for (let i = 0; i < cc; i++) for (const n of cols[i]) n.color = fixed(n) || theme.ink;
  [...cols[cc]].sort((a, b) => b.value - a.value).forEach((n, i) => { n.color = fixed(n) || (i < theme.categorical.length ? theme.categorical[i] : theme.other); });
  for (let i = cc + 1; i < cols.length; i++) for (const n of cols[i]) {
    const big = [...n.in].sort((a, b) => b.v - a.v)[0];
    n.color = fixed(n) || (n.in.length ? big.sn.color : theme.categorical[0]);
  }
  const linkColor = (l) => (l.sn.depth < cc ? l.tn.color : l.sn.color);

  // Posición de cada enlace dentro de sus nodos.
  for (const n of nodes.values()) {
    let sy = n.y;
    for (const l of [...n.out].sort((a, b) => center(a.tn) - center(b.tn))) { l.y0 = sy; sy += l.v * ky; }
    let ty = n.y;
    for (const l of [...n.in].sort((a, b) => center(a.sn) - center(b.sn))) { l.y1 = ty; ty += l.v * ky; }
  }

  const body = [];
  const linkG = [];
  for (const l of [...links].sort((a, b) => b.v - a.v)) {
    const x0 = l.sn.x + NW, x1 = l.tn.x, xm = (x0 + x1) / 2, w = l.v * ky;
    const d = `M${x0},${l.y0}C${xm},${l.y0} ${xm},${l.y1} ${x1},${l.y1}L${x1},${l.y1 + w}C${xm},${l.y1 + w} ${xm},${l.y0 + w} ${x0},${l.y0 + w}Z`;
    const share = l.sn.value ? Math.round((l.v / l.sn.value) * 100) : 0;
    linkG.push(el('path', { class: 'pa-m', d, fill: linkColor(l), fillOpacity: theme.link, 'data-tip': `${l.s} → ${l.t}\n${fmt(l.v)} · ${share}% ${en ? 'of' : 'de'} ${l.s}` }));
  }
  body.push(g({ class: 'pa-links' }, linkG));
  for (const [ci, c] of cols.entries()) for (const n of c) {
    const parts = [el('rect', { x: n.x, y: n.y, width: NW, height: n.h, rx: 2, fill: n.color })];
    const isLeft = ci === 0 && cols.length > 1;
    const lx = isLeft ? n.x - 8 : n.x + NW + 8;
    const anchor = isLeft ? 'end' : 'start';
    const maxW = isLeft ? leftW - 10 : ci === cols.length - 1 ? rightW - 10 : (inner.w / Math.max(1, cols.length - 1)) * 0.55;
    const halo = ci > 0 && ci < cols.length - 1 ? { stroke: theme.surface, strokeWidth: 3, paintOrder: 'stroke', strokeLinejoin: 'round' } : {};
    const cy = n.y + n.h / 2;
    if (n.h >= 30) {
      parts.push(text(lx, cy - 2, truncate(label(n), maxW, 12.5, 500), { fill: theme.ink, fontSize: 12.5, fontWeight: 500, textAnchor: anchor, ...halo }));
      parts.push(text(lx, cy + 13, fmt(n.value), { fill: theme.lede, fontSize: 12, textAnchor: anchor, ...halo }));
    } else if (n.h >= 8 || c.length < 12) {
      parts.push(text(lx, cy + 4, truncate(label(n), maxW, 12, 500), { fill: theme.ink, fontSize: 12, fontWeight: 500, textAnchor: anchor, ...halo }));
    }
    body.push(g({ 'data-tip': `${n.name}\n${fmt(n.value)}` }, parts));
  }
  const top = [...links].sort((a, b) => b.v - a.v).slice(0, 3).map((l) => `${l.s} → ${l.t} (${fmt(l.v)})`).join('; ');
  const desc = en ? `Sankey diagram with ${nodes.size} nodes and ${links.length} flows. Largest flows: ${top}.` : `Diagrama de Sankey con ${nodes.size} nodos y ${links.length} flujos. Mayores flujos: ${top}.`;
  return frame.finish(body, { desc, type: 'sankey' });
}

const sum = (ls) => ls.reduce((a, l) => a + l.v, 0);

/** Primer ciclo encontrado (lista de nombres, cerrada) o null. DFS iterativo. */
function findCycle(nodes) {
  const state = new Map(); // 1 = en la pila, 2 = terminado
  for (const start of nodes.values()) {
    if (state.has(start)) continue;
    const stack = [[start, 0]];
    const trail = [start];
    state.set(start, 1);
    while (stack.length) {
      const top = stack[stack.length - 1];
      const [n, i] = top;
      if (i < n.out.length) {
        top[1]++;
        const m = n.out[i].tn;
        if (state.get(m) === 1) return [...trail.slice(trail.indexOf(m)), m].map((x) => x.name);
        if (!state.has(m)) { state.set(m, 1); stack.push([m, 0]); trail.push(m); }
      } else { state.set(n, 2); stack.pop(); trail.pop(); }
    }
  }
  return null;
}
