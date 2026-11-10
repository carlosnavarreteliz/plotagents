// plotagents · sitio: tema, copiar código, menú, índice y gráficos en vivo.
(function () {
  var root = document.documentElement;
  var KEY = 'pa-theme';
  function getPref() { try { return localStorage.getItem(KEY) || 'auto'; } catch (e) { return 'auto'; } }
  function setPref(p) {
    try { if (p === 'auto') localStorage.removeItem(KEY); else localStorage.setItem(KEY, p); } catch (e) {}
    apply(p);
  }
  function apply(p) {
    root.setAttribute('data-pref', p);
    if (p === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', p);
    emit();
  }
  function isDark() {
    var t = root.getAttribute('data-theme');
    if (t === 'dark') return true;
    if (t === 'light') return false;
    return !!(window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
  }
  var listeners = [];
  var lastDark = null;
  function emit() {
    var d = isDark();
    if (d === lastDark) return;
    lastDark = d;
    listeners.forEach(function (f) { try { f(d); } catch (e) { console.error(e); } });
  }
  function onTheme(f) { listeners.push(f); }
  if (window.matchMedia) {
    var mq = matchMedia('(prefers-color-scheme: dark)');
    (mq.addEventListener ? mq.addEventListener.bind(mq, 'change') : mq.addListener.bind(mq))(emit);
  }

  // Gráfico en vivo: sigue el tema del sitio salvo que el spec traiga uno propio.
  var mounted = [];
  function mount(fig, spec, opts) {
    opts = opts || {};
    if (!window.plotagents) return null;
    var entry = { fig: fig, spec: spec, fixed: !!opts.fixed, handle: null };
    draw(entry);
    mounted.push(entry);
    return entry;
  }
  function draw(entry) {
    var s = Object.assign({}, entry.spec);
    if (!entry.fixed) s.theme = isDark() ? 'noche' : 'papel';
    if (s.padding === undefined) s.padding = window.innerWidth <= 520 ? 12 : 18;
    if (entry.handle) entry.handle.destroy();
    try { entry.handle = plotagents.render(entry.fig, s); }
    catch (e) { entry.fig.innerHTML = '<p class="msg error">' + String(e.message).replace(/</g, '&lt;') + '</p>'; entry.handle = null; }
  }
  function unmount(entry) {
    var i = mounted.indexOf(entry);
    if (i >= 0) mounted.splice(i, 1);
    if (entry && entry.handle) entry.handle.destroy();
  }
  onTheme(function () { mounted.forEach(draw); });

  // Idioma de la página: los textos que escribe este script siguen al <html lang>.
  var ES = root.lang === 'es';
  function t(en, es) { return ES ? es : en; }

  // Copiar al portapapeles.
  function copyText(text, btn) {
    var done = function () {
      if (!btn) return;
      var old = btn.textContent;
      btn.textContent = t('Copied', 'Copiado');
      btn.classList.add('done');
      setTimeout(function () { btn.textContent = old; btn.classList.remove('done'); }, 1400);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { fallback(text); done(); });
    else { fallback(text); done(); }
  }
  function fallback(text) {
    var t = document.createElement('textarea');
    t.value = text; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
    document.body.appendChild(t); t.select();
    try { document.execCommand('copy'); } catch (e) {}
    t.remove();
  }
  function addCopyButtons(scope) {
    (scope || document).querySelectorAll('.code').forEach(function (box) {
      if (box.querySelector('.copy')) return;
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'copy'; b.textContent = t('Copy', 'Copiar');
      b.addEventListener('click', function () { copyText(box.querySelector('code').textContent, b); });
      box.appendChild(b);
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    addCopyButtons();
    document.querySelectorAll('[data-copy]').forEach(function (b) {
      b.addEventListener('click', function () { copyText(b.getAttribute('data-copy'), b); });
    });
    var tb = document.querySelector('.theme-btn');
    if (tb) tb.addEventListener('click', function () {
      var order = ['auto', 'light', 'dark'];
      var next = order[(order.indexOf(getPref()) + 1) % 3];
      setPref(next);
      tb.setAttribute('aria-label', t('Theme: ', 'Tema: ') + next);
    });
    // Elegir idioma a mano queda guardado (y desactiva el cambio automático).
    document.querySelectorAll('[data-lang]').forEach(function (a) {
      a.addEventListener('click', function () { try { localStorage.setItem('pa-lang', a.getAttribute('data-lang')); } catch (e) {} });
    });
    var mb = document.querySelector('.menu-btn');
    if (mb) mb.addEventListener('click', function () {
      var nav = document.querySelector('.topnav');
      var open = nav.classList.toggle('open');
      mb.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    var sel = document.querySelector('.doc-nav-mobile select');
    if (sel) sel.addEventListener('change', function () { location.href = sel.value; });
    // Índice: resalta la sección visible.
    var links = [].slice.call(document.querySelectorAll('.toc a'));
    if (links.length) {
      var heads = links.map(function (a) { return document.getElementById(decodeURIComponent(a.getAttribute('href').slice(1))); });
      var raf = 0;
      var spy = function () {
        raf = 0;
        var on = -1;
        heads.forEach(function (h, i) { if (h && h.getBoundingClientRect().top < 120) on = i; });
        links.forEach(function (a, i) { a.classList.toggle('on', i === on); });
      };
      window.addEventListener('scroll', function () { if (!raf) raf = requestAnimationFrame(spy); }, { passive: true });
      spy();
    }
  });

  apply(getPref());
  window.site = { isDark: isDark, onTheme: onTheme, mount: mount, unmount: unmount, redraw: draw, copyText: copyText, addCopyButtons: addCopyButtons, t: t, es: ES };
})();
