// Dendrograma: cómo se agrupan las cosas, y a qué altura se juntan.
//
// Entra un árbol ya calculado —filas { id, parent, height } o una matriz de
// enlace de scipy (`linkage`) con sus `labels`—; la biblioteca no agrupa nada
// por su cuenta. `cut` corta a una altura: cada subárbol bajo el corte es un
// grupo con su color de la paleta categórica (y su nombre en `clusters`), y lo
// que queda sobre el corte va en gris. Las hojas se rotulan si caben; si no,
// se rotula una de cada k (`labels: "auto"`) y, con corte, el nombre de cada
// grupo a lo largo de sus hojas.
import { el, g, text, tip } from '../svg.js';
import { measure, truncate } from '../text.js';
import { makeFormat } from '../format.js';
import { colorMap } from '../theme.js';
import { niceDomain, linear } from '../scale.js';
import { requireField, PlotError } from '../data.js';
import { createFrame } from '../frame.js';
import { langOf } from '../i18n.js';
import { leaves, elbows, cutTree, fromLinkage, fromParents } from '../tree.js';

export function dendrogram(spec, theme) {
  const locale = spec.locale || 'es';
  const en = langOf(locale) === 'en';

  // El árbol, de una de las dos entradas.
  let tree, name;
  try {
    if (Array.isArray(spec.linkage)) {
      const n = spec.linkage.length + 1;
      const labels = Array.isArray(spec.labels) ? spec.labels.map(String) : null;
      if (labels && labels.length !== n) throw new PlotError(en ? `linkage has ${n} leaves but labels has ${labels.length}.` : `linkage tiene ${n} hojas y labels tiene ${labels.length}.`, en ? 'Pass one label per observation, in input order.' : 'Pasa un rótulo por observación, en el orden de entrada.');
      tree = fromLinkage(spec.linkage, n);
      name = (leaf) => (labels ? labels[leaf] : String(leaf));
    } else {
      const data = Array.isArray(spec.data) ? spec.data : [];
      if (!data.length) throw new PlotError(en ? 'A dendrogram needs `data` (rows id, parent, height) or `linkage`.' : 'Un dendrograma necesita `data` (filas id, parent, height) o `linkage`.', 'data: [{ id: "A", parent: "AB", height: 0 }, { id: "AB", parent: null, height: 1.2 }]');
      const idF = spec.id ?? 'id', parentF = spec.parent ?? 'parent', hF = spec.height_field ?? spec.heightField ?? 'height';
      requireField(data, idF, 'id');
      requireField(data, parentF, 'parent');
      const labelF = typeof spec.label === 'string' ? spec.label : null;
      const lab = new Map(labelF ? data.map((r) => [String(r[idF]), String(r[labelF] ?? r[idF])]) : []);
      tree = fromParents(data, idF, parentF, hF);
      name = (leaf) => lab.get(leaf) ?? String(leaf);
    }
  } catch (e) {
    if (e instanceof PlotError) throw e;
    throw new PlotError(e.message, en ? 'Check that every parent exists and there are no cycles.' : 'Revisa que cada padre exista y que no haya ciclos.');
  }

  const order = leaves(tree);
  const n = order.length;
  const maxH = tree.h || 1;
  const horizontal = (spec.orientation ?? 'horizontal') !== 'vertical';
  const fmt = makeFormat(spec.format, locale, [0, maxH]);

  // Grupos bajo el corte.
  const cut = Number.isFinite(+spec.cut) && spec.cut !== null && spec.cut !== undefined ? +spec.cut : null;
  const groups = cut !== null ? cutTree(tree, cut) : [];
  const gName = (i) => (Array.isArray(spec.clusters) && spec.clusters[i] !== undefined ? String(spec.clusters[i]) : (en ? `Group ${i + 1}` : `Grupo ${i + 1}`));
  const gNames = groups.map((_, i) => gName(i));
  const cmap = colorMap(gNames, theme, spec.colors);
  const groupOf = new Map();
  groups.forEach((nd, i) => { for (const l of leaves(nd)) groupOf.set(l, i); });
  const nodeGroup = new Map();
  groups.forEach((nd, i) => { const mark = (x) => { nodeGroup.set(x, i); if (x.left) { mark(x.left); mark(x.right); } }; mark(nd); });

  // Medidas.
  const fs = 11.5;
  const lblMode = spec.labels === undefined || Array.isArray(spec.labels) ? 'auto' : spec.labels;
  const frame = createFrame(spec, theme, { height: horizontal ? Math.min(900, 80 + n * 16) : 420 });
  const legend = [];
  const area = frame.layout(legend);
  const leafSpan0 = horizontal ? area.h - 30 : area.w;
  let gap = leafSpan0 / n;
  // Alto automático en horizontal: 16 px por hoja hasta 900, después se ralea.
  const labW = lblMode === false ? 0 : Math.min(horizontal ? area.w * 0.3 : 120, Math.max(...order.map((l) => measure(name(l), fs)))) + 14;
  const groupLabel = (i) => `${gNames[i]} · ${leaves(groups[i]).length}`;
  const groupW = groups.length && horizontal ? Math.min(area.w * 0.25, Math.max(...groups.map((_, i) => measure(groupLabel(i), fs, 600)))) + 16 : 0;
  const axisH = 26;
  const inner = horizontal
    ? { x: area.x, y: area.y, w: Math.max(60, area.w - labW - groupW - 8), h: n * gap }
    : { x: area.x, y: area.y, w: area.w - groupW, h: Math.max(60, area.h - labW - axisH) };
  if (!horizontal) gap = inner.w / n;
  if (spec.height === undefined && horizontal) frame.setHeight(inner.y + inner.h + axisH + frame.chrome);

  const leafPos = new Map(order.map((l, i) => [l, (horizontal ? inner.y : inner.x) + gap * (i + 0.5)]));
  // Raíz a la izquierda (horizontal) o arriba (vertical); hojas en el borde opuesto.
  const hs = horizontal ? linear(maxH, 0, inner.x, inner.x + inner.w) : linear(maxH, 0, inner.y, inner.y + inner.h);

  const body = [];
  const colorOf = (nd) => (nodeGroup.has(nd) ? cmap.get(gNames[nodeGroup.get(nd)]) : theme.muted);
  for (const { color, d } of elbows(tree, (l) => leafPos.get(l), (h) => hs(h), { horizontal, colorOf: cut !== null ? colorOf : () => theme.muted })) {
    body.push(el('path', { d, fill: 'none', stroke: color, strokeWidth: n > 150 ? 1 : 1.4, strokeLinejoin: 'round' }));
  }

  // Eje de alturas.
  const nd = niceDomain(0, maxH, 4);
  const ticks = [];
  for (let t = nd.min; t <= maxH + 1e-9; t += nd.step) ticks.push(t);
  for (const t of ticks) {
    const p = hs(t);
    body.push(horizontal
      ? text(p, inner.y + inner.h + 18, fmt(t), { fill: theme.muted, fontSize: 11, textAnchor: 'middle' })
      : text(inner.x - 6, p + 4, fmt(t), { fill: theme.muted, fontSize: 11, textAnchor: 'end' }));
  }

  // Corte.
  if (cut !== null && cut < maxH) {
    const p = hs(cut);
    body.push(horizontal
      ? el('line', { x1: p, x2: p, y1: inner.y - 4, y2: inner.y + inner.h, stroke: theme.ink, strokeWidth: 1, strokeDasharray: '4 3', opacity: 0.6 })
      : el('line', { x1: inner.x, x2: inner.x + inner.w, y1: p, y2: p, stroke: theme.ink, strokeWidth: 1, strokeDasharray: '4 3', opacity: 0.6 }));
  }

  // Rótulos de hojas: todas si caben; si no, una de cada k.
  const need = horizontal ? fs + 2 : fs + 2;
  const every = lblMode === true ? 1 : lblMode === false ? 0 : Math.max(1, Math.ceil(need / gap));
  order.forEach((l, i) => {
    const pos = leafPos.get(l);
    const gi = groupOf.get(l);
    const c = gi !== undefined ? cmap.get(gNames[gi]) : theme.muted;
    const lines = [name(l), gi !== undefined ? gNames[gi] : ''];
    const hit = horizontal
      ? el('rect', { x: inner.x + inner.w, y: pos - gap / 2, width: labW, height: gap, fill: 'transparent' })
      : el('rect', { x: pos - gap / 2, y: inner.y + inner.h, width: gap, height: labW, fill: 'transparent' });
    const parts = [hit];
    if (every && i % every === 0) {
      const s = truncate(name(l), labW - 6, fs);
      parts.push(horizontal
        ? text(inner.x + inner.w + 6, pos + 4, s, { fill: theme.lede, fontSize: fs })
        : text(pos + 4, inner.y + inner.h + 6, s, { fill: theme.lede, fontSize: fs, transform: `rotate(90 ${(pos + 4).toFixed(2)} ${(inner.y + inner.h + 6).toFixed(2)})` }));
    }
    body.push(g({ class: 'pa-m', 'data-tip': tip(...lines), 'data-color': c }, parts));
  });

  // Nombre de cada grupo, a lo largo de sus hojas.
  groups.forEach((ndG, i) => {
    const ls = leaves(ndG);
    const a = leafPos.get(ls[0]) - gap / 2, b = leafPos.get(ls[ls.length - 1]) + gap / 2;
    const c = cmap.get(gNames[i]);
    const label = groupLabel(i);
    if (horizontal) {
      const x0 = inner.x + inner.w + labW + 4;
      body.push(g({ class: 'pa-m', 'data-tip': tip(gNames[i], en ? `${ls.length} leaves` : `${ls.length} hojas`) }, [
        el('rect', { x: x0, y: a + 1, width: 3, height: Math.max(1, b - a - 2), rx: 1.5, fill: c }),
        b - a >= fs + 2 ? text(x0 + 8, (a + b) / 2 + 4, truncate(label, groupW - 10, fs, 600), { fill: theme.ink, fontSize: fs, fontWeight: 600 }) : '',
      ]));
    } else {
      const y0 = inner.y + inner.h + labW + 4;
      body.push(g({ class: 'pa-m', 'data-tip': tip(gNames[i], en ? `${ls.length} leaves` : `${ls.length} hojas`) }, [
        el('rect', { x: a + 1, y: y0, width: Math.max(1, b - a - 2), height: 3, rx: 1.5, fill: c }),
        b - a >= measure(label, fs, 600) + 4 ? text((a + b) / 2, y0 + 16, label, { fill: theme.ink, fontSize: fs, fontWeight: 600, textAnchor: 'middle' }) : '',
      ]));
    }
  });
  if (!horizontal && spec.height === undefined && groups.length) frame.setHeight(Math.max(frame.height, inner.y + inner.h + labW + 26 + frame.chrome));

  const desc = en
    ? `Dendrogram of ${n} leaves, joined up to height ${fmt(maxH)}.` + (groups.length ? ` Cut at ${fmt(cut)} gives ${groups.length} groups; largest: ${gNames[groups.map((x) => leaves(x).length).indexOf(Math.max(...groups.map((x) => leaves(x).length)))]}.` : '')
    : `Dendrograma de ${n} hojas, unidas hasta la altura ${fmt(maxH)}.` + (groups.length ? ` El corte en ${fmt(cut)} da ${groups.length} grupos; el mayor: ${gNames[groups.map((x) => leaves(x).length).indexOf(Math.max(...groups.map((x) => leaves(x).length)))]}.` : '');
  return frame.finish(body, { desc, type: 'dendrogram' });
}
