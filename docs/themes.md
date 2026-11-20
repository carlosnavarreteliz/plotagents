# Themes

A theme is a JSON object. Pass a name or an object; objects are deep-merged over a base theme, so you only write what changes.

```js
plot({ ...spec, theme: 'noche' });                         // built-in dark theme
plot({ ...spec, theme: { extends: 'noche', marks: { lineWidth: 3 } } });
plot({ ...spec, palette: 'okabe-ito' });                    // shortcut for theme.categorical
plot({ ...spec, palette: 'bosque' });                       // a palette family: matching ramps, light and dark
plot({ ...spec, palettes: ['cdia', 'bosque', 'oceano'] });  // alternatives in one SVG
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
| `font` | `{ family, mono, import }` | Font stack and optional stylesheet URL (`fontImport: true` embeds it in the SVG). From a spec, `import` must be https on Google Fonts, Bunny Fonts, Adobe Fonts (Typekit) or cdnfonts; other hosts are dropped. Themes registered with `registerTheme()` keep any https URL, and `configure({ fontHosts: ['fonts.example.com'] })` allows more hosts. |
| `type` | `{ title, subtitle, label, axis, legend, source, titleWeight }` | Type sizes in px. Titles shrink automatically on narrow widths. |
| `marks` | `{ barRadius, barMax, barMaxH, lineWidth, pointRadius, gap, ring, areaOpacity, bandOpacity, dotOpacity }` | Mark geometry. |
| `axes` | `{ inside, grid }` | `inside: true` puts y labels on their gridlines inside the plot (more width for data). |
| `layout` | `{ padding }` | Outer margin for every chart with this theme (same forms as the `padding` option). Default 8 top and bottom, 0 at the sides. |

## Palette families: alternatives that go together

A family is a categorical palette with a matching sequential and diverging ramp, stepped separately for light and dark surfaces. Every family passes the same checks as the default one, in its fixed order: lightness band, chroma floor, colorblind separation between neighbors (ΔE ≥ 11.9 in every new family, target 8), normal vision (ΔE ≥ 15), and its first three colors are told apart pairwise.

```js
plot({ ...spec, palette: 'bosque' });                     // categorical + matching ramps
plot({ ...spec, palette: 'bosque', theme: 'noche' });     // the same family, stepped for dark
configure({ palette: 'oceano' });                         // every chart
```

| Name | Family | Light (fixed order) |
|---|---|---|
| `cdia` | CDIA | `#3A47B8` `#D42A5E` `#E8A33D` `#1E9C89` `#7B5CD6` `#B5562E` `#5BA3E0` `#8E9A2F` |
| `terracota` | Terracotta | `#A23A0C` `#256EB7` `#D37895` `#336E25` `#D1A045` `#864C93` `#C97B32` `#02A396` |
| `bosque` | Forest | `#1F6F38` `#DD983C` `#4BAAF4` `#C2A305` `#884401` `#859C19` `#99376C` `#D77E54` |
| `oceano` | Ocean | `#1065BF` `#F49383` `#0596D0` `#9D2A3F` `#06BAAB` `#8865C0` `#CE9E22` `#017B4F` |
| `atardecer` | Sunset | `#7047A9` `#F78104` `#0ABFA9` `#AA4068` `#3994D8` `#DB9D02` `#546ABB` `#CC4F3F` |
| `jardin` | Garden | `#BF6291` `#939422` `#B495EA` `#C88833` `#5194E7` `#337A39` `#7C3977` `#05BAB3` |
| `retro` | Retro | `#06A094` `#CB6B2D` `#22559E` `#C39B03` `#994440` `#6D9A34` `#944B01` `#F48397` |

The family's ramps replace only the built-in ones: `ramp`, `colorScale` or a theme with its own `sequential` / `diverging` still win. Each name also works on its own: `theme: { categorical: 'bosque' }`, `'bosque-noche'` for the dark list, `ramp: 'bosque'` and `'bosque-diverging'`. `paletteFamilies` exports them all and `familyColors(name, mode)` returns `{ categorical, sequential, diverging }` for one mode.

### Several alternatives in one SVG

`palettes` bakes alternatives into the same file, so the reader (or your page) can switch the look without a new SVG:

```js
plot({ ...spec, palettes: ['cdia', 'bosque', 'oceano'] });   // or palettes: true for every family
```

```html
<html data-palette=bosque>   <!-- any ancestor works; without it, the first palette shows -->
```

The first name (or `palette`, when set) is the default, written in the attributes, so an `<img>` shows it. Every other one is a [skin](#skins-several-color-sets-in-one-svg) under `[data-palette="name"]`; heatmaps, maps and treemaps switch their ramps too. `toHTML()` adds a row of buttons that sets `data-palette` on the page, dashboards pass `palettes` to every chart, and `configure({ palettes })` turns it on everywhere (`palettes: null` turns it off for one chart).

## Named palettes and ramps

| Palettes (`categorical`) | Ramps (`sequential` / `diverging`) |
|---|---|
| `cdia` (default), `cdia-noche`, the families above (`terracota`, `bosque`, `oceano`, `atardecer`, `jardin`, `retro`, and each `-noche`), `okabe-ito`, `tableau10`, `udec`, plus matplotlib's `tab10`, `tab20`, `tab20b`, `tab20c`, `Set1`, `Set2`, `Set3`, `Pastel1`, `Pastel2`, `Paired`, `Accent`, `Dark2` | `indigo`, `magenta`, `teal`, `amber`, `indigo-magenta`, `teal-rust`, each family and `<family>-diverging`, plus every matplotlib colormap (see [Color scales](colorscales.md)) |

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

## Colors the page decides

Any color in a spec (`colors`, `palette`, `ramp`, `colorScale`, any theme key) can be a CSS variable with a fallback:

```js
plot({ ...spec, palette: ['var(--accent, #3A47B8)'], theme: { ink: 'var(--ink, #141A3F)', grid: 'var(--rule, #E9EBF3)' } });
```

The mark is written with the variable, so a section, a dark mode or a brand switch on the page recolors it with no new SVG. The fallback is what the library computes with (text on a filled mark picks white or dark from it, tints are mixed from it) and what an SVG shows outside the page, in an `<img>` or a file. A variable without a hex or `rgb()` fallback is an error.

## Skins: several color sets in one SVG

A static site cannot hand a reader a different fill when they switch the look: the fill is already in the file. `skins` writes every set into the same SVG and lets the page's CSS pick:

```js
plot({
  ...spec,
  skins: [
    { palette: ['#6E86C8', '#D9714F'] },                                     // default, in the attributes
    { when: 'html.classic', palette: ['#0B3F8C', '#D52B1E'], theme: { surface: '#FFFFFF' } },
  ],
});
```

Each skin patches only colors (`theme`, `palette`, `ramp`, `colorScale`, `colors`) and is drawn on its own; wherever two skins disagree, the mark gets a CSS variable defined in the SVG's own `<style>` under each skin's `when` selector. Attributes keep the first skin, so an `<img>` and the legend highlight still work. Positions, text and order must come out the same in every skin, or `plot` throws. Skins nest with CSS-variable colors, and `configure({ skins })` sets them for every chart (`skins: null` turns them off for one).

## Color follows the entity

Colors are assigned to entities, never to positions:

- With `time`, colors are computed over all periods, so a group keeps its color while the slider moves even if its rank changes.
- With `focus` (drill-down), the subtree keeps its parent's color family.
- With `facet`, every panel shares one color map.
- `colors: { "Copper": "#B5562E" }` pins any entity to a color.
