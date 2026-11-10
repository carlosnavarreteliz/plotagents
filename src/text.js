// Medición aproximada de texto sin DOM (Node, workers, SSR).
// Calibrada para sans humanistas (Mozilla Text, Inter, system-ui).
// Respeta la escala de texto global (textScale): el layout se calcula con el
// tamaño real con que se dibuja el texto.
import { ctx } from './context.js';

const W = {};
const set = (chars, w) => { for (const c of chars) W[c] = w; };
set('abcdeghknopqsuvxyzáéóúñü', 0.54);
set('ijlíï', 0.25);
set('frt', 0.36);
set('mw', 0.82);
set('ABCDEFGHKNOPQRSTUVXYZÁÉÍÓÚÑ', 0.64);
set('IJ', 0.3);
set('MW', 0.86);
set('0123456789', 0.56);
set(' ', 0.27);
set('.,:;\'!|', 0.26);
set('-–()[]/', 0.36);
set('%', 0.82);
set('$€', 0.58);
set('+=<>±×', 0.58);
set('—', 0.9);
set('▲▼■●', 0.9);
set('·', 0.3);
set('→', 0.9);
set('\u202F', 0.17); // espacio fino (miles en francés)
set('\u00A0', 0.27);
set('✓✗', 0.7);
set('‹›', 0.32);
set('#', 0.6);

export function measure(str, size = 12, weight = 400) {
  let w = 0;
  for (const c of String(str ?? '')) w += W[c] ?? 0.56;
  const bold = weight >= 600 ? 1.06 : weight >= 500 ? 1.03 : 1;
  return w * size * ctx.textScale * bold * 1.05; // margen: Mozilla Text es un poco más ancha
}

/** Recorta con elipsis para caber en `max` px. */
export function truncate(str, max, size = 12, weight = 400) {
  str = String(str ?? '');
  if (measure(str, size, weight) <= max) return str;
  let s = str;
  while (s.length > 1 && measure(s + '…', size, weight) > max) s = s.slice(0, -1);
  return s.trimEnd() + '…';
}

/** Ajusta texto en líneas de ancho `max`. Devuelve un arreglo de líneas. */
export function wrap(str, max, size = 12, weight = 400, maxLines = Infinity) {
  const words = String(str ?? '').split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? cur + ' ' + w : w;
    if (measure(next, size, weight) <= max || !cur) cur = next;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = truncate(lines.slice(maxLines - 1).join(' '), max, size, weight);
    return kept;
  }
  return lines;
}
