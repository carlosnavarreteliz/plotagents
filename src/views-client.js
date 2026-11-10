// plotagents/views · cambiar la vista de un mapa dibujado con `views`, en el
// navegador y sin la biblioteca (menos de 2 kB minificado, sin dependencias).
//
//   import { setView, bindViews } from 'plotagents/views';
//   setView(document.querySelector('#mapa'), 'inmigrantes');
//   bindViews(document);   // <button data-set-view="inmigrantes"> cambia los mapas de la página
//   activeTip(e.target);   // el tooltip de la vista que se ve (también con `viewSelector`)
//
// El SVG ya trae todo: cada vista pinta sus regiones con el <style> que lleva
// dentro, según el atributo `data-view` de la raíz. Lo único que hace este
// archivo es cambiar ese atributo y pasar el tooltip de la vista
// (`data-vtip-<id>`) a `data-tip`, que es lo que lee cualquier capa de hover.

/** Los SVG con vistas en `target` (el SVG mismo, o los que contiene). */
function charts(target) {
  if (!target) return [];
  if (target.matches && target.matches('svg[data-views]')) return [target];
  return target.querySelectorAll ? [...target.querySelectorAll('svg[data-views]')] : [];
}

/**
 * Muestra la vista `id` en cada mapa con vistas de `target`. Devuelve cuántos
 * cambiaron (un mapa que no tiene esa vista se deja como está).
 */
export function setView(target, id) {
  const want = String(id);
  let n = 0;
  for (const svg of charts(target)) {
    const ids = (svg.getAttribute('data-views') || '').split(' ');
    const cur = svg.getAttribute('data-view');
    if (!ids.includes(want) || cur === want) continue;
    const marks = svg.querySelectorAll(`[data-vtip-${ids[1] || want}]`);
    for (const m of marks) {
      // El tooltip de la primera vista vive en data-tip: se guarda la primera vez.
      if (!m.hasAttribute(`data-vtip-${ids[0]}`)) m.setAttribute(`data-vtip-${ids[0]}`, m.getAttribute('data-tip') || '');
      const t = m.getAttribute(`data-vtip-${want}`);
      if (t) m.setAttribute('data-tip', t);
      else m.removeAttribute('data-tip');
    }
    svg.setAttribute('data-view', want);
    n++;
  }
  return n;
}

/**
 * La vista que muestra un mapa (o el primero con vistas dentro de `target`).
 * Con `viewSelector` la elige el CSS (un radio :checked, una clase en un
 * ancestro), no `data-view`: se lee del <style> del mapa qué selector lleva
 * cada vista y se prueba con `matches()`.
 */
export function currentView(target) {
  const svg = charts(target)[0];
  if (!svg) return null;
  const ids = (svg.getAttribute('data-views') || '').split(' ');
  const css = [...svg.querySelectorAll('style')].map((n) => n.textContent).join('');
  // Una regla «<selector> .pv0{display:none}» por vista desde la segunda, en orden.
  const sels = [...css.matchAll(/(?:^|\})([^{}]+?) \.pv0\{display:none\}/g)].map((m) => m[1]);
  if (sels.length && !/:not\(\[data-view=/.test(sels[0])) {
    for (let j = 0; j < sels.length; j++) {
      try { if (svg.matches(sels[j])) return ids[j + 1]; } catch (e) { /* un selector que este navegador no entiende */ }
    }
    return ids[0];
  }
  return svg.getAttribute('data-view');
}

/**
 * El tooltip que corresponde a la vista que se ve, para la capa de hover
 * propia de una página: `activeTip(evento.target)` sube hasta la marca (el
 * elemento con `data-tip` o `data-vtip-*`) y devuelve el texto de la vista
 * activa (con `viewSelector` o con `data-view`), o null si no hay. Fuera de un
 * mapa con vistas, es el `data-tip` de la marca. No cambia el documento.
 */
export function activeTip(el) {
  let n = el;
  while (n && n.getAttribute && !n.hasAttribute('data-tip') && !n.getAttributeNames().some((a) => a.startsWith('data-vtip-'))) n = n.parentNode;
  if (!n || !n.getAttribute) return null;
  const svg = n.closest('svg[data-views]');
  const v = svg && currentView(svg);
  const t = v ? n.getAttribute(`data-vtip-${v}`) : null;
  return t !== null ? t || null : n.getAttribute('data-tip');
}

/**
 * Un clic en un elemento con `data-set-view="<id>"` (o el cambio de un
 * <input type="radio" data-set-view>) muestra esa vista en los mapas de `root`.
 * Con `data-view-target="<selector>"`, sólo en los que calzan. Devuelve la
 * función que deja de escuchar.
 */
export function bindViews(root = typeof document !== 'undefined' ? document : null) {
  if (!root || !root.addEventListener) return () => {};
  const on = (e) => {
    const b = e.target && e.target.closest ? e.target.closest('[data-set-view]') : null;
    if (!b || !root.contains(b)) return;
    if (e.type === 'change' && !b.checked) return;
    const sel = b.getAttribute('data-view-target');
    const scope = sel ? [...root.querySelectorAll(sel)] : [root];
    for (const s of scope) setView(s, b.getAttribute('data-set-view'));
  };
  root.addEventListener('click', on);
  root.addEventListener('change', on);
  return () => { root.removeEventListener('click', on); root.removeEventListener('change', on); };
}
