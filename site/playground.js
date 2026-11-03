// Playground: edita un spec y mira el gráfico, los errores y las sugerencias en vivo.
(function () {
  var presets = JSON.parse(document.getElementById('pa-presets').textContent);
  var byId = {};
  presets.forEach(function (p) { byId[p.id] = p; });
  var ta = document.getElementById('spec');
  var fig = document.getElementById('chart');
  var msgs = document.getElementById('msgs');
  var desc = document.getElementById('desc');
  var sel = document.getElementById('preset');
  var entry = null;
  var lastSpec = null;
  var timer = 0;

  /** JSON legible: las filas de datos van una por línea. */
  function flat(v) { return v === null || typeof v !== 'object' || (!Array.isArray(v) && Object.keys(v).every(function (k) { return v[k] === null || typeof v[k] !== 'object'; })); }
  function pretty(v, ind) {
    ind = ind || '';
    var nx = ind + '  ';
    if (Array.isArray(v)) {
      if (!v.length) return '[]';
      if (v.every(function (x) { return x === null || typeof x !== 'object'; })) {
        var one = JSON.stringify(v);
        if (one.length < 90) return one.replace(/,/g, ', ');
      }
      if (v.every(flat)) return '[\n' + v.map(function (x) { return nx + compact(x); }).join(',\n') + '\n' + ind + ']';
      return '[\n' + v.map(function (x) { return nx + pretty(x, nx); }).join(',\n') + '\n' + ind + ']';
    }
    if (v && typeof v === 'object') {
      var keys = Object.keys(v);
      if (!keys.length) return '{}';
      return '{\n' + keys.map(function (k) { return nx + JSON.stringify(k) + ': ' + pretty(v[k], nx); }).join(',\n') + '\n' + ind + '}';
    }
    return JSON.stringify(v);
  }
  function compact(x) {
    if (x === null || typeof x !== 'object') return JSON.stringify(x);
    return '{ ' + Object.keys(x).map(function (k) { return JSON.stringify(k) + ': ' + JSON.stringify(x[k]); }).join(', ') + ' }';
  }

  function parse(text) {
    try { return { spec: JSON.parse(text) }; } catch (e1) {
      // También acepta un objeto literal de JavaScript (claves sin comillas, comas finales).
      try {
        var v = new Function('"use strict";return (' + text.replace(/^\s*plot\(([\s\S]*)\)\s*;?\s*$/, '$1') + '\n);')();
        if (v && typeof v === 'object') return { spec: v };
      } catch (e2) {}
      return { error: e1.message };
    }
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function code(s) { return esc(s).replace(/`([^`]+)`/g, '<code>$1</code>'); }
  function list(kind, label, items) {
    return items.map(function (i) {
      return '<div class="msg ' + kind + '"><b>' + label + '</b>' + code(i.message) + (i.fix ? '<span class="fix">' + code(i.fix) + '</span>' : '') + '</div>';
    }).join('');
  }

  function run() {
    var p = parse(ta.value);
    if (p.error) {
      msgs.innerHTML = '<div class="msg error"><b>Invalid JSON</b>' + esc(p.error) + '</div>';
      return;
    }
    var spec = p.spec;
    var r = plotagents.safePlot(spec);
    var html = list('error', 'Error', r.errors) + list('warning', 'Warning', r.warnings) + list('suggestion', 'Suggestion', r.suggestions);
    if (r.ok && !r.errors.length && !r.warnings.length && !r.suggestions.length) html = '<div class="msg ok"><b>Looks good</b>No errors, warnings or suggestions.</div>';
    msgs.innerHTML = html;
    desc.innerHTML = r.ok && r.description ? '<b>Alt text:</b> ' + esc(r.description) : '';
    if (!r.ok) return;
    lastSpec = spec;
    if (entry) site.unmount(entry);
    var fixed = !!spec.theme;
    entry = site.mount(fig, spec, { fixed: fixed });
  }
  function schedule() { clearTimeout(timer); timer = setTimeout(run, 280); }

  function load(spec) { ta.value = pretty(spec); run(); }
  function fromHash() {
    var h = location.hash.slice(1);
    if (h.indexOf('ex=') === 0 && byId[h.slice(3)]) { sel.value = h.slice(3); load(byId[h.slice(3)].spec); return true; }
    if (h.indexOf('spec=') === 0) {
      try { load(JSON.parse(decodeURIComponent(escape(atob(h.slice(5).replace(/-/g, '+').replace(/_/g, '/')))))); sel.value = ''; return true; } catch (e) {}
    }
    return false;
  }

  ta.addEventListener('input', schedule);
  ta.addEventListener('keydown', function (e) {
    if (e.key === 'Tab' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      var s = ta.selectionStart, en = ta.selectionEnd;
      ta.setRangeText('  ', s, en, 'end');
      schedule();
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); run(); }
  });
  sel.addEventListener('change', function () {
    var p = byId[sel.value];
    if (!p) return;
    history.replaceState(null, '', '#ex=' + p.id);
    load(p.spec);
  });
  document.getElementById('format').addEventListener('click', function () {
    var p = parse(ta.value);
    if (p.spec) ta.value = pretty(p.spec);
  });
  document.getElementById('download').addEventListener('click', function () {
    if (!lastSpec) return;
    var s = Object.assign({}, lastSpec);
    if (!s.theme) s.theme = site.isDark() ? 'noche' : 'papel';
    var blob = new Blob([plotagents.plot(s)], { type: 'image/svg+xml' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (sel.value || 'chart') + '.svg';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  });
  document.getElementById('share').addEventListener('click', function (e) {
    var p = parse(ta.value);
    if (!p.spec) return;
    var b64 = btoa(unescape(encodeURIComponent(JSON.stringify(p.spec)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    history.replaceState(null, '', '#spec=' + b64);
    site.copyText(location.href, e.currentTarget);
  });
  window.addEventListener('hashchange', fromHash);

  if (!fromHash()) { sel.value = presets[0].id; load(presets[0].spec); }
})();
