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
| `format`, `xFormat`, `yFormat` | `"number" \| "compact" \| "percent" \| "currency" \| "integer"` or `{ prefix, suffix, decimals, currency }`. From JavaScript, also a function `(value) => string`: your own number rules for labels, tooltips and axis ticks. |
| `locale` | `"es"` (default: `1.234,5`), `"en"` (`1,234.5`), `"pt"`, `"fr"` (`1 234,5`), `"de"`, or `"auto"`: recognized from the title, subtitle, column names and categories. Tables use `"auto"` when `locale` is omitted. |
| `xLabel`, `yLabel` | Axis titles (horizontal, never rotated). |
| `xScale`, `yScale` | `"log"` where it makes sense. |
| `xDomain`, `yDomain` | Fixed `[min, max]`. |
| `refLines` | `[{ y: 600, label: "Target" }]` (or `x`, or `value` for bars). |
| `facet` (`col`), `columns`, `sharey`, `sharex` | Small multiples, one panel per value. |
| `time`, `timeValue` | One period at a time: the latest by default, or `timeValue`. The period is appended to the subtitle. |
| `slider`, `play` | Browser time controls, **off by default**. `slider: true` adds period buttons when there are few periods (≤ 8) and a minimal slider when there are many; line and area charts get a two-handle range. `"buttons"` or `"slider"` force one; `play: false` hides the play button. |
| `compare` | With `time`: compare against `"previous"` (default), `"first"`, a given period, or `false`. |
| `theme`, `palette`, `ramp` | See [themes](themes.md). |
| `colorScale` (`cmap`) | Any matplotlib colormap (`"viridis"`, `"RdBu_r"`…) or your own list of colors. See [color scales](colorscales.md). |
| `font`, `textScale` | Typeface (Google Fonts name, CSS stack or `{ family, import }`) and a text-size multiplier (aliases `fontScale`, `labelScale`). Set them for every chart with `configure()`. |
| `width`, `height`, `padding` | Pixels. Height is automatic for horizontal bars, heatmaps, KPI tiles, and narrow treemaps, sunbursts and radars. |
| `legend` | Position: `"top"` (default), `"bottom"`, `"left"`, `"right"`, or `false` to hide it. Side legends move to the bottom below 520 px. Setting a position also forces a legend where the chart would otherwise label lines directly. |
| `exclude` | One name or a list: drop these legend entries (series, first-level groups) and recompute axes, shares and layout. Colors stay fixed and the excluded entries stay in the legend, faded and struck through. |

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
| `xRange` | Visible range `[from, to]`; this is what the range slider sets (`slider: true`). |

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
| `jitter`, `dodge`, `radius` | Strip and swarm layout. |
| `estimator`, `errorbar` | Point plot: `"mean"`/`"median"`/`"sum"` and `"ci"`/`"sd"`/`"se"`/`"pi"`. |
| `order`, `hueOrder` | Category and group order. |

## Part-to-whole

### `treemap` · `sunburst`

`path: [level1, level2, …]` of any depth (or `group` + `label`), `value`. Rows with the same path are summed.

| Option | Meaning |
|---|---|
| `depth` | Show only the first N levels. |
| `focus` | Path to drill into, e.g. `["Mining"]`. In the browser, clicking a group or its legend key does it (the category fills the whole plot) and breadcrumbs or Esc go back. |
| `exclude` | Level-1 groups to leave out; the rest fill the plane and shares are recomputed. Shift + click on a legend key does it in the browser. |
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

The attribution is always drawn. Tiles are external images: they show in inline SVG, `render()` and `toHTML()`, **not** when the SVG is used as `<img>`, opened from a PDF converter, or offline; then the vector world outline underneath still gives context. `await embedTiles(svg)` inlines them as data: URIs (not for OSM, whose tile policy forbids bulk downloads; use `esri-gray` or your own server). For heavy traffic, use a provider with a key or your own tiles: OSM's servers are donated.

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

`labels` (number, list or `true`), `highlight` (a node and its neighbors), `focus` (a node id: it goes to the center, or the root in `radial`/`tree`, and is highlighted with its neighbors, all labeled; in the browser a click does it with a smooth transition, and a second click or Esc returns), `iterations`, `maxRadius`, `curveness`.

### `chord`

`from`, `to`, `value` rows, or `matrix` + `names`. `directed` (default false), `sort`, `ribbonColor: "smaller" | "larger" | "source"`, `labelOrientation: "radial"`.

### `flowchart` (`flow`, `diagram`)

`nodes` with `id`, `label`, `type` (`start`, `end`, `process`, `decision`, `data`, `note`), optional `lane` (swimlanes) and `group`; `edges` (or `data`) with `from`, `to` and an optional `label` ("Yes"/"No"). Layered layout with automatic direction (`direction: "TB" | "LR"`), orthogonal connectors with arrows, loops routed around the side. `nodeWidth`, `swimlanes: false`.

## Grids, flows and numbers

### `heatmap`

`x`, `y` categories and `value`. Sequential ramp by default; `midpoint` (or `diverging: true`) for a diverging ramp. Values are written in cells when they fit.

### `sankey`

`from`, `to`, `value` (also detects `source`/`target`). Color starts at the first stage with more than one node and flows downstream.

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
| `link` | Underlined link; only `http(s)` and `mailto` get an `href` | URLs |
| `rank` | Position under the current sort | `rank: true` |
| `text`, `number` | Text (wraps to 2–3 lines) and plain numbers | Everything else |

| Option | Meaning |
|---|---|
| `columns` | Order and type: field names or `{ field, label, type, format, align, width, good, target, colorScale, total, lines }`. Omit to use every field. `x`/`label` picks the row-name column and `y` a list of value columns. |
| `sortBy`, `sort` | Column and direction (`"desc"` for numbers, `"asc"` for text by default). `sort: "-sales"` works too. Empty cells always go last. |
| `pageSize`, `page` | Up to 15 rows are shown whole; beyond that, pages of 10. `pageSize: false` shows everything. The pager is numbers and arrows only (`11–20 / 248`, `‹ 1 2 3 … 25 ›`). |
| `query` | Keep rows that contain these words, ignoring accents and case. |
| `total` | Totals row: sums numbers, averages percents and progress, leaves changes blank. `{ sales: "mean" }` per column; `totalLabel` renames it. |
| `group` | Rows under a tinted band per value, with a count. |
| `highlight` | Rows whose name matches get a tint and an accent mark; the bars of the other rows are muted. |
| `top` | Keep the first N rows after sorting. |
| `cards` | `"auto"` (default) turns each row into a card when the columns do not fit (phones): name and main value on top, the bar under them, the other columns as label–value lines. `true` always, `false` never. |
| `density`, `striped` | `"compact"` / `"comfortable"` rows; zebra stripes for very wide tables. |

In the browser `render()` adds a search box above 20 rows (`search: false` hides it; `true` forces it), click-to-sort headers (natural order, reversed, then the original order), and page buttons; all of them work from the keyboard and announce `aria-sort` and `aria-current`. Resizing re-renders at the new width, so a table becomes cards on a phone and columns again on a desktop.

The language of the few words a table writes (Total, Search, No results) and the number format come from `locale`; without it, the table recognizes the language from its own title, headers and categories.

