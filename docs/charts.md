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
| `time`, `timeValue`, `slider` | One period at a time with a slider in the browser. |
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
| `colorBy` | `"label"` to color a single-level treemap by item. |
| `hole`, `centerValue`, `centerLabel` | Sunburst center. |

Colors belong to the level-1 group and are computed over the full tree (and across all periods with `time`), so they never change when drilling or sliding.

### `donut` · `pie`

`label`, `value`. More than `maxSlices` (6) folds into "Other".

| Option | Meaning |
|---|---|
| `labels` | `"auto"`, `"inside"`, `"outside"` (leader lines), `"legend"`, `false`. |
| `half` | Semicircle. |
| `thickness` | Ring thickness (pie is `1`). |
| `sort` | `"desc"` or `"none"`. |
| `centerValue`, `centerLabel` | Donut center. |

## Grids, flows and numbers

### `heatmap`

`x`, `y` categories and `value`. Sequential ramp by default; `midpoint` (or `diverging: true`) for a diverging ramp. Values are written in cells when they fit.

### `sankey`

`from`, `to`, `value` (also detects `source`/`target`). Color starts at the first stage with more than one node and flows downstream.

### `kpi`

`items: [{ label, value, delta, previous, period, good: "up" | "down", trend: [...], target, format }]`. Delta is a fraction (`0.12` → +12%); `good: "down"` for costs. Tiles reflow into balanced rows.
