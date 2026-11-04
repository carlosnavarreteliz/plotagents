// plotagents · portada: la conversación en vivo (persona → modelo → plotagents
// → gráfico) y las pestañas de integración. Sin dependencias.
(function () {
  var home = JSON.parse(document.getElementById('pa-home').textContent);
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Gráficos fijos de la portada: se vuelven a dibujar en vivo (tema y ancho del lector).
  [['fix-chart', home.fixed], ['geo-chart', home.geo]].forEach(function (p) {
    var el = document.getElementById(p[0]);
    if (el) site.mount(el, p[1]);
  });

  // ── Conversación ─────────────────────────────────────────────────────────
  var xc = document.getElementById('exchange');
  var tabs = [].slice.call(xc.querySelectorAll('.xc-tabs button'));
  var ask = document.getElementById('xc-ask');
  var call = document.getElementById('xc-call').firstChild;
  var resp = document.getElementById('xc-resp').firstChild;
  var fig = document.getElementById('xc-chart');
  var stage = fig.parentNode;
  var cur = 0, entry = site.mount(fig, home.xcs[0].spec), timers = [], auto = !reduced, hover = false, visible = false, raf = 0;
  var HOLD = 7000;

  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
  function clear() { timers.forEach(clearTimeout); timers = []; cancelAnimationFrame(raf); }
  function select(i) {
    tabs.forEach(function (t, k) { t.setAttribute('aria-selected', k === i ? 'true' : 'false'); t.style.setProperty('--p', k === i ? '1' : '0'); });
  }
  // La raya bajo la pestaña activa avanza mientras espera el siguiente ejemplo.
  function progress(ms) {
    var t0 = performance.now(), tab = tabs[cur];
    tab.style.setProperty('--p', '0');
    (function step(now) {
      var k = Math.min(1, (now - t0) / ms);
      tab.style.setProperty('--p', String(k));
      if (k < 1) raf = requestAnimationFrame(step);
    })(t0);
  }

  function show(i, animate) {
    clear();
    cur = i;
    select(i);
    var x = home.xcs[i];
    if (!animate) {
      ask.textContent = x.ask;
      call.innerHTML = x.call.join('');
      resp.innerHTML = x.resp.join('');
      draw(x, false);
      return;
    }
    stage.style.minHeight = stage.offsetHeight + 'px';
    fig.style.opacity = '0.12';
    ask.textContent = x.ask;
    ask.classList.remove('fadein'); void ask.offsetWidth; ask.classList.add('fadein');
    call.innerHTML = '<span class="caret"></span>';
    resp.innerHTML = '<span class="ln" style="color:var(--src)">…</span>';
    // El modelo "transmite" el spec línea a línea, como los tokens de una respuesta.
    var n = 0, per = Math.max(45, Math.min(110, 1700 / x.call.length));
    (function line() {
      if (n >= x.call.length) {
        call.innerHTML = x.call.join('');
        later(function () {
          resp.innerHTML = x.resp.join('');
          resp.classList.remove('fadein'); void resp.offsetWidth; resp.classList.add('fadein');
          later(function () { draw(x, true); }, 260);
        }, 380);
        return;
      }
      n++;
      call.innerHTML = x.call.slice(0, n).join('') + '<span class="caret"></span>';
      later(line, per);
    })();
  }

  function draw(x, animate) {
    if (entry) site.unmount(entry);
    fig.style.opacity = '';
    entry = site.mount(fig, x.spec);
    stage.style.minHeight = '';
    if (animate) { fig.classList.remove('reveal'); void fig.offsetWidth; fig.classList.add('reveal'); }
    if (auto) { progress(HOLD); later(next, HOLD); }
  }
  function next() {
    if (!auto) return;
    if (hover || !visible || document.hidden) { later(next, 1200); return; }
    show((cur + 1) % home.xcs.length, true);
  }

  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { auto = false; show(i, !reduced); select(i); });
    t.addEventListener('keydown', function (e) {
      var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      var k = (i + d + tabs.length) % tabs.length;
      tabs[k].focus(); tabs[k].click();
    });
  });
  xc.addEventListener('mouseenter', function () { hover = true; });
  xc.addEventListener('mouseleave', function () { hover = false; });
  xc.addEventListener('focusin', function () { hover = true; });
  xc.addEventListener('focusout', function () { hover = false; });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }, { threshold: 0.25 }).observe(xc);
  } else visible = true;
  select(0);
  if (auto) { progress(HOLD + 1500); later(next, HOLD + 1500); }

  // ── Pestañas de integración ──────────────────────────────────────────────
  var itabs = [].slice.call(document.querySelectorAll('.integ [data-tab]'));
  itabs.forEach(function (b) {
    b.addEventListener('click', function () {
      itabs.forEach(function (o) { o.setAttribute('aria-selected', o === b ? 'true' : 'false'); });
      document.querySelectorAll('.integ [data-panel]').forEach(function (p) { p.hidden = p.getAttribute('data-panel') !== b.getAttribute('data-tab'); });
    });
  });
})();
