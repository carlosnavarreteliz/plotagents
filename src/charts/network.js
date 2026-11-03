// Red (grafo): nodos y conexiones con disposición por fuerzas, determinista.
// El tamaño del nodo es su peso (o su grado ponderado); el color, su grupo.
// La disposición se ajusta al área disponible para usar todo el espacio.
import { el, g, text, tip } from '../svg.js';
import { measure, truncate } from '../text.js';
import { makeFormat } from '../format.js';
import { colorMap, readable } from '../theme.js';
import { ensureData, requireField, num, fieldsOf, fieldKind, PlotError } from '../data.js';
import { createFrame } from '../frame.js';

const pick = (fields, cands) => cands.find((c) => fields.includes(c));

/** Prepara nodos y aristas a partir del spec. */
export function prepareNetwork(spec) {
  const data = ensureData(spec);
  const fields = fieldsOf(data);
  const from = spec.from ?? pick(fields, ['from', 'source', 'origen', 'desde']) ?? fields[0];
  const to = spec.to ?? pick(fields, ['to', 'target', 'destino', 'hasta']) ?? fields[1];
  requireField(data, from, 'from');
  requireField(data, to, 'to');
  const vf = spec.value ?? pick(fields, ['value', 'weight', 'peso', 'valor']) ?? fields.find((f) => f !== from && f !== to && fieldKind(data, f) === 'number');
  if (spec.value) requireField(data, vf, 'value');

  // Aristas: pares no dirigidos agregados (A–B y B–A se suman).
  const emap = new Map();
  for (const r of data) {
    const a = r[from], b = r[to];
    if (a === null || a === undefined || b === null || b === undefined) continue;
    const s = String(a), t = String(b);
    if (s === t) continue;
    const w = vf ? num(r[vf]) : 1;
    if (!(w > 0)) continue;
    const key = s < t ? s + '\u0000' + t : t + '\u0000' + s;
    if (!emap.has(key)) emap.set(key, { s: s < t ? s : t, t: s < t ? t : s, v: 0 });
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
    if (!nf.includes(idF)) throw new PlotError(`El campo "${idF}" (nodeId) no existe en nodes.`, `Campos disponibles: ${nf.join(', ')}`);
    for (const r of spec.nodes) {
      if (r[idF] === null || r[idF] === undefined) continue;
      const n = add(String(r[idF]));
      if (labF && r[labF] !== undefined) n.label = String(r[labF]);
      if (grF && r[grF] !== undefined && r[grF] !== null) n.group = String(r[grF]);
      if (szF && Number.isFinite(num(r[szF]))) n.size = num(r[szF]);
    }
  }
  for (const e of edges) {
    const a = add(e.s), b = add(e.t);
    a.deg++; b.deg++; a.wdeg += e.v; b.wdeg += e.v;
  }
  const list = [...nodes.values()];
  for (const n of list) n.w = n.size ?? n.wdeg;
  return { edges, nodes: list, byId: nodes, valueField: vf };
}

/** Disposición por fuerzas (velocity Verlet simplificado, al estilo d3-force). */
function forceLayout(nodes, edges, byId, { iterations = 320, spacing = 40, pin = null } = {}) {
  const n = nodes.length;
  // Posiciones iniciales en filotaxis (deterministas), agrupadas por grupo.
  const order = [...nodes].sort((a, b) => String(a.group).localeCompare(String(b.group)) || b.w - a.w);
  order.forEach((nd, i) => {
    const r = spacing * 0.6 * Math.sqrt(i + 0.5), a = i * 2.399963229728653;
    nd.x = r * Math.cos(a); nd.y = r * Math.sin(a); nd.vx = 0; nd.vy = 0;
  });
  // Nodo en foco: parte y se queda en el centro; el resto se acomoda a su alrededor.
  if (pin) { const c = { x: pin.x, y: pin.y }; for (const nd of nodes) { nd.x -= c.x; nd.y -= c.y; } }
  const links = edges.map((e) => ({ a: byId.get(e.s), b: byId.get(e.t), v: e.v }));
  const maxV = Math.max(1, ...links.map((l) => l.v));
  let alpha = 1;
  const decay = 1 - Math.pow(0.001, 1 / iterations);
  const charge = -spacing * spacing * 0.9;
  for (let it = 0; it < iterations; it++) {
    // Repulsión entre todos los pares (O(n²), suficiente hasta ~400 nodos).
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
    // Colisión por radio.
    for (let pass = 0; pass < 2; pass++)
      for (let i = 0; i < n; i++)
        for (let j = i + 1; j < n; j++) {
          const p = nodes[i], q = nodes[j];
          const dx = q.x - p.x, dy = q.y - p.y;
          const min = p.r + q.r + 3;
          const d2 = dx * dx + dy * dy;
          if (d2 < min * min) {
            const d = Math.sqrt(d2) || 1e-6;
            const s = ((min - d) / d) * 0.5;
            p.x -= dx * s; p.y -= dy * s; q.x += dx * s; q.y += dy * s;
          }
        }
    if (pin) { pin.x = 0; pin.y = 0; }
    alpha -= alpha * decay;
  }
}

/** Círculo ordenado por grupo y tamaño. */
function circleLayout(nodes, groups) {
  const order = [...nodes].sort((a, b) => groups.indexOf(a.group) - groups.indexOf(b.group) || b.w - a.w);
  const n = order.length;
  order.forEach((nd, i) => {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    nd.x = Math.cos(a); nd.y = Math.sin(a); nd.angle = a;
  });
}

export function network(spec, theme) {
  const locale = spec.locale || 'es';
  const en = String(locale).startsWith('en');
  const { edges, nodes, byId } = prepareNetwork(spec);
  if (!nodes.length) throw new PlotError('La red no tiene conexiones válidas.', 'Entrega filas con { from, to, value }.');
  const layout = spec.layout === 'circle' ? 'circle' : 'force';

  // Grupos en orden de peso total (color estable por entidad).
  const gtot = new Map();
  for (const n of nodes) { const k = n.group ?? ''; gtot.set(k, (gtot.get(k) || 0) + n.w); }
  const groups = [...gtot.keys()].sort((a, b) => gtot.get(b) - gtot.get(a));
  const hasGroups = groups.length > 1 || (groups.length === 1 && groups[0] !== '');
  const cmap = colorMap(groups, theme, spec.colors);
  const colorOf = (n) => (spec.colors && spec.colors[n.id]) || (hasGroups ? cmap.get(n.group ?? '') : theme.categorical[0]);
  const fmt = makeFormat(spec.format, locale, nodes.map((n) => n.w));
  const fmtE = makeFormat(spec.format, locale, edges.map((e) => e.v));

  const legend = hasGroups && spec.legend !== false ? groups.map((k) => ({ label: k || (en ? 'No group' : 'Sin grupo'), color: cmap.get(k) })) : [];
  const W = spec.width || 720;
  const frame = createFrame(spec, theme, { height: W < 560 ? Math.round(W * 1.05 + 150) : 520 });
  const area = frame.layout(legend);

  // Radios: área ∝ peso, entre 4 y 22 px (más chicos si hay muchos nodos).
  const maxW = Math.max(...nodes.map((n) => n.w), 1e-9);
  const rMax = spec.maxRadius ?? Math.max(9, Math.min(22, Math.sqrt((area.w * area.h) / nodes.length) * 0.32));
  const rMin = Math.min(4, rMax / 2);
  for (const n of nodes) n.r = rMin + (rMax - rMin) * Math.sqrt(Math.max(0, n.w) / maxW);

  // Etiquetas: las N mayores (o una lista).
  const labelSize = (theme.type?.label ?? 12) - 0.5;
  let labelSet;
  if (Array.isArray(spec.labels)) labelSet = new Set(spec.labels.map(String));
  else if (spec.labels === false) labelSet = new Set();
  else {
    const k = typeof spec.labels === 'number' ? spec.labels : nodes.length <= 14 ? nodes.length : layout === 'circle' ? nodes.length : 10;
    labelSet = new Set([...nodes].sort((a, b) => b.w - a.w).slice(0, k).map((n) => n.id));
  }

  // Foco (clic en un nodo): va al centro y se destacan sus vecinos, con nombre.
  const focusNode = spec.focus !== undefined && spec.focus !== null ? byId.get(String([].concat(spec.focus)[0])) : null;
  if (focusNode) {
    labelSet.add(focusNode.id);
    for (const e of edges) { if (e.s === focusNode.id) labelSet.add(e.t); if (e.t === focusNode.id) labelSet.add(e.s); }
  }

  // Disposición + ajuste al área.
  const body = [];
  if (layout === 'circle') {
    circleLayout(nodes, groups);
    const lwFull = Math.max(0, ...nodes.filter((n) => labelSet.has(n.id)).map((n) => measure(n.label, labelSize, 600)));
    const lw = Math.min(area.w * (area.w < 480 ? 0.2 : 0.28), lwFull) + 10;
    const rGuess = Math.min(rMax, 10);
    const R = Math.max(40, Math.min(area.w / 2 - lw - rGuess, area.h / 2 - rGuess - 16));
    // En el círculo, el radio de cada nodo no puede superar su espacio en la circunferencia.
    const rCap = Math.max(3.5, ((Math.PI * 2 * R) / nodes.length) * 0.4);
    if (rCap < rMax) for (const n of nodes) n.r = Math.max(3, n.r * (rCap / rMax));
    const cx = area.x + area.w / 2, cy = area.y + area.h / 2;
    for (const n of nodes) { n.px = cx + n.x * R; n.py = cy + n.y * R; }
    nodes.cx = cx; nodes.cy = cy; nodes.R = R; nodes.lw = lw;
  } else {
    const spacing = Math.max(26, Math.sqrt((area.w * area.h) / nodes.length) * 0.75);
    forceLayout(nodes, edges, byId, { spacing, pin: focusNode, iterations: spec.iterations ?? (nodes.length > 200 ? 200 : 320) });
    // Rota la red para que su eje principal siga el lado largo del área (sin foco).
    if (!focusNode) {
      const mx = nodes.reduce((a, n) => a + n.x, 0) / nodes.length, my = nodes.reduce((a, n) => a + n.y, 0) / nodes.length;
      let sxx = 0, syy = 0, sxy = 0;
      for (const n of nodes) { const dx = n.x - mx, dy = n.y - my; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
      let th = 0.5 * Math.atan2(2 * sxy, sxx - syy); // ángulo del eje principal
      if (area.h > area.w) th -= Math.PI / 2;
      const c = Math.cos(-th), si = Math.sin(-th);
      for (const n of nodes) { const dx = n.x - mx, dy = n.y - my; n.x = dx * c - dy * si; n.y = dx * si + dy * c; }
    }
    const x0 = Math.min(...nodes.map((n) => n.x - n.r)), x1 = Math.max(...nodes.map((n) => n.x + n.r));
    const y0 = Math.min(...nodes.map((n) => n.y - n.r)), y1 = Math.max(...nodes.map((n) => n.y + n.r));
    const pad = rMax + 4;
    const aw = Math.max(10, area.w - pad * 2), ah = Math.max(10, area.h - pad * 2);
    let sx = aw / Math.max(1e-6, x1 - x0), sy = ah / Math.max(1e-6, y1 - y0);
    // Se permite estirar, pero sin deformar demasiado la red.
    const ratio = sx / sy;
    const lim = 2.4;
    if (ratio > lim) sx = sy * lim; else if (ratio < 1 / lim) sy = sx * lim;
    if (focusNode) {
      // Escala simétrica alrededor del nodo en foco, que queda en el centro exacto.
      const ex = Math.max(...nodes.map((n) => Math.abs(n.x) + n.r), 1e-6), ey = Math.max(...nodes.map((n) => Math.abs(n.y) + n.r), 1e-6);
      let fx = aw / 2 / ex, fy = ah / 2 / ey;
      if (fx / fy > lim) fx = fy * lim; else if (fy / fx > lim) fy = fx * lim;
      const ccx = area.x + area.w / 2, ccy = area.y + area.h / 2;
      for (const n of nodes) { n.px = ccx + n.x * fx; n.py = ccy + n.y * fy; }
    } else {
      const ox = area.x + pad + (aw - (x1 - x0) * sx) / 2, oy = area.y + pad + (ah - (y1 - y0) * sy) / 2;
      for (const n of nodes) { n.px = ox + (n.x - x0) * sx; n.py = oy + (n.y - y0) * sy; }
    }
    // Tras escalar, separa nodos que quedaron encimados.
    for (let pass = 0; pass < 6; pass++)
      for (let i = 0; i < nodes.length; i++)
        for (let j = i + 1; j < nodes.length; j++) {
          const p = nodes[i], q = nodes[j];
          const dx = q.px - p.px, dy = q.py - p.py, min = p.r + q.r + 2, d2 = dx * dx + dy * dy;
          if (d2 < min * min) { const d = Math.sqrt(d2) || 1e-6, s = ((min - d) / d) * 0.5; p.px -= dx * s; p.py -= dy * s; q.px += dx * s; q.py += dy * s; }
        }
    for (const n of nodes) {
      n.px = Math.max(area.x + n.r + 1, Math.min(area.x + area.w - n.r - 1, n.px));
      n.py = Math.max(area.y + n.r + 1, Math.min(area.y + area.h - n.r - 1, n.py));
    }
  }

  // Foco: nodos destacados y sus vecinos.
  const hl = focusNode ? new Set([focusNode.id]) : spec.highlight === undefined ? null : new Set([].concat(spec.highlight).map(String));
  const near = new Set();
  if (hl) { for (const id of hl) near.add(id); for (const e of edges) { if (hl.has(e.s)) near.add(e.t); if (hl.has(e.t)) near.add(e.s); } }
  const on = (n) => !hl || near.has(n.id);

  // Conexiones: líneas apenas curvas, ancho ∝ √peso.
  const maxE = Math.max(...edges.map((e) => e.v), 1e-9);
  const manyLinks = edges.length > 150;
  const linkG = [];
  for (const e of [...edges].sort((a, b) => a.v - b.v)) {
    const a = byId.get(e.s), b = byId.get(e.t);
    const w = 0.75 + 3.25 * Math.sqrt(e.v / maxE);
    let d;
    if (layout === 'circle') {
      const mx = (a.px + b.px) / 2, my = (a.py + b.py) / 2;
      const qx = mx + (nodes.cx - mx) * 0.55, qy = my + (nodes.cy - my) * 0.55;
      d = `M${a.px.toFixed(1)},${a.py.toFixed(1)}Q${qx.toFixed(1)},${qy.toFixed(1)} ${b.px.toFixed(1)},${b.py.toFixed(1)}`;
    } else {
      const dx = b.px - a.px, dy = b.py - a.py, len = Math.hypot(dx, dy) || 1;
      const bend = Math.min(18, len * 0.08);
      const qx = (a.px + b.px) / 2 - (dy / len) * bend, qy = (a.py + b.py) / 2 + (dx / len) * bend;
      d = `M${a.px.toFixed(1)},${a.py.toFixed(1)}Q${qx.toFixed(1)},${qy.toFixed(1)} ${b.px.toFixed(1)},${b.py.toFixed(1)}`;
    }
    const active = hl ? hl.has(e.s) || hl.has(e.t) : true;
    linkG.push(el('path', {
      class: 'pa-m', d, fill: 'none', stroke: active && hl ? theme.ink : theme.muted,
      strokeOpacity: hl ? (active ? 0.55 : 0.08) : manyLinks ? 0.22 : 0.38, strokeWidth: w, strokeLinecap: 'round',
      'data-tip': tip(`${a.label} — ${b.label}`, fmtE(e.v)),
    }));
  }
  body.push(g({ class: 'pa-links' }, linkG));

  // Nodos: grandes debajo, chicos encima; anillo del color de fondo.
  const nodeG = [];
  for (const n of [...nodes].sort((a, b) => (on(a) - on(b)) || b.r - a.r)) {
    const lines = [n.label];
    if (hasGroups && n.group) lines.push(n.group);
    lines.push(`${en ? 'Connections' : 'Conexiones'}: ${n.deg}`);
    lines.push(`${n.size !== null ? (en ? 'Size' : 'Tamaño') : en ? 'Weighted degree' : 'Grado ponderado'}: ${fmt(n.w)}`);
    const isF = focusNode && n.id === focusNode.id;
    nodeG.push(el('circle', { class: 'pa-m', cx: n.px, cy: n.py, r: n.r, fill: on(n) ? colorOf(n) : theme.dim, stroke: isF ? theme.ink : theme.surface, strokeWidth: isF ? 2.5 : theme.marks?.ring ? Math.min(2, theme.marks.ring) * 0.75 : 1.5, 'data-tip': tip(...lines), 'data-node': n.id, style: 'cursor:pointer' }));
  }
  body.push(g({ class: 'pa-nodes' }, nodeG));

  // Etiquetas con halo, sin choques: derecha → izquierda → arriba → abajo.
  const placed = nodes.map((n) => [n.px - n.r, n.py - n.r, n.px + n.r, n.py + n.r, n.id, n.r]);
  const labG = [];
  // En foco: primero el nodo central, luego sus vecinos; los nodos atenuados no bloquean etiquetas.
  const lbls = nodes.filter((n) => labelSet.has(n.id) && (on(n) || hl?.has(n.id))).sort((a, b) => (hl ? (hl.has(b.id) - hl.has(a.id)) : 0) || b.w - a.w);
  for (const n of lbls) {
    const strong = hl ? hl.has(n.id) : true;
    const weight = strong ? 600 : 500;
    const label = truncate(n.label, layout === 'circle' ? nodes.lw - 8 : 150, labelSize, weight);
    const w = measure(label, labelSize, weight), h = labelSize + 2;
    let cands;
    if (layout === 'circle') {
      const ca = Math.cos(n.angle), sa = Math.sin(n.angle);
      const lx = n.px + ca * (n.r + 6), ly = n.py + sa * (n.r + 6) + labelSize * 0.35;
      const anchor = Math.abs(ca) < 0.2 ? 'middle' : ca > 0 ? 'start' : 'end';
      const yy = Math.abs(ca) < 0.2 ? (sa < 0 ? n.py - n.r - 6 : n.py + n.r + labelSize + 2) : ly;
      cands = [[lx, yy, anchor]];
    } else {
      cands = [
        [n.px + n.r + 4, n.py + labelSize * 0.35, 'start'],
        [n.px - n.r - 4, n.py + labelSize * 0.35, 'end'],
        [n.px, n.py - n.r - 4, 'middle'],
        [n.px, n.py + n.r + labelSize + 1, 'middle'],
        [n.px + n.r * 0.75 + 3, n.py - n.r * 0.75 - 2, 'start'],
        [n.px - n.r * 0.75 - 3, n.py - n.r * 0.75 - 2, 'end'],
        [n.px + n.r * 0.75 + 3, n.py + n.r * 0.75 + labelSize, 'start'],
        [n.px - n.r * 0.75 - 3, n.py + n.r * 0.75 + labelSize, 'end'],
      ];
    }
    for (const [lx, ly, anchor] of cands) {
      const bx0 = anchor === 'start' ? lx : anchor === 'end' ? lx - w : lx - w / 2;
      const box = [bx0 - 1, ly - h + 2, bx0 + w + 1, ly + 3];
      if (box[0] < area.x - 2 || box[2] > area.x + area.w + 2 || box[1] < area.y - 4 || box[3] > area.y + area.h + 4) continue;
      // No pisa otras etiquetas ni nodos grandes; sobre nodos chicos sí (el halo la mantiene legible).
      const hit = placed.some((b) => b[4] !== n.id && (b[4] === null || (b[5] >= 7 && (!hl || near.has(b[4])))) && !(box[2] < b[0] || box[0] > b[2] || box[3] < b[1] || box[1] > b[3]));
      const must = hl && hl.has(n.id) && lx === cands[cands.length - 1][0] && ly === cands[cands.length - 1][1];
      if (hit && layout !== 'circle' && !must) continue;
      placed.push([...box, null, 0]);
      labG.push(el('text', {
        x: lx, y: ly, textAnchor: anchor, fill: hasGroups ? readable(colorOf(n), theme) : theme.ink, fontSize: labelSize, fontWeight: weight,
        stroke: theme.surface, strokeWidth: 3, paintOrder: 'stroke', strokeLinejoin: 'round',
      }, label.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])));
      break;
    }
  }
  body.push(g({ class: 'pa-labels' }, labG));

  const top = [...nodes].sort((a, b) => b.deg - a.deg || b.w - a.w).slice(0, 3);
  const desc = en
    ? `Network of ${nodes.length} nodes and ${edges.length} connections. Most connected: ${top.map((n) => `${n.label} (${n.deg})`).join(', ')}.`
    : `Red de ${nodes.length} nodos y ${edges.length} conexiones. Más conectados: ${top.map((n) => `${n.label} (${n.deg})`).join(', ')}.`;
  return frame.finish(body, { desc, type: 'network' });
}
