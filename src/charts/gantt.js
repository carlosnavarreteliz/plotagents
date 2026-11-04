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
  const groups = groupF ? uniq(tasks.map((t) => t.group)) : [];
  const useHeaders = groups.length > 0 && spec.groupHeaders !== false;
  const cmap = colorMap(groups.length ? groups : ['__all'], theme, spec.colors);
  const colorOf = (t) => (groups.length ? cmap.get(t.group) : (spec.colors && spec.colors[t.name]) || theme.categorical[0]);
  const rows = [];
  if (useHeaders) {
    for (const gname of groups) {
      const ts = tasks.filter((t) => t.group === gname);
      rows.push({ type: 'group', name: gname, start: Math.min(...ts.map((t) => t.start)), end: Math.max(...ts.map((t) => t.end)), color: cmap.get(gname), tasks: ts });
      for (const t of ts) rows.push({ type: 'task', t });
    }
  } else for (const t of tasks) rows.push({ type: 'task', t });

  // ── Dominio ─────────────────────────────────────────────────────────────
  const todayV = spec.today === true ? (isTime ? Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()) : NaN) : blank(spec.today) || spec.today === false ? NaN : toT(spec.today);
  const refs = (spec.refLines || []).filter((r) => r && r.x !== undefined).map((r) => ({ ...r, t: toT(r.x) })).filter((r) => Number.isFinite(r.t));
  let t0 = Math.min(...tasks.map((t) => t.start)), t1 = Math.max(...tasks.map((t) => t.end));
  for (const v of [todayV, ...refs.map((r) => r.t)]) if (Number.isFinite(v)) { t0 = Math.min(t0, v); t1 = Math.max(t1, v); }
  if (Array.isArray(spec.xDomain)) { const [a, b] = spec.xDomain.map(toT); if (Number.isFinite(a)) t0 = a; if (Number.isFinite(b)) t1 = b; }
  if (t1 <= t0) t1 = t0 + (isTime ? 7 * DAY : 1);
  const padT = (t1 - t0) * 0.015;
  t0 -= padT; t1 += padT;

  // ── Marco ───────────────────────────────────────────────────────────────
  const gid = 'pa-gantt-' + Math.abs(hash(String(spec.title) + tasks.length)).toString(36);
  const H = hatcher(theme, gid);
  const dm = dashedMatcher(spec, data, taskF, groupF);
  const dashedLabel = spec.dashedLabel ?? dashedDefaultLabel(locale);
  const isDashed = (t) => !!dm && dm(t.name, t.group ?? undefined);
  const legend = [];
  if (groups.length && !useHeaders) for (const gname of groups) legend.push({ label: gname, color: cmap.get(gname), shape: 'square' });
  if (tasks.some(isDashed) && spec.legend !== false && dashedLabel) legend.push({ label: dashedLabel, color: theme.muted, fill: H.fill(theme.muted), stroke: H.stroke(theme.muted), shape: 'square', dashed: true, key: 'dashed' });
  const n = rows.length;
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
  const labelW = Math.min(area.w * (area.w < 480 ? 0.42 : 0.34), Math.max(...rows.map((r) => (r.type === 'group' ? measure(r.name, fs, 600) : measure(r.t.name, fs) + (useHeaders ? 12 : 0))))) + 16;
  const inner = { x: area.x + labelW, y: area.y + axisH, w: area.w - labelW, h: plotH };
  const x = linear(t0, t1, inner.x, inner.x + inner.w);

  // ── Eje de tiempo (arriba) y grilla ─────────────────────────────────────
  const fmtDay = (ms, withYear = true) => (isTime ? formatDate(ms, 'day', locale, withYear) : formatNumber(ms, Number.isInteger(ms) ? 0 : 1, locale, true));
  const body = [];
  const grid = [];
  let tickItems;
  if (isTime) {
    const { ticks } = timeTicks(t0, t1, Math.max(2, Math.floor(inner.w / 58)), locale);
    tickItems = ticks.map((tk) => ({ pos: x(tk.value), label: tk.label, v: tk.value }));
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
  // Las etiquetas del eje que chocarían con la de "Hoy" se omiten.
  const pills = [];
  const pillLabel = (v, label) => { const px = x(v), lw = measure(label, 11, 600) + 10; const lx = Math.min(Math.max(px - lw / 2, inner.x), inner.x + inner.w - lw); pills.push([lx - 6, lx + lw + 6]); return { px, lw, lx }; };
  const todayLabel = Number.isFinite(todayV) ? `${T(locale, 'Hoy', 'Today')} · ${fmtDay(todayV, false)}` : null;
  if (todayLabel) pillLabel(todayV, todayLabel);
  for (const r of refs) pillLabel(r.t, r.label || fmtDay(r.t, false));
  const freeTicks = tickItems.filter((tk) => { const w = measure(tk.label, theme.type?.axis ?? 11.5) / 2; return !pills.some(([a, b]) => tk.pos + w > a && tk.pos - w < b); });
  body.push(g({ class: 'pa-axis pa-axis-x' }, [xLabels(freeTicks, inner, theme, { y: area.y + 13 })]));
  if (spec.xLabel) body.push(text(inner.x + inner.w, area.y - 2, spec.xLabel, { fill: theme.muted, fontSize: 11, textAnchor: 'end' }));
  body.push(el('line', { x1: inner.x, x2: inner.x + inner.w, y1: Math.round(inner.y - 4) + 0.5, y2: Math.round(inner.y - 4) + 0.5, stroke: theme.axis, strokeWidth: 1, shapeRendering: 'crispEdges' }));

  // ── Filas ──────────────────────────────────────────────────────────────
  const fmtEnd = (t) => fmtDay(isTime && !t.milestone && isDay(t.row[endF]) ? t.end - DAY : t.end);
  const lenOf = (t) => (isTime ? Math.round((t.end - t.start) / DAY) : +(t.end - t.start).toPrecision(6));
  const lenText = (t) => (isTime ? `${lenOf(t)} ${T(locale, lenOf(t) === 1 ? 'día' : 'días', lenOf(t) === 1 ? 'day' : 'days')}` : `${formatNumber(lenOf(t), Number.isInteger(lenOf(t)) ? 0 : 1, locale, true)}${spec.unit ? ' ' + spec.unit : ''}`);
  const hl = spec.highlight === undefined ? null : new Set([].concat(spec.highlight).map(String));
  const dim = (t) => hl && !hl.has(t.name) && !hl.has(String(t.group));
  const pos = new Map(); // tarea → geometría (para las dependencias)
  const labels = [], marks = [], headers = [];
  let y = inner.y;
  for (const r of rows) {
    const h = rowHeight(r);
    const cy = y + h / 2;
    if (r.type === 'group') {
      const ink = readable(r.color, theme, 4.5);
      headers.push(text(area.x, cy + fs * 0.36, truncate(r.name, labelW - 10, fs, 600), { fill: ink, fontSize: fs, fontWeight: 600 }));
      const xa = x(r.start), xb = x(r.end);
      const sum = [el('rect', { x: xa, y: cy - 1.5, width: Math.max(2, xb - xa), height: 3, rx: 1.5, fill: r.color }),
        el('path', { d: `M${xa},${cy - 1.5}v6l4,-6zM${xb},${cy - 1.5}v6l-4,-6z`, fill: r.color })];
      const span = isTime ? Math.round((r.end - r.start) / DAY) : r.end - r.start;
      headers.push(g({ class: 'pa-m', opacity: hl && !hl.has(r.name) ? 0.35 : null, 'data-color': r.color, 'data-tip': tip(r.name, `${fmtDay(r.start)} – ${fmtDay(isTime && r.tasks.every((t) => t.milestone || isDay(t.row[endF])) ? r.end - DAY : r.end)}`, `${r.tasks.length} ${T(locale, r.tasks.length === 1 ? 'tarea' : 'tareas', r.tasks.length === 1 ? 'task' : 'tasks')}${isTime ? ' · ' + span + ' ' + T(locale, 'días', 'days') : ''}`) }, sum));
      y += h;
      continue;
    }
    const t = r.t;
    const color = colorOf(t);
    const dashedT = isDashed(t);
    const opacity = dim(t) ? 0.32 : null;
    labels.push(text(area.x + (useHeaders ? 12 : 0), cy + fs * 0.36, truncate(t.name, labelW - (useHeaders ? 24 : 12), fs), { fill: dim(t) ? theme.muted : theme.ink, fontSize: fs, opacity: dim(t) ? 0.8 : null }));
    const tipLines = [t.name, t.milestone ? fmtDay(t.start) : `${fmtDay(t.start)} – ${fmtEnd(t)} · ${lenText(t)}`, t.group, t.progress !== null ? `${T(locale, 'Avance', 'Progress')}: ${formatNumber(t.progress * 100, 0, locale)}%` : null,
      t.deps.length ? `${T(locale, 'Después de', 'After')}: ${t.deps.join(', ')}` : null, dashedT ? (dashedLabel || null) : null];
    if (t.milestone) {
      const px = x(t.start), s = Math.min(9, h * 0.36);
      const fill = groups.length ? color : theme.ink;
      const parts = [el('path', { d: `M${px},${cy - s}L${px + s},${cy}L${px},${cy + s}L${px - s},${cy}Z`, ...(dashedT ? dashedAttrs(H, fill, { width: 1.2 }) : { fill, stroke: theme.surface, strokeWidth: 1.5 }) })];
      const lab = fmtDay(t.start, false);
      // Si de este hito sale una flecha, la fecha va a la izquierda para no cruzarla.
      const hasNext = tasks.some((o) => o.deps.includes(t.name));
      if (hasNext && px - s - 6 - measure(lab, 11) > inner.x) parts.push(text(px - s - 5, cy + 4, lab, { fill: theme.lede, fontSize: 11, textAnchor: 'end' }));
      else if (px + s + 6 + measure(lab, 11) < inner.x + inner.w) parts.push(text(px + s + 5, cy + 4, lab, { fill: theme.lede, fontSize: 11 }));
      else parts.push(text(px - s - 5, cy + 4, lab, { fill: theme.lede, fontSize: 11, textAnchor: 'end' }));
      marks.push(g({ class: 'pa-m', opacity, 'data-color': color, 'data-tip': tip(...tipLines) }, parts));
      pos.set(t.name, { x0: px - s, x1: px + s, cy, h: s * 2 });
    } else {
      const xa = x(t.start), xb = Math.max(xa + 3, x(t.end));
      const bh = Math.max(6, Math.round(h * 0.6));
      const by = cy - bh / 2, w = xb - xa, rx = Math.min(theme.marks?.barRadius ?? 4, bh / 2, w / 2);
      const parts = [];
      if (dashedT) parts.push(el('rect', { x: xa + 0.6, y: by + 0.6, width: Math.max(1, w - 1.2), height: bh - 1.2, rx, ...dashedAttrs(H, color) }));
      else if (t.progress !== null) {
        const light = ramp([theme.surface, color], theme.mode === 'dark' ? 0.38 : 0.26);
        parts.push(el('rect', { x: xa, y: by, width: w, height: bh, rx, fill: light }));
        if (t.progress > 0) {
          const pw = Math.max(rx * 2, w * t.progress);
          parts.push(el('clipPath', { id: `${gid}-c${t.i}` }, el('rect', { x: xa, y: by, width: w, height: bh, rx })));
          parts.push(el('rect', { x: xa, y: by, width: Math.min(w, pw), height: bh, fill: color, 'clip-path': `url(#${gid}-c${t.i})` }));
        }
      } else parts.push(el('rect', { x: xa, y: by, width: w, height: bh, rx, fill: color }));
      // Etiqueta de avance: dentro de la parte llena si cabe; si no, a la derecha.
      if (t.progress !== null && spec.labels !== false) {
        const s = `${formatNumber(t.progress * 100, 0, locale)}%`;
        const sw = measure(s, 11, 600);
        const pw = w * t.progress;
        if (!dashedT && pw >= sw + 10) parts.push(text(xa + pw - 5, cy + 3.8, s, { fill: textOn(color, theme), fontSize: 11, fontWeight: 600, textAnchor: 'end' }));
        else if (xb + 6 + sw < inner.x + inner.w) parts.push(text(xb + 6, cy + 3.8, s, { fill: theme.lede, fontSize: 11, fontWeight: 600 }));
      }
      marks.push(g({ class: 'pa-m', opacity, 'data-color': color, 'data-tip': tip(...tipLines) }, parts));
      pos.set(t.name, { x0: xa, x1: xb, cy, h: bh });
    }
    y += h;
  }

  // ── Dependencias: flechas en ángulo recto, por detrás de las barras ─────
  const links = [];
  const arrowId = `${gid}-arrow`;
  for (const t of tasks) for (const d of t.deps) {
    const a = pos.get(d), b = pos.get(t.name);
    if (!a || !b) continue;
    const xs = a.x1, ys = a.cy, xe = b.x0 - 1.5, ye = b.cy;
    const dir = ye >= ys ? 1 : -1;
    let dpath;
    if (xe - xs >= 12) dpath = `M${xs.toFixed(1)},${ys}H${(xe - 8).toFixed(1)}V${ye}H${xe.toFixed(1)}`;
    else {
      // La sucesora empieza antes de que termine la predecesora: rodea por el borde de la fila.
      const mid = ys + dir * (a.h / 2 + (rowH - a.h) / 2);
      dpath = `M${xs.toFixed(1)},${ys}h6V${mid.toFixed(1)}H${(xe - 8).toFixed(1)}V${ye}H${xe.toFixed(1)}`;
    }
    links.push(el('path', { d: dpath, fill: 'none', stroke: theme.muted, strokeWidth: 1, strokeLinejoin: 'round', opacity: 0.85, markerEnd: `url(#${arrowId})` }));
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

  body.push(g({ class: 'pa-labels' }, [...headers.filter((s) => s.startsWith('<text')), ...labels]));
  body.push(g({ class: 'pa-links' }, links));
  body.push(g({ class: 'pa-marks' }, [...headers.filter((s) => !s.startsWith('<text')), ...marks]));
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
  if (longest) desc += en ? ` Longest: ${longest.name} (${lenText(longest)}).` : ` Más larga: ${longest.name} (${lenText(longest)}).`;
  if (ms.length) desc += en ? ` Milestones: ${ms.slice(0, 4).map((t) => `${t.name} (${fmtDay(t.start, false)})`).join(', ')}.` : ` Hitos: ${ms.slice(0, 4).map((t) => `${t.name} (${fmtDay(t.start, false)})`).join(', ')}.`;
  const withP = tasks.filter((t) => t.progress !== null && !t.milestone);
  if (withP.length) {
    const avg = withP.reduce((a, t) => a + t.progress * lenOf(t), 0) / (withP.reduce((a, t) => a + lenOf(t), 0) || 1);
    desc += en ? ` Overall progress: ${formatNumber(avg * 100, 0, locale)}%.` : ` Avance total: ${formatNumber(avg * 100, 0, locale)}%.`;
  }
  const defs = el('marker', { id: arrowId, viewBox: '0 0 8 8', refX: 7, refY: 4, markerWidth: 7, markerHeight: 7, orient: 'auto' }, el('path', { d: 'M0,0.8L7,4L0,7.2Z', fill: theme.muted })) + H.defs();
  return frame.finish(body, { desc, type: 'gantt', defs });
}

