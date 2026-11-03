// Mapas: coroplético (color por valor) y de símbolos (círculos proporcionales).
// Geometrías por nombre registrado ('chile', 'world') o GeoJSON propio.
// Países alargados como Chile se dibujan a la izquierda con una columna de
// etiquetas (nombre, barra y valor) ordenada de norte a sur; mapas anchos
// usan todo el ancho con etiquetas solo donde importan.
import { el, g, text } from '../svg.js';
import { measure, truncate } from '../text.js';
import { makeFormat } from '../format.js';
import { ramp } from '../theme.js';
import { ensureData, requireField, num, fieldsOf, fieldKind, humanize, aggregate } from '../data.js';
import { createFrame, hash } from '../frame.js';
import { niceStep } from '../scale.js';
import { getGeo } from '../geo/registry.js';
import { mercator, equalEarth, fit, aspectOf, pathD, centroid, rings } from '../geo/projection.js';

const T = (locale, es, en) => (String(locale || 'es').startsWith('en') ? en : es);

/** Normaliza nombres para que "Región del Bío-Bío", "Biobio" y "BIOBÍO" coincidan. */
export function normKey(s) {
  return String(s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/^\s*(region|provincia|comuna)\s+(metropolitana\s+de\s+)?(de\s+la\s+|del\s+|de\s+los\s+|de\s+las\s+|de\s+)?/, (m, a, metro) => (metro ? 'metropolitana' : ''))
    .replace(/[^a-z0-9]/g, '');
}

function featureIndex(features, featureKey) {
  const idx = new Map();
  const add = (k, f) => { const n = normKey(k); if (n && !idx.has(n)) idx.set(n, f); };
  for (const f of features) {
    const p = f.properties || {};
    if (featureKey) { add(p[featureKey], f); continue; }
    for (const k of ['code', 'num', 'id', 'iso3', 'iso_a3', 'name', 'nameEn', 'NAME', 'nombre']) if (p[k] !== undefined && p[k] !== null) add(p[k], f);
    for (const a of p.aliases || []) add(a, f);
  }
  return idx;
}

const nameOf = (f, locale) => {
  const p = f.properties || {};
  return (String(locale).startsWith('en') ? p.nameEn || p.name : p.name || p.nameEn) || p.NAME || p.nombre || String(p.code ?? p.id ?? '');
};

/** Redondeo "bonito" de un corte de clase (2 cifras relativas al rango). */
function niceRound(v, range) {
  if (!range) return v;
  const step = 10 ** (Math.floor(Math.log10(range)) - 1);
  return Math.round(v / step) * step;
}

function quantile(sorted, p) {
  const h = (sorted.length - 1) * p, lo = Math.floor(h), hi = Math.ceil(h);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (h - lo);
}

/** Escala de color: clases (cuantiles, intervalos iguales o cortes dados) o continua. */
export function colorScale(values, spec, theme) {
  const v = values.filter(Number.isFinite).sort((a, b) => a - b);
  const min = v[0], max = v[v.length - 1], range = max - min;
  const mid = spec.midpoint ?? (spec.diverging ? 0 : undefined);
  const mode = Array.isArray(spec.scale) || Array.isArray(spec.thresholds) ? 'thresholds' : spec.scale || 'quantile';
  if (mid !== undefined) {
    const stops = theme.diverging;
    const dev = Math.max(Math.abs(max - mid), Math.abs(min - mid)) || 1;
    if (mode === 'continuous') return { mode, min: mid - dev, max: mid + dev, mid, color: (x) => ramp(stops, 0.5 + (x - mid) / dev / 2), stops };
    // Clases simétricas: el paso "bonito" más chico que cubre la desviación
    // con a lo más `classes/2` clases por lado (sin cortes fuera de los datos).
    const perSide = Math.max(2, Math.floor((spec.classes ?? 6) / 2));
    const mag = 10 ** Math.floor(Math.log10(dev / perSide));
    const step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((st) => Math.ceil(dev / st - 1e-9) <= perSide) || 10 * mag;
    const k = Math.max(1, Math.ceil(dev / step - 1e-9));
    const breaks = Array.from({ length: 2 * k - 1 }, (_, j) => +(mid + step * (j + 1 - k)).toPrecision(12));
    const n = 2 * k;
    const colors = Array.from({ length: n }, (_, i) => ramp(stops, 0.5 + ((i + 0.5 - k) / k) * 0.5));
    return { ...classed(breaks, colors, min, max), mid };
  }
  const stops = theme.sequential;
  if (mode === 'continuous') return { mode, min, max, color: (x) => ramp(stops.slice(1), (x - min) / (range || 1)), stops: stops.slice(1) };
  let breaks;
  if (mode === 'thresholds') breaks = [...(Array.isArray(spec.scale) ? spec.scale : spec.thresholds)].map(Number).sort((a, b) => a - b);
  else {
    const n = Math.max(2, Math.min(9, spec.classes ?? Math.min(5, v.length)));
    if (mode === 'equal') breaks = Array.from({ length: n - 1 }, (_, k) => niceRound(min + (range * (k + 1)) / n, range));
    else breaks = Array.from({ length: n - 1 }, (_, k) => niceRound(quantile(v, (k + 1) / n), range));
    breaks = [...new Set(breaks)].filter((b) => b > min && b <= max);
  }
  const n = breaks.length + 1;
  const t0 = theme.mode === 'dark' ? 0.26 : 0.16;
  const colors = Array.from({ length: n }, (_, i) => ramp(stops, n === 1 ? 0.6 : t0 + ((1 - t0) * i) / (n - 1)));
  return classed(breaks, colors, min, max);
}

function classed(breaks, colors, min, max) {
  const cls = (x) => { let i = 0; while (i < breaks.length && x >= breaks[i]) i++; return i; };
  return { mode: 'classes', breaks, colors, min, max, cls, color: (x) => colors[cls(x)] };
}

/** Leyenda escalonada (o degradado), pegada al mapa. Devuelve { svg, h }. */
function legendBar(sc, x, y, maxW, theme, fmt, { title, missing, locale, gid }) {
  const out = [];
  let lx = x;
  const size = theme.type?.axis ?? 11.5;
  if (title) {
    const tw = Math.min(measure(title, 12, 500), maxW * 0.4);
    out.push(text(lx, y + 13, truncate(title, tw, 12, 500), { fill: theme.lede, fontSize: 12, fontWeight: 500 }));
    lx += tw + 12;
  }
  const missW = missing ? measure(T(locale, 'Sin dato', 'No data'), size) + 24 : 0;
  const barW = Math.max(120, Math.min(360, x + maxW - lx - missW));
  const by = y + 4;
  if (sc.mode === 'classes') {
    const n = sc.colors.length, gap = 2;
    const sw = (barW - gap * (n - 1)) / n;
    sc.colors.forEach((c, i) => out.push(el('rect', { x: lx + i * (sw + gap), y: by, width: sw, height: 10, rx: i === 0 || i === n - 1 ? 3 : 1, fill: c })));
    // Etiquetas en los cortes; los extremos (mín. y máx.) en las puntas.
    const labels = [{ x: lx, v: sc.min, anchor: 'start' }, ...sc.breaks.map((b, i) => ({ x: lx + (i + 1) * (sw + gap) - gap / 2, v: b, anchor: 'middle' })), { x: lx + barW, v: sc.max, anchor: 'end' }];
    let last = -Infinity;
    for (const L of labels) {
      const s = fmt(L.v), w = measure(s, size);
      const left = L.anchor === 'start' ? L.x : L.anchor === 'end' ? L.x - w : L.x - w / 2;
      if (left < last + 6) continue;
      out.push(text(L.x, by + 24, s, { fill: theme.muted, fontSize: size, textAnchor: L.anchor }));
      last = left + w;
    }
  } else {
    const id = gid + '-grad';
    const stops = Array.from({ length: 9 }, (_, i) => el('stop', { offset: `${i * 12.5}%`, stopColor: sc.color(sc.min + ((sc.max - sc.min) * i) / 8) }));
    out.push(el('defs', {}, el('linearGradient', { id }, stops)));
    out.push(el('rect', { x: lx, y: by, width: barW, height: 10, rx: 3, fill: `url(#${id})` }));
    out.push(text(lx, by + 24, fmt(sc.min), { fill: theme.muted, fontSize: size }));
    if (sc.mid !== undefined) out.push(text(lx + barW / 2, by + 24, fmt(sc.mid), { fill: theme.muted, fontSize: size, textAnchor: 'middle' }));
    out.push(text(lx + barW, by + 24, fmt(sc.max), { fill: theme.muted, fontSize: size, textAnchor: 'end' }));
  }
  if (missing) {
    const mx = lx + barW + 14;
    out.push(el('rect', { x: mx, y: by, width: 10, height: 10, rx: 2, fill: `url(#${gid}-nd)`, stroke: theme.axis, strokeWidth: 0.5 }));
    out.push(text(mx + 14, by + 9, T(locale, 'Sin dato', 'No data'), { fill: theme.muted, fontSize: size }));
  }
  return { svg: g({ class: 'pa-legend pa-map-legend' }, out), h: 34 };
}

/** Patrón rayado para regiones sin dato. */
const noDataPattern = (id, theme) =>
  `<pattern id="${id}" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" fill="${theme.tint}"/><line x1="0" y1="0" x2="0" y2="5" stroke="${theme.muted}" stroke-width="1" stroke-opacity="0.35"/></pattern>`;

/** Datos + geometría emparejados. */
function prepare(spec, locale) {
  const fc = getGeo(spec.geo ?? 'chile');
  const data = ensureData(spec);
  const fields = fieldsOf(data);
  const key = spec.key ?? spec.region ?? spec.x ?? spec.label ?? fields.find((f) => fieldKind(data, f) === 'category');
  const valueF = spec.value ?? spec.y ?? (typeof spec.size === 'string' ? spec.size : null) ?? fields.find((f) => f !== key && fieldKind(data, f) === 'number');
  requireField(data, key, 'key');
  requireField(data, valueF, 'value');
  let features = fc.features.filter((f) => f.geometry && rings(f.geometry).length);
  if (!spec.antarctica) features = features.filter((f) => (f.properties || {}).iso3 !== 'ATA');
  const idx = featureIndex(features, spec.featureKey);
  const buckets = new Map();
  const unmatched = [];
  for (const r of data) {
    const f = idx.get(normKey(r[key]));
    if (!f) { if (r[key] !== undefined && r[key] !== null && r[key] !== '') unmatched.push(String(r[key])); continue; }
    if (!buckets.has(f)) buckets.set(f, []);
    buckets.get(f).push(num(r[valueF]));
  }
  const values = new Map();
  for (const [f, vs] of buckets) { const v = aggregate(vs, spec.aggregate || 'mean'); if (Number.isFinite(v)) values.set(f, v); }
  if (Array.isArray(spec._unmatched)) spec._unmatched.push(...new Set(unmatched));
  const ranked = [...values.entries()].sort((a, b) => b[1] - a[1]);
  const rank = new Map(ranked.map(([f], i) => [f, i + 1]));
  const projName = spec.projection ?? (/^(world|mundo|countries|paises|países)$/i.test(String(spec.geo)) ? 'equalEarth' : null);
  const lonSpan = (() => { let a = Infinity, b = -Infinity; for (const f of features) for (const r of rings(f.geometry)) for (const p of r) { if (p[0] < a) a = p[0]; if (p[0] > b) b = p[0]; } return b - a; })();
  const raw = (projName === 'mercator' ? mercator : projName === 'equalEarth' || projName === 'equal-earth' || lonSpan > 100 ? equalEarth : mercator)();
  return { fc, features, values, rank, ranked, unmatched: [...new Set(unmatched)], key, valueF, raw, data };
}

/**
 * Columna de etiquetas para mapas altos: una fila por región a la altura de
 * su centroide (separadas si chocan), con línea guía, barra y valor.
 */
function labelColumn(items, x, y0, y1, w, theme, fmt, { bars = true, maxV }) {
  const out = [];
  const n = items.length;
  const rowH = Math.max(12.5, Math.min(18, (y1 - y0) / Math.max(1, n)));
  const fs = rowH < 14 ? 10.5 : 11.5;
  // Separación vertical (orden norte → sur se conserva).
  const rows = items.map((it) => ({ ...it, y: it.cy })).sort((a, b) => a.cy - b.cy);
  for (let i = 0; i < rows.length; i++) rows[i].y = Math.max(rows[i].y, i ? rows[i - 1].y + rowH : y0 + rowH / 2);
  for (let i = rows.length - 1; i >= 0; i--) { const lim = i === rows.length - 1 ? y1 - rowH / 2 : rows[i + 1].y - rowH; if (rows[i].y > lim) rows[i].y = lim; }
  for (let i = 0; i < rows.length; i++) if (rows[i].y < y0 + rowH / 2 + i * rowH) rows[i].y = y0 + rowH / 2 + i * rowH;
  const nameW = Math.min(w * (bars ? 0.46 : 0.68), Math.max(...rows.map((r) => measure(r.name, fs))));
  const valW = Math.max(...rows.map((r) => measure(r.label, fs, 600)));
  const barX = x + nameW + 8;
  const diverging = rows.some((r) => r.v < 0);
  const barMax = Math.max(0, w - nameW - valW * (diverging ? 2 : 1) - (diverging ? 26 : 18));
  const showBars = bars && barMax >= 36;
  const negMax = diverging ? Math.max(0, ...rows.filter((r) => r.v < 0).map((r) => -r.v)) : 0;
  const posMax = Math.max(0, ...rows.filter((r) => r.v > 0).map((r) => r.v));
  // Con valores negativos, eje en cero y barras hacia ambos lados.
  const zeroX = diverging ? barX + valW + 6 + (barMax * negMax) / (negMax + posMax || 1) : barX;
  const scaleW = diverging ? barMax / (negMax + posMax || 1) : barMax / (maxV || 1);
  if (showBars && diverging) out.push(el('line', { x1: zeroX, x2: zeroX, y1: y0, y2: y1, stroke: theme.axis, strokeWidth: 1 }));
  for (const r of rows) {
    const parts = [];
    // Línea guía: horizontal desde el centroide y quiebre suave a la fila.
    parts.push(el('path', { d: `M${r.cx.toFixed(1)},${r.cy.toFixed(1)}L${(x - 14).toFixed(1)},${r.cy.toFixed(1)}L${(x - 4).toFixed(1)},${r.y.toFixed(1)}`, fill: 'none', stroke: theme.muted, strokeWidth: 0.6, opacity: 0.55 }));
    parts.push(el('circle', { cx: r.cx, cy: r.cy, r: 1.8, fill: theme.ink, opacity: 0.7 }));
    parts.push(text(x, r.y + fs * 0.36, truncate(r.name, nameW, fs), { fill: r.missing ? theme.muted : theme.lede, fontSize: fs }));
    if (r.missing) parts.push(text(showBars ? barX : x + nameW + 8, r.y + fs * 0.36, r.label, { fill: theme.muted, fontSize: fs }));
    else if (showBars) {
      const bw = Math.max(2, Math.abs(r.v) * scaleW);
      const bx = r.v < 0 ? zeroX - bw : zeroX;
      parts.push(el('rect', { x: bx, y: r.y - 3.5, width: bw, height: 7, rx: 2, fill: r.barColor || r.color }));
      parts.push(text(r.v < 0 ? bx - 6 : bx + bw + 6, r.y + fs * 0.36, r.label, { fill: theme.ink, fontSize: fs, fontWeight: 600, textAnchor: r.v < 0 ? 'end' : 'start' }));
    } else parts.push(text(x + nameW + 8, r.y + fs * 0.36, r.label, { fill: theme.ink, fontSize: fs, fontWeight: 600 }));
    out.push(g({ class: 'pa-m', 'data-tip': r.tip }, parts));
  }
  return out;
}

/** Etiquetas sobre el mapa (mapas anchos): solo las elegidas y sin choques. */
function mapLabels(items, theme, placedBoxes = []) {
  const out = [];
  for (const it of items) {
    const w = Math.max(measure(it.name, 11, 600), measure(it.label, 11));
    const box = [it.cx - w / 2 - 2, it.cy - 13, it.cx + w / 2 + 2, it.cy + 13];
    if (placedBoxes.some((b) => !(box[2] < b[0] || box[0] > b[2] || box[3] < b[1] || box[1] > b[3]))) continue;
    placedBoxes.push(box);
    const halo = { stroke: theme.surface, strokeWidth: 3, paintOrder: 'stroke', strokeLinejoin: 'round', textAnchor: 'middle' };
    out.push(g({ class: 'pa-map-label', 'pointer-events': 'none' }, [
      text(it.cx, it.cy - 2, it.name, { fill: theme.ink, fontSize: 11, fontWeight: 600, ...halo }),
      text(it.cx, it.cy + 11, it.label, { fill: theme.lede, fontSize: 11, ...halo }),
    ]));
  }
  return out;
}

function chooseLabeled(m, spec, locale, defaultN) {
  const hl = spec.highlight === undefined ? [] : [].concat(spec.highlight).map(normKey);
  const isHl = (f) => hl.length && featureIndexHas(f, hl);
  if (Array.isArray(spec.labels)) { const want = spec.labels.map(normKey); return m.features.filter((f) => featureIndexHas(f, want)); }
  const n = typeof spec.labels === 'number' ? spec.labels : spec.labels === false ? 0 : defaultN;
  const top = m.ranked.slice(0, n).map(([f]) => f);
  return [...new Set([...m.features.filter(isHl), ...top])];
}
function featureIndexHas(f, keys) {
  const p = f.properties || {};
  const own = [p.code, p.num, p.id, p.iso3, p.name, p.nameEn, ...(p.aliases || [])].map(normKey);
  return keys.some((k) => own.includes(k));
}

function baseChart(spec, theme, kind) {
  const locale = spec.locale || 'es';
  const m = prepare(spec, locale);
  const vals = [...m.values.values()];
  const fmt = makeFormat(spec.format, locale, vals);
  const W = spec.width || 720;
  const aspect = aspectOf(m.features, m.raw);
  const tall = aspect > 1.6 && m.features.length <= 40;
  // Alto por defecto según la forma del territorio.
  const defH = tall ? (W < 560 ? 660 : 740) : Math.round(W * Math.min(1.1, aspect) + 150);
  const frame = createFrame(spec, theme, { height: defH });
  let area = frame.layout([]);
  const gid = 'pa-map-' + Math.abs(hash(String(spec.title) + kind + W)).toString(36);
  const missingAny = spec.missing !== 'plain' && m.features.some((f) => !m.values.has(f));
  const body = [];
  let sc = null;
  if (kind === 'choropleth' && vals.length) {
    sc = colorScale(vals, spec, theme);
    const lg = legendBar(sc, area.x, area.y, area.w, theme, fmt.tick ? (v) => fmt(v) : fmt, { title: spec.legendTitle ?? humanize(m.valueF), missing: missingAny, locale, gid });
    body.push(lg.svg);
    area = { ...area, y: area.y + lg.h + 8, h: area.h - lg.h - 8 };
  }
  // Mapa ancho: el alto se ajusta al ancho si el agente no fijó `height`.
  if (!tall && spec.height === undefined) {
    const mapH = area.w * Math.min(1.1, aspect);
    frame.setHeight(area.y + mapH + frame.chrome);
    area = { ...area, h: frame.bottom - area.y };
  }
  let box;
  if (tall) {
    const colMin = W < 480 ? 0.56 : 0.5;
    let mapW = Math.min(area.w * (1 - colMin), area.h / aspect);
    box = [area.x, area.y, area.x + mapW, area.y + area.h];
  } else box = [area.x, area.y, area.x + area.w, area.y + area.h];
  const proj = fit(m.features, m.raw, box, { align: tall ? 'left' : 'center' });
  return { locale, m, vals, fmt, frame, area, gid, missingAny, body, sc, proj, tall };
}

const rankText = (r, n, locale) => (String(locale).startsWith('en') ? `#${r} of ${n}` : `${r}.º de ${n}`);

export function choropleth(spec, theme) {
  const B = baseChart(spec, theme, 'choropleth');
  const { locale, m, fmt, frame, area, gid, body, sc, proj, tall } = B;
  const hl = spec.highlight === undefined ? null : [].concat(spec.highlight).map(normKey);
  const isHl = (f) => hl && featureIndexHas(f, hl);
  const N = m.values.size;
  const regions = [], outlines = [];
  const items = [];
  for (const f of m.features) {
    const v = m.values.get(f);
    const has = v !== undefined;
    const fill = has ? sc.color(v) : spec.missing === 'plain' ? theme.tint : `url(#${gid}-nd)`;
    const name = nameOf(f, locale);
    const tipTxt = has ? `${name}\n${fmt(v)} · ${rankText(m.rank.get(f), N, locale)}` : `${name}\n${T(locale, 'Sin dato', 'No data')}`;
    regions.push(el('path', { class: 'pa-m', d: pathD(f.geometry, proj), fill, stroke: theme.surface, strokeWidth: 0.75, strokeLinejoin: 'round', opacity: hl && !isHl(f) ? 0.5 : null, 'data-tip': tipTxt }));
    if (isHl(f)) outlines.push(el('path', { d: pathD(f.geometry, proj), fill: 'none', stroke: theme.ink, strokeWidth: 1.5, strokeLinejoin: 'round', 'pointer-events': 'none' }));
    const c = centroid(f.geometry, proj);
    items.push({ f, name, v, cx: c.x, cy: c.y, area: c.area, label: has ? fmt(v) : '—', color: has ? sc.color(v) : theme.tint, missing: !has, tip: tipTxt });
  }
  body.push(g({ class: 'pa-regions' }, regions), g({ class: 'pa-outlines' }, outlines));
  if (tall && spec.labels !== false) {
    const x = proj.bounds.x + proj.bounds.w + 26;
    const maxV = Math.max(...[...m.values.values()].map(Math.abs));
    body.push(...labelColumn(items, x, area.y, area.y + area.h, area.x + area.w - x, theme, fmt, { bars: spec.bars !== false, maxV }));
  } else {
    const chosen = new Set(chooseLabeled(m, spec, locale, m.features.length <= 30 ? m.features.length : 0));
    const ordered = items.filter((it) => chosen.has(it.f) && !it.missing).sort((a, b) => b.area - a.area);
    body.push(...mapLabels(ordered, theme));
  }
  const desc = describeMap(m, fmt, locale, T(locale, 'Mapa coroplético', 'Choropleth map'));
  return frame.finish(body, { desc, type: 'choropleth', defs: noDataPattern(`${gid}-nd`, theme) });
}

/** Mapa de símbolos: círculos de área proporcional en el centroide. */
export function symbolMap(spec, theme) {
  const B = baseChart(spec, theme, 'symbol');
  const { locale, m, fmt, frame, area, body, proj, tall, gid } = B;
  const N = m.values.size;
  const maxV = Math.max(...[...m.values.values()].map(Math.abs), 0) || 1;
  const rMax = spec.maxRadius ?? Math.max(8, Math.min(30, Math.sqrt(proj.bounds.w * proj.bounds.h) / (tall ? 9 : 16)));
  const color = (spec.colors && Object.values(spec.colors)[0]) || theme.categorical[0];
  body.push(g({ class: 'pa-regions' }, m.features.map((f) => el('path', { d: pathD(f.geometry, proj), fill: theme.tint, stroke: theme.surface, strokeWidth: 0.75, strokeLinejoin: 'round' }))));
  const items = m.features.map((f) => {
    const c = centroid(f.geometry, proj);
    const v = m.values.get(f);
    const name = nameOf(f, locale);
    return { f, name, v, cx: c.x, cy: c.y, area: c.area, r: v === undefined ? 0 : Math.sqrt(Math.abs(v) / maxV) * rMax, label: v === undefined ? '—' : fmt(v), color, missing: v === undefined,
      tip: v === undefined ? `${name}\n${T(locale, 'Sin dato', 'No data')}` : `${name}\n${fmt(v)} · ${rankText(m.rank.get(f), N, locale)}` };
  });
  const circles = items.filter((it) => !it.missing).sort((a, b) => b.r - a.r)
    .map((it) => el('circle', { class: 'pa-m', cx: it.cx, cy: it.cy, r: Math.max(1.5, it.r), fill: color, fillOpacity: 0.75, stroke: theme.surface, strokeWidth: 1.5, 'data-tip': it.tip }));
  body.push(g({ class: 'pa-symbols' }, circles));
  // Leyenda de tamaños (tres círculos anidados) en la esquina libre.
  const sizes = [maxV, maxV / 4, maxV / 16].map((v) => ({ v, r: Math.sqrt(v / maxV) * rMax }));
  const lx = tall ? proj.bounds.x + proj.bounds.w + 26 : area.x + 4, ly = tall ? area.y + area.h - 4 : area.y + area.h - 4;
  const leg = sizes.map((s) => [
    el('circle', { cx: lx + rMax, cy: ly - s.r, r: s.r, fill: 'none', stroke: theme.muted, strokeWidth: 0.75 }),
    el('line', { x1: lx + rMax, x2: lx + rMax * 2 + 8, y1: ly - 2 * s.r, y2: ly - 2 * s.r, stroke: theme.muted, strokeWidth: 0.5 }),
    text(lx + rMax * 2 + 11, ly - 2 * s.r + 3.5, fmt(s.v), { fill: theme.muted, fontSize: 10.5 }),
  ]);
  if (tall && spec.labels !== false) {
    const x = proj.bounds.x + proj.bounds.w + 26;
    const legH = rMax * 2 + 12;
    body.push(...labelColumn(items.map((it) => ({ ...it, barColor: color })), x, area.y, area.y + area.h - legH, area.x + area.w - x, theme, fmt, { bars: spec.bars !== false, maxV }));
  } else {
    const chosen = new Set(chooseLabeled(m, spec, locale, Math.min(5, m.values.size)));
    body.push(...mapLabels(items.filter((it) => chosen.has(it.f) && !it.missing).sort((a, b) => b.v - a.v).map((it) => ({ ...it, cy: it.cy - it.r - 10 })), theme));
  }
  body.push(g({ class: 'pa-legend pa-size-legend' }, leg));
  const desc = describeMap(m, fmt, locale, T(locale, 'Mapa de símbolos', 'Proportional symbol map'));
  return frame.finish(body, { desc, type: 'symbolmap' });
}

function describeMap(m, fmt, locale, what) {
  const en = String(locale).startsWith('en');
  if (!m.ranked.length) return `${what}.`;
  const [hiF, hiV] = m.ranked[0], [loF, loV] = m.ranked[m.ranked.length - 1];
  let s = en
    ? `${what} of ${humanize(m.valueF)} across ${m.values.size} areas. Highest: ${nameOf(hiF, locale)} (${fmt(hiV)}). Lowest: ${nameOf(loF, locale)} (${fmt(loV)}).`
    : `${what} de ${humanize(m.valueF).toLowerCase()} en ${m.values.size} territorios. Mayor: ${nameOf(hiF, locale)} (${fmt(hiV)}). Menor: ${nameOf(loF, locale)} (${fmt(loV)}).`;
  if (m.unmatched.length) s += en ? ` Unmatched: ${m.unmatched.slice(0, 8).join(', ')}.` : ` Sin coincidencia: ${m.unmatched.slice(0, 8).join(', ')}.`;
  return s;
}
