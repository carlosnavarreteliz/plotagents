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
- **Your own scale** is a list of two or more colors, evenly spaced from low to high, or `{ colors, reverse, mid }`.
- Interpolation happens in OKLab, so steps look even. The stops were sampled from matplotlib 3.9 and stay within 2 ΔE (×100) of the original.
- `cmap` and `colormap` are aliases of `colorScale`. The older `ramp` option still works.

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
