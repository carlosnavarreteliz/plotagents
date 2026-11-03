# Getting started

plotagents turns one JSON object into a finished, accessible SVG chart. You pass rows of data and name the fields; the library makes every design decision: chart layout, colors, labels, number formats and spacing.

## Install

```bash
npm install plotagents
```

Or straight from GitHub:

```bash
npm install github:carlosnavarreteliz/plotagents
```

Node 18 or later, Deno and Bun work out of the box. The package has no dependencies.

## Your first chart

```js
import { plot } from 'plotagents';

const svg = plot({
  type: 'bar',
  title: 'Biobío accounts for 30% of southern sales',
  subtitle: 'Sales by region, CLP millions, 2025',
  source: 'illustrative data',
  data: [
    { region: 'Biobío', sales: 1240 },
    { region: 'Araucanía', sales: 880 },
    { region: 'Ñuble', sales: 610 },
  ],
  x: 'region',
  y: 'sales',
  locale: 'en',
});
```

`svg` is a string. Write it to a `.svg` file, put it in HTML or Markdown, or convert it to PDF or PNG with any SVG tool.

## Anatomy of a spec

| Field | What it is |
|---|---|
| `type` | The chart type, such as `bar`, `line` or `treemap`. Leave it out to infer it from the data. |
| `data` | A list of rows: `[{ region: "Biobío", sales: 1240 }]`. |
| `x`, `y`, `series` | Which field goes where. Each chart type documents its own roles in the [chart reference](charts.md). |
| `title` | The finding, as a full sentence with the key number. |
| `subtitle` | How to read the chart: measure, unit and period. |
| `source` | Where the data comes from. Use `"illustrative data"` when it is made up. |
| `locale` | `"es"` (the default, `1.234,5`) or `"en"` (`1,234.5`). |

### Wide tables

When each measure is its own column, pass a list in `y` and each field becomes a series:

```js
plot({
  type: 'line',
  data: [
    { month: '2025-01', revenue: 120, costs: 90 },
    { month: '2025-02', revenue: 132, costs: 94 },
  ],
  x: 'month',
  y: ['revenue', 'costs'],
});
```

### Numbers written as text

Values such as `"1.234,5"`, `"12%"` or `"$ 3.000"` are parsed automatically, so data copied from a spreadsheet works without cleaning.

## In the browser

Without a bundler, load the browser build and call `render()`. It draws into an element and adds tooltips, responsive width, time sliders and drill-down.

```html
<div id="chart"></div>
<script src="https://cdn.jsdelivr.net/gh/carlosnavarreteliz/plotagents@master/dist/plotagents.js"></script>
<script>
  plotagents.render('#chart', {
    type: 'line',
    data: [
      { month: '2025-01', sales: 120 },
      { month: '2025-02', sales: 140 },
      { month: '2025-03', sales: 135 },
    ],
    x: 'month',
    y: 'sales',
    title: 'Sales rose 12% in the first quarter',
    locale: 'en',
  });
</script>
```

The same file ships in the package as `dist/plotagents.js`. Maps need the geometries too: add `dist/plotagents-geo.js` after `plotagents.js`.

`render()` returns a handle with `update(spec)` to redraw with a new spec and `destroy()` to remove the chart and its listeners.

## A whole report in one file

`toHTML()` builds a self-contained, interactive page with the library inlined, so it works offline and from a file.

```js
import { writeFileSync } from 'node:fs';
import { toHTML } from 'plotagents';

writeFileSync('report.html', toHTML([spec1, spec2], { title: 'Monthly report', lang: 'en', columns: 2 }));
```

## From the command line

```bash
npx plotagents spec.json -o chart.svg       # SVG
npx plotagents specs.json -o report.html    # several interactive charts on one page
npx plotagents spec.json --lint             # review and suggestions
npx plotagents spec.json --describe         # alt text
npx plotagents --tool                       # tool definition for an agent
```

The CLI also reads a spec from standard input: `cat spec.json | npx plotagents > chart.svg`.

## Catching mistakes

`plot()` throws a `PlotError` with a hint when a spec cannot be drawn. `safePlot()` never throws, and `lint()` reviews a spec without drawing it:

```js
import { safePlot } from 'plotagents';

const { ok, svg, errors, warnings, suggestions } = safePlot(spec);
if (!ok) console.log(errors.map((e) => `${e.message} → ${e.fix}`));
```

Every error, warning and suggestion carries a `fix` that says what to change.

## Next steps

- Browse the [gallery](../examples/) to find the chart you need and copy its code.
- Try specs live in the [playground](../playground/).
- Read the [chart reference](charts.md) for every option of every type.
- Give an agent the [agent guide](agents.md) and the tool definition.
