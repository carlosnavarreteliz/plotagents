# Rendering: SVG or Canvas?

**Decision: SVG everywhere, with automatic path batching for dense marks.** Canvas was evaluated and rejected: batched SVG is faster than Canvas on every size we tested and keeps the properties that matter for a library used by agents.

## What we measured

Scatter plot, two colors, 720 × 420 px, Chromium (Playwright), time from inserting the markup to the second animation frame. Same machine, same data.

| Points | SVG, one `<circle>` per point | Canvas 2D (`arc` + `fill`) | SVG, one `<path>` per color | plotagents (batched SVG, full chart) |
|---|---|---|---|---|
| 1,000 | 32 ms | 29 ms | 22 ms | 26 ms |
| 5,000 | 62 ms | 30 ms | 13 ms | 12 ms |
| 20,000 | 671 ms · 2.9 MB | 100 ms | 37 ms | 38 ms · 2.1 MB |
| 50,000 | 1,468 ms · 7.2 MB | 357 ms | 138 ms | 123 ms · 3.4 MB |

The cost of naive SVG is the DOM: one element per mark. Drawing all circles of one color as arcs inside a single `<path>` removes that cost, and the browser rasterizes one path faster than a script can issue tens of thousands of Canvas calls.

Reproduce it with `node scripts/bench.js` (needs Playwright with Chromium installed).

## Why SVG wins for this library

| Need | SVG | Canvas |
|---|---|---|
| Render on a server, in Node, with zero dependencies | Yes: SVG is a string | Needs a native module (`node-canvas`) or a headless browser |
| An agent can read and check its own output | Yes: titles, labels and values are text | No: a bitmap |
| Accessibility (`<title>`, `<desc>`, screen readers, text selection) | Built in | Must be rebuilt by hand next to the canvas |
| Crisp at any zoom, print and PDF | Vector | Fixed resolution; must re-render for each pixel ratio |
| Paste into slides, Word, Figma, Markdown, email | Works as a file | Only as an image |
| Theming with CSS, dark mode, hover states | CSS classes | Manual redraw |
| 50,000+ points | Fast with batching (above) | Fast |

Canvas only wins when a chart needs hundreds of thousands of marks redrawn every frame, such as live streaming or animated particle fields. That is outside what a chart for decisions needs, and well past the point where a heatmap or a density plot (`kde`, `hist`) tells the story better than overplotted points.

## How batching works

`dotLayer()` in `src/svg.js` takes the circles a chart wants to draw:

- **Up to 1,500 points:** one `<circle>` each, with its own tooltip and hover state.
- **More than 1,500 points:** circles are grouped by style (color, radius, opacity) and each group becomes one `<path>` of arcs. A transparent `<rect class="pa-near">` carries the coordinates and tooltip text of up to 20,000 points, and the browser layer finds the nearest point within 14 px on hover and rings it.

Scatter, bubble, regplot, residplot, jointplot, strip and swarm use it automatically. No option is needed.

## Other performance choices

- **Text measurement without a DOM.** Width tables calibrated for humanist sans faces let labels be fitted, wrapped and truncated identically in Node and in the browser.
- **Numbers rounded to two decimals** in all coordinates keeps files small.
- **One file for the browser.** `dist/plotagents.js` (no dependencies) is inlined by `toHTML()` so interactive pages work offline, from a file, or inside an artifact.
