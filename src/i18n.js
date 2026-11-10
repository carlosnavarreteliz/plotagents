// Idioma: reconocimiento a partir del texto del spec y las pocas palabras que
// la biblioteca escribe por su cuenta (fuente, total, buscar…). Lo demás
// (paginación, flechas, ✓) se dibuja con símbolos que no dependen del idioma.
//
//   detectLocale(['Ventas por región, 2025', 'Biobío'])  → 'es'
//   detectLocale(['Sales grew 12% in the South'])          → 'en'
//   locale: 'auto' en cualquier spec (y por defecto en `table`) lo usa.

export const LANGS = ['es', 'en', 'pt', 'fr', 'de'];

const WORDS = {
  es: { source: 'Fuente: ', total: 'Total', search: 'Buscar', none: 'Sin resultados', clear: 'Borrar', page: 'Página', prev: 'Anterior', next: 'Siguiente', sort: 'Ordenar por', yes: 'Sí', no: 'No', rows: 'filas', table: 'Tabla', of: 'de' },
  en: { source: 'Source: ', total: 'Total', search: 'Search', none: 'No results', clear: 'Clear', page: 'Page', prev: 'Previous', next: 'Next', sort: 'Sort by', yes: 'Yes', no: 'No', rows: 'rows', table: 'Table', of: 'of' },
  pt: { source: 'Fonte: ', total: 'Total', search: 'Buscar', none: 'Sem resultados', clear: 'Limpar', page: 'Página', prev: 'Anterior', next: 'Próxima', sort: 'Ordenar por', yes: 'Sim', no: 'Não', rows: 'linhas', table: 'Tabela', of: 'de' },
  fr: { source: 'Source : ', total: 'Total', search: 'Rechercher', none: 'Aucun résultat', clear: 'Effacer', page: 'Page', prev: 'Précédente', next: 'Suivante', sort: 'Trier par', yes: 'Oui', no: 'Non', rows: 'lignes', table: 'Tableau', of: 'sur' },
  de: { source: 'Quelle: ', total: 'Gesamt', search: 'Suchen', none: 'Keine Treffer', clear: 'Löschen', page: 'Seite', prev: 'Zurück', next: 'Weiter', sort: 'Sortieren nach', yes: 'Ja', no: 'Nein', rows: 'Zeilen', table: 'Tabelle', of: 'von' },
};

/** Código de idioma soportado ('es', 'en', 'pt', 'fr', 'de') a partir de cualquier etiqueta ('pt-BR', 'en_US'…). */
export function langOf(locale) {
  const k = String(locale || 'es').toLowerCase().slice(0, 2);
  return LANGS.includes(k) ? k : 'es';
}

/** Palabras de interfaz en el idioma del gráfico. */
export const words = (locale) => WORDS[langOf(locale)];

/** Texto en inglés si el locale es inglés; en castellano si no. */
export const esEn = (locale, es, en) => (String(locale || 'es').startsWith('en') ? en : es);

// Palabras funcionales frecuentes de cada idioma. Una palabra compartida
// (de, la, que…) reparte su peso entre los idiomas que la usan.
const STOP = {
  es: 'de la el los las y en por con para del que una un se al más es son sus su según entre como año años sin hasta desde ventas región regiones total mil millones porcentaje hogares personas este esta sobre cada ha han fue lidera mayor menor tasa crecimiento meta comuna comunas mes meses semana proyecto estado avance',
  en: 'the of and in by for with to is are from on at than more its as per was were this that which share sales region regions total thousand million percent households people over each has have had leads largest smallest rate growth target month months week project status progress revenue year years',
  pt: 'de da do das dos e em por com para que uma um ao mais é são sua seu entre como ano anos não até desde pelo pela no na nos nas vendas região total mil milhões taxa crescimento meta mês meses projeto estado cada foi tem',
  fr: 'de la le les et en par pour avec du des que une un au aux plus est sont sa son ses entre comme année années sans jusqu depuis sur dans ventes région total mille millions taux croissance objectif mois semaine projet état chaque été',
  de: 'der die das und in von mit für zu ist sind den dem des ein eine einer im am mehr als nach bei auf aus nicht jahr jahre umsatz region gesamt tausend millionen anteil wachstum ziel monat monate woche projekt status jede wurde hat',
};
const INDEX = new Map();
for (const [lang, list] of Object.entries(STOP)) for (const w of list.split(' ')) { if (!INDEX.has(w)) INDEX.set(w, []); INDEX.get(w).push(lang); }

// Letras que delatan un idioma (se suman a las palabras).
const CHARS = [
  [/[ñ¿¡]/g, { es: 3 }],
  [/[ãõ]/g, { pt: 3 }],
  [/ç/g, { pt: 1.5, fr: 1.5 }],
  [/[èêëàâùûœî]/g, { fr: 2 }],
  [/[äöüß]/g, { de: 3 }],
  [/[áíóú]/g, { es: 1, pt: 1 }],
  [/é/g, { es: 0.5, pt: 0.5, fr: 0.8 }],
];

/**
 * Idioma más probable de unos textos (títulos, encabezados, categorías), o
 * null si no hay señal suficiente. Determinista y sin diccionarios grandes.
 */
export function detectLocale(texts) {
  const s = [].concat(texts || []).filter((t) => typeof t === 'string' && t).join(' \n ').toLowerCase().slice(0, 6000);
  if (!s) return null;
  const score = { es: 0, en: 0, pt: 0, fr: 0, de: 0 };
  for (const tok of s.split(/[^\p{L}]+/u)) {
    const langs = tok && INDEX.get(tok);
    if (langs) for (const l of langs) score[l] += 1 / langs.length;
  }
  for (const [re, w] of CHARS) {
    const n = (s.match(re) || []).length;
    if (n) for (const [l, v] of Object.entries(w)) score[l] += Math.min(6, n) * v;
  }
  const ranked = Object.entries(score).sort((a, b) => b[1] - a[1]);
  const [[best, a], [, b]] = ranked;
  if (a < 1 || a < b * 1.25 + 0.25) return null;
  return best;
}

/** Idioma del documento en el navegador (`<html lang>` o el del sistema), o null. */
export function browserLocale() {
  // Solo en un navegador: Node 21+ también define `navigator`, y el SVG del servidor no debe depender de él.
  if (typeof document === 'undefined') return null;
  try {
    const l = (document.documentElement && document.documentElement.lang) || (typeof navigator !== 'undefined' && navigator.language) || '';
    const k = String(l).toLowerCase().slice(0, 2);
    return LANGS.includes(k) ? k : null;
  } catch { return null; }
}

/**
 * Textos de un spec que delatan su idioma: título, bajada, fuente, nombres de
 * columna y algunas categorías.
 */
export function specTexts(spec, data) {
  const out = [spec.title, spec.subtitle, spec.source, spec.dashedLabel];
  for (const c of [].concat(Array.isArray(spec.columns) ? spec.columns : [])) {
    if (typeof c === 'string') out.push(c);
    else if (c && typeof c === 'object') out.push(c.label, c.field);
  }
  if (Array.isArray(data)) {
    const rows = data.slice(0, 40);
    const keys = new Set();
    for (const r of rows) if (r && typeof r === 'object') for (const [k, v] of Object.entries(r)) { keys.add(k); if (typeof v === 'string' && v.length > 2 && !/^[\d\s.,%$€£-]+$/.test(v)) out.push(v); }
    // Nombres de campo con guiones bajos o camelCase: "ventas_region" → "ventas region".
    for (const k of keys) out.push(String(k).replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2'));
  }
  return out;
}

/** Resuelve `locale: "auto"`: idioma del texto, luego el del navegador, luego español. */
export function autoLocale(spec, data) {
  return detectLocale(specTexts(spec, data)) || browserLocale() || 'es';
}
