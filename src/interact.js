// Capa de interacción para el navegador: tooltip por marca y crosshair en
// líneas. Autocontenida (sin imports) para poder incrustarla en HTML.

export function attach(root) {
  if (!root || root.__pa) return;
  root.__pa = true;
  const svg = root.querySelector('svg.pa-chart');
  if (!svg) return;
  if (getComputedStyle(root).position === 'static') root.style.position = 'relative';
  const dark = svg.getAttribute('data-pa-mode') === 'dark';
  const tipEl = document.createElement('div');
  tipEl.setAttribute('role', 'tooltip');
  tipEl.style.cssText = [
    'position:absolute', 'pointer-events:none', 'z-index:10', 'opacity:0', 'transition:opacity .12s',
    'padding:8px 10px', 'border-radius:8px', 'font:12.5px/1.45 ' + (svg.getAttribute('font-family') || 'system-ui'),
    'white-space:nowrap', 'max-width:280px',
    dark ? 'background:#F2F3FA;color:#141A3F' : 'background:#141A3F;color:#FCFBF9',
    'box-shadow:0 6px 24px rgba(11,15,43,.18)',
  ].join(';');
  root.appendChild(tipEl);
  const NS = 'http://www.w3.org/2000/svg';
  const overlay = document.createElementNS(NS, 'g');
  overlay.setAttribute('pointer-events', 'none');
  svg.appendChild(overlay);
  let on = null;
  let pinned = null;

  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
  const show = (html, ev) => {
    tipEl.innerHTML = html;
    tipEl.style.opacity = '1';
    const r = root.getBoundingClientRect();
    let x = ev.clientX - r.left + 14, y = ev.clientY - r.top + 14;
    const w = tipEl.offsetWidth, h = tipEl.offsetHeight;
    if (x + w > r.width) x = ev.clientX - r.left - w - 14;
    if (y + h > r.height) y = Math.max(0, ev.clientY - r.top - h - 14);
    tipEl.style.left = x + 'px';
    tipEl.style.top = y + 'px';
  };
  const hide = () => {
    tipEl.style.opacity = '0';
    if (on) on.classList.remove('pa-on');
    on = null;
    overlay.innerHTML = '';
    if (!pinned) svg.classList.remove('pa-focus');
  };
  const linesHtml = (txt) =>
    String(txt).split('\n').map((l, i) => (i === 0 ? `<div style="font-weight:600">${esc(l)}</div>` : `<div style="opacity:.86">${esc(l)}</div>`)).join('');

  const toSvg = (ev) => {
    const pt = svg.createSVGPoint();
    pt.x = ev.clientX; pt.y = ev.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  };

  svg.addEventListener('pointermove', (ev) => {
    const t = ev.target;
    if (t && t.closest && t.closest('.pa-key')) return; // la leyenda maneja su propio foco
    if (t && t.classList && t.classList.contains('pa-cross')) {
      const data = JSON.parse(t.getAttribute('data-cross'));
      const p = toSvg(ev);
      let best = data[0];
      for (const d of data) if (Math.abs(d.x - p.x) < Math.abs(best.x - p.x)) best = d;
      const y0 = +t.getAttribute('data-y0'), y1 = +t.getAttribute('data-y1');
      overlay.innerHTML =
        `<line x1="${best.x}" x2="${best.x}" y1="${y0}" y2="${y1}" stroke="${dark ? '#8A90B4' : '#7C819C'}" stroke-width="1"/>` +
        best.v.map((v) => `<circle cx="${best.x}" cy="${v[2]}" r="4.5" fill="${v[1]}" stroke="${dark ? '#0B0F2B' : '#FCFBF9'}" stroke-width="2"/>`).join('');
      const rows = [...best.v].sort((a, b) => a[2] - b[2]).map((v) => `<div style="display:flex;gap:8px;align-items:center"><span style="width:8px;height:8px;border-radius:50%;background:${v[1]}"></span><span style="opacity:.86;flex:1">${esc(v[0])}</span><b style="font-weight:600;margin-left:12px">${esc(v[3])}</b></div>`).join('');
      show(`<div style="font-weight:600;margin-bottom:2px">${esc(best.t)}</div>${rows}`, ev);
      return;
    }
    if (t && t.classList && t.classList.contains('pa-near')) {
      // Capa densa: busca el punto más cercano (≤ 14 px).
      const pts = t.__near || (t.__near = JSON.parse(t.getAttribute('data-near')));
      const p = toSvg(ev);
      let best = null, bd = 196;
      for (const q of pts) { const d = (q[0] - p.x) ** 2 + (q[1] - p.y) ** 2; if (d < bd) { bd = d; best = q; } }
      if (!best) { hide(); return; }
      overlay.innerHTML = `<circle cx="${best[0]}" cy="${best[1]}" r="6" fill="${best[3]}" stroke="${dark ? '#0B0F2B' : '#FCFBF9'}" stroke-width="2"/>`;
      if (best[2]) show(linesHtml(best[2]), ev); else tipEl.style.opacity = '0';
      return;
    }
    const tg = t && t.closest ? t.closest('[data-tip]') : null;
    if (!tg) { hide(); return; }
    const mark = tg.classList.contains('pa-m') ? tg : tg.querySelector('.pa-m') && tg.querySelectorAll('.pa-m').length === 1 ? tg.querySelector('.pa-m') : null;
    if (mark !== on) {
      if (on) on.classList.remove('pa-on');
      on = mark;
      if (on) { on.classList.add('pa-on'); svg.classList.add('pa-focus'); } else svg.classList.remove('pa-focus');
    }
    show(linesHtml(tg.getAttribute('data-tip')), ev);
  });
  svg.addEventListener('pointerleave', hide);

  // Leyenda conectada: pasar sobre una clave destaca sus marcas (mismo color);
  // un clic la deja fija, otro clic la suelta.
  const norm = (c) => String(c || '').trim().toLowerCase();
  const body = svg.querySelector('.pa-body');
  const marksOf = (color) => {
    const c = norm(color);
    const out = new Set();
    if (!body) return out;
    for (const n of body.querySelectorAll('[fill],[stroke]')) {
      if (norm(n.getAttribute('fill')) === c || norm(n.getAttribute('stroke')) === c) {
        const m = n.closest('.pa-m') || n;
        out.add(m);
      }
    }
    return out;
  };
  const focusColor = (color) => {
    svg.querySelectorAll('.pa-m.pa-on').forEach((n) => n.classList.remove('pa-on'));
    svg.querySelectorAll('.pa-key').forEach((k) => (k.style.opacity = color && norm(k.getAttribute('data-color')) !== norm(color) ? '0.4' : ''));
    if (!color) { svg.classList.remove('pa-focus'); return; }
    const ms = marksOf(color);
    // Marcas sin clase pa-m (p. ej. etiquetas) no se atenúan: solo las que tienen datos.
    for (const n of body ? body.querySelectorAll('[fill],[stroke]') : []) if (ms.has(n) && !n.classList.contains('pa-m')) n.classList.add('pa-m');
    ms.forEach((m) => m.classList.add('pa-on'));
    svg.classList.add('pa-focus');
  };
  for (const k of svg.querySelectorAll('.pa-key')) {
    k.setAttribute('tabindex', '0');
    k.setAttribute('role', 'button');
    k.addEventListener('pointerenter', () => { if (!pinned) focusColor(k.getAttribute('data-color')); });
    k.addEventListener('pointerleave', () => { if (!pinned) focusColor(null); });
    const toggle = () => { pinned = pinned === k ? null : k; focusColor(pinned ? k.getAttribute('data-color') : null); };
    k.addEventListener('click', toggle);
    k.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
  }
}

export const attachSource = attach.toString();
