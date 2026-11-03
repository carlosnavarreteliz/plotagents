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

Every later `plot()`, `render()` and `toHTML()` starts from these values; the spec always wins. `configure()` returns the current defaults and `configure(null)` clears them.

## Built-in themes

| Name | Mode | Surface | Use |
|---|---|---|---|
| `papel` (alias `light`) | light | `#FCFBF9` paper | default |
| `noche` (alias `dark`) | dark | `#0B0F2B` deep navy | dark pages, slides |

Both share the same eight hues, stepped separately for each surface and validated on it.

## Keys

| Key | Type | Meaning |
|---|---|---|
| `extends` | `'papel' \| 'noche'` | Base to merge over (default `papel`, or `noche` when `mode: 'dark'`). |
| `mode` | `'light' \| 'dark'` | Affects tooltips and text-on-fill contrast. |
| `surface` | color | Chart background. Also used for 2 px gaps and rings around marks. |
| `ink`, `lede`, `muted` | color | Primary text, secondary text, axis and source text. |
| `grid`, `axis` | color | Gridlines and baselines (1 px, solid). |
| `tint`, `tint2` | color | Quiet fills: KPI tiles, slider tracks, meters. |
| `dim` | color | Muted marks when `highlight` is used. |
| `other` | color | The "Other" bucket and series past the 8th. |
| `categorical` | colors or palette name | Identity colors, assigned in this order. |
| `sequential` | colors or ramp name | Light → dark, for heatmaps. |
| `diverging` | colors or ramp name | Two poles with a neutral midpoint. |
| `status` | `{ good, warning, critical }` | KPI deltas and meters. Never used for series. |
| `font` | `{ family, mono, import }` | Font stack and optional Google Fonts URL (`fontImport: true` embeds it in the SVG). |
| `type` | `{ title, subtitle, label, axis, legend, source, titleWeight }` | Type sizes in px. Titles shrink automatically on narrow widths. |
| `marks` | `{ barRadius, barMax, barMaxH, lineWidth, pointRadius, gap, ring, areaOpacity, bandOpacity, dotOpacity }` | Mark geometry. |
| `axes` | `{ inside, grid }` | `inside: true` puts y labels on their gridlines inside the plot (more width for data). |
| `layout` | `{ padding, paddingSmall }` | Outer margin on wide and narrow widths. |

## Named palettes and ramps

| Palettes (`categorical`) | Ramps (`sequential` / `diverging`) |
|---|---|
| `cdia` (default), `cdia-noche`, `okabe-ito`, `tableau10`, `udec` | `indigo`, `magenta`, `teal`, `amber`, `indigo-magenta`, `teal-rust` |

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
