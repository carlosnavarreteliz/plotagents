// Carta Gantt: tareas como barras en un eje de tiempo, agrupadas por fase.
//
//   plot({ type: 'gantt', data, task: 'tarea', start: 'inicio', end: 'fin',
//          group: 'fase', progress: 'avance', dependsOn: 'depende', today: '2026-03-12' })
//
// Decisiones de diseño: el eje de tiempo va arriba (se lee como un
// calendario); cada fase abre con su nombre y una barra-resumen fina de su
// mismo color, así no hace falta leyenda; el avance se ve como la parte
// llena de la barra (lo pendiente queda en un tono claro del mismo color);
// los hitos son rombos con su fecha al lado; las dependencias, flechas
// finas en ángulo recto. Las fechas de término son inclusivas: una tarea
// del 3 al 5 de marzo dura 3 días.
//
// `collapsed: ["Fase 2"]` (o `true`) resume una fase en su cabecera; en el
// navegador un clic en la fila la abre o la cierra (data-group /
// data-collapsed). `critical: true` marca la ruta crítica y, en planes de
// hasta 120 días, los fines de semana van sombreados (`weekends: false`).
import { el, g, text, tip } from '../svg.js';
import { measure, truncate } from '../text.js';
import { makeFormat, parseDate, formatDate, formatNumber } from '../format.js';
import { timeTicks, niceStep, linear } from '../scale.js';
import { colorMap, ramp, textOn, readable } from '../theme.js';
import { ensureData, requireField, num, uniq, fieldsOf, fieldKind, PlotError } from '../data.js';
import { xLabels } from '../axes.js';
import { createFrame, hash } from '../frame.js';
import { dashedMatcher, hatcher, dashedAttrs, dashedDefaultLabel } from '../dashed.js';

const DAY = 864e5;
const T = (locale, es, en) => (String(locale || 'es').startsWith('en') ? en : es);
const TRUE = /^(true|1|s[ií]|yes|y|x|✓)$/i;
const truthy = (v) => v === true || v === 1 || (typeof v === 'string' && TRUE.test(v.trim()));
const isDay = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.trim());
const blank = (v) => v === undefined || v === null || v === '';

/** Lista de dependencias: "A", ["A", "B"] o "A, B". */
const depsOf = (v) => (blank(v) ? [] : Array.isArray(v) ? v.map(String) : String(v).split(/\s*[,;|]\s*/)).map((s) => s.trim()).filter(Boolean);

export function gantt(spec, theme) {
  const locale = spec.locale || 'es';
  const en = String(locale).startsWith('en');
  const data = ensureData(spec);
  if (!data.length) throw new PlotError(T(locale, 'La carta Gantt no tiene tareas.', 'The Gantt chart has no tasks.'), 'data: [{ task: "Diseño", start: "2026-03-02", end: "2026-03-20" }]');
  const fields = fieldsOf(data);
  const kind = Object.fromEntries(fields.map((f) => [f, fieldKind(data, f)]));
  const pick = (re, ok = () => true) => fields.find((f) => re.test(f) && ok(f));
  const timeLike = (f) => kind[f] === 'date' || kind[f] === 'number' || kind[f] === 'year';
  const taskF = spec.task ?? spec.label ?? (typeof spec.y === 'string' ? spec.y : null)
    ?? pick(/^(task|tarea|actividad|activity|item|nombre|name|hito|entregable|deliverable)/i, (f) => kind[f] === 'category')
    ?? fields.find((f) => kind[f] === 'category');
  const startF = spec.start ?? (typeof spec.x === 'string' ? spec.x : null) ?? pick(/^(start|inicio|desde|begin|comienzo|from)/i) ?? fields.find((f) => kind[f] === 'date');
  const durF = spec.duration ?? null;
  const endF = spec.end ?? spec.x2 ?? (durF ? null : pick(/^(end|fin|hasta|finish|termino|término|due|vence|to)$/i) ?? fields.find((f) => f !== startF && kind[f] === 'date'));
  const groupF = spec.group ?? spec.series ?? spec.hue ?? (typeof spec.color === 'string' && !spec.color.startsWith('#') ? spec.color : null)
    ?? pick(/^(phase|fase|group|grupo|stream|workstream|etapa|equipo|team|area|área|categoria|categoría)$/i, (f) => f !== taskF && kind[f] === 'category');
  const progF = spec.progress ?? pick(/^(progress|avance|progreso|complete|completado|done|pct)$/i);
  const depF = spec.dependsOn ?? spec.after ?? pick(/^(depends|dependson|depends_on|after|predecessor|predecesor|depende|despues|después)/i);
  const msF = spec.milestone ?? pick(/^(milestone|hito)$/i, (f) => f !== taskF);
  requireField(data, taskF, 'task');
  requireField(data, startF, 'start');
  if (endF) requireField(data, endF, 'end');
  if (durF) requireField(data, durF, 'duration');
  if (groupF) requireField(data, groupF, 'group');
  if (!startF) throw new PlotError(T(locale, 'La carta Gantt necesita una fecha de inicio por tarea.', 'The Gantt chart needs a start date per task.'), 'Indica `start` (y `end` o `duration`): start: "inicio", end: "fin"');

  const isTime = kind[startF] === 'date' || (endF && kind[endF] === 'date');
  const toT = (v) => (isTime ? parseDate(v) : num(v));
  // ── Tareas ──────────────────────────────────────────────────────────────
  const tasks = [];
  for (const [i, r] of data.entries()) {
    const name = String(r[taskF] ?? '').trim();
    const s = toT(r[startF]);
    if (!name || !Number.isFinite(s)) continue;
    let e;
    const rawEnd = endF ? r[endF] : undefined;
    if (durF && Number.isFinite(num(r[durF]))) e = s + num(r[durF]) * (isTime ? DAY : 1);
    else if (!blank(rawEnd)) e = toT(rawEnd) + (isTime && isDay(rawEnd) ? DAY : 0); // fin inclusivo
    const milestone = (msF && truthy(r[msF])) || blank(rawEnd) && !durF || (!durF && String(rawEnd).trim() === String(r[startF]).trim() && !isDay(rawEnd));
    if (!milestone && !Number.isFinite(e)) continue;
    let p = progF ? num(r[progF]) : NaN;
    if (Number.isFinite(p) && (p > 1 || String(r[progF]).includes('%'))) p /= 100;
    tasks.push({
      i, row: r, name, start: s, end: milestone ? s : Math.max(e, s), milestone,
      group: groupF ? String(r[groupF] ?? '') : null,
      progress: Number.isFinite(p) ? Math.max(0, Math.min(1, p)) : null,
      deps: depF ? depsOf(r[depF]) : [],
    });
  }
  if (!tasks.length) throw new PlotError(T(locale, 'Ninguna tarea tiene fechas válidas.', 'No task has valid dates.'), T(locale, 'Usa fechas como "2026-03-02" o números (semanas) en `start` y `end`.', 'Use dates like "2026-03-02" or numbers (weeks) in `start` and `end`.'));
  if (spec.sort === 'start') tasks.sort((a, b) => a.start - b.start || a.end - b.end);

  // ── Filas: fase (cabecera con barra-resumen) y sus tareas ───────────────
  // Las fases se pueden contraer (`collapsed`): la cabecera muestra entonces
  // una barra-resumen gruesa con el avance de la fase y sus hitos. El alto de
  // fila, la columna de nombres y el eje se calculan con TODAS las filas, así
  // nada salta al expandir o contraer en el navegador.
  const groups = groupF ? uniq(tasks.map((t) => t.group)) : [];
  const useHeaders = groups.length > 0 && spec.groupHeaders !== false;
  const collapsible = useHeaders && spec.collapsible !== false;
  const collapsedSet = new Set(!useHeaders ? [] : spec.collapsed === true ? groups
    : [].concat(spec.collapsed ?? []).filter((v) => v !== false && !blank(v)).map(String).filter((v) => groups.includes(v)));
  const cmap = colorMap(groups.length ? groups : ['__all'], theme, spec.colors);
  const colorOf = (t) => (groups.length ? cmap.get(t.group) : (spec.colors && spec.colors[t.name]) || theme.categorical[0]);
  const allRows = [], rows = [];
  if (useHeaders) {
    for (const gname of groups) {
      const ts = tasks.filter((t) => t.group === gname);
      const head = { type: 'group', name: gname, start: Math.min(...ts.map((t) => t.start)), end: Math.max(...ts.map((t) => t.end)), color: cmap.get(gname), tasks: ts, collapsed: collapsedSet.has(gname) };
      allRows.push(head); rows.push(head);
      for (const t of ts) { allRows.push({ type: 'task', t }); if (!head.collapsed) rows.push({ type: 'task', t }); }
    }
  } else for (const t of tasks) { allRows.push({ type: 'task', t }); rows.push({ type: 'task', t }); }
  const hiddenGroup = (t) => (t && useHeaders && collapsedSet.has(t.group) ? t.group : null);

  // ── Dominio ─────────────────────────────────────────────────────────────
  const todayV = spec.today === true ? (isTime ? Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()) : NaN) : blank(spec.today) || spec.today === false ? NaN : toT(spec.today);
  const refs = (spec.refLines || []).filter((r) => r && r.x !== undefined).map((r) => ({ ...r, t: toT(r.x) })).filter((r) => Number.isFinite(r.t));
  let t0 = Math.min(...tasks.map((t) => t.start)), t1 = Math.max(...tasks.map((t) => t.end));
  for (const v of [todayV, ...refs.map((r) => r.t)]) if (Number.isFinite(v)) { t0 = Math.min(t0, v); t1 = Math.max(t1, v); }
  if (Array.isArray(spec.xDomain)) { const [a, b] = spec.xDomain.map(toT); if (Number.isFinite(a)) t0 = a; if (Number.isFinite(b)) t1 = b; }
  if (t1 <= t0) t1 = t0 + (isTime ? 7 * DAY : 1);
  const padT = (t1 - t0) * 0.015;
  t0 -= padT; t1 += padT;
  // Fechas al día: la holgura de la ruta crítica se cuenta en días hábiles
  // y los fines de semana se sombrean si el plan es corto.
  const byDay = isTime && tasks.every((t) => isDay(t.row[startF]) && (t.milestone || !!durF || isDay(t.row[endF])));

  // ── Ruta crítica: pasada hacia atrás sobre dependsOn ────────────────────
  // Las fechas son fijas, así que la holgura total de una tarea es lo que
  // puede atrasarse sin mover el fin del proyecto: el mínimo entre su
  // distancia al fin y (brecha a cada sucesora + holgura de esa sucesora).
  // Holgura cero = ruta crítica.
  const critical = new Set(), critLinks = new Set();
  const workGap = (a, b) => {
    if (!byDay || b <= a) return isTime ? (b - a) / DAY : b - a;
    let k = 0;
    for (let d = a; d < b && k < 4000; d += DAY) { const w = new Date(d).getUTCDay(); if (w !== 0 && w !== 6) k++; }
    return k;
  };
  if (spec.critical) {
    const byName = new Map(tasks.map((t) => [t.name, t]));
    const succ = new Map();
    for (const t of tasks) for (const d of t.deps) if (byName.has(d)) { if (!succ.has(d)) succ.set(d, []); succ.get(d).push(t); }
    const finish = Math.max(...tasks.map((t) => t.end));
    const slack = new Map(), seen = new Set();
    const slackOf = (t) => {
      if (slack.has(t.name)) return slack.get(t.name);
      if (seen.has(t.name)) return Infinity; // ciclo: no hay ruta
      seen.add(t.name);
      let v = workGap(t.end, finish);
      for (const s of succ.get(t.name) || []) v = Math.min(v, workGap(t.end, s.start) + slackOf(s));
      seen.delete(t.name);
      slack.set(t.name, v);
      return v;
    };
    for (const t of tasks) if (slackOf(t) <= 1e-9) critical.add(t.name);
    for (const t of tasks) for (const d of t.deps) {
      const a = byName.get(d);
      if (a && critical.has(d) && critical.has(t.name) && workGap(a.end, t.start) + slackOf(t) <= 1e-9) critLinks.add(d + '\u0000' + t.name);
    }
  }
  const critColor = spec.criticalColor || theme.status?.critical || theme.categorical[1];

  // ── Marco ───────────────────────────────────────────────────────────────
  const gid = 'pa-gantt-' + Math.abs(hash(String(spec.title) + tasks.length)).toString(36);
  const H = hatcher(theme, gid);
  const dm = dashedMatcher(spec, data, taskF, groupF);
  const dashedLabel = spec.dashedLabel ?? dashedDefaultLabel(locale);
  const isDashed = (t) => !!dm && dm(t.name, t.group ?? undefined);
  const legend = [];
  if (groups.length && !useHeaders) for (const gname of groups) legend.push({ label: gname, color: cmap.get(gname), shape: 'square' });
  if (tasks.some(isDashed) && spec.legend !== false && dashedLabel) legend.push({ label: dashedLabel, color: theme.muted, fill: H.fill(theme.muted), stroke: H.stroke(theme.muted), shape: 'square', dashed: true, key: 'dashed' });
  if (critical.size && spec.legend !== false) legend.push({ label: T(locale, 'Ruta crítica', 'Critical path'), color: critColor, shape: 'line', key: 'critical' });
  const n = allRows.length;
  const rowH0 = spec.rowHeight ?? (n > 36 ? 20 : n > 22 ? 24 : 30);
  const frame = createFrame(spec, theme, { height: 200 + n * rowH0 });
  const area = frame.layout(legend);
  const axisH = 26;
  let rowH = rowH0;
  if (spec.height !== undefined) rowH = Math.max(14, (area.h - axisH - 6) / Math.max(1, n));
  const rowHeight = (r) => (r.type === 'group' ? rowH * (spec.groupHeaders === 'compact' ? 0.8 : 1.02) : rowH);
  const plotH = rows.reduce((a, r) => a + rowHeight(r), 0);
  if (spec.height === undefined) frame.setHeight(area.y + axisH + plotH + 8 + frame.chrome);
  const fs = rowH < 22 ? 11 : 12.5;
  // Columna de nombres: un margen para el triángulo de las fases y las
  // tareas alineadas con el nombre de su fase.
  const GUT = collapsible ? 14 : 0;
  const IND = useHeaders ? (collapsible ? GUT : 12) : 0;
  // (SVG descarta el espacio inicial de un texto: el hueco va en la posición.)
  const countText = (r) => `· ${r.tasks.length}`;
  const countW = (r) => measure(countText(r), fs) + 5;
  const labelW = Math.min(area.w * (area.w < 480 ? 0.42 : 0.34), Math.max(...allRows.map((r) => (r.type === 'group' ? GUT + measure(r.name, fs, 600) + countW(r) : measure(r.t.name, fs) + IND)))) + 16;
  const inner = { x: area.x + labelW, y: area.y + axisH, w: area.w - labelW, h: plotH };
  const x = linear(t0, t1, inner.x, inner.x + inner.w);

  // ── Eje de tiempo (arriba) y grilla ─────────────────────────────────────
  const fmtDay = (ms, withYear = true) => (isTime ? formatDate(ms, 'day', locale, withYear) : formatNumber(ms, Number.isInteger(ms) ? 0 : 1, locale, true));
  const body = [];
  const grid = [];
  // Fines de semana: bandas tenues detrás de la grilla en planes cortos.
  if (byDay && spec.weekends !== false && t1 - t0 <= 121 * DAY && inner.w / ((t1 - t0) / DAY) >= 3) {
    const wk = [];
    let d = Math.floor(t0 / DAY) * DAY;
    while (new Date(d).getUTCDay() !== 6) d += DAY;
    for (; d < t1; d += 7 * DAY) {
      const a = Math.max(inner.x, x(d)), b = Math.min(inner.x + inner.w, x(d + 2 * DAY));
      if (b - a > 0.5) wk.push(el('rect', { x: +a.toFixed(2), y: inner.y, width: +(b - a).toFixed(2), height: inner.h, fill: theme.tint, opacity: theme.mode === 'dark' ? 0.55 : 0.42 }));
    }
    if (wk.length) body.push(g({ class: 'pa-weekends' }, wk));
  }
  // Las etiquetas del eje que chocarían con la de "Hoy" se omiten.
  const pills = [];
  const pillLabel = (v, label) => { const px = x(v), lw = measure(label, 11, 600) + 10; const lx = Math.min(Math.max(px - lw / 2, inner.x), inner.x + inner.w - lw); pills.push([lx - 6, lx + lw + 6]); return { px, lw, lx }; };
  const todayLabel = Number.isFinite(todayV) ? `${T(locale, 'Hoy', 'Today')} · ${fmtDay(todayV, false)}` : null;
  if (todayLabel) pillLabel(todayV, todayLabel);
  for (const r of refs) pillLabel(r.t, r.label || fmtDay(r.t, false));
  const freeOf = (items) => items.filter((tk) => { const w = measure(tk.label, theme.type?.axis ?? 11.5) / 2; return !pills.some(([a, b]) => tk.pos + w > a && tk.pos - w < b); });
  const timeItems = (count) => timeTicks(t0, t1, count, locale).ticks.map((tk) => ({ pos: x(tk.value), label: tk.label, v: tk.value }));
  let tickItems;
  if (isTime) {
    const c0 = Math.max(2, Math.floor(inner.w / 58));
    tickItems = timeItems(c0);
    // En gráficos angostos la etiqueta de "Hoy" puede tapar todas las marcas:
    // se prueba con un paso más fino hasta que queden al menos dos.
    for (let c = c0 + 1; c <= c0 + 4 && freeOf(tickItems).length < 2; c++) { const more = timeItems(c); if (freeOf(more).length >= 2) tickItems = more; }
  } else {
    let st = niceStep(t1 - t0, Math.max(2, Math.floor(inner.w / 70)));
    // Semanas, días o meses enteros: marcas enteras.
    if (tasks.every((t) => Number.isInteger(t.start) && Number.isInteger(t.end))) st = Math.max(1, Math.round(st));
    const fmtN = makeFormat(spec.format, locale, [t0, t1]);
    tickItems = [];
    for (let v = Math.ceil(t0 / st) * st; v <= t1 + 1e-9; v += st) tickItems.push({ pos: x(v), label: fmtN(+v.toPrecision(12)), v });
  }
  for (const tk of tickItems) {
    const px = Math.round(tk.pos) + 0.5;
    grid.push(el('line', { x1: px, x2: px, y1: inner.y - 4, y2: inner.y + inner.h, stroke: theme.grid, strokeWidth: 1, shapeRendering: 'crispEdges' }));
  }
  body.push(g({ class: 'pa-grid' }, grid));
  const freeTicks = freeOf(tickItems);
  body.push(g({ class: 'pa-axis pa-axis-x' }, [xLabels(freeTicks, inner, theme, { y: area.y + 13 })]));
  if (spec.xLabel) body.push(text(inner.x + inner.w, area.y - 2, spec.xLabel, { fill: theme.muted, fontSize: 11, textAnchor: 'end' }));
  body.push(el('line', { x1: inner.x, x2: inner.x + inner.w, y1: Math.round(inner.y - 4) + 0.5, y2: Math.round(inner.y - 4) + 0.5, stroke: theme.axis, strokeWidth: 1, shapeRendering: 'crispEdges' }));

  // ── Filas ──────────────────────────────────────────────────────────────
  const fmtEnd = (t) => fmtDay(isTime && !t.milestone && isDay(t.row[endF]) ? t.end - DAY : t.end);
  const lenOf = (t) => (isTime ? Math.round((t.end - t.start) / DAY) : +(t.end - t.start).toPrecision(6));
  const lenText = (t) => (isTime ? `${lenOf(t)} ${T(locale, lenOf(t) === 1 ? 'día' : 'días', lenOf(t) === 1 ? 'day' : 'days')}` : `${formatNumber(lenOf(t), Number.isInteger(lenOf(t)) ? 0 : 1, locale, true)}${spec.unit ? ' ' + spec.unit : ''}`);
  const pct = (p) => `${formatNumber(p * 100, 0, locale)}%`;
  /** Avance ponderado por duración (null si ninguna tarea lo informa). */
  const progressOf = (ts) => {
    const w = ts.filter((t) => t.progress !== null && !t.milestone);
    return w.length ? w.reduce((a, t) => a + t.progress * lenOf(t), 0) / (w.reduce((a, t) => a + lenOf(t), 0) || 1) : null;
  };
  const hl = spec.highlight === undefined ? null : new Set([].concat(spec.highlight).map(String));
  const dim = (t) => hl && !hl.has(t.name) && !hl.has(String(t.group));
  const pos = new Map(); // tarea (o fase contraída) → geometría, para las dependencias
  // Vínculos a dibujar. Una tarea de una fase contraída se dibuja en la
  // barra-resumen de su fase; los vínculos dentro de una misma fase contraída
  // se omiten y los repetidos van una sola vez (crítico si alguno lo es).
  const taskBy = new Map(tasks.map((t) => [t.name, t]));
  const keyOf = (name) => { const gname = hiddenGroup(taskBy.get(name)); return gname === null ? name : '\u0001' + gname; };
  const edges = new Map();
  for (const t of tasks) for (const d of t.deps) {
    if (!taskBy.has(d)) continue;
    const ka = keyOf(d), kb = keyOf(t.name);
    if (ka === kb) continue;
    const k = ka + '\u0000' + kb, crit = critLinks.has(d + '\u0000' + t.name);
    if (!edges.has(k)) edges.set(k, { ka, kb, crit });
    else if (crit) edges.get(k).crit = true;
  }
  const hasOut = new Set([...edges.values()].map((e) => e.ka));
  const labels = [], marks = [], headers = [];

  /**
   * Barra con su avance: lo pendiente en un tono claro, lo hecho lleno, y el
   * porcentaje dentro de lo hecho si cabe (si no, a la derecha). `avoid` son
   * tramos [x0, x1] donde no debe ir el texto (rombos de hitos).
   */
  const barParts = ({ xa, xb, by, bh, rx, cy, color, progress, dashed, clipId, avoid = [], out = false }) => {
    const w = xb - xa;
    const parts = [];
    if (dashed) parts.push(el('rect', { x: xa + 0.6, y: by + 0.6, width: Math.max(1, w - 1.2), height: bh - 1.2, rx, ...dashedAttrs(H, color) }));
    else if (progress !== null) {
      const light = ramp([theme.surface, color], theme.mode === 'dark' ? 0.38 : 0.26);
      parts.push(el('rect', { x: xa, y: by, width: w, height: bh, rx, fill: light }));
      if (progress > 0) {
        const pw = Math.max(rx * 2, w * progress);
        parts.push(el('clipPath', { id: clipId }, el('rect', { x: xa, y: by, width: w, height: bh, rx })));
        parts.push(el('rect', { x: xa, y: by, width: Math.min(w, pw), height: bh, fill: color, 'clip-path': `url(#${clipId})` }));
      }
    } else parts.push(el('rect', { x: xa, y: by, width: w, height: bh, rx, fill: color }));
    if (progress !== null && spec.labels !== false) {
      const s = pct(progress);
      const sw = measure(s, 11, 600);
      const pw = w * progress;
      const free = (a, b) => !avoid.some(([p, q]) => b > p - 3 && a < q + 3);
      const right = Math.max(xb, ...avoid.map(([, q]) => q).filter((q) => q > xb - 1)) + (out ? 12 : 6); // tras la flecha que sale
      if (!dashed && pw >= sw + 10 && free(xa + pw - 5 - sw, xa + pw - 5)) parts.push(text(xa + pw - 5, cy + 3.8, s, { fill: textOn(color, theme), fontSize: 11, fontWeight: 600, textAnchor: 'end' }));
      else if (right + sw < inner.x + inner.w) parts.push(text(right, cy + 3.8, s, { fill: theme.lede, fontSize: 11, fontWeight: 600 }));
    }
    return parts;
  };
  const diamond = (px, cy, s) => `M${+px.toFixed(2)},${+(cy - s).toFixed(2)}l${s},${s}l${-s},${s}l${-s},${-s}Z`;
  const fullW = inner.x + inner.w - area.x;

  let y = inner.y;
  for (const [ri, r] of rows.entries()) {
    const h = rowHeight(r);
    const cy = y + h / 2;
    if (r.type === 'group') {
      const ink = readable(r.color, theme, 4.5);
      const ts = r.tasks;
      const nWork = ts.filter((t) => !t.milestone).length, nMs = ts.length - nWork;
      const prog = progressOf(ts);
      const xa = x(r.start), xb = Math.max(xa + 3, x(r.end));
      const isCrit = ts.some((t) => critical.has(t.name));
      const parts = [];
      // Fila completa clicable (nombre + barras) para expandir o contraer.
      if (collapsible) parts.push(el('rect', { class: 'pa-hit', x: area.x - 4, y: +y.toFixed(2), width: +(fullW + 4).toFixed(2), height: +h.toFixed(2), fill: 'transparent' }));
      if (collapsible) {
        const cx = area.x + 4;
        parts.push(el('path', { class: 'pa-chev', d: r.collapsed ? `M${cx - 2},${cy - 4.5}l5,4.5l-5,4.5Z` : `M${cx - 4.5},${cy - 2.5}l9,0l-4.5,5Z`, fill: theme.muted }));
      }
      const cw = countW(r);
      const nameS = truncate(r.name, labelW - 10 - GUT - cw, fs, 600);
      const lx = area.x + GUT;
      parts.push(text(lx, cy + fs * 0.36, nameS, { fill: ink, fontSize: fs, fontWeight: 600 }));
      parts.push(text(lx + measure(nameS, fs, 600) + 5, cy + fs * 0.36, countText(r), { fill: theme.muted, fontSize: fs }));
      const sum = [];
      let geo;
      if (r.collapsed) {
        // Fase contraída: barra del alto de una tarea con el avance de la fase,
        // las puntas de corchete de la barra-resumen y sus hitos como rombos.
        const bh = Math.max(6, Math.round(h * 0.6)), by = cy - bh / 2;
        const rx = Math.min(2, bh / 2);
        const s = Math.min(5.5, bh * 0.42);
        const msX = ts.filter((t) => t.milestone).map((t) => x(t.start));
        sum.push(...barParts({ xa, xb, by, bh, rx, cy, color: r.color, progress: prog, dashed: ts.every(isDashed), clipId: `${gid}-g${ri}`, avoid: msX.map((p) => [p - s, p + s]), out: hasOut.has('\u0001' + r.name) }));
        sum.push(el('path', { d: `M${xa},${by + bh - 0.5}v4.5l4.5,-4.5zM${xb},${by + bh - 0.5}v4.5l-4.5,-4.5z`, fill: r.color }));
        if (isCrit) sum.push(el('rect', { x: xa - 1, y: by - 1, width: xb - xa + 2, height: bh + 2, rx: rx + 1, fill: 'none', stroke: critColor, strokeWidth: 1.5 }));
        for (const px of msX) sum.push(el('path', { d: diamond(px, cy, s), fill: ink, stroke: theme.surface, strokeWidth: 1.25 }));
        geo = { x0: xa, x1: xb, cy, h: bh };
      } else {
        sum.push(el('rect', { x: xa, y: cy - 1.5, width: Math.max(2, xb - xa), height: 3, rx: 1.5, fill: r.color }),
          el('path', { d: `M${xa},${cy - 1.5}v6l4,-6zM${xb},${cy - 1.5}v6l-4,-6z`, fill: r.color }));
      }
      const span = isTime ? Math.round((r.end - r.start) / DAY) : r.end - r.start;
      const range = `${fmtDay(r.start)} – ${fmtDay(isTime && ts.every((t) => t.milestone || isDay(t.row[endF])) ? r.end - DAY : r.end)}${isTime ? ' · ' + span + ' ' + T(locale, 'días', 'days') : ''}`;
      const counts = [`${nWork} ${T(locale, nWork === 1 ? 'tarea' : 'tareas', nWork === 1 ? 'task' : 'tasks')}`,
        nMs ? `${nMs} ${T(locale, nMs === 1 ? 'hito' : 'hitos', nMs === 1 ? 'milestone' : 'milestones')}` : null,
        prog !== null ? pct(prog) : null].filter(Boolean).join(' · ');
      const hint = collapsible ? (r.collapsed ? T(locale, 'Clic para expandir', 'Click to expand') : T(locale, 'Clic para contraer', 'Click to collapse')) : null;
      parts.push(g({ class: 'pa-m', opacity: hl && !hl.has(r.name) ? 0.35 : null, 'data-color': r.color }, sum));
      headers.push(g({ class: 'pa-gh', 'data-group': r.name, 'data-collapsed': r.collapsed ? 'true' : 'false', 'data-tip': tip(r.name, range, counts, hint) }, parts));
      if (geo) pos.set('\u0001' + r.name, geo);
      y += h;
      continue;
    }
    const t = r.t;
    const color = colorOf(t);
    const dashedT = isDashed(t);
    const crit = critical.has(t.name);
    const opacity = dim(t) ? 0.32 : null;
    labels.push(text(area.x + IND, cy + fs * 0.36, truncate(t.name, labelW - IND - 12, fs), { fill: dim(t) ? theme.muted : theme.ink, fontSize: fs, opacity: dim(t) ? 0.8 : null }));
    const tipLines = [t.name, t.milestone ? fmtDay(t.start) : `${fmtDay(t.start)} – ${fmtEnd(t)} · ${lenText(t)}`, t.group, t.progress !== null ? `${T(locale, 'Avance', 'Progress')}: ${pct(t.progress)}` : null,
      t.deps.length ? `${T(locale, 'Después de', 'After')}: ${t.deps.join(', ')}` : null, dashedT ? (dashedLabel || null) : null, crit ? T(locale, 'Ruta crítica', 'Critical path') : null];
    if (t.milestone) {
      const px = x(t.start), s = Math.min(9, h * 0.36);
      const fill = groups.length ? color : theme.ink;
      const parts = [el('path', { d: `M${px},${cy - s}L${px + s},${cy}L${px},${cy + s}L${px - s},${cy}Z`, ...(dashedT ? dashedAttrs(H, fill, { width: 1.2 }) : { fill, stroke: crit ? critColor : theme.surface, strokeWidth: crit ? 2 : 1.5 }) })];
      const lab = fmtDay(t.start, false);
      // Si de este hito sale una flecha, la fecha va a la izquierda para no cruzarla
      // (las que llegan lo hacen por arriba).
      const hasNext = hasOut.has(t.name);
      if (hasNext && px - s - 6 - measure(lab, 11) > inner.x) parts.push(text(px - s - 5, cy + 4, lab, { fill: theme.lede, fontSize: 11, textAnchor: 'end' }));
      else if (px + s + 6 + measure(lab, 11) < inner.x + inner.w) parts.push(text(px + s + 5, cy + 4, lab, { fill: theme.lede, fontSize: 11 }));
      else parts.push(text(px - s - 5, cy + 4, lab, { fill: theme.lede, fontSize: 11, textAnchor: 'end' }));
      marks.push(g({ class: 'pa-m', opacity, 'data-task': t.name, 'data-color': color, 'data-tip': tip(...tipLines) }, parts));
      pos.set(t.name, { x0: px - s, x1: px + s, cy, h: s * 2, ms: true, px });
    } else {
      const xa = x(t.start), xb = Math.max(xa + 3, x(t.end));
      const bh = Math.max(6, Math.round(h * 0.6));
      const by = cy - bh / 2, w = xb - xa, rx = Math.min(theme.marks?.barRadius ?? 4, bh / 2, w / 2);
      const parts = barParts({ xa, xb, by, bh, rx, cy, color, progress: t.progress, dashed: dashedT, clipId: `${gid}-c${t.i}`, out: hasOut.has(t.name) });
      if (crit) parts.push(el('rect', { x: xa - 1, y: by - 1, width: w + 2, height: bh + 2, rx: rx + 1, fill: 'none', stroke: critColor, strokeWidth: 1.5 }));
      marks.push(g({ class: 'pa-m', opacity, 'data-task': t.name, 'data-color': color, 'data-tip': tip(...tipLines) }, parts));
      pos.set(t.name, { x0: xa, x1: xb, cy, h: bh });
    }
    y += h;
  }

  // ── Dependencias: flechas en ángulo recto, por detrás de las barras ─────
  // Salen del fin de la predecesora, bajan junto a ella y entran por la
  // izquierda de la sucesora (a un hito, por arriba). Si la sucesora empieza
  // antes, rodean por el borde de la fila.
  const links = [], critOut = [];
  const arrowId = `${gid}-arrow`, critArrowId = `${gid}-arrow-c`;
  for (const { ka, kb, crit } of edges.values()) {
    const a = pos.get(ka), b = pos.get(kb);
    if (!a || !b) continue;
    const xs = a.x1, ys = a.cy, ye = b.cy;
    const dir = ye >= ys ? 1 : -1;
    const f = (v) => +v.toFixed(1);
    let dpath;
    if (b.ms) {
      const tipY = ye - dir * (b.h / 2 + 1.5);
      if (b.px - xs >= 6) dpath = `M${f(xs)},${f(ys)}H${f(b.px)}V${f(tipY)}`;
      else dpath = `M${f(xs)},${f(ys)}h6V${f(ys + dir * rowH / 2)}H${f(b.px)}V${f(tipY)}`;
    } else {
      const xe = b.x0 - 1.5;
      if (xe - xs >= 14) dpath = `M${f(xs)},${f(ys)}h6V${f(ye)}H${f(xe)}`;
      else dpath = `M${f(xs)},${f(ys)}h6V${f(ys + dir * rowH / 2)}H${f(xe - 8)}V${f(ye)}H${f(xe)}`;
    }
    (crit ? critOut : links).push(el('path', { d: dpath, fill: 'none', stroke: crit ? critColor : theme.muted, strokeWidth: crit ? 1.5 : 1, strokeLinejoin: 'round', opacity: crit ? null : 0.85, markerEnd: `url(#${crit ? critArrowId : arrowId})` }));
  }

  // ── Hoy y líneas de referencia ──────────────────────────────────────────
  const refsOut = [];
  const vline = (v, label, color) => {
    const px = Math.round(x(v)) + 0.5;
    refsOut.push(el('line', { x1: px, x2: px, y1: inner.y - 4, y2: inner.y + inner.h, stroke: color, strokeWidth: 1.5 }));
    const lw = measure(label, 11, 600) + 10;
    const lx = Math.min(Math.max(px - lw / 2, inner.x), inner.x + inner.w - lw);
    refsOut.push(el('rect', { x: lx, y: inner.y - 13, width: lw, height: 17, rx: 8.5, fill: color }));
    refsOut.push(text(lx + lw / 2, inner.y - 1.5, label, { fill: textOn(color, theme), fontSize: 11, fontWeight: 600, textAnchor: 'middle' }));
  };
  if (todayLabel) vline(todayV, todayLabel, spec.todayColor || theme.categorical[1]);
  for (const r of refs) vline(r.t, r.label || fmtDay(r.t, false), r.color || theme.ink);

  body.push(g({ class: 'pa-labels' }, labels));
  body.push(g({ class: 'pa-links' }, [...links, ...critOut]));
  body.push(g({ class: 'pa-marks' }, [...headers, ...marks]));
  body.push(g({ class: 'pa-refs' }, refsOut));

  // ── Descripción ─────────────────────────────────────────────────────────
  const work = tasks.filter((t) => !t.milestone);
  const longest = work.length ? work.reduce((a, b) => (lenOf(b) > lenOf(a) ? b : a)) : null;
  const first = Math.min(...tasks.map((t) => t.start)), last = Math.max(...tasks.map((t) => t.end));
  const lastT = tasks.find((t) => t.end === last);
  const ms = tasks.filter((t) => t.milestone);
  let desc = en
    ? `Gantt chart of ${tasks.length} tasks${groups.length ? ` in ${groups.length} phases` : ''}, from ${fmtDay(first)} to ${lastT ? fmtEnd(lastT) : fmtDay(last)}.`
    : `Carta Gantt de ${tasks.length} tareas${groups.length ? ` en ${groups.length} fases` : ''}, del ${fmtDay(first)} al ${lastT ? fmtEnd(lastT) : fmtDay(last)}.`;
  if (collapsedSet.size) {
    const list = groups.filter((gname) => collapsedSet.has(gname)).map((gname) => `${gname} (${tasks.filter((t) => t.group === gname).length})`).join(', ');
    desc += collapsedSet.size === groups.length
      ? T(locale, ` Todas las fases contraídas: ${list}.`, ` All phases collapsed: ${list}.`)
      : T(locale, ` ${collapsedSet.size === 1 ? 'Fase contraída' : 'Fases contraídas'}: ${list}.`, ` ${collapsedSet.size === 1 ? 'Collapsed phase' : 'Collapsed phases'}: ${list}.`);
  }
  if (longest) desc += en ? ` Longest: ${longest.name} (${lenText(longest)}).` : ` Más larga: ${longest.name} (${lenText(longest)}).`;
  if (ms.length) desc += en ? ` Milestones: ${ms.slice(0, 4).map((t) => `${t.name} (${fmtDay(t.start, false)})`).join(', ')}.` : ` Hitos: ${ms.slice(0, 4).map((t) => `${t.name} (${fmtDay(t.start, false)})`).join(', ')}.`;
  if (critical.size) {
    const chain = [...tasks].filter((t) => critical.has(t.name)).sort((a, b) => a.start - b.start || a.end - b.end).map((t) => t.name);
    desc += T(locale, ` Ruta crítica: ${chain.join(' → ')}.`, ` Critical path: ${chain.join(' → ')}.`);
  }
  const avg = progressOf(tasks);
  if (avg !== null) desc += en ? ` Overall progress: ${pct(avg)}.` : ` Avance total: ${pct(avg)}.`;
  const arrow = (id, fill) => el('marker', { id, viewBox: '0 0 8 8', refX: 7, refY: 4, markerWidth: 7, markerHeight: 7, orient: 'auto' }, el('path', { d: 'M0,0.8L7,4L0,7.2Z', fill }));
  const defs = arrow(arrowId, theme.muted) + (critOut.length ? arrow(critArrowId, critColor) : '') + H.defs();
  return frame.finish(body, { desc, type: 'gantt', defs });
}
