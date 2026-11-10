// Playground: edita un spec y mira el gráfico, los errores y las sugerencias en vivo.
(function () {
  var t = (window.site && site.t) || function (en) { return en; };
  var presets = JSON.parse(document.getElementById('pa-presets').textContent);
  var byId = {};
  presets.forEach(function (p) { byId[p.id] = p; });
  var ta = document.getElementById('spec');
  var fig = document.getElementById('chart');
  var msgs = document.getElementById('msgs');
  var desc = document.getElementById('desc');
  var sel = document.getElementById('preset');
  var files = JSON.parse((document.getElementById('pa-geo-files') || {}).textContent || '{}');
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
      msgs.innerHTML = '<div class="msg error"><b>' + t('Invalid JSON', 'JSON no válido') + '</b>' + esc(p.error) + '</div>';
      return;
    }
    var spec = withFiles(p.spec);
    if (spec.__missing) {
      msgs.innerHTML = '<div class="msg error"><b>' + t('Missing file', 'Falta un archivo') + '</b>' + esc(spec.__missing) + '<span class="fix">' + t('Drop the file on the editor (or use “Insert GeoJSON…”) to load it again.', 'Suelta el archivo sobre el editor (o usa “Insertar GeoJSON…”) para cargarlo de nuevo.') + '</span></div>';
      return;
    }
    var r = plotagents.safePlot(spec);
    var html = list('error', 'Error', r.errors) + list('warning', t('Warning', 'Advertencia'), r.warnings) + list('suggestion', t('Suggestion', 'Sugerencia'), r.suggestions);
    if (r.ok && !r.errors.length && !r.warnings.length && !r.suggestions.length) html = '<div class="msg ok"><b>' + t('Looks good', 'Todo bien') + '</b>' + t('No errors, warnings or suggestions.', 'Sin errores, advertencias ni sugerencias.') + '</div>';
    msgs.innerHTML = html;
    desc.innerHTML = r.ok && r.description ? '<b>' + t('Alt text:', 'Texto alternativo:') + '</b> ' + esc(r.description) : '';
    if (!r.ok) return;
    lastSpec = spec;
    if (entry) site.unmount(entry);
    var fixed = !!spec.theme;
    entry = site.mount(fig, spec, { fixed: fixed });
  }
  // geo: "file:x.geojson" → el objeto cargado en la página (también en `layers`).
  function withFiles(spec) {
    var miss = null;
    function res(g) { if (typeof g === 'string' && g.indexOf('file:') === 0) { var f = files[g.slice(5)]; if (!f) miss = g.slice(5); return f || g; } return g; }
    var out = Object.assign({}, spec);
    if (out.geo) out.geo = res(out.geo);
    if (Array.isArray(out.layers)) out.layers = out.layers.map(function (L) { return L && L.geo ? Object.assign({}, L, { geo: res(L.geo) }) : L; });
    if (miss) out.__missing = '"' + miss + '" ' + t('is not loaded in this page.', 'no está cargado en esta página.');
    return out;
  }

  // ── Tu propio GeoJSON / TopoJSON ────────────────────────────────────────
  var NAME_KEYS = ['name', 'NAME', 'nombre', 'NOMBRE', 'Nombre', 'NOM_COM', 'NOM_COMUNA', 'NOM_REG', 'NOM_REGION', 'NAME_1', 'NAME_2', 'ADMIN', 'admin', 'name_en', 'region', 'Region', 'REGION', 'comuna', 'COMUNA', 'label', 'title', 'id', 'ID', 'code', 'CODE'];
  function insertGeo(obj, filename) {
    var fc;
    try { fc = plotagents.toFeatureCollection(obj); } catch (e) { msgs.innerHTML = '<div class="msg error"><b>' + t('Not a map', 'No es un mapa') + '</b>' + esc(e.message) + '</div>'; return; }
    var feats = fc.features.filter(function (f) { return f && f.geometry; });
    if (!feats.length) { msgs.innerHTML = '<div class="msg error"><b>' + t('Empty map', 'Mapa vacío') + '</b>' + t('The file has no features with geometry.', 'El archivo no tiene features con geometría.') + '</div>'; return; }
    var props = feats[0].properties || {};
    var key = NAME_KEYS.filter(function (k) { return props[k] !== undefined && props[k] !== null && typeof props[k] !== 'object'; })[0]
      || Object.keys(props).filter(function (k) { return typeof props[k] === 'string'; })[0];
    var name = (filename || 'map.geojson').replace(/[^\w.\-]+/g, '-');
    files[name] = obj;
    var seen = {};
    var data = [];
    feats.forEach(function (f, i) {
      var k = key ? f.properties[key] : f.id !== undefined ? f.id : null;
      if (k === undefined || k === null || seen[k]) return;
      seen[k] = 1;
      data.push({ area: k, value: Math.round(((i * 37) % 97) + 3) });
    });
    var spec = {
      type: 'choropleth',
      geo: 'file:' + name,
      title: t('Your map: ' + feats.length + ' shapes from ' + name, 'Tu mapa: ' + feats.length + ' formas de ' + name),
      subtitle: t('Placeholder values: replace `data` with your own (one row per shape)', 'Valores de relleno: cambia `data` por los tuyos (una fila por forma)'),
      source: t('illustrative data', 'datos ilustrativos'),
      data: data.slice(0, 400),
      key: 'area', value: 'value',
      locale: t('en', 'es'),
    };
    if (key) spec.featureKey = key;
    if (!key) delete spec.featureKey;
    sel.value = '';
    history.replaceState(null, '', location.pathname);
    load(spec);
  }
  function readFile(file) {
    var rd = new FileReader();
    rd.onload = function () {
      try { insertGeo(JSON.parse(rd.result), file.name); }
      catch (e) { msgs.innerHTML = '<div class="msg error"><b>' + t('Could not read ', 'No se pudo leer ') + esc(file.name) + '</b>' + esc(e.message) + '</div>'; }
    };
    rd.readAsText(file);
  }
  var gf = document.getElementById('geo-file');
  document.getElementById('geo-btn').addEventListener('click', function () { gf.click(); });
  gf.addEventListener('change', function () { if (gf.files[0]) readFile(gf.files[0]); gf.value = ''; });
  var ed = ta.parentNode;
  ['dragenter', 'dragover'].forEach(function (ev) { ta.addEventListener(ev, function (e) { if (e.dataTransfer && [].indexOf.call(e.dataTransfer.types, 'Files') >= 0) { e.preventDefault(); ed.classList.add('drag'); } }); });
  ['dragleave', 'drop'].forEach(function (ev) { ta.addEventListener(ev, function () { ed.classList.remove('drag'); }); });
  ta.addEventListener('drop', function (e) { var f = e.dataTransfer && e.dataTransfer.files[0]; if (f) { e.preventDefault(); readFile(f); } });

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
    if (typeof p.spec.geo === 'string' && p.spec.geo.indexOf('file:') === 0 && !/^file:(geojson-propio|geojson-en)\.geojson$/.test(p.spec.geo)) msgs.insertAdjacentHTML('afterbegin', '<div class="msg warning"><b>' + t('Heads-up', 'Ojo') + '</b>' + t('The link keeps the spec but not your file: whoever opens it will need to drop it again.', 'El enlace guarda el spec pero no tu archivo: quien lo abra tendrá que soltarlo de nuevo.') + '</div>');
    site.copyText(location.href, e.currentTarget);
  });
  window.addEventListener('hashchange', fromHash);

  if (!fromHash()) { sel.value = presets[0].id; load(presets[0].spec); }
})();
