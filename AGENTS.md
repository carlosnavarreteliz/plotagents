# plotagents · guide for AI agents

One function, one JSON object. No design decisions: the library makes them.

```js
import { plot, safePlot } from 'plotagents';
const svg = plot({ type, data, x, y, series, title, subtitle, source });
```

## Rules for a good chart

1. **`title` is the finding**, a full sentence with the key number: "Biobío accounts for 30% of sales", not "Sales by region".
2. **`subtitle` says how to read it**: measure, unit and period.
3. **Always set `source`.** If the data is made up, use `source: "illustrative data"`.
4. `data` is a list of rows (`[{ region: "Biobío", sales: 1240 }]`). For a wide table, pass `y: ["revenue", "costs"]`.
5. Call `safePlot(spec)` as your tool: it never throws and returns `errors`, `warnings` and `suggestions`, each with a `fix`. If `ok` is `false`, fix the spec and call again.
6. Set `locale: "en"` for English number formats (default is Spanish: `1.234,5`); also `"pt"`, `"fr"`, `"de"`, or `"auto"` to recognize it from the text. Tables recognize it on their own.

## Which type

| To show | `type` | Key fields |
|---|---|---|
| Compare categories | `bar` | `x`, `y`, `series?`, `stack?` (`true` / `"percent"`), `top?` |
| Count rows per category | `countplot` | `x` |
| Mean per category with a CI | `barplot` or `point` | `x`, `y`, `hue?` |
| Change over time | `line` | `x` date (`"2024-03"`) or year, `y`, `series?`; `ci: true` with several observations per x |
| A project plan or schedule | `gantt` | `task`, `start`, `end` (or `duration`), `group?`, `progress?`, `dependsOn?`, `today?`, `collapsed?` |
| Volume over time | `area` | like `line`; stacks with `series` |
| The shape of a series in a table cell | `spark` | `x`, `y`, `width`/`height` any size (e.g. 108×26), `fill?`, `series?` |
| One row of a distribution in a table cell | `rail` | `value`, `min`, `max`, `band?: [lo, hi]`, `median?`, `refs?: [{ field \| value, label }]`, `clip?` / `domain?` (past an end → chevron); 160×18 by default |
| Who passed whom over time | `bump` (`slope` for first vs last) | `x` period, `y` value (or `rank`), `series`, `top?`, `ends?: "first-last"` |
| Measures on different scales | `line` + `index: true`, or `facet` | **there is no dual axis** |
| Exponential growth | `line` + `yScale: "log"` | |
| Relationship between two measures | `regplot` (fit + CI) / `scatter` / `bubble` | `x`, `y`, `hue?`, `size?`, `label?` |
| Relationship + marginals | `jointplot` | `x`, `y` |
| Which measures move together | `corr` (`correlation`) | `vars?` (default: every numeric field), `method?` (`"spearman"`), `alpha?: 0.05`; `cluster: true` or `type: "clustermap"` groups them with a dendrogram |
| Every pair of measures at once | `pairplot` (`splom`) | `vars` (3–6), `hue?`, `corner?`, `kind?: "reg"` |
| Distribution of one measure | `hist` (`kde: true`), `kde`, `ecdf` | `x`, `hue?` |
| Distribution by category | `box`, `violin`, `strip`, `swarm` | `x` category, `y` measure, `hue?` |
| Distribution where each thing stays one thing | `dotplot` | `x`, `bin?`, `label?`, `series?`, `highlight?`, `ticks?: [[value, label]]` |
| Multi-dimensional profile | `radar` | `axis`, `value`, `series` (≤ 4 series) |
| Hierarchical part-to-whole | `treemap` or `sunburst` | `path: [level1, level2, …]`, `value` |
| Part-to-whole, ≤ 6 parts | `donut` / `pie` | `label`, `value`; `half: true` for a semicircle |
| Magnitude on a grid | `heatmap` | `x`, `y`, `value` |
| A count as a number of things | `waffle` | `series`, `value?` (or one square per row), `columns?`, `unit?` |
| How things group, and at what height | `dendrogram` | rows `id`, `parent`, `heightField?` or `linkage` + `labels`; `cut?`, `clusters?` |
| A value per region, state or country | `choropleth` (`symbolmap` for totals) | `geo: "chile" \| "usa" \| "world"` or any GeoJSON/TopoJSON object, `key`, `value` (text → one color per category) |
| Dots at real places on a street map | `pointmap` | `lon`, `lat` (auto-detected), `size?`, `hue?`, `value?`, `label?`; `tiles: "osm"` (default) / `"esri-gray"` / `"esri-dark"`, or carto-* / mapbox-* with `tilesKey` |
| Who is connected to whom | `network` | edges `from`, `to`, `value?`; `nodes?` with `group`; `layout?` |
| Exchanges between a few groups | `chord` | `from`, `to`, `value` |
| Age structure | `pyramid` | `age`, `sex`, `value` |
| A process with decisions | `flowchart` | `nodes` (`type`, `lane`), `edges` (`label`) |
| Flows between stages | `sankey` | `from`, `to`, `value` |
| One or more numbers | `kpi` | `items: [{ label, value, delta, period, trend, target, good }]` |
| Exact values to look up | `table` | `columns?: [field \| { field, type, label, format, good, target }]`, `sortBy?`, `total?`, `group?`; types `bar`, `delta`, `heat`, `sparkline`, `progress`, `badge`, `check` are inferred when omitted |
| What comes up most in text | `wordcloud` | `text` (field or raw text), `value?`, `series?`; prefer `bar` + `top` to compare exactly |

seaborn names work (`histplot`, `kdeplot`, `boxplot`, `violinplot`, `lmplot`, `stripplot`, `swarmplot`, `pointplot`), and `hue` is an alias of `series`. Leave `type` out to infer it from the data.

## Most useful options

- `highlight: "Ñuble"`: emphasize one category or series and mute the rest. `exclude: ["Maule"]` drops entries and recomputes the chart; colors stay put.
- `legend: "top" | "bottom" | "left" | "right" | false`: where the legend goes (top by default).
- `colorScale: "viridis"`: any matplotlib colormap for heatmaps, maps and treemaps by change (`"RdBu"` diverges around 0; `_r` reverses; or a list of colors). `palette: "tab10"` for categories.
- `dashed` for what is not a firm number (estimates, projections, provisional figures): a name, a list, or a data field (`dashed: "provisional"`). Shapes keep their color, with a hatched fill and a dashed outline. On a time axis, `dashedFrom: 2025` dashes lines, areas and columns from that year on. **Always set `dashedLabel`** ("Projection", "Preliminary") so readers know what the hatching means.
- `facet: "region"` (+ `columns`): one panel per value, on a shared scale.
- `time: "year"`: one period at a time (the latest) with % change vs the previous one. Time controls are **off by default**: add `slider: true` only when the person asks to move through periods (buttons for ≤ 8 periods, a minimal slider otherwise; `"buttons"` / `"slider"` force one, `play: false` hides play). Treemaps can be colored by change with `colorBy: "change"`.
- `refLines: [{ y: 600, label: "Target" }]` and `annotations: [{ x: "2024-01", label: "New branch" }]`.
- `format: "percent" | "currency" | "compact" | "integer"` or `{ prefix, suffix, decimals }`.
- `xScale` / `yScale: "log"`.
- `table`: give a title that states the finding like any chart. More than 15 rows paginate in tens (`pageSize`), phones get one card per row, and the browser adds sort, search and paging. Use `good: "down"` on costs so ▲ turns red, `progress` with `target: "budget"` for spent vs budget, and `total: true` for a totals row. Keep 4–7 columns.
- `theme: "noche"` or a JSON object (`{ extends, categorical, type, marks, font }`); `palette: [...]` for your own colors.
- `font: "Poppins"` and `textScale: 1.5` (presentation mode); `configure({ font, textScale })` sets them for every chart.
- `network` + `focus: "node id"`: center a node and highlight its neighbors.
- Your own map: `geo: <GeoJSON or TopoJSON>`; the matching property is found for you (`featureKey` to force it). Add `markers: [{ lon, lat, label }]`, `layers: [{ geo, label }]` for rivers or routes, and `fitTo: ["Biobío"]` or a `[lonMin, latMin, lonMax, latMax]` box to zoom.
- Maps for a static site: `geo: { paths: { id: "M…Z" } }` takes outlines already projected (no projection runs); `views: [{ id, label, value }, …]` bakes several readings of one geometry into one SVG (switch with `data-view`, `plotagents/views`); `pathPrecision: 1, simplify: 0.5` shrink the paths; `fitTo: "mainland"` drops far islands; `microstates: true` draws Singapore or Malta as dots; world countries match by ISO-2 too.
- `gantt`: day `end` dates are inclusive; a row without `end` is a milestone. Always set `today` on a live plan. `collapsed: ["Phase 2"]` (or `true`) folds phases into one summary bar; in the browser a click on a phase toggles it.
- `network` + `layout: "force" | "circular" | "radial" | "concentric" | "clusters" | "tree" | "grid"` picks the placement; `curveness: 0` straightens edges.
- `pointmap` draws on OpenStreetMap tiles by default (`tiles: "esri-gray"`, `"mapbox-light"` + `tilesKey`, or your own `{ url, attribution }`). Tiles load only when the SVG is inline or in `toHTML`, not inside `<img>`.
- Your own look for every chart: `registerTheme("acme", { background, text, grid: { color, dash }, categorical: "tab10", font })` then `configure({ theme: "acme" })`.
- `geo: "usa"`: states match by postal code ("TX"), English or Spanish name, or FIPS ("48"). Alaska and Hawaii are insets; Puerto Rico appears only when your data has it. In the browser, maps zoom on click, Ctrl/⌘ + scroll or pinch.

## Mistakes the library already handles

- More than 8 series → the 9th onward turn gray; `lint` suggests `highlight` or `facet`.
- Colliding line labels → spread apart with leader lines.
- Donut with more than 6 parts → folds into "Other".
- Long category labels → switches to horizontal.
- Hard-to-tell custom palette → `lint` names the offending pair.
- Numbers as text ("1.234,5", "12%", "$ 3.000") → parsed automatically.
- Tens of thousands of points → drawn as batched paths, still fast.

## Dashboards

When someone asks for a dashboard, call `safeDashboard({ title, subtitle, source, data, kpis, charts, filters })` (tool: `toolDefinition({ kind: 'dashboard' })`). Layout, widths, shared colors and filters are decided for you:

- `title` is the **question** the dashboard answers; every chart still gets its finding as title.
- At most **5 KPIs**, computed from `data` when possible: `{ label, field, agg: "sum", compare: { field: "year", current: 2025, previous: 2024 }, trendBy: "month" }`.
- **4–6 charts**. The first time series (or the one with `primary: true`) goes full width; the rest fill balanced rows.
- `filters: ["region", "channel"]` become buttons that filter every chart and KPI.
- No more than one donut; one `source` for the page.

## Outputs

- `plot(spec)` → SVG string. Drop it into HTML, Markdown, an `.svg` file or a PDF.
- `toHTML([spec1, spec2])` → self-contained page with tooltips, sliders and drill-down.
- `describe(spec)` → alt text for the chart.
- `schema` / `toolDefinition()` → JSON Schema and tool definition (Anthropic or OpenAI).
- CLI: `npx plotagents spec.json -o chart.svg`.
