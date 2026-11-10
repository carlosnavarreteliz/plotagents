// plotagents/views: switch the view of a map drawn with `views`, in the browser, without the library.

/** Show view `id` in every multi-view map in `target` (an <svg> or a container). Returns how many changed. */
export function setView(target: Element | Document, id: string): number;
/** The view a map shows (or the first multi-view map inside `target`). */
export function currentView(target: Element | Document): string | null;
/**
 * Clicking an element with data-set-view="<id>" (or changing a radio with it) shows that view in the maps of `root`
 * (only those matching data-view-target="<selector>", if given). Returns a function that stops listening.
 */
export function bindViews(root?: Element | Document): () => void;
