// JSON Schema of the spec: use it to declare plotagents as an agent tool, or
// to validate an LLM's structured output. Descriptions are in English because
// agents read them; chart text follows `locale`.
import { TYPES, ALIASES } from './infer.js';

const field = (d) => ({ type: 'string', description: d });
const fieldOrList = (d) => ({ anyOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }], description: d });
const strOrList = { anyOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] };

export const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://unpkg.com/plotagents/schema.json',
  title: 'plotagents spec',
  description:
    'Declarative chart spec. Data as rows (tidy) plus the field name for each role. Everything else has well-designed defaults.',
  type: 'object',
  required: ['data'],
  properties: {
    type: {
      type: 'string',
      enum: ['auto', ...TYPES, ...Object.keys(ALIASES)],
      description:
        'Compare: bar, count. Time: line, area. Schedules: gantt. Relationships: scatter, bubble, regplot, residplot, jointplot, radar. Distributions (seaborn): hist, kde, ecdf, box, violin, strip, swarm, point. Part-to-whole: treemap, sunburst, donut, pie. Other: heatmap, sankey, kpi. Maps: choropleth, symbolmap. seaborn names are accepted (barplot, countplot, histplot, kdeplot, boxplot, violinplot, lmplot…). "auto" (default) picks from the data.',
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
    tall: { type: 'boolean', description: 'Map: false prevents the tall layout (map on the left, ranked label column on the right) for elongated territories.' },
    midpoint: { type: 'number', description: 'choropleth/heatmap: diverging color scale around this value (e.g. 0 for changes).' },
    classes: { type: 'integer', description: 'choropleth: number of color classes (default 5).' },
    scale: { description: 'choropleth: "quantile" (default), "equal", "continuous", "categorical" (text values get one color each; automatic when `value` holds text) or a list of thresholds.', anyOf: [{ type: 'string', enum: ['quantile', 'equal', 'continuous', 'categorical'] }, { type: 'array', items: { type: 'number' } }] },
    nodes: { type: 'array', items: { type: 'object' }, description: 'network: node rows (id, group, size). flowchart: steps (id, label, type: start|end|process|decision|data|note, lane).' },
    edges: { type: 'array', items: { type: 'object' }, description: 'flowchart: connections (from, to, label). Same as `data`.' },
    layout: { type: 'string', enum: ['force', 'circle'], description: 'network layout.' },
    matrix: { type: 'array', items: { type: 'array', items: { type: 'number' } }, description: 'chord: square flow matrix (with `names`).' },
    names: { type: 'array', items: { type: 'string' }, description: 'chord: group names for `matrix`.' },
    directed: { type: 'boolean', description: 'chord: treat flows as directed (default false).' },
    direction: { type: 'string', enum: ['TB', 'LR'], description: 'flowchart: top-to-bottom or left-to-right (automatic by default).' },
    age: field('pyramid: age-group field.'),
    sex: field('pyramid: field with exactly two sides (e.g. sex).'),
    percent: { type: 'boolean', description: 'pyramid: show shares of the total population.' },

    // Layout and interaction
    facet: field('One panel per value of this field (small multiples, seaborn col). Shared scales and colors.'),
    columns: { type: 'integer', description: 'facet: panels per row (seaborn col_wrap). Reduced automatically on narrow screens.' },
    sharey: { type: 'boolean', description: 'facet: same y scale in every panel (default true).' },
    time: field('Time field (d3plus-style): shows one period at a time (the latest by default, or `timeValue`). Add `slider: true` only when the person asks to move through periods.'),
    timeValue: { description: 'Period to show when `time` is set.' },
    slider: { description: 'Browser time controls, OFF by default; set them only when the person asks. true: period buttons when there are few periods (≤ 8), a minimal slider otherwise; line/area get a range slider. "buttons" or "slider" force one.', anyOf: [{ type: 'boolean' }, { type: 'string', enum: ['buttons', 'slider'] }] },
    play: { type: 'boolean', description: 'Browser: false keeps the time controls but hides the play button.' },
    compare: { description: 'With `time`: period to compute changes against: "previous" (default), "first", a specific period, or false.', anyOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }] },
    colorBy: { type: 'string', enum: ['group', 'change', 'label'], description: 'treemap: "change" colors tiles by % change vs the comparison period (diverging, growth cool / decline warm); "label" colors a single-level treemap by item.' },
    shade: { type: 'boolean', description: 'treemap/sunburst: subtle lightness steps inside each category (default false: one solid color per category).' },
    xRange: { type: 'array', description: 'line/area: visible x range [from, to] (what the range slider sets with `slider: true`).' },
    focus: { description: 'treemap/sunburst: path to drill into, e.g. ["Mining"]. network: a node id to center and highlight with its neighbors. In the browser, clicking does it.', anyOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] },
    depth: { type: 'integer', description: 'treemap/sunburst: how many levels to show.' },

    // Scales and axes
    xScale: { type: 'string', enum: ['linear', 'log'] },
    yScale: { type: 'string', enum: ['linear', 'log'] },
    xDomain: { type: 'array', items: { type: 'number' }, description: 'Fixed x domain [min, max].' },
    yDomain: { type: 'array', items: { type: 'number' }, description: 'Fixed value-axis domain [min, max].' },
    zero: { type: 'boolean', description: 'line: force (or prevent) a y axis starting at zero.' },
    xLabel: { type: 'string', description: 'x-axis title.' },
    yLabel: { type: 'string', description: 'y-axis title (drawn horizontally above the axis).' },
    format: {
      description: 'Value format: "number" | "compact" | "percent" | "currency" | "integer", or { type, prefix, suffix, decimals, currency }.',
      anyOf: [
        { type: 'string', enum: ['number', 'compact', 'percent', 'currency', 'integer'] },
        { type: 'object', properties: { type: { type: 'string' }, prefix: { type: 'string' }, suffix: { type: 'string' }, decimals: { type: 'integer' }, currency: { type: 'string' } } },
      ],
    },

    // Emphasis and annotation
    highlight: { description: 'Emphasize one or more categories/series and mute the rest.', ...strOrList },
    dashed: { description: 'Draw some shapes dashed (hatched fill + dashed outline; dashed stroke for lines) to mark estimates, projections or provisional figures. A category/series/region name or a list of them, a data field whose truthy rows are dashed, { field, equals }, or true for all.', anyOf: [{ type: 'string' }, { type: 'boolean' }, { type: 'array', items: { type: 'string' } }, { type: 'object', properties: { field: { type: 'string' }, equals: {} } }] },
    dashedFrom: { description: 'line/area/bar on a time axis: x value from which marks are dashed (a projection). Lines turn dashed from the last firm point, over a soft labeled band.', anyOf: [{ type: 'string' }, { type: 'number' }] },
    dashedLabel: { description: 'What the dashed shapes mean ("Projection", "Preliminary"): legend entry, band label and tooltip line. false hides the band label.', anyOf: [{ type: 'string' }, { type: 'boolean' }] },
    labels: { description: 'Value labels: true, false or "auto". In scatter/regplot: a number of points or a list of names to label.', anyOf: [{ type: 'boolean' }, { type: 'string' }, { type: 'number' }, { type: 'array', items: { type: 'string' } }] },
    refLines: { type: 'array', description: 'Reference lines (targets, averages).', items: { type: 'object', properties: { y: { type: 'number' }, x: { type: 'number' }, value: { type: 'number' }, label: { type: 'string' } } } },
    annotations: { type: 'array', description: 'line/area: events on the x axis.', items: { type: 'object', properties: { x: {}, label: { type: 'string' } } } },

    // Bars and lines
    stack: { description: 'bar/area: true stacks; "percent" stacks to 100%.', anyOf: [{ type: 'boolean' }, { type: 'string', enum: ['percent'] }] },
    horizontal: { type: 'boolean', description: 'Force horizontal orientation (otherwise chosen from label length and count).' },
    sort: { type: 'string', enum: ['desc', 'asc', 'none', 'alpha'], description: 'bar: category order (desc by default unless the categories are time).' },
    top: { type: 'integer', description: 'bar: keep the N largest and fold the rest into "Other".' },
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
    inner: { type: 'string', enum: ['box', 'quartiles', 'points', 'none'], description: 'violin: what goes inside.' },
    split: { type: 'boolean', description: 'violin: with two hue levels, one half each.' },
    points: { type: 'boolean', description: 'box: overlay the observations. line: markers on every point.' },
    normalize: { type: 'boolean', description: 'radar: scale each axis 0–1 by its own maximum.' },

    // Part-to-whole
    half: { type: 'boolean', description: 'donut: semicircle.' },

    // Appearance
    colors: { type: 'object', additionalProperties: { type: 'string' }, description: 'Pin colors to entities: { "Biobío": "#3A47B8" }.' },
    palette: { description: 'Palette shortcut: a name ("cdia", "okabe-ito", "tableau10", "udec") or a list of colors in fixed order.', ...strOrList },
    ramp: { description: 'Sequential ramp: a name ("indigo", "magenta", "teal", "amber") or a list of colors from light to dark.', ...strOrList },
    theme: {
      description: 'Theme: "papel" (light, default), "noche" (dark), or a JSON object deep-merged over `extends`. Keys: surface, ink, lede, muted, grid, axis, tint, dim, other, categorical (list or palette name), sequential, diverging, status {good, warning, critical}, font {family, mono, import}, type {title, subtitle, label, axis, legend, source, titleWeight}, marks {barRadius, barMax, lineWidth, pointRadius, gap, ring, areaOpacity, bandOpacity, dotOpacity}, axes {inside, grid}, layout {padding}.',
      anyOf: [{ type: 'string', enum: ['papel', 'noche', 'light', 'dark'] }, { type: 'object' }],
    },
    font: { description: 'Typeface for the whole chart: a Google Fonts name ("Poppins"), a CSS stack ("\'Inter\', sans-serif") or { family, import }. configure({ font }) sets it for every chart.', anyOf: [{ type: 'string' }, { type: 'object' }] },
    textScale: { type: 'number', description: 'Multiplies every text size (1.5, 2…); the layout is recomputed so nothing overlaps. Aliases: fontScale, labelScale. configure({ textScale }) sets it for every chart.' },
    width: { type: 'number', description: 'Width in px (default 720; render() uses the container width).' },
    height: { type: 'number', description: 'Height in px. Automatic for horizontal bars, heatmaps, KPI tiles, and narrow treemaps, sunbursts and radars.' },
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
    'Draws an elegant, accessible chart from tabular data. Pass rows in `data`, name the fields (x, y, series/hue…) and write a `title` that states the finding. Returns an SVG. Types: bar, count, line, area, wordcloud (words sized by frequency, or raw text to count), gantt (tasks with start/end, phases, progress, dependencies, milestones), scatter, bubble, regplot, residplot, jointplot, hist, kde, ecdf, box, violin, strip, swarm, point, radar, treemap, sunburst, donut, pie, heatmap, sankey, kpi, choropleth (Chile regions, US states and world countries built in, or any GeoJSON/TopoJSON in `geo`, with markers, layers and fitTo), symbolmap, network, chord, pyramid, flowchart (seaborn names accepted). `facet` makes panels; `time` adds a per-period slider. Set `locale: "en"` for English number formats.';
  const { $schema, $id, title, ...params } = schema;
  if (flavor === 'openai') return { type: 'function', function: { name, description, parameters: params } };
  return { name, description, input_schema: params };
}
