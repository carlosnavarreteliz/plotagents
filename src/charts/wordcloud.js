// Nube de palabras, hecha con cuidado.
//
//   plot({ type: 'wordcloud', data, text: 'palabra', value: 'menciones' })
//   plot({ type: 'wordcloud', text: 'respuestas abiertas de una encuesta…' })
//
// Decisiones de diseño (lo que suele salir mal en una nube):
// · Todas las palabras horizontales: girarlas obliga a torcer el cuello.
// · El tamaño de letra crece con la raíz de la frecuencia, para que el ÁREA
//   de la palabra (no su altura) sea proporcional al conteo.
// · Colocación determinista en espiral desde el centro, la más frecuente
//   primero; sin choques, con aire entre palabras. Mismo spec, misma nube.
// · Color con significado: por grupo (`series`) con leyenda, o un solo tono
//   que se oscurece con la frecuencia. Nunca colores al azar.
// · Si una palabra no cabe, se achica toda la nube; las que igual no caben
//   se informan en la descripción, nunca se cortan.
// · Con texto crudo, cuenta palabras quitando las vacías (es/en).
import { g, text, tip } from '../svg.js';
import { measure } from '../text.js';
import { makeFormat, formatNumber } from '../format.js';
import { colorMap, ramp } from '../theme.js';
import { ensureData, requireField, num, fieldsOf, fieldKind, humanize, PlotError } from '../data.js';
import { createFrame } from '../frame.js';
import { ctx } from '../context.js';

const T = (locale, es, en) => (String(locale || 'es').startsWith('en') ? en : es);

const STOP = new Set((
  // Español
  'a al algo algún alguna algunas alguno algunos ante antes aquel aquella aquellas aquellos aquí así aun aún bajo bien cada casi como cómo con contra cual cuál cuales cuando cuándo de del desde donde dónde dos el él ella ellas ellos en entre era eran es esa esas ese eso esos esta está están estar este esto estos fue fueron ha había han hasta hay la las le les lo los más me mi mis mismo mucho muy nada ni no nos nosotros nuestra nuestro o os otra otras otro otros para pero poco por porque qué que quien quién se sea ser si sí sin sobre son su sus también tan tanto te tiene tienen todo todos tu tus un una uno unos usted ustedes ya yo estoy estamos fue sido ser hacer hace cosa cosas solo sólo vez veces etc pues entonces luego'
  // English
  + ' a about above after again all am an and any are as at be because been before being below between both but by can could did do does doing down during each few for from further had has have having he her here hers him his how i if in into is it its itself just me more most my no nor not now of off on once only or other our ours out over own same she should so some such than that the their them then there these they this those through to too under until up very was we were what when where which while who whom why will with would you your yours also get got really much many one two'
).split(/\s+/));

// Palabras vacías extra por idioma (se suman a es/en solo si el locale las pide).
const STOP_BY = {
  pt: 'não uma uns umas dos das nas nos pelo pela pelos pelas com para por que mas como mais muito já também são foi era tem têm ele ela eles elas isso isto esse essa este esta aos àquele seu sua seus suas meu minha nós você vocês ser estar ter há então quando onde',
  fr: 'les des une dans pour que qui est sont mais comme plus par sur pas avec ces cette cet aux ils elles nous vous ont été être avoir fait très aussi donc ainsi sans sous entre leur leurs son ses mes tes notre votre',
  de: 'der die das den dem des ein eine einer einem einen und oder aber nicht mit von zu für auf ist sind war waren wird werden hat haben auch als wie bei nach aus über sich es sie wir ihr ich du er an im am zum zur dass noch nur sehr',
};
// Compara sin tildes: "tambien" y "también" son la misma palabra vacía.
const plain = (w) => w.normalize('NFD').replace(/\p{M}/gu, '');
const STOP_PLAIN = new Set([...STOP].map(plain));

/** Texto crudo → [{ text, value }] por frecuencia. */
export function countWords(input, { locale, minLength = 3, stopwords = [] } = {}) {
  const extra = new Set([].concat(stopwords).map((w) => String(w).toLowerCase()));
  for (const w of (STOP_BY[String(locale || '').slice(0, 2)] || '').split(' ')) if (w) extra.add(w);
  const counts = new Map(), shown = new Map();
  const docs = [].concat(input).filter((d) => typeof d === 'string');
  for (const d of docs) for (const m of d.matchAll(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu)) {
    const raw = m[0].replace(/['’-]+$/, '');
    const k = raw.toLowerCase();
    if (k.length < minLength || STOP.has(k) || STOP_PLAIN.has(plain(k)) || extra.has(k) || /^\d+$/.test(k)) continue;
    counts.set(k, (counts.get(k) || 0) + 1);
    // Se muestra la forma más común (respeta "Biobío", "IA", "ChatGPT").
    const f = shown.get(k) || new Map();
    f.set(raw, (f.get(raw) || 0) + 1);
    shown.set(k, f);
  }
  return [...counts].map(([k, v]) => ({ text: [...shown.get(k)].sort((a, b) => b[1] - a[1])[0][0], value: v }));
}

export function wordcloud(spec, theme) {
  const locale = spec.locale || 'es';
  const en = String(locale).startsWith('en');
  // ── Palabras ────────────────────────────────────────────────────────────
  let words, groupF = null, valueF = 'value';
  // `text` es un campo de los datos, o el texto mismo a contar (string o lista de strings).
  const isField = typeof spec.text === 'string' && Array.isArray(spec.data) && spec.data.length > 0 && fieldsOf(spec.data).includes(spec.text);
  const rawText = !isField && (typeof spec.text === 'string' || (Array.isArray(spec.text) && spec.text.length > 0 && spec.text.every((t) => typeof t === 'string')));
  if (rawText || (spec.textField && spec.data)) {
    const docs = rawText ? spec.text : ensureData(spec).map((r) => r[spec.textField]);
    words = countWords(docs, { locale, minLength: spec.minLength ?? 3, stopwords: spec.stopwords });
    valueF = T(locale, 'menciones', 'mentions');
  } else {
    const data = ensureData(spec);
    const fields = fieldsOf(data);
    const textF = spec.text ?? spec.word ?? spec.label ?? spec.x ?? fields.find((f) => /^(word|palabra|term|término|termino|text|texto|tag|keyword)$/i.test(f)) ?? fields.find((f) => fieldKind(data, f) === 'category');
    valueF = spec.value ?? spec.size ?? spec.y ?? fields.find((f) => f !== textF && fieldKind(data, f) === 'number');
    groupF = spec.series ?? spec.hue ?? spec.group ?? (typeof spec.color === 'string' && !spec.color.startsWith('#') ? spec.color : null);
    requireField(data, textF, 'text');
    if (valueF) requireField(data, valueF, 'value');
    if (groupF) requireField(data, groupF, 'series');
    const acc = new Map();
    for (const r of data) {
      const t = String(r[textF] ?? '').trim();
      if (!t) continue;
      const v = valueF ? num(r[valueF]) : 1;
      if (!Number.isFinite(v) || v <= 0) continue;
      // Con `series`, la misma palabra en dos grupos son dos entradas (no se funde con el primero).
      const gk = groupF ? String(r[groupF]) : null;
      const key = gk === null ? t : gk + '\u0000' + t;
      const e = acc.get(key) || { text: t, value: 0, group: gk };
      e.value += v;
      acc.set(key, e);
    }
    words = [...acc.values()];
  }
  if (!words.length) throw new PlotError(T(locale, 'La nube no tiene palabras.', 'The word cloud has no words.'), T(locale, 'Pasa filas { palabra, valor } o `text: "…"` con el texto a contar.', 'Pass rows { word, value } or `text: "…"` with the text to count.'));
  words.sort((a, b) => b.value - a.value || a.text.localeCompare(b.text));
  const total = words.reduce((a, w) => a + w.value, 0);
  const top = spec.top ?? 80;
  const dropped = Math.max(0, words.length - top);
  words = words.slice(0, top);

  // ── Marco y color ───────────────────────────────────────────────────────
  const groups = groupF ? [...new Set(words.map((w) => w.group))] : [];
  const cmap = groups.length ? colorMap(groups, theme, spec.colors) : null;
  const legend = groups.map((gname) => ({ label: gname, color: cmap.get(gname), shape: 'square' }));
  const frame = createFrame(spec, theme, { height: 460 });
  const area = frame.layout(legend);
  const vmax = words[0].value, vmin = words[words.length - 1].value;
  const hl = spec.highlight === undefined ? null : new Set([].concat(spec.highlight).map((s) => String(s).toLowerCase()));
  const colorOf = (w, t) => {
    if (cmap) return cmap.get(w.group);
    if (spec.colors && spec.colors[w.text]) return spec.colors[w.text];
    // Un solo tono: más frecuente, más oscuro (en tema oscuro, más claro).
    return ramp(theme.sequential, 0.5 + 0.5 * t);
  };

  // ── Colocación: espiral, de la más frecuente a la menos ─────────────────
  const XS = ctx.textScale;
  const minF = spec.minFont ?? 11;
  const maxF0 = spec.maxFont ?? Math.max(26, Math.min(80, Math.sqrt(area.w * area.h) / 6.2));
  const cx = area.x + area.w / 2, cy = area.y + area.h / 2;
  const pad = 3;
  const tryLayout = (k) => {
    const maxF = Math.max(minF + 4, maxF0 * k);
    const placed = [], miss = [];
    const cell = 40, grid = new Map();
    const keyOf = (i, j) => i * 100003 + j;
    const cellsOf = (b) => { const out = []; for (let i = Math.floor(b[0] / cell); i <= Math.floor(b[2] / cell); i++) for (let j = Math.floor(b[1] / cell); j <= Math.floor(b[3] / cell); j++) out.push(keyOf(i, j)); return out; };
    const hit = (b) => { for (const c of cellsOf(b)) for (const o of grid.get(c) || []) if (!(b[2] <= o[0] || b[0] >= o[2] || b[3] <= o[1] || b[1] >= o[3])) return true; return false; };
    const add = (b) => { for (const c of cellsOf(b)) { if (!grid.has(c)) grid.set(c, []); grid.get(c).push(b); } };
    const ratio = area.w / Math.max(1, area.h);
    for (const [idx, w] of words.entries()) {
      const t = vmax === vmin ? 0.6 : Math.sqrt((w.value - vmin) / (vmax - vmin));
      const size = Math.max(minF, minF + (maxF - minF) * t);
      const weight = t > 0.55 ? 600 : t > 0.2 ? 500 : 400;
      const bw = measure(w.text, size, weight), bh = size * XS * 1.02;
      if (bw > area.w || bh > area.h) { miss.push(w); continue; }
      let ok = null;
      // Espiral de Arquímedes, achatada según la forma del panel.
      for (let s = 0, r = 0; r < Math.hypot(area.w, area.h); s += 0.12) {
        r = 1.6 * s;
        const x = cx + r * Math.cos(s + idx * 0.7) * Math.sqrt(ratio), y = cy + r * Math.sin(s + idx * 0.7) / Math.sqrt(ratio);
        const b = [x - bw / 2 - pad, y - bh / 2 - pad, x + bw / 2 + pad, y + bh / 2 + pad];
        if (b[0] < area.x || b[2] > area.x + area.w || b[1] < area.y || b[3] > area.y + area.h) continue;
        if (!hit(b)) { ok = { x, y, b }; break; }
      }
      if (!ok) { miss.push(w); continue; }
      add(ok.b);
      placed.push({ ...w, x: ok.x, y: ok.y, size, weight, t, bh });
    }
    return { placed, miss };
  };
  let L = tryLayout(1);
  // Si no caben las importantes (el primer cuarto), se achica la nube entera.
  for (let k = 0.88, n = 0; n < 7 && L.miss.some((w) => words.indexOf(w) < Math.max(5, words.length / 4)); k *= 0.88, n++) L = tryLayout(k);
  const fmt = makeFormat(spec.format, locale, words.map((w) => w.value));
  const body = L.placed.map((w) => {
    const color = colorOf(w, w.t);
    const dim = hl && !hl.has(w.text.toLowerCase());
    const share = total ? ` · ${formatNumber((100 * w.value) / total, (100 * w.value) / total < 10 ? 1 : 0, locale)}%` : '';
    return text(w.x, w.y + w.bh * 0.3, w.text, {
      class: 'pa-m', fill: dim ? theme.dim : hl ? theme.categorical[1] : color, fontSize: w.size, fontWeight: w.weight, textAnchor: 'middle',
      letterSpacing: w.size > 30 ? '-0.02em' : null, 'data-color': color, 'data-tip': tip(w.text, `${fmt(w.value)} ${valueF ? humanize(valueF).toLowerCase() : ''}${share}`.trim(), w.group),
    });
  });
  // ── Descripción ─────────────────────────────────────────────────────────
  const head = words.slice(0, 5).map((w) => `${w.text} (${fmt(w.value)})`).join(', ');
  let desc = en ? `Word cloud of ${L.placed.length} words, sized by ${valueF ? humanize(valueF).toLowerCase() : 'frequency'}. Most frequent: ${head}.` : `Nube de ${L.placed.length} palabras, con tamaño según ${valueF ? humanize(valueF).toLowerCase() : 'frecuencia'}. Más frecuentes: ${head}.`;
  const lost = L.miss.length + dropped;
  if (lost) desc += en ? ` ${lost} less frequent words are not shown.` : ` No se muestran ${lost} palabras menos frecuentes.`;
  return frame.finish([g({ class: 'pa-words' }, body)], { desc, type: 'wordcloud' });
}

