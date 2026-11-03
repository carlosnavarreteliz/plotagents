// Galería: dibuja cada gráfico en vivo cuando se acerca a la pantalla,
// y filtra por sección o por texto.
(function () {
  var specs = JSON.parse(document.getElementById('pa-specs').textContent);
  var byId = {};
  specs.forEach(function (e) { byId[e.id] = e; });

  var live = {};
  function show(fig) {
    var id = fig.getAttribute('data-id');
    if (live[id] || !byId[id]) return;
    live[id] = site.mount(fig, byId[id].spec, { fixed: byId[id].fixed });
  }
  var figs = [].slice.call(document.querySelectorAll('figure.pa[data-id]'));
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { show(en.target); io.unobserve(en.target); } });
    }, { rootMargin: '600px 0px' });
    figs.forEach(function (f) { io.observe(f); });
  } else figs.forEach(show);

  // Filtros.
  var chips = [].slice.call(document.querySelectorAll('.chips .chip'));
  var input = document.querySelector('.search input');
  var cards = [].slice.call(document.querySelectorAll('.card'));
  var secs = [].slice.call(document.querySelectorAll('.g-sec'));
  var empty = document.querySelector('.empty');
  var current = 'all';
  function norm(s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  function filter() {
    var q = norm(input.value.trim());
    var total = 0;
    secs.forEach(function (sec) {
      var okSec = current === 'all' || sec.id === current;
      var n = 0;
      sec.querySelectorAll('.card').forEach(function (c) {
        var ok = okSec && (!q || norm(c.getAttribute('data-search')).indexOf(q) >= 0);
        c.hidden = !ok;
        if (ok) n++;
      });
      sec.hidden = n === 0;
      total += n;
    });
    empty.hidden = total > 0;
  }
  chips.forEach(function (ch) {
    ch.addEventListener('click', function () {
      current = ch.getAttribute('data-sec');
      chips.forEach(function (c) { c.setAttribute('aria-pressed', c === ch ? 'true' : 'false'); });
      filter();
      var top = document.querySelector('.g-tools');
      if (top && window.scrollY > top.offsetTop) window.scrollTo({ top: top.offsetTop - 60, behavior: 'smooth' });
    });
  });
  input.addEventListener('input', filter);
  window.addEventListener('keydown', function (e) {
    if (e.key === '/' && document.activeElement !== input && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); input.focus(); }
  });
  void cards;
})();
