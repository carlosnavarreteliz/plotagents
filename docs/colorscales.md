# Color scales

Every colormap that ships with matplotlib is available by name, plus your own. Use them wherever a chart maps a number to a color: heatmaps, choropleths, point maps, treemaps colored by change and word clouds.

```js
plot({ type: 'heatmap', data, x: 'hour', y: 'day', value: 'trips', colorScale: 'viridis' });
plot({ type: 'choropleth', geo: 'chile', data, key: 'region', value: 'change', colorScale: 'RdBu' });
plot({ ...spec, colorScale: 'magma_r' });                       // _r reverses any map
plot({ ...spec, colorScale: ['#FFF7EC', '#FC8D59', '#7F0000'] }); // your own stops
plot({ ...spec, colorScale: { name: 'coolwarm', mid: 100 } });    // diverging around 100
```

- **Names are case-insensitive** (`'rdbu'` works) and `_r` reverses any map.
- **Diverging maps center themselves**: on 0 when the data crosses zero, otherwise on the middle of the data. Set `mid` (or `midpoint`) to choose the center.
- **Your own scale** is a list of two or more colors, evenly spaced from low to high, or `{ colors, reverse, mid }`. Colors are hex, `rgb()` / `rgba()` (the alpha is dropped) or CSS names; one that is none of these is dropped, and `lint` names it (`colorscale-color`).
- Interpolation happens in OKLab, so steps look even. The stops were sampled from matplotlib 3.9 and stay within 2 ΔE (×100) of the original.
- `cmap` and `colormap` are aliases of `colorScale`. The older `ramp` option still works.

## Classes

Give `breaks` and the scale becomes discrete classes: a value falls in class *i* when `breaks[i-1] ≤ v < breaks[i]`.

```js
plot({ ...spec, colorScale: { colors: ['#2166AC', '#92C5DE', '#F7F7F7', '#F4A582', '#B2182B'], breaks: [-1, -0.25, 0.25, 1] } });
plot({ ...spec, colorScale: { name: 'Blues', breaks: [10, 20, 40] } });   // 4 classes sampled from Blues
```

`colors` needs one more entry than `breaks` (or give `name` and it is sampled). Works in heatmaps, choropleths and treemaps colored by change (breaks as fractions: `0.1` is 10%). The legend becomes a stepped key, one swatch per class, with the breaks written under it through `format`. A mismatch between breaks and colors is a `lint` error with the fix.

A value equal to a break goes to the class above it. `closed: "right"` puts it in the class below (`breaks[i-1] < v ≤ breaks[i]`), as in a key that reads "up to 10". Repeated breaks (quantiles of data with ties) are merged: the class between them would be empty, so it and its color drop out (`lint` says so). `breaks: []` with one color is a single class (too few values to cut), and all of this holds per view in a choropleth with `views`: quantiles computed by the page ("up to the value at the 20th percentile") go in as they are, with `closed: "right"`, ties and all.

## Categorical palettes

`palette` takes a list of colors, a plotagents palette, or one of matplotlib's qualitative maps:

```js
plot({ ...spec, palette: 'tab10' });
plot({ ...spec, palette: 'Set2' });
plot({ ...spec, palette: 'viridis' });   // a continuous map, sampled into distinct colors
```

The default palette is validated for color-vision deficiencies; `lint` checks any other palette you bring (see [Themes](themes.md#validating-a-palette)).

## Which one?

| Data | Use | Avoid |
|---|---|---|
| Ordered values, low → high | `viridis`, `cividis`, `magma`, `Blues`, `YlGnBu` | `jet`, `rainbow`, `hsv` (they invent edges where the data has none) |
| Values around a meaningful center (0, a target, an average) | `RdBu`, `coolwarm`, `PuOr`, `BrBG` | a sequential map |
| Angles, hours of the day, months | `twilight`, `hsv` | a sequential map |
| Categories | `palette: 'tab10'`, `'Set2'`, `'Dark2'` | any continuous map as `colorScale` |

`lint` flags the rainbow maps with a suggestion, and refuses a qualitative map used as a continuous scale.

## All scales

{{colorscales}}

The list is also available in code: `colorScaleNames()` returns the names grouped by kind, and `resolveColorScale(name)` returns `{ name, stops, kind }`.
