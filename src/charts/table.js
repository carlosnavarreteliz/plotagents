// Tablas: para cuando el lector necesita buscar el número exacto, no ver una
// forma. Sin rejas ni cajas: filetes finos entre filas, números alineados a la
// derecha con cifras tabulares y decimales parejos por columna, y en cada
// columna el indicador que la explica (barra, variación con flecha, color,
// minigráfico, avance contra la meta, estado). En pantallas angostas cada fila
// se vuelve una tarjeta. Las filas se paginan; en el navegador, render()
// agrega orden por columna, búsqueda y paso de página.
import { el, g, text, tip, esc, linkWrap } from '../svg.js';
import { measure, truncate, wrap } from '../text.js';
import { makeFormat, formatDate, parseDate, currencyPrefix } from '../format.js';
import { ensureData, fieldsOf, fieldKind, num, uniq, humanize, PlotError, aggregate } from '../data.js';
import { createFrame } from '../frame.js';
import { ctx } from '../context.js';
import { ramp, textOn, readable, contrast, mix } from '../theme.js';
import { dateUnit } from '../scale.js';
import { resolveColorScale, sample } from '../colorscales.js';
import { words, langOf } from '../i18n.js';
import { railAccessors, railValues, railExtent, railMarks, railTip } from '../rail.js';

// Tipos de columna (y sus alias): lo que el agente escriba se entiende.
const TYPE_ALIAS = {
  text: 'text', string: 'text', label: 'text', category: 'text',
  number: 'number', numeric: 'number', value: 'number',
  bar: 'bar', bars: 'bar', databar: 'bar',
  heat: 'heat', heatmap: 'heat', color: 'heat', colour: 'heat', scale: 'heat',
  delta: 'delta', change: 'delta', variation: 'delta', variacion: 'delta', 'variación': 'delta', arrow: 'delta', diff: 'delta',
  sparkline: 'sparkline', spark: 'sparkline', trend: 'sparkline', line: 'sparkline', tendencia: 'sparkline',
  progress: 'progress', meter: 'progress', target: 'progress', bullet: 'progress', avance: 'progress', goal: 'progress',
  badge: 'badge', pill: 'badge', tag: 'badge', status: 'badge', estado: 'badge', chip: 'badge',
  check: 'check', boolean: 'check', bool: 'check', icon: 'check',
  date: 'date', fecha: 'date', time: 'date',
  link: 'link', url: 'link',
  rank: 'rank',
  range: 'range', rail: 'range', interval: 'range', benchmark: 'range',
};
export const COLUMN_TYPES = [...new Set(Object.values(TYPE_ALIAS))];
export const columnType = (t) => TYPE_ALIAS[String(t || '').toLowerCase()] || null;

const DELTA_RE = /(^|[\s_.-])((var|vars|chg|yoy|mom|qoq|diff|dif)(?![a-z\u00e1\u00e9\u00ed\u00f3\u00fa\u00f1])|delta|change|cambio|crec|growth|difference|diferencia|variaci[oó]n|varia[cç][aã]o|ver[äa]nderung|[ée]volution|evoluci[oó]n|\+\/-)/i;
const PCT_NAME_RE = /(%|pct|percent|porc|porcentaje|tasa|rate|share|participaci|anteil|taux|part\b)/i;
const PROGRESS_RE = /(progress|avance|progreso|complet|cumplim|ejecuci[oó]n|achiev|logro|fortschritt|avancement|andamento)/i;
// Nombres que solo indican avance si los valores son fracciones (0,96 = 96% de la meta).
const GOAL_RE = /^(meta|metas|target|goal|objetivo|objective|ziel|objectif|cumplimiento|attainment|ratio)$|(^|[\s_.-])(meta|target|goal|objetivo)([\s_.-]|$)/i;
const ID_RE = /^(id|_id|code|c[oó]d(igo)?|cod_.*|n[°º.]?|no\.?|nro|num(ero|ber)?|#|rut|dni|zip|cp|phone|tel[eé]fono|tel)$/i;

// Estados reconocidos en varios idiomas: el color dice algo, no decora.
const STATUS = [
  ['good', /^(ok|okay|done|complete|completed|finished|approved|active|paid|delivered|resolved|success|successful|on track|healthy|passed|closed|won|live|listo|lista|hecho|hecha|completad[oa]|terminad[oa]|finalizad[oa]|aprobad[oa]|activ[oa]|pagad[oa]|entregad[oa]|resuelt[oa]|al d[ií]a|cumplid[oa]|exitos[oa]|vigente|logrado|ganad[oa]|conclu[ií]d[oa]|pago|ativo|aprovad[oa]|fertig|erledigt|abgeschlossen|aktiv|bezahlt|genehmigt|termin[ée]e?|valid[ée]e?|pay[ée]e?|actif|active|r[ée]ussi)$/i],
  ['warning', /^(at risk|pending|on hold|in review|under review|review|delayed|warning|paused|draft|waiting|medium|en riesgo|pendiente|en espera|en revisi[oó]n|pausad[oa]|borrador|demorad[oa]|retrasad[oa]|observad[oa]|em risco|pendente|em an[aá]lise|em espera|en attente|[àa] risque|en retard|brouillon|ausstehend|verz[öo]gert|gef[äa]hrdet|in pr[üu]fung|entwurf)$/i],
  ['critical', /^(late|overdue|failed|fail|failing|error|blocked|cancell?ed|rejected|lost|critical|down|off track|expired|atrasad[oa]|vencid[oa]|bloquead[oa]|cancelad[oa]|rechazad[oa]|fallid[oa]|perdid[oa]|cr[ií]tic[oa]|ca[ií]d[oa]|expirad[oa]|reprovad[oa]|falh[ao]u?|[ée]chou[ée]e?|bloqu[ée]e?|annul[ée]e?|rejet[ée]e?|perdu|fehlgeschlagen|blockiert|abgelehnt|storniert|[üu]berf[äa]llig|verloren)$/i],
  ['info', /^(in progress|ongoing|open|new|started|running|planned|scheduled|en curso|en progreso|en proceso|en ejecuci[oó]n|abiert[oa]|nuev[oa]|iniciad[oa]|planificad[oa]|programad[oa]|em andamento|em curso|aberto|novo|planejado|en cours|ouvert|nouveau|planifi[ée]e?|in bearbeitung|offen|neu|geplant|l[äa]uft)$/i],
];
export const statusOf = (v) => { const s = String(v ?? '').trim(); for (const [k, re] of STATUS) if (re.test(s)) return k; return null; };

const YES = /^(true|yes|y|s[ií]|sim|oui|ja|x|✓|✔|☑)$/i;
const NO = /^(false|no|n|não|nao|non|nein|✗|✘|☐|-|–|—)$/i;
const SAFE_URL = /^(https?:\/\/|mailto:)[^\s"'<>]+$/i;

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const isNil = (v) => v === null || v === undefined || v === '' || (typeof v === 'number' && Number.isNaN(v));
const decimalsOf = (v) => { if (!Number.isFinite(v) || Number.isInteger(v)) return 0; const s = String(+v.toPrecision(12)); const m = /\.(\d+)$/.exec(s) || /e-(\d+)/.exec(s); return m ? Math.min(6, m[1].length) : 0; };

/** Acerca `fg` a `toward` hasta lograr contraste ≥ min sobre `bg`. */
function legible(fg, bg, toward, min = 4.5) {
  let c = fg;
  for (let t = 0.05; contrast(c, bg) < min && t <= 1.0001; t += 0.05) c = mix(fg, toward, t);
  return c;
}
const hexOr = (c, d) => (typeof c === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c.trim()) ? c.trim() : d);

/** Lista de columnas: la que da el agente o una inferida de los datos. */
function columnList(spec, data) {
  const fields = fieldsOf(data);
  const groupF = typeof spec.group === 'string' && fields.includes(spec.group) ? spec.group : null;
  if (Array.isArray(spec.columns) && spec.columns.length) {
    return spec.columns.map((c) => (typeof c === 'string' ? { field: c } : c && typeof c === 'object' ? { ...c, field: c.field ?? c.key ?? c.name ?? c.id } : null)).filter((c) => c && (c.field !== undefined || columnType(c.type) === 'rank'));
  }
  const labelF = spec.label ?? spec.x;
  let list;
  if (spec.y !== undefined || spec.value !== undefined) {
    list = [labelF, ...[].concat(spec.y ?? []), ...[].concat(spec.value ?? [])].filter((f) => f !== undefined && f !== null);
    if (!labelF) { const first = fields.find((f) => fieldKind(data, f) === 'category' && f !== groupF); if (first) list.unshift(first); }
  } else {
    list = fields.filter((f) => f !== groupF && !String(f).startsWith('_'));
    if (labelF && list.includes(labelF)) list = [labelF, ...list.filter((f) => f !== labelF)];
  }
  // Las filas de un spec con `dashed: "campo"` marcan provisorios; ese campo no es una columna.
  if (typeof spec.dashed === 'string') list = list.filter((f) => f !== spec.dashed);
  return uniq(list).map((f) => ({ field: f }));
}

/** Pista de formato a partir del texto crudo: "12%" → porcentaje, "$ 3.000" → moneda. */
function rawHint(values) {
  const strs = values.filter((v) => typeof v === 'string' && v.trim());
  if (!strs.length || strs.length < values.length * 0.6) return null;
  if (strs.filter((s) => /%\s*$/.test(s)).length >= strs.length * 0.6) return { type: 'percent', scale: 1 };
  const cur = strs.map((s) => (/^\s*[-−]?\s*(US\$|\$|€|£|R\$|S\/|UF)/.exec(s) || [])[1]).filter(Boolean);
  if (cur.length >= strs.length * 0.6) return { type: 'number', prefix: cur[0] === 'UF' ? 'UF ' : cur[0] };
  return null;
}

/**
 * Formateador de una columna numérica: mismos decimales en toda la columna
 * (los números se leen alineados) y cifras completas; nada de "1,2 M" en una
 * tabla salvo que se pida `format: "compact"`.
 */
function columnFormat(fmt, values, locale, hint) {
  let o = typeof fmt === 'string' ? { type: fmt } : fmt && typeof fmt === 'object' ? { ...fmt } : hint ? { ...hint } : { type: 'number' };
  if (!o.type) o.type = 'number';
  const nums = values.filter(Number.isFinite);
  const maxAbs = nums.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
  if (o.type === 'currency') { o = { ...o, type: 'number', prefix: o.prefix ?? currencyPrefix(o.currency, langOf(locale)) }; if (o.decimals === undefined) o.decimals = maxAbs >= 100 || nums.every(Number.isInteger) ? 0 : 2; }
  if (o.type === 'number' && o.decimals === undefined) {
    const cap = maxAbs >= 1000 ? 0 : maxAbs >= 100 ? 1 : maxAbs >= 1 ? 2 : 3;
    o.decimals = Math.min(cap, Math.max(0, ...nums.map(decimalsOf)));
  }
  if (o.type === 'percent' && o.decimals === undefined) {
    const scale = o.scale ?? (maxAbs > 1.5 ? 1 : 100);
    o.scale = scale;
    const sc = nums.map((v) => v * scale);
    const m = sc.reduce((a, v) => Math.max(a, Math.abs(v)), 0);
    o.decimals = Math.min(m >= 10 ? 1 : 2, Math.max(0, ...sc.map((v) => decimalsOf(+v.toPrecision(10)))));
  }
  return makeFormat(o, locale, nums);
}

/** Prepara cada columna: tipo, alineación, formato y estadísticas sobre TODAS las filas. */
function prepareColumns(spec, data, theme, locale) {
  const W = words(locale);
  const list = columnList(spec, data);
  const fields = fieldsOf(data);
  for (const c of list) {
    if (c.field !== undefined && columnType(c.type) !== 'rank' && !fields.includes(c.field)) {
      throw new PlotError(`La columna "${c.field}" no existe en los datos.`, `Campos disponibles: ${fields.map((f) => `"${f}"`).join(', ') || '(ninguno)'}`);
    }
  }
  const labelF = spec.label ?? spec.x ?? (list.find((c) => c.field !== undefined && fieldKind(data, c.field) === 'category') || list[0] || {}).field;
  const mainF = spec.bars === false ? null : spec.value ?? (typeof spec.y === 'string' ? spec.y : undefined);
  let barGiven = false;
  const cols = list.map((c0, i) => {
    const c = { ...c0, index: i };
    const t = columnType(c.type);
    if (c.type !== undefined && !t) c.type = undefined;
    c.label = c.label ?? c.title ?? c.header ?? (t === 'rank' && c.field === undefined ? '#' : humanize(c.field));
    if (t === 'rank') { c.type = 'rank'; c.align = c.align ?? 'right'; return c; }
    const raw = data.map((r) => r[c.field]);
    const present = raw.filter((v) => !isNil(v));
    const kind = present.length ? fieldKind(data, c.field) : 'empty';
    const isArr = present.length && present.filter((v) => Array.isArray(v)).length >= present.length * 0.5;
    const isBool = present.length && (present.every((v) => typeof v === 'boolean') || (present.every((v) => typeof v === 'string' && (YES.test(v.trim()) || NO.test(v.trim()))) && present.some((v) => YES.test(String(v).trim())) && present.some((v) => NO.test(String(v).trim())) && uniq(present.map((v) => String(v).trim().toLowerCase())).length <= 3));
    const nums = kind === 'number' || kind === 'year' ? raw.map(num) : [];
    const finite = nums.filter(Number.isFinite);
    c.isLabel = c.field === labelF;
    let type = t;
    if (!type) {
      if (isArr) type = 'sparkline';
      else if (isBool) type = 'check';
      else if (kind === 'date') type = 'date';
      else if (kind === 'number' || (kind === 'year' && !c.isLabel)) {
        const lo = Math.min(...finite), hi = Math.max(...finite);
        if (ID_RE.test(String(c.field))) type = 'text';
        else if (kind === 'year') type = 'number';
        else if (DELTA_RE.test(String(c.field)) || DELTA_RE.test(String(c.label))) type = 'delta';
        else if ((PROGRESS_RE.test(String(c.field)) || PROGRESS_RE.test(String(c.label))) && lo >= 0 && hi <= 150) type = 'progress';
        else if ((GOAL_RE.test(String(c.field)) || GOAL_RE.test(String(c.label))) && lo >= 0 && hi <= 1.5 && !finite.every(Number.isInteger)) type = 'progress';
        else type = 'number';
      } else if (present.length && present.filter((v) => typeof v === 'string' && SAFE_URL.test(v.trim())).length >= present.length * 0.8) type = 'link';
      else if (present.length >= 2 && present.filter((v) => statusOf(v)).length >= present.length * 0.8) type = 'badge';
      else type = 'text';
    }
    if (type === 'bar' || type === 'heat' || type === 'progress') barGiven = barGiven || type === 'bar';
    c.type = type;
    c.kind = kind;
    c.values = nums;
    c.finite = finite;
    const numeric = ['number', 'bar', 'heat', 'delta', 'progress', 'range'].includes(type);
    if (numeric && !finite.length && !(type === 'number' && kind === 'year')) c.type = type = 'text';
    // Formato: el de la columna, el del spec (para números) o el que delata el texto crudo.
    const hint = rawHint(raw);
    if (type === 'delta') {
      const pctLike = hint?.type === 'percent' || PCT_NAME_RE.test(String(c.field)) || PCT_NAME_RE.test(String(c.label)) || (finite.length && finite.every((v) => Math.abs(v) <= 1.5) && !finite.every(Number.isInteger));
      c.fmt = columnFormat(c.format ?? (pctLike ? (hint?.type === 'percent' ? hint : { type: 'percent' }) : hint), finite.map(Math.abs), locale, null);
    } else if (type === 'progress') {
      const target = c.target ?? c.max;
      c.targetOf = (r) => { const t = typeof target === 'string' ? num(r[target]) : Number.isFinite(+target) && target !== null && target !== undefined ? +target : NaN; return t; };
      c.hasTarget = target !== undefined && target !== null;
      const hi = Math.max(0, ...finite);
      c.scale100 = !c.hasTarget && hi > 1.5;
      c.fmt = c.hasTarget ? columnFormat(c.format ?? spec.format ?? hint, finite, locale, null) : makeFormat({ type: 'percent', scale: c.scale100 ? 1 : 100, decimals: 0 }, locale, finite);
      c.pctFmt = makeFormat({ type: 'percent', scale: 100, decimals: 0 }, locale, []);
    } else if (type === 'range') {
      // Riel: mínimo–máximo, una banda (lo–hi), la mediana, una referencia y el
      // valor de la fila como punto. Cada extremo es un campo o un número fijo.
      // `refs`: varias referencias, cada una con su rótulo. `clip` / `domain`:
      // una escala recortada; lo de fuera es un chevrón (ver src/rail.js).
      c.rg = railAccessors(c);
      const ends = data.flatMap((r) => railExtent(num(r[c.field]), railValues(c.rg, r)));
      c.rlo = Math.min(...ends); c.rhi = Math.max(...ends);
      // Con `clip`, la escala de la columna va del menor mínimo al mayor máximo.
      const mins = data.map((r) => c.rg.min(r)).filter(Number.isFinite), maxs = data.map((r) => c.rg.max(r)).filter(Number.isFinite);
      c.clo = mins.length ? Math.min(...mins) : c.rlo; c.chi = maxs.length ? Math.max(...maxs) : c.rhi;
      // Una columna con mínimo y máximo: la fila que no los trae va sin riel.
      c.ranged = c.min !== undefined && c.min !== null && c.max !== undefined && c.max !== null;
      c.fmt = columnFormat(c.format ?? spec.format ?? hint, ends, locale, null);
    } else if (numeric || (type === 'number' && kind === 'year')) {
      c.fmt = kind === 'year' && !c.format ? (v) => String(Math.round(v)) : columnFormat(c.format ?? spec.format ?? hint, finite, locale, null);
    } else if (type === 'sparkline') {
      const all = present.flatMap((v) => (Array.isArray(v) ? v.map(num).filter(Number.isFinite) : []));
      c.fmt = columnFormat(c.format ?? spec.format, all, locale, null);
      c.sparkAll = all;
    } else if (type === 'date') {
      const ts = present.map(parseDate).filter(Number.isFinite);
      c.unit = ts.length ? dateUnit(ts) : 'day';
      c.withYear = c.yearless !== true;
    }
    // `formatBy`: cada fila con su formato (una tabla de indicadores en unidades
    // distintas). Un campo cuyo valor es un formato ("percent", { suffix: " años" }…)
    // —los decimales se infieren entre las filas que comparten formato— o, desde
    // JS, una función (valor, fila) → texto. Sin total: no se suman unidades distintas.
    if (c.formatBy !== undefined && c.formatBy !== null && ['number', 'bar', 'heat', 'delta', 'range'].includes(type)) {
      if (typeof c.formatBy === 'function') {
        const fn = c.formatBy;
        c.rowFmt = (r) => { const f = (v) => (v === null || v === undefined || Number.isNaN(v) ? '' : String(fn(v, r))); f.type = 'custom'; return f; };
      } else if (typeof c.formatBy === 'string') {
        const by = c.formatBy;
        const keyOf = (r) => { const v = r[by]; return isNil(v) ? null : typeof v === 'object' ? JSON.stringify(v) : String(v); };
        const cache = new Map();
        const valsOf = (r) => (type === 'range' ? railExtent(num(r[c.field]), railValues(c.rg, r)) : type === 'delta' ? [Math.abs(num(r[c.field]))] : [num(r[c.field])]);
        c.rowFmt = (r) => {
          const k = keyOf(r);
          if (k === null) return c.fmt;
          if (!cache.has(k)) {
            const vals = data.filter((d) => keyOf(d) === k).flatMap(valsOf).filter(Number.isFinite);
            const f = r[by];
            cache.set(k, columnFormat(typeof f === 'string' || (f && typeof f === 'object') ? f : undefined, vals, locale, null));
          }
          return cache.get(k);
        };
      }
      if (c.rowFmt && type === 'range' && c.scale === undefined) c.scale = 'row';
    }
    c.align = c.align ?? (['number', 'bar', 'heat', 'delta', 'progress', 'range'].includes(type) ? 'right' : type === 'check' ? 'center' : type === 'sparkline' ? 'left' : 'left');
    if (type === 'bar' || type === 'heat') {
      c.lo = Math.min(0, ...finite);
      c.hi = Math.max(0, ...finite);
      if (type === 'heat') {
        c.hlo = Math.min(...finite); c.hhi = Math.max(...finite);
        const cs = resolveColorScale(c.colorScale ?? c.cmap);
        c.mid = c.midpoint ?? spec.midpoint ?? (cs && typeof c.colorScale === 'object' && c.colorScale.mid !== undefined ? +c.colorScale.mid : undefined) ?? ((!cs || cs.kind === 'diverging') && c.hlo < 0 && c.hhi > 0 ? 0 : undefined);
        c.stops = cs && cs.kind !== 'qualitative' ? sample(cs.stops, 17) : null;
        if (c.stops && cs.kind === 'diverging' && c.mid === undefined) c.mid = (c.hlo + c.hhi) / 2;
      }
    }
    if (type === 'badge') {
      const vals = uniq(present.map(String));
      const fixed = { ...(spec.colors || {}), ...(c.colors || {}) };
      c.badge = new Map(vals.map((v) => {
        const st = statusOf(v);
        const base = hexOr(fixed[v], st === 'good' ? theme.status.good : st === 'warning' ? theme.status.warning : st === 'critical' ? theme.status.critical : st === 'info' ? theme.categorical[0] : null);
        return [v, base];
      }));
    }
    c.good = c.good ?? spec.good ?? 'up';
    return c;
  });
  // Indicador por defecto: barra en la medida principal (la de `value`/`y`, o
  // la primera numérica), si nadie pidió otra cosa y hay algo que comparar.
  if (!barGiven && spec.bars !== false && data.length >= 3 && !(Array.isArray(spec.columns) && spec.columns.some((c) => c && typeof c === 'object' && c.type))) {
    const main = cols.find((c) => c.field === mainF && c.type === 'number' && c.kind === 'number') || (mainF === undefined || mainF === null ? cols.find((c) => c.type === 'number' && c.kind === 'number' && !c.isLabel) : null);
    if (main && main.finite.length >= 2) { main.type = 'bar'; main.lo = Math.min(0, ...main.finite); main.hi = Math.max(0, ...main.finite); main.auto = true; }
  }
  // Rango: una columna "#" al inicio con `rank: true`.
  if (spec.rank && !cols.some((c) => c.type === 'rank')) cols.unshift({ type: 'rank', label: '#', align: 'right', index: -1 });
  return { cols, labelF, W };
}

/** El formato de una celda: el de su fila (`formatBy`) o el de la columna. */
const fmtOf = (c, r) => (c.rowFmt && r ? c.rowFmt(r) : c.fmt);

/** Texto visible de una celda (y su valor para ordenar). */
function cellText(c, r, locale, W) {
  const v = r[c.field];
  if (c.type === 'rank') return String(r.__rank ?? '');
  if (isNil(v)) return '';
  switch (c.type) {
    case 'number': case 'bar': case 'heat': case 'range': { const n = num(v); return Number.isFinite(n) ? fmtOf(c, r)(n) : String(v); }
    case 'delta': { const n = num(v); if (!Number.isFinite(n)) return String(v); const s = fmtOf(c, r)(Math.abs(n)); return n > 0 ? '+' + s : n < 0 ? '−' + s : s; }
    case 'progress': { const n = num(v); return Number.isFinite(n) ? c.fmt(n) : String(v); }
    case 'date': { const t = parseDate(v); return Number.isFinite(t) ? formatDate(t, c.unit, locale, c.withYear) : String(v); }
    case 'check': return v === true || YES.test(String(v).trim()) ? W.yes : W.no;
    case 'sparkline': { const a = Array.isArray(v) ? v.map(num).filter(Number.isFinite) : []; return a.length ? c.fmt(a[a.length - 1]) : ''; }
    case 'link': { const s = String(v).trim(); if (c.text && r[c.text] !== undefined) return String(r[c.text]); return s.replace(/^mailto:/i, '').replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, ''); }
    default:
      if (Array.isArray(v)) return v.map((x) => (x && typeof x === 'object' ? JSON.stringify(x) : String(x))).join(', ');
      if (typeof v === 'object') { try { return JSON.stringify(v); } catch { return '…'; } }
      return String(v);
  }
}

function sortKey(c, r) {
  const v = r[c.field];
  if (c.type === 'rank') return r.__rank;
  if (isNil(v)) return null;
  switch (c.type) {
    case 'number': case 'bar': case 'heat': case 'delta': case 'progress': case 'range': { const n = num(v); return Number.isFinite(n) ? n : null; }
    case 'date': { const t = parseDate(v); return Number.isFinite(t) ? t : String(v); }
    case 'check': return v === true || YES.test(String(v).trim()) ? 1 : 0;
    case 'sparkline': { const a = Array.isArray(v) ? v.map(num).filter(Number.isFinite) : []; return a.length ? a[a.length - 1] : null; }
    default: return String(v);
  }
}

const collatorCache = new Map();
function compareText(locale) {
  const k = langOf(locale);
  if (!collatorCache.has(k)) {
    let cmp;
    try { const col = new Intl.Collator(k, { numeric: true, sensitivity: 'base' }); cmp = (a, b) => col.compare(a, b); } catch { cmp = (a, b) => (norm(a) < norm(b) ? -1 : norm(a) > norm(b) ? 1 : 0); }
    collatorCache.set(k, cmp);
  }
  return collatorCache.get(k);
}

/** Orden actual: `sortBy` (campo o etiqueta) y `sort` ("desc"/"asc"). También `sort: "-ventas"`. */
export function sortState(spec, cols) {
  let by = spec.sortBy ?? spec.orderBy;
  let dir = spec.sortOrder ?? (['asc', 'desc'].includes(spec.sort) ? spec.sort : undefined);
  if (by === undefined && typeof spec.sort === 'string' && !['asc', 'desc', 'none', 'alpha', 'start'].includes(spec.sort)) {
    by = spec.sort.replace(/^[-+]/, '');
    if (dir === undefined) dir = spec.sort.startsWith('-') ? 'desc' : spec.sort.startsWith('+') ? 'asc' : undefined;
  }
  if (spec.sort && typeof spec.sort === 'object') { by = spec.sort.by ?? spec.sort.field; dir = spec.sort.order ?? spec.sort.dir; }
  if (by === undefined && dir) by = (cols.find((c) => c.type === 'bar') || cols.find((c) => ['number', 'heat', 'progress'].includes(c.type)) || {}).field;
  if (by === undefined || spec.sort === 'none') return null;
  const col = cols.find((c) => c.field === by) || cols.find((c) => String(c.label) === String(by)) || (by === '#' || by === 'rank' ? cols.find((c) => c.type === 'rank') : null);
  if (!col) return null;
  const numericish = ['number', 'bar', 'heat', 'delta', 'progress', 'sparkline', 'check'].includes(col.type);
  return { col, dir: dir === 'asc' || dir === 'desc' ? dir : numericish ? 'desc' : 'asc' };
}

const BASE = { cell: 13, head: 12, pad: 10 };

export function table(spec, theme) {
  const locale = spec.locale || 'es';
  const lang = langOf(locale);
  const all = ensureData(spec).map((r, i) => ({ ...r, __i: i }));
  const { cols, labelF, W } = prepareColumns(spec, all, theme, locale);
  if (!cols.length) throw new PlotError('La tabla no tiene columnas.', 'Pasa filas con campos, o `columns: ["region", "ventas"]`.');
  const X = ctx.textScale;
  const frame = createFrame(spec, theme, { height: 400 });
  const area = frame.layout([]);
  const density = spec.density === 'compact' ? 0.65 : spec.density === 'comfortable' ? 1.3 : 1;
  const padY = Math.round(9 * density);
  const FS = BASE.cell, HS = BASE.head;
  const LH = Math.round(FS * X * 1.38);
  const groupF = typeof spec.group === 'string' && all.length && spec.group in all[0] ? spec.group : null;
  const hl = spec.highlight === undefined || spec.highlight === null || spec.highlight === false ? null : new Set([].concat(spec.highlight).map(String));
  const isHL = (r) => hl && labelF !== undefined && hl.has(String(r[labelF]));

  // 1. Búsqueda (texto visible de todas las columnas, sin tildes ni mayúsculas).
  let rows = all;
  const query = typeof spec.query === 'string' ? spec.query.trim() : '';
  if (query) {
    const terms = norm(query).split(/\s+/).filter(Boolean);
    rows = rows.filter((r) => {
      const hay = norm(cols.map((c) => (c.type === 'rank' ? '' : cellText(c, r, locale, W) + ' ' + (r[c.field] ?? ''))).join(' ') + ' ' + (groupF ? r[groupF] : ''));
      return terms.every((t) => hay.includes(t));
    });
  }
  // 2. Orden (los vacíos siempre al final) y grupos en su orden de aparición.
  const st = sortState(spec, cols);
  if (st && st.col.type !== 'rank') {
    const cmpT = compareText(locale);
    const sgn = st.dir === 'asc' ? 1 : -1;
    rows = [...rows].sort((a, b) => {
      const ka = sortKey(st.col, a), kb = sortKey(st.col, b);
      if (ka === null && kb === null) return a.__i - b.__i;
      if (ka === null) return 1;
      if (kb === null) return -1;
      const d = typeof ka === 'number' && typeof kb === 'number' ? ka - kb : cmpT(String(ka), String(kb));
      return d * sgn || a.__i - b.__i;
    });
  } else if (st && st.col.type === 'rank' && st.dir === 'desc') rows = [...rows].reverse();
  if (groupF) {
    const order = new Map(uniq(all.map((r) => String(r[groupF] ?? ''))).map((k, i) => [k, i]));
    rows = [...rows].sort((a, b) => order.get(String(a[groupF] ?? '')) - order.get(String(b[groupF] ?? '')));
  }
  if (Number.isFinite(+spec.top) && +spec.top > 0) rows = rows.slice(0, +spec.top);
  rows = rows.map((r, i) => ({ ...r, __rank: i + 1 }));

  // 3. Páginas: todas las filas hasta 15; desde ahí, de a 10 (o `pageSize`).
  const nRows = rows.length;
  const psRaw = spec.pageSize ?? spec.perPage ?? (spec.paginate === false ? Infinity : undefined);
  const pageSize = psRaw === false || psRaw === 0 || psRaw === Infinity ? Infinity : Number.isFinite(+psRaw) && +psRaw > 0 ? Math.round(+psRaw) : nRows > 15 ? 10 : Infinity;
  const pages = pageSize === Infinity ? 1 : Math.max(1, Math.ceil(nRows / pageSize));
  const page = Math.max(1, Math.min(pages, Math.round(+spec.page || 1)));
  const pageRows = pageSize === Infinity ? rows : rows.slice((page - 1) * pageSize, page * pageSize);

  // 4. Fila de totales: `total: true` (suma, o promedio en porcentajes y avances).
  const totalOf = (c) => {
    const pick = c.total ?? (spec.total === true || typeof spec.total === 'string' ? (typeof spec.total === 'string' && spec.total !== 'true' ? spec.total : 'auto') : spec.total && typeof spec.total === 'object' ? spec.total[c.field] ?? 'auto' : undefined);
    if (pick === undefined || pick === false || c.isLabel || c.type === 'rank' || c.rowFmt) return null;
    if (!['number', 'bar', 'heat', 'progress', 'delta'].includes(c.type) || c.kind === 'year') return null;
    const how = pick === true || pick === 'auto' ? (c.type === 'delta' ? null : (c.type === 'progress' && !c.hasTarget) || c.fmt?.type === 'percent' ? 'mean' : 'sum') : pick; // con meta (gasto vs presupuesto) se suma
    if (!how) return null;
    const v = aggregate(rows.map((r) => num(r[c.field])), how);
    return Number.isFinite(v) ? v : null;
  };
  const hasTotal = spec.total !== false && cols.some((c) => totalOf(c) !== null);
  const totalLabel = spec.totalLabel ?? (spec.total && typeof spec.total === 'object' ? spec.total.label : undefined) ?? W.total;

  // `missingLabel`: lo que dice una celda sin valor (y su tooltip) en vez de «—».
  const missingLabel = spec.missingLabel === undefined || spec.missingLabel === null || spec.missingLabel === '' ? null : String(spec.missingLabel);

  // 5. Anchos: se miden sobre TODAS las filas, así no saltan al cambiar de página.
  const edge = Math.min(BASE.pad, Math.max(4, frame.pad - 6));
  const tableX = area.x - edge, tableW = area.w + edge * 2;
  const sample = all.length > 1500 ? all.filter((_, i) => i % Math.ceil(all.length / 1500) === 0) : all;
  const P = BASE.pad;
  const pillH = Math.round(Math.min(22, LH + 3));
  for (const c of cols) {
    const texts = c.type === 'rank' ? [String(Math.max(1, nRows))] : sample.map((r) => cellText(c, r, locale, W));
    const weight = c.isLabel ? 500 : 400;
    const widths = texts.map((t) => measure(t, FS, weight));
    let tw = Math.max(0, ...widths);
    if (hasTotal && c.isLabel) tw = Math.max(tw, measure(totalLabel, FS, 600));
    // `missingLabel`: la columna que tiene celdas vacías mide también ese rótulo.
    if (missingLabel !== null && c.type !== 'rank' && sample.some((r) => isNil(r[c.field]))) tw = Math.max(tw, measure(missingLabel, FS, 400));
    const tot = hasTotal ? totalOf(c) : null;
    if (tot !== null) tw = Math.max(tw, measure(c.type === 'progress' && !c.hasTarget ? c.pctFmt(tot / (c.scale100 ? 100 : 1)) : c.fmt(tot), FS, 600));
    const longest = Math.max(0, ...texts.map((t) => Math.max(0, ...String(t).split(/\s+/).map((w) => measure(w, FS, weight)))));
    const avgLen = texts.reduce((a, t) => a + String(t).length, 0) / Math.max(1, texts.length);
    c.lines = c.lines ?? (c.type === 'text' || c.type === 'link' ? (avgLen > 36 ? 3 : 2) : 1);
    c.valueW = tw;
    let nat, min;
    switch (c.type) {
      case 'bar': nat = tw + 8 + 120; min = tw + 8 + 36; break;
      case 'heat': nat = tw + 16; min = nat; break;
      case 'delta': nat = tw + 13; min = nat; break;
      case 'sparkline': nat = 104; min = 56; break;
      case 'progress': nat = tw + 8 + 96; min = tw + 8 + 40; break;
      case 'range': nat = tw + 8 + 150; min = tw + 8 + 64; break;
      case 'badge': { const pw = Math.max(0, ...texts.map((t) => measure(t, 12, 500) + 18)); nat = pw; min = Math.min(pw, 84); break; }
      case 'check': nat = 18; min = 18; break;
      case 'text': case 'link': nat = tw; min = Math.min(tw, Math.max(longest, Math.min(tw, 96))); break;
      default: nat = tw; min = tw;
    }
    const hw = measure(c.label, HS, 600) + (c.type === 'rank' ? 0 : 12); // + flecha de orden
    const hmin = Math.max(...String(c.label).split(/\s+/).map((w) => measure(w, HS, 600))) + 12;
    c.nat = Math.max(nat, Math.min(hw, Math.max(nat, hw))) + 2 * P;
    c.min = Math.max(min, Math.min(hmin, hw)) + 2 * P;
    if (Number.isFinite(+c.width) && +c.width > 0) { c.nat = c.min = +c.width; c.fixed = true; }
    c.minW = Math.min(c.min, c.nat);
  }
  const sumMin = cols.reduce((a, c) => a + c.minW, 0);
  const sumNat = cols.reduce((a, c) => a + c.nat, 0);
  const cardsOpt = spec.cards ?? spec.stacked ?? 'auto';
  const cards = cardsOpt === true || cardsOpt === 'always' || (cardsOpt !== false && cardsOpt !== 'never' && (sumMin > tableW + 0.5 || (tableW < 360 && cols.length > 3)));

  if (!cards) {
    for (const c of cols) c.w = c.nat;
    if (sumNat <= tableW) {
      // Espacio sobrante: a los indicadores (barras y avances), después al texto.
      let extra = tableW - sumNat;
      const tracks = cols.filter((c) => !c.fixed && (c.type === 'bar' || c.type === 'progress' || c.type === 'range'));
      for (const c of tracks) { const add = Math.min(extra / tracks.length, 110); c.w += add; }
      extra = tableW - cols.reduce((a, c) => a + c.w, 0);
      const flex = cols.filter((c) => !c.fixed && (c.type === 'text' || c.type === 'link' || c.isLabel));
      const share = flex.length ? flex : cols.filter((c) => !c.fixed);
      const base = share.reduce((a, c) => a + c.w, 0) || 1;
      for (const c of share) c.w += (extra * c.w) / base;
    } else {
      // Falta espacio: ceden primero los minigráficos y las barras, después el
      // texto (que se ajusta en líneas) y al final los estados y los números.
      let need = sumNat - tableW;
      const ORDER = [['sparkline', 'bar', 'progress', 'range'], ['text', 'link'], null];
      for (const group of ORDER) {
        if (need <= 0) break;
        const take = cols.filter((c) => !c.fixed && (group ? group.includes(c.type) : true));
        const slack = take.reduce((a, c) => a + (c.w - c.minW), 0);
        if (slack <= 0) continue;
        const k = Math.min(1, need / slack);
        for (const c of take) { const d = (c.w - c.minW) * k; c.w -= d; need -= d; }
      }
      if (need > 0.5) { const k = tableW / cols.reduce((a, c) => a + c.w, 0); for (const c of cols) c.w *= k; }
    }
    let x = tableX;
    for (const c of cols) { c.x = x; x += c.w; }
  }

  const body = [];
  const accent = theme.categorical[0];
  const negColor = theme.categorical[1] || theme.status.critical;
  const isDark = theme.mode === 'dark';
  const goodC = readable(theme.status.good, theme), badC = readable(theme.status.critical, theme);
  const ink = theme.ink;
  // Marcas fuera de foco (con `highlight`): tenues, pero visibles sobre el riel.
  const dimC = mix(theme.muted, theme.surface, isDark ? 0.4 : 0.45);
  const baseline = (top) => top + padY + Math.round(FS * X * 0.96);
  const midLine = (top) => top + padY + LH / 2;

  // Celda de estado: píldora clara del color, texto del mismo tono con contraste.
  const pill = (x, cy, label, color, maxW, align = 'left') => {
    const bg = color ? mix(color, theme.surface, isDark ? 0.72 : 0.86) : theme.tint;
    const fg = color ? legible(isDark ? mix(color, '#FFFFFF', 0.25) : color, bg, isDark ? '#FFFFFF' : ink) : theme.lede;
    const t = truncate(label, maxW - 18, 12, 500);
    const w = Math.min(maxW, measure(t, 12, 500) + 18);
    const x0 = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
    return [
      el('rect', { x: x0, y: cy - pillH / 2, width: w, height: pillH, rx: pillH / 2, fill: bg }),
      color ? el('circle', { cx: x0 + 9, cy, r: 3, fill: fg }) : '',
      text(x0 + (color ? 16 : 9), cy + 4.2 * X, t, { fill: fg, fontSize: 12, fontWeight: 500 }),
    ];
  };
  // Color de celda: rampa del tema (o `colorScale` de la columna), sin llegar
  // al extremo más oscuro para que la tabla no se vuelva un tablero de bloques.
  const heatColor = (c, v) => {
    if (c.mid !== undefined) { const span = Math.max(c.hhi - c.mid, c.mid - c.hlo) || 1; return ramp(c.stops || theme.diverging, 0.5 + 0.85 * ((v - c.mid) / span / 2)); }
    const t = (v - c.hlo) / (c.hhi - c.hlo || 1);
    return c.stops ? ramp(c.stops, 0.05 + 0.75 * t) : ramp(theme.sequential.slice(0, -1), 0.04 + 0.72 * t);
  };
  const arrow = (x, cy, up, color) => el('path', { d: up ? `M${x},${cy + 3}L${x + 3.5},${cy - 3}L${x + 7},${cy + 3}Z` : `M${x},${cy - 3}L${x + 3.5},${cy + 3}L${x + 7},${cy - 3}Z`, fill: color, 'aria-hidden': 'true' });
  const deltaColor = (c, n) => (n === 0 ? theme.muted : (n > 0) === (c.good !== 'down') ? goodC : badC);
  const check = (cx, cy, yes) => yes
    ? el('path', { d: `M${cx - 4.5},${cy + 0.2}L${cx - 1.4},${cy + 3.3}L${cx + 4.8},${cy - 3.6}`, fill: 'none', stroke: goodC, strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round' })
    : el('path', { d: `M${cx - 3.5},${cy}H${cx + 3.5}`, stroke: theme.muted, strokeWidth: 1.6, strokeLinecap: 'round' });
  const spark = (x, cy, w, h, vals, muted) => {
    if (vals.length < 2) return '';
    const mn = Math.min(...vals), mx = Math.max(...vals);
    const pts = vals.map((v, k) => [x + (k / (vals.length - 1)) * (w - 4) + 1, cy + h / 2 - ((v - mn) / (mx - mn || 1)) * h]);
    const d = pts.map(([a, b], k) => (k ? 'L' : 'M') + a.toFixed(1) + ',' + b.toFixed(1)).join('');
    const [lx, ly] = pts[pts.length - 1];
    return [
      el('path', { d: d + `L${lx.toFixed(1)},${(cy + h / 2).toFixed(1)}L${pts[0][0].toFixed(1)},${(cy + h / 2).toFixed(1)}Z`, fill: muted ? dimC : accent, fillOpacity: 0.08, stroke: 'none' }),
      el('path', { d, fill: 'none', stroke: muted ? dimC : theme.muted, strokeWidth: 1.5, strokeLinejoin: 'round', strokeLinecap: 'round' }),
      el('circle', { cx: lx, cy: ly, r: 2.6, fill: muted ? dimC : accent }),
    ];
  };
  const sparkTip = (c, vals) => (vals.length ? `${c.fmt(vals[0])} → ${c.fmt(vals[vals.length - 1])}` + (vals.length > 2 ? ` (min ${c.fmt(Math.min(...vals))}, max ${c.fmt(Math.max(...vals))})` : '') : '');
  const anyHL = hl && rows.some(isHL);

  /** Contenido de una celda dentro de una caja (x, w) y una fila (top, alto). */
  function cell(c, r, x, w, top, h, opts = {}) {
    const out = [];
    const ix = x + P, iw = Math.max(4, w - 2 * P);
    const by = baseline(top), my = midLine(top);
    const v = c.type === 'rank' ? r.__rank : r[c.field];
    const weight = opts.total ? 600 : c.isLabel ? (opts.hl ? 600 : 500) : 400;
    const muted = anyHL && !opts.hl && !opts.total;
    const tx = c.align === 'right' ? x + w - P : c.align === 'center' ? x + w / 2 : ix;
    const anchor = c.align === 'right' ? 'end' : c.align === 'center' ? 'middle' : null;
    const put = (s, { x: px, ...attrs } = {}) => out.push(text(px ?? tx, by, s, { fill: ink, fontSize: FS, fontWeight: weight, textAnchor: anchor, ...attrs }));
    if (opts.total && c.isLabel) { put(truncate(totalLabel, iw, FS, 600)); return { out }; }
    if (opts.total) {
      const tv = totalOf(c);
      if (tv === null) return { out };
      const ts = c.type === 'delta' ? (tv > 0 ? '+' : tv < 0 ? '−' : '') + c.fmt(Math.abs(tv)) : c.fmt(tv);
      // Barras y avances: el total bajo las cifras, no al final de la pista.
      if ((c.type === 'bar' || c.type === 'progress' || c.type === 'range') && c.align === 'right') put(ts, { x: ix + c.valueW, textAnchor: 'end' });
      else put(ts);
      return { out };
    }
    if (c.type !== 'rank' && isNil(v)) {
      if (missingLabel === null) { put('—', { fill: theme.muted, fontWeight: 400 }); return { out }; }
      const ms = truncate(missingLabel, iw, FS, 400);
      // Barras, avances y rieles: el rótulo va donde iría la cifra.
      put(ms, { fill: theme.muted, fontWeight: 400, ...((c.type === 'bar' || c.type === 'progress' || c.type === 'range') && c.align === 'right' ? { x: ix + c.valueW, textAnchor: 'end' } : {}) });
      return { out, tip: `${c.label}: ${missingLabel}` };
    }
    const s = cellText(c, r, locale, W);
    switch (c.type) {
      case 'rank': put(s, { fill: theme.muted, fontWeight: 400 }); break;
      case 'bar': {
        const n = num(v);
        if (!Number.isFinite(n)) { put(s); break; }
        const vw = c.valueW;
        const trackX = ix + vw + 8, trackW = Math.max(12, ix + iw - trackX);
        const span = c.hi - c.lo || 1;
        const z = trackX + (-c.lo / span) * trackW;
        const len = (Math.abs(n) / span) * trackW;
        const bh = Math.max(6, Math.min(12, Math.round(LH * 0.58)));
        const fill = muted ? dimC : n < 0 ? negColor : accent;
        out.push(text(ix + vw, by, s, { fill: ink, fontSize: FS, fontWeight: weight, textAnchor: 'end' }));
        if (c.lo < 0) out.push(el('line', { x1: z, x2: z, y1: my - bh / 2 - 3, y2: my + bh / 2 + 3, stroke: theme.axis, strokeWidth: 1 }));
        if (len > 0.3) out.push(el('rect', { x: n < 0 ? z - len : z, y: my - bh / 2, width: Math.max(1.5, len), height: bh, rx: Math.min(2, len / 2), fill }));
        break;
      }
      case 'heat': {
        const n = num(v);
        if (!Number.isFinite(n)) { put(s); break; }
        const fill = heatColor(c, n);
        // Celda de color con aire alrededor; en tarjetas, solo una ficha en torno a la cifra.
        if (opts.chip) {
          const bw = Math.min(w - P, measure(s, FS, weight) + 16), right = x + w - P;
          out.push(el('rect', { x: right - bw, y: top + 5, width: bw, height: Math.max(0, h - 10), rx: 5, fill }));
          put(s, { fill: textOn(fill, theme), x: right - 8 });
          break;
        }
        out.push(el('rect', { x: x + 3, y: top + 4, width: Math.max(0, w - 6), height: Math.max(0, h - 8), rx: 5, fill }));
        put(s, { fill: textOn(fill, theme) });
        break;
      }
      case 'delta': {
        const n = num(v);
        if (!Number.isFinite(n)) { put(s); break; }
        const color = deltaColor(c, n);
        const tw = measure(s, FS, 500);
        const right = c.align === 'right' ? x + w - P : c.align === 'center' ? x + w / 2 + (tw + 11) / 2 : ix + tw + 11;
        out.push(text(right, by, s, { fill: color, fontSize: FS, fontWeight: 500, textAnchor: 'end' }));
        if (n !== 0) out.push(arrow(right - tw - 11, my, n > 0, color));
        break;
      }
      case 'progress': {
        const n = num(v);
        if (!Number.isFinite(n)) { put(s); break; }
        const t = c.hasTarget ? c.targetOf(r) : c.scale100 ? 100 : 1;
        const ratio = Number.isFinite(t) && t ? n / t : NaN;
        const vw = c.valueW;
        const shown = c.hasTarget && Number.isFinite(ratio) ? c.pctFmt(ratio) : s;
        out.push(text(ix + vw, by, shown, { fill: ink, fontSize: FS, fontWeight: weight, textAnchor: 'end' }));
        const trackX = ix + vw + 8, trackW = Math.max(12, ix + iw - trackX);
        out.push(el('rect', { x: trackX, y: my - 3, width: trackW, height: 6, rx: 3, fill: theme.tint2 }));
        if (Number.isFinite(ratio) && ratio > 0) {
          // Subir es bueno: llegar a la meta es verde. Bajar es bueno (gasto): bajo la meta verde, sobre ella crítico.
          const goodUp = c.good !== 'down';
          const fill = muted ? dimC : goodUp ? (ratio >= 1 ? theme.status.good : accent) : ratio > 1 ? theme.status.critical : theme.status.good;
          out.push(el('rect', { x: trackX, y: my - 3, width: Math.max(6, trackW * Math.min(1, ratio)), height: 6, rx: 3, fill }));
        }
        return { out, tip: c.hasTarget && Number.isFinite(t) ? `${c.label}: ${c.fmt(n)} / ${c.fmt(t)} (${c.pctFmt(ratio)})` : null };
      }
      case 'range': {
        const n = num(v);
        if (!Number.isFinite(n)) { put(s); break; }
        const vw = c.valueW;
        out.push(text(ix + vw, by, s, { fill: ink, fontSize: FS, fontWeight: weight, textAnchor: 'end' }));
        const vals = railValues(c.rg, r);
        const F = Number.isFinite;
        const hasRange = F(vals.min) && F(vals.max);
        // Sin mínimo ni máximo (en una columna que los tiene) no hay riel: sólo
        // la cifra, nunca un punto suelto que parezca un rango.
        if (c.ranged && !hasRange && !vals.domain) break;
        const trackX = ix + vw + 12, trackW = Math.max(16, ix + iw - trackX - 6);
        // Escala: la de toda la columna (por defecto) o la de la fila (`scale: 'row'`);
        // recortada a `domain` o, con `clip`, a mínimo–máximo.
        let a = c.rlo, b = c.rhi, clipped = false;
        if (vals.domain) { [a, b] = vals.domain; clipped = true; }
        else if (c.clip && hasRange && c.scale === 'row') { a = Math.min(vals.min, vals.max); b = Math.max(vals.min, vals.max); clipped = true; }
        else if (c.clip && c.chi > c.clo) { a = c.clo; b = c.chi; clipped = true; }
        else if (c.scale === 'row') {
          const own = railExtent(n, vals);
          a = Math.min(...own); b = Math.max(...own);
        }
        const rail = railMarks({ v: n, vals, a, b, x0: trackX, w: trackW, my, clipped, track: !!vals.domain, theme, dot: muted ? dimC : accent });
        out.push(...rail.out);
        const en = String(locale).startsWith('en');
        const tipText = railTip({ en, label: c.label, s, fr: fmtOf(c, r), vals, row: r, past: rail.past, scale: clipped ? [a, b] : null,
          labels: { band: c.bandLabel, median: c.medianLabel, min: c.minLabel, max: c.maxLabel, domain: c.domainLabel } });
        return { out, tip: tipText };
      }
      case 'sparkline': {
        const vals = Array.isArray(v) ? v.map(num).filter(Number.isFinite) : [];
        if (vals.length < 2) { put(vals.length ? c.fmt(vals[0]) : missingLabel ?? '—', { fill: theme.muted }); break; }
        const sw = Math.min(iw, 120), sh = Math.max(10, Math.min(18, h - 2 * padY - 2));
        const sx = c.align === 'right' ? x + w - P - sw : c.align === 'center' ? x + (w - sw) / 2 : ix;
        out.push(spark(sx, my, sw, sh, vals, muted));
        return { out, tip: `${c.label}: ${sparkTip(c, vals)}` };
      }
      case 'badge': {
        const color = c.badge.get(String(v));
        out.push(...pill(c.align === 'right' ? x + w - P : c.align === 'center' ? x + w / 2 : ix, my, s, color, iw, c.align));
        return { out, tip: measure(s, 12, 500) + 18 > iw ? s : null };
      }
      case 'check': {
        const yes = v === true || YES.test(String(v).trim());
        const cx = c.align === 'right' ? x + w - P - 5 : c.align === 'center' ? x + w / 2 : ix + 5;
        out.push(g({ role: 'img', 'aria-label': s }, [check(cx, my, yes)]));
        break;
      }
      case 'link': {
        const href = String(v).trim();
        const lines = wrap(s, iw, FS, 400, c.lines);
        const color = readable(accent, theme);
        const t = lines.map((l, k) => text(tx, by + k * LH, l, { fill: color, fontSize: FS, textAnchor: anchor, textDecoration: 'underline' })).join('');
        // Una dirección completa abre en otra pestaña; una ruta del sitio («/es/…»,
        // «./x», «#y») es un enlace propio y abre en la misma (como en un heatmap).
        out.push(SAFE_URL.test(href) ? el('a', { href, target: '_blank', rel: 'noopener noreferrer' }, t) : linkWrap(href, t));
        return { out, lines: lines.length, tip: lines.join(' ') !== s ? s : null };
      }
      case 'text': case 'date': default: {
        const lines = c.type === 'text' ? wrap(s, iw, FS, weight, c.lines) : [truncate(s, iw, FS, weight)];
        lines.forEach((l, k) => out.push(text(tx, by + k * LH, l, { fill: ink, fontSize: FS, fontWeight: weight, textAnchor: anchor })));
        return { out, lines: lines.length, tip: lines.join(' ').replace(/…$/, '') !== s ? s : null };
      }
    }
    return { out };
  }

  // Encabezado de grupo: banda tenue con el nombre y cuántas filas tiene.
  const groupCounts = new Map();
  if (groupF) for (const r of rows) groupCounts.set(String(r[groupF] ?? ''), (groupCounts.get(String(r[groupF] ?? '')) || 0) + 1);
  const groupH = Math.round(LH + 12 * density + 4);
  const groupRow = (name, top) => {
    const n = groupCounts.get(name) || 0;
    const lab = truncate(name || '—', area.w - 60, 12.5, 600);
    return g({ class: 'pa-tgroup', role: 'row' }, [
      el('rect', { x: tableX, y: top + 4, width: tableW, height: groupH - 6, rx: 6, fill: theme.tint }),
      text(area.x, top + 4 + (groupH - 6) / 2 + 4.3 * X, lab, { fill: ink, fontSize: 12.5, fontWeight: 600, role: 'rowheader' }),
      text(area.x + measure(lab, 12.5, 600) + 8, top + 4 + (groupH - 6) / 2 + 4.3 * X, String(n), { fill: theme.muted, fontSize: 12 }),
    ]);
  };

  const tableRows = [];
  let y = area.y;
  // En el navegador, render() pone una caja de búsqueda real sobre esta franja.
  if (spec._search) {
    body.push(el('rect', { class: 'pa-search-slot', x: area.x, y, width: Math.min(area.w, 300), height: Math.round(32 * Math.max(1, 0.6 + 0.4 * X)), fill: 'transparent' }));
    y += Math.round(32 * Math.max(1, 0.6 + 0.4 * X)) + 12;
  }
  const label = labelF !== undefined ? cols.find((c) => c.field === labelF) : null;
  const rowAttrs = (r, i) => ({ class: 'pa-tr' + (isHL(r) ? ' pa-tr-hl' : ''), role: 'row', 'aria-rowindex': (page - 1) * (pageSize === Infinity ? 0 : pageSize) + i + 2, 'data-row': r.__i });

  if (!cards) {
    // ── Encabezado ─────────────────────────────────────────────────────────
    const HLH = Math.round(HS * X * 1.3);
    const headLines = cols.map((c) => wrap(c.label, Math.max(10, c.w - 2 * P - (c.type === 'rank' ? 0 : 10)), HS, 600, 2));
    const nHead = Math.max(1, ...headLines.map((l) => l.length));
    const headH = nHead * HLH + Math.round(10 * Math.max(0.8, density)) + 4;
    const heads = cols.map((c, i) => {
      const lines = headLines[i];
      const sorted = st && st.col === c;
      // Barras y avances: el encabezado va sobre la cifra (alineada a la derecha), no sobre la pista.
      const overValue = (c.type === 'bar' || c.type === 'progress' || c.type === 'range') && c.align === 'right';
      const headW = Math.max(...lines.map((l) => measure(l, HS, 600)));
      const ax = overValue ? Math.min(c.x + c.w - P, c.x + P + Math.max(c.valueW, headW + (sorted ? 10 : 0))) : c.align === 'right' ? c.x + c.w - P : c.align === 'center' ? c.x + c.w / 2 : c.x + P;
      const anchor = c.align === 'right' ? 'end' : c.align === 'center' ? 'middle' : null;
      const y0 = y + headH - 9 - (lines.length - 1) * HLH;
      const parts = [el('rect', { class: 'pa-thbg', x: c.x, y, width: c.w, height: headH, fill: 'transparent' })];
      lines.forEach((l, k) => parts.push(text(ax, y0 + k * HLH, l, { fill: sorted ? ink : theme.lede, fontSize: HS, fontWeight: 600, textAnchor: anchor })));
      // Flecha de orden: llena en la columna ordenada; tenue al pasar en el navegador.
      const lw = measure(lines[lines.length - 1], HS, 600);
      const ly = y0 + (lines.length - 1) * HLH - HS * X * 0.36;
      const axx = c.align === 'right' ? ax - lw - 9 : c.align === 'center' ? ax + lw / 2 + 3 : ax + lw + 3;
      if (c.type !== 'rank' && c.sortable !== false) {
        const up = sorted ? st.dir === 'asc' : false;
        const d = up ? `M${axx},${ly + 2}L${axx + 3},${ly - 2}L${axx + 6},${ly + 2}Z` : `M${axx},${ly - 2}L${axx + 3},${ly + 2}L${axx + 6},${ly - 2}Z`;
        parts.push(el('path', { class: sorted ? 'pa-sort-on' : 'pa-sorthint', d, fill: sorted ? ink : theme.muted }));
      }
      const attrs = { class: 'pa-th', role: 'columnheader' };
      if (c.type !== 'rank' && c.sortable !== false && spec.sortable !== false) {
        attrs['data-sort'] = c.field;
        attrs['aria-sort'] = sorted ? (st.dir === 'asc' ? 'ascending' : 'descending') : 'none';
        attrs['data-num'] = ['number', 'bar', 'heat', 'delta', 'progress', 'range', 'sparkline', 'check'].includes(c.type) ? '1' : null;
      }
      return g(attrs, parts);
    });
    tableRows.push(g({ class: 'pa-thead', role: 'row', 'aria-rowindex': 1 }, heads));
    y += headH;
    tableRows.push(el('line', { x1: area.x, x2: area.x + area.w, y1: y - 0.5, y2: y - 0.5, stroke: theme.axis, strokeWidth: 1 }));

    // ── Filas ──────────────────────────────────────────────────────────────
    let lastGroup = null;
    if (!pageRows.length) {
      tableRows.push(text(area.x + area.w / 2, y + 30, query ? W.none : '—', { fill: theme.muted, fontSize: FS, textAnchor: 'middle' }));
      y += 48;
    }
    pageRows.forEach((r, i) => {
      if (groupF) {
        const gname = String(r[groupF] ?? '');
        if (gname !== lastGroup) { tableRows.push(groupRow(gname, y)); y += groupH; lastGroup = gname; }
      }
      const h0 = LH + 2 * padY;
      const made = cols.map((c) => cell(c, r, c.x, c.w, y, h0, { hl: isHL(r) }));
      const nLines = Math.max(1, ...made.map((m) => m.lines || 1));
      const h = h0 + (nLines - 1) * LH;
      // Celdas de calor: ocupan el alto real de la fila.
      const made2 = nLines > 1 ? cols.map((c, k) => (c.type === 'heat' ? cell(c, r, c.x, c.w, y, h, { hl: isHL(r) }) : made[k])) : made;
      const zebra = spec.striped && i % 2 === 1;
      const parts = [el('rect', { class: 'pa-trbg', x: tableX, y: y + 1, width: tableW, height: h - 2, rx: 6, fill: isHL(r) ? theme.tint : zebra ? theme.tint : 'transparent', fillOpacity: zebra && !isHL(r) ? 0.55 : null })];
      if (isHL(r)) parts.push(el('rect', { x: tableX, y: y + 5, width: 3, height: h - 10, rx: 1.5, fill: accent }));
      made2.forEach((m, k) => {
        const c = cols[k];
        parts.push(g({ role: c.isLabel ? 'rowheader' : 'cell', 'data-tip': m.tip ? tip(label ? String(r[labelF] ?? '') : '', m.tip) : null }, m.out));
      });
      tableRows.push(g(rowAttrs(r, i), parts));
      y += h;
      if (i < pageRows.length - 1 || hasTotal) tableRows.push(el('line', { x1: area.x, x2: area.x + area.w, y1: y - 0.5, y2: y - 0.5, stroke: theme.grid, strokeWidth: 1 }));
    });
    if (hasTotal) {
      const h = LH + 2 * padY + 2;
      tableRows.push(el('line', { x1: area.x, x2: area.x + area.w, y1: y + 0.5, y2: y + 0.5, stroke: theme.axis, strokeWidth: 1.25 }));
      const firstText = cols.find((c) => c.isLabel) || cols.find((c) => c.type === 'text') || cols[0];
      const made = cols.map((c) => (c === firstText ? cell({ ...c, isLabel: true }, {}, c.x, c.w, y + 2, h, { total: true }) : cell(c, {}, c.x, c.w, y + 2, h, { total: true })));
      tableRows.push(g({ class: 'pa-ttotal', role: 'row' }, made.map((m, k) => g({ role: cols[k] === firstText ? 'rowheader' : 'cell' }, m.out))));
      y += h + 2;
    }
  } else {
    // ── Tarjetas (pantallas angostas): una fila = un bloque ────────────────
    const labelCol = label || cols.find((c) => c.type === 'text') || null;
    const rankCol = cols.find((c) => c.type === 'rank');
    const mainCol = cols.find((c) => c.type === 'bar');
    const rest = cols.filter((c) => c !== labelCol && c !== rankCol && c !== mainCol);
    const KL = 12.5; // tamaño de las etiquetas
    const lineH = Math.round(Math.max(LH, pillH) + 6);
    const CP = 12;
    const keyW = Math.min(area.w * 0.46, Math.max(60, ...rest.map((c) => measure(c.label, KL) + 12)));
    if (!pageRows.length) { body.push(text(area.x + area.w / 2, y + 30, query ? W.none : '—', { fill: theme.muted, fontSize: FS, textAnchor: 'middle' })); y += 48; }
    let lastGroup = null;
    const cardOf = (r, i, total = false) => {
      const top = y;
      const parts = [];
      const hlr = !total && isHL(r);
      const muted = anyHL && !hlr && !total;
      let cy = top + CP;
      // Título: nombre de la fila (y el número de rango); a la derecha, la medida principal.
      const rankW = rankCol && !total ? measure(String(r.__rank), 12) + 8 : 0;
      const mainS = mainCol ? (total ? (totalOf(mainCol) !== null ? mainCol.fmt(totalOf(mainCol)) : '') : cellText(mainCol, r, locale, W)) : '';
      const mainW = mainS ? measure(mainS, 14, 600) + 12 : 0;
      const titleS = total ? totalLabel : labelCol ? cellText(labelCol, r, locale, W) || '—' : `#${r.__rank}`;
      const tl = wrap(titleS, area.w - rankW - mainW, 14, 600, 2);
      const TLH = Math.round(14 * X * 1.3);
      if (rankW) parts.push(text(area.x, cy + 14 * X * 0.92, String(r.__rank), { fill: theme.muted, fontSize: 12 }));
      tl.forEach((l, k) => parts.push(text(area.x + rankW, cy + 14 * X * 0.92 + k * TLH, l, { fill: ink, fontSize: 14, fontWeight: 600, role: k ? null : 'rowheader' })));
      if (mainS) parts.push(text(area.x + area.w, cy + 14 * X * 0.92, mainS, { fill: ink, fontSize: 14, fontWeight: 600, textAnchor: 'end' }));
      cy += tl.length * TLH;
      if (mainCol && !total) {
        const n = num(r[mainCol.field]);
        if (Number.isFinite(n)) {
          const span = mainCol.hi - mainCol.lo || 1;
          const z = area.x + (-mainCol.lo / span) * area.w;
          const len = (Math.abs(n) / span) * area.w;
          cy += 5;
          parts.push(el('rect', { x: area.x, y: cy, width: area.w, height: 5, rx: 2.5, fill: theme.tint }));
          if (len > 0.3) parts.push(el('rect', { x: n < 0 ? z - len : z, y: cy, width: Math.max(2, len), height: 5, rx: 2.5, fill: muted ? dimC : n < 0 ? negColor : accent }));
          cy += 5;
        }
      }
      cy += 6;
      for (const c of rest) {
        if (total && totalOf(c) === null) continue;
        const long = c.type === 'text' && !total && measure(cellText(c, r, locale, W), FS) > area.w - keyW;
        const rowTop = cy + (lineH - (LH + 2 * padY)) / 2;
        parts.push(text(area.x, baseline(rowTop), truncate(c.label, long ? area.w : keyW - 8, KL), { fill: theme.lede, fontSize: KL }));
        if (long) {
          const lines = wrap(cellText(c, r, locale, W), area.w, FS, 400, 4);
          lines.forEach((l, k) => parts.push(text(area.x, cy + lineH + LH * (k + 0.75), l, { fill: ink, fontSize: FS })));
          cy += lineH + lines.length * LH + 2;
          continue;
        }
        const cc = { ...c, align: 'right' };
        // Barras y avances: la cifra y una pista corta, pegadas a la derecha.
        const boxW = cc.type === 'progress' || cc.type === 'bar' || cc.type === 'range' ? Math.min(area.w - keyW, cc.valueW + 8 + (cc.type === 'range' ? 140 : 110)) : area.w - keyW;
        const vx = area.x + area.w - boxW - P, vw = boxW + 2 * P;
        const m = cell(cc, r, vx, vw, rowTop, LH + 2 * padY, { total, hl: hlr, chip: true });
        parts.push(g({ role: 'cell', 'data-tip': m.tip ? tip(titleS, m.tip) : null }, m.out));
        cy += lineH;
      }
      cy += CP - 4;
      const h = cy - top;
      const bg = el('rect', { class: 'pa-trbg', x: tableX, y: top + 2, width: tableW, height: h - 4, rx: 8, fill: hlr ? theme.tint : 'transparent' });
      const mark = hlr ? el('rect', { x: tableX, y: top + 8, width: 3, height: h - 16, rx: 1.5, fill: accent }) : '';
      y = cy;
      return g(total ? { class: 'pa-ttotal', role: 'row' } : rowAttrs(r, i), [bg, mark, ...parts]);
    };
    pageRows.forEach((r, i) => {
      if (groupF) {
        const gname = String(r[groupF] ?? '');
        if (gname !== lastGroup) { tableRows.push(groupRow(gname, y)); y += groupH; lastGroup = gname; }
      }
      tableRows.push(cardOf(r, i));
      if (i < pageRows.length - 1 || hasTotal) tableRows.push(el('line', { x1: area.x, x2: area.x + area.w, y1: y - 0.5, y2: y - 0.5, stroke: hasTotal && i === pageRows.length - 1 ? theme.axis : theme.grid, strokeWidth: hasTotal && i === pageRows.length - 1 ? 1.25 : 1 }));
    });
    if (hasTotal) tableRows.push(cardOf({}, -1, true));
  }

  const colCount = cols.length;
  body.push(g({ class: 'pa-table' + (cards ? ' pa-cards' : ''), role: 'table', 'aria-label': spec.title || W.table, 'aria-rowcount': nRows + 1, 'aria-colcount': colCount, style: 'font-variant-numeric:tabular-nums' }, tableRows));

  // ── Paginación: símbolos y cifras, sin palabras ─────────────────────────
  if (pages > 1) {
    y += 14;
    const B = Math.round(28 * Math.max(1, 0.55 + 0.45 * X));
    const cy = y + B / 2;
    const from = (page - 1) * pageSize + 1, to = Math.min(nRows, page * pageSize);
    const fmtI = makeFormat({ type: 'number', decimals: 0 }, locale, []);
    const rangeS = `${fmtI(from)}–${fmtI(to)} / ${fmtI(nRows)}`;
    const items = pagerItems(page, pages);
    const rangeW = measure(rangeS, 12);
    const btnW = (s) => Math.max(B, measure(s, 12.5, 600) + 14);
    const full = items.reduce((a, it) => a + (it === '…' ? 14 : btnW(fmtI(it)) + 2), 0) + 2 * (B + 2);
    const compact = full + rangeW + 16 > area.w;
    const parts = [];
    if (!compact || rangeW + 16 + 2 * B + measure(`${page} / ${pages}`, 12.5, 600) + 16 < area.w) {
      parts.push(text(area.x, cy + 4.2 * X, rangeS, { fill: theme.muted, fontSize: 12 }));
    }
    let x = area.x + area.w;
    const btn = (n, content, label, opts = {}) => {
      const w = opts.w ?? B;
      x -= w;
      const disabled = n === null;
      const attrs = disabled ? { class: 'pa-pg pa-pg-off', opacity: 0.32, 'aria-hidden': 'true' } : { class: 'pa-pg' + (opts.current ? ' pa-pg-on' : ''), 'data-page': n, 'data-arrow': opts.arrow, 'aria-label': label, 'aria-current': opts.current ? 'page' : null };
      const out = g(attrs, [el('rect', { class: 'pa-pgbg', x, y, width: w, height: B, rx: 7, fill: opts.current ? theme.tint2 : 'transparent' }), content(x, w)]);
      x -= 2;
      return out;
    };
    const chev = (dir) => (x0, w) => el('path', { d: dir < 0 ? `M${x0 + w / 2 + 2.5},${cy - 5}L${x0 + w / 2 - 2.5},${cy}L${x0 + w / 2 + 2.5},${cy + 5}` : `M${x0 + w / 2 - 2.5},${cy - 5}L${x0 + w / 2 + 2.5},${cy}L${x0 + w / 2 - 2.5},${cy + 5}`, fill: 'none', stroke: ink, strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' });
    const num0 = (s, cur) => (x0, w) => text(x0 + w / 2, cy + 4.3 * X, s, { fill: cur ? ink : theme.lede, fontSize: 12.5, fontWeight: cur ? 600 : 400, textAnchor: 'middle' });
    const out = [];
    out.push(btn(page < pages ? page + 1 : null, chev(1), `${W.next} (${W.page} ${page + 1})`, { arrow: 'next' }));
    if (compact) {
      const s = `${fmtI(page)} / ${fmtI(pages)}`;
      const w = measure(s, 12.5, 600) + 16;
      x -= w;
      out.push(text(x + w / 2, cy + 4.3 * X, s, { fill: ink, fontSize: 12.5, fontWeight: 600, textAnchor: 'middle' }));
      x -= 2;
    } else {
      for (const it of [...items].reverse()) {
        if (it === '…') { x -= 14; out.push(text(x + 7, cy + 4.3 * X, '…', { fill: theme.muted, fontSize: 12.5, textAnchor: 'middle' })); x -= 2; continue; }
        const s = fmtI(it);
        out.push(btn(it, num0(s, it === page), `${W.page} ${it}`, { current: it === page, w: btnW(s) }));
      }
    }
    out.push(btn(page > 1 ? page - 1 : null, chev(-1), `${W.prev} (${W.page} ${page - 1})`, { arrow: 'prev' }));
    parts.push(...out);
    body.push(g({ class: 'pa-pager', role: 'navigation', 'aria-label': `${W.page} ${page} ${W.of} ${pages}` }, parts));
    y += B;
  }
  if (spec.height === undefined) frame.setHeight(y + 12 + frame.chrome);

  // ── Texto alternativo ────────────────────────────────────────────────────
  const desc = describeTable({ lang, cols, rows, nRows, page, pages, st, label, query });
  const css = `.pa-live .pa-th[data-sort]{cursor:pointer}.pa-sorthint{opacity:0;transition:opacity .15s}.pa-live .pa-th[data-sort]:hover .pa-sorthint,.pa-live .pa-th[data-sort]:focus-visible .pa-sorthint{opacity:.7}`
    + `.pa-live .pa-th[data-sort]:hover .pa-thbg{fill:${theme.tint};fill-opacity:.6}.pa-tr .pa-trbg{transition:fill .12s}.pa-live .pa-tr:hover .pa-trbg{fill:${theme.tint}}`
    + `.pa-live .pa-pg{cursor:pointer}.pa-live .pa-pg:hover .pa-pgbg{fill:${theme.tint}}.pa-live .pa-pg-on:hover .pa-pgbg{fill:${theme.tint2}}`
    + `.pa-th:focus-visible,.pa-pg:focus-visible{outline:2px solid ${accent};outline-offset:-2px}@media (prefers-reduced-motion:reduce){.pa-sorthint,.pa-tr .pa-trbg{transition:none}}`;
  return frame.finish(body, { desc, type: 'table', role: 'figure', css });
}

/** Botones de página: 1 … 4 5 6 … 20 (como mucho 7 entradas). */
export function pagerItems(page, pages) {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  if (page <= 4) return [1, 2, 3, 4, 5, '…', pages];
  if (page >= pages - 3) return [1, '…', pages - 4, pages - 3, pages - 2, pages - 1, pages];
  return [1, '…', page - 1, page, page + 1, '…', pages];
}

function describeTable({ lang, cols, rows, nRows, page, pages, st, label, query }) {
  const T = {
    es: { t: 'Tabla de', and: 'y', r: 'filas', c: 'columnas', p: 'Página', of: 'de', s: 'Ordenada por', desc: 'de mayor a menor', asc: 'de menor a mayor', hi: 'Mayor', lo: 'menor', q: 'Filtrada por' },
    en: { t: 'Table with', and: 'and', r: 'rows', c: 'columns', p: 'Page', of: 'of', s: 'Sorted by', desc: 'high to low', asc: 'low to high', hi: 'Highest', lo: 'lowest', q: 'Filtered by' },
    pt: { t: 'Tabela com', and: 'e', r: 'linhas', c: 'colunas', p: 'Página', of: 'de', s: 'Ordenada por', desc: 'do maior para o menor', asc: 'do menor para o maior', hi: 'Maior', lo: 'menor', q: 'Filtrada por' },
    fr: { t: 'Tableau de', and: 'et', r: 'lignes', c: 'colonnes', p: 'Page', of: 'sur', s: 'Trié par', desc: 'décroissant', asc: 'croissant', hi: 'Maximum', lo: 'minimum', q: 'Filtré par' },
    de: { t: 'Tabelle mit', and: 'und', r: 'Zeilen', c: 'Spalten', p: 'Seite', of: 'von', s: 'Sortiert nach', desc: 'absteigend', asc: 'aufsteigend', hi: 'Höchster Wert', lo: 'niedrigster', q: 'Gefiltert nach' },
  }[lang];
  const names = cols.filter((c) => c.type !== 'rank').map((c) => c.label);
  let s = `${T.t} ${nRows} ${T.r} ${T.and} ${names.length} ${T.c}: ${names.join(', ')}.`;
  if (query) s += ` ${T.q} "${query}".`;
  if (pages > 1) s += ` ${T.p} ${page} ${T.of} ${pages}.`;
  if (st) s += ` ${T.s} ${st.col.label}, ${st.dir === 'desc' ? T.desc : T.asc}.`;
  // Una columna en unidades distintas por fila (`formatBy`) no tiene un «mayor».
  const m = cols.find((c) => c.type === 'bar' && !c.rowFmt) || cols.find((c) => ['number', 'heat'].includes(c.type) && !c.isLabel && c.kind === 'number' && !c.rowFmt);
  if (m && label && rows.length > 1) {
    let best = null, worst = null;
    for (const r of rows) { const v = num(r[m.field]); if (!Number.isFinite(v)) continue; if (!best || v > best[1]) best = [r, v]; if (!worst || v < worst[1]) worst = [r, v]; }
    if (best && worst && best[0] !== worst[0]) s += ` ${T.hi} ${m.label}: ${best[0][label.field]} (${m.fmt(best[1])}); ${T.lo}: ${worst[0][label.field]} (${m.fmt(worst[1])}).`;
  }
  return s;
}
