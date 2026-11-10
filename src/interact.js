// Capa de interacción para el navegador: tooltip por marca, crosshair en
// líneas, leyenda conectada y, en mapas, contorno al pasar, zoom con clic,
// Ctrl/⌘ + rueda, pellizco y arrastre, con botones +/−/restablecer.
// Autocontenida (sin imports) para poder incrustarla en HTML.

export function attach(root) {
  if (!root || root.__pa) return;
  root.__pa = true;
  const svg = root.querySelector('svg.pa-chart');
  if (!svg) return;
  if (getComputedStyle(root).position === 'static') root.style.position = 'relative';
  const dark = svg.getAttribute('data-pa-mode') === 'dark';
  const tipEl = document.createElement('div');
  tipEl.setAttribute('role', 'tooltip');
  tipEl.id = 'pa-tip-' + Math.random().toString(36).slice(2, 8);
  // Tooltip como tarjeta: fondo del tema (o `theme.tooltip`), cabecera del color de la marca.
  const custom = (svg.getAttribute('data-pa-tip') || '').split(',');
  const tipBg = custom[0] || (dark ? '#151A3D' : '#FFFFFF');
  const tipInk = custom[1] || (dark ? '#F2F3FA' : '#141A3F');
  tipEl.style.cssText = [
    'position:absolute', 'pointer-events:none', 'z-index:10', 'opacity:0', 'transition:opacity .12s',
    'padding:8px 10px', 'border-radius:8px', 'font:12.5px/1.45 ' + (svg.getAttribute('font-family') || 'system-ui'),
    'width:max-content', 'max-width:280px', 'overflow:hidden', 'overflow-wrap:anywhere', 'font-variant-numeric:tabular-nums',
    `background:${tipBg};color:${tipInk}`,
    dark ? 'border:1px solid rgba(242,243,250,.14)' : 'border:1px solid rgba(20,26,63,.10)',
    'box-shadow:0 8px 28px rgba(11,15,43,' + (dark ? '.45' : '.16') + ')',
  ].join(';');
  root.appendChild(tipEl);
  const NS = 'http://www.w3.org/2000/svg';
  const overlay = document.createElementNS(NS, 'g');
  overlay.setAttribute('pointer-events', 'none');
  svg.appendChild(overlay);
  let on = null;
  let pinned = null;

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  // Colores que llegan desde atributos de datos: solo hex o rgb() (nada que rompa el HTML).
  const col = (c) => (/^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\))$/i.test(String(c || '').trim()) ? String(c).trim() : '#888888');
  // Posición: junto a la marca (no al cursor), nunca sobre el título ni la
  // bajada, y dentro del gráfico. Prueba arriba, derecha, izquierda y abajo
  // (en barras horizontales, derecha primero) y conserva el lado anterior
  // mientras siga sirviendo, para que no salte.
  let lastSide = null;
  const headerBottom = (r) => {
    const t = +svg.getAttribute('data-pa-top');
    const m = svg.getScreenCTM && svg.getScreenCTM();
    return t && m ? t * m.d + m.f - r.top : 0;
  };
  const show = (html, ev, anchor, order) => {
    tipEl.innerHTML = html;
    tipEl.style.opacity = '1';
    const r = root.getBoundingClientRect();
    const w = tipEl.offsetWidth, h = tipEl.offsetHeight, G = 10, M = 4;
    const cx = ev.clientX - r.left, cy = ev.clientY - r.top;
    let a = null;
    if (anchor && anchor.l !== undefined) a = anchor;
    else if (anchor && anchor.getBoundingClientRect) {
      const b = anchor.getBoundingClientRect(), sb = svg.getBoundingClientRect();
      // Marcas grandes (celdas de treemap, regiones, sectores): mejor el puntero.
      if (b.width > 0 && b.width * b.height < 0.2 * sb.width * sb.height) a = { l: b.left - r.left, r: b.right - r.left, t: b.top - r.top, b: b.bottom - r.top };
    }
    if (!a) a = { l: cx - 8, r: cx + 8, t: cy - 8, b: cy + 8 };
    const minY = Math.min(Math.max(M, headerBottom(r) + M), Math.max(M, r.height - h - M));
    const maxY = Math.max(minY, r.height - h - M), maxX = Math.max(M, r.width - w - M);
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const hx = clamp(cx, a.l, a.r) - w / 2, vy = clamp(cy, a.t, a.b) - h / 2;
    const C = {
      top: [clamp(hx, M, maxX), a.t - G - h, 'y'],
      bottom: [clamp(hx, M, maxX), a.b + G, 'y'],
      right: [a.r + G, clamp(vy, minY, maxY), 'x'],
      left: [a.l - G - w, clamp(vy, minY, maxY), 'x'],
    };
    const ok = ([x, y]) => x >= M - 0.5 && x <= maxX + 0.5 && y >= minY - 0.5 && y <= maxY + 0.5;
    const sides = order || (a.r - a.l > a.b - a.t && a.r - a.l > 40 ? ['right', 'top', 'left', 'bottom'] : ['top', 'right', 'left', 'bottom']);
    const pick = [lastSide, ...sides].find((sd) => sd && C[sd] && ok(C[sd]));
    let x, y;
    if (pick) { [x, y] = C[pick]; lastSide = pick; }
    else { x = clamp(cx + 14, M, maxX); y = clamp(cy + 14, minY, maxY); lastSide = null; }
    tipEl.style.left = x + 'px';
    tipEl.style.top = y + 'px';
  };
  const type = svg.getAttribute('data-pa-type') || '';
  const isMap = type === 'choropleth' || type === 'symbolmap' || type === 'pointmap';
  const zoomG = svg.querySelector('.pa-zoom');
  const mapOverlay = document.createElementNS(NS, 'g');
  mapOverlay.setAttribute('pointer-events', 'none');
  if (zoomG) zoomG.appendChild(mapOverlay);
  // Red: al pasar sobre un nodo se encienden sus vecinos y sus aristas (como
  // emphasis.focus: 'adjacency' de ECharts); el resto se apaga.
  let extraOn = [];
  const adjacency = (node) => {
    extraOn.forEach((n) => n.classList.remove('pa-on'));
    extraOn = [];
    const id = node && node.getAttribute && node.getAttribute('data-node');
    const net = id !== null && id !== undefined && node.closest && node.closest('.pa-net');
    if (!net) return;
    const near = new Set([id]);
    for (const e of net.querySelectorAll('.pa-links [data-s]')) {
      const a = e.getAttribute('data-s'), b = e.getAttribute('data-t');
      if (a === id || b === id) { near.add(a); near.add(b); e.classList.add('pa-on'); extraOn.push(e); }
    }
    for (const c of net.querySelectorAll('.pa-nodes [data-node]')) if (near.has(c.getAttribute('data-node')) && c !== node) { c.classList.add('pa-on'); extraOn.push(c); }
  };
  const hide = () => {
    extraOn.forEach((n) => n.classList.remove('pa-on'));
    extraOn = [];
    tipEl.style.opacity = '0';
    if (on) on.classList.remove('pa-on');
    on = null;
    overlay.innerHTML = '';
    mapOverlay.innerHTML = '';
    if (!pinned) svg.classList.remove('pa-focus');
  };
  // Cabecera del tooltip con el color de la marca de fondo y texto blanco u
  // oscuro según el contraste (≥ 4,5:1; si ninguno llega, se ajusta el fondo).
  const rgb = (h) => { h = String(h).replace('#', ''); if (h.length === 3) h = h.split('').map((c) => c + c).join(''); const n = parseInt(h.slice(0, 6), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const lum = (c) => { const [r, g, b] = rgb(c).map((v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
  const hex = (a) => '#' + a.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
  const toHex = (c) => {
    c = String(c || '').trim();
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c)) return c;
    const m = /^rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/i.exec(c);
    return m ? hex([+m[1], +m[2], +m[3]]) : null;
  };
  const headerInk = (c) => {
    let bg = toHex(c);
    if (!bg) return null;
    const DARK = '#141A3F', LIGHT = '#FFFFFF';
    const fg = ratio(LIGHT, bg) >= ratio(DARK, bg) ? LIGHT : DARK;
    const to = fg === LIGHT ? [0, 0, 0] : [255, 255, 255];
    const A = rgb(bg);
    for (let t = 0.05; ratio(fg, bg) < 4.5 && t <= 1.001; t += 0.05) bg = hex(A.map((v, i) => v + (to[i] - v) * t));
    return { bg, fg };
  };
  // Con `skins`, el atributo trae la piel por defecto y el style la variable
  // de la piel que rige: el encabezado lleva el color que el lector ve.
  const skinned = (n, attr) => {
    const st = n && n.getAttribute ? n.getAttribute('style') || '' : '';
    const m = st.match(new RegExp('(?:^|;)\\s*' + attr + ':var\\((--pa-s\\d+)\\)'));
    if (!m || typeof getComputedStyle !== 'function') return null;
    return getComputedStyle(svg).getPropertyValue(m[1]).trim() || null;
  };
  const isLit = (c) => !!c && (/^#/.test(c) || /^rgba?\(/i.test(c));
  const markColor = (node) => {
    if (!node) return null;
    const dc = node.getAttribute && (node.getAttribute('data-color') || (node.querySelector('[data-color]') || { getAttribute: () => null }).getAttribute('data-color'));
    const cands = [node, ...node.querySelectorAll('[fill],[stroke]')];
    if (dc && /^#/.test(dc)) {
      for (const n of cands) if (norm(n.getAttribute && n.getAttribute('fill')) === norm(dc)) return skinned(n, 'fill') || dc;
      return dc;
    }
    for (const n of cands) {
      const f = n.getAttribute && n.getAttribute('fill');
      if (isLit(f)) return skinned(n, 'fill') || f;
    }
    for (const n of cands) {
      const st = n.getAttribute && n.getAttribute('stroke');
      if (isLit(st) && st.toLowerCase() !== (dark ? '#0b0f2b' : '#fcfbf9')) return skinned(n, 'stroke') || st;
    }
    // Un punto de mapa (marcador, extremo de línea) lleva el color en su grupo o
    // en una clase: el que se ve es el calculado.
    if (node.closest && node.closest('.pa-markers,.pa-link-ends') && typeof getComputedStyle === 'function') {
      const f = getComputedStyle(node).fill;
      if (isLit(f)) return f;
    }
    // `leanDots`: el color va en el grupo de los puntos.
    const grp = node.closest && node.closest('.pa-dots');
    if (grp && isLit(grp.getAttribute('fill'))) return skinned(grp, 'fill') || grp.getAttribute('fill');
    return null;
  };
  const linesHtml = (txt, color) => {
    const hd = headerInk(color);
    return String(txt).split('\n').map((l, i) => {
      if (i === 0) return hd
        ? `<div style="margin:-8px -10px 6px;padding:6px 10px;background:${hd.bg};color:${hd.fg};font-weight:600">${esc(l)}</div>`
        : `<div style="font-weight:600;margin-bottom:2px">${esc(l)}</div>`;
      // "Etiqueta: valor" → etiqueta a la izquierda y valor en negrita a la derecha.
      const m = /^(.{1,40}?):\s+(.+)$/.exec(l);
      return m
        ? `<div style="display:flex;gap:12px;justify-content:space-between"><span style="opacity:.78">${esc(m[1])}</span><b style="font-weight:600">${esc(m[2])}</b></div>`
        : `<div style="opacity:.86">${esc(l)}</div>`;
    }).join('');
  };

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
        `<line x1="${+best.x}" x2="${+best.x}" y1="${y0}" y2="${y1}" stroke="${dark ? '#8A90B4' : '#7C819C'}" stroke-width="1"/>` +
        best.v.map((v) => `<circle cx="${+best.x}" cy="${+v[2]}" r="4.5" fill="${col(v[1])}" stroke="${dark ? '#0B0F2B' : '#FCFBF9'}" stroke-width="2"/>`).join('');
      const rows = [...best.v].sort((a, b) => a[2] - b[2]).map((v) => `<div style="display:flex;gap:8px;align-items:center"><span style="width:8px;height:8px;border-radius:50%;background:${col(v[1])}"></span><span style="opacity:.86;flex:1">${esc(v[0])}</span><b style="font-weight:600;margin-left:12px">${esc(v[3])}</b></div>`).join('');
      const m = svg.getScreenCTM(), rr = root.getBoundingClientRect();
      const lx = m ? best.x * m.a + m.e - rr.left : ev.clientX - rr.left, ly = ev.clientY - rr.top;
      show(`<div style="font-weight:600;margin-bottom:4px">${esc(best.t)}</div>${rows}`, ev, { l: lx - 6, r: lx + 6, t: ly - 4, b: ly + 4 }, ['right', 'left', 'top', 'bottom']);
      return;
    }
    if (t && t.classList && t.classList.contains('pa-near')) {
      // Capa densa: busca el punto más cercano (≤ 14 px).
      const pts = t.__near || (t.__near = JSON.parse(t.getAttribute('data-near')));
      const p = toSvg(ev);
      let best = null, bd = 196;
      for (const q of pts) { const d = (q[0] - p.x) ** 2 + (q[1] - p.y) ** 2; if (d < bd) { bd = d; best = q; } }
      if (!best) { hide(); return; }
      overlay.innerHTML = `<circle cx="${+best[0]}" cy="${+best[1]}" r="6" fill="${col(best[3])}" stroke="${dark ? '#0B0F2B' : '#FCFBF9'}" stroke-width="2"/>`;
      if (best[2]) { const m = svg.getScreenCTM(), rr = root.getBoundingClientRect(); const px = best[0] * m.a + m.e - rr.left, py = best[1] * m.d + m.f - rr.top; show(linesHtml(best[2], best[3]), ev, { l: px - 6, r: px + 6, t: py - 6, b: py + 6 }); } else tipEl.style.opacity = '0';
      return;
    }
    const tg = t && t.closest ? t.closest('[data-tip]') : null;
    if (!tg) { hide(); return; }
    const mark = tg.classList.contains('pa-m') ? tg : tg.querySelector('.pa-m') && tg.querySelectorAll('.pa-m').length === 1 ? tg.querySelector('.pa-m') : null;
    if (mark !== on) {
      if (on) on.classList.remove('pa-on');
      on = mark;
      if (isMap) {
        // Mapas: sin atenuar el resto; un contorno marcado sobre la región (o su círculo).
        mapOverlay.innerHTML = '';
        if (on && on.tagName === 'path') mapOverlay.innerHTML = `<path d="${esc(on.getAttribute('d'))}" fill="none" stroke="${dark ? '#F2F3FA' : '#141A3F'}" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`;
        else if (on && on.tagName === 'circle') mapOverlay.innerHTML = `<circle cx="${on.getAttribute('cx')}" cy="${on.getAttribute('cy')}" r="${on.getAttribute('r')}" fill="none" stroke="${dark ? '#F2F3FA' : '#141A3F'}" stroke-width="2" vector-effect="non-scaling-stroke"/>`;
      } else if (on) { on.classList.add('pa-on'); svg.classList.add('pa-focus'); adjacency(on); } else svg.classList.remove('pa-focus');
    }
    show(linesHtml(tg.getAttribute('data-tip'), markColor(mark || tg)), ev, mark || tg);
  });
  // Táctil: un toque muestra el tooltip y lo deja abierto hasta otro toque fuera.
  let touchTip = false;
  svg.addEventListener('pointerdown', (ev) => {
    if (ev.pointerType !== 'touch') return;
    const tg = ev.target && ev.target.closest ? ev.target.closest('[data-tip]') : null;
    if (!tg) { touchTip = false; hide(); return; }
    touchTip = true;
    const mark = tg.classList.contains('pa-m') ? tg : null;
    show(linesHtml(tg.getAttribute('data-tip'), markColor(mark || tg)), ev, mark || tg);
  });
  svg.addEventListener('pointerleave', (ev) => { if (ev.pointerType === 'touch' && touchTip) return; hide(); });

  // Teclado: Tab entra al gráfico; flechas recorren las marcas con datos,
  // Home/End van al extremo y Esc cierra. El tooltip se ancla a la marca.
  const lang = svg.getAttribute('data-pa-lang') === 'en';
  svg.setAttribute('role', 'graphics-document');
  svg.setAttribute('aria-roledescription', lang ? 'chart' : 'gráfico');
  if (!svg.hasAttribute('tabindex')) svg.setAttribute('tabindex', '0');
  const live = document.createElement('div');
  live.setAttribute('aria-live', 'polite');
  live.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap';
  root.appendChild(live);
  let kIdx = -1;
  const kMarks = () => [...svg.querySelectorAll('.pa-body [data-tip]')].filter((n) => !n.parentElement.closest('[data-tip]') && n.getAttribute('data-tip'));
  svg.addEventListener('keydown', (ev) => {
    if (ev.target !== svg) return;
    if (ev.key === 'Escape') { kIdx = -1; hide(); return; }
    const d = ev.key === 'ArrowRight' || ev.key === 'ArrowDown' ? 1 : ev.key === 'ArrowLeft' || ev.key === 'ArrowUp' ? -1 : ev.key === 'Home' ? -1e9 : ev.key === 'End' ? 1e9 : 0;
    if (!d) return;
    const ms = kMarks();
    if (!ms.length) return;
    ev.preventDefault();
    kIdx = Math.max(0, Math.min(ms.length - 1, kIdx < 0 ? (d > 0 ? 0 : ms.length - 1) : kIdx + d));
    const tg = ms[kIdx];
    const b = tg.getBoundingClientRect();
    const mark = tg.classList.contains('pa-m') ? tg : tg.querySelector('.pa-m');
    if (on) on.classList.remove('pa-on');
    on = mark;
    if (!isMap && on) { on.classList.add('pa-on'); svg.classList.add('pa-focus'); }
    show(linesHtml(tg.getAttribute('data-tip'), markColor(mark || tg)), { clientX: b.left + b.width / 2, clientY: b.top + b.height / 2 }, tg);
    live.textContent = tg.getAttribute('data-tip').replace(/\n/g, '. ');
  });
  svg.addEventListener('blur', () => { kIdx = -1; hide(); });

  // Leyenda conectada: pasar sobre una clave destaca sus marcas (mismo color);
  // un clic la deja fija, otro clic la suelta.
  const norm = (c) => String(c || '').trim().toLowerCase();
  const body = svg.querySelector('.pa-body');
  const marksOf = (color) => {
    const c = norm(color);
    const out = new Set();
    if (!body) return out;
    // Clave "punteado": todas las formas marcadas con data-dashed.
    if (c === 'dashed') { for (const n of body.querySelectorAll('[data-dashed]')) out.add(n.closest('.pa-m') || n); return out; }
    for (const n of body.querySelectorAll('[fill],[stroke],[data-color]')) {
      if (n.closest('.pa-legend')) continue;
      if (norm(n.getAttribute('fill')) === c || norm(n.getAttribute('stroke')) === c || norm(n.getAttribute('data-color')) === c) {
        // Un grupo de marcadores de un color lo lleva en su `fill`: las marcas son sus puntos.
        if (n.classList && n.classList.contains('pa-markers')) { if (norm(n.getAttribute('fill')) === c) n.querySelectorAll('.pa-m').forEach((x) => out.add(x)); continue; }
        // `leanDots`: el grupo lleva el color; se iluminan sus puntos.
        if (n.classList.contains('pa-dots')) { for (const d of n.querySelectorAll('.pa-m')) out.add(d); continue; }
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
    for (const n of body ? body.querySelectorAll('[fill],[stroke],[data-color]') : []) if (ms.has(n) && !n.classList.contains('pa-m')) n.classList.add('pa-m');
    ms.forEach((m) => m.classList.add('pa-on'));
    svg.classList.add('pa-focus');
  };
  for (const k of svg.querySelectorAll('.pa-key')) {
    k.setAttribute('tabindex', '0');
    k.setAttribute('role', 'button');
    k.addEventListener('pointerenter', () => { if (!pinned) focusColor(k.getAttribute('data-color')); });
    k.addEventListener('pointerleave', () => { if (!pinned) focusColor(null); });
    const toggle = (e) => {
      // render() puede tomar el clic (zoom en treemap, shift + clic = excluir).
      if (root.__paLegend && root.__paLegend(k, e || {})) return;
      pinned = pinned === k ? null : k; focusColor(pinned ? k.getAttribute('data-color') : null);
    };
    k.addEventListener('click', toggle);
    k.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(e); } });
  }

  if (zoomG) mapZoom(root, svg, zoomG, { dark, hide });
}

/**
 * Zoom y paneo de mapas (buenas prácticas de chartjs-plugin-zoom: la rueda
 * sola desplaza la página; el zoom pide Ctrl/⌘, para no secuestrar el scroll).
 * - clic en una región: acerca hasta encuadrarla; otro clic (o Esc, o doble
 *   clic, o el botón) vuelve a la vista completa.
 * - Ctrl/⌘ + rueda: zoom alrededor del puntero. Pellizco en pantallas táctiles.
 * - arrastre con zoom > 1: desplaza. Botones +, − y restablecer (teclado).
 * El estado sobrevive a los redibujos (slider temporal) en root.__paZoom.
 */
function mapZoom(root, svg, z, { dark, hide }) {
  const [bx, by, bw, bh] = z.getAttribute('data-zoom').split(',').map(Number);
  const en = svg.getAttribute('data-pa-lang') === 'en';
  const L = en ? { in: 'Zoom in', out: 'Zoom out', reset: 'Reset zoom', hint: 'Use Ctrl + scroll to zoom the map' } : { in: 'Acercar', out: 'Alejar', reset: 'Restablecer zoom', hint: 'Usa Ctrl + rueda para hacer zoom en el mapa' };
  const MAX = 14;
  // El zoom anterior solo vale si el mapa tiene el mismo cuadro (no tras cambiar el ancho).
  let st = root.__paZoom && root.__paZoom.box === String([bx, by, bw, bh]) ? root.__paZoom : { k: 1, x: 0, y: 0, key: null };
  let raf = 0;
  const clamp = (s) => {
    const k = Math.max(1, Math.min(MAX, s.k));
    // Sin dejar el mapa fuera del cuadro: el desplazamiento se limita al borde.
    const minX = bx + bw - (bx + bw) * k, maxX = bx - bx * k;
    const minY = by + bh - (by + bh) * k, maxY = by - by * k;
    return { ...s, k, x: Math.min(maxX, Math.max(minX, s.x)), y: Math.min(maxY, Math.max(minY, s.y)) };
  };
  const apply = (s) => {
    z.setAttribute('transform', `translate(${s.x.toFixed(2)},${s.y.toFixed(2)}) scale(${s.k.toFixed(4)})`);
    svg.classList.toggle('pa-zoomed', s.k > 1.02);
    svg.style.touchAction = s.k > 1.02 ? 'none' : 'pan-x pan-y';
    z.style.cursor = s.k > 1.02 ? 'grab' : '';
    btnReset.hidden = s.k <= 1.02;
  };
  const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const go = (target, animate = true) => {
    const to = clamp(target);
    cancelAnimationFrame(raf);
    const from = { ...st };
    st = to; root.__paZoom = { ...st, box: String([bx, by, bw, bh]) };
    if (!animate || reduced) { apply(to); return; }
    const t0 = performance.now(), D = 520;
    const step = (now) => {
      const t = Math.min(1, (now - t0) / D), e = 1 - (1 - t) ** 3;
      // Interpola en escala logarítmica: el zoom se siente parejo.
      const k = Math.exp(Math.log(from.k) + (Math.log(to.k) - Math.log(from.k)) * e);
      const cx = (bx + bw / 2 - from.x) / from.k + ((bx + bw / 2 - to.x) / to.k - (bx + bw / 2 - from.x) / from.k) * e;
      const cy = (by + bh / 2 - from.y) / from.k + ((by + bh / 2 - to.y) / to.k - (by + bh / 2 - from.y) / from.k) * e;
      apply({ k, x: bx + bw / 2 - cx * k, y: by + bh / 2 - cy * k });
      if (t < 1) raf = requestAnimationFrame(step); else apply(to);
    };
    raf = requestAnimationFrame(step);
  };
  const zoomAt = (k, px, py, animate) => {
    // Mantiene fijo el punto (px, py) del SVG mientras cambia la escala.
    const lx = (px - st.x) / st.k, ly = (py - st.y) / st.k;
    go({ ...st, k, x: px - lx * k, y: py - ly * k, key: null }, animate);
  };
  const reset = () => go({ k: 1, x: 0, y: 0, key: null });
  const toSvg = (cx, cy) => { const p = svg.createSVGPoint(); p.x = cx; p.y = cy; return p.matrixTransform(svg.getScreenCTM().inverse()); };

  // Controles: + / − / restablecer, arriba a la derecha del mapa.
  const box = document.createElement('div');
  box.className = 'pa-zoomctl';
  const fg = dark ? '#F2F3FA' : '#141A3F', bg = dark ? 'rgba(20,26,63,.92)' : 'rgba(252,251,249,.94)', bd = dark ? 'rgba(242,243,250,.22)' : 'rgba(20,26,63,.16)';
  box.style.cssText = `position:absolute;display:flex;gap:4px;z-index:5;opacity:.0;transition:opacity .15s`;
  const mk = (label, svgIcon) => {
    const b = document.createElement('button');
    b.type = 'button'; b.setAttribute('aria-label', label); b.title = label;
    // Tamaño fijo en línea: hojas como `figure svg{width:100%}` no deben estirar el ícono.
    b.innerHTML = svgIcon.replace('<svg ', '<svg style="width:12px;height:12px;display:block;flex:none" ');
    b.style.cssText = `width:28px;height:28px;display:grid;place-items:center;padding:0;border-radius:7px;border:1px solid ${bd};background:${bg};color:${fg};cursor:pointer;box-shadow:0 1px 3px rgba(11,15,43,.12)`;
    box.appendChild(b);
    return b;
  };
  const btnIn = mk(L.in, '<svg width="12" height="12" viewBox="0 0 12 12"><path d="M6 2v8M2 6h8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>');
  const btnOut = mk(L.out, '<svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 6h8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>');
  const btnReset = mk(L.reset, '<svg width="12" height="12" viewBox="0 0 12 12"><path d="M2.5 6a3.5 3.5 0 1 0 1.1-2.55M2.5 1.8v2.2h2.2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>');
  const hint = document.createElement('div');
  hint.style.cssText = `position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);padding:8px 12px;border-radius:8px;background:${dark ? '#F2F3FA' : '#141A3F'};color:${dark ? '#141A3F' : '#FCFBF9'};font:12.5px/1.4 ${svg.getAttribute('font-family') || 'system-ui'};pointer-events:none;opacity:0;transition:opacity .2s;z-index:6`;
  hint.textContent = L.hint;
  root.appendChild(box); root.appendChild(hint);
  svg.style.userSelect = 'none';
  svg.style.webkitUserSelect = 'none';
  const place = () => {
    const r = svg.getBoundingClientRect(), rr = root.getBoundingClientRect();
    const s = r.width / (svg.viewBox.baseVal.width || r.width);
    box.style.left = (r.left - rr.left + (bx + bw) * s - 3 * 32) + 'px';
    box.style.top = (r.top - rr.top + by * s + 4) + 'px';
  };
  place();
  root.addEventListener('pointerenter', () => { place(); box.style.opacity = '1'; });
  root.addEventListener('pointerleave', () => { box.style.opacity = st.k > 1.02 ? '1' : '0'; });
  root.addEventListener('focusin', () => { place(); box.style.opacity = '1'; });
  const center = () => [bx + bw / 2, by + bh / 2];
  btnIn.addEventListener('click', () => zoomAt(st.k * 1.6, ...center(), true));
  btnOut.addEventListener('click', () => zoomAt(st.k / 1.6, ...center(), true));
  btnReset.addEventListener('click', reset);
  apply(st);

  // Clic en una región: encuadrarla (otro clic en la misma, volver).
  let moved = false;
  svg.addEventListener('click', (ev) => {
    if (moved) { moved = false; return; }
    if (!(ev.target.closest && ev.target.closest('.pa-zoom'))) return;
    const m = ev.target.closest && ev.target.closest('.pa-m');
    if (!m || !m.getBBox) return;
    const key = m.getAttribute('data-key') || m.getAttribute('d') || m.getAttribute('cx');
    if (st.key === key) { reset(); return; }
    const b = m.getBBox();
    const k = Math.max(1.4, Math.min(MAX, 0.62 * Math.min(bw / Math.max(b.width, 4), bh / Math.max(b.height, 4))));
    const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
    hide();
    go({ k, x: bx + bw / 2 - cx * k, y: by + bh / 2 - cy * k, key });
  });
  svg.addEventListener('dblclick', (ev) => { if (ev.target.closest && ev.target.closest('.pa-zoom')) { ev.preventDefault(); reset(); } });
  const onKey = (e) => { if (e.key === 'Escape' && st.k > 1.02 && root.isConnected) reset(); };
  if (root.__paKey) document.removeEventListener('keydown', root.__paKey);
  root.__paKey = onKey;
  document.addEventListener('keydown', onKey);

  // Ctrl/⌘ + rueda (o gesto de trackpad, que llega con ctrlKey): zoom en el puntero.
  let hintT = 0;
  svg.addEventListener('wheel', (ev) => {
    if (!(ev.target.closest && ev.target.closest('.pa-zoom-clip'))) return;
    if (!ev.ctrlKey && !ev.metaKey) {
      if (st.k > 1.02) return;
      hint.style.opacity = '1'; clearTimeout(hintT); hintT = setTimeout(() => (hint.style.opacity = '0'), 1100);
      return;
    }
    ev.preventDefault();
    const p = toSvg(ev.clientX, ev.clientY);
    zoomAt(st.k * Math.exp(-ev.deltaY * 0.004), p.x, p.y, false);
  }, { passive: false });

  // Arrastre (zoom > 1) y pellizco (dos dedos).
  const ptrs = new Map();
  let drag = null, pinch = null;
  svg.addEventListener('pointerdown', (ev) => {
    if (!(ev.target.closest && ev.target.closest('.pa-zoom-clip'))) return;
    moved = false;
    ptrs.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      const mid = toSvg((a.x + b.x) / 2, (a.y + b.y) / 2);
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), k: st.k, mid };
      drag = null;
    } else if (st.k > 1.02) {
      ev.preventDefault(); // sin selección de texto al arrastrar
      drag = { x: ev.clientX, y: ev.clientY, sx: st.x, sy: st.y };
    }
  });
  svg.addEventListener('pointermove', (ev) => {
    if (!ptrs.has(ev.pointerId)) return;
    ptrs.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    const s = (svg.viewBox.baseVal.width || 1) / svg.getBoundingClientRect().width;
    if (pinch && ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      zoomAt(pinch.k * Math.hypot(a.x - b.x, a.y - b.y) / (pinch.d || 1), pinch.mid.x, pinch.mid.y, false);
      moved = true;
    } else if (drag) {
      const dx = (ev.clientX - drag.x) * s, dy = (ev.clientY - drag.y) * s;
      if (Math.abs(dx) + Math.abs(dy) > 3) {
        moved = true;
        z.style.cursor = 'grabbing';
        if (!svg.hasPointerCapture(ev.pointerId)) svg.setPointerCapture(ev.pointerId);
        go({ ...st, x: drag.sx + dx, y: drag.sy + dy, key: null }, false);
        hide();
      }
    }
  });
  const up = (ev) => {
    ptrs.delete(ev.pointerId);
    if (ptrs.size < 2) pinch = null;
    if (!ptrs.size) { drag = null; z.style.cursor = st.k > 1.02 ? 'grab' : ''; }
  };
  svg.addEventListener('pointerup', up);
  svg.addEventListener('pointercancel', up);
}

// Fuente autocontenida (toHTML sin bundle): attach más su ayudante de zoom.
export const attachSource = `(function(){${mapZoom.toString()}\nreturn ${attach.toString()};})()`;
