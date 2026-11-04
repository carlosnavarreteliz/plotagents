# Dashboards

`dashboard(spec)` turns a handful of chart specs into a finished, self-contained HTML dashboard. Like a single chart, the design decisions come built in: you say what goes on the page, and the library decides where and how.

```js
import { dashboard } from 'plotagents';
import { writeFileSync } from 'node:fs';

writeFileSync('sales.html', dashboard({
  title: 'How are southern sales doing?',
  subtitle: 'Sales by month, region and channel, 2024–2025, CLP millions',
  source: 'Commercial ERP',
  updated: '2026-01-05',
  locale: 'en',
  data: sales,                              // shared rows
  kpis: [
    { label: 'Sales 2025', field: 'sales', agg: 'sum', format: 'compact',
      compare: { field: 'year', current: 2025, previous: 2024 }, trendBy: 'month' },
    { label: 'Orders 2025', field: 'orders', agg: 'sum', format: 'compact',
      compare: { field: 'year', current: 2025, previous: 2024 } },
    { label: 'Online share', value: 0.361, delta: 0.13, format: 'percent', period: 'vs 2024' },
  ],
  filters: ['region', 'channel'],
  charts: [
    { type: 'line', x: 'month', y: 'sales', series: 'region', highlight: 'Ñuble',
      title: 'Ñuble grew 37% this year, faster than any other region' },
    { type: 'choropleth', geo: 'chile', key: 'region', value: 'sales', fitTo: ['Biobío', 'Ñuble', 'Maule', 'Araucanía'],
      title: 'Biobío makes 36% of sales' },
    { type: 'bar', x: 'channel', y: 'sales', series: 'year',
      title: 'Online is the only channel growing strongly' },
    { type: 'treemap', path: ['region', 'channel'], value: 'sales',
      title: 'Physical stores are still half the business' },
  ],
}));
```

The page works without JavaScript: every chart is drawn on the server, so it opens in any browser, prints and converts to PDF. When the browser build is available (it is, in Node), the page also gets tooltips, map zoom and live filters. In a web app, `renderDashboard('#board', spec)` draws the same dashboard into an element.

## What it decides for you

These defaults come from dashboard design practice: Stephen Few's *Information Dashboard Design*, the Z-pattern of reading, and what makes business dashboards hard to read.

| Rule | What plotagents does |
|---|---|
| **One question per dashboard** | The `title` is the question ("How are southern sales doing?"). `lintDashboard` warns above 9 charts and suggests splitting above 6. |
| **Numbers first** | KPIs go in one row at the top, at most 5 (warning above). Each one has a label, the figure, its change with an arrow **and** a sign (never color alone), the comparison period and an optional sparkline. |
| **Z-pattern reading** | The main chart comes right after the KPIs, at full width: the one marked `primary: true`, or else the first time series. |
| **Full rows, no holes** | A 12-column grid in balanced rows: 2 charts → 6 + 6 (8 + 4 when one is wide), 3 → 4 + 4 + 4, 4 → two rows of two, 5 → 3 + 2. Panels in a row share a height. |
| **Width follows the chart** | Time series, Gantt charts, heatmaps and flows read left to right, so they get wide panels. Donuts, KPIs and short rankings get narrow ones. Chile's map gets a narrow column. |
| **Same thing, same color** | One color map across every chart: "Ñuble" is the same color in the line, the treemap and the bars. `colors` pins colors for the whole page. |
| **One voice** | One theme, locale and typeface for every panel. The source appears once, at the bottom; a chart keeps its own source only when it differs. |
| **Filters as buttons** | `filters` become buttons when a field has up to 6 values, and a dropdown when it has more. They filter every chart that has the field, recompute the KPIs and say what is filtered in each subtitle. A filter on a chart's `time` field moves that chart to the chosen period. |
| **Phones** | One column in reading order; KPIs in two columns. |
| **Print** | Panels don't break across pages; the filter bar is not sticky on paper. |

## Spec

| Option | Meaning |
|---|---|
| `title`, `subtitle` | The question, and the scope (measure, unit, period). |
| `source`, `updated`, `note` | Footer and header metadata. |
| `locale`, `theme`, `font`, `palette` | Applied to every chart (`theme: "noche"` for a dark dashboard). |
| `data` | Shared rows. Charts without `data` use them; computed KPIs and filters work on them. |
| `kpis` | `[{ label, value, delta, period, trend, good, format }]` (fixed) or `[{ label, field, agg, over, scale, compare, trendBy, format }]` (computed). `agg`: `sum`, `mean`, `median`, `min`, `max`, `count`, `distinct`, `ratio` (with `over`). `compare: { field, current, previous }` shows the current period and its change. `trendBy: "month"` draws the sparkline. |
| `charts` | Chart specs, as in `plot()`. Per chart: `primary: true`, `size: "full" \| "large" \| "medium" \| "small"` or `span` (of 12). |
| `filters` | `["region"]` or `[{ field, label, control: "buttons" \| "select", value }]`. |
| `layout` | `"auto"` (default), `"executive"` (main chart full width, then pairs) or `"grid"` (equal panels). |
| `colors` | `{ "Biobío": "#3A47B8" }` for every chart. |

## For agents

```js
import { safeDashboard, toolDefinition } from 'plotagents';

const tool = toolDefinition({ kind: 'dashboard' });   // JSON Schema of the dashboard spec
const { ok, html, errors, warnings, suggestions } = safeDashboard(input);
```

`safeDashboard` never throws. It reviews the dashboard as a whole (too many charts or KPIs, several pies, mixed themes, filters on fields no chart has, panels without a title) and every chart in it, tagging each issue with the chart's number and title so the model knows which one to fix. `planDashboard(spec)` returns the layout decisions (panels, widths, rows, colors, filters) without drawing anything.
