// Navegador: render() con ancho adaptable, tooltips, slider temporal
// (periodo con "play" o rango con vista general) y navegación por niveles
// en treemap/sunburst. Todo se vuelve a dibujar con plot(): sin estado oculto.
import { attach } from './interact.js';
import { themeFor, FONT_CSS } from './theme.js';
import { ensureData, fieldKind, uniq, num, PlotError } from './data.js';
import { parseDate, formatDate } from './format.js';
import { dateUnit } from './scale.js';
import { isGeoUrl } from './geo/registry.js';
import { words } from './i18n.js';

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
.pa-ctl{display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;padding:8px 0 4px;font-size:12.5px;color:var(--pa-muted);user-select:none;font-variant-numeric:tabular-nums}
.pa-play{flex:none;width:28px;height:28px;border-radius:50%;border:1px solid var(--pa-line);background:transparent;color:var(--pa-ink);cursor:pointer;display:grid;place-items:center;padding:0 0 0 1px;transition:border-color .15s}
.pa-play[aria-pressed=true]{padding:0}
.pa-play:hover{border-color:var(--pa-ink)}
.pa-play:focus-visible,.pa-seg button:focus-visible{outline:2px solid var(--pa-accent);outline-offset:2px}
.pa-play svg{display:block}
.pa-seg{display:flex;flex-wrap:wrap;gap:2px 4px}
.pa-seg button{font:inherit;font-size:12.5px;color:var(--pa-muted);background:none;border:0;border-radius:0;padding:5px 6px;cursor:pointer;box-shadow:inset 0 -1px 0 transparent;transition:color .15s}
.pa-seg button:hover{color:var(--pa-ink)}
.pa-seg button[aria-checked=true]{color:var(--pa-ink);font-weight:600;box-shadow:inset 0 -2px 0 var(--pa-accent)}
.pa-track{position:relative;flex:1 1 200px;min-width:0;height:34px}
.pa-track input[type=range]{position:absolute;left:0;width:100%;top:4px;margin:0;height:16px;-webkit-appearance:none;appearance:none;background:linear-gradient(to right,var(--pa-ink) var(--pa-p,100%),var(--pa-line) var(--pa-p,100%)) center/100% 2px no-repeat;cursor:pointer}
.pa-dual input[type=range]{background:none;pointer-events:none}
.pa-dual::before,.pa-dual::after{content:'';position:absolute;top:11px;height:2px;border-radius:1px}
.pa-dual::before{left:0;right:0;background:var(--pa-line)}
.pa-dual::after{left:var(--pa-a,0%);right:calc(100% - var(--pa-b,100%));background:var(--pa-ink)}
.pa-track input[type=range]::-webkit-slider-runnable-track{background:transparent;height:16px}
.pa-track input[type=range]::-moz-range-track{background:transparent;height:16px}
.pa-track input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;pointer-events:auto;width:12px;height:12px;margin-top:2px;border-radius:50%;background:var(--pa-ink);border:2px solid var(--pa-surface);box-shadow:0 0 0 1px var(--pa-ink);cursor:grab;position:relative;z-index:1}
.pa-track input[type=range]::-moz-range-thumb{pointer-events:auto;width:10px;height:10px;border-radius:50%;background:var(--pa-ink);border:2px solid var(--pa-surface);box-shadow:0 0 0 1px var(--pa-ink);cursor:grab}
.pa-track input[type=range]:focus-visible{outline:none}
.pa-track input[type=range]:focus-visible::-webkit-slider-thumb{box-shadow:0 0 0 1px var(--pa-ink),0 0 0 4px color-mix(in srgb,var(--pa-accent) 35%,transparent)}
.pa-ends{position:absolute;left:0;right:0;top:22px;display:flex;justify-content:space-between;font-size:10.5px;color:var(--pa-muted);pointer-events:none}
.pa-now{flex:none;font-weight:600;color:var(--pa-ink);font-size:12.5px;min-width:4ch;text-align:right}
.pa-chart [data-drill],.pa-chart [data-node],.pa-chart [data-group]{cursor:pointer}
.pa-chart [data-group]:focus-visible,.pa-chart .pa-key:focus-visible{outline:2px solid var(--pa-accent,#3A47B8);outline-offset:1px}
.pa-live .pa-chev{opacity:1!important}
.pa-chart .pa-gh:hover .pa-hit{fill:var(--pa-tint,#ECEEF8);fill-opacity:.5}
.pa-chart [data-node]:focus-visible{outline:none;stroke:var(--pa-accent);stroke-width:3px}
.pa-search{position:absolute;z-index:2;box-sizing:border-box;margin:0;font:inherit;font-size:13px;color:var(--pa-ink);background-color:var(--pa-surface);background-repeat:no-repeat;background-position:10px center;border:1px solid var(--pa-line);border-radius:8px;padding:0 10px 0 32px;outline:none;transition:border-color .15s,box-shadow .15s;-webkit-appearance:none;appearance:none}
.pa-search::placeholder{color:var(--pa-muted);opacity:1}
.pa-search:hover{border-color:var(--pa-muted)}
.pa-search:focus-visible,.pa-search:focus{border-color:var(--pa-accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--pa-accent) 22%,transparent)}
.pa-chart .pa-th[data-sort]:focus-visible,.pa-chart .pa-pg:focus-visible{outline:2px solid var(--pa-accent);outline-offset:-2px}
@media (prefers-reduced-motion: reduce){.pa-m{transition:none!important}.pa-search{transition:none}}`;
  document.head.appendChild(st);
}

/**
 * Dibuja `spec` en un elemento (o selector) del navegador.
 * Devuelve { svg, spec, update(spec), destroy() }.
 */
const geoCache = new Map();
/** Descarga (una vez por URL) un GeoJSON o TopoJSON. */
export function loadGeo(url) {
  if (!geoCache.has(url)) geoCache.set(url, fetch(url).then((r) => { if (!r.ok) throw new PlotError(`No pude descargar el mapa (${r.status}): ${url}`); return r.json(); }));
  return geoCache.get(url);
}

/**
 * `geo` como URL ("/mapas/comunas.geojson", "https://…/x.topojson"): se
 * descarga y luego se dibuja. Devuelve el mismo objeto que render(), con
 * `ready` (una promesa) mientras llega el archivo.
 */
function renderRemote(host, spec, opts) {
  let inner = null, pending = null, dead = false;
  const handle = {
    get svg() { return inner?.svg ?? null; },
    get spec() { return inner?.spec ?? spec; },
    update(s) { if (inner) return inner.update(s); pending = s; },
    destroy() { dead = true; inner?.destroy(); },
  };
  host.setAttribute('aria-busy', 'true');
  handle.ready = loadGeo(spec.geo).then((geo) => {
    host.removeAttribute('aria-busy');
    if (dead) return handle;
    inner = render(host, { ...(pending || spec), geo }, opts);
    return handle;
  }, (e) => {
    host.removeAttribute('aria-busy');
    host.innerHTML = `<p style="font:13px system-ui;color:#C9531A">${String(e.message).replace(/</g, '&lt;')}</p>`;
    throw e;
  });
  return handle;
}

export function render(target, spec, opts = {}) {
  const host = typeof target === 'string' ? document.querySelector(target) : target;
  if (!host) throw new PlotError('No encontré el elemento destino.', 'render("#grafico", spec) o render(elemento, spec)');
  if (spec && typeof spec.geo === 'string' && typeof fetch !== 'undefined' && isGeoUrl(spec.geo)) return renderRemote(host, spec, opts);
  ensureAssets();
  let state = resolveFn ? resolveFn(spec) : { ...spec };
  // Fuente propia (configure({ font }) o spec.font): se carga una sola vez.
  const fontUrl = themeFor(state).font?.import;
  if (fontUrl && typeof document !== 'undefined' && !document.querySelector(`link[href="${fontUrl}"]`)) {
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = fontUrl; document.head.appendChild(l);
  }
  host.innerHTML = '';
  const chart = document.createElement('div');
  const ctl = document.createElement('div');
  host.appendChild(chart);
  host.appendChild(ctl);
  let timer = null, ro = null, raf = 0;

  const width = () => state.width ?? Math.max(280, Math.round(chart.clientWidth || host.clientWidth || 720));
  // Tabla: caja de búsqueda (sobre 20 filas, o `search: true`), pegada a la franja que la tabla reserva.
  let search = null, searchTimer = 0;
  if (state.type === 'table' && state.search !== false) {
    let n = 0;
    try { n = ensureData(state).length; } catch { n = 0; }
    if (state.search === true || n > 20) {
      const th = themeFor(state);
      const W = words(state.locale);
      search = document.createElement('input');
      search.type = 'search'; search.className = 'pa-search';
      search.placeholder = W.search + '…'; search.setAttribute('aria-label', W.search);
      search.autocomplete = 'off'; search.spellcheck = false;
      if (state.query) search.value = state.query;
      const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14"><circle cx="6" cy="6" r="4.25" fill="none" stroke="${th.muted}" stroke-width="1.5"/><path d="M9.2 9.2l3.3 3.3" stroke="${th.muted}" stroke-width="1.5" stroke-linecap="round"/></svg>`;
      search.style.cssText = `--pa-accent:${th.categorical[0]};--pa-surface:${th.surface};--pa-ink:${th.ink};--pa-muted:${th.muted};--pa-line:${th.axis};font-family:${(th.font?.family || 'system-ui').replace(/"/g, "'")};background-image:url("data:image/svg+xml,${encodeURIComponent(icon)}")`;
      search.addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => { state = { ...state, query: search.value.trim() || undefined, page: 1 }; draw(); }, 120);
      });
      search.addEventListener('keydown', (e) => { if (e.key === 'Escape' && search.value) { e.stopPropagation(); search.value = ''; state = { ...state, query: undefined, page: 1 }; draw(); } });
      if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
      host.appendChild(search);
    }
  }
  const placeSearch = () => {
    if (!search) return;
    const slot = chart.querySelector('.pa-search-slot');
    if (!slot) { search.hidden = true; return; }
    search.hidden = false;
    const r = slot.getBoundingClientRect(), h = host.getBoundingClientRect();
    search.style.left = r.left - h.left + 'px'; search.style.top = r.top - h.top + 'px';
    search.style.width = r.width + 'px'; search.style.height = r.height + 'px';
  };
  // Posiciones anteriores de los nodos (para animar el cambio de foco).
  const nodePos = () => {
    const m = new Map();
    for (const c of chart.querySelectorAll('circle[data-node]')) m.set(c.getAttribute('data-node'), [+c.getAttribute('cx'), +c.getAttribute('cy')]);
    return m;
  };
  const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const animateFrom = (before) => {
    if (reduced || !before.size || typeof Element === 'undefined' || !Element.prototype.animate) return;
    const ease = 'cubic-bezier(.2,.7,.2,1)';
    for (const c of chart.querySelectorAll('circle[data-node]')) {
      const old = before.get(c.getAttribute('data-node'));
      if (!old) continue;
      const dx = old[0] - +c.getAttribute('cx'), dy = old[1] - +c.getAttribute('cy');
      c.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'translate(0,0)' }], { duration: 650, easing: ease });
    }
    for (const sel of ['.pa-links', '.pa-labels']) {
      const n = chart.querySelector(sel);
      if (n) n.animate([{ opacity: 0 }, { opacity: 0 }, { opacity: 1 }], { duration: 750, easing: 'ease-out' });
    }
  };
  // Colores anteriores de las regiones (mapas): al mover el slider, el color
  // de cada región transita al nuevo en vez de saltar.
  const regionFills = () => {
    const m = new Map();
    for (const n of chart.querySelectorAll('.pa-regions [data-k]')) { const f = n.getAttribute('fill'); if (/^#/.test(f || '')) m.set(n.getAttribute('data-k'), f); }
    return m;
  };
  const tweenFills = (before) => {
    if (reduced || !before.size || typeof Element === 'undefined' || !Element.prototype.animate) return;
    for (const n of chart.querySelectorAll('.pa-regions [data-k]')) {
      const old = before.get(n.getAttribute('data-k')), now = n.getAttribute('fill');
      if (old && /^#/.test(now || '') && old.toLowerCase() !== now.toLowerCase()) n.animate([{ fill: old }, { fill: now }], { duration: 420, easing: 'ease-out' });
    }
  };
  // Leyenda: en treemap y sunburst, clic = ver solo esa categoría en todo el
  // plano (otro clic vuelve); en todos los gráficos, shift + clic la excluye
  // (o la vuelve a sumar). Devuelve true si tomó el clic.
  const onLegend = (key, e) => {
    const v = key.getAttribute('data-value');
    if (v === null || key.getAttribute('data-color') === 'dashed') return false;
    const ex = [].concat(state.exclude ?? []).map(String);
    if (e.shiftKey || key.classList.contains('pa-key-off')) {
      const next = ex.includes(v) ? ex.filter((x) => x !== v) : [...ex, v];
      // Colores fijos: los de la leyenda actual, para que nada cambie de color.
      const colors = { ...(state.colors || {}) };
      for (const k of chart.querySelectorAll('.pa-key[data-value]')) {
        const c = k.getAttribute('data-color');
        if (/^#/.test(c || '') && !k.classList.contains('pa-key-off') && !(k.getAttribute('data-value') in colors)) colors[k.getAttribute('data-value')] = c;
      }
      const f = Array.isArray(state.focus) && state.focus[0] === v ? undefined : state.focus;
      state = { ...state, exclude: next.length ? next : undefined, colors, focus: f };
      draw();
      return true;
    }
    if (state.type === 'treemap' || state.type === 'sunburst') {
      const cur = Array.isArray(state.focus) ? state.focus : [];
      state = { ...state, focus: cur.length === 1 && cur[0] === v ? [] : [v] };
      draw();
      return true;
    }
    return false;
  };
  const draw = () => {
    const before = nodePos();
    const fills = regionFills();
    chart.innerHTML = plotFn({ ...state, width: width(), _search: !!search });
    animateFrom(before);
    tweenFills(fills);
    chart.__pa = false;
    chart.__paLegend = onLegend;
    attach(chart);
    const svgNode = chart.querySelector('svg');
    if (svgNode) svgNode.classList.add('pa-live');
    // Red: clic en un nodo lo lleva al centro y destaca sus conexiones; otro clic (o Esc) vuelve.
    for (const n of chart.querySelectorAll('[data-node]')) {
      // Solo los círculos son paradas de tabulación; las etiquetas también responden al clic.
      if (n.tagName.toLowerCase() === 'circle') {
        n.setAttribute('tabindex', '0');
        n.setAttribute('role', 'button');
        n.setAttribute('aria-label', (n.getAttribute('data-tip') || n.getAttribute('data-node')).split('\n')[0]);
      }
      const id = n.getAttribute('data-node');
      const go = () => { state = { ...state, focus: String(state.focus) === id ? undefined : id }; draw(); };
      n.addEventListener('click', go);
      n.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    }
    for (const n of chart.querySelectorAll('[data-drill]')) {
      n.setAttribute('tabindex', '0');
      n.setAttribute('role', 'button');
      const go = () => { state = { ...state, focus: JSON.parse(n.getAttribute('data-drill')) }; draw(); };
      n.addEventListener('click', go);
      n.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    }
    // Gantt: clic en una fase la pliega en una barra-resumen; otro clic la despliega.
    // Alt + clic pliega o despliega todas.
    const groupsAll = [...chart.querySelectorAll('[data-group]')].map((n) => n.getAttribute('data-group'));
    for (const n of chart.querySelectorAll('[data-group]')) {
      if (!n.querySelector('.pa-chev')) continue; // collapsible: false
      const name = n.getAttribute('data-group');
      n.setAttribute('tabindex', '0');
      n.setAttribute('role', 'button');
      n.setAttribute('aria-expanded', n.getAttribute('data-collapsed') === 'true' ? 'false' : 'true');
      const go = (e) => {
        let cur = state.collapsed === true ? [...groupsAll] : [].concat(state.collapsed || []).map(String);
        if (e && e.altKey) cur = cur.length === groupsAll.length ? [] : [...groupsAll];
        else cur = cur.includes(name) ? cur.filter((g) => g !== name) : [...cur, name];
        state = { ...state, collapsed: cur };
        draw();
        const again = [...chart.querySelectorAll('[data-group]')].find((m) => m.getAttribute('data-group') === name);
        if (again && e && e.type === 'keydown') again.focus();
      };
      n.addEventListener('click', go);
      n.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(e); } });
    }
    // Tabla: paso de página y orden por columna (clic o Enter/Espacio; ←/→ en el paginador).
    placeSearch();
    const refocus = (sel) => { const m = chart.querySelector(sel); if (m) m.focus(); return !!m; };
    // Las flechas ‹ › llevan data-arrow; tras el cambio se busca la misma flecha.
    const refocusSame = (arrow, p) => (arrow ? refocus(`[data-arrow="${arrow}"][data-page]`) : refocus(`[data-page="${p}"]:not([data-arrow])`));
    for (const n of chart.querySelectorAll('[data-page]')) {
      const p = +n.getAttribute('data-page');
      const arrow = n.getAttribute('data-arrow');
      n.setAttribute('tabindex', '0');
      n.setAttribute('role', 'button');
      const go = (e) => {
        state = { ...state, page: p };
        draw();
        // Con teclado el foco sigue en el mismo botón (o en la página actual si esa flecha se apagó).
        if (e && e.type === 'keydown' && !refocusSame(arrow, p)) refocus('.pa-pg-on');
      };
      n.addEventListener('click', go);
      n.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(e); return; }
        const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!d) return;
        const pages = [...chart.querySelectorAll('[data-page]')];
        const k = pages.indexOf(n) + d;
        if (pages[k]) { e.preventDefault(); pages[k].focus(); }
      });
    }
    for (const n of chart.querySelectorAll('.pa-th[data-sort]')) {
      const f = n.getAttribute('data-sort');
      n.setAttribute('tabindex', '0');
      n.setAttribute('aria-label', `${words(state.locale).sort} ${n.textContent}`);
      // Primer clic: el orden natural (cifras de mayor a menor, texto A→Z); segundo: al revés; tercero: el orden original.
      const go = (e) => {
        const cur = n.getAttribute('aria-sort');
        const numeric = n.getAttribute('data-num') === '1';
        const first = numeric ? 'desc' : 'asc';
        const firstAria = first === 'desc' ? 'descending' : 'ascending';
        let next;
        if (cur === 'none' || !cur) next = { sortBy: f, sort: first };
        else if (cur === firstAria) next = { sortBy: f, sort: first === 'desc' ? 'asc' : 'desc' };
        else next = { sortBy: undefined, sort: undefined };
        state = { ...state, ...next, sortOrder: undefined, page: 1 };
        draw();
        if (e && e.type === 'keydown') refocus(`.pa-th[data-sort="${CSS.escape ? CSS.escape(f) : f}"]`);
      };
      n.addEventListener('click', go);
      n.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(e); } });
    }
  };
  const schedule = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); };

  const theme = themeFor(state);
  ctl.className = 'pa-ctl';
  ctl.style.cssText = `--pa-accent:${theme.categorical[0]};--pa-surface:${theme.surface};--pa-ink:${theme.ink};--pa-muted:${theme.muted};--pa-tint:${theme.tint};--pa-line:${theme.axis};background:${theme.surface};padding-left:${state.padding ?? 24}px;padding-right:${state.padding ?? 24}px;padding-bottom:6px;font-family:${(theme.font?.family || 'system-ui').replace(/"/g, "'")}`;
  ctl.hidden = true;

  // Controles de tiempo: SOLO si se piden (`slider: true`, "buttons" o "slider").
  // Con pocos periodos van botones; con muchos, un slider mínimo.
  const want = controlMode(state, opts);
  if (want) {
    if (state.time && !SNAP_EXCLUDE.has(state.type) && state.x !== state.time) buildPeriod(want);
    else if (RANGE_TYPES.has(state.type)) buildRange();
  }

  // ── Periodo único: botones o slider, con un play sobrio ─────────────────
  function buildPeriod(mode) {
    const vals = timeValuesOf(state);
    if (vals.length < 2) return;
    let i = vals.findIndex((v) => String(v) === String(state.timeValue ?? vals[vals.length - 1]));
    if (i < 0) i = vals.length - 1;
    ctl.hidden = false;
    const labels = vals.map(String);
    const buttons = mode === 'buttons' || (mode === 'auto' && vals.length <= 8 && labels.join('').length <= 64);
    const play = state.play === false ? null : button();
    if (play) ctl.append(play);
    let setUI;
    if (buttons) {
      const group = document.createElement('div');
      group.className = 'pa-seg'; group.setAttribute('role', 'radiogroup'); group.setAttribute('aria-label', String(state.time));
      const btns = labels.map((l, k) => {
        const b = document.createElement('button');
        b.type = 'button'; b.textContent = l; b.setAttribute('role', 'radio');
        b.addEventListener('click', () => { stop(); set(k); });
        b.addEventListener('keydown', (e) => {
          const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
          if (!d) return;
          e.preventDefault(); stop();
          const k2 = Math.max(0, Math.min(vals.length - 1, i + d)); set(k2); btns[k2].focus();
        });
        group.appendChild(b);
        return b;
      });
      ctl.append(group);
      setUI = (k) => btns.forEach((b, j) => { b.setAttribute('aria-checked', j === k ? 'true' : 'false'); b.tabIndex = j === k ? 0 : -1; });
    } else {
      const track = document.createElement('div'); track.className = 'pa-track';
      const input = range(0, vals.length - 1, i, String(state.time));
      input.style.setProperty('--pa-p', '100%');
      const ends = document.createElement('div'); ends.className = 'pa-ends';
      ends.innerHTML = '<span></span><span></span>';
      ends.children[0].textContent = labels[0]; ends.children[1].textContent = labels[labels.length - 1];
      track.append(input, ends);
      const now = document.createElement('span'); now.className = 'pa-now';
      ctl.append(track, now);
      input.addEventListener('input', () => { stop(); set(+input.value); });
      setUI = (k) => { input.value = k; input.style.setProperty('--pa-p', (100 * k) / (vals.length - 1) + '%'); now.textContent = labels[k]; };
    }
    const set = (k) => {
      i = k; setUI(k);
      state = { ...state, timeValue: vals[k] };
      schedule();
    };
    if (play) play.addEventListener('click', () => {
      if (timer) return stop();
      if (i >= vals.length - 1) set(0);
      setIcon(play, 'pause');
      timer = setInterval(() => { if (i >= vals.length - 1) return stop(); set(i + 1); }, state.playInterval ?? 1200);
    });
    function stop() { clearInterval(timer); timer = null; if (play) setIcon(play, 'play'); }
    setUI(i);
  }

  // ── Rango (series de tiempo): dos tiradores sobre una línea fina ────────
  function buildRange() {
    const data = ensureData(state);
    const xf = state.x;
    if (!xf || !data.length || !(xf in data[0])) return;
    const kind = fieldKind(data, xf);
    if (!['date', 'year', 'number'].includes(kind)) return;
    const raw = uniq(data.map((r) => r[xf]));
    const val = (v) => (kind === 'date' ? parseDate(v) : num(v));
    const xs = raw.map((v) => ({ v, t: val(v) })).filter((p) => Number.isFinite(p.t)).sort((a, b) => a.t - b.t);
    if (xs.length < 3) return;
    ctl.hidden = false;
    const fmtX = (p) => (kind === 'date' ? formatDate(p.t, dateUnit(xs.map((q) => q.t)), state.locale || 'es') : String(p.v));
    let lo = 0, hi = xs.length - 1;
    if (state.xRange) {
      const a = xs.findIndex((p) => p.t >= val(state.xRange[0])), b = xs.map((p) => p.t <= val(state.xRange[1])).lastIndexOf(true);
      if (a >= 0) lo = a; if (b >= 0) hi = b;
    }
    const track = document.createElement('div'); track.className = 'pa-track pa-dual';
    const a = range(0, xs.length - 1, lo, 'Desde'), b = range(0, xs.length - 1, hi, 'Hasta');
    const ends = document.createElement('div'); ends.className = 'pa-ends';
    ends.innerHTML = '<span></span><span></span>';
    ends.children[0].textContent = fmtX(xs[0]); ends.children[1].textContent = fmtX(xs[xs.length - 1]);
    track.append(a, b, ends);
    const now = document.createElement('span'); now.className = 'pa-now';
    ctl.append(track, now);
    const n = xs.length - 1;
    const set = () => {
      let i0 = +a.value, i1 = +b.value;
      if (i1 - i0 < 1) { if (document.activeElement === a) a.value = i0 = Math.max(0, i1 - 1); else b.value = i1 = Math.min(n, i0 + 1); }
      track.style.setProperty('--pa-a', (100 * i0) / n + '%');
      track.style.setProperty('--pa-b', (100 * i1) / n + '%');
      now.textContent = `${fmtX(xs[i0])} – ${fmtX(xs[i1])}`;
      state = { ...state, xRange: i0 === 0 && i1 === n ? undefined : [xs[i0].v, xs[i1].v] };
      schedule();
    };
    a.addEventListener('input', set); b.addEventListener('input', set);
    set();
  }

  host.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (state.focus !== undefined && state.type === 'network') { state = { ...state, focus: undefined }; draw(); return; }
    // Treemap/sunburst: Esc sube un nivel; en la raíz, vuelve a sumar lo excluido.
    if (Array.isArray(state.focus) && state.focus.length) { state = { ...state, focus: state.focus.slice(0, -1) }; draw(); return; }
    if (state.exclude && [].concat(state.exclude).length) { state = { ...state, exclude: undefined }; draw(); }
  });

  draw();
  if (state.width === undefined && typeof ResizeObserver !== 'undefined') {
    let last = host.clientWidth;
    ro = new ResizeObserver(() => { if (Math.abs(host.clientWidth - last) > 8) { last = host.clientWidth; schedule(); } });
    ro.observe(host);
  }
  return {
    get svg() { return chart.querySelector('svg'); },
    get spec() { return state; },
    update(next) { clearInterval(timer); clearTimeout(searchTimer); ro && ro.disconnect(); return render(host, next, opts); },
    destroy() { clearInterval(timer); clearTimeout(searchTimer); ro && ro.disconnect(); host.innerHTML = ''; },
  };
}

/**
 * ¿Qué control de tiempo dibujar? Ninguno por defecto: el gráfico muestra el
 * último periodo (o `timeValue`). `slider: true` (o `controls: true`) elige
 * botones o slider según cuántos periodos haya; "buttons" y "slider" fuerzan
 * uno. `render(el, spec, { controls: false })` los apaga siempre.
 */
export function controlMode(s, opts = {}) {
  if (opts.controls === false) return null;
  const v = s.slider ?? s.controls ?? opts.controls;
  if (v === true || v === 'auto') return 'auto';
  if (v === 'buttons' || v === 'button' || v === 'botones') return 'buttons';
  if (v === 'slider' || v === 'range') return 'slider';
  return null;
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
  b.setAttribute('aria-pressed', kind === 'play' ? 'false' : 'true');
  b.innerHTML = kind === 'play'
    ? '<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M2.6 1.4v7.2L8.6 5z" fill="currentColor" stroke="currentColor" stroke-width=".8" stroke-linejoin="round"/></svg>'
    : '<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M3 1.6v6.8M7 1.6v6.8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
}
