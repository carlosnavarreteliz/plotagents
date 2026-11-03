#!/usr/bin/env node
// CLI: plotagents spec.json [-o salida.svg|.html] [--lint] [--schema] [--tool]
//   cat spec.json | plotagents > grafico.svg
import { readFileSync, writeFileSync } from 'node:fs';
import { plot, toHTML, lint, schema, toolDefinition, describe } from '../src/index.js';

const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const opt = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
const input = args.find((a, i) => !a.startsWith('-') && args[i - 1] !== '-o' && args[i - 1] !== '--out');

if (flag('-h') || flag('--help')) {
  console.log(`plotagents — gráficos bellos desde un spec JSON

Uso:
  plotagents spec.json                 SVG a la salida estándar
  plotagents spec.json -o grafico.svg  guarda SVG
  plotagents spec.json -o reporte.html página HTML interactiva (acepta un arreglo de specs)
  plotagents spec.json --lint          revisa el spec y sugiere mejoras (JSON)
  plotagents spec.json --describe      descripción en texto del gráfico
  plotagents --schema                  JSON Schema del spec
  plotagents --tool [openai]           definición de herramienta para agentes
  cat spec.json | plotagents           también lee de stdin`);
  process.exit(0);
}
if (flag('--schema')) { console.log(JSON.stringify(schema, null, 2)); process.exit(0); }
if (flag('--tool')) { console.log(JSON.stringify(toolDefinition({ flavor: opt('--tool') === 'openai' ? 'openai' : 'anthropic' }), null, 2)); process.exit(0); }

let raw;
try { raw = input ? readFileSync(input, 'utf8') : readFileSync(0, 'utf8'); } catch (e) { console.error('No pude leer el spec:', e.message); process.exit(2); }
let spec;
try { spec = JSON.parse(raw); } catch (e) { console.error('El spec no es JSON válido:', e.message); process.exit(2); }

if (flag('--lint')) {
  const list = Array.isArray(spec) ? spec : [spec];
  const out = list.map(lint);
  console.log(JSON.stringify(Array.isArray(spec) ? out : out[0], null, 2));
  process.exit(out.every((r) => r.ok) ? 0 : 1);
}
try {
  if (flag('--describe')) { console.log((Array.isArray(spec) ? spec : [spec]).map(describe).join('\n')); process.exit(0); }
  const outFile = opt('-o') ?? opt('--out');
  const html = (outFile && outFile.endsWith('.html')) || flag('--html') || Array.isArray(spec);
  const result = html ? toHTML(spec, { title: (Array.isArray(spec) ? spec[0] : spec).title || 'plotagents' }) : plot(spec);
  if (outFile) { writeFileSync(outFile, result); console.error(`✓ ${outFile}`); } else process.stdout.write(result);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
