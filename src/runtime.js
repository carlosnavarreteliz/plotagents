// Navegador: render() con ancho adaptable, tooltips, slider temporal
// (periodo con "play" o rango con vista general) y navegación por niveles
// en treemap/sunburst. Todo se vuelve a dibujar con plot(): sin estado oculto.
import { attach } from './interact.js';
import { themeFor, FONT_CSS } from './theme.js';
import { ensureData, fieldKind, uniq, num, PlotError } from './data.js';
import { parseDate, formatDate } from './format.js';
import { dateUnit } from './scale.js';

let plotFn = null;
let resolveFn = null;
/** index.js registra plot/resolve aquí (evita una importación circular). */
export function _bind(plot, resolve) { plotFn = plot; resolveFn = resolve; }

const RANGE_TYPES = new Set(['line', 'area']);
const SNAP_EXCLUDE = new Set(['line', 'area', 'ecdf']);

function ensureAssets() {
  if (typeof document === 'undefined') return;
  if (!document.getElementById('pa-font')) {
    const l = document.createElement('link');
    l.id = 'pa-font'; l.rel = 'stylesheet'; l.href = FONT_CSS;
    document.head.appendChild(l);
  }
  if (document.getElementById('pa-runtime-css')) return;
  const st = document.createElement('style');
  st.id = 'pa-runtime-css';
  st.textContent = `
.pa-ctl{display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;padding:4px 0 2px;font-size:12px;color:var(--pa-muted);user-select:none}
.pa-play{flex:none;width:30px;height:30px;border-radius:50%;border:0;background:var(--pa-accent);color:var(--pa-surface);cursor:pointer;display:grid;place-items:center;padding:0}
.pa-play:focus-visible{outline:2px solid var(--pa-accent);outline-offset:2px}
.pa-play svg{display:block}
.pa-track{position:relative;flex:1 1 220px;min-width:0;height:40px}
.pa-track svg.pa-ov{position:absolute;left:0;top:0;width:100%;height:28px;overflow:visible}
.pa-track input[type=range]{position:absolute;left:0;width:100%;top:6px;margin:0;height:22px;background:transparent;-webkit-appearance:none;appearance:none;pointer-events:none}
.pa-track input[type=range]::-webkit-slider-runnable-track{background:transparent;height:22px}
.pa-track input[type=range]::-moz-range-track{background:transparent;height:22px}
.pa-track input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;pointer-events:auto;width:16px;height:16px;margin-top:3px;border-radius:50%;background:var(--pa-accent);border:2px solid var(--pa-surface);box-shadow:0 1px 4px rgba(11,15,43,.3);cursor:grab}
.pa-track input[type=range]::-moz-range-thumb{pointer-events:auto;width:12px;height:12px;border-radius:50%;background:var(--pa-accent);border:2px solid var(--pa-surface);box-shadow:0 1px 4px rgba(11,15,43,.3);cursor:grab}
.pa-track input[type=range]:focus-visible::-webkit-slider-thumb{outline:2px solid var(--pa-accent);outline-offset:2px}
.pa-ticks{position:absolute;left:0;right:0;top:28px;height:12px;font-size:10.5px;color:var(--pa-muted)}
.pa-ticks span{position:absolute;transform:translateX(-50%);white-space:nowrap}
.pa-now{flex:none;font-weight:600;color:var(--pa-ink);font-size:13px;min-width:4ch;text-align:right;font-variant-numeric:tabular-nums}
.pa-chart [data-drill]{cursor:pointer}
@media (prefers-reduced-motion: reduce){.pa-m{transition:none!important}}`;
  document.head.appendChild(st);
}

/**
 * Dibuja `spec` en un elemento (o selector) del navegador.
 * Devuelve { svg, spec, update(spec), destroy() }.
 */
export function render(target, spec, opts = {}) {
  const host = typeof target === 'string' ? document.querySelector(target) : target;
  if (!host) throw new PlotError('No encontré el elemento destino.', 'render("#grafico", spec) o render(elemento, spec)');
  ensureAssets();
  let state = resolveFn ? resolveFn(spec) : { ...spec };
  host.innerHTML = '';
  const chart = document.createElement('div');
  const ctl = document.createElement('div');
  host.appendChild(chart);
  host.appendChild(ctl);
  let timer = null, ro = null, raf = 0;

  const width = () => state.width ?? Math.max(280, Math.round(chart.clientWidth || host.clientWidth || 720));
  const draw = () => {
    chart.innerHTML = plotFn({ ...state, width: width() });
    chart.__pa = false;
    attach(chart);
    for (const n of chart.querySelectorAll('[data-drill]')) {
      n.setAttribute('tabindex', '0');
      n.setAttribute('role', 'button');
      const go = () => { state = { ...state, focus: JSON.parse(n.getAttribute('data-drill')) }; draw(); };
      n.addEventListener('click', go);
      n.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    }
  };
  const schedule = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); };

  const theme = themeFor(state);
  ctl.className = 'pa-ctl';
  ctl.style.cssText = `--pa-accent:${theme.categorical[0]};--pa-surface:${theme.surface};--pa-ink:${theme.ink};--pa-muted:${theme.muted};--pa-tint:${theme.tint};background:${theme.surface};padding-left:${state.padding ?? 24}px;padding-right:${state.padding ?? 24}px;padding-bottom:10px;font-family:${(theme.font?.family || 'system-ui').replace(/"/g, "'")}`;
  ctl.hidden = true;

  if (opts.controls !== false && state.slider !== false) {
    if (state.time && !SNAP_EXCLUDE.has(state.type) && state.x !== state.time) buildPeriod();
    else if (RANGE_TYPES.has(state.type)) buildRange();
  }

  // ── Periodo único con "play" (d3plus time) ──────────────────────────────
  function buildPeriod() {
    const vals = timeValuesOf(state);
    if (vals.length < 2) return;
    let i = vals.findIndex((v) => String(v) === String(state.timeValue ?? vals[vals.length - 1]));
    if (i < 0) i = vals.length - 1;
    ctl.hidden = false;
    const play = button();
    const track = document.createElement('div'); track.className = 'pa-track';
    const ov = svgEl('svg', { class: 'pa-ov', viewBox: '0 0 100 28', preserveAspectRatio: 'none' });
    ov.appendChild(svgEl('rect', { x: 0, y: 13, width: 100, height: 3, rx: 1.5, fill: theme.tint2 || theme.tint }));
    const fill = svgEl('rect', { x: 0, y: 13, height: 3, rx: 1.5, fill: theme.categorical[0] });
    ov.appendChild(fill);
    track.appendChild(ov);
    const input = range(0, vals.length - 1, i, 'Periodo');
    track.appendChild(input);
    const now = document.createElement('span'); now.className = 'pa-now';
    ctl.append(play, track, now);
    track.appendChild(ticks(vals.map(String), (k) => k / (vals.length - 1), null, track));
    const set = (k) => {
      i = k; input.value = k;
      fill.setAttribute('width', (100 * k) / (vals.length - 1));
      now.textContent = String(vals[k]);
      state = { ...state, timeValue: vals[k] };
      schedule();
    };
    input.addEventListener('input', () => { stop(); set(+input.value); });
    play.addEventListener('click', () => {
      if (timer) return stop();
      if (i >= vals.length - 1) set(0);
      setIcon(play, 'pause');
      timer = setInterval(() => { if (i >= vals.length - 1) return stop(); set(i + 1); }, state.playInterval ?? 1000);
    });
    function stop() { clearInterval(timer); timer = null; setIcon(play, 'play'); }
    set(i);
  }

  // ── Rango con vista general (series de tiempo) ──────────────────────────
  function buildRange() {
    const data = ensureData(state);
    const xf = state.x;
    if (!xf || !data.length || !(xf in data[0])) return;
    const kind = fieldKind(data, xf);
    if (!['date', 'year', 'number'].includes(kind)) return;
    const raw = uniq(data.map((r) => r[xf]));
    const val = (v) => (kind === 'date' ? parseDate(v) : num(v));
    const xs = raw.map((v) => ({ v, t: val(v) })).filter((p) => Number.isFinite(p.t)).sort((a, b) => a.t - b.t);
    if (xs.length < (state.sliderMin ?? 6)) return;
    ctl.hidden = false;
    // Vista general: suma de todas las series por x.
    const ys = Array.isArray(state.y) ? state.y : [state.y];
    const tot = new Map(xs.map((p) => [p.t, 0]));
    for (const r of data) { const t = val(r[xf]); if (tot.has(t)) tot.set(t, tot.get(t) + ys.reduce((a, f) => a + (Number.isFinite(num(r[f])) ? num(r[f]) : 0), 0)); }
    const tv = xs.map((p) => tot.get(p.t));
    const mn = Math.min(...tv), mx = Math.max(...tv);
    const t0 = xs[0].t, t1 = xs[xs.length - 1].t;
    const px = (t) => (100 * (t - t0)) / (t1 - t0 || 1);
    const py = (v) => 26 - (22 * (v - mn)) / (mx - mn || 1);
    const track = document.createElement('div'); track.className = 'pa-track';
    const ov = svgEl('svg', { class: 'pa-ov', viewBox: '0 0 100 28', preserveAspectRatio: 'none' });
    const d = xs.map((p, k) => `${k ? 'L' : 'M'}${px(p.t).toFixed(2)},${py(tv[k]).toFixed(2)}`).join('');
    ov.appendChild(svgEl('path', { d: d + `L100,28L0,28Z`, fill: theme.muted, 'fill-opacity': 0.18 }));
    ov.appendChild(svgEl('path', { d, fill: 'none', stroke: theme.muted, 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke' }));
    const sel = svgEl('rect', { y: 0, height: 28, fill: theme.categorical[0], 'fill-opacity': 0.14 });
    ov.appendChild(sel);
    track.appendChild(ov);
    const fmtX = (p) => (kind === 'date' ? formatDate(p.t, dateUnit(xs.map((q) => q.t)), state.locale || 'es') : String(p.v));
    let lo = 0, hi = xs.length - 1;
    if (state.xRange) {
      const a = xs.findIndex((p) => p.t >= val(state.xRange[0])), b = xs.map((p) => p.t <= val(state.xRange[1])).lastIndexOf(true);
      if (a >= 0) lo = a; if (b >= 0) hi = b;
    }
    const a = range(0, xs.length - 1, lo, 'Desde'), b = range(0, xs.length - 1, hi, 'Hasta');
    // Con fechas, las marcas del slider son años (o el primer valor de cada año).
    const yearOf = (p) => new Date(p.t).getUTCFullYear();
    const tickLabels = kind === 'date' ? xs.map((p) => String(yearOf(p))) : xs.map(fmtX);
    const keep = kind === 'date' ? (k) => k === 0 || yearOf(xs[k]) !== yearOf(xs[k - 1]) : null;
    track.append(a, b);
    const now = document.createElement('span'); now.className = 'pa-now';
    now.textContent = `${fmtX(xs[0])} – ${fmtX(xs[xs.length - 1])}`;
    ctl.append(track, now);
    track.appendChild(ticks(tickLabels, (k) => px(xs[k].t) / 100, keep, track));
    const set = () => {
      let i0 = +a.value, i1 = +b.value;
      if (i1 - i0 < 1) { if (document.activeElement === a) a.value = i0 = Math.max(0, i1 - 1); else b.value = i1 = Math.min(xs.length - 1, i0 + 1); }
      sel.setAttribute('x', px(xs[i0].t)); sel.setAttribute('width', Math.max(0.5, px(xs[i1].t) - px(xs[i0].t)));
      now.textContent = `${fmtX(xs[i0])} – ${fmtX(xs[i1])}`;
      state = { ...state, xRange: i0 === 0 && i1 === xs.length - 1 ? undefined : [xs[i0].v, xs[i1].v] };
      schedule();
    };
    a.addEventListener('input', set); b.addEventListener('input', set);
    set();
  }

  function ticks(labels, pos, keep, trackEl) {
    const box = document.createElement('div'); box.className = 'pa-ticks';
    const n = labels.length;
    const trackW = Math.max(120, (trackEl && trackEl.clientWidth) || (host.clientWidth || 600) - 180);
    const lw = Math.max(...labels.map((l) => String(l).length)) * 6.2 + 14;
    const every = Math.max(1, Math.ceil((n * lw) / trackW));
    let lastPx = -Infinity;
    labels.forEach((l, k) => {
      if (keep ? !keep(k) : k % every && k !== n - 1) return;
      const px = pos(k) * trackW;
      if (px - lastPx < lw && k !== n - 1) return;
      if (k === n - 1 && px - lastPx < lw) return;
      lastPx = px;
      const s = document.createElement('span'); s.textContent = l; s.style.left = (pos(k) * 100).toFixed(2) + '%';
      if (k === 0) s.style.transform = 'none';
      if (k === n - 1) s.style.transform = 'translateX(-100%)';
      box.appendChild(s);
    });
    return box;
  }

  draw();
  if (state.width === undefined && typeof ResizeObserver !== 'undefined') {
    let last = host.clientWidth;
    ro = new ResizeObserver(() => { if (Math.abs(host.clientWidth - last) > 8) { last = host.clientWidth; schedule(); } });
    ro.observe(host);
  }
  return {
    get svg() { return chart.querySelector('svg'); },
    get spec() { return state; },
    update(next) { clearInterval(timer); ro && ro.disconnect(); return render(host, next, opts); },
    destroy() { clearInterval(timer); ro && ro.disconnect(); host.innerHTML = ''; },
  };
}

function timeValuesOf(s) {
  const data = ensureData(s);
  const k = fieldKind(data, s.time);
  return uniq(data.map((r) => r[s.time]).filter((v) => v !== null && v !== undefined && v !== ''))
    .sort((a, b) => (k === 'date' ? parseDate(a) - parseDate(b) : k === 'year' || k === 'number' ? num(a) - num(b) : 0));
}

function svgEl(tag, attrs) {
  const n = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
}
function range(min, max, value, label) {
  const i = document.createElement('input');
  i.type = 'range'; i.min = min; i.max = max; i.step = 1; i.value = value;
  i.setAttribute('aria-label', label);
  return i;
}
function button() {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'pa-play';
  setIcon(b, 'play');
  return b;
}
function setIcon(b, kind) {
  b.setAttribute('aria-label', kind === 'play' ? 'Reproducir' : 'Pausar');
  b.innerHTML = kind === 'play'
    ? '<svg width="12" height="12" viewBox="0 0 12 12"><path d="M3 1.5v9l7.5-4.5z" fill="currentColor"/></svg>'
    : '<svg width="12" height="12" viewBox="0 0 12 12"><rect x="2.5" y="1.5" width="2.5" height="9" rx="1" fill="currentColor"/><rect x="7" y="1.5" width="2.5" height="9" rx="1" fill="currentColor"/></svg>';
}
