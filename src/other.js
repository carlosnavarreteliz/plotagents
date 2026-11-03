// Categorías bajo el umbral → una sola etiqueta "Otros", siempre al final.
// Lo usan las barras (categorías nominales) y las jerarquías (treemap, sunburst).

/** Umbral por defecto: menos del 1% del total se agrupa en "Otros". */
export const DEFAULT_THRESHOLD = 0.01;

const OTHER_NAMES = new Set(['otros', 'otras', 'otro', 'otra', 'other', 'others', 'resto', 'rest', 'demás', 'los demás', 'las demás']);

/** ¿El nombre ya es un cajón "Otros" (venga de los datos o del agrupamiento)? */
export const isOtherName = (name, label) => (label !== undefined && String(name) === String(label)) || OTHER_NAMES.has(String(name).trim().toLowerCase());

/** Nombre del cajón: `otherLabel` del spec, o "Otros" / "Other" según el idioma. */
export const otherLabel = (spec) => (typeof spec.otherLabel === 'string' && spec.otherLabel ? spec.otherLabel : String(spec.locale || 'es').startsWith('en') ? 'Other' : 'Otros');

/**
 * Umbral como fracción del total (0–1). Acepta 0.02, "2%" o 2 (= 2%).
 * `threshold: false` o 0 lo apaga.
 */
export function thresholdOf(spec) {
  const t = spec.threshold;
  if (t === false || t === null || t === 0) return 0;
  if (t === undefined || t === true) return DEFAULT_THRESHOLD;
  const n = typeof t === 'string' ? parseFloat(t.replace(',', '.')) / (t.includes('%') ? 100 : 1) : Number(t);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n >= 1 ? n / 100 : n;
}

/**
 * Decide qué elementos se agrupan. `items` va en el orden de dibujo;
 * `value(it)` es su tamaño. Devuelve { keep, fold, others } donde `others`
 * son los que ya se llamaban "Otros" en los datos (se fusionan con `fold`).
 * Solo agrupa si hay al menos dos bajo el umbral: un "Otros" de uno no aporta.
 */
export function splitOther(items, { value, name, threshold, total, protect, label, top }) {
  const others = items.filter((it) => isOtherName(name(it), label));
  const rest = items.filter((it) => !others.includes(it));
  const small = (it, i) => !(protect && protect(it)) && ((top && i >= top) || (threshold > 0 && total > 0 && value(it) / total < threshold));
  let fold = rest.filter(small);
  if (fold.length < 2 && !others.length && !(top && rest.length > top)) fold = [];
  const keep = rest.filter((it) => !fold.includes(it));
  return { keep, fold, others };
}
