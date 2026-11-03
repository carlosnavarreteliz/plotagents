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
        'Compare: bar, count. Time: line, area. Relationships: scatter, bubble, regplot, residplot, jointplot, radar. Distributions (seaborn): hist, kde, ecdf, box, violin, strip, swarm, point. Part-to-whole: treemap, sunburst, donut, pie. Other: heatmap, sankey, kpi. seaborn names are accepted (barplot, countplot, histplot, kdeplot, boxplot, violinplot, lmplot…). "auto" (default) picks from the data.',
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
    group: field('Level-1 group field for a two-level treemap (shortcut for path).'),
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

    // Maps, networks, flows
    geo: { description: 'choropleth/symbolmap: "chile" (16 regions, default), "world" (countries), a name registered with registerGeo(), or a GeoJSON FeatureCollection.', anyOf: [{ type: 'string' }, { type: 'object' }] },
    key: field('choropleth/symbolmap: data field with the region or country name/code to match.'),
    featureKey: field('choropleth: feature property to match against (default tries code, id, ISO-3, name and aliases).'),
    midpoint: { type: 'number', description: 'choropleth/heatmap: diverging color scale around this value (e.g. 0 for changes).' },
    classes: { type: 'integer', description: 'choropleth: number of color classes (default 5).' },
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
    time: field('Time field (d3plus-style): shows one period at a time (the latest by default) and, in the browser, a slider with play. Not used by line/area, which get a range slider.'),
    timeValue: { description: 'Period to show when `time` is set.' },
    slider: { type: 'boolean', description: 'Browser: false removes the time slider (the chart shows `timeValue` or the latest period).' },
    play: { type: 'boolean', description: 'Browser: false keeps the time slider but hides the play button.' },
    compare: { description: 'With `time`: period to compute changes against: "previous" (default), "first", a specific period, or false.', anyOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }] },
    colorBy: { type: 'string', enum: ['group', 'change', 'label'], description: 'treemap: "change" colors tiles by % change vs the comparison period (diverging, growth cool / decline warm); "label" colors a single-level treemap by item.' },
    shade: { type: 'boolean', description: 'treemap/sunburst: subtle lightness steps inside each category (default false: one solid color per category).' },
    xRange: { type: 'array', description: 'line/area: visible x range [from, to] (what the range slider sets).' },
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
    width: { type: 'number', description: 'Width in px (default 500; render() uses the container width). Capped at 8000.' },
    height: { type: 'number', description: 'Height in px (default 500; render() uses the container height when the container has one). Without it, charts with many rows (horizontal bars, heatmaps, flow charts, KPI tiles) grow past 500 to fit. Capped at 8000.' },
  },
};

/** Tool definition ready for Claude (Anthropic) or OpenAI. */
export function toolDefinition({ name = 'plot', flavor = 'anthropic' } = {}) {
  const description =
    'Draws an elegant, accessible chart from tabular data. Pass rows in `data`, name the fields (x, y, series/hue…) and write a `title` that states the finding. Returns an SVG. Types: bar, count, line, area, scatter, bubble, regplot, residplot, jointplot, hist, kde, ecdf, box, violin, strip, swarm, point, radar, treemap, sunburst, donut, pie, heatmap, sankey, kpi, choropleth (Chile regions / world countries built in), symbolmap, network, chord, pyramid, flowchart (seaborn names accepted). `facet` makes panels; `time` adds a per-period slider. Set `locale: "en"` for English number formats.';
  const { $schema, $id, title, ...params } = schema;
  if (flavor === 'openai') return { type: 'function', function: { name, description, parameters: params } };
  return { name, description, input_schema: params };
}
