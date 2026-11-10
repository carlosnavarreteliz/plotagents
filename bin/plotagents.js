#!/usr/bin/env node
// CLI: plotagents spec.json [-o salida.svg|.html] [--lint] [--schema] [--tool [openai] [dashboard]]
//   cat spec.json | plotagents > grafico.svg
// A spec with a `charts` list is a dashboard: it renders to a self-contained HTML page.
import { readFileSync, writeFileSync } from 'node:fs';
import { plot, toHTML, lint, schema, toolDefinition, describe, dashboard, lintDashboard, dashboardSchema } from '../src/index.js';

// `plotagents … | head` closes the pipe early: exit quietly instead of crashing.
for (const stream of [process.stdout, process.stderr]) {
  stream.on('error', (e) => { if (e && e.code === 'EPIPE') process.exit(0); throw e; });
  // Escritura bloqueante: process.exit() no corta una salida larga (> 64 KB) en un pipe.
  stream._handle?.setBlocking?.(true);
}

const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const opt = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
const VALUE_FLAGS = new Set(['-o', '--out', '--tool']);
const TOOL_ARGS = new Set(['openai', 'anthropic', 'dashboard', 'chart']);
const input = args.find((a, i) => !a.startsWith('-') && !VALUE_FLAGS.has(args[i - 1]) && !(TOOL_ARGS.has(a) && args.slice(0, i).includes('--tool')));
const print = (s) => process.stdout.write(s.endsWith('\n') ? s : s + '\n');

if (flag('-h') || flag('--help')) {
  print(`plotagents — gráficos bellos desde un spec JSON

Uso:
  plotagents spec.json                 SVG a la salida estándar
  plotagents spec.json -o grafico.svg  guarda SVG
  plotagents spec.json -o reporte.html página HTML interactiva (acepta un arreglo de specs)
  plotagents tablero.json -o tablero.html  dashboard (un spec con \`charts: [...]\`)
  plotagents spec.json --lint          revisa el spec y sugiere mejoras (JSON)
  plotagents spec.json --describe      descripción en texto del gráfico
  plotagents --schema [dashboard]      JSON Schema del spec (o del dashboard)
  plotagents --tool [openai] [dashboard]  definición de herramienta para agentes
  cat spec.json | plotagents           también lee de stdin`);
  process.exit(0);
}
// Tool and schema flags accept "openai" and/or "dashboard" in any order after the flag.
const after = (f) => { const i = args.indexOf(f); return i >= 0 ? args.slice(i + 1).filter((a) => TOOL_ARGS.has(a)) : []; };
if (flag('--schema')) { print(JSON.stringify(after('--schema').includes('dashboard') ? dashboardSchema : schema, null, 2)); process.exit(0); }
if (flag('--tool')) {
  const t = after('--tool');
  print(JSON.stringify(toolDefinition({ flavor: t.includes('openai') ? 'openai' : 'anthropic', kind: t.includes('dashboard') ? 'dashboard' : 'chart' }), null, 2));
  process.exit(0);
}

let raw;
try { raw = input ? readFileSync(input, 'utf8') : readFileSync(0, 'utf8'); } catch (e) { console.error('No pude leer el spec:', e.message); process.exit(2); }
let spec;
try { spec = JSON.parse(raw); } catch (e) { console.error('El spec no es JSON válido:', e.message); process.exit(2); }

const isDashboard = (s) => !!s && typeof s === 'object' && !Array.isArray(s) && Array.isArray(s.charts);

if (flag('--lint')) {
  const list = Array.isArray(spec) ? spec : [spec];
  const out = list.map((s) => (isDashboard(s) ? lintDashboard(s) : lint(s)));
  print(JSON.stringify(Array.isArray(spec) ? out : out[0], null, 2));
  process.exit(out.every((r) => r.ok) ? 0 : 1);
}
try {
  const outFile = opt('-o') ?? opt('--out');
  if (isDashboard(spec)) {
    if (flag('--describe')) { print([spec.title, ...spec.charts.map((c) => { try { return describe({ data: spec.data, ...c }); } catch (e) { return e.message.split('\n')[0]; } })].filter(Boolean).join('\n')); process.exit(0); }
    const html = dashboard(spec);
    if (outFile) { writeFileSync(outFile, html); console.error(`✓ ${outFile}`); } else process.stdout.write(html);
  } else {
    if (flag('--describe')) { print((Array.isArray(spec) ? spec : [spec]).map(describe).join('\n')); process.exit(0); }
    const html = (outFile && outFile.endsWith('.html')) || flag('--html') || Array.isArray(spec);
    const result = html ? toHTML(spec, { title: (Array.isArray(spec) ? spec[0] : spec).title || 'plotagents' }) : plot(spec);
    if (outFile) { writeFileSync(outFile, result); console.error(`✓ ${outFile}`); } else process.stdout.write(result);
  }
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
