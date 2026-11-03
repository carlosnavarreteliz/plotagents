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

Chilean regions (`geo: "chile"`, default) and world countries (`geo: "world"`) ship with the library; any GeoJSON FeatureCollection works too. `key` is the data field to match and `value` the measure. Matching is forgiving: names, codes and aliases, ignoring accents, case and "Región de" ("RM", "Biobio", "XIII", "Aisén", "ARG", "EE.UU.").

| Option | Meaning |
|---|---|
| `geo` | `"chile"`, `"world"`, a name registered with `registerGeo()`, or a GeoJSON object. |
| `featureKey` | Feature property to match (default: tries code, id, ISO-3, name and aliases). |
| `scale`, `classes` | `"quantile"` (default), `"equal"`, `"continuous"` or a list of breaks; 5 classes by default. |
| `midpoint` / `diverging` | Diverging classes around a value (e.g. 0 for changes). |
| `missing` | `"plain"` drops the hatch and the "No data" legend entry. |
| `labels`, `bars` | Chile gets a north-to-south column with name, bar and value; `bars: false` hides the bars. World maps label the top N. |
| `projection` | `"mercator"` or `"equalEarth"` (picked automatically). |
| `maxRadius` | `symbolmap`: largest circle radius. |

`lint` warns about rows that match no region or country. Sources: Natural Earth 1:110m (public domain) for the world; Biblioteca del Congreso Nacional for Chilean regions (attribution in `src/geo/data/chile-regiones.js`). In the browser, `dist/plotagents-geo.js` adds the geometries; `toHTML()` includes it only when a page has a map.

## Networks and flows

### `network` (`graph`)

Edges in `data` (`from`, `to`, optional `value`), optional `nodes` with `id`, `group` and `size`. Deterministic force layout fitted to the whole area, or `layout: "circle"`. `labels` (number or list), `highlight` (a node and its neighbors), `iterations`, `maxRadius`.

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
