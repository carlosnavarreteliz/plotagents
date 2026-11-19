#!/usr/bin/env node
// Offline runner for the plotagents skill. Needs only Node: no npm install, no network.
//   node plot.cjs spec.json -o chart.svg     SVG (a spec)
//   node plot.cjs spec.json -o page.html     self-contained interactive page (a spec or an array)
//   node plot.cjs board.json -o board.html   dashboard (a spec with `charts: [...]`)
//   node plot.cjs spec.json --lint           errors, warnings and suggestions as JSON
//   node plot.cjs --schema [dashboard]       JSON Schema of every option
//   cat spec.json | node plot.cjs > chart.svg
// It loads plotagents.js (and plotagents-geo.js for maps) from this folder; when they are
// missing it falls back to an installed `plotagents` package.
'use strict';
const fs = require('node:fs');
const path = require('node:path');

function load() {
  const here = (f) => path.join(__dirname, f);
  if (fs.existsSync(here('plotagents.js'))) {
    require(here('plotagents.js'));
    if (fs.existsSync(here('plotagents-geo.js'))) require(here('plotagents-geo.js'));
    return globalThis.plotagents;
  }
  try {
    require('plotagents/browser');
    try { require('plotagents/browser/geo'); } catch {}
    return globalThis.plotagents;
  } catch {}
  console.error('plotagents.js is not next to plot.cjs and the plotagents package is not installed.\n' +
    'Use `npx -y plotagents spec.json -o chart.svg` instead, or reinstall the skill from https://carlosnavarrete.cl/plotagents/#skill');
  process.exit(2);
}

const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const out = (() => { const i = args.findIndex((a) => a === '-o' || a === '--out'); return i >= 0 ? args[i + 1] : undefined; })();
const input = args.find((a, i) => !a.startsWith('-') && args[i - 1] !== '-o' && args[i - 1] !== '--out');

if (flag('-h') || flag('--help')) {
  console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(1, 10).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
  process.exit(0);
}

if (flag('--schema')) {
  const pa = load();
  console.log(JSON.stringify(args.includes('dashboard') ? pa.dashboardSchema : pa.schema, null, 2));
  process.exit(0);
}

let spec;
try { spec = JSON.parse(fs.readFileSync(input || 0, 'utf8')); }
catch (e) { console.error(`Could not read the spec: ${e.message}`); process.exit(2); }

const pa = load();
const isDashboard = (s) => !!s && typeof s === 'object' && !Array.isArray(s) && (Array.isArray(s.charts) || (Array.isArray(s.kpis) && s.type === undefined));
const list = Array.isArray(spec) ? spec : [spec];

// Same checks as safePlot / safeDashboard: never draw a spec with errors.
const reports = list.map((s) => (isDashboard(s) ? pa.lintDashboard(s) : pa.lint(s)));
if (flag('--lint')) {
  console.log(JSON.stringify(Array.isArray(spec) ? reports : reports[0], null, 2));
  process.exit(reports.every((r) => r.ok) ? 0 : 1);
}
for (const r of reports) {
  for (const w of [...(r.warnings || []), ...(r.suggestions || [])]) console.error(`note: ${w.message || w}${w.fix ? ` → ${w.fix}` : ''}`);
  if (!r.ok) {
    for (const e of r.errors || []) console.error(`error: ${e.message || e}${e.fix ? ` → ${e.fix}` : ''}`);
    process.exit(1);
  }
}

try {
  let result;
  if (isDashboard(spec)) result = pa.dashboard(spec);
  else if ((out && out.endsWith('.html')) || flag('--html') || Array.isArray(spec)) result = pa.toHTML(spec, { title: list[0].title || 'plotagents' });
  else result = pa.plot(spec);
  if (out) { fs.writeFileSync(out, result); console.error(`✓ ${out}`); } else process.stdout.write(result);
} catch (e) {
  console.error(`error: ${e.message}`);
  process.exit(1);
}
