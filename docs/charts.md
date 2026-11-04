# Chart reference

Every chart takes a spec with `data` (rows) plus field names for each role. The options below are specific to each type; the [common options](#common-options) apply to all of them. Every option is also described in [`schema.json`](../schema.json).

## Common options

| Option | Meaning |
|---|---|
| `type` | Chart type or alias. Omit (or `"auto"`) to infer it from the data. |
| `data` | Array of row objects. `{ A: 1, B: 2 }` and arrays of numbers are accepted too. |
| `title` | The finding, as a sentence. Wraps; never truncated. |
| `subtitle` | How to read the chart: measure, unit, period. |
| `source` | Data source, shown small at the bottom right. |
| `series` / `hue` | Field that splits the data into colored groups. |
| `highlight` | One name or a list: emphasize these, mute the rest. |
| `colors` | `{ "name": "#hex" }` to pin an entity's color. |
| `format`, `xFormat`, `yFormat` | `"number" \| "compact" \| "percent" \| "currency" \| "integer"` or `{ prefix, suffix, decimals, currency }`. |
| `locale` | `"es"` (default: `1.234,5`) or `"en"` (`1,234.5`). |
| `xLabel`, `yLabel` | Axis titles (horizontal, never rotated). |
| `xScale`, `yScale` | `"log"` where it makes sense. |
| `xDomain`, `yDomain` | Fixed `[min, max]`. |
| `refLines` | `[{ y: 600, label: "Target" }]` (or `x`, or `value` for bars). |
| `facet` (`col`), `columns`, `sharey`, `sharex` | Small multiples, one panel per value. |
| `time`, `timeValue`, `slider`, `play` | One period at a time with a slider in the browser; `slider: false` removes it, `play: false` hides only the play button. |
| `compare` | With `time`: compare against `"previous"` (default), `"first"`, a given period, or `false`. |
| `theme`, `palette`, `ramp` | See [themes](themes.md). |
| `font`, `textScale` | Typeface (Google Fonts name, CSS stack or `{ family, import }`) and a text-size multiplier (aliases `fontScale`, `labelScale`). Set them for every chart with `configure()`. |
| `width`, `height`, `padding` | Pixels. Height is automatic for horizontal bars, heatmaps, KPI tiles, and narrow treemaps, sunbursts and radars. |
| `legend` | `false` hides the legend. |

## Compare

### `bar` · `column` · `barplot` · `count` (`countplot`)

`x` category, `y` value. Columns for few short categories, horizontal bars when labels are long or there are many; values at the bar tips and no axis when every bar is labeled.

| Option | Meaning |
|---|---|
| `stack` | `true` stacks series; `"percent"` stacks to 100%. |
| `horizontal` | Force orientation. |
| `sort` | `"desc"` (default for categories), `"asc"`, `"none"`, `"alpha"`. Years and dates keep their order. |
| `top` | Keep the N largest, fold the rest into "Other" (automatic past 40 categories). |
| `ci`, `errorbar`, `estimator` | `barplot`: mean ± 95% CI (`"ci"`), `"sd"` or `"se"` error bars. |
| `aggregate` | `"sum"` (default), `"mean"`, `"max"`, `"min"`, `"count"`, `"first"`, `"last"`. `countplot` counts rows. |
| `labels` | `true`, `false` or `"auto"`. |
| `barWidth` | Max bar thickness in px. |

## Time

### `line` · `area`

`x` date (`"2024-03"`, `"2024-03-15"`, `Date`), year or number; `y` value or list of fields (wide table → series).

| Option | Meaning |
|---|---|
| `labels` | End labels (default on for every series that fits; colliding labels get leader lines). |
| `annotations` | `[{ x: "2024-01", label: "New branch" }]`. |
| `index` | Rebase each series to 100 at its first value. |
| `ci`, `errorbar`, `estimator` | seaborn `lineplot`: mean and confidence band when there are several rows per x. |
| `curve` | `"linear"` (default), `"smooth"` (monotone, never invents peaks), `"step"`. |
| `zero` | Force the y axis to include zero (on by default for areas and when it costs little). |
| `points` | Markers on every point (automatic for short series). |
| `stack` | Areas: `true` (default with series), `"percent"`, or `false` to overlap. |
| `fill` | Single line: `false` removes the soft gradient. |
| `xRange` | Visible range `[from, to]`; this is what the browser slider sets. |

## Projects

### `gantt` (`timeline`, `roadmap`, `schedule`, `cronograma`)

One row per task: `task`, `start` and `end` (or `duration`). Dates like `"2026-03-02"` or `"2026-03"`, or plain numbers for weeks or sprints. Day dates are **inclusive**: a task from March 3 to March 5 lasts 3 days. A row without `end`, or with `end` equal to `start`, is a milestone, drawn as a diamond with its date.

The time axis sits on top, like a calendar. With `group`, each phase opens with its name and a thin summary bar in its color, so no legend is needed. The filled part of each bar is the progress; the rest stays in a light tint of the same color. Dependencies are thin right-angle arrows behind the bars.

```js
plot({
  type: 'gantt',
  title: 'The project goes live on June 15; the ERP integration is the critical path',
  data: [
    { phase: 'Design', task: 'Data model', start: '2026-02-09', end: '2026-03-06', progress: 80 },
    { phase: 'Build', task: 'ERP integration', start: '2026-03-16', end: '2026-04-30', progress: 10, after: 'Data model' },
    { phase: 'Launch', task: 'Go-live', start: '2026-06-15' },
  ],
  task: 'task', start: 'start', end: 'end', group: 'phase', progress: 'progress', dependsOn: 'after',
  today: '2026-03-12', locale: 'en',
});
```

| Option | Meaning |
|---|---|
| `task`, `start`, `end` | Field names (detected when they are called `task`/`tarea`, `start`/`inicio`, `end`/`fin`). |
| `duration` | Length instead of `end`: days on a date axis, units on a numeric one. |
| `group` (`series`, `hue`) | Phase or team: one colored section per value. `groupHeaders: false` uses a color legend instead. |
| `progress` | 0–1 or 0–100. Shown as the filled part, with the percentage inside the bar when it fits. |
| `dependsOn` | Field with the predecessor's name, or several: `"A, B"`. |
| `milestone` | Boolean field that forces milestones. |
| `today` | A date (or `true`) for the "today" line, labeled on the axis. `refLines: [{ x, label }]` adds more. |
| `dashed`, `dashedLabel` | Hatch tentative tasks: a field (`dashed: "tentative"`), names or phases. |
| `highlight` | Emphasize a task or a whole phase. |
| `sort` | `"start"` orders tasks by date (default: data order, grouped by phase). |
| `rowHeight`, `xLabel`, `unit` | Row height in px; axis title and unit for numeric axes. |

`lint` warns about tasks that end before they start and suggests a `today` line. The alt text names the span, the longest task, the milestones and the overall progress weighted by duration.

## Relationships

### `scatter` · `bubble`

`x`, `y` numeric; `size` for bubbles (area-proportional); `label` field with `labels` (number of points or list of names) for selective labels; `trend: true` adds a least-squares line with R².

### `regplot` (`lmplot`) · `residplot` · `jointplot`

| Option | Meaning |
|---|---|
| `ci` | Confidence band level (95 by default, `false` to hide). |
| `order` | Polynomial degree. |
| `lowess` (+ `frac`) | Local regression instead of a line. |
| `logx` | Fit `y ~ log(x)` and use a log x axis. |
| `scatter` | `false` hides the points. |
| `truncate` | Draw the fit only over the data range (default `true`). |
| `annotate` | Show R² and n. |
| `label`, `labels` | Name selected points. |
| `kind` | `jointplot`: `"scatter"` or `"reg"`. |
| `marginal` | `jointplot`: `"hist"` or `"kde"`. |

### `radar` (`spider`)

Long data (`axis`, `value`, `series`) or wide data (`axes: [fields]`, one row per series with `label`). `normalize` scales each axis to its own maximum (tooltips keep raw values); `grid: "polygon" | "circle"`; `domain`. Best with ≤ 4 series.

## Distributions

### `hist` (`histplot`) · `kde` (`kdeplot`) · `ecdf`

| Option | Meaning |
|---|---|
| `bins`, `binWidth` | Bin count or width (default: Freedman–Diaconis, rounded to nice edges). |
| `stat` | `"count"`, `"percent"`, `"density"`, `"probability"`. |
| `kde` | Overlay a density curve on the histogram. |
| `multiple` | With `hue`: `"layer"`, `"stack"`, `"dodge"`, `"fill"`. |
| `element` | `"bars"` or `"step"`. |
| `cumulative` | Cumulative distribution. |
| `fill`, `bwAdjust`, `cut`, `clip`, `rug` | Density options. |
| `complementary` | `ecdf`: plot 1 − F(x). |

### `box` · `violin` · `strip` · `swarm` (`beeswarm`) · `point` (`pointplot`)

`x` category and `y` measure (swap them, or set `horizontal`, for horizontal). Long labels or many categories switch to horizontal automatically.

| Option | Meaning |
|---|---|
| `points` | Box: overlay the observations. |
| `showMeans` | Mark the mean. |
| `inner` | Violin: `"box"` (default), `"quartiles"`, `"points"`, `"none"`. |
| `split` | Violin with two `hue` levels: one half each. |
| `scale` | Violin width: `"width"`, `"area"`, `"count"`. |
| `jitter`, `dodge`, `radius` | Strip and swarm layout. |
| `estimator`, `errorbar` | Point plot: `"mean"`/`"median"`/`"sum"` and `"ci"`/`"sd"`/`"se"`/`"pi"`. |
| `order`, `hueOrder` | Category and group order. |

## Part-to-whole

### `treemap` · `sunburst`

`path: [level1, level2, …]` of any depth (or `group` + `label`), `value`. Rows with the same path are summed.

| Option | Meaning |
|---|---|
| `depth` | Show only the first N levels. |
| `focus` | Path to drill into, e.g. `["Mining"]`. In the browser, clicking a group does it and breadcrumbs go back. |
| `showValues` | Append values to the labels. |
| `colorBy` | `"change"` colors tiles by % change vs the comparison period (growth cool, decline warm); `"label"` colors a single-level treemap by item. |
| `shade` | Subtle lightness steps inside each category. Off by default: one solid color per category. |
| `compareData` | Rows of an earlier period to compute changes without `time`. |
| `hole`, `centerValue`, `centerLabel` | Sunburst center. |

Areas are exact: there are no header bands taking space from a group. Categories are told apart by one solid color, a 4 px gap between level-1 groups (2 px and 1 px deeper) and the legend, which lists each group's share. With `time`, every tile also shows its change vs the previous period (▲ 12%). Colors belong to the level-1 group and are computed over the full tree and across all periods, so they never change when drilling or sliding.

### `pyramid` (`populationpyramid`)

Age groups (`age` or `y`), two sides (`sex`, `series` or `hue`) and a value. Back-to-back bars with the ages in the center column; `percent: true` for shares of the population; `compareData`, or `time` + `compare`, draws an earlier year as a stepped outline.

### `donut` · `pie`

`label`, `value`. More than `maxSlices` (6) folds into "Other".

| Option | Meaning |
|---|---|
| `labels` | `"auto"`, `"inside"`, `"outside"` (leader lines), `"legend"`, `false`. |
| `half` | Semicircle. |
| `thickness` | Ring thickness (pie is `1`). |
| `sort` | `"desc"` or `"none"`. |
| `centerValue`, `centerLabel` | Donut center. |

## Maps

### `choropleth` (`map`) · `symbolmap` (`bubblemap`)

Chilean regions (`geo: "chile"`, default), US states (`geo: "usa"`) and world countries (`geo: "world"`) ship with the library, and **any geometry of your own** works too (see below). `key` is the data field to match and `value` the measure; a text `value` (a party, a language, a zone) colors by category with a legend of swatches. Matching is forgiving: names, codes and aliases, ignoring accents, case and "Región de" ("RM", "Biobio", "XIII", "Aisén", "ARG", "EE.UU.", "TX", "Nueva York", "48").

**United States.** 50 states and DC in an Albers equal-area projection (`albersUsa`, the same composite as `d3.geoAlbersUsa`): Alaska (at 0.35×) and Hawaii sit in insets at the bottom left with a fine dashed frame; Puerto Rico gets its own inset only when the data includes it (`territories: true` forces it). Each state shows its postal code, plus the value when it fits; the small northeastern states (VT, NH, MA, RI, CT, NJ, DE, MD, DC) are labeled in a column on the right with leader lines. `values: false` keeps only the codes; `labels: false` removes them.

| Option | Meaning |
|---|---|
| `geo` | `"chile"`, `"usa"`, `"world"`, a name registered with `registerGeo()`, a GeoJSON or TopoJSON object, or (browser) a URL. |
| `featureKey`, `nameKey` | Feature property to match, and the one with the display name (both detected when omitted). |
| `fitTo` | Zoom to regions, a `[lonMin, latMin, lonMax, latMax]` box or `"markers"`. |
| `markers`, `layers` | Points by lon/lat on top; extra GeoJSON lines, polygons or points over or under the map. |
| `scale`, `classes` | `"quantile"` (default), `"equal"`, `"continuous"` or a list of breaks; 5 classes by default. |
| `midpoint` / `diverging` | Diverging classes around a value (e.g. 0 for changes). |
| `missing` | `"plain"` drops the hatch and the "No data" legend entry. |
| `labels`, `bars` | Chile gets a north-to-south column with name, bar and value; `bars: false` hides the bars. World maps label the top N. |
| `projection` | `"mercator"`, `"equalEarth"`, `"albersUsa"`, `"equirectangular"`, `"conic"`, `"identity"`, `"planar"` or `{ type, parallels, rotate }` (picked automatically). |
| `borderColor`, `borderWidth` | Region borders. |
| `dashed`, `dashedLabel` | Hatch some regions (preliminary figures, disputed areas): names, codes or a data field. They keep their class color. |
| `maxRadius` | `symbolmap`: largest circle radius. |

#### Your own geometry: GeoJSON and TopoJSON

`geo` takes whatever you have: a GeoJSON `FeatureCollection`, a single `Feature`, an array of features or a bare geometry, or a TopoJSON `Topology` (`geoObject` picks the object; default the first). Polygons are filled, lines are stroked and points become dots colored by value. In the browser, `render()` also accepts a URL and downloads it once: `geo: "/maps/comunas.topojson"`. In Node, read the file and pass the object.

```js
import { readFileSync } from 'node:fs';
const comunas = JSON.parse(readFileSync('comunas-biobio.geojson', 'utf8'));
plot({
  type: 'choropleth',
  geo: comunas,                       // properties: { CUT_COM: "08101", NOM_COM: "Concepción", … }
  data: [{ comuna: 'Concepción', poverty: 7.1 }, { comuna: 'Coronel', poverty: 12.4 }],
  key: 'comuna', value: 'poverty',   // NOM_COM is found automatically
  markers: { data: hospitals, lon: 'lon', lat: 'lat', label: 'name', legend: 'Hospital' },
  layers: [{ geo: rivers, label: 'Biobío river', stroke: '#5BA3E0', width: 2 }],
  fitTo: ['Concepción', 'Talcahuano', 'Hualpén'],
});
```

- **Matching without configuration.** Rows are matched against the usual keys (code, id, ISO-3, name, aliases); if some rows don't match, plotagents finds the feature property whose values do (`NOM_COM`, `CUT_REG`, `GEOID`, `ADMIN`…). `featureKey` forces one. Display names come from `nameKey`, or the first of `name`, `NOMBRE`, `NAME_1`, `ADMIN` and similar.
- **Projections.** Picked from the geometry: Mercator for a country or region, Equal Earth for the world, and a plain cartesian plane when coordinates are not longitudes and latitudes (UTM metres, for instance). Set `projection` to `"equirectangular"`, `"conic"` (or `{ type: "conic", parallels: [-30, -45], rotate: 72 }`), `"identity"` (pixel coordinates, y down, for hand-drawn or tile maps) or `"planar"` (y up).
- **Framing.** `fitTo` zooms to some regions, a box `[lonMin, latMin, lonMax, latMax]` or `"markers"`; the rest of the map stays as clipped context. `tall: false` turns off the side column for elongated shapes.
- **Markers.** `markers: [{ lon, lat, label, value }]` or `{ data, lon, lat, label, size, color, legend, maxRadius }`: dots on top, area-proportional when there is a `size`, labels placed where they don't collide.
- **Layers.** `layers: [{ geo, label, stroke, width, fill, dash, opacity, below }]` overlays rivers, roads, routes, faults or district lines (or draws them under the regions with `below: true`). A `label` adds a legend key.
- **Style.** `borderColor`, `borderWidth`, `pointRadius`, `lineWidth`, `ramp` (a named or custom sequential ramp), `palette` and `colors` (categories).
- **Register once, use by name.** `registerGeo('biobio', comunas, ['comunas-biobio'])` and then `geo: 'biobio'` in every spec, which keeps tool calls short for an agent.

In the browser (`render()` or `toHTML()`), maps are interactive: hovering outlines the shape; clicking a region zooms to fit it (click again, double-click, Esc or the reset button to go back); Ctrl/⌘ + scroll zooms around the pointer (plain scroll keeps scrolling the page, as `chartjs-plugin-zoom` recommends with its `modifierKey`); pinch zooms on touch screens; drag pans when zoomed; +/− buttons work from the keyboard. Each color class in the legend is a key: hover it to light up its regions, click to pin. With `time`, every region's color transitions into the next period's instead of jumping, and the zoom is kept while the slider plays.

`lint` warns about rows that match no region or country. Sources: Natural Earth 1:110m (public domain) for the world; Biblioteca del Congreso Nacional for Chilean regions (attribution in `src/geo/data/chile-regiones.js`); U.S. Census Bureau cartographic boundaries 1:10m (public domain) via us-atlas 3.0.1 for US states. In the browser, `dist/plotagents-geo.js` adds the geometries; `toHTML()` includes it only when a page has a map.

## Dashed shapes: estimates, projections, provisional figures

Some numbers are not firm yet. Instead of a new color (which reads as a new category), plotagents keeps the shape's color and changes its texture: a hatched fill (stripes of the color over a light tint of it) and a dashed outline at 3:1 contrast. Lines get a dashed stroke with hollow points. It works in `bar`, `line`, `area`, `donut`/`pie`, `choropleth` and `symbolmap`.

| Option | Meaning |
|---|---|
| `dashed` | A category, series or region name, or a list (`["Texas", "Ohio"]`); a data field whose truthy rows are dashed (`"provisional"`, accepts `true`, `1`, `"sí"`, `"yes"`, `"x"`); `{ field, equals }`; or `true` for everything. |
| `dashedFrom` | On a time axis (`line`, `area`, `bar`): the first x that is projected. The line turns dashed from the last firm point, projected points are hollow, stacked areas are hatched in each series' color and a soft band with `dashedLabel` marks the stretch. |
| `dashedLabel` | What it means: "Projection", "Preliminary", "Estimate". It is the legend entry (hover it to light up only the dashed shapes), the band label and a line in the tooltip. Defaults to "Estimado"/"Estimate"; `lint` suggests setting it. |

This follows the Chart.js advice of using patterns (as `patternomaly` does) and `segment.borderDash` for projected stretches, so the distinction never depends on color alone.

## Networks and flows

### `network` (`graph`)

Edges in `data` (`from`, `to`, optional `value`), optional `nodes` with `id`, `group` and `size`. Deterministic force layout fitted to the whole area, or `layout: "circle"`. `labels` (number or list), `highlight` (a node and its neighbors), `focus` (a node id: it is pinned at the center and highlighted with its neighbors, all of them labeled; in the browser a click does it with a smooth transition, and a second click or Esc returns), `iterations`, `maxRadius`.

### `chord`

`from`, `to`, `value` rows, or `matrix` + `names`. `directed` (default false), `sort`, `ribbonColor: "smaller" | "larger" | "source"`, `labelOrientation: "radial"`.

### `flowchart` (`flow`, `diagram`)

`nodes` with `id`, `label`, `type` (`start`, `end`, `process`, `decision`, `data`, `note`), optional `lane` (swimlanes) and `group`; `edges` (or `data`) with `from`, `to` and an optional `label` ("Yes"/"No"). Layered layout with automatic direction (`direction: "TB" | "LR"`), orthogonal connectors with arrows, loops routed around the side. `nodeWidth`, `swimlanes: false`.

## Grids, flows and numbers

### `heatmap`

`x`, `y` categories and `value`. Sequential ramp by default; `midpoint` (or `diverging: true`) for a diverging ramp. Values are written in cells when they fit.

### `sankey`

`from`, `to`, `value` (also detects `source`/`target`). Color starts at the first stage with more than one node and flows downstream.

### `kpi`

`items: [{ label, value, delta, previous, period, good: "up" | "down", trend: [...], target, format }]`. Delta is a fraction (`0.12` → +12%); `good: "down"` for costs. Tiles reflow into balanced rows.
