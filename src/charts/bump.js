// Bump chart: el orden de las cosas a lo largo del tiempo.
//
// El eje y es el puesto (1 arriba), no el valor: lo que se lee es quién pasó a
// quién. Con `ends: "first-last"` sólo se dibujan el primer y el último periodo
// (un slope chart). Los nombres van en ambos extremos —con el puesto a la
// izquierda— y a la derecha un ▲/▼ dice cuántos puestos subió o bajó.
//
// `top: N` deja las series que estuvieron entre las N primeras en algún periodo
// mostrado; un puesto fuera de las N se dibuja en una fila «más abajo», hueco,
// y el tooltip dice el puesto real. El color sigue a la entidad.
import { tipper } from '../tooltip.js';
import { el, g, text, tip } from '../svg.js';
import { measure, truncate } from '../text.js';
import { makeFormat, parseDate } from '../format.js';
import { colorMap, readable } from '../theme.js';
import { ensureData, requireField, uniq, num, fieldKind, inferXY, PlotError, highlightSet } from '../data.js';
import { createFrame } from '../frame.js';
import { xLabels } from '../axes.js';
import { langOf } from '../i18n.js';

export function bump(spec, theme) {
  const locale = spec.locale || 'es';
  const en = langOf(locale) === 'en';
  const data = ensureData(spec);
  const TT = tipper(spec, data, locale);
  const inf = inferXY(spec, data);
  const x = spec.x ?? inf.x;
  const series = spec.series ?? spec.hue;
  const rankF = spec.rank ?? null;
  const y = (Array.isArray(spec.y) ? spec.y[0] : spec.y) ?? spec.value ?? (rankF ? null : inf.y);
  requireField(data, x, 'x');
  if (!series) throw new PlotError(en ? 'A bump chart needs `series`: what is being ranked.' : 'Un bump chart necesita `series`: lo que se ordena.', 'series: "country"');
  requireField(data, series, 'series');
  if (rankF) requireField(data, rankF, 'rank'); else requireField(data, y, 'y');

  // Periodos en orden.
  const kind = fieldKind(data, x);
  let periods = uniq(data.map((r) => String(r[x])));
  if (kind === 'date') periods.sort((a, b) => parseDate(a) - parseDate(b));
  else if (kind === 'year' || kind === 'number') periods.sort((a, b) => num(a) - num(b));
  if (spec.ends === 'first-last' && periods.length > 2) periods = [periods[0], periods[periods.length - 1]];

  // Valor y puesto por (serie, periodo).
  const val = new Map();
  const given = new Map();
  for (const r of data) {
    const p = String(r[x]);
    if (!periods.includes(p)) continue;
    const k = String(r[series]) + '\u0000' + p;
    if (y) val.set(k, (val.get(k) || 0) + (Number.isFinite(num(r[y])) ? num(r[y]) : 0));
    if (rankF && Number.isFinite(num(r[rankF]))) given.set(k, num(r[rankF]));
  }
  const all = uniq(data.map((r) => String(r[series])));
  const rank = new Map();
  for (const p of periods) {
    if (rankF) {
      for (const s of all) { const v = given.get(s + '\u0000' + p); if (Number.isFinite(v)) rank.set(s + '\u0000' + p, v); }
    } else {
      // Desempate por nombre: misma entrada, mismo dibujo.
      const here = all.filter((s) => val.has(s + '\u0000' + p)).sort((a, b) => (val.get(b + '\u0000' + p) - val.get(a + '\u0000' + p)) || (a < b ? -1 : 1));
      here.forEach((s, i) => rank.set(s + '\u0000' + p, i + 1));
    }
  }
  const R = (s, p) => rank.get(s + '\u0000' + p);
  const N = spec.top ?? Math.min(all.length, 12);
  const keep = all.filter((s) => periods.some((p) => R(s, p) <= N));
  const lastP = periods[periods.length - 1], firstP = periods[0];
  // Orden de color: por puesto final (quien termina arriba toma el primer color).
  const byEnd = [...keep].sort((a, b) => (R(a, lastP) ?? Infinity) - (R(b, lastP) ?? Infinity) || (a < b ? -1 : 1));
  const cmap = colorMap(byEnd, theme, spec.colors);
  const hl = highlightSet(spec);
  const colorOf = (s) => (hl && !hl.has(s) ? theme.dim : cmap.get(s));
  const rows = Math.min(N, Math.max(...keep.flatMap((s) => periods.map((p) => R(s, p) ?? 0)))) + (keep.some((s) => periods.some((p) => R(s, p) > N)) ? 1 : 0);
  const fmt = y ? makeFormat(spec.format, locale, [...val.values()]) : null;

  // Marco y medidas.
  const fs = 12;
  const frame = createFrame(spec, theme, { height: 120 + rows * 30 });
  const narrow = frame.width < 520;
  const area = frame.layout([]);
  const leftLab = (s) => `${R(s, firstP) ?? '–'}. ${s}`;
  const moved = (s) => { const a = R(s, firstP), b = R(s, lastP); return Number.isFinite(a) && Number.isFinite(b) ? a - b : null; };
  const mark = (s) => { const m = moved(s); return m === null ? '' : m > 0 ? `▲${m}` : m < 0 ? `▼${-m}` : '='; };
  const rightLab = (s) => (narrow ? `${R(s, lastP) ?? '–'}. ${s}` : s);
  const maxW = Math.min(area.w * (narrow ? 0.45 : 0.28), Math.max(...keep.map((s) => measure(rightLab(s), fs) + measure(' ▲00', fs))));
  const leftW = narrow ? Math.max(...keep.map((s) => measure(String(R(s, firstP) ?? '–'), fs, 600))) + 10 : Math.min(area.w * 0.28, Math.max(...keep.map((s) => measure(leftLab(s), fs)))) + 12;
  const inner = { x: area.x + leftW, y: area.y + 4, w: Math.max(40, area.w - leftW - maxW - 12), h: 0 };
  const rowH = spec.height === undefined ? 30 : Math.max(14, (area.h - 30) / rows);
  inner.h = rowH * (rows - 1);
  if (spec.height === undefined) frame.setHeight(inner.y + inner.h + 34 + frame.chrome);
  const px = (i) => inner.x + (periods.length === 1 ? inner.w / 2 : (i / (periods.length - 1)) * inner.w);
  const py = (r) => inner.y + (Math.min(r, N + 1) - 1) * rowH;

  const body = [];
  // Periodos al pie.
  body.push(xLabels(periods.map((p, i) => ({ pos: px(i), label: p })), inner, theme, { y: inner.y + inner.h + 22 }));

  // Las atenuadas primero, para que las destacadas queden encima.
  const order = hl ? [...byEnd.filter((s) => !hl.has(s)), ...byEnd.filter((s) => hl.has(s))] : [...byEnd].reverse();
  for (const s of order) {
    const c = colorOf(s);
    const pts = periods.map((p, i) => [i, R(s, p)]).filter(([, r]) => Number.isFinite(r));
    if (!pts.length) continue;
    const d = 'M' + pts.map(([i, r]) => `${px(i).toFixed(2)},${py(r).toFixed(2)}`).join('L');
    const parts = [el('path', { d, fill: 'none', stroke: c, strokeWidth: theme.marks?.lineWidth ?? 2.25, strokeLinejoin: 'round', strokeLinecap: 'round' })];
    for (const [i, r] of pts) {
      const out = r > N;
      const v = y ? val.get(s + '\u0000' + periods[i]) : null;
      parts.push(g({ class: 'pa-m', 'data-tip': TT({ [series]: s, [x]: periods[i] }, s, `${periods[i]}: #${r}` + (v !== null && v !== undefined ? ` (${fmt(v)})` : '')) }, [
        el('circle', { cx: px(i), cy: py(r), r: 9, fill: 'transparent' }),
        el('circle', { cx: px(i), cy: py(r), r: out ? 3 : 4, fill: out ? theme.surface : c, stroke: c, strokeWidth: out ? 1.5 : 0 }),
      ]));
    }
    const ink = hl && !hl.has(s) ? theme.muted : readable(cmap.get(s), theme);
    // Extremos: nombre a la izquierda (o sólo el puesto, en angosto) y a la derecha.
    const r0 = R(s, firstP), r1 = R(s, lastP);
    if (Number.isFinite(r0) && r0 <= N) {
      parts.push(text(inner.x - 10, py(r0) + 4, narrow ? String(r0) : truncate(leftLab(s), leftW - 12, fs), { fill: ink, fontSize: fs, textAnchor: 'end', fontWeight: narrow ? 600 : null }));
    }
    if (Number.isFinite(r1) && r1 <= N) {
      const lab = truncate(rightLab(s), maxW - measure(' ▲00', fs), fs);
      parts.push(text(inner.x + inner.w + 10, py(r1) + 4, lab, { fill: ink, fontSize: fs }));
      const m = mark(s);
      if (m && periods.length > 1) parts.push(text(inner.x + inner.w + 14 + measure(lab, fs), py(r1) + 4, m, { fill: theme.muted, fontSize: fs - 1.5 }));
    }
    body.push(g({ class: 'pa-bump-s', 'data-color': cmap.get(s) }, parts));
  }
  if (rows > N) {
    body.push(text(inner.x - 10, py(N + 1) + 4, en ? `below ${N}` : `bajo ${N}`, { fill: theme.muted, fontSize: 11, textAnchor: 'end' }));
  }

  // Descripción
  const up = keep.filter((s) => moved(s) > 0).sort((a, b) => moved(b) - moved(a))[0];
  const top1 = byEnd[0];
  const desc = en
    ? `Rank of ${keep.length} series from ${firstP} to ${lastP}. First in ${lastP}: ${top1}.` + (up ? ` Largest rise: ${up}, ${moved(up)} places.` : '')
    : `Puesto de ${keep.length} series de ${firstP} a ${lastP}. Primero en ${lastP}: ${top1}.` + (up ? ` Mayor subida: ${up}, ${moved(up)} puestos.` : '');
  return frame.finish(body, { desc, type: 'bump' });
}
