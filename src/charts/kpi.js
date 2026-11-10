// Indicadores (stat tiles): cuando la historia es un número, el número es
// el gráfico. Valor, variación con flecha y texto, tendencia y meta.
import { el, g, text, tip } from '../svg.js';
import { truncate, measure } from '../text.js';
import { makeFormat, formatNumber } from '../format.js';
import { num } from '../data.js';
import { createFrame } from '../frame.js';
import { ctx } from '../context.js';

export function kpi(spec, theme) {
  // Un solo indicador como objeto también vale: items: { label, value }.
  const items = [].concat(spec.items || spec.data || []).filter((it) => it && typeof it === 'object').map((it) => ({ ...it }));
  const locale = spec.locale || 'es';
  const en = String(locale).startsWith('en');
  const frame = createFrame(spec, theme, { height: 200 });
  const area = frame.layout([]);
  const n = Math.max(1, items.length);
  const fit = Math.max(1, Math.floor((area.w + 12) / 180));
  // Filas parejas: 4 tarjetas donde caben 3 → 2×2, no 3+1.
  const cols = spec.columns ?? (n <= fit ? n : Math.ceil(n / Math.ceil(n / fit)));
  const gap = 12;
  const tw = (area.w - gap * (cols - 1)) / cols;
  const hasTrend = items.some((it) => Array.isArray(it.trend) && it.trend.length > 1);
  const hasTarget = items.some((it) => it.target !== undefined);
  const X = ctx.textScale;
  const th = Math.round(118 * (0.35 + 0.65 * X) + (hasTrend ? 40 : 0) + (hasTarget ? 30 * X : 0));
  const rows = Math.ceil(n / cols);
  if (spec.height === undefined) frame.setHeight(area.y + rows * th + (rows - 1) * gap + frame.chrome);

  const body = [];
  // Mismo tamaño de cifra en todas las tarjetas (se ajusta a la más ancha).
  const trendOf = (it) => (Array.isArray(it.trend) ? it.trend.map(num).filter(Number.isFinite) : []);
  const show = (it, extra = trendOf(it)) => it.display ?? (Number.isFinite(num(it.value)) ? makeFormat(it.format ?? spec.format, locale, [num(it.value), ...extra])(num(it.value)) : '—');
  const shown = items.map((it) => show(it));
  let vSize = 34;
  while (vSize > 20 && shown.some((s) => measure(s, vSize, 600) > tw - 36)) vSize -= 2;
  items.forEach((it, i) => {
    const cx = area.x + (i % cols) * (tw + gap);
    const cy = area.y + Math.floor(i / cols) * (th + gap);
    const value = num(it.value);
    const fmt = makeFormat(it.format ?? spec.format, locale, [value, ...trendOf(it)].filter(Number.isFinite));
    const parts = [el('rect', { x: cx, y: cy, width: tw, height: th, rx: 12, fill: theme.tint })];
    const P = 18;
    parts.push(text(cx + P, cy + P + 12 * X, truncate(it.label ?? '', tw - P * 2, 13), { fill: theme.lede, fontSize: 13 }));
    const valStr = shown[i];
    parts.push(text(cx + P, cy + P + 12 * X + 10 + vSize * X * 0.92, valStr, { fill: theme.ink, fontSize: vSize, fontWeight: 600, letterSpacing: '-0.015em' }));

    // Variación: signo × si subir es bueno. Flecha + texto, nunca solo color.
    let delta = it.delta !== undefined ? num(it.delta) : it.previous !== undefined && num(it.previous) ? (value - num(it.previous)) / Math.abs(num(it.previous)) : NaN;
    let y = cy + P + 12 * X + 10 + vSize * X + 20 * X;
    if (Number.isFinite(delta)) {
      const isPct = (it.deltaFormat ?? 'percent') === 'percent';
      if (isPct && Math.abs(delta) > 1.5 && it.delta !== undefined) delta = delta / 100; // 12 → 12%
      const up = delta > 0, flat = delta === 0;
      const goodUp = (it.good ?? spec.good ?? 'up') === 'up';
      const good = flat ? null : up === goodUp;
      const color = good === null ? theme.lede : good ? theme.status.good : theme.status.critical;
      const arrow = flat ? '■' : up ? '▲' : '▼';
      const dstr = isPct
        ? (up ? '+' : flat ? '' : '−') + formatNumber(Math.abs(delta) * 100, Math.abs(delta) < 0.1 ? 1 : 0, locale, true) + '%'
        : (up ? '+' : flat ? '' : '−') + fmt(Math.abs(delta));
      parts.push(text(cx + P, y, `${arrow} ${dstr}`, { fill: color, fontSize: 13, fontWeight: 600 }));
      const period = it.period ?? it.deltaLabel;
      const dw = measure(`${arrow} ${dstr}`, 13, 600) + 8;
      if (period && dw + measure(period, 12.5) <= tw - P * 2) parts.push(text(cx + P + dw, y, period, { fill: theme.lede, fontSize: 12.5 }));
      else if (period) { y += 17 * X; parts.push(text(cx + P, y, truncate(period, tw - P * 2, 12.5), { fill: theme.lede, fontSize: 12.5 })); }
    } else if (it.note) {
      parts.push(text(cx + P, y, truncate(it.note, tw - P * 2, 12.5), { fill: theme.lede, fontSize: 12.5 }));
    }

    // Meta: medidor con riel del mismo tono, más claro.
    if (it.target !== undefined) {
      y += 24 * X;
      const t = num(it.target);
      const f = Number.isFinite(value) ? Math.max(0, Math.min(1, value / (t || 1))) : 0; // valor no numérico: riel vacío, nunca NaN
      const w = tw - P * 2;
      const upGood = (it.good ?? 'up') === 'up';
      const ratio = upGood ? value / (t || 1) : (t || 1) / (value || 1);
      const fill = ratio >= 1 ? theme.status.good : ratio >= 0.8 ? theme.categorical[0] : theme.status.critical;
      parts.push(el('rect', { x: cx + P, y, width: w, height: 6, rx: 3, fill: theme.tint2 }));
      parts.push(el('rect', { x: cx + P, y, width: Math.max(6, w * f), height: 6, rx: 3, fill }));
      const lab = (en ? 'Target ' : 'Meta ') + fmt(t) + ' · ' + (Number.isFinite(value) ? formatNumber((value / (t || 1)) * 100, 0, locale) + '%' : '—');
      parts.push(text(cx + P, y - 7, lab, { fill: theme.lede, fontSize: 11.5 }));
    }

    // Tendencia: línea recesiva, último punto en el acento.
    if (trendOf(it).length > 1) {
      const vals = trendOf(it);
      const mn = Math.min(...vals), mx = Math.max(...vals);
      const sx = cx + P, sw = tw - P * 2, sy = cy + th - P - 26, sh = 26;
      const pts = vals.map((v, k) => [sx + (k / (vals.length - 1)) * sw, sy + sh - ((v - mn) / (mx - mn || 1)) * sh]);
      parts.push(el('path', { d: pts.map(([a, b], k) => (k ? 'L' : 'M') + a.toFixed(1) + ',' + b.toFixed(1)).join(''), fill: 'none', stroke: theme.muted, strokeWidth: 1.75, strokeLinejoin: 'round', strokeLinecap: 'round' }));
      const [lx, ly] = pts[pts.length - 1];
      parts.push(el('circle', { cx: lx, cy: ly, r: 3.5, fill: theme.categorical[0], stroke: theme.tint, strokeWidth: 2 }));
    }
    body.push(g({ 'data-tip': tip(it.label, valStr, it.period ? `${it.period}` : '') }, parts));
  });
  const desc = items.map((it) => `${it.label ?? ''}: ${show(it, [])}`).join('. ');
  return frame.finish(body, { desc, type: 'kpi' });
}
