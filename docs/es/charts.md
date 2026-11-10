# Referencia de gráficos

Cada gráfico recibe una especificación con `data` (filas) y los nombres de campo de cada rol. Las opciones de abajo son propias de cada tipo; las [opciones comunes](#common-options) valen para todos. Cada opción también está descrita en [`schema.json`](../schema.json).

## Opciones comunes

| Opción | Significado |
|---|---|
| `type` | Tipo de gráfico o alias. Omítelo (o usa `"auto"`) para inferirlo de los datos. |
| `data` | Arreglo de objetos fila. También acepta `{ A: 1, B: 2 }` y arreglos de números. |
| `title` | El hallazgo, como una oración. Se divide en líneas; nunca se trunca. |
| `subtitle` | Cómo leer el gráfico: medida, unidad, período. |
| `source` | Fuente de los datos, en letra pequeña abajo a la derecha. |
| `series` / `hue` | Campo que divide los datos en grupos de color. |
| `highlight` | Un nombre o una lista: destaca esos y atenúa el resto. |
| `colors` | `{ "name": "#hex" }` para fijar el color de una entidad. |
| `format`, `xFormat`, `yFormat` | `"number" \| "compact" \| "percent" \| "currency" \| "integer"` o `{ prefix, suffix, decimals, currency }`. |
| `locale` | `"es"` (por defecto: `1.234,5`), `"en"` (`1,234.5`), `"pt"`, `"fr"` (`1 234,5`), `"de"` o `"auto"`: se reconoce a partir del título, el subtítulo, los nombres de columna y las categorías. Las tablas usan `"auto"` cuando omites `locale`. |
| `xLabel`, `yLabel` | Títulos de los ejes (horizontales, nunca rotados). |
| `xScale`, `yScale` | `"log"` donde tenga sentido. |
| `xDomain`, `yDomain` | `[min, max]` fijo. |
| `refLines` | `[{ y: 600, label: "Target" }]` (o `x`, o `value` para barras). |
| `facet` (`col`), `columns`, `sharey`, `sharex` | Múltiplos pequeños, un panel por valor. |
| `time`, `timeValue` | Un período a la vez: el más reciente por defecto, o `timeValue`. El período se agrega al subtítulo. |
| `slider`, `play` | Controles de tiempo en el navegador, **desactivados por defecto**. `slider: true` agrega botones de período cuando hay pocos períodos (≤ 8) y un deslizador mínimo cuando hay muchos; los gráficos de líneas y de áreas reciben un rango con dos tiradores. `"buttons"` o `"slider"` fuerzan uno; `play: false` oculta el botón de reproducir. |
| `compare` | Con `time`: compara contra `"previous"` (por defecto), `"first"`, un período dado o `false`. |
| `theme`, `palette`, `ramp` | Consulta [temas](themes.md). |
| `colorScale` (`cmap`) | Cualquier mapa de colores de matplotlib (`"viridis"`, `"RdBu_r"`…) o tu propia lista de colores. Consulta [escalas de color](colorscales.md). |
| `font`, `textScale` | Tipografía (nombre de Google Fonts, pila CSS o `{ family, import }`) y un multiplicador del tamaño del texto (alias `fontScale`, `labelScale`). Fíjalos para todos los gráficos con `configure()`. |
| `width`, `height`, `padding` | Píxeles. La altura es automática en barras horizontales, mapas de calor, tarjetas KPI y en treemaps, sunbursts y radares angostos. |
| `legend` | Posición: `"top"` (por defecto), `"bottom"`, `"left"`, `"right"` o `false` para ocultarla. Las leyendas laterales pasan abajo por debajo de 520 px. Fijar una posición también fuerza una leyenda donde el gráfico, de otro modo, rotularía las líneas directamente. |
| `exclude` | Un nombre o una lista: quita esas entradas de la leyenda (series, grupos del primer nivel) y recalcula ejes, proporciones y diseño. Los colores se mantienen y las entradas excluidas siguen en la leyenda, atenuadas y tachadas. |

### En el navegador

- **Tooltips**: aparecen junto a la marca bajo el puntero, nunca sobre el título o el subtítulo, y no salen del gráfico. Su encabezado toma el color de la marca, con texto blanco u oscuro según el contraste.
- **Leyenda**: al pasar el puntero sobre una clave se destacan sus marcas; un clic fija el destaque. **Shift + clic** excluye esa entrada (haz clic de nuevo para recuperarla). En treemaps y sunbursts, un clic simple amplía todo el gráfico a esa categoría; haz clic otra vez, usa la ruta de navegación o presiona Esc para volver.

## Comparar

### `bar` · `column` · `barplot` · `count` (`countplot`)

`x` categoría, `y` valor. Columnas para pocas categorías cortas, barras horizontales cuando las etiquetas son largas o hay muchas; valores en la punta de las barras y sin eje cuando todas las barras tienen etiqueta.

| Opción | Significado |
|---|---|
| `stack` | `true` apila las series; `"percent"` apila al 100%. |
| `horizontal` | Fuerza la orientación. |
| `sort` | `"desc"` (por defecto para categorías), `"asc"`, `"none"`, `"alpha"`. Los años y las fechas mantienen su orden. |
| `top` | Conserva las N más grandes y agrupa el resto en "Otros" (automático sobre 40 categorías). |
| `ci`, `errorbar`, `estimator` | `barplot`: media ± IC del 95% (`"ci"`), barras de error `"sd"` o `"se"`. |
| `aggregate` | `"sum"` (por defecto), `"mean"`, `"max"`, `"min"`, `"count"`, `"first"`, `"last"`. `countplot` cuenta filas. |
| `labels` | `true`, `false` o `"auto"`. |
| `barWidth` | Grosor máximo de la barra en px. |

## Tiempo

### `line` · `area`

`x` fecha (`"2024-03"`, `"2024-03-15"`, `Date`), año o número; `y` valor o lista de campos (tabla ancha → series).

| Opción | Significado |
|---|---|
| `labels` | Etiquetas al final (activadas por defecto para cada serie que cabe; las etiquetas que chocan reciben líneas guía). |
| `annotations` | `[{ x: "2024-01", label: "New branch" }]`. |
| `index` | Lleva cada serie a base 100 en su primer valor. |
| `ci`, `errorbar`, `estimator` | `lineplot` de seaborn: media y banda de confianza cuando hay varias filas por x. |
| `curve` | `"linear"` (por defecto), `"smooth"` (monótona, nunca inventa picos), `"step"`. |
| `zero` | Fuerza el eje y a incluir el cero (activado por defecto en áreas y cuando cuesta poco). |
| `points` | Marcadores en cada punto (automático en series cortas). |
| `stack` | Áreas: `true` (por defecto con series), `"percent"` o `false` para superponerlas. |
| `fill` | Línea única: `false` quita el degradado suave. |
| `xRange` | Rango visible `[from, to]`; es lo que fija el deslizador de rango (`slider: true`). |

## Proyectos

### `gantt` (`timeline`, `roadmap`, `schedule`, `cronograma`)

Una fila por tarea: `task`, `start` y `end` (o `duration`). Fechas como `"2026-03-02"` o `"2026-03"`, o números simples para semanas o sprints. Las fechas con día son **inclusivas**: una tarea del 3 al 5 de marzo dura 3 días. Una fila sin `end`, o con `end` igual a `start`, es un hito y se dibuja como un rombo con su fecha.

El eje de tiempo va arriba, como en un calendario. Con `group`, cada fase abre con su nombre y una barra resumen delgada en su color, así que no hace falta leyenda. La parte rellena de cada barra es el avance; el resto queda en un tono claro del mismo color. Las dependencias son flechas delgadas en ángulo recto detrás de las barras.

```js
plot({
  type: 'gantt',
  title: 'The project goes live on June 15; the ERP integration is the critical path',
  data: [
    { phase: 'Design', task: 'Data model', start: '2026-02-09', end: '2026-03-06', progress: 80 },
    { phase: 'Build', task: 'ERP integration', start: '2026-03-16', end: '2026-04-30', progress: 10, after: 'Data model' },
    { phase: 'Launch', task: 'Go-live', start: '2026-06-15' },
  ],
  task: 'task', start: 'start', end: 'end', group: 'phase', progress: 'progress', dependsOn: 'after',
  today: '2026-03-12', locale: 'en',
});
```

| Opción | Significado |
|---|---|
| `task`, `start`, `end` | Nombres de campo (se detectan cuando se llaman `task`/`tarea`, `start`/`inicio`, `end`/`fin`). |
| `duration` | Duración en vez de `end`: días en un eje de fechas, unidades en uno numérico. |
| `group` (`series`, `hue`) | Fase o equipo: una sección de color por valor. `groupHeaders: false` usa una leyenda de colores en su lugar. |
| `progress` | 0–1 o 0–100. Se muestra como la parte rellena, con el porcentaje dentro de la barra cuando cabe. |
| `dependsOn` | Campo con el nombre de la tarea predecesora, o varias: `"A, B"`. |
| `milestone` | Campo booleano que fuerza hitos. |
| `today` | Una fecha (o `true`) para la línea de "hoy", rotulada en el eje. `refLines: [{ x, label }]` agrega más. |
| `dashed`, `dashedLabel` | Achura las tareas tentativas: un campo (`dashed: "tentative"`), nombres o fases. |
| `highlight` | Destaca una tarea o una fase completa. |
| `sort` | `"start"` ordena las tareas por fecha (por defecto: el orden de los datos, agrupado por fase). |
| `rowHeight`, `xLabel`, `unit` | Alto de fila en px; título del eje y unidad para ejes numéricos. |
| `collapsed`, `collapsible` | Fases dibujadas como una sola fila resumen (avance ponderado por duración, rombos de hitos): una lista de nombres o `true`. En el navegador, un clic en una fase la pliega o despliega (Alt + clic actúa sobre todas); el eje de tiempo y la columna de nombres no se mueven. `collapsible: false` oculta los chevrones. |
| `critical`, `criticalColor` | Remarca la ruta crítica: tareas sin holgura a lo largo de `dependsOn` (días hábiles en fechas con día), con flechas de acento. |
| `weekends` | Franjas de fin de semana en planes con fechas de día de hasta 120 días; `false` las desactiva. |

`lint` advierte sobre tareas que terminan antes de empezar y sugiere una línea `today`. El texto alternativo nombra el período total, la tarea más larga, los hitos y el avance general ponderado por duración.

## Relaciones

### `scatter` · `bubble`

`x`, `y` numéricos; `size` para burbujas (proporcional al área); campo `label` con `labels` (número de puntos o lista de nombres) para etiquetas selectivas; `trend: true` agrega una recta de mínimos cuadrados con R².

### `regplot` (`lmplot`) · `residplot` · `jointplot`

| Opción | Significado |
|---|---|
| `ci` | Nivel de la banda de confianza (95 por defecto, `false` para ocultarla). |
| `order` | Grado del polinomio. |
| `lowess` (+ `frac`) | Regresión local en vez de una recta. |
| `logx` | Ajusta `y ~ log(x)` y usa un eje x logarítmico. |
| `scatter` | `false` oculta los puntos. |
| `truncate` | Dibuja el ajuste solo dentro del rango de los datos (por defecto `true`). |
| `annotate` | Muestra R² y n. |
| `label`, `labels` | Nombra puntos seleccionados. |
| `kind` | `jointplot`: `"scatter"` o `"reg"`. |
| `marginal` | `jointplot`: `"hist"` o `"kde"`. |

### `corr` (`correlation`, `corrplot`) · `clustermap`

Matriz de correlación de los campos numéricos, que la biblioteca calcula a partir de las filas (casos completos por pares, como `df.corr()`). Cada par aparece una vez, bajo la diagonal, en una escala divergente fija de −1 a 1, así que el mismo color significa la misma intensidad en todos los gráficos. Las etiquetas largas se giran 45°. El tooltip muestra r, n y el valor p.

```js
plot({ type: 'corr', data, vars: ['income', 'schooling', 'poverty', 'density'], alpha: 0.05,
  title: 'Where schooling is higher, income is higher (r = 0.85) and poverty lower (r = −0.81)' });
```

| Opción | Significado |
|---|---|
| `vars` | Campos a relacionar, en orden. Por defecto: todos los campos numéricos. `y: [...]` también funciona. |
| `method` | `"pearson"` (por defecto) o `"spearman"` (rangos: relaciones monótonas, robusta ante valores atípicos). |
| `triangle` | `"lower"` (por defecto) o `"full"`. |
| `cluster` | Reordena por agrupamiento jerárquico (enlace promedio sobre 1 − r) y dibuja el dendrograma arriba. `type: "clustermap"` lo activa y muestra la matriz completa; `dendrogram: false` mantiene el orden sin el árbol. |
| `alpha` | Pone en gris los pares con p ≥ alpha (z de Fisher) y agrega una clave a la leyenda. |
| `order` | Orden de las variables (lista). |
| `highlight` | Una variable: su fila y su columna se mantienen y el resto se atenúa. |
| `labelsFor` | Nombres para mostrar, p. ej. `{ areas_verdes: "Green space" }`. |
| `x`, `y`, `value` | Dibuja una matriz que ya calculaste, en formato largo (una fila por par). |

### `pairplot` (`pairs`, `splom`, `scattermatrix`)

Matriz de diagramas de dispersión: cada par como dispersión bajo la diagonal, la distribución de cada variable en la diagonal (histograma, o densidad con `hue`) y la r de Pearson sobre ella, teñida según la intensidad y dividida por grupo de `hue` cuando hay espacio. Los ejes se comparten por columna y por fila; las marcas de los ejes solo van en los bordes exteriores.

| Opción | Significado |
|---|---|
| `vars` | Campos a graficar (3–6 se leen mejor). Por defecto: los primeros 6 campos numéricos. |
| `hue` | Color por grupo, con leyenda. |
| `diag` | `"hist"` o `"kde"`. |
| `upper` | `"corr"` (por defecto), `"scatter"` o `false`. `corner: true` conserva solo el triángulo inferior. |
| `kind` | `"reg"` agrega una recta de mínimos cuadrados a cada panel de dispersión. |
| `radius`, `bins`, `panelSize` | Radio de los puntos, intervalos del histograma, tamaño máximo del panel. |

### `radar` (`spider`)

Datos largos (`axis`, `value`, `series`) o anchos (`axes: [fields]`, una fila por serie con `label`). `normalize` escala cada eje a su propio máximo (los tooltips conservan los valores originales); `grid: "polygon" | "circle"`; `domain`. Funciona mejor con ≤ 4 series.

## Distribuciones

### `hist` (`histplot`) · `kde` (`kdeplot`) · `ecdf`

| Opción | Significado |
|---|---|
| `bins`, `binWidth` | Número o ancho de los intervalos (por defecto: Freedman–Diaconis, redondeado a bordes limpios). |
| `stat` | `"count"`, `"percent"`, `"density"`, `"probability"`. |
| `kde` | Superpone una curva de densidad sobre el histograma. |
| `multiple` | Con `hue`: `"layer"`, `"stack"`, `"dodge"`, `"fill"`. |
| `element` | `"bars"` o `"step"`. |
| `cumulative` | Distribución acumulada. |
| `fill`, `bwAdjust`, `cut`, `clip`, `rug` | Opciones de densidad. |
| `complementary` | `ecdf`: grafica 1 − F(x). |

### `box` · `violin` · `strip` · `swarm` (`beeswarm`) · `point` (`pointplot`)

`x` categoría e `y` medida (intercámbialos, o usa `horizontal`, para la versión horizontal). Las etiquetas largas o muchas categorías cambian a horizontal de forma automática.

| Opción | Significado |
|---|---|
| `points` | Caja: superpone las observaciones. |
| `showMeans` | Marca la media. |
| `inner` | Violín: `"box"` (por defecto), `"quartiles"`, `"points"`, `"none"`. |
| `split` | Violín con dos niveles de `hue`: una mitad cada uno. |
| `scale` | Ancho del violín: `"width"`, `"area"`, `"count"`. |
| `jitter`, `dodge`, `radius` | Disposición de strip y swarm. |
| `estimator`, `errorbar` | Gráfico de puntos: `"mean"`/`"median"`/`"sum"` y `"ci"`/`"sd"`/`"se"`/`"pi"`. |
| `order`, `hueOrder` | Orden de las categorías y de los grupos. |

## Partes de un todo

### `treemap` · `sunburst`

`path: [level1, level2, …]` de cualquier profundidad (o `group` + `label`), `value`. Las filas con la misma ruta se suman.

| Opción | Significado |
|---|---|
| `depth` | Muestra solo los primeros N niveles. |
| `focus` | Ruta a la que entrar, p. ej. `["Mining"]`. En el navegador lo hace un clic en un grupo o en su clave de la leyenda (la categoría llena todo el gráfico), y la ruta de navegación o Esc te devuelven. |
| `exclude` | Grupos del nivel 1 que se dejan fuera; el resto llena el plano y las proporciones se recalculan. En el navegador lo hace Shift + clic en una clave de la leyenda. |
| `showValues` | Agrega los valores a las etiquetas. |
| `colorBy` | `"change"` colorea los rectángulos según el % de cambio respecto del período de comparación (crecimiento en tonos fríos, caída en cálidos); `"label"` colorea por elemento un treemap de un solo nivel. |
| `shade` | Pasos sutiles de luminosidad dentro de cada categoría. Desactivado por defecto: un color sólido por categoría. |
| `compareData` | Filas de un período anterior para calcular cambios sin `time`. |
| `hole`, `centerValue`, `centerLabel` | Centro del sunburst. |

Las áreas son exactas: no hay franjas de encabezado que le quiten espacio a un grupo. Las categorías se distinguen por un color sólido, una separación de 4 px entre grupos del nivel 1 (2 px y 1 px en niveles más profundos) y la leyenda, que muestra la proporción de cada grupo. Con `time`, cada rectángulo también muestra su cambio respecto del período anterior (▲ 12%). Los colores pertenecen al grupo del nivel 1 y se calculan sobre el árbol completo y todos los períodos, así que nunca cambian al entrar en un grupo ni al mover el deslizador.

### `pyramid` (`populationpyramid`)

Grupos de edad (`age` o `y`), dos lados (`sex`, `series` o `hue`) y un valor. Barras enfrentadas con las edades en la columna central; `percent: true` para proporciones de la población; `compareData`, o `time` + `compare`, dibuja un año anterior como un contorno escalonado.

### `donut` · `pie`

`label`, `value`. Más de `maxSlices` (6) se agrupan en "Otros".

| Opción | Significado |
|---|---|
| `labels` | `"auto"`, `"inside"`, `"outside"` (líneas guía), `"legend"`, `false`. |
| `half` | Semicírculo. |
| `thickness` | Grosor del anillo (el pie es `1`). |
| `sort` | `"desc"` o `"none"`. |
| `centerValue`, `centerLabel` | Centro de la dona. |

## Mapas

### `choropleth` (`map`) · `symbolmap` (`bubblemap`)

Las regiones de Chile (`geo: "chile"`, por defecto), los estados de EE. UU. (`geo: "usa"`) y los países del mundo (`geo: "world"`) vienen con la biblioteca, y **cualquier geometría propia** también funciona (ver abajo). `key` es el campo de los datos que se empareja y `value` la medida; un `value` de texto (un partido, un idioma, una zona) colorea por categoría con una leyenda de muestras de color. El emparejamiento es tolerante: nombres, códigos y alias, sin importar tildes, mayúsculas ni "Región de" ("RM", "Biobio", "XIII", "Aisén", "ARG", "EE.UU.", "TX", "Nueva York", "48").

**Estados Unidos.** 50 estados y DC en una proyección cónica equivalente de Albers (`albersUsa`, la misma composición que `d3.geoAlbersUsa`): Alaska (a 0,35×) y Hawái van en recuadros abajo a la izquierda con un marco fino punteado; Puerto Rico recibe su propio recuadro solo cuando los datos lo incluyen (`territories: true` lo fuerza). Cada estado muestra su código postal, más el valor cuando cabe; los estados pequeños del noreste (VT, NH, MA, RI, CT, NJ, DE, MD, DC) se rotulan en una columna a la derecha con líneas guía. `values: false` deja solo los códigos; `labels: false` los quita.

| Opción | Significado |
|---|---|
| `geo` | `"chile"`, `"usa"`, `"world"`, un nombre registrado con `registerGeo()`, un objeto GeoJSON o TopoJSON, o (en el navegador) una URL. |
| `featureKey`, `nameKey` | Propiedad de la geometría que se empareja, y la que tiene el nombre para mostrar (ambas se detectan si las omites). |
| `fitTo` | Amplía a regiones, a una caja `[lonMin, latMin, lonMax, latMax]` o a `"markers"`. |
| `markers`, `layers` | Puntos por lon/lat encima; líneas, polígonos o puntos GeoJSON adicionales sobre o bajo el mapa. |
| `scale`, `classes` | `"quantile"` (por defecto), `"equal"`, `"continuous"` o una lista de cortes; 5 clases por defecto. |
| `midpoint` / `diverging` | Clases divergentes en torno a un valor (p. ej. 0 para cambios). |
| `missing` | `"plain"` quita el achurado y la entrada "Sin datos" de la leyenda. |
| `labels`, `bars` | Chile recibe una columna de norte a sur con nombre, barra y valor; `bars: false` oculta las barras. Los mapas del mundo rotulan los N primeros. |
| `projection` | `"mercator"`, `"equalEarth"`, `"albersUsa"`, `"equirectangular"`, `"conic"`, `"identity"`, `"planar"` o `{ type, parallels, rotate }` (se elige de forma automática). |
| `borderColor`, `borderWidth` | Bordes de las regiones. |
| `dashed`, `dashedLabel` | Achura algunas regiones (cifras preliminares, zonas en disputa): nombres, códigos o un campo de los datos. Conservan el color de su clase. |
| `maxRadius` | `symbolmap`: radio del círculo más grande. |

#### Tu propia geometría: GeoJSON y TopoJSON

`geo` acepta lo que tengas: un `FeatureCollection` GeoJSON, un solo `Feature`, un arreglo de features o una geometría suelta, o un `Topology` TopoJSON (`geoObject` elige el objeto; por defecto, el primero). Los polígonos se rellenan, las líneas se trazan y los puntos se vuelven círculos coloreados por valor. En el navegador, `render()` también acepta una URL y la descarga una sola vez: `geo: "/maps/comunas.topojson"`. En Node, lee el archivo y pasa el objeto.

```js
import { readFileSync } from 'node:fs';
const comunas = JSON.parse(readFileSync('comunas-biobio.geojson', 'utf8'));
plot({
  type: 'choropleth',
  geo: comunas,                       // properties: { CUT_COM: "08101", NOM_COM: "Concepción", … }
  data: [{ comuna: 'Concepción', poverty: 7.1 }, { comuna: 'Coronel', poverty: 12.4 }],
  key: 'comuna', value: 'poverty',   // NOM_COM is found automatically
  markers: { data: hospitals, lon: 'lon', lat: 'lat', label: 'name', legend: 'Hospital' },
  layers: [{ geo: rivers, label: 'Biobío river', stroke: '#5BA3E0', width: 2 }],
  fitTo: ['Concepción', 'Talcahuano', 'Hualpén'],
});
```

- **Emparejamiento sin configuración.** Las filas se emparejan con las claves habituales (código, id, ISO-3, nombre, alias); si algunas filas no calzan, plotagents encuentra la propiedad de la geometría cuyos valores sí calzan (`NOM_COM`, `CUT_REG`, `GEOID`, `ADMIN`…). `featureKey` fuerza una. Los nombres para mostrar salen de `nameKey`, o de la primera de `name`, `NOMBRE`, `NAME_1`, `ADMIN` y similares.
- **Proyecciones.** Se eligen según la geometría: Mercator para un país o una región, Equal Earth para el mundo y un plano cartesiano simple cuando las coordenadas no son longitudes y latitudes (metros UTM, por ejemplo). Fija `projection` en `"equirectangular"`, `"conic"` (o `{ type: "conic", parallels: [-30, -45], rotate: 72 }`), `"identity"` (coordenadas en píxeles, y hacia abajo, para mapas dibujados a mano o de teselas) o `"planar"` (y hacia arriba).
- **Encuadre.** `fitTo` amplía a algunas regiones, a una caja `[lonMin, latMin, lonMax, latMax]` o a `"markers"`; el resto del mapa queda recortado como contexto. `tall: false` desactiva la columna lateral para formas alargadas.
- **Marcadores.** `markers: [{ lon, lat, label, value }]` o `{ data, lon, lat, label, size, color, legend, maxRadius }`: puntos encima, proporcionales al área cuando hay un `size`, con etiquetas ubicadas donde no chocan.
- **Capas.** `layers: [{ geo, label, stroke, width, fill, dash, opacity, below }]` superpone ríos, caminos, rutas, fallas o límites de distritos (o los dibuja bajo las regiones con `below: true`). Un `label` agrega una clave a la leyenda.
- **Estilo.** `borderColor`, `borderWidth`, `pointRadius`, `lineWidth`, `ramp` (una rampa secuencial con nombre o propia), `palette` y `colors` (categorías).
- **Regístrala una vez y úsala por nombre.** `registerGeo('biobio', comunas, ['comunas-biobio'])` y luego `geo: 'biobio'` en cada especificación, lo que mantiene cortas las llamadas a herramientas de un agente.

En el navegador (`render()` o `toHTML()`), los mapas son interactivos: al pasar el puntero se remarca la forma; un clic en una región la amplía hasta encuadrarla (vuelve con otro clic, doble clic, Esc o el botón de reinicio); Ctrl/⌘ + rueda amplía en torno al puntero (la rueda sola sigue desplazando la página, como recomienda `chartjs-plugin-zoom` con su `modifierKey`); el gesto de pellizcar amplía en pantallas táctiles; arrastrar desplaza el mapa ampliado; los botones +/− funcionan desde el teclado. Cada clase de color de la leyenda es una clave: pasa el puntero para iluminar sus regiones y haz clic para fijarlas. Con `time`, el color de cada región transita hacia el del período siguiente en vez de saltar, y la ampliación se mantiene mientras se reproduce el deslizador.

`lint` advierte sobre filas que no calzan con ninguna región o país. Fuentes: Natural Earth 1:110m (dominio público) para el mundo; Biblioteca del Congreso Nacional para las regiones de Chile (atribución en `src/geo/data/chile-regiones.js`); límites cartográficos 1:10m de la Oficina del Censo de EE. UU. (dominio público) vía us-atlas 3.0.1 para los estados de EE. UU. En el navegador, `dist/plotagents-geo.js` agrega las geometrías; `toHTML()` lo incluye solo cuando una página tiene un mapa.

### `pointmap` (`dotmap`, `tilemap`)

Puntos por longitud/latitud sobre un mapa base real en Web Mercator. Los campos `lon`/`lat` se encuentran por nombre (lon, lng, longitude, longitud / lat, latitude, latitud). `size` → área del círculo (clave en la esquina, con el más grande rotulado); `hue` → colores por categoría con leyenda; `value` numérico → rampa secuencial (`midpoint` para divergente, `colorScale` para cualquier mapa de matplotlib). La ampliación y el centro se ajustan a los puntos (`zoom`, `center: [lon, lat]` para fijarlos).

```js
plot({ type: 'pointmap', data: cities, lon: 'lon', lat: 'lat', size: 'population', label: 'city',
  title: 'Santiago concentrates 40% of the population', source: 'INE' });
```

| Opción | Significado |
|---|---|
| `tiles` | `"osm"` (por defecto, OpenStreetMap), `"esri-gray"`, `"esri-dark"`, `"carto-light"` / `"carto-dark"` (clave gratuita: carto.com/basemaps/apikey), `"mapbox-light"` / `"mapbox-dark"` (token público `pk.` en `tilesKey`; los tokens `sk.` se rechazan), `{ url, attribution, subdomains, maxZoom, retina }` o `false` (solo el contorno vectorial del mundo). |
| `tilesKey` | Clave o token para CARTO, Mapbox o Esri. |
| `tileStyle` | `"muted"` (por defecto) desatura las teselas y las tiñe con el tema (un mapa nocturno azul marino en `noche`); `"original"` las deja tal cual. |
| `tileOpacity`, `zoom`, `center` | Opacidad de las teselas, nivel de ampliación fijo y centro `[lon, lat]`. |
| `labels`, `labelValues` | Cuántos puntos nombrar (los 8 más grandes por defecto), o una lista; `labelValues: false` oculta los valores. |

La atribución siempre se dibuja. Las teselas son imágenes externas: se ven en SVG en línea, `render()` y `toHTML()`, **no** cuando el SVG se usa como `<img>`, se abre desde un conversor a PDF o sin conexión; en esos casos el contorno vectorial del mundo que está debajo sigue dando contexto. `await embedTiles(svg)` las incrusta como URI data: (no para OSM, cuya política de teselas prohíbe las descargas masivas; usa `esri-gray` o tu propio servidor). Para mucho tráfico, usa un proveedor con clave o tus propias teselas: los servidores de OSM son donados.

## Formas discontinuas: estimaciones, proyecciones, cifras provisionales

Algunas cifras todavía no son firmes. En vez de un color nuevo (que se lee como una categoría nueva), plotagents mantiene el color de la forma y cambia su textura: un relleno achurado (franjas del color sobre un tono claro del mismo) y un contorno discontinuo con contraste 3:1. Las líneas reciben un trazo discontinuo con puntos huecos. Funciona en `bar`, `line`, `area`, `donut`/`pie`, `choropleth` y `symbolmap`.

| Opción | Significado |
|---|---|
| `dashed` | Un nombre de categoría, serie o región, o una lista (`["Texas", "Ohio"]`); un campo de los datos cuyas filas verdaderas van discontinuas (`"provisional"`, acepta `true`, `1`, `"sí"`, `"yes"`, `"x"`); `{ field, equals }`; o `true` para todo. |
| `dashedFrom` | En un eje de tiempo (`line`, `area`, `bar`): el primer x proyectado. La línea pasa a discontinua desde el último punto firme, los puntos proyectados son huecos, las áreas apiladas se achuran con el color de cada serie y una banda suave con `dashedLabel` marca el tramo. |
| `dashedLabel` | Qué significa: "Proyección", "Preliminar", "Estimación". Es la entrada de la leyenda (pasa el puntero para iluminar solo las formas discontinuas), la etiqueta de la banda y una línea en el tooltip. Por defecto es "Estimado"/"Estimate"; `lint` sugiere fijarlo. |

Esto sigue el consejo de Chart.js de usar patrones (como hace `patternomaly`) y `segment.borderDash` para los tramos proyectados, de modo que la distinción nunca depende solo del color.

## Redes y flujos

### `network` (`graph`)

Aristas en `data` (`from`, `to`, `value` opcional), `nodes` opcionales con `id`, `group` y `size`. Área del nodo ∝ peso (grado ponderado por defecto), color por grupo; las aristas se curvan con el color de su nodo de origen (`curveness`, por defecto 0.3; `0` = rectas) y miden 1 px de ancho sin un campo de valor. Los nodos más grandes llevan su nombre (tinta con halo, sin chocar entre sí ni con un nodo); todos los nombres están en el tooltip. Al pasar el puntero sobre un nodo se iluminan sus vecinos y sus aristas.

`layout` elige la disposición (todas deterministas, todas ajustadas al área):

| `layout` | Disposición |
|---|---|
| `force` (por defecto) | Dirigida por fuerzas (Barnes–Hut sobre 150 nodos). |
| `circular` (`circle`) | En torno a un círculo por grupo, con un espacio entre grupos y los nombres rotados hacia afuera. |
| `radial` | Un árbol desde `focus` (o el nodo más conectado); cada anillo es un paso más lejos. Los enlaces fuera del árbol son tenues. |
| `concentric` | Anillos por peso, el más grande al centro, por grupo dentro de cada anillo. |
| `clusters` | Un grupo en forma de girasol por grupo, con espacio ∝ √tamaño. |
| `tree` | El árbol radial extendido en plano (de izquierda → derecha en áreas anchas), con conectores en forma de S. |
| `grid` | Una cuadrícula ordenada por grupo y peso, con todos los nodos nombrados. |

`labels` (número, lista o `true`), `highlight` (un nodo y sus vecinos), `focus` (el id de un nodo: va al centro, o a la raíz en `radial`/`tree`, y se destaca con sus vecinos, todos rotulados; en el navegador lo hace un clic con una transición suave, y un segundo clic o Esc vuelve), `iterations`, `maxRadius`, `curveness`.

### `chord`

Filas `from`, `to`, `value`, o `matrix` + `names`. `directed` (por defecto false), `sort`, `ribbonColor: "smaller" | "larger" | "source"`, `labelOrientation: "radial"`.

### `flowchart` (`flow`, `diagram`)

`nodes` con `id`, `label`, `type` (`start`, `end`, `process`, `decision`, `data`, `note`), `lane` opcional (carriles) y `group`; `edges` (o `data`) con `from`, `to` y un `label` opcional ("Sí"/"No"). Diseño por capas con dirección automática (`direction: "TB" | "LR"`), conectores ortogonales con flechas y bucles que rodean por el costado. `nodeWidth`, `swimlanes: false`.

## Cuadrículas, flujos y números

### `heatmap`

Categorías `x`, `y` y `value`. Rampa secuencial por defecto; `midpoint` (o `diverging: true`) para una rampa divergente. Los valores se escriben en las celdas cuando caben.

### `sankey`

`from`, `to`, `value` (también detecta `source`/`target`). El color parte en la primera etapa con más de un nodo y fluye aguas abajo.

### `wordcloud` (`words`, `tagcloud`, `nube`)

Palabras con tamaño según su frecuencia, hechas con cuidado: todas horizontales; el **área** de cada palabra es proporcional a su conteo (el tamaño de la letra crece con la raíz cuadrada); una disposición en espiral determinista desde la palabra más frecuente hacia afuera, sin choques; un solo tono que se oscurece con la frecuencia, o un color por `series` con leyenda. Si las palabras importantes no caben, toda la nube se achica; las palabras que aun así no caben se nombran en el texto alternativo, nunca se cortan.

```js
plot({ type: 'wordcloud', data, text: 'word', value: 'mentions', title: '“Data” dominates what companies ask for' });
plot({ type: 'wordcloud', text: openAnswers, title: '…', subtitle: 'Mentions in 312 open answers' });  // raw text
```

| Opción | Significado |
|---|---|
| `text` | Campo con las palabras, o el texto en bruto que se cuenta (un string o una lista de strings). El texto en bruto descarta las palabras vacías en español e inglés y los números. |
| `textField` | Un campo de texto libre en cada fila (respuestas abiertas de encuestas): las palabras se cuentan entre todas las filas. |
| `value` | Peso de cada palabra (por defecto: 1 por fila, sumado). |
| `series` | Color por grupo, con leyenda. |
| `top` | Máximo de palabras a mostrar (por defecto 80). |
| `stopwords`, `minLength` | Palabras adicionales a ignorar; largo mínimo de palabra que se conserva (por defecto 3). |
| `minFont`, `maxFont` | Rango de tamaños de letra. |
| `highlight` | Palabras a destacar; el resto se atenúa. |

Una nube sirve para "qué aparece más" y no para "por cuánto". `lint` sugiere un gráfico de barras (`top: 15`) cuando hay pocas palabras y pide un `subtitle` que diga qué se contó.

### `kpi`

`items: [{ label, value, delta, previous, period, good: "up" | "down", trend: [...], target, format }]`. El delta es una fracción (`0.12` → +12%); `good: "down"` para costos. Las tarjetas se reacomodan en filas equilibradas.

## Tablas

### `table` (`tabla`, `datatable`)

Para cuando quien lee necesita buscar el número exacto. Líneas finas entre filas y nada más; números alineados a la derecha en cifras tabulares con los mismos decimales en toda la columna; celdas vacías como un guion. Cada columna recibe el indicador que la explica.

```js
plot({
  type: 'table',
  title: 'Two of six projects are already over budget',
  data: projects,
  columns: ['project', 'area',
    { field: 'progress', type: 'progress' },
    { field: 'spent', label: 'Spent / budget', type: 'progress', target: 'budget', good: 'down' },
    'status'],
  sortBy: 'progress',
});
```

| `type` de columna | Dibuja | Se infiere cuando |
|---|---|---|
| `bar` | Valor + barra de datos en una escala compartida (divergente en torno a 0) | Es la columna numérica principal (`value`/`y`, o el primer número); `bars: false` la desactiva |
| `delta` | ▲ / ▼ + cambio con signo, en verde o rojo según `good` (`"down"` para costos) | El campo se llama var, change, delta, growth, yoy, cambio, variación… |
| `heat` | Celda teñida con una escala secuencial (divergente cuando cruza el 0); `colorScale` por columna | No se infiere |
| `sparkline` | Minilínea, con el último punto en el color de acento | El campo contiene listas de números |
| `progress` | Porcentaje + medidor; contra `target` (campo o número) o como 0–1 / 0–100 | El campo se llama progress, avance, completion…, o meta/target/goal con fracciones |
| `badge` | Píldora de estado | Los valores son palabras de estado (done, at risk, late, in progress… en es/en/pt/fr/de): colores de bien, advertencia, crítico e información |
| `check` | ✓ o un guion, con una etiqueta accesible | Booleanos, o sí/no, yes/no… |
| `date` | Fecha legible en el idioma del gráfico | Fechas ISO |
| `link` | Enlace subrayado; solo `http(s)` y `mailto` reciben un `href` | URLs |
| `rank` | Posición según el orden actual | `rank: true` |
| `text`, `number` | Texto (se divide en 2–3 líneas) y números simples | Todo lo demás |

| Opción | Significado |
|---|---|
| `columns` | Orden y tipo: nombres de campo o `{ field, label, type, format, align, width, good, target, colorScale, total, lines }`. Omítelo para usar todos los campos. `x`/`label` elige la columna con el nombre de la fila e `y` una lista de columnas de valores. |
| `sortBy`, `sort` | Columna y dirección (`"desc"` para números, `"asc"` para texto por defecto). `sort: "-sales"` también funciona. Las celdas vacías siempre van al final. |
| `pageSize`, `page` | Hasta 15 filas se muestran completas; sobre eso, páginas de 10. `pageSize: false` muestra todo. El paginador son solo números y flechas (`11–20 / 248`, `‹ 1 2 3 … 25 ›`). |
| `query` | Conserva las filas que contienen esas palabras, sin importar tildes ni mayúsculas. |
| `total` | Fila de totales: suma los números, promedia porcentajes y avances, y deja en blanco los cambios. `{ sales: "mean" }` por columna; `totalLabel` le cambia el nombre. |
| `group` | Filas bajo una franja teñida por valor, con un conteo. |
| `highlight` | Las filas cuyo nombre coincide reciben un tinte y una marca de acento; las barras de las demás filas se atenúan. |
| `top` | Conserva las primeras N filas tras ordenar. |
| `cards` | `"auto"` (por defecto) convierte cada fila en una tarjeta cuando las columnas no caben (teléfonos): nombre y valor principal arriba, la barra debajo y las demás columnas como líneas etiqueta–valor. `true` siempre, `false` nunca. |
| `density`, `striped` | Filas `"compact"` / `"comfortable"`; franjas tipo cebra para tablas muy anchas. |

En el navegador, `render()` agrega un cuadro de búsqueda sobre 20 filas (`search: false` lo oculta; `true` lo fuerza), encabezados que ordenan con un clic (orden natural, invertido y luego el orden original) y botones de página; todos funcionan desde el teclado y anuncian `aria-sort` y `aria-current`. Al cambiar el tamaño se vuelve a dibujar con el nuevo ancho, así que una tabla se vuelve tarjetas en un teléfono y columnas otra vez en un computador.

El idioma de las pocas palabras que escribe una tabla (Total, Buscar, Sin resultados) y el formato de los números vienen de `locale`; sin él, la tabla reconoce el idioma a partir de su propio título, encabezados y categorías.
