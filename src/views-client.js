// plotagents/views · cambiar la vista de un mapa dibujado con `views`, en el
// navegador y sin la biblioteca (menos de 1 kB, sin dependencias).
//
//   import { setView, bindViews } from 'plotagents/views';
//   setView(document.querySelector('#mapa'), 'inmigrantes');
//   bindViews(document);   // <button data-set-view="inmigrantes"> cambia los mapas de la página
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

/** La vista que muestra un mapa (o el primero con vistas dentro de `target`). */
export function currentView(target) {
  const svg = charts(target)[0];
  return svg ? svg.getAttribute('data-view') : null;
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
