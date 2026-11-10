// Dendrograma: cómo se agrupan las cosas, y a qué altura se juntan.
//
// Entra un árbol ya calculado —filas { id, parent, height } o una matriz de
// enlace de scipy (`linkage`) con sus `labels`—; la biblioteca no agrupa nada
// por su cuenta. `cut` corta a una altura: cada subárbol bajo el corte es un
// grupo con su color de la paleta categórica (y su nombre en `clusters`), y lo
// que queda sobre el corte va en gris. Las hojas se rotulan si caben; si no,
// se rotula una de cada k (`labels: "auto"`) y, con corte, el nombre de cada
// grupo a lo largo de sus hojas.
//
// Con filas: `series` colorea las hojas por un campo (una muestra al pie de cada
// hoja, sin necesitar `cut`), `size` es su peso (una barra con la cifra junto
// al nombre; los nodos internos suman), `sub` una segunda línea bajo el nombre
// y `xLabel` el título del eje de alturas. Los tooltips pasan por `tipper`:
// hojas siempre; con `tooltip`, también cada unión (altura, hojas, peso).
import { el, g, text, tip } from '../svg.js';
import { tipper } from '../tooltip.js';
import { measure, truncate } from '../text.js';
import { makeFormat } from '../format.js';
import { colorMap } from '../theme.js';
import { niceDomain, linear } from '../scale.js';
import { requireField, PlotError, num, fieldsOf } from '../data.js';
import { createFrame } from '../frame.js';
import { langOf } from '../i18n.js';
import { leaves, elbows, cutTree, fromLinkage, fromParents } from '../tree.js';

export function dendrogram(spec, theme) {
  const locale = spec.locale || 'es';
  const en = langOf(locale) === 'en';

  // El árbol, de una de las dos entradas.
  let tree, name;
  let rows = [];
  const rowOf = new Map();
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
      rows = data;
      for (const r of data) rowOf.set(String(r[idF]), r);
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
  const T = tipper(spec, rows, locale);
  const rowsOfLeaf = (l) => (rowOf.has(String(l)) ? [rowOf.get(String(l))] : []);

  // Campos de las hojas (sólo con filas): color, peso y segunda línea.
  const rf = fieldsOf(rows);
  const colorField = typeof spec.color === 'string' && rf.includes(spec.color) ? spec.color : null;
  const seriesF = rows.length ? spec.series ?? spec.hue ?? colorField : null;
  const sizeF = rows.length && typeof spec.size === 'string' ? spec.size : null;
  const subF = rows.length && typeof spec.sub === 'string' ? spec.sub : null;
  if (seriesF) requireField(rows, seriesF, 'series');
  if (sizeF) requireField(rows, sizeF, 'size');
  if (subF) requireField(rows, subF, 'sub');
  const field = (l, f) => { const r = rowOf.get(String(l)); const v = r ? r[f] : undefined; return v === undefined || v === null || v === '' ? null : v; };
  const catOf = (l) => (seriesF && field(l, seriesF) !== null ? String(field(l, seriesF)) : null);
  const weightOf = (l) => { const v = sizeF ? num(field(l, sizeF)) : NaN; return Number.isFinite(v) ? v : null; };
  const subOf = (l) => (subF && field(l, subF) !== null ? String(field(l, subF)) : null);

  // Grupos bajo el corte.
  const cut = Number.isFinite(+spec.cut) && spec.cut !== null && spec.cut !== undefined ? +spec.cut : null;
  const groups = cut !== null ? cutTree(tree, cut) : [];
  const gName = (i) => (Array.isArray(spec.clusters) && spec.clusters[i] !== undefined ? String(spec.clusters[i]) : (en ? `Group ${i + 1}` : `Grupo ${i + 1}`));
  const gNames = groups.map((_, i) => gName(i));
  const cmap = colorMap(gNames, theme, spec.colors);
  // Color por campo: en el orden en que aparecen las hojas.
  const cats = seriesF ? [...new Set(order.map(catOf).filter((c) => c !== null))] : [];
  const smap = colorMap(cats, theme, spec.colors);
  const leafColor = (l) => (catOf(l) !== null ? smap.get(catOf(l)) : null);
  const weights = sizeF ? order.map(weightOf).filter((v) => v !== null) : [];
  const maxWt = Math.max(0, ...weights);
  const fmtW = makeFormat(spec.sizeFormat, locale, weights);
  const sizeName = sizeF ? String(sizeF).replace(/[_-]+/g, ' ').replace(/^./, (ch) => ch.toUpperCase()) : '';
  const groupOf = new Map();
  groups.forEach((nd, i) => { for (const l of leaves(nd)) groupOf.set(l, i); });
  const nodeGroup = new Map();
  groups.forEach((nd, i) => { const mark = (x) => { nodeGroup.set(x, i); if (x.left) { mark(x.left); mark(x.right); } }; mark(nd); });

  // Medidas.
  const fs = 11.5;
  const lblMode = spec.labels === undefined || Array.isArray(spec.labels) ? 'auto' : spec.labels;
  // Con segunda línea cada hoja pide el doble de alto.
  const twoLines = horizontal && subF && order.some((l) => subOf(l) !== null);
  const rowH = twoLines ? 34 : 16;
  const frame = createFrame(spec, theme, { height: horizontal ? Math.min(twoLines ? 1400 : 900, 80 + n * rowH) : 420 });
  const legend = cats.length && spec.legend !== false ? cats.map((c) => ({ label: c, color: smap.get(c) })) : [];
  const area = frame.layout(legend);
  const leafSpan0 = horizontal ? area.h - 30 : area.w;
  let gap = leafSpan0 / n;
  // Alto automático en horizontal: 16 px por hoja hasta 900, después se ralea.
  // Muestra de color al pie de cada hoja.
  const swW = cats.length ? 9 : 0;
  const fsSub = 11;
  // Columna de pesos (horizontal): barra ∝ peso y la cifra.
  const barMax = sizeF && horizontal && maxWt > 0 ? Math.min(60, area.w * 0.1) : 0;
  const weightW = barMax ? barMax + 8 + Math.max(...weights.map((v) => measure(fmtW(v), 11))) + 6 : 0;
  const groupLabel = (i) => `${gNames[i]} · ${leaves(groups[i]).length}`;
  const groupW = groups.length && horizontal ? Math.min(area.w * 0.25, Math.max(...groups.map((_, i) => measure(groupLabel(i), fs, 600)))) + 16 : 0;
  // Columna de nombres: hasta el 30 % del ancho (120 px en vertical), o hasta
  // `labelWidth` px. `treeWidth` (horizontal) fija el ancho del árbol y deja
  // a los nombres todo lo demás.
  const posNum = (v) => (Number.isFinite(+v) && v !== null && +v > 0 ? +v : null);
  const treeW = horizontal ? posNum(spec.treeWidth) : null;
  const labCap = treeW !== null ? Math.max(40, area.w - treeW - groupW - weightW - 8 - swW - 14) : posNum(spec.labelWidth) ?? (horizontal ? area.w * 0.3 : 120);
  const labW = (lblMode === false ? 0 : Math.min(labCap, Math.max(...order.map((l) => Math.max(measure(name(l), fs), twoLines && subOf(l) !== null ? measure(subOf(l), fsSub) : 0)))) + 14) + swW;
  const hTitle = horizontal ? spec.xLabel ?? spec.yLabel : spec.yLabel ?? spec.xLabel;
  const axisH = 26 + (hTitle && horizontal ? 16 : 0);
  const inner = horizontal
    ? { x: area.x, y: area.y, w: treeW !== null ? Math.max(60, Math.min(treeW, area.w - labW - groupW - weightW - 8)) : Math.max(60, area.w - labW - groupW - weightW - 8), h: n * gap }
    : { x: area.x, y: area.y + (hTitle ? 16 : 0), w: area.w - groupW, h: Math.max(60, area.h - labW - axisH - (hTitle ? 16 : 0)) };
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

  // Título del eje de alturas.
  if (hTitle) {
    body.push(horizontal
      ? text(inner.x, inner.y + inner.h + 36, String(hTitle), { fill: theme.muted, fontSize: 11 })
      : text(inner.x, inner.y - 10, String(hTitle), { fill: theme.muted, fontSize: 11 }));
  }

  // Con `tooltip`, cada unión lleva su tarjeta: altura, hojas y peso.
  if (spec.tooltip !== undefined && spec.tooltip !== null && spec.tooltip !== false) {
    const hits = [];
    const walk = (nd) => {
      if (!nd.left) return leafPos.get(nd.leaf);
      const pl = walk(nd.left), pr = walk(nd.right);
      if (nd.id !== undefined || !rows.length) {
        const ls = leaves(nd);
        const ws = ls.map(weightOf).filter((v) => v !== null);
        const r = nd.id !== undefined && rowOf.has(nd.id) ? [rowOf.get(nd.id)] : [];
        const count = en ? `${ls.length} leaves` : `${ls.length} hojas`;
        const title = nd.id !== undefined ? name(nd.id) : count;
        const t = T(r, title, `${en ? 'Height' : 'Altura'}: ${fmt(nd.h)}`, nd.id !== undefined ? count : '', ws.length ? `${sizeName}: ${fmtW(ws.reduce((a, b) => a + b, 0))}` : '');
        const p = hs(nd.h), a = Math.min(pl, pr), b = Math.max(pl, pr);
        if (t) hits.push(horizontal
          ? el('rect', { class: 'pa-m', x: p - 4, y: a, width: 8, height: Math.max(1, b - a), fill: 'transparent', 'data-tip': t })
          : el('rect', { class: 'pa-m', x: a, y: p - 4, width: Math.max(1, b - a), height: 8, fill: 'transparent', 'data-tip': t }));
      }
      return (pl + pr) / 2;
    };
    walk(tree);
    body.push(g({ class: 'pa-joins' }, hits));
  }

  // Corte.
  if (cut !== null && cut < maxH) {
    const p = hs(cut);
    body.push(horizontal
      ? el('line', { x1: p, x2: p, y1: inner.y - 4, y2: inner.y + inner.h, stroke: theme.ink, strokeWidth: 1, strokeDasharray: '4 3', opacity: 0.6 })
      : el('line', { x1: inner.x, x2: inner.x + inner.w, y1: p, y2: p, stroke: theme.ink, strokeWidth: 1, strokeDasharray: '4 3', opacity: 0.6 }));
  }

  // Rótulos de hojas: todas si caben; si no, una de cada k.
  const need = twoLines ? fs + fsSub + 6 : fs + 2;
  const every = lblMode === true ? 1 : lblMode === false ? 0 : Math.max(1, Math.ceil(need / gap));
  order.forEach((l, i) => {
    const pos = leafPos.get(l);
    const gi = groupOf.get(l);
    const lc = leafColor(l);
    const c = gi !== undefined ? cmap.get(gNames[gi]) : lc ?? theme.muted;
    const w = weightOf(l), sub = twoLines ? subOf(l) : null;
    const lines = [name(l), gi !== undefined ? gNames[gi] : ''];
    if (seriesF && catOf(l) !== null) lines.push(catOf(l));
    if (w !== null) lines.push(`${sizeName}: ${fmtW(w)}`);
    if (subF && subOf(l) !== null) lines.push(subOf(l));
    const hit = horizontal
      ? el('rect', { x: inner.x + inner.w, y: pos - gap / 2, width: labW + weightW, height: gap, fill: 'transparent' })
      : el('rect', { x: pos - gap / 2, y: inner.y + inner.h, width: gap, height: labW, fill: 'transparent' });
    const parts = [hit];
    if (lc) {
      const sh = Math.max(2, Math.min(gap - 3, 26));
      parts.push(horizontal
        ? el('rect', { x: inner.x + inner.w + 2, y: pos - sh / 2, width: 5, height: sh, rx: 1.5, fill: lc })
        : el('rect', { x: pos - sh / 2, y: inner.y + inner.h + 2, width: sh, height: 5, rx: 1.5, fill: lc }));
    }
    if (every && i % every === 0) {
      const s = truncate(name(l), labW - 6 - swW, fs);
      parts.push(horizontal
        ? text(inner.x + inner.w + 6 + swW, sub !== null ? pos - 2 : pos + 4, s, { fill: sub !== null ? theme.ink : theme.lede, fontSize: fs })
        : text(pos + 4, inner.y + inner.h + 6 + swW, s, { fill: theme.lede, fontSize: fs, transform: `rotate(90 ${(pos + 4).toFixed(2)} ${(inner.y + inner.h + 6 + swW).toFixed(2)})` }));
      if (sub !== null) parts.push(text(inner.x + inner.w + 6 + swW, pos + 12, truncate(sub, labW - 6 - swW, fsSub), { fill: theme.lede, fontSize: fsSub }));
    }
    if (barMax && w !== null) {
      const x0 = inner.x + inner.w + labW + 4, bw = Math.max(w > 0 ? 1 : 0, (barMax * w) / maxWt), bh = Math.min(8, gap * 0.45);
      parts.push(el('rect', { x: x0, y: pos - bh / 2, width: bw, height: bh, rx: 1, fill: lc ?? theme.muted }));
      parts.push(text(x0 + bw + 4, pos + 4, fmtW(w), { fill: theme.lede, fontSize: 11 }));
    }
    body.push(g({ class: 'pa-m', 'data-tip': T(rowsOfLeaf(l), ...lines), 'data-color': c }, parts));
  });

  // Nombre de cada grupo, a lo largo de sus hojas.
  groups.forEach((ndG, i) => {
    const ls = leaves(ndG);
    const a = leafPos.get(ls[0]) - gap / 2, b = leafPos.get(ls[ls.length - 1]) + gap / 2;
    const c = cmap.get(gNames[i]);
    const label = groupLabel(i);
    if (horizontal) {
      const x0 = inner.x + inner.w + labW + weightW + 4;
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
