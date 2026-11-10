# Themes

A theme is a JSON object. Pass a name or an object; objects are deep-merged over a base theme, so you only write what changes.

```js
plot({ ...spec, theme: 'noche' });                         // built-in dark theme
plot({ ...spec, theme: { extends: 'noche', marks: { lineWidth: 3 } } });
plot({ ...spec, palette: 'okabe-ito' });                    // shortcut for theme.categorical
plot({ ...spec, ramp: 'teal' });                            // shortcut for theme.sequential
```

## Library-wide defaults

```js
configure({ font: 'Poppins', textScale: 1.4, theme: { extends: 'papel', marks: { lineWidth: 2.5 } } });
```

Every later `plot()`, `render()`, `toHTML()` and dashboard starts from these values; the spec always wins. A spec's own `theme` object is deep-merged **over** the global theme, so `configure({ theme: 'noche' })` plus `theme: { marks: { barRadius: 0 } }` stays dark. `configure()` returns the current defaults and `configure(null)` clears them.

## Your own theme, everywhere

The default theme (`papel`) never changes unless you ask. To restyle every chart, register a theme once and make it the default:

```js
import { registerTheme, configure } from 'plotagents';

registerTheme('acme', {
  extends: 'papel',              // or 'noche', or another registered theme
  background: '#FFFFFF',         // alias of surface
  text: '#111827',               // alias of ink
  lede: '#4B5563',
  muted: '#6B7280',
  grid: { color: '#EEF0F4', dash: '2 3', width: 1 },
  axis: '#C7CBD6',
  categorical: 'tab10',          // any palette or matplotlib qualitative map
  sequential: 'viridis',         // any colormap name
  tooltip: { bg: '#111827', ink: '#FFFFFF' },
  radius: 2,                     // bar, tile and swatch corners
  font: 'Inter',                 // Google Fonts name or CSS stack
});

configure({ theme: 'acme' });
```

`theme: 'acme'` also works per chart, and `{ extends: 'acme', … }` builds on it. Colors are validated: anything that is not a CSS color (hex, `rgb()`, `hsl()` or a color name) is dropped and the base value is kept.

## Built-in themes

| Name | Mode | Surface | Use |
|---|---|---|---|
| `papel` (alias `light`) | light | `#FCFBF9` paper | default |
| `noche` (alias `dark`) | dark | `#0B0F2B` deep navy | dark pages, slides |

Both share the same eight hues, stepped separately for each surface and validated on it.

## Keys

| Key | Type | Meaning |
|---|---|---|
| `extends` | theme name or object | Base to merge over (default `papel`, or `noche` when `mode: 'dark'`). |
| `mode` | `'light' \| 'dark'` | Affects tooltips and text-on-fill contrast. |
| `surface` (alias `background`) | color | Chart background. Also used for 2 px gaps and rings around marks. |
| `ink` (alias `text`), `lede`, `muted` | color | Primary text, secondary text, axis and source text. |
| `grid` | color or `{ color, dash, width }` | Gridlines (default 1 px, solid). `dash: '2 3'` draws dotted gridlines. |
| `axis` | color or `{ color, width }` | Baselines. |
| `tooltip` | `{ bg, ink }` | Tooltip card colors in the browser (default: white card on light themes, navy on dark). |
| `radius`, `barRadius` | number | Corner radius of bars (default 4). `radius` sets it for every mark that has corners. |
| `tint`, `tint2` | color | Quiet fills: KPI tiles, slider tracks, meters. |
| `dim` | color | Muted marks when `highlight` is used. |
| `other` | color | The "Other" bucket and series past the 8th. |
| `categorical` | colors, palette or colormap name | Identity colors, assigned in this order. |
| `sequential` | colors, ramp or colormap name | Light → dark, for heatmaps and maps. |
| `diverging` | colors, ramp or colormap name | Two poles with a neutral midpoint. |
| `status` | `{ good, warning, critical }` | KPI deltas and meters. Never used for series. |
| `font` | `{ family, mono, import }` | Font stack and optional Google Fonts URL (`fontImport: true` embeds it in the SVG). |
| `type` | `{ title, subtitle, label, axis, legend, source, titleWeight }` | Type sizes in px. Titles shrink automatically on narrow widths. |
| `marks` | `{ barRadius, barMax, barMaxH, lineWidth, pointRadius, gap, ring, areaOpacity, bandOpacity, dotOpacity }` | Mark geometry. |
| `axes` | `{ inside, grid }` | `inside: true` puts y labels on their gridlines inside the plot (more width for data). |
| `layout` | `{ padding, paddingSmall }` | Outer margin on wide and narrow widths. |

## Named palettes and ramps

| Palettes (`categorical`) | Ramps (`sequential` / `diverging`) |
|---|---|
| `cdia` (default), `cdia-noche`, `okabe-ito`, `tableau10`, `udec`, plus matplotlib's `tab10`, `tab20`, `tab20b`, `tab20c`, `Set1`, `Set2`, `Set3`, `Pastel1`, `Pastel2`, `Paired`, `Accent`, `Dark2` | `indigo`, `magenta`, `teal`, `amber`, `indigo-magenta`, `teal-rust`, plus every matplotlib colormap (see [Color scales](colorscales.md)) |

## Validating a palette

```js
import { validatePalette } from 'plotagents';

validatePalette(['#223C6A', '#E69B0A', '#D21428'], { mode: 'light', surface: '#FFFFFF', locale: 'en' });
// { ok: false, checks: [
//   { name: 'lightness', status: 'fail', detail: 'Outside the lightness band 0.43–0.77: #223C6A' }, … ] }
```

| Check | Threshold | Why |
|---|---|---|
| Lightness band | OKLCH L 0.43–0.77 (light), 0.48–0.67 (dark) | Too light disappears, too dark reads as text. |
| Chroma floor | OKLCH C ≥ 0.10 | Below it a hue reads as gray. |
| Colorblind separation | ΔE OKLab × 100 ≥ 8 between neighbors, simulated protanopia and deuteranopia (Machado 2009) | Neighbors must stay apart for color-vision deficiencies. |
| Normal-vision separation | ΔE ≥ 15 | Neighbors must be easy to tell apart for everyone. |
| Contrast with the surface | ≥ 3:1, warning only | Below it, marks need visible labels. |

Use `pairs: 'all'` for scatter plots and maps, where any two colors can sit next to each other. The built-in palette passes all-pairs for its first three colors, which is why `lint` warns about scatter plots with more than three groups.

`lint(spec)` runs this automatically whenever a spec brings its own palette. Messages follow `locale` (Spanish by default, `'en'` for English).

## Color follows the entity

Colors are assigned to entities, never to positions:

- With `time`, colors are computed over all periods, so a group keeps its color while the slider moves even if its rank changes.
- With `focus` (drill-down), the subtree keeps its parent's color family.
- With `facet`, every panel shares one color map.
- `colors: { "Copper": "#B5562E" }` pins any entity to a color.
