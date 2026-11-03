# API reference

```js
import {
  plot, safePlot, lint, describe, render, toHTML, configure,
  schema, toolDefinition, validatePalette, registerGeo,
} from 'plotagents';
```

Full types are in [`index.d.ts`](../index.d.ts) and every spec option in [`schema.json`](../schema.json).

## Drawing

### `plot(spec)`

Draws a chart and returns an SVG string. Works in Node, Deno, Bun and the browser. Throws a `PlotError` when the spec cannot be drawn; the error's `hint` says how to fix it.

```js
const svg = plot({ type: 'bar', data, x: 'region', y: 'sales', title: 'Biobío leads with 30%' });
```

### `safePlot(spec)`

The version to expose as an agent tool: it never throws.

```js
const { ok, svg, type, description, errors, warnings, suggestions } = safePlot(spec);
```

| Field | Meaning |
|---|---|
| `ok` | `true` when the chart was drawn. |
| `svg` | The SVG string, or `null`. |
| `type` | The resolved chart type (useful when `type` was inferred). |
| `description` | Alt text for the chart. |
| `errors` | Problems that stop the chart: `{ code, message, fix }`. |
| `warnings` | Problems that make the chart misleading or hard to read. |
| `suggestions` | Design improvements, such as a better title or `highlight`. |

### `lint(spec)`

Reviews a spec without drawing it and returns `{ ok, type, errors, warnings, suggestions }`. Messages are written in Spanish; each one carries a `fix` with the change to make.

### `describe(spec)`

Returns a text description of the chart, such as "Highest: Biobío with 1,240 (30%)…". The same text goes into the SVG's `<desc>` for screen readers.

## In the browser

### `render(target, spec, opts?)`

Draws into an element (a CSS selector or a DOM node) with tooltips, responsive width, time sliders, a range slider for time series, drill-down for treemaps and sunbursts, and click-to-focus for networks.

```js
const chart = plotagents.render('#chart', spec);
chart.update({ ...spec, highlight: 'Ñuble' });   // redraw
chart.destroy();                                // remove listeners and markup
```

| Option | Meaning |
|---|---|
| `controls` | `false` hides sliders and play buttons. |

The handle exposes `svg` (the current `<svg>` element) and `spec`.

### `attach(root)`

Adds tooltips to a container that already holds a plotagents SVG, for example one rendered on the server.

### `toHTML(specs, opts?)`

A self-contained HTML page with one or more interactive charts and the library inlined.

| Option | Default | Meaning |
|---|---|---|
| `title` | `"Gráficos"` | Page title. |
| `lang` | `"es"` | Page language. |
| `columns` | `1` | Two or more lay charts out in a grid. |

## Configuration

### `configure(options)`

Sets defaults for every later chart; the spec always wins.

```js
configure({ font: 'Poppins', textScale: 1.5, locale: 'en' });
configure();       // returns the current defaults
configure(null);   // clears them
```

It accepts any spec option: `font`, `textScale`, `locale`, `theme`, `palette`, `ramp` and so on.

### `validatePalette(colors, opts?)`

Checks a custom palette with the same tests the built-in one passes. See [themes](themes.md#validating-a-palette).

```js
validatePalette(['#223C6A', '#E69B0A', '#D21428'], { mode: 'light', surface: '#FFFFFF' });
// → { ok: false, checks: [{ name: 'lightness', status: 'fail', detail: '…' }, …] }
```

### `registerGeo(name, featureCollection, aliases?)`

Registers your own GeoJSON so specs can use `geo: name`. Chile and the world are built in.

## For agents

### `toolDefinition({ name?, flavor? })`

Returns a tool definition built from the JSON Schema: `flavor: "anthropic"` (default) gives `{ name, description, input_schema }`, `flavor: "openai"` gives `{ type: "function", function: { … } }`.

```js
import Anthropic from '@anthropic-ai/sdk';
import { safePlot, toolDefinition } from 'plotagents';

const client = new Anthropic();
const res = await client.messages.create({
  model: process.env.ANTHROPIC_MODEL,
  max_tokens: 4096,
  tools: [toolDefinition()],
  messages: [{ role: 'user', content: 'Plot the distribution of service times per clinic: …' }],
});
const call = res.content.find((b) => b.type === 'tool_use');
const { ok, svg, errors } = safePlot(call.input);
// If !ok, send `errors` back as the tool_result: every error carries a `fix`.
```

### `schema`

The JSON Schema of a spec, also published as [`schema.json`](../schema.json) and importable as `plotagents/schema.json`.

## Helpers

| Export | Meaning |
|---|---|
| `TYPES` | Every chart type name. |
| `themes`, `getTheme(t)`, `themeFor(spec)` | Built-in themes and the resolved theme of a spec. |
| `palettes`, `ramps` | Named categorical palettes and sequential/diverging ramps. |
| `timeValues(spec)` | Sorted values of the `time` field. |
| `makeFormat(fmt, locale, values)` | The number formatter a chart would use. |
| `formatNumber(v, decimals, locale)`, `formatCompact(v, locale)` | Locale-aware number formatting. |
| `squarify(items, x, y, w, h)` | The treemap layout algorithm. |
| `bundleSource()` | Node only: the browser build as a string, for inlining. |

## Package entry points

| Import | Contents |
|---|---|
| `plotagents` | Everything above (ES module). |
| `plotagents/schema.json` | The JSON Schema. |
| `plotagents/browser` | `dist/plotagents.js`: a `<script>` that defines `window.plotagents`. |
| `plotagents/browser/geo` | `dist/plotagents-geo.js`: Chile and world geometries for the browser build. |
| `plotagents/geo/chile`, `plotagents/geo/world` | The geometries as ES modules. |
