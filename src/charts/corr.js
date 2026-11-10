// Matrices de relación al estilo seaborn / pandas:
//   corr      matriz de correlación (df.corr() + sns.heatmap con máscara triangular)
//   clustermap  la misma matriz reordenada por agrupamiento jerárquico, con dendrograma
//   pairplot  matriz de dispersión: dispersión abajo, distribución en la diagonal, r arriba
// La escala de color es divergente y SIEMPRE simétrica en [-1, 1]: el mismo
// color significa la misma fuerza en cualquier gráfico.
import { el, g, text, tip, barPath, dotLayer } from '../svg.js';
import { measure, truncate } from '../text.js';
import { makeFormat, formatNumber } from '../format.js';
import { ramp, textOn, colorMap, readable } from '../theme.js';
import { ensureData, requireField, uniq, num, fieldsOf, fieldKind, humanize, PlotError } from '../data.js';
import { createFrame } from '../frame.js';
import { leaves, elbows } from '../tree.js';
import { ctx } from '../context.js';
import { pearson, polyfit, histogram, kde as kdeEst } from '../stats.js';
import { hueField, axisDomain, tickFmt } from './dist.js';

const isEN = (spec) => String(spec.locale || 'es').startsWith('en');
const halo = (theme) => ({ stroke: theme.surface, strokeWidth: 3, paintOrder: 'stroke', strokeLinejoin: 'round' });

// ── Estadística ────────────────────────────────────────────────────────────

/** Rangos con empates promediados (para Spearman). */
function ranks(vs) {
  const idx = vs.map((_, i) => i).sort((a, b) => vs[a] - vs[b]);
  const out = new Array(vs.length);
  for (let i = 0; i < idx.length;) {
    let j = i;
    while (j + 1 < idx.length && vs[idx[j + 1]] === vs[idx[i]]) j++;
    const avg = (i + j) / 2 + 1;
    for (let t = i; t <= j; t++) out[idx[t]] = avg;
    i = j + 1;
  }
  return out;
}

/** Φ(z) (Abramowitz–Stegun 7.1.26, error < 1,5e-7). */
function normCdf(z) {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
}

/** ln Γ(x) (Lanczos, g = 7). */
function lnGamma(x) {
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  x -= 1;
  let a = c[0];
  const t = x + 7.5;
  for (let i = 1; i < 9; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

/** Beta incompleta regularizada I_x(a, b) (fracción continua de Lentz). */
function betaInc(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(lnGamma(a + b) - lnGamma(a) - lnGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  const cf = (xx, aa, bb) => {
    const tiny = 1e-300;
    let c = 1, d = 1 - ((aa + bb) * xx) / (aa + 1);
    d = 1 / (Math.abs(d) < tiny ? tiny : d);
    let h = d;
    for (let m = 1; m <= 200; m++) {
      const m2 = 2 * m;
      let k = (m * (bb - m) * xx) / ((aa + m2 - 1) * (aa + m2));
      d = 1 + k * d; d = 1 / (Math.abs(d) < tiny ? tiny : d);
      c = 1 + k / c; if (Math.abs(c) < tiny) c = tiny;
      h *= d * c;
      k = (-(aa + m) * (aa + bb + m) * xx) / ((aa + m2) * (aa + m2 + 1));
      d = 1 + k * d; d = 1 / (Math.abs(d) < tiny ? tiny : d);
      c = 1 + k / c; if (Math.abs(c) < tiny) c = tiny;
      const del = d * c;
      h *= del;
      if (Math.abs(del - 1) < 1e-14) break;
    }
    return h;
  };
  return x < (a + 1) / (a + b + 2) ? (front * cf(x, a, b)) / a : 1 - (front * cf(1 - x, b, a)) / b;
}

/**
 * p bilateral de H0: ρ = 0, con la t de Student de n − 2 grados de libertad
 * (la misma de scipy.stats.pearsonr / spearmanr y de pandas). La aproximación
 * normal de Fisher se queda corta con pocas filas y cambia quién pasa `alpha`.
 */
function pValue(r, n) {
  if (!Number.isFinite(r) || n < 3) return NaN;
  if (Math.abs(r) >= 1) return 0;
  // x = df / (df + t²) = 1 − r²
  return betaInc(1 - r * r, (n - 2) / 2, 0.5);
}

/** Campos numéricos a correlacionar: `vars`, `y: [...]` o todas las medidas. */
export function corrVars(spec, data) {
  const list = spec.vars ?? (Array.isArray(spec.y) ? spec.y : null);
  if (list) {
    for (const f of list) requireField(data, f, 'vars');
    return uniq(list.map(String));
  }
  const hue = hueField(spec);
  return fieldsOf(data).filter((f) => f !== hue && f !== spec.label && fieldKind(data, f) === 'number');
}

/**
 * Correlaciones por pares (casos completos de cada par).
 * Devuelve { r, n, p } como matrices k × k. Un par sin variación da NaN.
 */
export function correlations(data, vars, method = 'pearson') {
  const cols = vars.map((f) => data.map((row) => num(row[f])));
  const k = vars.length;
  const M = () => Array.from({ length: k }, () => new Array(k).fill(NaN));
  const r = M(), n = M(), p = M();
  for (let i = 0; i < k; i++) {
    const c = cols[i].filter(Number.isFinite);
    const varies = c.some((v) => v !== c[0]);
    r[i][i] = varies ? 1 : NaN; n[i][i] = c.length; p[i][i] = varies ? 0 : NaN;
    for (let j = i + 1; j < k; j++) {
      const xs = [], ys = [];
      for (let t = 0; t < data.length; t++) {
        const a = cols[i][t], b = cols[j][t];
        if (Number.isFinite(a) && Number.isFinite(b)) { xs.push(a); ys.push(b); }
      }
      const m = xs.length;
      let v = NaN;
      if (m >= 3 && xs.some((x) => x !== xs[0]) && ys.some((y) => y !== ys[0])) {
        v = method === 'spearman' ? pearson(ranks(xs), ranks(ys)) : pearson(xs, ys);
        v = Math.max(-1, Math.min(1, v));
      }
      r[i][j] = r[j][i] = v;
      n[i][j] = n[j][i] = m;
      p[i][j] = p[j][i] = pValue(v, m);
    }
  }
  return { r, n, p };
}

/**
 * Agrupamiento jerárquico aglomerativo (enlace promedio, distancia 1 − r),
 * como el de sns.clustermap. Devuelve el árbol: hojas { leaf }, nodos { left, right, h }.
 */
export function clusterTree(r, idx = r.map((_, i) => i)) {
  let nodes = idx.map((i) => ({ leaf: i, members: [i], h: 0 }));
  const dist = (A, B) => {
    let s = 0, c = 0;
    for (const a of A.members) for (const b of B.members) { const v = r[a][b]; if (Number.isFinite(v)) { s += 1 - v; c++; } }
    return c ? s / c : 2;
  };
  while (nodes.length > 1) {
    let best = [0, 1, Infinity];
    for (let a = 0; a < nodes.length; a++) for (let b = a + 1; b < nodes.length; b++) {
      const d = dist(nodes[a], nodes[b]);
      if (d < best[2] - 1e-12) best = [a, b, d];
    }
    const [a, b, d] = best;
    const node = { left: nodes[a], right: nodes[b], h: Math.max(d, nodes[a].h, nodes[b].h), members: [...nodes[a].members, ...nodes[b].members] };
    nodes = nodes.filter((_, i) => i !== a && i !== b);
    nodes.splice(a, 0, node);
  }
  return nodes[0];
}


// ── corr / clustermap ──────────────────────────────────────────────────────

/**
 * Matriz de correlación. Desde filas crudas (`vars` o todas las medidas) o
 * desde una matriz ya calculada en formato largo (`x`, `y`, `value`).
 * Opciones: method ("pearson" | "spearman"), triangle ("lower" | "full"),
 * cluster (reordena y dibuja el dendrograma), alpha (apaga las no significativas),
 * highlight (una variable), labels, cellSize.
 */
export function corr(spec, theme) {
  const data = ensureData(spec);
  const en = isEN(spec);
  const locale = spec.locale || 'es';
  const method = String(spec.method || 'pearson').toLowerCase() === 'spearman' ? 'spearman' : 'pearson';
  const long = typeof spec.x === 'string' && typeof spec.y === 'string' && typeof spec.value === 'string';

  let vars, R, N, P;
  if (long) {
    requireField(data, spec.x, 'x'); requireField(data, spec.y, 'y'); requireField(data, spec.value, 'value');
    vars = uniq([...data.map((row) => String(row[spec.x])), ...data.map((row) => String(row[spec.y]))]);
    const at = new Map(vars.map((v, i) => [v, i]));
    const k = vars.length;
    R = Array.from({ length: k }, (_, i) => Array.from({ length: k }, (_, j) => (i === j ? 1 : NaN)));
    N = R.map((row) => row.map(() => NaN));
    P = N.map((row) => [...row]);
    for (const row of data) {
      const i = at.get(String(row[spec.x])), j = at.get(String(row[spec.y])), v = num(row[spec.value]);
      if (!Number.isFinite(v)) continue;
      R[i][j] = v;
      if (!Number.isFinite(R[j][i]) || i === j) R[j][i] = v;
    }
  } else {
    vars = corrVars(spec, data);
    ({ r: R, n: N, p: P } = correlations(data, vars, method));
  }
  if (vars.length < 2) {
    throw en
      ? new PlotError('A correlation matrix needs at least two numeric fields.', 'Pass rows with two or more measures, or list them in `vars: ["price", "area", "age"]`.')
      : new PlotError('La matriz de correlación necesita al menos dos campos numéricos.', 'Entrega filas con dos o más medidas, o indícalas en `vars: ["precio", "superficie", "antiguedad"]`.');
  }
  const name = (i) => (spec.labelsFor && spec.labelsFor[vars[i]]) || (long ? vars[i] : humanize(vars[i]));

  // Orden: agrupamiento jerárquico, lista explícita o el de los datos.
  const k = vars.length;
  let tree = null;
  let order = vars.map((_, i) => i);
  if (spec.cluster && k > 2) { tree = clusterTree(R); order = leaves(tree); }
  else if (Array.isArray(spec.order)) {
    const pos = (i) => { const a = spec.order.indexOf(vars[i]); return a < 0 ? spec.order.indexOf(name(i)) : a; };
    order = [...order].sort((a, b) => ((pos(a) + 1 || 1e9) - (pos(b) + 1 || 1e9)) || a - b);
  }
  const triangle = spec.triangle === false ? 'full' : spec.triangle === true ? 'lower' : (spec.triangle ?? (spec.cluster ? 'full' : 'lower'));
  const full = triangle === 'full' || k === 2 && triangle !== 'lower';
  const rows = full ? order : order.slice(1);
  const cols = full ? order : order.slice(0, -1);
  const showDendro = !!tree && full && spec.dendrogram !== false;

  // Escala: [-1, 1] para correlaciones; simétrica alrededor de 0 si la matriz trae otra cosa (covarianzas).
  const vals = R.flat().filter(Number.isFinite);
  const span = long ? Math.max(1, ...vals.map(Math.abs)) : 1;
  const stops = theme.diverging;
  const colorOf = (v) => (Number.isFinite(v) ? ramp(stops, 0.5 + v / span / 2) : theme.tint);
  const dec = (v) => formatNumber(v, span > 1 ? 1 : 2, locale);
  const fmt = long && span > 1 ? makeFormat(spec.format, locale, vals) : dec;
  const endFmt = (v) => (span === 1 ? formatNumber(v, 0, locale) : fmt(v));
  const alpha = Number.isFinite(+spec.alpha) && +spec.alpha > 0 && +spec.alpha < 1 ? +spec.alpha : null;
  const insignificant = (i, j) => alpha !== null && i !== j && Number.isFinite(P[i][j]) && P[i][j] >= alpha;
  const sym = method === 'spearman' ? 'ρ' : 'r';
  const pText = (p) => (Number.isFinite(p) ? (p < 0.001 ? `p < ${formatNumber(0.001, 3, locale)}` : `p = ${formatNumber(p, p < 0.01 ? 3 : 2, locale)}`) : '');

  const hl = new Set([].concat(spec.highlight ?? []).map(String));
  const isHL = (i) => hl.has(vars[i]) || hl.has(name(i));
  const anyHL = hl.size > 0 && vars.some((_, i) => isHL(i));

  const rampTitle = spec.legendTitle ?? (long ? humanize(spec.value) : method === 'spearman' ? (en ? 'Spearman ρ' : 'ρ de Spearman') : (en ? 'Pearson r' : 'r de Pearson'));
  const legend = spec.legend === false ? [] : [
    { type: 'ramp', stops, min: endFmt(-span), max: endFmt(span), title: rampTitle },
    ...(alpha !== null ? [{ label: en ? `p ≥ ${formatNumber(alpha, 2, locale)}: not significant` : `p ≥ ${formatNumber(alpha, 2, locale)}: no significativa`, color: theme.tint }] : []),
  ];
  const frame = createFrame(spec, theme, { height: 520 });
  const area = frame.layout(legend);

  const X = ctx.textScale;
  const fs = 12;
  const rowW = Math.min(area.w * 0.34, Math.max(...rows.map((i) => measure(name(i), fs)))) + 12;
  const dendroH = showDendro ? 48 : 0;
  const colW = Math.max(...cols.map((i) => measure(name(i), fs)));
  const colLabMax = Math.min(colW, 150, spec.height ? Math.max(40, area.h * 0.28) : 150);
  const labH = (ang) => (ang === 90 ? colLabMax + 14 * X : ang ? colLabMax * 0.71 + 14 * X : 20 * X);
  // Celdas cuadradas; con alto fijo, la grilla deja lugar a las etiquetas de columna.
  const fitCell = (reserve) => Math.max(14, Math.min(+spec.cellSize || 96, (area.w - rowW) / cols.length, (spec.height ? Math.max(80, area.h - dendroH - reserve) : 600) / rows.length));
  // Derechas si caben; a 45° la separación es cell·sen45°, así que con celdas chicas van verticales.
  const angleFor = (c) => (colW + 8 <= c ? 0 : c * 0.71 < fs * X + 3 ? 90 : 45);
  let cell = fitCell(labH(0));
  let angle = angleFor(cell);
  if (spec.height && angle) {
    cell = fitCell(labH(angle));
    angle = angleFor(cell);
    if (angle === 90) cell = fitCell(labH(90));
  }
  const colLabH = labH(angle);
  const gx = area.x + rowW, gy = area.y + dendroH;
  const gw = cell * cols.length, gh = cell * rows.length;
  if (spec.height === undefined) frame.setHeight(gy + gh + colLabH + 8 + frame.chrome);

  const lab = cell >= 70 ? 13 : 11;
  const showLabels = spec.labels ?? cell >= measure(dec(-0.88), lab) + 8;
  const body = [];

  // Dendrograma arriba (columnas = hojas en orden).
  if (showDendro) {
    const cx = new Map(cols.map((i, c) => [i, gx + c * cell + cell / 2]));
    const maxH = tree.h || 1;
    const yOf = (h) => gy - 6 - (h / maxH) * (dendroH - 12);
    const [{ d }] = elbows(tree, (leaf) => cx.get(leaf), yOf);
    body.push(el('path', { d, fill: 'none', stroke: theme.muted, strokeWidth: 1.1, strokeLinejoin: 'round' }));
  }

  rows.forEach((i, ri) => {
    const on = !anyHL || isHL(i);
    body.push(text(gx - 10, gy + ri * cell + cell / 2 + 4, truncate(name(i), rowW - 12, fs), { fill: anyHL && on ? theme.ink : theme.lede, fontSize: fs, textAnchor: 'end', fontWeight: anyHL && on ? 600 : null }));
    cols.forEach((j, ci) => {
      if (!full && order.indexOf(i) <= order.indexOf(j)) return;
      const v = R[i][j];
      const ns = insignificant(i, j);
      const fill = ns ? theme.tint : colorOf(v);
      const x = gx + ci * cell + 1, y = gy + ri * cell + 1, w = Math.max(0, cell - 2);
      const dim = anyHL && !isHL(i) && !isHL(j);
      const parts = [el('rect', { x, y, width: w, height: w, rx: Math.min(4, cell / 8), fill, opacity: dim ? 0.22 : null })];
      if (showLabels && Number.isFinite(v) && i !== j) {
        parts.push(text(x + w / 2, y + w / 2 + lab * 0.36, fmt(v), { fill: ns || dim ? theme.muted : textOn(fill, theme), fontSize: lab, textAnchor: 'middle', fontWeight: 500, opacity: dim ? 0.7 : null }));
      }
      const lines = Number.isFinite(v)
        ? [`${long ? humanize(spec.value) : sym} = ${fmt(v)}`, i !== j && Number.isFinite(N[i][j]) ? `n = ${formatNumber(N[i][j], 0, locale)}${Number.isFinite(P[i][j]) ? ' · ' + pText(P[i][j]) : ''}` : '']
        : [en ? 'No variation or too few rows' : 'Sin variación o muy pocas filas'];
      body.push(g({ class: 'pa-m', 'data-tip': tip(`${name(i)} · ${name(j)}`, ...lines) }, parts));
    });
  });

  // Etiquetas de columna abajo; en diagonal (−45°) si no caben derechas.
  cols.forEach((j, ci) => {
    const on = !anyHL || isHL(j);
    const cx = gx + ci * cell + cell / 2;
    const attrs = { fill: anyHL && on ? theme.ink : theme.lede, fontSize: fs, fontWeight: anyHL && on ? 600 : null };
    if (angle) {
      const y = gy + gh + (angle === 90 ? 8 : 12);
      const ax = angle === 90 ? cx + fs * 0.35 : cx + 4;
      body.push(text(ax, y, truncate(name(j), colLabMax, fs), { ...attrs, textAnchor: 'end', transform: `rotate(-${angle} ${ax.toFixed(1)} ${y.toFixed(1)})` }));
    } else body.push(text(cx, gy + gh + 16 * X, name(j), { ...attrs, textAnchor: 'middle' }));
  });

  // Descripción: el par más fuerte de cada signo.
  const pairs = [];
  for (let a = 0; a < k; a++) for (let b = a + 1; b < k; b++) if (Number.isFinite(R[a][b])) pairs.push([a, b, R[a][b]]);
  pairs.sort((p, q) => q[2] - p[2]);
  const pos = pairs.find((p) => p[2] > 0), neg = [...pairs].reverse().find((p) => p[2] < 0);
  const kind = long ? '' : method === 'spearman' ? ' (Spearman)' : ' (Pearson)';
  const say = (p) => `${name(p[0])} ${en ? 'and' : 'y'} ${name(p[1])} (${fmt(p[2])})`;
  const desc = en
    ? `Correlation matrix${kind} of ${k} variables${tree ? ', ordered by hierarchical clustering' : ''}.` + (pos ? ` Strongest positive: ${say(pos)}.` : '') + (neg ? ` Strongest negative: ${say(neg)}.` : '') + (!pairs.length ? ' No pair has enough data.' : '')
    : `Matriz de correlación${kind} de ${k} variables${tree ? ', ordenadas por agrupamiento jerárquico' : ''}.` + (pos ? ` Más fuerte positiva: ${say(pos)}.` : '') + (neg ? ` Más fuerte negativa: ${say(neg)}.` : '') + (!pairs.length ? ' Ningún par tiene datos suficientes.' : '');
  return frame.finish(body, { desc, type: 'corr' });
}

// ── pairplot ───────────────────────────────────────────────────────────────

/**
 * Matriz de dispersión (sns.pairplot). Abajo de la diagonal, dispersión de
 * cada par; en la diagonal, la distribución de cada variable; arriba, el r
 * de Pearson (o dispersión con `upper: "scatter"`, nada con `corner: true`).
 * Opciones: vars, hue, diag ("hist" | "kde"), kind ("scatter" | "reg"), bins, radius.
 */
export function pairplot(spec, theme) {
  const data = ensureData(spec);
  const en = isEN(spec);
  const locale = spec.locale || 'es';
  let vars = corrVars(spec, data);
  const explicit = spec.vars || Array.isArray(spec.y);
  if (!explicit && vars.length > 6) vars = vars.slice(0, 6);
  if (vars.length < 2) {
    throw en
      ? new PlotError('A pair plot needs at least two numeric fields.', 'Pass rows with two or more measures, or list them in `vars: ["price", "area"]`.')
      : new PlotError('La matriz de dispersión necesita al menos dos campos numéricos.', 'Entrega filas con dos o más medidas, o indícalas en `vars: ["precio", "superficie"]`.');
  }
  const hue = hueField(spec);
  if (hue) requireField(data, hue, 'hue');
  const k = vars.length;
  const name = (i) => (spec.labelsFor && spec.labelsFor[vars[i]]) || humanize(vars[i]);
  const cols = vars.map((f) => data.map((row) => num(row[f])));
  const hk = data.map((row) => (hue ? String(row[hue] ?? '') : ''));
  const keys = hue ? uniq(hk) : [''];
  const K = keys.length;
  const cmap = colorMap(keys, theme, spec.colors);
  const colorOf = (key) => (K === 1 ? (spec.colors && spec.colors['']) || theme.categorical[0] : cmap.get(key));
  const legend = K > 1 && spec.legend !== false ? keys.map((key) => ({ label: key, color: colorOf(key) })) : [];

  const frame = createFrame(spec, theme, { height: 640 });
  const area = frame.layout(legend);
  const X = ctx.textScale;
  const fmts = vars.map((_, i) => makeFormat(spec.format, locale, cols[i].filter(Number.isFinite)));
  const axes = vars.map((_, i) => axisDomain(cols[i], { nice: 'tight', count: 3 }));
  const tfs = vars.map((_, i) => tickFmt(fmts[i], axes[i]));
  const ticksIn = (ax) => ax.ticks.filter((t) => t >= ax.min && t <= ax.max);
  const fs = 11;
  const leftM = Math.max(...vars.slice(1).map((_, i) => Math.max(0, ...ticksIn(axes[i + 1]).map((t) => measure(tfs[i + 1](t), fs))))) + 8;
  const gap = 8;
  const bottom = 20 * X;
  const fitW = (area.w - leftM - gap * (k - 1)) / k;
  const fitH = spec.height ? (area.h - bottom - gap * (k - 1)) / k : Infinity;
  const s = Math.max(40, Math.min(fitW, fitH, +spec.panelSize || 220));
  const px = (j) => area.x + leftM + j * (s + gap);
  const py = (i) => area.y + i * (s + gap);
  if (spec.height === undefined) frame.setHeight(py(k - 1) + s + bottom + 6 + frame.chrome);

  const { r: R, n: N } = correlations(data, vars, 'pearson');
  const upper = spec.corner ? 'none' : spec.upper === false ? 'none' : (spec.upper ?? 'corr');
  // Con `hue`, densidades en la diagonal (como seaborn): histogramas superpuestos se mezclan.
  const diag = spec.diag === 'kde' || spec.diag === 'hist' ? spec.diag : hue ? 'kde' : 'hist';
  const n = data.length;
  const rad = spec.radius ?? (n > 600 ? 1.5 : n > 200 ? 2 : n > 60 ? 2.6 : 3.2);
  const M = theme.marks || {};
  const body = [];
  const frameRect = (x, y) => el('rect', { x, y, width: s, height: s, fill: 'none', stroke: theme.grid, strokeWidth: 1 });
  const gridLines = (i, j) => {
    const xs = axes[j].scale(px(j) + 4, px(j) + s - 4), ys = axes[i].scale(py(i) + s - 4, py(i) + 4);
    const out = [];
    for (const t of ticksIn(axes[j])) out.push(el('line', { x1: xs(t), x2: xs(t), y1: py(i), y2: py(i) + s, stroke: theme.grid, strokeWidth: 0.75 }));
    for (const t of ticksIn(axes[i])) out.push(el('line', { x1: px(j), x2: px(j) + s, y1: ys(t), y2: ys(t), stroke: theme.grid, strokeWidth: 0.75 }));
    return out;
  };

  const scatterPanel = (i, j) => {
    const xs = axes[j].scale(px(j) + 4, px(j) + s - 4), ys = axes[i].scale(py(i) + s - 4, py(i) + 4);
    const pts = [];
    for (let t = 0; t < n; t++) {
      const a = cols[j][t], b = cols[i][t];
      if (Number.isFinite(a) && Number.isFinite(b)) pts.push({ x: a, y: b, key: hk[t], label: spec.label ? String(data[t][spec.label] ?? '') : '' });
    }
    const out = [...gridLines(i, j)];
    out.push(g({}, dotLayer(pts.map((p) => ({
      class: 'pa-m', cx: xs(p.x), cy: ys(p.y), r: rad, fill: colorOf(p.key), fillOpacity: M.dotOpacity ?? 0.72,
      stroke: pts.length > 300 ? 'none' : theme.surface, strokeWidth: 0.75,
      'data-tip': tip(p.label || p.key || `${name(i)} · ${name(j)}`, `${name(j)}: ${fmts[j](p.x)}`, `${name(i)}: ${fmts[i](p.y)}`, p.label && p.key ? p.key : ''),
    })))));
    if (spec.kind === 'reg') {
      for (const key of keys) {
        const gp = pts.filter((p) => p.key === key);
        if (gp.length < 3) continue;
        const f = polyfit(gp.map((p) => p.x), gp.map((p) => p.y));
        const lo = Math.min(...gp.map((p) => p.x)), hi = Math.max(...gp.map((p) => p.x));
        const clampY = (v) => Math.max(py(i), Math.min(py(i) + s, ys(v)));
        out.push(el('line', { x1: xs(lo), y1: clampY(f.predict(lo)), x2: xs(hi), y2: clampY(f.predict(hi)), stroke: K === 1 ? theme.ink : colorOf(key), strokeWidth: 1.75, opacity: 0.9 }));
      }
    }
    return out;
  };

  const diagPanel = (i) => {
    const ax = axes[i];
    const xs = ax.scale(px(i) + 4, px(i) + s - 4);
    const base = py(i) + s, top = py(i) + 22 * X;
    const out = [];
    const groups = keys.map((key) => cols[i].filter((v, t) => Number.isFinite(v) && hk[t] === key));
    const allV = cols[i].filter(Number.isFinite);
    if (diag === 'kde') {
      const curves = groups.map((vs) => (vs.length > 1 && vs.some((v) => v !== vs[0]) ? kdeEst(vs, { extent: [ax.min, ax.max], gridSize: 90 }).map(([x, d]) => [x, (d * vs.length) / allV.length]) : []));
      const mx = Math.max(1e-12, ...curves.flat().map((p) => p[1]));
      curves.forEach((c, gi) => {
        if (!c.length) return;
        const yOf = (d) => base - (d / mx) * (base - top);
        const line = c.map(([x, d], t) => `${t ? 'L' : 'M'}${xs(x).toFixed(2)},${yOf(d).toFixed(2)}`).join('');
        out.push(el('path', { d: `${line}L${xs(c[c.length - 1][0]).toFixed(2)},${base}L${xs(c[0][0]).toFixed(2)},${base}Z`, fill: colorOf(keys[gi]), fillOpacity: (M.areaOpacity ?? 0.12) * 1.6 }));
        out.push(el('path', { d: line, fill: 'none', stroke: colorOf(keys[gi]), strokeWidth: 1.6 }));
      });
    } else {
      const nb = spec.bins ?? Math.max(6, Math.min(s < 120 ? 14 : 22, histogram(allV).length));
      const bins = histogram(allV, { bins: nb, domain: [ax.min, ax.max] });
      const counts = groups.map((vs) => bins.map((b, bi) => vs.filter((v) => v >= b.x0 && (v < b.x1 || (bi === bins.length - 1 && v <= b.x1))).length));
      const mx = Math.max(1, ...counts.flat());
      const op = K > 1 ? 0.55 : 0.85;
      counts.forEach((cs, gi) => bins.forEach((b, bi) => {
        const h = (cs[bi] / mx) * (base - top);
        const a0 = xs(b.x0) + 0.5, a1 = xs(b.x1) - 0.5;
        if (h <= 0 || a1 <= a0) return;
        out.push(el('path', { class: 'pa-m', d: barPath(a0, base - h, a1 - a0, h, 'up', 1.5), fill: colorOf(keys[gi]), fillOpacity: op, 'data-tip': tip(name(i), `${fmts[i](b.x0)} – ${fmts[i](b.x1)}`, `${keys[gi] ? keys[gi] + ': ' : ''}${cs[bi]}`) }));
      }));
    }
    out.push(el('line', { x1: px(i), x2: px(i) + s, y1: base - 0.5, y2: base - 0.5, stroke: theme.axis }));
    out.push(text(px(i) + 6, py(i) + 14 * X, truncate(name(i), s - 12, 12, 600), { fill: theme.ink, fontSize: 12, fontWeight: 600, ...halo(theme) }));
    return out;
  };

  const corrPanel = (i, j) => {
    const v = R[i][j];
    const cx = px(j) + s / 2, cy = py(i) + s / 2;
    const out = [el('rect', { x: px(j), y: py(i), width: s, height: s, fill: Number.isFinite(v) ? ramp(theme.diverging, 0.5 + v / 2) : theme.tint, fillOpacity: Number.isFinite(v) ? 0.08 + 0.32 * Math.abs(v) : 0.5 })];
    if (Number.isFinite(v)) {
      const size = Math.min(s * 0.24, 13 + 15 * Math.abs(v));
      const showGroups = K > 1 && K <= 4 && s >= 110;
      const y0 = showGroups ? cy - (K * 14) / 2 + 2 : cy + size * 0.36;
      out.push(text(cx, y0, formatNumber(v, 2, locale), { fill: readable(ramp(theme.diverging, 0.5 + v / 2), theme, 4.5), fontSize: size, fontWeight: 600, textAnchor: 'middle' }));
      if (showGroups) {
        keys.forEach((key, gi) => {
          const sub = correlations(data.filter((_, t) => hk[t] === key), [vars[i], vars[j]]).r[0][1];
          out.push(text(cx, y0 + 18 + gi * 14, `${truncate(key, s * 0.55, 10.5)}: ${Number.isFinite(sub) ? formatNumber(sub, 2, locale) : '—'}`, { fill: readable(colorOf(key), theme, 3), fontSize: 10.5, textAnchor: 'middle' }));
        });
      }
    }
    return [g({ class: 'pa-m', 'data-tip': tip(`${name(i)} · ${name(j)}`, `r = ${Number.isFinite(v) ? formatNumber(v, 2, locale) : '—'}`, `n = ${formatNumber(N[i][j], 0, locale)}`) }, out)];
  };

  for (let i = 0; i < k; i++) {
    for (let j = 0; j < k; j++) {
      if (i < j && upper === 'none') continue;
      const part = i === j ? diagPanel(i) : i > j || upper === 'scatter' ? scatterPanel(i, j) : corrPanel(i, j);
      body.push(g({}, [...part, frameRect(px(j), py(i))]));
    }
  }

  // Marcas: x abajo (cada columna), y a la izquierda (filas con dispersión en la primera columna).
  for (let j = 0; j < k; j++) {
    const xs = axes[j].scale(px(j) + 4, px(j) + s - 4);
    let ts = ticksIn(axes[j]);
    if (ts.length > 2 && ts.some((t, ti) => ti && xs(t) - xs(ts[ti - 1]) < Math.max(...ts.map((u) => measure(tfs[j](u), fs))) + 6)) ts = ts.filter((_, ti) => ti % 2 === 0);
    for (const t of ts) body.push(text(xs(t), py(k - 1) + s + 14 * X, tfs[j](t), { fill: theme.muted, fontSize: fs, textAnchor: 'middle' }));
  }
  for (let i = 1; i < k; i++) {
    const ys = axes[i].scale(py(i) + s - 4, py(i) + 4);
    for (const t of ticksIn(axes[i])) body.push(text(px(0) - 6, ys(t) + 4, tfs[i](t), { fill: theme.muted, fontSize: fs, textAnchor: 'end' }));
  }

  const pairs = [];
  for (let a = 0; a < k; a++) for (let b = a + 1; b < k; b++) if (Number.isFinite(R[a][b])) pairs.push([a, b, R[a][b]]);
  pairs.sort((p, q) => Math.abs(q[2]) - Math.abs(p[2]));
  const top = pairs[0];
  const desc = en
    ? `Pair plot of ${k} variables (${formatNumber(n, 0, locale)} rows)${hue ? ` colored by ${humanize(hue)}` : ''}: scatter plots below the diagonal, distributions on it.` + (top ? ` Strongest correlation: ${name(top[0])} and ${name(top[1])} (r = ${formatNumber(top[2], 2, locale)}).` : '')
    : `Matriz de dispersión de ${k} variables (${formatNumber(n, 0, locale)} filas)${hue ? ` por ${humanize(hue).toLowerCase()}` : ''}: dispersión bajo la diagonal y distribuciones en ella.` + (top ? ` Correlación más fuerte: ${name(top[0])} y ${name(top[1])} (r = ${formatNumber(top[2], 2, locale)}).` : '');
  return frame.finish(body, { desc, type: 'pairplot' });
}
