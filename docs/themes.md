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

## Light marks (`bare`)

A page that draws a rail or a sparkline in every row of a table (hundreds per page, each twice for wide and narrow) pays for chrome a cell does not need. `bare: true` writes the smallest SVG that still draws the same marks:

- no `<style>` block (a type's own functional CSS stays: a map's views, a table's cards), no `role`, `<title>` or `<desc>` but `aria-hidden="true"`: the surrounding HTML (the row's name, its figure) carries the meaning;
- no empty groups, no background (unless `background: true`), no `data-pa-*` attributes (there is no runtime), no inline `max-width:100%` (which gives the SVG a minimum width of zero and collapses an auto-layout table column), and `font-family` only when there is text and it is not `inherit`;
- a rail puts its `data-tip` on the root, so the whole box answers without an invisible rectangle; straight strokes are `<path d="M x y H x2">` and references of one colour share one path.

A `var(--x, #fallback)` colour is written once, in the style, without the presentation attribute: `style="stroke:var(--x, #eee4d4)"`. That is safe in any page (inline styles take `var()`, and the fallback covers an undefined variable) but not for SVG files or rasterizers that ignore CSS: there, leave `bare` off.

**Skins.** With `bare`, each skin is drawn on its own and merged so:

- the same page variable in every skin (`var(--ground-2, #eee4d4)` and `var(--ground-2, #eef2f7)`) belongs to the page, which already reassigns it per skin: it is written once, with the first skin's fallback, and needs no rules at all;
- a colour that changes between skins (two literals, or `--azul` in one and `--accent` in the other) becomes a variable named after its colours, `--pa-<hash>`, on the class `pa-skins`. Its rules go in a `<style>` of each SVG; with `bare: { skinCSS: false }` they are left out, and `skinCSS(specs)` returns them to write once in the page. Every SVG with the same colours shares the variable, so one stylesheet serves all.

```js
import { plot, skinCSS } from 'plotagents';
const rails = rows.map((r) => ({ type: 'rail', data: [r], value: 'v', domain: ['lo', 'hi'], bare: { skinCSS: false }, skins }));
const css = skinCSS(rails);   // ".pa-skins{--pa-k1:#6e86c8}html.classic .pa-skins{--pa-k1:#0b3f8c}", or "" when only page variables change
const cells = rails.map(plot);
```

Without the skin rules a mark shows its first skin, never a black fill. A colour that is `var()` in one skin and a literal in another cannot be merged and throws: use a variable in both (or in neither).

## Color follows the entity

Colors are assigned to entities, never to positions:

- With `time`, colors are computed over all periods, so a group keeps its color while the slider moves even if its rank changes.
- With `focus` (drill-down), the subtree keeps its parent's color family.
- With `facet`, every panel shares one color map.
- `colors: { "Copper": "#B5562E" }` pins any entity to a color.
