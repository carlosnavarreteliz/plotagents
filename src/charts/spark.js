// Sparkline: la forma de una serie, en su propia escala.
//
// Una línea de palabra: no responde «cuánto» (eso lo dice la cifra que va al
// lado) sino «cómo se movió». Por eso la escala va del mínimo al máximo de la
// serie, sin cero, sin ejes, sin grilla ni rótulos; cabe en una celda de tabla
// (108 × 26) y no tiene tamaño mínimo. Un punto marca el último valor. Con
// `series`, hasta unas pocas líneas comparten la misma escala.
import { tipper } from '../tooltip.js';
import { el, g, tip, r2 } from '../svg.js';
import { makeFormat } from '../format.js';
import { colorMap } from '../theme.js';
import { ensureData, requireField, uniq, num, fieldsOf, fieldKind, xValue, inferXY, PlotError } from '../data.js';
import { createFrame } from '../frame.js';
import { langOf } from '../i18n.js';

export function spark(spec, theme) {
  const locale = spec.locale || 'es';
  const en = langOf(locale) === 'en';
  const data = ensureData(spec);
  const TT = tipper(spec, data, locale);
  const inf = inferXY(spec, data);
  const x = spec.x ?? inf.x;
  const y = (Array.isArray(spec.y) ? spec.y[0] : spec.y) ?? spec.value ?? inf.y;
  requireField(data, x, 'x');
  requireField(data, y, 'y');
  const series = spec.series ?? spec.hue ?? null;
  if (series) requireField(data, series, 'series');
  const kind = fieldKind(data, x);
  const cats = kind === 'category' ? uniq(data.map((r) => String(r[x]))) : null;
  const xv = (v) => (cats ? cats.indexOf(String(v)) : xValue(v, kind));
  const keys = series ? uniq(data.map((r) => String(r[series]))) : [String(y)];

  // Puntos por serie, ordenados por x; un y que no es número es un hueco.
  const xs = new Map(); // x numérico → rótulo original
  const lines = keys.map((k) => ({ key: k, pts: [] }));
  const byKey = new Map(lines.map((l) => [l.key, l]));
  for (const r of data) {
    const xn = xv(r[x]);
    if (!Number.isFinite(xn)) continue;
    xs.set(xn, xs.has(xn) ? xs.get(xn) : String(r[x]));
    byKey.get(series ? String(r[series]) : keys[0]).pts.push({ x: xn, y: num(r[y]) });
  }
  for (const l of lines) l.pts.sort((a, b) => a.x - b.x);
  const ys = lines.flatMap((l) => l.pts.map((p) => p.y)).filter(Number.isFinite);
  if (!ys.length) throw new PlotError(en ? 'The sparkline has no numeric values.' : 'La sparkline no tiene valores numéricos.', en ? `Check that "${y}" holds numbers.` : `Revisa que "${y}" tenga números.`);
  const xKeys = [...xs.keys()].sort((a, b) => a - b);

  const lw = spec.lineWidth ?? Math.min(theme.marks?.lineWidth ?? 2.25, 1.75);
  const dotR = spec.dot === false ? 0 : spec.dotRadius ?? lw + 0.9;
  const frame = createFrame(spec, theme, { chrome: false, width: 120, height: 32, minWidth: 16, minHeight: 8, padding: Math.ceil(Math.max(dotR, lw / 2) + 0.5) });
  const area = { x: frame.pad, y: frame.pad, w: frame.width - frame.pad * 2, h: frame.height - frame.pad * 2 };

  let lo = Math.min(...ys), hi = Math.max(...ys);
  if (spec.yDomain) [lo, hi] = spec.yDomain;
  const flat = hi === lo;
  const x0 = xKeys[0], x1 = xKeys[xKeys.length - 1];
  const px = (v) => area.x + (x1 === x0 ? area.w / 2 : ((v - x0) / (x1 - x0)) * area.w);
  const py = (v) => (flat ? area.y + area.h / 2 : area.y + area.h - ((v - lo) / (hi - lo)) * area.h);

  const fmt = makeFormat(spec.format, locale, ys);
  const cmap = colorMap(keys, theme, spec.colors);
  const colorOf = (k) => (series ? cmap.get(k) : spec.colors?.[k] ?? (typeof spec.color === 'string' && spec.color.startsWith('#') ? spec.color : theme.categorical[0]));

  const body = [];
  for (const l of lines) {
    const c = colorOf(l.key);
    // Tramos sin huecos.
    const segs = [];
    let cur = [];
    for (const p of l.pts) {
      if (Number.isFinite(p.y)) cur.push([px(p.x), py(p.y)]);
      else if (cur.length) { segs.push(cur); cur = []; }
    }
    if (cur.length) segs.push(cur);
    const d = segs.map((s) => 'M' + s.map(([a, b]) => `${r2(a)},${r2(b)}`).join('L')).join('');
    if (spec.fill && !series) {
      const base = area.y + area.h;
      const fillD = segs.filter((s) => s.length > 1).map((s) => `M${r2(s[0][0])},${r2(base)}L` + s.map(([a, b]) => `${r2(a)},${r2(b)}`).join('L') + `L${r2(s[s.length - 1][0])},${r2(base)}Z`).join('');
      if (fillD) body.push(el('path', { d: fillD, fill: c, fillOpacity: typeof spec.fill === 'number' ? spec.fill : theme.marks?.areaOpacity ?? 0.12, stroke: 'none' }));
    }
    if (d) body.push(el('path', { d, fill: 'none', stroke: c, strokeWidth: lw, strokeLinejoin: 'round', strokeLinecap: 'round' }));
    const last = [...l.pts].reverse().find((p) => Number.isFinite(p.y));
    if (last && dotR) body.push(el('circle', { cx: px(last.x), cy: py(last.y), r: dotR, fill: c }));
  }

  // Capa de tooltip: una franja invisible por x, con el valor de cada serie.
  const step = xKeys.length > 1 ? area.w / (xKeys.length - 1) : area.w;
  for (const xn of xKeys) {
    const vals = lines.map((l) => [l.key, l.pts.find((p) => p.x === xn)?.y]);
    const lineTxt = vals.map(([k, v]) => (series ? `${k}: ` : '') + (Number.isFinite(v) ? fmt(v) : '—'));
    const cx = px(xn);
    const x0r = Math.max(0, cx - step / 2), x1r = Math.min(frame.width, cx + step / 2);
    // `bare`: sin la clase del runtime ni los ceros por omisión.
    body.push(g({ class: spec.bare ? null : 'pa-m', 'data-tip': TT({ [x]: xs.get(xn) }, xs.get(xn), ...lineTxt) }, [
      el('rect', { x: spec.bare && !x0r ? null : x0r, y: spec.bare ? null : 0, width: Math.max(0.5, x1r - x0r), height: frame.height, fill: 'transparent' }),
    ]));
  }

  // Descripción
  const l0 = lines[0];
  const firstP = l0.pts.find((p) => Number.isFinite(p.y));
  const lastP = [...l0.pts].reverse().find((p) => Number.isFinite(p.y));
  const desc = firstP && lastP
    ? (en ? `Sparkline of ${y}: from ${fmt(firstP.y)} (${xs.get(firstP.x)}) to ${fmt(lastP.y)} (${xs.get(lastP.x)}); range ${fmt(Math.min(...ys))}–${fmt(Math.max(...ys))}.`
      : `Sparkline de ${y}: de ${fmt(firstP.y)} (${xs.get(firstP.x)}) a ${fmt(lastP.y)} (${xs.get(lastP.x)}); rango ${fmt(Math.min(...ys))}–${fmt(Math.max(...ys))}.`)
    : '';
  return frame.finish(body, { desc, type: 'spark' });
}
