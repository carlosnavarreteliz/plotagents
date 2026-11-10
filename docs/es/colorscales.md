# Escalas de color

Todos los mapas de colores que trae matplotlib están disponibles por nombre, además de los tuyos. Úsalos en cualquier gráfico que asigne un color a un número: mapas de calor, coropletas, mapas de puntos, treemaps coloreados por cambio y nubes de palabras.

```js
plot({ type: 'heatmap', data, x: 'hour', y: 'day', value: 'trips', colorScale: 'viridis' });
plot({ type: 'choropleth', geo: 'chile', data, key: 'region', value: 'change', colorScale: 'RdBu' });
plot({ ...spec, colorScale: 'magma_r' });                       // _r reverses any map
plot({ ...spec, colorScale: ['#FFF7EC', '#FC8D59', '#7F0000'] }); // your own stops
plot({ ...spec, colorScale: { name: 'coolwarm', mid: 100 } });    // diverging around 100
```

- **Los nombres no distinguen mayúsculas** (`'rdbu'` funciona) y `_r` invierte cualquier mapa.
- **Los mapas divergentes se centran solos**: en 0 cuando los datos cruzan el cero; si no, en el punto medio de los datos. Fija `mid` (o `midpoint`) para elegir el centro.
- **Tu propia escala** es una lista de dos o más colores, repartidos de forma pareja de menor a mayor, o `{ colors, reverse, mid }`.
- La interpolación ocurre en OKLab, así que los pasos se ven parejos. Las paradas se muestrearon de matplotlib 3.9 y quedan a menos de 2 ΔE (×100) del original.
- `cmap` y `colormap` son alias de `colorScale`. La opción anterior `ramp` todavía funciona.

## Paletas categóricas

`palette` acepta una lista de colores, una paleta de plotagents o uno de los mapas cualitativos de matplotlib:

```js
plot({ ...spec, palette: 'tab10' });
plot({ ...spec, palette: 'Set2' });
plot({ ...spec, palette: 'viridis' });   // a continuous map, sampled into distinct colors
```

La paleta por defecto está validada para deficiencias de visión del color; `lint` revisa cualquier otra paleta que traigas (consulta [Temas](themes.md#validating-a-palette)).

## ¿Cuál usar?

| Datos | Usa | Evita |
|---|---|---|
| Valores ordenados, de menor → mayor | `viridis`, `cividis`, `magma`, `Blues`, `YlGnBu` | `jet`, `rainbow`, `hsv` (inventan bordes donde los datos no los tienen) |
| Valores en torno a un centro con significado (0, una meta, un promedio) | `RdBu`, `coolwarm`, `PuOr`, `BrBG` | un mapa secuencial |
| Ángulos, horas del día, meses | `twilight`, `hsv` | un mapa secuencial |
| Categorías | `palette: 'tab10'`, `'Set2'`, `'Dark2'` | cualquier mapa continuo como `colorScale` |

`lint` marca los mapas arcoíris con una sugerencia y rechaza un mapa cualitativo usado como escala continua.

## Todas las escalas

{{colorscales}}

La lista también está disponible en código: `colorScaleNames()` devuelve los nombres agrupados por tipo y `resolveColorScale(name)` devuelve `{ name, stops, kind }`.
