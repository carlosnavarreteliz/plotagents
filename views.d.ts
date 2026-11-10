// plotagents/views: switch the view of a map drawn with `views`, in the browser, without the library.

/** Show view `id` in every multi-view map in `target` (an <svg> or a container). Returns how many changed. */
export function setView(target: Element | Document, id: string): number;
/**
 * The view a map shows (or the first multi-view map inside `target`). With `viewSelector` (CSS-only switching) the
 * view is the one whose selector matches an ancestor (read from the map's own <style>); otherwise `data-view`.
 */
export function currentView(target: Element | Document): string | null;
/**
 * The tooltip of the view being shown, for a page's own hover layer: climbs from `el` to the mark (`data-tip` or
 * `data-vtip-*`) and returns the active view's text (`viewSelector` or `data-view`), or null. Outside a multi-view
 * map, the mark's `data-tip`. Does not change the document.
 */
export function activeTip(el: Element | null): string | null;
/**
 * Clicking an element with data-set-view="<id>" (or changing a radio with it) shows that view in the maps of `root`
 * (only those matching data-view-target="<selector>", if given). Returns a function that stops listening.
 */
export function bindViews(root?: Element | Document): () => void;
