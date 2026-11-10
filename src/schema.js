// JSON Schema of the spec: use it to declare plotagents as an agent tool, or
// to validate an LLM's structured output. Descriptions are in English because
// agents read them; chart text follows `locale`.
import { TYPES, ALIASES } from './infer.js';

const field = (d) => ({ type: 'string', description: d });
const fieldOrList = (d) => ({ anyOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }], description: d });
const strOrList = { anyOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] };
const bool = (d) => ({ type: 'boolean', description: d });
const number = (d) => ({ type: 'number', description: d });
const numPair = (d) => ({ type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2, description: d });
const formatSpec = (d) => ({
  description: d,
  anyOf: [
    { type: 'string', enum: ['number', 'compact', 'percent', 'currency', 'integer'] },
    { type: 'object', properties: { type: { type: 'string', enum: ['number', 'compact', 'percent', 'currency', 'integer'] }, prefix: { type: 'string' }, suffix: { type: 'string' }, decimals: { type: 'integer', minimum: 0, maximum: 20 }, currency: { type: 'string' }, scale: { type: 'number' } } },
  ],
});
/** Escala de color continua: nombre de matplotlib, lista de colores u objeto. */
const colorScaleSpec = (d) => ({
  description: d,
  anyOf: [
    { type: 'string' },
    { type: 'array', items: { type: 'string' }, minItems: 2 },
    { type: 'object', properties: { name: { type: 'string' }, colors: { type: 'array', items: { type: 'string' } }, reverse: { type: 'boolean' }, mid: { type: 'number', description: 'Center of a diverging scale.' } } },
  ],
});

export const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://unpkg.com/plotagents/schema.json',
  title: 'plotagents spec',
  description:
    'Declarative chart spec. Data as rows (tidy) plus the field name for each role. Everything else has well-designed defaults. `data` is required except for kpi (`items`), flowchart (`nodes` + `edges`), chord (`matrix`) and wordcloud with raw `text`.',
  type: 'object',
  properties: {
    type: {
      type: 'string',
      enum: [...new Set(['auto', ...TYPES, 'pointmap', ...Object.keys(ALIASES)])],
      description:
        'Compare: bar, count. Time: line, area. Schedules: gantt. Relationships: scatter, bubble, regplot, residplot, jointplot, radar. Distributions (seaborn): hist, kde, ecdf, box, violin, strip, swarm, point. Part-to-whole: treemap, sunburst, donut, pie. Other: heatmap, sankey, kpi, network, chord, pyramid, flowchart, wordcloud. Maps: choropleth, symbolmap, pointmap (lat/lon dots over a tile basemap). seaborn names are accepted (barplot, countplot, histplot, kdeplot, boxplot, violinplot, lmplot…). "auto" (default) picks from the data.',
    },
    data: {
      description: 'Array of rows, e.g. [{ "region": "Biobío", "sales": 1240 }]. For kpi it can be omitted in favor of `items`.',
      anyOf: [{ type: 'array', items: { type: 'object' } }, { type: 'object' }],
    },
    title: { type: 'string', description: 'The finding as a full sentence, ideally with the key number, e.g. "Biobío accounts for 32% of sales".' },
    subtitle: { type: 'string', description: 'How to read the chart: measure, unit and period, e.g. "Sales by region, CLP millions, 2025".' },
    source: { type: 'string', description: 'Data source, shown at the bottom right.' },
    locale: { type: 'string', enum: ['es', 'en'], description: 'Language and number format. Default "es" (1.234,5); use "en" for 1,234.5.' },
    x: field('x-axis or category field (bar, line, area, scatter, heatmap, box, violin…).'),
    y: fieldOrList('Value field. For line/bar a list of fields (wide table) turns each one into a series.'),
    series: field('Field that splits the data into colored series. Alias: hue.'),
    color: field('Alias of series when it names a field (a "#hex" value is a fixed color instead).'),
    hue: field('Alias of series (seaborn naming).'),
    value: field('Value field for treemap, sunburst, donut, heatmap, sankey and radar.'),
    label: field('Name field (treemap, donut, point labels in scatter/regplot).'),
    group: field('Level-1 group field for a two-level treemap (shortcut for path). gantt: phase/workstream field (one colored section per phase).'),
    path: { type: 'array', items: { type: 'string' }, description: 'Hierarchy for treemap/sunburst, any depth: [level1, level2, …].' },
    size: field('Bubble size field (area-proportional).'),
    from: field('Sankey source field.'),
    to: field('Sankey target field.'),
    axis: field('radar: field with the axis names (long format).'),
    axes: { type: 'array', items: { type: 'string' }, description: 'radar: fields to use as axes (wide format, one row per series).' },
    items: {
      type: 'array',
      description: 'kpi: the indicators to show.',
      items: {
        type: 'object',
        required: ['label', 'value'],
        properties: {
          label: { type: 'string' },
          value: { type: 'number' },
          delta: { type: 'number', description: 'Relative change as a fraction (0.12 = +12%).' },
          previous: { type: 'number', description: 'Previous value; when given, the change is computed.' },
          period: { type: 'string', description: 'What it is compared against, e.g. "vs 2025".' },
          good: { type: 'string', enum: ['up', 'down'], description: 'Whether going up is good (up) or bad (down, e.g. costs).' },
          trend: { type: 'array', items: { type: 'number' }, description: 'Short series for the sparkline.' },
          target: { type: 'number', description: 'Target: draws a progress meter.' },
          format: { type: 'string' },
        },
      },
    },

    // Word clouds
    text: { description: 'wordcloud: field with the words, OR the raw text to count (a string or a list of strings, e.g. open survey answers). Raw text drops Spanish/English stopwords.', anyOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] },
    textField: field('wordcloud: field holding free text in each row; words are counted across rows.'),
    stopwords: { type: 'array', items: { type: 'string' }, description: 'wordcloud: extra words to ignore when counting raw text.' },
    minFont: { type: 'number', description: 'wordcloud: smallest font size (default 11).' },
    maxFont: { type: 'number', description: 'wordcloud: largest font size (default from the panel size).' },

    // Schedules
    task: field('gantt: task name field (one row per task).'),
    start: field('gantt: start date field ("2026-03-02", "2026-03") or a number (e.g. week).'),
    end: field('gantt: end date field. Day dates are inclusive. Missing end, or end equal to start, makes a milestone.'),
    duration: field('gantt: duration field (days, or units of a numeric axis) instead of `end`.'),
    progress: field('gantt: completion field, 0–1 or 0–100. The filled part of each bar is the progress.'),
    dependsOn: field('gantt: field with the name(s) of the predecessor task(s) ("A" or "A, B"): draws arrows.'),
    milestone: field('gantt: boolean field that marks milestones (drawn as diamonds).'),
    today: { description: 'gantt: date of the "today" line ("2026-03-12"), or true for the current date.', anyOf: [{ type: 'string' }, { type: 'boolean' }, { type: 'number' }] },
    groupHeaders: { description: 'gantt: false draws phases as a color legend instead of section headers.', anyOf: [{ type: 'boolean' }, { type: 'string', enum: ['compact'] }] },
    rowHeight: { type: 'number', description: 'gantt: row height in px.' },
    collapsed: { description: 'gantt: phases (values of `group`) drawn collapsed into one summary row; true collapses all. In the browser a click on a phase header toggles it.', anyOf: [{ type: 'boolean' }, { type: 'string' }, { type: 'array', items: { type: 'string' } }] },
    collapsible: bool('gantt: false disables click-to-collapse of phases in the browser.'),
    critical: bool('gantt: highlight the critical path, the zero-slack chain along `dependsOn`.'),
    criticalColor: { type: 'string', description: 'gantt: color of the critical path.' },
    weekends: bool('gantt: shade weekends on day plans of up to 120 days (default true).'),
    todayColor: { type: 'string', description: 'gantt: color of the "today" line.' },
    sort: { type: 'string', enum: ['desc', 'asc', 'none', 'alpha', 'start'], description: 'bar: category order (desc by default unless the categories are time). gantt: "start" orders tasks by start date. donut/chord: "none" keeps the data order.' },

    // Maps, networks, flows
    geo: { description: 'choropleth/symbolmap: "chile" (16 regions, default), "usa" (50 states + DC, Albers with Alaska/Hawaii insets; Puerto Rico when it has data), "world" (countries), a name registered with registerGeo(), or YOUR OWN geometry: a GeoJSON FeatureCollection, Feature, list of Features or bare geometry, or a TopoJSON Topology. Polygons are filled, LineStrings stroked and Points drawn as dots. In the browser, render() also accepts a URL to a .geojson/.topojson file.', anyOf: [{ type: 'string' }, { type: 'object' }, { type: 'array', items: { type: 'object' } }] },
    geoObject: field('TopoJSON: name of the object inside `objects` to draw (default: the first one).'),
    key: field('choropleth/symbolmap: data field with the region, state or country name/code to match (US: "TX", "Texas", "06").'),
    projection: { description: 'Map projection (picked automatically): "mercator", "equalEarth", "albersUsa", "equirectangular", "conic" (or { type: "conic", parallels: [-30, -45], rotate: 72 }), "identity" (coordinates already in pixels, y down) or "planar" (projected coordinates such as UTM metres, y up; chosen automatically when coordinates are outside lon/lat range).', anyOf: [{ type: 'string', enum: ['mercator', 'equalEarth', 'albersUsa', 'equirectangular', 'conic', 'identity', 'planar'] }, { type: 'object', properties: { type: { type: 'string' }, parallels: { type: 'array', items: { type: 'number' } }, rotate: { type: 'number' }, center: { type: 'array', items: { type: 'number' } } } }] },
    values: { type: 'boolean', description: 'choropleth with state codes (usa): false shows only the codes, without values.' },
    featureKey: field('choropleth: feature property to match `key` against. Default tries code, id, ISO-3, name and aliases, then any property whose values match the data (e.g. "CUT_REG", "GEOID").'),
    nameKey: field('choropleth: feature property with the display name (default: name, NOMBRE, NAME_1, ADMIN…).'),
    fitTo: { description: 'Map framing: zoom to some regions (names or codes), a bounding box [lonMin, latMin, lonMax, latMax], or "markers". The rest of the map stays as context, clipped.', anyOf: [{ type: 'string' }, { type: 'array', items: { anyOf: [{ type: 'string' }, { type: 'number' }] } }] },
    markers: { description: 'Map: points on top, from [{ lon, lat, label, value?, color? }] or { data, lon, lat, label, size, color, legend, maxRadius, labels }. With a size field, circles are area-proportional.', anyOf: [{ type: 'array', items: { type: 'object' } }, { type: 'object' }] },
    layers: { type: 'array', description: 'Map: extra GeoJSON drawn over (or `below: true` under) the regions: rivers, roads, routes, borders, points. Each { geo, label?, stroke?, width?, fill?, dash?, opacity?, below? }; a `label` adds a legend key.', items: { type: 'object' } },
    borderColor: { type: 'string', description: 'Map: color of the borders between regions.' },
    borderWidth: { type: 'number', description: 'Map: width of the borders between regions.' },
    pointRadius: { type: 'number', description: 'Map: radius of Point features in your own GeoJSON (default 5).' },
    missing: { type: 'string', enum: ['hatch', 'plain'], description: 'choropleth: how regions without data look: hatched (default) or "plain" (flat tint).' },
    thresholds: { type: 'array', items: { type: 'number' }, description: 'choropleth: class breaks (same as a list in `scale`).' },
    lat: field('pointmap: latitude field (auto-detected: lat, latitude, latitud).'),
    lon: field('pointmap: longitude field (auto-detected: lon, lng, longitude, longitud).'),
    tiles: { description: 'pointmap: basemap. "osm" (default), "esri-gray", "esri-dark", "carto-light", "carto-dark", "mapbox-light", "mapbox-dark" (needs `tilesKey`), your own { url, attribution, subdomains, maxZoom, retina } with {z}/{x}/{y}, or false for none (vector world outline).', anyOf: [{ type: 'string', enum: ['osm', 'esri-gray', 'esri-dark', 'carto-light', 'carto-dark', 'mapbox-light', 'mapbox-dark'] }, { type: 'boolean', enum: [false] }, { type: 'object', properties: { url: { type: 'string' }, attribution: { type: 'string' }, subdomains: { type: 'string' }, maxZoom: { type: 'number' }, retina: { type: 'boolean' } }, required: ['url'] }] },
    tilesKey: { type: 'string', description: 'pointmap: API key or PUBLIC token for the tile provider (Mapbox "pk.…"; a secret "sk." token is rejected because it would be visible in the SVG).' },
    tileStyle: { type: 'string', enum: ['muted', 'original'], description: 'pointmap: "muted" (default) desaturates the basemap so the data stands out; "original" keeps its colors.' },
    tileOpacity: { type: 'number', minimum: 0, maximum: 1, description: 'pointmap: basemap opacity.' },
    zoom: { type: 'number', description: 'pointmap: tile zoom level (automatic from the points by default).' },
    center: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2, description: 'pointmap: map center [lon, lat] (default: fitted to the points).' },
    tall: { type: 'boolean', description: 'Map: false prevents the tall layout (map on the left, ranked label column on the right) for elongated territories.' },
    midpoint: { type: 'number', description: 'choropleth/heatmap: diverging color scale around this value (e.g. 0 for changes).' },
    classes: { type: 'integer', description: 'choropleth: number of color classes (default 5).' },
    scale: { description: 'choropleth: "quantile" (default), "equal", "continuous", "categorical" (text values get one color each; automatic when `value` holds text) or a list of thresholds.', anyOf: [{ type: 'string', enum: ['quantile', 'equal', 'continuous', 'categorical'] }, { type: 'array', items: { type: 'number' } }] },
    nodes: { type: 'array', items: { type: 'object' }, description: 'network: node rows (id, group, size). flowchart: steps (id, label, type: start|end|process|decision|data|note, lane).' },
    edges: { type: 'array', items: { type: 'object' }, description: 'flowchart: connections (from, to, label). Same as `data`.' },
    layout: { type: 'string', enum: ['force', 'circular', 'radial', 'concentric', 'clusters', 'tree', 'grid', 'circle'], description: 'network layout: "force" (default) deterministic force-directed; "circular" around a circle by group with names rotated outward ("circle" = circular); "radial" tree rings from `focus` or the most connected node; "concentric" rings by weight; "clusters" one cluster per group; "tree" the radial tree laid flat; "grid" ordered by group.' },
    curveness: { type: 'number', minimum: 0, description: 'network: edge bend as a share of its length (default 0.3; 0 = straight).' },
    maxRadius: { type: 'number', description: 'network/symbolmap/pointmap/bubble: largest node or circle radius in px.' },
    iterations: { type: 'integer', description: 'network: force-layout iterations (automatic by size).' },
    nodeId: field('network: id field in `nodes` (default id/name).'),
    nodeLabel: field('network: label field in `nodes` (default label, else the id).'),
    labelOrientation: { type: 'string', enum: ['horizontal', 'radial'], description: 'chord: label orientation (radial by default above 10 groups).' },
    ribbonColor: { type: 'string', enum: ['source', 'smaller', 'larger'], description: 'chord: ribbon color: "source" (default when directed), "smaller" group (default) or "larger" flow.' },
    matrix: { type: 'array', items: { type: 'array', items: { type: 'number' } }, description: 'chord: square flow matrix (with `names`).' },
    names: { type: 'array', items: { type: 'string' }, description: 'chord: group names for `matrix`.' },
    directed: { type: 'boolean', description: 'chord: treat flows as directed (default false).' },
    direction: { type: 'string', enum: ['TB', 'LR'], description: 'flowchart: top-to-bottom or left-to-right (automatic by default).' },
    age: field('pyramid: age-group field.'),
    sex: field('pyramid: field with exactly two sides (e.g. sex).'),
    percent: { type: 'boolean', description: 'pyramid: show shares of the total population.' },

    // Layout and interaction
    facet: field('One panel per value of this field (small multiples, seaborn col). Shared scales and colors.'),
    col: field('Alias of facet (seaborn naming).'),
    facetOrder: { type: 'array', items: { type: 'string' }, description: 'facet: panel order (values of the facet field; the rest follow).' },
    columns: { type: 'integer', description: 'facet: panels per row (seaborn col_wrap). Reduced automatically on narrow screens. kpi: tiles per row.' },
    sharex: bool('facet: same x scale in every panel (default true).'),
    panelHeight: number('facet: height of each panel in px.'),
    sharey: { type: 'boolean', description: 'facet: same y scale in every panel (default true).' },
    time: field('Time field (d3plus-style): shows one period at a time (the latest by default, or `timeValue`). Add `slider: true` only when the person asks to move through periods.'),
    timeValue: { description: 'Period to show when `time` is set.' },
    slider: { description: 'Browser time controls, OFF by default; set them only when the person asks. true: period buttons when there are few periods (≤ 8), a minimal slider otherwise; line/area get a range slider. "buttons" or "slider" force one.', anyOf: [{ type: 'boolean' }, { type: 'string', enum: ['buttons', 'slider'] }] },
    play: { type: 'boolean', description: 'Browser: false keeps the time controls but hides the play button.' },
    playInterval: number('Browser: milliseconds per period while playing.'),
    legend: { description: 'Legend: true/false, or its position "top" (default), "bottom", "left", "right" (left/right fall back to bottom under 520px wide), or { position }.', anyOf: [{ type: 'boolean' }, { type: 'string', enum: ['top', 'bottom', 'left', 'right'] }, { type: 'object', properties: { position: { type: 'string', enum: ['top', 'bottom', 'left', 'right'] } } }] },
    legendTitle: { type: 'string', description: 'Title of a color-ramp or size legend (heatmap, maps).' },
    exclude: { description: 'Drop legend entries (series, first hierarchy level, group or donut slice) and recompute axes and shares with the rest. Colors stay fixed; excluded entries remain in the legend, faded, so a click re-adds them. In the browser shift+click on a legend key toggles it.', ...strOrList },
    compare: { description: 'With `time`: period to compute changes against: "previous" (default), "first", a specific period, or false.', anyOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }] },
    colorBy: { type: 'string', enum: ['group', 'change', 'label'], description: 'treemap: "change" colors tiles by % change vs the comparison period (diverging, growth cool / decline warm); "label" colors a single-level treemap by item.' },
    shade: { type: 'boolean', description: 'treemap/sunburst: subtle lightness steps inside each category (default false: one solid color per category).' },
    xRange: { type: 'array', description: 'line/area: visible x range [from, to] (what the range slider sets with `slider: true`).' },
    showValues: bool('treemap: show each tile value next to its label.'),
    hole: { type: 'number', minimum: 0, maximum: 0.9, description: 'sunburst: size of the center hole as a fraction of the radius (default 0.3).' },
    focus: { description: 'treemap/sunburst: path to drill into, e.g. ["Mining"] (in the browser a click on a tile or legend key zooms to it). network: a node id to center and highlight with its neighbors.', anyOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] },
    depth: { type: 'integer', description: 'treemap/sunburst: how many levels to show.' },

    // Scales and axes
    xScale: { type: 'string', enum: ['linear', 'log'] },
    yScale: { type: 'string', enum: ['linear', 'log'] },
    xDomain: { type: 'array', items: { type: 'number' }, description: 'Fixed x domain [min, max].' },
    yDomain: { type: 'array', items: { type: 'number' }, description: 'Fixed value-axis domain [min, max].' },
    valueDomain: numPair('box/violin/strip/swarm/point/radar: fixed value-axis domain [min, max] whatever the orientation.'),
    orient: { type: 'string', enum: ['v', 'h'], description: 'box/violin/strip/swarm/point: "v" vertical or "h" horizontal (same as `horizontal`).' },
    zero: { type: 'boolean', description: 'line: force (or prevent) a y axis starting at zero.' },
    xLabel: { type: 'string', description: 'x-axis title.' },
    yLabel: { type: 'string', description: 'y-axis title (drawn horizontally above the axis).' },
    format: formatSpec('Value format: "number" | "compact" | "percent" | "currency" | "integer", or { type, prefix, suffix, decimals (0–20), currency }.'),
    xFormat: formatSpec('Format of x values when x is a measure (scatter, regplot, hist).'),
    yFormat: formatSpec('Format of y values (overrides `format` on the y axis).'),

    // Emphasis and annotation
    highlight: { description: 'Emphasize one or more categories/series and mute the rest.', ...strOrList },
    dashed: { description: 'Draw some shapes dashed (hatched fill + dashed outline; dashed stroke for lines) to mark estimates, projections or provisional figures. A category/series/region name or a list of them, a data field whose truthy rows are dashed, { field, equals }, or true for all.', anyOf: [{ type: 'string' }, { type: 'boolean' }, { type: 'array', items: { type: 'string' } }, { type: 'object', properties: { field: { type: 'string' }, equals: {} } }] },
    dashedFrom: { description: 'line/area/bar on a time axis: x value from which marks are dashed (a projection). Lines turn dashed from the last firm point, over a soft labeled band.', anyOf: [{ type: 'string' }, { type: 'number' }] },
    dashedLabel: { description: 'What the dashed shapes mean ("Projection", "Preliminary"): legend entry, band label and tooltip line. false hides the band label.', anyOf: [{ type: 'string' }, { type: 'boolean' }] },
    labels: { description: 'Value labels: true, false or "auto". In scatter/regplot: a number of points or a list of names to label. network: true labels every node.', anyOf: [{ type: 'boolean' }, { type: 'string' }, { type: 'number' }, { type: 'array', items: { type: 'string' } }] },
    refLines: { type: 'array', description: 'Reference lines (targets, averages).', items: { type: 'object', properties: { y: { type: 'number' }, x: { type: 'number' }, value: { type: 'number' }, label: { type: 'string' } } } },
    annotations: { type: 'array', description: 'line/area: events on the x axis.', items: { type: 'object', properties: { x: {}, label: { type: 'string' } } } },

    // Bars and lines
    stack: { description: 'bar/area: true stacks; "percent" stacks to 100%.', anyOf: [{ type: 'boolean' }, { type: 'string', enum: ['percent'] }] },
    horizontal: { type: 'boolean', description: 'Force horizontal orientation (otherwise chosen from label length and count).' },
    top: { type: 'integer', description: 'bar: keep the N largest and fold the rest into "Other".' },
    endLabels: bool('line/regplot: false removes the series names at the end of each line (a legend is drawn instead).'),
    labelsFor: { type: 'object', additionalProperties: { type: 'string' }, description: 'Wide table (y as a list): display names per column, e.g. { "rev": "Revenue" }.' },
    index: { type: 'boolean', description: 'line: rebase each series to 100 at its first value (compare growth without a dual axis).' },
    curve: { type: 'string', enum: ['linear', 'smooth', 'step'] },
    aggregate: { type: 'string', enum: ['sum', 'mean', 'max', 'min', 'count', 'last', 'first'], description: 'How to combine repeated rows. Default sum.' },
    ci: { description: 'line/bar/regplot: confidence interval (true = 95, or a number). In line/bar it switches the estimator to the mean.', anyOf: [{ type: 'boolean' }, { type: 'number' }] },
    errorbar: { type: 'string', enum: ['ci', 'sd', 'se', 'pi', 'none'], description: 'Error bar or band type.' },
    estimator: { type: 'string', enum: ['mean', 'median', 'sum', 'count'], description: 'How to summarize several observations per category.' },

    // Statistics (seaborn)
    bins: { type: 'integer', description: 'hist: number of bins.' },
    binWidth: { type: 'number', description: 'hist: bin width.' },
    stat: { type: 'string', enum: ['count', 'percent', 'density', 'probability'], description: 'hist: what the y axis measures.' },
    kde: { type: 'boolean', description: 'hist: overlay a density curve.' },
    multiple: { type: 'string', enum: ['layer', 'stack', 'dodge', 'fill'], description: 'hist/kde with hue: how groups are combined.' },
    fill: { type: 'boolean', description: 'kde: fill the area. line: false removes the gradient under a single line.' },
    order: { description: 'regplot: polynomial degree (number). box/violin/strip/swarm/point: category order (list).', anyOf: [{ type: 'integer' }, { type: 'array', items: { type: 'string' } }] },
    lowess: { type: 'boolean', description: 'regplot: local regression instead of a straight line.' },
    logx: { type: 'boolean', description: 'regplot: fit y ~ log(x) with a log x axis.' },
    trend: { type: 'boolean', description: 'scatter: add a least-squares line and R².' },
    annotate: { type: 'boolean', description: 'regplot: show R² and n.' },
    kind: { type: 'string', enum: ['scatter', 'reg'], description: 'jointplot: center plot.' },
    marginal: { type: 'string', enum: ['hist', 'kde'], description: 'jointplot: marginal plots.' },
    inner: { type: 'string', enum: ['box', 'quartiles', 'points', 'stick', 'none'], description: 'violin: what goes inside.' },
    bandwidth: number('violin: KDE bandwidth (default Scott\'s rule).'),
    bwAdjust: number('kde/violin/hist kde: multiply the bandwidth (seaborn bw_adjust).'),
    cut: number('kde/violin: how far the density extends past the data, in bandwidths.'),
    jitter: { description: 'strip: spread of the points across the category (fraction of the band, default 0.6; 0 or false = none).', anyOf: [{ type: 'number' }, { type: 'boolean' }] },
    dodge: bool('strip/swarm/point with hue: place groups side by side.'),
    hueOrder: { type: 'array', items: { type: 'string' }, description: 'Order of the hue groups.' },
    showMeans: bool('box/strip: mark the mean.'),
    cumulative: bool('hist/kde: cumulative distribution.'),
    rug: bool('kde: tick marks for each observation.'),
    complementary: bool('ecdf: show 1 − F(x) (share above each value).'),
    radius: number('Point radius in px (scatter, regplot, strip, swarm).'),
    split: { type: 'boolean', description: 'violin: with two hue levels, one half each.' },
    points: { type: 'boolean', description: 'box: overlay the observations. line: markers on every point.' },
    normalize: { type: 'boolean', description: 'radar: scale each axis 0–1 by its own maximum.' },

    // Part-to-whole
    half: { type: 'boolean', description: 'donut: semicircle.' },
    thickness: { type: 'number', minimum: 0, maximum: 1, description: 'donut: ring thickness as a fraction of the radius (1 = pie).' },
    maxSlices: { type: 'integer', minimum: 2, description: 'donut/pie: slices before the rest fold into "Other" (default 6).' },
    centerValue: { type: 'string', description: 'donut/sunburst: text in the center (default: the total).' },
    centerLabel: { type: 'string', description: 'donut/sunburst: caption under the center value.' },
    cellHeight: number('heatmap: maximum cell height in px.'),
    diverging: bool('heatmap/choropleth: diverging color scale around 0 (or `midpoint`).'),

    // Appearance
    colors: { type: 'object', additionalProperties: { type: 'string' }, description: 'Pin colors to entities: { "Biobío": "#3A47B8" }.' },
    palette: { description: 'Categorical colors: a name ("cdia", "okabe-ito", "tableau10", "udec"), a matplotlib qualitative palette ("tab10", "tab20", "Set1", "Set2", "Set3", "Pastel1", "Pastel2", "Paired", "Accent", "Dark2"), any colormap name (sampled, e.g. "viridis"), or a list of colors in fixed order.', ...strOrList },
    ramp: { description: 'Sequential ramp: a name ("indigo", "magenta", "teal", "amber"), any colormap name, or a list of colors from light to dark.', ...strOrList },
    colorScale: colorScaleSpec('Continuous color scale (heatmap, choropleth, treemap change, pointmap values): any matplotlib colormap name, case-insensitive, `_r` reverses ("viridis", "plasma", "inferno", "magma", "cividis", "Blues", "Greens", "YlOrRd", "RdBu", "coolwarm", "Spectral", "turbo", "twilight"…); diverging names imply a diverging scale. Or a list of hex colors, or { name | colors, reverse, mid }. Aliases: cmap, colormap. Qualitative palettes (tab10…) go in `palette`; avoid rainbow maps (jet, hsv).'),
    cmap: colorScaleSpec('Alias of colorScale (matplotlib naming).'),
    colormap: colorScaleSpec('Alias of colorScale.'),
    theme: {
      description: 'Theme: "papel" (light, default), "noche" (dark), a name registered with registerTheme(), or a JSON object deep-merged over `extends`. Simple tokens: background (alias of surface), text (alias of ink), accent (first series color), grid (a color or { color, dash, width }), axis, tooltip { bg, ink }, radius / barRadius (corner radius), font. Full keys: surface, ink, lede, muted, tint, dim, other, categorical (list, palette or colormap name), sequential, diverging, status {good, warning, critical}, font {family, mono, import}, type {title, subtitle, label, axis, legend, source, titleWeight}, marks {barRadius, barMax, lineWidth, pointRadius, gap, ring, areaOpacity, bandOpacity, dotOpacity}, axes {inside, grid}, layout {padding}. configure({ theme }) applies it to every chart.',
      anyOf: [
        { type: 'string', description: '"papel", "noche", "light", "dark" or a registered theme name.' },
        { type: 'object', properties: {
          extends: { type: 'string' }, mode: { type: 'string', enum: ['light', 'dark'] },
          background: { type: 'string' }, surface: { type: 'string' }, text: { type: 'string' }, ink: { type: 'string' }, lede: { type: 'string' }, muted: { type: 'string' }, accent: { type: 'string' },
          grid: { anyOf: [{ type: 'string' }, { type: 'object', properties: { color: { type: 'string' }, dash: { type: 'string' }, width: { type: 'number' } } }] },
          axis: { type: 'string' }, tooltip: { type: 'object', properties: { bg: { type: 'string' }, ink: { type: 'string' } } },
          radius: { type: 'number' }, barRadius: { type: 'number' },
          categorical: { anyOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] },
          sequential: { anyOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] },
          diverging: { anyOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] },
          font: { anyOf: [{ type: 'string' }, { type: 'object' }] },
          status: { type: 'object' }, type: { type: 'object' }, marks: { type: 'object' }, axes: { type: 'object' }, layout: { type: 'object' },
        } },
      ],
    },
    font: { description: 'Typeface for the whole chart: a Google Fonts name ("Poppins"), a CSS stack ("\'Inter\', sans-serif") or { family, import }. configure({ font }) sets it for every chart.', anyOf: [{ type: 'string' }, { type: 'object' }] },
    textScale: { type: 'number', description: 'Multiplies every text size (1.5, 2…); the layout is recomputed so nothing overlaps. Aliases: fontScale, labelScale. configure({ textScale }) sets it for every chart.' },
    width: { type: 'number', description: 'Width in px (default 720; render() uses the container width).' },
    height: { type: 'number', description: 'Height in px. Automatic for horizontal bars, heatmaps, KPI tiles, and narrow treemaps, sunbursts and radars.' },
    padding: number('Outer padding in px (default from the width).'),
  },
};

/** JSON Schema of a dashboard: dashboard({ title, kpis, charts, filters, … }). */
export const dashboardSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'plotagents dashboard',
  description: 'A dashboard with best-practice defaults: KPIs on top, the main chart wide, the rest in balanced full rows of a 12-column grid, one color per entity across charts, shared filters, one source line.',
  type: 'object',
  required: ['charts'],
  properties: {
    title: { type: 'string', description: 'The question the dashboard answers, e.g. "How are southern sales doing?"' },
    subtitle: { type: 'string', description: 'Scope: measure, unit, period.' },
    source: { type: 'string', description: 'Data source, shown once at the bottom.' },
    updated: { type: 'string', description: 'Last update, e.g. "2026-01-05".' },
    locale: { type: 'string', enum: ['es', 'en'] },
    theme: { description: 'One theme for every chart: "papel" (light) or "noche" (dark), or a theme object.', anyOf: [{ type: 'string' }, { type: 'object' }] },
    data: { type: 'array', items: { type: 'object' }, description: 'Shared rows: charts without their own `data` use these, and computed KPIs and filters work on them.' },
    kpis: {
      type: 'array', description: 'Up to 5 key figures. Fixed ({ label, value, delta, period }) or computed from `data` ({ label, field, agg, compare, trendBy }).',
      items: { type: 'object', properties: {
        label: { type: 'string' }, value: { type: 'number' }, delta: { type: 'number', description: 'Change as a fraction (0.12 = +12%).' }, period: { type: 'string' },
        field: { type: 'string' }, agg: { type: 'string', enum: ['sum', 'mean', 'median', 'min', 'max', 'count', 'distinct', 'ratio'] }, over: { type: 'string', description: 'agg "ratio": denominator field.' },
        scale: { type: 'number', description: 'Multiply the computed value (e.g. 1000 to show thousands).' },
        compare: { type: 'object', description: 'Current vs previous period: { field: "year", current: 2025, previous: 2024 }.', properties: { field: { type: 'string' }, current: {}, previous: {} } },
        trendBy: { type: 'string', description: 'Field to draw a sparkline by (e.g. "month").' },
        format: {}, good: { type: 'string', enum: ['up', 'down'] }, trend: { type: 'array', items: { type: 'number' } },
      } },
    },
    charts: { type: 'array', items: { type: 'object' }, description: 'Chart specs (same as plot()). Optional per chart: `primary: true` (the main, wide chart), `size: "full" | "large" | "medium" | "small"` or `span` (of 12).' },
    filters: { type: 'array', description: 'Fields to filter every chart and computed KPI by: "region" or { field, label, control: "buttons" | "select", value }.', items: { anyOf: [{ type: 'string' }, { type: 'object' }] } },
    layout: { type: 'string', enum: ['auto', 'executive', 'grid'], description: 'auto (default): balanced rows by chart type. executive: main chart full width, the rest in pairs. grid: equal panels.' },
    colors: { type: 'object', additionalProperties: { type: 'string' }, description: 'Pin colors to entities across every chart.' },
  },
};

/** Tool definition ready for Claude (Anthropic) or OpenAI. */
export function toolDefinition({ name, flavor = 'anthropic', kind = 'chart' } = {}) {
  if (kind === 'dashboard') {
    const description = 'Builds a self-contained, interactive HTML dashboard with best-practice defaults: up to 5 KPIs on top (fixed or computed from data, with year-over-year change), the main chart wide, the rest in balanced rows, the same color for the same entity in every chart, and filters as buttons. Each chart is a plotagents spec with a `title` that states its finding.';
    const { $schema: _s, title: _t, ...params } = dashboardSchema;
    const n = name ?? 'dashboard';
    return flavor === 'openai' ? { type: 'function', function: { name: n, description, parameters: params } } : { name: n, description, input_schema: params };
  }
  name = name ?? 'plot';
  const description =
    'Draws an elegant, accessible chart from tabular data. Pass rows in `data`, name the fields (x, y, series/hue…) and write a `title` that states the finding. Returns an SVG. Types: bar, count, line, area, wordcloud (words sized by frequency, or raw text to count), gantt (tasks with start/end, phases, progress, dependencies, milestones), scatter, bubble, regplot, residplot, jointplot, hist, kde, ecdf, box, violin, strip, swarm, point, radar, treemap, sunburst, donut, pie, heatmap, sankey, kpi, choropleth (Chile regions, US states and world countries built in, or any GeoJSON/TopoJSON in `geo`, with markers, layers and fitTo), symbolmap, pointmap (lat/lon dots over a tile basemap), network, chord, pyramid, flowchart (seaborn names accepted). `facet` makes panels; `time` shows one period (add `slider: true` for controls). `data` is required except for kpi (`items`), flowchart (`nodes`/`edges`), chord (`matrix`) and wordcloud raw `text`. Set `locale: "en"` for English number formats.';
  const { $schema, $id, title, ...params } = schema;
  if (flavor === 'openai') return { type: 'function', function: { name, description, parameters: params } };
  return { name, description, input_schema: params };
}
