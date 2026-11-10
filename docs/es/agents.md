# plotagents · guía para agentes de IA

Una función, un objeto JSON. Sin decisiones de diseño: la biblioteca las toma por ti.

```js
import { plot, safePlot } from 'plotagents';
const svg = plot({ type, data, x, y, series, title, subtitle, source });
```

## Reglas para un buen gráfico

1. **`title` es el hallazgo**, una oración completa con la cifra clave: "Biobío concentra el 30% de las ventas", no "Ventas por región".
2. **`subtitle` dice cómo leerlo**: medida, unidad y período.
3. **Define siempre `source`.** Si los datos son inventados, usa `source: "illustrative data"`.
4. `data` es una lista de filas (`[{ region: "Biobío", sales: 1240 }]`). Para una tabla ancha, pasa `y: ["revenue", "costs"]`.
5. Usa `safePlot(spec)` como tu herramienta: nunca lanza excepciones y devuelve `errors`, `warnings` y `suggestions`, cada uno con un `fix`. Si `ok` es `false`, corrige el spec y vuelve a llamarla.
6. Define `locale: "en"` para formatos numéricos en inglés (el valor por defecto es español: `1.234,5`); también hay `"pt"`, `"fr"`, `"de"` o `"auto"` para reconocerlo a partir del texto. Las tablas lo reconocen por sí solas.

## Qué tipo usar

| Para mostrar | `type` | Campos clave |
|---|---|---|
| Comparar categorías | `bar` | `x`, `y`, `series?`, `stack?` (`true` / `"percent"`), `top?` |
| Contar filas por categoría | `countplot` | `x` |
| Media por categoría con un IC | `barplot` o `point` | `x`, `y`, `hue?` |
| Cambio en el tiempo | `line` | `x` fecha (`"2024-03"`) o año, `y`, `series?`; `ci: true` con varias observaciones por x |
| Un plan de proyecto o un cronograma | `gantt` | `task`, `start`, `end` (o `duration`), `group?`, `progress?`, `dependsOn?`, `today?`, `collapsed?` |
| Volumen en el tiempo | `area` | como `line`; se apila con `series` |
| Medidas en escalas distintas | `line` + `index: true`, o `facet` | **no hay doble eje** |
| Crecimiento exponencial | `line` + `yScale: "log"` | |
| Relación entre dos medidas | `regplot` (ajuste + IC) / `scatter` / `bubble` | `x`, `y`, `hue?`, `size?`, `label?` |
| Relación + marginales | `jointplot` | `x`, `y` |
| Qué medidas se mueven juntas | `corr` (`correlation`) | `vars?` (por defecto: todos los campos numéricos), `method?` (`"spearman"`), `alpha?: 0.05`; `cluster: true` o `type: "clustermap"` las agrupa con un dendrograma |
| Todos los pares de medidas a la vez | `pairplot` (`splom`) | `vars` (3–6), `hue?`, `corner?`, `kind?: "reg"` |
| Distribución de una medida | `hist` (`kde: true`), `kde`, `ecdf` | `x`, `hue?` |
| Distribución por categoría | `box`, `violin`, `strip`, `swarm` | `x` categoría, `y` medida, `hue?` |
| Perfil multidimensional | `radar` | `axis`, `value`, `series` (≤ 4 series) |
| Parte de un todo jerárquico | `treemap` o `sunburst` | `path: [level1, level2, …]`, `value` |
| Parte de un todo, ≤ 6 partes | `donut` / `pie` | `label`, `value`; `half: true` para un semicírculo |
| Magnitud en una grilla | `heatmap` | `x`, `y`, `value` |
| Un valor por región, estado o país | `choropleth` (`symbolmap` para totales) | `geo: "chile" \| "usa" \| "world"` o cualquier objeto GeoJSON/TopoJSON, `key`, `value` (texto → un color por categoría) |
| Puntos en lugares reales sobre un mapa de calles | `pointmap` | `lon`, `lat` (se detectan solos), `size?`, `hue?`, `value?`, `label?`; `tiles: "osm"` (por defecto) / `"esri-gray"` / `"esri-dark"`, o carto-* / mapbox-* con `tilesKey` |
| Quién se conecta con quién | `network` | aristas `from`, `to`, `value?`; `nodes?` con `group`; `layout?` |
| Intercambios entre pocos grupos | `chord` | `from`, `to`, `value` |
| Estructura por edad | `pyramid` | `age`, `sex`, `value` |
| Un proceso con decisiones | `flowchart` | `nodes` (`type`, `lane`), `edges` (`label`) |
| Flujos entre etapas | `sankey` | `from`, `to`, `value` |
| Una o más cifras | `kpi` | `items: [{ label, value, delta, period, trend, target, good }]` |
| Valores exactos para consultar | `table` | `columns?: [field \| { field, type, label, format, good, target }]`, `sortBy?`, `total?`, `group?`; los tipos `bar`, `delta`, `heat`, `sparkline`, `progress`, `badge` y `check` se infieren cuando se omiten |
| Lo que más aparece en un texto | `wordcloud` | `text` (campo o texto sin procesar), `value?`, `series?`; para comparar con exactitud, prefiere `bar` + `top` |

Los nombres de seaborn funcionan (`histplot`, `kdeplot`, `boxplot`, `violinplot`, `lmplot`, `stripplot`, `swarmplot`, `pointplot`), y `hue` es un alias de `series`. Omite `type` para que se infiera de los datos.

## Opciones más útiles

- `highlight: "Ñuble"`: destaca una categoría o serie y atenúa el resto. `exclude: ["Maule"]` quita entradas y recalcula el gráfico; los colores no cambian.
- `legend: "top" | "bottom" | "left" | "right" | false`: dónde va la leyenda (arriba por defecto).
- `colorScale: "viridis"`: cualquier mapa de colores de matplotlib para mapas de calor, mapas y treemaps por variación (`"RdBu"` diverge en torno a 0; `_r` lo invierte; también sirve una lista de colores). `palette: "tab10"` para categorías.
- `dashed` para lo que no es una cifra firme (estimaciones, proyecciones, cifras provisionales): un nombre, una lista o un campo de los datos (`dashed: "provisional"`). Las formas mantienen su color, con relleno achurado y contorno discontinuo. En un eje de tiempo, `dashedFrom: 2025` dibuja con trazo discontinuo las líneas, áreas y columnas desde ese año. **Define siempre `dashedLabel`** ("Proyección", "Preliminar") para que los lectores sepan qué significa el achurado.
- `facet: "region"` (+ `columns`): un panel por valor, con una escala compartida.
- `time: "year"`: un período a la vez (el más reciente) con la variación % respecto del anterior. Los controles de tiempo están **desactivados por defecto**: agrega `slider: true` solo cuando la persona pida recorrer los períodos (botones para ≤ 8 períodos y un deslizador mínimo en los demás casos; `"buttons"` / `"slider"` fuerzan uno de los dos, `play: false` oculta el botón de reproducir). Los treemaps se pueden colorear por variación con `colorBy: "change"`.
- `refLines: [{ y: 600, label: "Target" }]` y `annotations: [{ x: "2024-01", label: "New branch" }]`.
- `format: "percent" | "currency" | "compact" | "integer"` o `{ prefix, suffix, decimals }`.
- `xScale` / `yScale: "log"`.
- `table`: dale un título que enuncie el hallazgo, como a cualquier gráfico. Con más de 15 filas se pagina de a diez (`pageSize`), en teléfonos cada fila se muestra como una tarjeta y el navegador agrega orden, búsqueda y paginación. Usa `good: "down"` en los costos para que ▲ se vuelva rojo, `progress` con `target: "budget"` para el gasto frente al presupuesto y `total: true` para una fila de totales. Usa entre 4 y 7 columnas.
- `theme: "noche"` o un objeto JSON (`{ extends, categorical, type, marks, font }`); `palette: [...]` para tus propios colores.
- `font: "Poppins"` y `textScale: 1.5` (modo presentación); `configure({ font, textScale })` los define para todos los gráficos.
- `network` + `focus: "node id"`: centra un nodo y destaca sus vecinos.
- Tu propio mapa: `geo: <GeoJSON or TopoJSON>`; la propiedad que coincide se busca sola (`featureKey` para forzarla). Agrega `markers: [{ lon, lat, label }]`, `layers: [{ geo, label }]` para ríos o rutas, y `fitTo: ["Biobío"]` o una caja `[lonMin, latMin, lonMax, latMax]` para hacer zoom.
- `gantt`: las fechas `end` por día son inclusivas; una fila sin `end` es un hito. Define siempre `today` en un plan en curso. `collapsed: ["Phase 2"]` (o `true`) pliega las fases en una barra resumen; en el navegador, un clic en una fase la abre o la cierra.
- `network` + `layout: "force" | "circular" | "radial" | "concentric" | "clusters" | "tree" | "grid"` elige la disposición; `curveness: 0` endereza las aristas.
- `pointmap` dibuja sobre teselas de OpenStreetMap por defecto (`tiles: "esri-gray"`, `"mapbox-light"` + `tilesKey`, o tus propias `{ url, attribution }`). Las teselas solo se cargan cuando el SVG va incrustado en la página o en `toHTML`, no dentro de `<img>`.
- Tu propio estilo para todos los gráficos: `registerTheme("acme", { background, text, grid: { color, dash }, categorical: "tab10", font })` y luego `configure({ theme: "acme" })`.
- `geo: "usa"`: los estados coinciden por código postal ("TX"), nombre en inglés o en español, o código FIPS ("48"). Alaska y Hawái aparecen en recuadros; Puerto Rico aparece solo cuando tus datos lo incluyen. En el navegador, los mapas hacen zoom con un clic, con Ctrl/⌘ + rueda o pellizcando.

## Errores que la biblioteca ya resuelve

- Más de 8 series → de la 9.ª en adelante se pintan en gris; `lint` sugiere `highlight` o `facet`.
- Etiquetas de líneas que chocan → se separan con líneas guía.
- Dona con más de 6 partes → el resto se agrupa en "Otros".
- Etiquetas de categoría largas → el gráfico pasa a horizontal.
- Paleta propia difícil de distinguir → `lint` nombra el par problemático.
- Números como texto ("1.234,5", "12%", "$ 3.000") → se interpretan automáticamente.
- Decenas de miles de puntos → se dibujan como trazados agrupados y sigue siendo rápido.

## Tableros

Cuando alguien pida un dashboard, llama a `safeDashboard({ title, subtitle, source, data, kpis, charts, filters })` (herramienta: `toolDefinition({ kind: 'dashboard' })`). La disposición, los anchos, los colores compartidos y los filtros se deciden por ti:

- `title` es la **pregunta** que responde el tablero; cada gráfico igual lleva su hallazgo como título.
- Como máximo **5 KPI**, calculados a partir de `data` cuando sea posible: `{ label, field, agg: "sum", compare: { field: "year", current: 2025, previous: 2024 }, trendBy: "month" }`.
- **De 4 a 6 gráficos**. La primera serie de tiempo (o la que tenga `primary: true`) va a todo el ancho; el resto llena filas equilibradas.
- `filters: ["region", "channel"]` se convierten en botones que filtran todos los gráficos y KPI.
- No más de una dona; una sola `source` para la página.

## Salidas

- `plot(spec)` → cadena SVG. Insértala en HTML, Markdown, un archivo `.svg` o un PDF.
- `toHTML([spec1, spec2])` → página autocontenida con tooltips, deslizadores y drill-down.
- `describe(spec)` → texto alternativo del gráfico.
- `schema` / `toolDefinition()` → JSON Schema y definición de herramienta (Anthropic u OpenAI).
- CLI: `npx plotagents spec.json -o chart.svg`.
