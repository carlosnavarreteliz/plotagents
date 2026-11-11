# Chart reference

Every chart takes a spec with `data` (rows) plus field names for each role. The options below are specific to each type; the [common options](#common-options) apply to all of them. Every option is also described in [`schema.json`](../schema.json).

## Common options

| Option | Meaning |
|---|---|
| `type` | Chart type or alias. Omit (or `"auto"`) to infer it from the data. |
| `data` | Array of row objects. Also header + rows `[["region", "sales"], ["Biobío", 1240]]` (or `{ columns, rows }`), columns `{ region: [...], sales: [...] }`, CSV/TSV text, `{ A: 1, B: 2 }` and arrays of numbers. |
| `title` | Optional. The finding, as a sentence. Wraps; never truncated. |
| `subtitle` | Optional. How to read the chart: measure, unit, period. |
| `source` | Optional. Data source, shown small at the bottom right. |
| `series` / `hue` | Field that splits the data into colored groups. |
| `highlight` | One name or a list: emphasize these, mute the rest. |
| `colors` | `{ "name": "#hex" }` to pin an entity's color. |
| `format`, `xFormat`, `yFormat` | `"number" \| "compact" \| "percent" \| "currency" \| "integer"` or `{ prefix, suffix, decimals, currency }`. From JavaScript, also a function `(value) => string`: your own number rules for labels, tooltips and axis ticks. In `line`, `area` and `bar`, `yFormat` writes only the value-axis ticks and `format` the labels and tooltips (`yFormat` defaults to `format`). |
| `locale` | `"es"` (default: `1.234,5`), `"en"` (`1,234.5`), `"pt"`, `"fr"` (`1 234,5`), `"de"`, or `"auto"`: recognized from the title, subtitle, column names and categories. Tables use `"auto"` when `locale` is omitted. |
| `xLabel`, `yLabel` | Axis titles (horizontal, never rotated). |
| `xScale`, `yScale` | `"log"` where it makes sense. |
| `xDomain`, `yDomain` | Fixed `[min, max]`. |
| `refLines` | `[{ y: 600, label: "Target" }]` (or `x`, or `value` for bars). |
| `facet` (`col`), `columns`, `sharey`, `sharex` | Small multiples, one panel per value. `sharey: "span"` gives every panel the same span with its own floor, and the same plot size in pixels (axis margins and end-label room are matched across panels), so a slope means the same change in each; `panelNote: 'field'` writes a line under each panel name, and every panel reserves the room it needs, so panels never overlap and keep equal plot heights; `panelColor: true` writes each panel name in its series colour (or `{ panel: color }`, or a function `(panel, rows) => color`); panels leave room for their y tick labels as a lone chart does, the same in every panel; an annotation with `panel` goes only to that panel; `legend: false` hides the shared legend. |
| `time`, `timeValue` | One period at a time: the latest by default, or `timeValue`. The period is appended to the subtitle. |
| `slider`, `play` | Browser time controls, **off by default**. `slider: true` adds period buttons when there are few periods (≤ 8) and a minimal slider when there are many; line and area charts get a two-handle range. `"buttons"` or `"slider"` force one; `play: false` hides the play button. |
| `compare` | With `time`: compare against `"previous"` (default), `"first"`, a given period, or `false`. |
| `theme`, `palette`, `ramp` | See [themes](themes.md). |
| `colorScale` (`cmap`) | Any matplotlib colormap (`"viridis"`, `"RdBu_r"`…) or your own list of colors. See [color scales](colorscales.md). |
| `font`, `textScale` | Typeface (Google Fonts name, CSS stack or `{ family, import }`) and a text-size multiplier (aliases `fontScale`, `labelScale`). Set them for every chart with `configure()`. |
| `width`, `height` | Pixels. Height is automatic for horizontal bars, heatmaps, KPI tiles, and narrow treemaps, sunbursts and radars. |
| `padding` | Margin in px. Default 8 top and bottom, 0 at the sides. A number, `[vertical, horizontal]`, `[top, right, bottom, left]` or `{ top, right, bottom, left }`. |
| `legend` | Position: `"top"` (default), `"bottom"`, `"left"`, `"right"`, or `false` to hide it. Side legends move to the bottom below 520 px. Setting a position also forces a legend where the chart would otherwise label lines directly. |
| `exclude` | One name or a list: drop these legend entries (series, first-level groups) and recompute axes, shares and layout. Colors stay fixed and the excluded entries stay in the legend, faded and struck through. |
| `tooltip` | What each mark says on hover beyond its value: a list of fields (`"Field: value"` lines from the mark's rows), or `{ title, fields: [field \| { field, label, format }], text, replace }` where `text` is a field with pre-written lines, or `false`. From JavaScript, also `(d) => text \| { title, lines }` with `d.rows`, `d.lines`. A mark made of several rows (a treemap group, a year with several series) shows a field only when its rows agree. |
| `href` | Treemap tiles, horizontal bar names and scatter dots link to the URL in this field (paths and http(s) only). |
| `sprite` | Path of an outlines file written once with `mapSprite(spec)`: regions become `<use>`, the page carries no geometry. |
| `xBands` | Shaded ranges of the x axis behind columns, lines and areas: `[{ from, to, label, color }]`. |

### In the browser

- **Tooltips** sit next to the hovered mark, never over the title or subtitle, and stay inside the chart. Their header takes the mark's color, with white or dark text depending on contrast.
- **Legend**: hovering a key highlights its marks; a click pins the highlight. **Shift + click** excludes that entry (click it again to bring it back). In treemaps and sunbursts a plain click zooms the whole plot to that category; click it again, a breadcrumb, or press Esc to go back.

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
| `xGroup` / `yGroup` | Field that groups consecutive categories (either name works, in both orientations): a tinted band with the group name runs along the category axis, with a thin line between groups. Nothing is reordered, so set `sort: "none"` to keep your order. |
| `xTicks` / `yTicks` | `{ every: N }`: label every Nth category (thinned further only if labels still collide). A shown label is cut to the room of N categories, not of one. Date categories thin to calendar steps (months 1, 2, 3, 4, 6, 12…; years 1, 2, 5, 10…), measured on the label widths. |

The value axis always ends on the first round value at or above the largest bar, and that last tick is always labeled, also on a phone: the number of ticks follows the width of their labels.

**Missing values.** A missing value is never a zero: the bar is not drawn, the tooltip says `missingLabel` ("sin dato" / "no data") and `missingMark: "n/a"` writes it at the base. With `stack: "percent"`, a `format` function receives the share as a fraction (0–1).

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
| `points` | Markers on every point (automatic for short series); a list of series names (or `{ series: true }`) puts them only on those. |
| `lineWidths` | Stroke width per series, e.g. `{ "1991–2020 mean": 3.5 }`; the rest keep the default. |
| `stack` | Areas: `true` (default with series), `"percent"`, or `false` to overlap. |
| `fill` | Single line: `false` removes the soft gradient. |
| `xRange` | Visible range `[from, to]`; this is what the range slider sets (`slider: true`). |

**Given intervals and tooltips without a runtime.** `band: { lower: 'lo', upper: 'hi', label: '80% interval' }` draws an interval that comes already computed (a model's projection, a published range) as is, with no estimator, and names it in the legend; it combines with `dashedFrom`. `crosshair: false` (implied by `tooltip`) writes one column per x with its own `data-tip` instead of the browser crosshair, for pages that bring their own tooltip layer.

### `spark` (`sparkline`)

The shape of one series, on its own min–max scale (no zero): it answers "how did it move", and the number next to it says "how much". No axes, grid, labels, legend or title drawn (the title stays in `aria-label` for screen readers), and no minimum size, so it fits a table cell: `width: 108, height: 26`. A dot marks the last value; a missing value is a gap. One invisible strip per x carries the tooltip.

| Option | Meaning |
|---|---|
| `series` | A few lines on one shared scale. |
| `fill` | Soft wash under the line (`true` or an opacity). |
| `dot`, `dotRadius`, `lineWidth` | End dot (`dot: false` hides it) and stroke. |
| `yDomain` | Fix the scale (e.g. to compare sparklines in a column). |

### `rail` (`riel`, `range-rail`)

One row of a distribution, sized for a table cell (`width: 160, height: 18` by default; it works from ~130 to ~330 px): a line from `min` to `max`, the middle `band: [lo, hi]` shaded, a `median` notch, the row's `value` as a dot and any number of reference ticks. It is the `range` column of `table` as a mark of its own, for a page that keeps its HTML table (links, icons, notes, a phone layout) and only needs the rail drawn on the server. No chrome: one invisible box carries a `data-tip` that names every part.

```js
plot({ type: 'rail', data: [row], value: 'chile', min: 'lo', max: 'hi', band: ['q1', 'q3'], median: 'med',
  refs: [{ field: 'region', label: 'Biobío' }, { value: 12, label: 'Target' }],
  valueLabel: 'Chile', minLabel: 'lowestName', maxLabel: 'highestName', clip: true, format: (v) => fmt(v) });
```

| Option | Meaning |
|---|---|
| `data` | One row (the first is drawn). Leave it out when every part is a number. |
| `value`, `min`, `max`, `median` | Each a field of the row or a fixed number. |
| `band` | `[lo, hi]` of the shaded band (e.g. the quartiles). |
| `refs` | Reference ticks: `[{ field \| value, label, color }]`; `label` is text or a field of the row. `ref` + `refLabel` is the one-tick shorthand. |
| `clip` | The scale is `[min, max]`: a value past an end is a chevron at that end (and says so in the tooltip) instead of stretching the scale; a reference past an end is an open chevron. |
| `domain` | The scale, `[from, to]` as numbers or fields (e.g. `["p5", "p95"]`); clips like `clip`. Without `min`/`max` the rail spans the whole domain. `domainLabel` adds a tooltip line naming it. |
| `fallback` | A row with no `min`/`max` and no `domain` has no rail: it prints its figure (`"value"`, default) or nothing (`"none"`), never a lone dot. |
| `valueLabel`, `minLabel`, `maxLabel`, `bandLabel`, `medianLabel` | Names in the tooltip (text or a field of the row). With `minLabel`/`maxLabel` the tooltip lists both ends ("Lowest · Colchane: 7.1") instead of "Range: a–b". |
| `color`, `colors` | The dot's colour; `colors: { rail, band, median, ref, value }` per part. Any colour may be `var(--x, #fallback)`, and `skins` work as in any chart. |
| `format`, `dotRadius`, `tooltip`, `title` | A format (a function from JS), the dot size, extra tooltip fields, and the tooltip heading (also the `aria-label`). |

### `bump` (`rank`, `ranking`) · `slope` (`slopegraph`)

Who passed whom: `x` period, `y` value (ranked per period, largest first) or `rank` with ranks you already have, and `series`. The y axis is the rank, 1 on top. Names go on both ends (rank + name on the left; on phones, the rank alone), and a ▲/▼ at the right end says how many places each series moved. Ties break by name, so the drawing is deterministic.

| Option | Meaning |
|---|---|
| `top` | Keep series that were in the top N at some period (default 12). A rank below N is drawn hollow on a "below N" row; the tooltip has the real rank. |
| `ends` | `"first-last"`: only the first and last period (a slope chart; the `slope` alias sets it). |
| `rank` | Field with ranks already computed (1 = first) instead of ranking `y`. |
| `highlight` | One or more series in color; the rest in `dim`. |

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
| `collapsed`, `collapsible` | Phases drawn as one summary row (duration-weighted progress, milestone diamonds): a list of names or `true`. In the browser a click on a phase toggles it (Alt + click toggles all); the time axis and name column stay put. `collapsible: false` hides the chevrons. |
| `critical`, `criticalColor` | Outline the critical path: tasks with zero slack along `dependsOn` (working days on day dates), with accent arrows. |
| `weekends` | Weekend bands on day-date plans of up to 120 days; `false` turns them off. |

`lint` warns about tasks that end before they start and suggests a `today` line. The alt text names the span, the longest task, the milestones and the overall progress weighted by duration.

## Relationships

### `scatter` · `bubble`

`x`, `y` numeric; `size` for bubbles (area-proportional); `label` field with `labels` (number of points or list of names) for selective labels; `trend: true` adds a least-squares line with R².

`hollow: 'field'` (or `filled`) draws some dots hollow: a second encoding without a second color.

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

### `corr` (`correlation`, `corrplot`) · `clustermap`

Correlation matrix of numeric fields, computed for you from the rows (pairwise complete cases, like `df.corr()`). Each pair appears once, below the diagonal, on a diverging scale fixed at −1 to 1, so the same color means the same strength in every chart. Long labels turn 45°. The tooltip gives r, n and the p-value.

```js
plot({ type: 'corr', data, vars: ['income', 'schooling', 'poverty', 'density'], alpha: 0.05,
  title: 'Where schooling is higher, income is higher (r = 0.85) and poverty lower (r = −0.81)' });
```

| Option | Meaning |
|---|---|
| `vars` | Fields to relate, in order. Default: every numeric field. `y: [...]` works too. |
| `method` | `"pearson"` (default) or `"spearman"` (ranks: monotonic relations, robust to outliers). |
| `triangle` | `"lower"` (default) or `"full"`. |
| `cluster` | Reorder by hierarchical clustering (average linkage on 1 − r) and draw the dendrogram on top. `type: "clustermap"` sets it and shows the full matrix; `dendrogram: false` keeps the order without the tree. |
| `alpha` | Grey out pairs with p ≥ alpha (Fisher's z) and add a legend key. |
| `order` | Variable order (list). |
| `highlight` | One variable: its row and column stay, the rest fade. |
| `labelsFor` | Display names, e.g. `{ areas_verdes: "Green space" }`. |
| `x`, `y`, `value` | Draw a matrix you already computed, in long form (one row per pair). |

### `dendrogram` (`dendrograma`, `hclust`)

How things group, and at what height they join. The tree comes in already computed, either as rows `{ id, parent, height }` (field names in `id`, `parent`, `heightField`; a node with three or more children is drawn as elbows at the same height) or as a scipy `linkage` matrix with its `labels`. The library does not cluster anything itself (`corr` with `cluster: true` does, for correlations).

| Option | Meaning |
|---|---|
| `cut` | Height to cut at: each subtree below it is a group in its own categorical color, named along its leaves with its size; above the cut, grey. A dashed line marks the cut. |
| `clusters` | Group names, in leaf order. |
| `orientation` | `"horizontal"` (root left, default) or `"vertical"` (root on top). |
| `labels` | Leaf labels: `"auto"` (every k-th when they do not fit), `true`, `false`; with `linkage`, the list of leaf names. |
| `label` | Rows input: field with the display name of each leaf. |
| `series` | Rows input: a field that colors each leaf (a swatch at its end and the weight bar), with a legend unless `legend: false`. No `cut` needed; `colors` fixes a category's color. |
| `size` | Rows input: each leaf's weight (how many things hang off it), a bar with its figure beside the name (`sizeFormat` formats it). Each join adds up its leaves. Vertical trees show it in the tooltip only. |
| `sub` | Rows input: a second line under each leaf name (horizontal); each leaf gets twice the height. |
| `xLabel` | Title of the height axis ("Ward merge height": a merge height is not a distance, say what it is). |
| `tooltip` | Through the usual `tooltip` (fields of the leaf's row, `text`, `replace`…). Set it (`true` keeps the default lines) and every join gets a card too: its height, how many leaves, their total weight, and the fields of its own row. |
| `labelWidth` / `treeWidth` | The names column takes at most 30% of the width (120 px vertical); `labelWidth` sets that cap in px. `treeWidth` (horizontal) fixes the tree's width instead and gives the names the rest: `width: 1236, treeWidth: 250`. |

### `pairplot` (`pairs`, `splom`, `scattermatrix`)

Scatter-plot matrix: each pair as a scatter below the diagonal, each variable's distribution on it (histogram, or density with `hue`), and Pearson r above, tinted by strength and split by `hue` group when there is room. Axes are shared by column and row; tick labels sit only on the outer edges.

| Option | Meaning |
|---|---|
| `vars` | Fields to plot (3–6 read best). Default: the first 6 numeric fields. |
| `hue` | Color by group, with a legend. |
| `diag` | `"hist"` or `"kde"`. |
| `upper` | `"corr"` (default), `"scatter"` or `false`. `corner: true` keeps only the lower triangle. |
| `kind` | `"reg"` adds a least-squares line to every scatter panel. |
| `radius`, `bins`, `panelSize` | Point radius, histogram bins, maximum panel size. |

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
| `jitter`, `dodge`, `radius` | Strip and swarm layout. Strip and swarm dots carry their own row's `tooltip` (`{ title, text, replace: true }`). |
| `clamp` | With a value domain (`xDomain` horizontal, `yDomain` vertical): values outside are drawn on its edge, and the edge tick says so ("≤ 0.0001%", "≥ 100%") when some value lies beyond. On a log axis a 0 sits on the low edge. |
| `yLabelPosition` | Horizontal charts: `"above"` writes each row's name above it, left-aligned, so the value axis keeps the full width (a phone). |
| `estimator`, `errorbar` | Point plot: `"mean"`/`"median"`/`"sum"` and `"ci"`/`"sd"`/`"se"`/`"pi"`. |
| `order`, `hueOrder` | Category and group order. |
| `xGroup` / `yGroup`, `xTicks` / `yTicks` | Grouped category axis and thinned category labels, as in `bar`. |

### `dotplot` (`dot-plot`, `wilkinson`)

One dot per row, stacked by bin (Wilkinson): a histogram where each thing is still one thing, to point at, name and highlight. `x` numeric is binned; `x` categorical stacks per category.

| Option | Meaning |
|---|---|
| `bin`, `bins` | Bin width in units of `x`, or a number of bins (default 30). |
| `label` | Field with each dot's name (tooltip, and the label of a highlighted dot). |
| `series` | Dot colors. |
| `highlight` | A name (or list): that dot gets a ring and its name; the rest go lighter. |
| `ticks` | Your own axis ticks: `[[500000, "$500k"], [1000000, "$1M"]]`. |
| `dotSize` | Largest dot diameter in px (default 14); a dot is also never wider than its bin. |
| `dotRadius` | The dot radius in px, without the bin-width cap: a fine bin in a narrow box keeps readable dots (neighbouring bins may touch). With an explicit `height` it still shrinks so the tallest stack fits. |
| `refLines` | Reference values that are not one more dot (the national figure): `[{ x: 18.4, label: "Chile" }]`, drawn as a vertical line behind the dots with its label on top (`label · value`; `showValue: false` writes the label alone, on the line and in the tooltip) and its own tooltip. `dash: true` dashes the line (3 3), or give an SVG pattern (`"4 2"`). `x` may be a field whose rows all hold the same value (with `facet`, each panel's own). The axis widens to include it. |

## Part-to-whole

### `treemap` · `sunburst`

`path: [level1, level2, …]` of any depth (or `group` + `label`), `value`. Rows with the same path are summed.

| Option | Meaning |
|---|---|
| `depth` | Show only the first N levels. |
| `focus` | Path to drill into, e.g. `["Mining"]`. In the browser, clicking a group or its legend key does it (the category fills the whole plot) and breadcrumbs or Esc go back. |
| `exclude` | Level-1 groups to leave out; the rest fill the plane and shares are recomputed. Shift + click on a legend key does it in the browser. |
| `showValues` | Append values to the labels. |
| `tileLabels` | `"wrap"`: a long name goes on as many lines as the tile's height allows, with its share under it whenever that fits at some size; then the name alone; as a last resort it is cut with "…". Default `"auto"`: a name only when it fits whole. A share under 0.05% prints as "<0.1%", never "0%". |
| `shareOf` | With `focus`: what share each tile prints, `"group"` (default), `"total"` or `"both"` ("53% · 11% of total"). When the figure does not fit, a shorter one instead of none: `"both"` falls back to the group share, `"total"` to the bare figure (the tooltip says what it is a share of). |
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

### `waffle` (`squares`, `unit-chart`)

A count drawn as squares: one square per row, or per unit of `value`, by `series`, largest first, filled row by row. The part reads as a number of things, not only a share. When the total passes `maxSquares` (400), each square is worth a round `unit` and the legend says so ("1 square = 5"); squares per series are split by largest remainder, so they always add up to the rounded total. The legend carries each count; one tooltip per series with count and share. `facet` gives one wall per value.

| Option | Meaning |
|---|---|
| `value` | Field to add up (otherwise one square per row). |
| `unit`, `maxSquares` | What a square is worth; when the round unit kicks in. |
| `perSquare` | Each square is its own mark (a `<rect>`, with `rx` when rounded) with its own row's tooltip (one check, one person), in data order within each series; pair it with `tooltip: { title, text, replace: true }`. Only while a square is one unit; past `maxSquares` it falls back to one tooltip per series. |
| `columns` | Squares per row (default 10, 20 or 25 by total). |
| `cellRadius` | Corner radius of each square in px; `0` for square corners (default: the theme's bar radius, at most a quarter of the square). |
| `order` | Series order (default: largest first). |

## Maps

### `choropleth` (`map`) · `symbolmap` (`bubblemap`)

Chilean regions (`geo: "chile"`, default), US states (`geo: "usa"`) and world countries (`geo: "world"`) ship with the library, and **any geometry of your own** works too (see below). `key` is the data field to match and `value` the measure; a text `value` (a party, a language, a zone) colors by category with a legend of swatches. Matching is forgiving: names, codes and aliases, ignoring accents, case and "Región de" ("RM", "Biobio", "XIII", "Aisén", "ARG", "EE.UU.", "TX", "Nueva York", "48").

**United States.** 50 states and DC in an Albers equal-area projection (`albersUsa`, the same composite as `d3.geoAlbersUsa`): Alaska (at 0.35×) and Hawaii sit in insets at the bottom left with a fine dashed frame; Puerto Rico gets its own inset only when the data includes it (`territories: true` forces it). Each state shows its postal code, plus the value when it fits; the small northeastern states (VT, NH, MA, RI, CT, NJ, DE, MD, DC) are labeled in a column on the right with leader lines. `values: false` keeps only the codes; `labels: false` removes them.

| Option | Meaning |
|---|---|
| `geo` | `"chile"`, `"usa"`, `"world"`, a name registered with `registerGeo()`, a GeoJSON or TopoJSON object, paths already projected (`{ paths, points?, names? }`), or (browser) a URL. |
| `featureKey`, `nameKey` | Feature property to match, and the one with the display name (both detected when omitted). |
| `fitTo` | Zoom to regions, a `[lonMin, latMin, lonMax, latMax]` box, `"markers"`, or `"mainland"` (far islands and claims out of the frame). |
| `views` | Several readings (indicators, years) of one geometry in one SVG; the page flips `data-view`. See below. |
| `pathPrecision`, `simplify` | Compact paths: relative, rounded to `pathPrecision` decimals, simplified on screen with a tolerance in pixels. |
| `microstates` | World: Singapore, Malta, Bahrain and 71 more drawn as dots (`true`: those with data; `"all"`). |
| `href` | Data field with a URL: each region links to it (paths and http(s) only). |
| `links` | Lines between places, above the regions: `[{ from, to, value }]` or `{ data, from, to, value, color, curveness, width: [min, max], opacity, label }`. Ends are region keys or `[lon, lat]`. |
| `orientation`, `rotate` | `"landscape"` lays a tall territory on its side, north on the left; `"portrait"` stands a wide one up; `rotate: 90 \| -90 \| 180` turns the projected map clockwise. Labels stay upright. |
| `markers`, `layers` | Points by lon/lat on top; extra GeoJSON lines, polygons or points over or under the map. |
| `scale`, `classes` | `"quantile"` (default), `"equal"`, `"continuous"` or a list of breaks; 5 classes by default. |
| `midpoint` / `diverging` | Diverging classes around a value (e.g. 0 for changes). |
| `missing` | `"plain"` drops the hatch and the "No data" legend entry; `"context"` also drops the tooltip (regions drawn only as surroundings). |
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

- **Matching without configuration.** Rows are matched against the usual keys (code, id, ISO-2, ISO-3, name, aliases); if some rows don't match, plotagents finds the feature property whose values do (`NOM_COM`, `CUT_REG`, `GEOID`, `ADMIN`…). `featureKey` forces one. Display names come from `nameKey`, or the first of `name`, `NOMBRE`, `NAME_1`, `ADMIN` and similar.
- **Projections.** Picked from the geometry: Mercator for a country or region, Equal Earth for the world, and a plain cartesian plane when coordinates are not longitudes and latitudes (UTM metres, for instance). Set `projection` to `"equirectangular"`, `"conic"` (or `{ type: "conic", parallels: [-30, -45], rotate: 72 }`), `"identity"` (coordinates used as they are, y down, for pre-projected or hand-drawn maps; `flipY: true` for y up) or `"planar"` (y up).
- **Framing.** `fitTo` zooms to some regions, a box `[lonMin, latMin, lonMax, latMax]` or `"markers"`; the rest of the map stays as clipped context. `fitTo: "mainland"` leaves out far islands and claims (Rapa Nui, Juan Fernández, Antarctica), found by the sea gap that separates them rather than by a list. `tall: false` turns off the side column for elongated shapes.
- **Markers.** `markers: [{ lon, lat, label, value }]` or `{ data, lon, lat, label, size, color, legend, maxRadius }`: dots on top, area-proportional when there is a `size`, labels placed where they don't collide.
- **Lines between places.** `links: { data: trade, from: 'origin', to: 'partner', value: 'usd' }` draws one curved line per row from region to region (or `[lon, lat]`), width proportional to the value, one color, no arrowheads: a line is a relation, not a route. Each line is a mark with its own tooltip and `data-key="from→to"`; ends that match no region are listed in the description instead of being drawn. With `labels: false` the map carries no text at all.
- **Lying down.** `orientation: "landscape"` turns a long, thin territory (Chile, Norway, Vietnam, a river basin) a quarter turn after projecting, north on the left so north-to-south reads left to right; framing, hit areas, markers and links follow, and labels stay upright. `rotate: 90 | -90 | 180` sets the turn by hand.
- **Keys for your page.** Every region, link and marker carries `data-key`: the key your data used for it (a CUT code, an ISO code, a name), or its code or name when it has no data. A page can wire its own lists and highlights to them.
- **Layers.** `layers: [{ geo, label, stroke, width, fill, dash, opacity, below }]` overlays rivers, roads, routes, faults or district lines (or draws them under the regions with `below: true`). A `label` adds a legend key.
- **Style.** `borderColor`, `borderWidth`, `pointRadius`, `lineWidth`, `ramp` (a named or custom sequential ramp), `palette` and `colors` (categories).
- **Register once, use by name.** `registerGeo('biobio', comunas, ['comunas-biobio'])` and then `geo: 'biobio'` in every spec, which keeps tool calls short for an agent.

#### Maps for a static site: projected paths, views and no library in the browser

A site that builds its pages ahead of time can draw every map on the server and ship finished SVG, with nothing of plotagents in the browser.

**Paths projected at build time.** `geo: { paths: { id: "M…Z" }, points?: { id: [x, y] }, names?: { id: name } }` takes SVG path strings already projected and simplified (a `map.json` with one outline per comuna), in pixels with y down. No TopoJSON and no projection run: each path is read to points (`M L H V Z C S Q T A`, absolute or relative) and framed, turned (`orientation: "landscape"`), keyed and colored like any map. A value may be `{ d, at: [x, y] }`, where `at` anchors lines; `points` are places too small for an outline, drawn as dots of `pointRadius`.

**Compact paths.** A detailed map weighs what its coordinates weigh. `pathPrecision: 1` (decimals, in pixels) writes relative commands rounded to that grid, and `simplify: 0.5` drops points within half a pixel of the line (Douglas–Peucker on screen). On the 345 comunas of Chile at 1,180 px, the paths go from 516 KB to 176 KB (39 KB gzipped) with no visible change. Without these options paths are written as always.

**Outlines in a file of their own.** A site that shows the same map on hundreds of pages need not repeat its outlines on each. `mapSprite(spec)` writes an SVG with one `<path id>` per region, projected but not framed (its longer side measures 1000); publish it once (`/maps/chile.svg`) and the browser caches it. With `sprite: "/maps/chile.svg"`, each region is a `<use href="/maps/chile.svg#id">` inside a group whose transform frames and turns the file, so one file serves the wide map, the phone map and every framing (`fitTo` a region). Colors, view classes, tooltips and links stay on the `<use>`; dots are still drawn inline. Chile's 345 comunas: the file is 90 KB (26 KB gzipped); each map on a page is 98 KB (12 KB gzipped) with one view, 31 KB gzipped with six. A file loaded from another origin needs CORS, and an SVG opened on its own (in an `<img>`) does not load it.

**Views.** `views: [{ id, label, value, … }, …]` draws several readings of one geometry in one SVG. Each view is a patch of the spec (`value`, `data`, `format`, `colorScale`, `scale`, `classes`, `thresholds`, `colors`, `legendTitle`, `tooltip`, plus `highlight` and `links` for that view only). The first view is drawn as usual. Every other view travels as data: one class per region and view (`pv2-3`: view 2, color class 3), its tooltip in `data-vtip-<id>`, and a `<style>` inside the SVG that paints the view named by `data-view` on the root and hides the other views' legends, labels and lines. Skins and `var(--x, fallback)` colors work as in any chart. Views cannot change the shapes or the frame (`geo`, `key`, `fitTo`, `orientation`, `width`, `title`…).

```js
plot({
  type: 'choropleth', geo: { paths: map.paths, names: map.label }, data: comunas, key: 'id',
  orientation: 'landscape', fitTo: 'mainland', pathPrecision: 1, simplify: 0.5, href: 'url',
  views: [
    { id: 'inmigrantes', label: 'Foreign-born', value: 'pct_inmigrantes', format: { suffix: '%' } },
    { id: 'mayores', label: 'Aged 65+', value: 'pct_65_mas', highlight: 'c05101' },
  ],
});
```

Switching is one attribute. `plotagents/views` (1.2 KB minified, 0.6 KB gzipped, no dependencies) does it and moves each view's tooltip to `data-tip`, which is what any hover layer reads:

```js
import { setView, bindViews } from 'plotagents/views';
setView(document.querySelector('#map'), 'mayores');
bindViews(document);   // <button data-set-view="mayores"> switches the maps on the page
```

**The world.** Countries match by ISO-2 (`"CL"`), ISO-3 or name. `microstates: true` draws as a dot the states too small for an outline at this scale (Singapore, Malta, Bahrain, Hong Kong…; `"all"` draws every one); lines reach them like any country. **Links** stay what they were: a line is a relation, not a route.

In the browser (`render()` or `toHTML()`), maps are interactive: hovering outlines the shape; clicking a region zooms to fit it (click again, double-click, Esc or the reset button to go back); Ctrl/⌘ + scroll zooms around the pointer (plain scroll keeps scrolling the page, as `chartjs-plugin-zoom` recommends with its `modifierKey`); pinch zooms on touch screens; drag pans when zoomed; +/− buttons work from the keyboard. Each color class in the legend is a key: hover it to light up its regions, click to pin. With `time`, every region's color transitions into the next period's instead of jumping, and the zoom is kept while the slider plays.

`lint` warns about rows that match no region or country. Sources: Natural Earth 1:110m (public domain) for the world; Biblioteca del Congreso Nacional for Chilean regions (attribution in `src/geo/data/chile-regiones.js`); U.S. Census Bureau cartographic boundaries 1:10m (public domain) via us-atlas 3.0.1 for US states. In the browser, `dist/plotagents-geo.js` adds the geometries; `toHTML()` includes it only when a page has a map.

### `pointmap` (`dotmap`, `tilemap`)

Dots at longitude/latitude over a real basemap in Web Mercator. Fields `lon`/`lat` are found by name (lon, lng, longitude, longitud / lat, latitude, latitud). `size` → circle area (key in the corner, largest labeled); `hue` → category colors with a legend; numeric `value` → sequential ramp (`midpoint` for diverging, `colorScale` for any matplotlib map). Zoom and center fit the points (`zoom`, `center: [lon, lat]` to fix them).

```js
plot({ type: 'pointmap', data: cities, lon: 'lon', lat: 'lat', size: 'population', label: 'city',
  title: 'Santiago concentrates 40% of the population', source: 'INE' });
```

| Option | Meaning |
|---|---|
| `tiles` | `"osm"` (default, OpenStreetMap), `"esri-gray"`, `"esri-dark"`, `"carto-light"` / `"carto-dark"` (free key: carto.com/basemaps/apikey), `"mapbox-light"` / `"mapbox-dark"` (public `pk.` token in `tilesKey`; `sk.` tokens are refused), `{ url, attribution, subdomains, maxZoom, retina }`, or `false` (vector world outline only). |
| `tilesKey` | Key or token for CARTO, Mapbox or Esri. |
| `tileStyle` | `"muted"` (default) desaturates and tints the tiles to the theme (a navy night map on `noche`); `"original"` keeps them as they are. |
| `tileOpacity`, `zoom`, `center` | Tile opacity, fixed zoom level and `[lon, lat]` center. |
| `labels`, `labelValues` | How many dots to name (8 largest by default), or a list; `labelValues: false` hides values. |

The attribution is always drawn. Tiles are external images: they show in inline SVG, `render()` and `toHTML()`, **not** when the SVG is used as `<img>`, opened from a PDF converter, or offline; then the vector world outline underneath still gives context. `await embedTiles(svg)` inlines them as data: URIs (not for OSM, whose tile policy forbids bulk downloads; use `esri-gray` or your own server). It only fetches https images from public hosts (no localhost or private IPs, no redirects, at most 2 MB per tile); pass `{ hosts: ['tiles.example.com'] }` to allow only your own servers. For heavy traffic, use a provider with a key or your own tiles: OSM's servers are donated.

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

Edges in `data` (`from`, `to`, optional `value`), optional `nodes` with `id`, `group` and `size`. Node area ∝ weight (weighted degree by default), color by group; edges curve in the color of their source node (`curveness`, default 0.3; `0` = straight), 1 px wide without a value field. The largest nodes are named (ink with a halo, never overlapping each other or a node); every name is in the tooltip. Hovering a node lights up its neighbors and their edges.

`layout` picks the placement (all deterministic, all fitted to the area):

| `layout` | Placement |
|---|---|
| `force` (default) | Force-directed (Barnes–Hut above 150 nodes). |
| `circular` (`circle`) | Around a circle by group, a gap between groups, names rotated outward. |
| `radial` | A tree from `focus` (or the most connected node); each ring is one step further. Links outside the tree are faint. |
| `concentric` | Rings by weight, the largest in the centre, by group within each ring. |
| `clusters` | One sunflower cluster per group, space ∝ √size. |
| `tree` | The radial tree laid flat (left → right on wide areas), S-shaped connectors. |
| `grid` | A grid ordered by group and weight, every node named. |
| `preset` | Positions you already have (MDS, UMAP, t-SNE, Gephi): `nodes` bring `x` and `y` (`nodeX` / `nodeY` for other field names), fitted with one scale for both axes so the cloud is not stretched; y grows downward unless `flipY: true`. Edges are optional: `nodes` alone draws a positioned scatter with sizes, groups and non-overlapping names. |

`labels` (number, list or `true`), `highlight` (a node and its neighbors), `focus` (a node id: it goes to the center, or the root in `radial`/`tree`, and is highlighted with its neighbors, all labeled; in the browser a click does it with a smooth transition, and a second click or Esc returns), `iterations`, `maxRadius`, `curveness`.

A map you already computed (the product space, a knowledge network) usually wants the nodes to carry the meaning and the edges to recede:

| Option | Meaning |
|---|---|
| `filled` / `hollow` | A field of `nodes` (or a list of ids): those nodes stay filled (or go hollow), the rest are rings of the same color with the background inside. A second encoding without a second color, e.g. the groups one institution specializes in, lit on the same map. Filled nodes are named first; hollow ones in a muted ink. |
| `edgeColor` | `"source"` (default), `"neutral"` (the theme's muted ink) or any color, `var(--line, #e0d6c4)` included. `colors["a→b"]` still pins one edge, drawn on top. |
| `edgeOpacity` / `edgeWidth` | One number for every edge, or `[min, max]` scaled by value (opacity linearly, width by the square root). |
| `stretch` | `layout: "preset"` only: x and y are scaled apart to fill the area, for positions already normalized per axis (0–1 MDS). |
| `minRadius` | Smallest node radius in px (default 2.5). |
| `labelWidth` | Widest node name in px before it is cut with "…" (default 150). |
| `edgeTip` | `false` writes no tooltip on the edges (`tooltip: false` also drops them). Hundreds of edges, each with its own text, weigh more than the drawing. |
| `href` | A field of `nodes` with a URL: each node is a link. |

### `chord`

`from`, `to`, `value` rows, or `matrix` + `names`. `directed` (default false), `sort`, `ribbonColor: "smaller" | "larger" | "source"`, `labelOrientation: "radial"`.

### `flowchart` (`flow`, `diagram`)

`nodes` with `id`, `label`, `type` (`start`, `end`, `process`, `decision`, `data`, `note`), optional `lane` (swimlanes) and `group`; `edges` (or `data`) with `from`, `to` and an optional `label` ("Yes"/"No"). Layered layout with automatic direction (`direction: "TB" | "LR"`), orthogonal connectors with arrows, loops routed around the side. `nodeWidth`, `swimlanes: false`.

## Grids, flows and numbers

### `heatmap`

`x`, `y` categories and `value`. Sequential ramp by default; `midpoint` (or `diverging: true`) for a diverging ramp. Values are written in cells when they fit.

| Option | Meaning |
|---|---|
| `colorScale: { colors, breaks }` | Discrete classes instead of a gradient ([color scales](colorscales.md#classes)); the legend becomes a stepped key with the breaks written under it, formatted with `format`. |
| `midClass: "neutral"` | With breaks around 0, the class that contains 0 is drawn in the neutral tint: cells that barely move are not painted. `midClass: { color }` paints it in that color instead, so a skin patch can set it without replacing the theme. |
| `missingLabel` | What the tooltip of a cell without a value says (default `"—"`): `"no data"`. |
| `missing` | Cells without a value: `"tint"` (default), `"plain"` (outline only), `"hatch"` (striped "no data") or `"gap"` (nothing). |
| `floor` / `ceiling` | Values below / above are drawn as plain empty cells: the value exists (the tooltip shows it) but it is not colored and does not stretch the scale. |
| `emptyRow` | Text written across a row that has no values at all (`"no data"`), instead of a row of empty cells. |
| `xGroup` / `yGroup` | Group consecutive columns / rows: a tinted band with the group name along the axis. A name that does not fit is cut, with the whole name in its tooltip. |
| `groupColors` | `{ [group]: color }`: each colored group gets a 3 px stripe of its color on the edge of its band that faces the grid (a family's hue under its sectors), instead of the alternate tint. |
| `cornerLabel` | A title in the empty corner where row labels meet column labels: `"born in ↓ / lives in →"`; `"\n"` breaks it into lines. The row-label column widens to fit it (same cap); what does not fit is cut, whole in the tooltip. |
| `xTicks` / `yTicks` | `{ every: N }`: label every Nth column / row (years every 10, say). |
| `rowTip` | Tooltip of each row label, from this field: what belongs to the whole row and need not repeat in every cell. From JS, also a function of the label. |
| `rowHref` / `colHref` | Row / column labels link to the URL in this field (paths and http(s) only). From JS, also a function of the label. |
| `xLabelAngle`, `xLabelPosition` | Column labels turned (`-90` upright, `-45` slanted) when they do not fit side by side, under the grid (default) or over it (`"top"`). The strip grows to fit; a label cut short keeps its full name in the tooltip. |
| `cellGap` | Space between cells in px (default `2`); `0` joins them with square corners; `[x, y]` per axis. |
| `diagonal` | Cells where `x` equals `y` (stayed in the same region) drawn apart: their own color, outside the color scale (so a huge diagonal does not flatten the rest), a legend entry and a tooltip line. `true`, a label, or `{ label, color, opacity }`. A missing value stays "no data". |
| `cellColor` | A field naming each cell's class ("Revised"); those cells take `colors[class]`, outside the scale, with a legend entry and a tooltip line. A value written as a color is used as is. |
| `labelFormat` | Format of the numeral inside the cells only (tooltip and legend keep `format`). A function returning `""` leaves a cell without a numeral. |

```js
plot({ type: 'heatmap', data, x: 'livesIn', y: 'bornIn', value: 'people',
  diagonal: { label: 'Born and lives here', color: '#7A3E9D' },
  xLabelAngle: -90, xLabelPosition: 'top', rowHref: 'url', cellGap: 0 });
```

### `sankey`

`from`, `to`, `value` (also detects `source`/`target`). Color starts at the first stage with more than one node and flows downstream.

`nodes: [{ id, label, sub, color, column, tip }]` keeps an id apart from its label, so the same place can sit in two stages without merging or making a cycle; `sub` is the second line under the name, `column` fixes the stage. `order: "given"` keeps the order of `nodes`, `stages: ["Region", "Office", "Country"]` heads the columns, `linkColor: "source" | "target"` (or one per stage) colors the flows, and `colors["from→to"]` pins one. Link paths are written with two decimals; `pathPrecision: 1` (or 0) writes fewer.

Many small nodes stack within a few pixels of each other and their names overprint. `relax: true` separates the labels of each column: every node gets its name and second line, each label moves as little as possible to keep 31 px from its neighbors (a number sets another distance; below 28 px labels are one line), and a label that ended up away from its node gets a thin leader line back to it. Without `height`, the chart grows until the labels fit; with `height`, labels that do not fit drop to one line, then squeeze.

### `wordcloud` (`words`, `tagcloud`, `nube`)

Words sized by frequency, done carefully: every word horizontal; each word's **area** proportional to its count (font size grows with the square root); a deterministic spiral layout from the most frequent word outwards, with no collisions; one hue that darkens with frequency, or one color per `series` with a legend. If the important words don't fit, the whole cloud shrinks; the words that still don't fit are named in the alt text, never cut off.

```js
plot({ type: 'wordcloud', data, text: 'word', value: 'mentions', title: '“Data” dominates what companies ask for' });
plot({ type: 'wordcloud', text: openAnswers, title: '…', subtitle: 'Mentions in 312 open answers' });  // raw text
```

| Option | Meaning |
|---|---|
| `text` | Field with the words, or the raw text to count (a string or a list of strings). Raw text drops Spanish and English stopwords and numbers. |
| `textField` | A field of free text in each row (open survey answers): words are counted across rows. |
| `value` | Weight of each word (default: 1 per row, summed). |
| `series` | Color by group, with a legend. |
| `top` | Most words to show (default 80). |
| `stopwords`, `minLength` | Extra words to ignore; shortest word kept (default 3). |
| `minFont`, `maxFont` | Font size range. |
| `highlight` | Words to emphasize; the rest are muted. |

A cloud is good at "what comes up most" and bad at "by how much". `lint` suggests a bar chart (`top: 15`) when there are few words, and asks for a `subtitle` that says what was counted.

### `kpi`

`items: [{ label, value, delta, previous, period, good: "up" | "down", trend: [...], target, format }]`. Delta is a fraction (`0.12` → +12%); `good: "down"` for costs. Tiles reflow into balanced rows.

## Tables

### `table` (`tabla`, `datatable`)

For when the reader needs to look up the exact number. Thin rules between rows and nothing else; numbers right-aligned in tabular figures with the same decimals down each column; empty cells as a dash. Each column gets the indicator that explains it.

```js
plot({
  type: 'table',
  title: 'Two of six projects are already over budget',
  data: projects,
  columns: ['project', 'area',
    { field: 'progress', type: 'progress' },
    { field: 'spent', label: 'Spent / budget', type: 'progress', target: 'budget', good: 'down' },
    'status'],
  sortBy: 'progress',
});
```

| Column `type` | Draws | Inferred when |
|---|---|---|
| `bar` | Value + data bar on a shared scale (diverging around 0) | The main numeric column (`value`/`y`, or the first number); `bars: false` turns it off |
| `delta` | ▲ / ▼ + signed change, green or red by `good` (`"down"` for costs) | Field named var, change, delta, growth, yoy, cambio, variación… |
| `heat` | Cell tinted by a sequential scale (diverging when it crosses 0); `colorScale` per column | — |
| `sparkline` | Mini line, last point in the accent | The field holds lists of numbers |
| `progress` | Percent + meter; against `target` (field or number) or as 0–1 / 0–100 | Field named progress, avance, completion…, or meta/target/goal with fractions |
| `badge` | Status pill | Values are status words (done, at risk, late, in progress… in es/en/pt/fr/de): good, warning, critical, info colors |
| `check` | ✓ or a dash, with an accessible label | Booleans, or sí/no, yes/no… |
| `date` | Readable date in the chart's language | ISO dates |
| `link` | Underlined link: `http(s)` and `mailto` open in a new tab; a site path (`"/es/…"`, `"./x"`, `"#y"`) links in the same tab; anything else is text. `text: 'field'` shows another field instead of the URL | URLs |
| `rank` | Position under the current sort | `rank: true` |
| `range` | A rail: the row's value as a dot on `min`–`max`, a shaded `band: [lo, hi]`, a `median` notch and a `ref` tick (each a field or a fixed number). The tooltip lists every part; `refLabel` and `bandLabel` name them. `scale: "row"` gives each row its own scale (indicators in different units); the default is one scale for the column. `refs: [{ field \| value, label }]` adds several labelled ticks; `clip: true` cuts the scale to min–max and `domain: [from, to]` (numbers or fields, e.g. p5–p95) to any span, drawing what falls past an end as a chevron; `minLabel`, `maxLabel`, `medianLabel`, `domainLabel` name the parts. A row without `min`/`max` in a column that has them prints only its number. Same drawing as the `rail` type | — |
| `text`, `number` | Text (wraps to 2–3 lines) and plain numbers | Everything else |

| Option | Meaning |
|---|---|
| `columns` | Order and type: field names or `{ field, label, type, format, align, width, good, target, colorScale, total, lines }`. Omit to use every field. `x`/`label` picks the row-name column and `y` a list of value columns. |
| `formatBy` (column) | One format per row, for a table of indicators in different units (percent, count, money): a field whose value is a format (`"percent"`, `{ suffix: " yrs", decimals: 1 }`; decimals inferred among the rows that share it) or, from JS, a function `(value, row) => text`. Works on `number`, `bar`, `heat`, `delta` and `range` (cell, tooltip and card); a `range` column gets `scale: "row"`, and the column has no total. |
| `sortBy`, `sort` | Column and direction (`"desc"` for numbers, `"asc"` for text by default). `sort: "-sales"` works too. Empty cells always go last. |
| `pageSize`, `page` | Up to 15 rows are shown whole; beyond that, pages of 10. `pageSize: false` shows everything. The pager is numbers and arrows only (`11–20 / 248`, `‹ 1 2 3 … 25 ›`). |
| `query` | Keep rows that contain these words, ignoring accents and case. |
| `total` | Totals row: sums numbers, averages percents and progress, leaves changes blank. `{ sales: "mean" }` per column; `totalLabel` renames it. |
| `group` | Rows under a tinted band per value, with a count. |
| `highlight` | Rows whose name matches get a tint and an accent mark; the bars of the other rows are muted. |
| `top` | Keep the first N rows after sorting. |
| `cards` | `"auto"` (default) turns each row into a card when the columns do not fit (phones): name and main value on top, the bar under them, the other columns as label–value lines. `true` always, `false` never. |
| `density`, `striped` | `"compact"` / `"comfortable"` rows; zebra stripes for very wide tables. |
| `missingLabel` | What a missing cell (and its tooltip) prints instead of the dash: `"no data"`. |

In the browser `render()` adds a search box above 20 rows (`search: false` hides it; `true` forces it), click-to-sort headers (natural order, reversed, then the original order), and page buttons; all of them work from the keyboard and announce `aria-sort` and `aria-current`. Resizing re-renders at the new width, so a table becomes cards on a phone and columns again on a desktop.

The language of the few words a table writes (Total, Search, No results) and the number format come from `locale`; without it, the table recognizes the language from its own title, headers and categories.

