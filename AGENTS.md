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
6. Set `locale: "en"` for English number formats (default is Spanish: `1.234,5`).

## Which type

| To show | `type` | Key fields |
|---|---|---|
| Compare categories | `bar` | `x`, `y`, `series?`, `stack?` (`true` / `"percent"`), `top?` |
| Count rows per category | `countplot` | `x` |
| Mean per category with a CI | `barplot` or `point` | `x`, `y`, `hue?` |
| Change over time | `line` | `x` date (`"2024-03"`) or year, `y`, `series?`; `ci: true` with several observations per x |
| A project plan or schedule | `gantt` | `task`, `start`, `end` (or `duration`), `group?`, `progress?`, `dependsOn?`, `today?` |
| Volume over time | `area` | like `line`; stacks with `series` |
| Measures on different scales | `line` + `index: true`, or `facet` | **there is no dual axis** |
| Exponential growth | `line` + `yScale: "log"` | |
| Relationship between two measures | `regplot` (fit + CI) / `scatter` / `bubble` | `x`, `y`, `hue?`, `size?`, `label?` |
| Relationship + marginals | `jointplot` | `x`, `y` |
| Distribution of one measure | `hist` (`kde: true`), `kde`, `ecdf` | `x`, `hue?` |
| Distribution by category | `box`, `violin`, `strip`, `swarm` | `x` category, `y` measure, `hue?` |
| Multi-dimensional profile | `radar` | `axis`, `value`, `series` (≤ 4 series) |
| Hierarchical part-to-whole | `treemap` or `sunburst` | `path: [level1, level2, …]`, `value` |
| Part-to-whole, ≤ 6 parts | `donut` / `pie` | `label`, `value`; `half: true` for a semicircle |
| Magnitude on a grid | `heatmap` | `x`, `y`, `value` |
| A value per region, state or country | `choropleth` (`symbolmap` for totals) | `geo: "chile" \| "usa" \| "world"` or any GeoJSON/TopoJSON object, `key`, `value` (text → one color per category) |
| Who is connected to whom | `network` | edges `from`, `to`, `value?`; `nodes?` with `group` |
| Exchanges between a few groups | `chord` | `from`, `to`, `value` |
| Age structure | `pyramid` | `age`, `sex`, `value` |
| A process with decisions | `flowchart` | `nodes` (`type`, `lane`), `edges` (`label`) |
| Flows between stages | `sankey` | `from`, `to`, `value` |
| One or more numbers | `kpi` | `items: [{ label, value, delta, period, trend, target, good }]` |

seaborn names work (`histplot`, `kdeplot`, `boxplot`, `violinplot`, `lmplot`, `stripplot`, `swarmplot`, `pointplot`), and `hue` is an alias of `series`. Leave `type` out to infer it from the data.

## Most useful options

- `highlight: "Ñuble"`: emphasize one category or series and mute the rest.
- `dashed` for what is not a firm number (estimates, projections, provisional figures): a name, a list, or a data field (`dashed: "provisional"`). Shapes keep their color, with a hatched fill and a dashed outline. On a time axis, `dashedFrom: 2025` dashes lines, areas and columns from that year on. **Always set `dashedLabel`** ("Projection", "Preliminary") so readers know what the hatching means.
- `facet: "region"` (+ `columns`): one panel per value, on a shared scale.
- `time: "year"`: one period at a time (the latest) with % change vs the previous one; in the browser, a slider with play (`slider: false` / `play: false` to turn them off). Treemaps can be colored by change with `colorBy: "change"`.
- `refLines: [{ y: 600, label: "Target" }]` and `annotations: [{ x: "2024-01", label: "New branch" }]`.
- `format: "percent" | "currency" | "compact" | "integer"` or `{ prefix, suffix, decimals }`.
- `xScale` / `yScale: "log"`.
- `theme: "noche"` or a JSON object (`{ extends, categorical, type, marks, font }`); `palette: [...]` for your own colors.
- `font: "Poppins"` and `textScale: 1.5` (presentation mode); `configure({ font, textScale })` sets them for every chart.
- `network` + `focus: "node id"`: center a node and highlight its neighbors.
- Your own map: `geo: <GeoJSON or TopoJSON>`; the matching property is found for you (`featureKey` to force it). Add `markers: [{ lon, lat, label }]`, `layers: [{ geo, label }]` for rivers or routes, and `fitTo: ["Biobío"]` or a `[lonMin, latMin, lonMax, latMax]` box to zoom.
- `gantt`: day `end` dates are inclusive; a row without `end` is a milestone. Always set `today` on a live plan.
- `geo: "usa"`: states match by postal code ("TX"), English or Spanish name, or FIPS ("48"). Alaska and Hawaii are insets; Puerto Rico appears only when your data has it. In the browser, maps zoom on click, Ctrl/⌘ + scroll or pinch.

## Mistakes the library already handles

- More than 8 series → the 9th onward turn gray; `lint` suggests `highlight` or `facet`.
- Colliding line labels → spread apart with leader lines.
- Donut with more than 6 parts → folds into "Other".
- Long category labels → switches to horizontal.
- Hard-to-tell custom palette → `lint` names the offending pair.
- Numbers as text ("1.234,5", "12%", "$ 3.000") → parsed automatically.
- Tens of thousands of points → drawn as batched paths, still fast.

## Outputs

- `plot(spec)` → SVG string. Drop it into HTML, Markdown, an `.svg` file or a PDF.
- `toHTML([spec1, spec2])` → self-contained page with tooltips, sliders and drill-down.
- `describe(spec)` → alt text for the chart.
- `schema` / `toolDefinition()` → JSON Schema and tool definition (Anthropic or OpenAI).
- CLI: `npx plotagents spec.json -o chart.svg`.
