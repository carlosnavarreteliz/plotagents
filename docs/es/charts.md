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
| `ariaLabel` | El nombre accesible (el `<title>` del SVG, el que lee un lector de pantalla) sin dibujar un título. Por omisión, `title`, o el tipo de gráfico si no hay. |
| `idPrefix` | Base de los ids internos del SVG (los de aria; en mapas, el recorte y el patrón sin dato). Úsalo cuando el mismo gráfico aparece dos veces en una página; los paneles de un facet llevan `-0`, `-1`… |
| `series` / `hue` | Campo que divide los datos en grupos de color. |
| `highlight` | Un nombre o una lista: destaca esos y atenúa el resto. |
| `colors` | `{ "name": "#hex" }` para fijar el color de una entidad. |
| `format`, `xFormat`, `yFormat` | `"number" \| "compact" \| "percent" \| "currency" \| "integer"` o `{ prefix, suffix, decimals, currency }`. Desde JavaScript, también una función `(valor) => texto`: tus propias reglas para escribir cifras en etiquetas, tooltips y marcas del eje. En `line`, `area` y `bar`, `yFormat` escribe sólo las marcas del eje de valores y `format` los rótulos y el tooltip (`yFormat` toma `format` si falta). |
| `locale` | `"es"` (por defecto: `1.234,5`), `"en"` (`1,234.5`), `"pt"`, `"fr"` (`1 234,5`), `"de"` o `"auto"`: se reconoce a partir del título, el subtítulo, los nombres de columna y las categorías. Las tablas usan `"auto"` cuando omites `locale`. |
| `xLabel`, `yLabel` | Títulos de los ejes (horizontales, nunca rotados). |
| `xScale`, `yScale` | `"log"` donde tenga sentido. |
| `xDomain`, `yDomain` | `[min, max]` fijo. |
| `refLines` | `[{ y: 600, label: "Target" }]` (o `x`, o `value` para barras). |
| `facet` (`col`), `columns`, `sharey`, `sharex` | Múltiplos pequeños, un panel por valor. `sharey: "span"` da a cada panel el mismo largo de eje con su propio piso, y el mismo tamaño de trazado en píxeles (márgenes de eje y espacio de rótulos finales igualados), así una pendiente dice el mismo cambio en todos; `panelNote: 'campo'` escribe una línea bajo el nombre de cada panel, y cada panel reserva su espacio, así ninguno se monta sobre otro y todos conservan el mismo alto de trazado; `panelColor: true` escribe el nombre de cada panel en el color de su serie (o `{ panel: color }`, o una función `(panel, filas) => color`); los paneles dejan lugar a las marcas de su eje y como un gráfico suelto, igual en todos; una anotación con `panel` va sólo a ese panel; `legend: false` oculta la leyenda común. |
| `time`, `timeValue` | Un período a la vez: el más reciente por defecto, o `timeValue`. El período se agrega al subtítulo. |
| `slider`, `play` | Controles de tiempo en el navegador, **desactivados por defecto**. `slider: true` agrega botones de período cuando hay pocos períodos (≤ 8) y un deslizador mínimo cuando hay muchos; los gráficos de líneas y de áreas reciben un rango con dos tiradores. `"buttons"` o `"slider"` fuerzan uno; `play: false` oculta el botón de reproducir. |
| `compare` | Con `time`: compara contra `"previous"` (por defecto), `"first"`, un período dado o `false`. |
| `theme`, `palette`, `ramp` | Consulta [temas](themes.md). |
| `colorScale` (`cmap`) | Cualquier mapa de colores de matplotlib (`"viridis"`, `"RdBu_r"`…) o tu propia lista de colores. Consulta [escalas de color](colorscales.md). |
| `font`, `textScale` | Tipografía (nombre de Google Fonts, pila CSS o `{ family, import }`) y un multiplicador del tamaño del texto (alias `fontScale`, `labelScale`). Fíjalos para todos los gráficos con `configure()`. |
| `width`, `height`, `padding` | Píxeles. La altura es automática en barras horizontales, mapas de calor, tarjetas KPI y en treemaps, sunbursts y radares angostos. |
| `legend` | Posición: `"top"` (por defecto), `"bottom"`, `"left"`, `"right"` o `false` para ocultarla. Las leyendas laterales pasan abajo por debajo de 520 px. Fijar una posición también fuerza una leyenda donde el gráfico, de otro modo, rotularía las líneas directamente. |
| `exclude` | Un nombre o una lista: quita esas entradas de la leyenda (series, grupos del primer nivel) y recalcula ejes, proporciones y diseño. Los colores se mantienen y las entradas excluidas siguen en la leyenda, atenuadas y tachadas. |
| `tooltip` | Lo que dice cada marca al pasar el cursor, además de su valor: una lista de campos (líneas «Campo: valor» de las filas de la marca), o `{ title, fields: [campo \| { field, label, format }], text, replace }`, donde `text` es un campo con líneas ya escritas, `replace: true` quita las líneas de siempre y `omit: ["Nombre"]` quita sólo las de ese nombre (lo que va antes de los dos puntos: `"Escala"` quita «Escala: 0–40»; desde JS, también una `RegExp`), o `false`. Desde JavaScript, también `(d) => texto \| { title, lines }` con `d.rows`, `d.lines`. Una marca hecha de varias filas (un grupo del treemap, un año con varias series) muestra un campo sólo si sus filas coinciden. |
| `href` | Las teselas del treemap, los nombres de las barras horizontales y los puntos de dispersión enlazan a la URL de este campo (sólo rutas y http(s)). |
| `sprite` | Ruta de un archivo de contornos escrito una vez con `mapSprite(spec)`: las regiones son `<use>` y la página no lleva geometría. |
| `xBands` | Tramos del eje x sombreados detrás de columnas, líneas y áreas: `[{ from, to, label, color }]`. |

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
| `xGroup` / `yGroup` | Campo que agrupa categorías consecutivas (sirve cualquiera de los dos, en ambas orientaciones): una banda teñida con el nombre del grupo corre junto al eje de categorías, con una línea fina entre grupos. No se reordena nada: usa `sort: "none"` para conservar tu orden. |
| `xTicks` / `yTicks` | `{ every: N }`: rotula una de cada N categorías (y ralea más sólo si los rótulos aún chocan). Un rótulo visible se recorta al espacio de N categorías, no al de una. Las categorías de fecha se ralean en pasos del calendario (meses 1, 2, 3, 4, 6, 12…; años 1, 2, 5, 10…), medidos sobre el ancho de los rótulos. |

El eje de valores siempre termina en el primer valor redondo igual o mayor que la barra más larga, y esa última marca siempre va rotulada, también en un teléfono: cuántas marcas caben depende del ancho de sus rótulos.

**Datos que faltan.** Un dato que falta nunca es un cero: la barra no se dibuja, el tooltip dice `missingLabel` («sin dato» / «no data») y `missingMark: "s/d"` lo escribe en la base. Con `stack: "percent"`, una función `format` recibe la participación como fracción (0–1).

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
| `points` | Marcadores en cada punto (automático en series cortas); una lista de series (o `{ serie: true }`) los pone sólo en esas. |
| `lineWidths` | Grosor de trazo por serie, p. ej. `{ "media 1991–2020": 3.5 }`; las demás conservan el de siempre. |
| `stack` | Áreas: `true` (por defecto con series), `"percent"` o `false` para superponerlas. |
| `fill` | Línea única: `false` quita el degradado suave. |
| `xRange` | Rango visible `[from, to]`; es lo que fija el deslizador de rango (`slider: true`). |

**Intervalos dados y tooltips sin runtime.** `band: { lower: 'lo', upper: 'hi', label: 'Intervalo 80 %' }` dibuja tal cual un intervalo que ya viene calculado (la proyección de un modelo, un rango publicado), sin estimador, y lo nombra en la leyenda; se combina con `dashedFrom`. `crosshair: false` (implícito con `tooltip`) escribe una columna por x con su propio `data-tip` en vez del crosshair del navegador, para páginas que traen su propia capa de tooltips.

### `spark` (`sparkline`)

La forma de una serie, en su propia escala de mínimo a máximo (sin cero): responde «cómo se movió», y la cifra de al lado dice «cuánto». Sin ejes, grilla, rótulos, leyenda ni título dibujados (el título queda en `<title>` para lectores de pantalla) y sin tamaño mínimo, así que cabe en una celda: `width: 108, height: 26`. Un punto marca el último valor; un valor faltante es un hueco. Una franja invisible por x lleva el tooltip.

| Opción | Significado |
|---|---|
| `series` | Unas pocas líneas en una misma escala. |
| `fill` | Un lavado suave bajo la línea (`true` o una opacidad). |
| `dot`, `dotRadius`, `lineWidth` | El punto final (`dot: false` lo oculta) y el trazo. |
| `yDomain` | Fija la escala (p. ej. para comparar sparklines de una columna). |

### `rail` (`riel`, `range-rail`)

Una fila de una distribución, del tamaño de una celda de tabla (`width: 160, height: 18` por defecto; sirve de ~130 a ~330 px): una línea de `min` a `max`, la `band: [lo, hi]` del medio sombreada, una muesca en la `median`, el `value` de la fila como punto y cualquier número de marcas de referencia. Es la columna `range` de `table` como marca propia, para una página que conserva su tabla HTML (enlaces, íconos, notas, ficha de teléfono) y sólo necesita el riel dibujado en el servidor. Sin marco: una caja invisible lleva un `data-tip` que nombra cada parte.

```js
plot({ type: 'rail', data: [fila], value: 'chile', min: 'lo', max: 'hi', band: ['q1', 'q3'], median: 'med',
  refs: [{ field: 'region', label: 'Biobío' }, { value: 12, label: 'Meta' }],
  valueLabel: 'Chile', minLabel: 'nombreMin', maxLabel: 'nombreMax', clip: true, format: (v) => fmt(v) });
```

| Opción | Qué hace |
|---|---|
| `data` | Una fila (se dibuja la primera). Se omite si todo viene como número. |
| `value`, `min`, `max`, `median` | Cada uno, un campo de la fila o un número fijo. |
| `band` | `[lo, hi]` de la banda sombreada (p. ej. los cuartiles). |
| `refs` | Marcas de referencia: `[{ field \| value, label, color }]`; `label` es texto o un campo de la fila. `ref` + `refLabel` es el atajo de una sola. |
| `clip` | La escala es `[min, max]`: un valor pasado un extremo es un chevrón en ese extremo (y el tooltip lo dice), sin estirar la escala; una referencia pasada, un chevrón abierto. |
| `domain` | La escala, `[desde, hasta]` en números o campos (p. ej. `["p5", "p95"]`); recorta como `clip`. Sin `min`/`max`, el riel cruza todo el dominio. `domainLabel` agrega una línea al tooltip que lo nombra. |
| `fallback` | Una fila sin `min`/`max` ni `domain` no tiene riel: escribe su cifra (`"value"`, por defecto) o nada (`"none"`), nunca un punto suelto. |
| `valueLabel`, `minLabel`, `maxLabel`, `bandLabel`, `medianLabel` | Nombres en el tooltip (texto o un campo de la fila). Con `minLabel`/`maxLabel` el tooltip lista los dos extremos («Más bajo · Colchane: 7,1») en vez de «Rango: a–b». |
| `color`, `colors` | El color del punto; `colors: { rail, band, median, ref, value, bandStroke }` por parte (`bandStroke` bordea la banda con 1 px, por dentro). Cualquier color puede ser `var(--x, #respaldo)`, y `skins` funciona como en cualquier gráfico. |
| `railWidth`, `halo` | Grosor de la línea mín–máx en px (2 a 18 px de alto, por defecto); `halo: false` quita el anillo del color del fondo alrededor del punto (y del chevrón del valor). |
| `outsideLabel` | Cómo dice el tooltip que un valor o una referencia cae pasado un extremo recortado (por defecto «fuera de la escala» / "beyond the scale"), p. ej. «más allá de la comuna más alta». |
| `format`, `dotRadius`, `tooltip`, `title` | Un formato (una función desde JS), el tamaño del punto, campos extra del tooltip (`tooltip: { omit: ["Escala"] }` quita una línea de las de siempre por su nombre) y su encabezado (también el `<title>`). Sin `title`, la primera línea («Valor: 12,3») va primera en el `data-tip`, y un anfitrión que lee el `data-tip` como «encabezado\nlíneas» (como el `Tip` de PuroChile) la muestra de encabezado. |
| `bare` | El SVG liviano para una página que repite el riel en cada fila: ~0,7 KB con su tooltip en vez de ~2 KB. Ver [Marcas livianas](themes.md#marcas-livianas-bare). |

### `bump` (`rank`, `ranking`) · `slope` (`slopegraph`)

Quién pasó a quién: `x` periodo, `y` valor (ordenado en cada periodo, el mayor primero) o `rank` con puestos ya calculados, y `series`. El eje y es el puesto, el 1 arriba. Los nombres van en ambos extremos (puesto y nombre a la izquierda; en teléfono, sólo el puesto), y un ▲/▼ al final dice cuántos puestos se movió cada serie. Los empates se rompen por nombre: el dibujo es determinista.

| Opción | Significado |
|---|---|
| `top` | Deja las series que estuvieron entre las N primeras en algún periodo (12 por defecto). Un puesto bajo N se dibuja hueco en una fila «bajo N»; el tooltip dice el puesto real. |
| `ends` | `"first-last"`: sólo el primer y el último periodo (un slope chart; el alias `slope` lo fija). |
| `rank` | Campo con puestos ya calculados (1 = primero), en vez de ordenar `y`. |
| `highlight` | Una o más series en color; el resto en `dim`. |

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

`hollow: 'campo'` (o `filled`) dibuja algunos puntos huecos: una segunda codificación sin un segundo color.

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

### `dendrogram` (`dendrograma`, `hclust`)

Cómo se agrupan las cosas, y a qué altura se juntan. El árbol entra ya calculado: filas `{ id, parent, height }` (los nombres de campo en `id`, `parent`, `heightField`; un nodo con tres o más hijos se dibuja como codos a la misma altura) o una matriz `linkage` de scipy con sus `labels`. La biblioteca no agrupa nada por su cuenta (`corr` con `cluster: true` sí, para correlaciones).

| Opción | Significado |
|---|---|
| `cut` | Altura del corte: cada subárbol bajo ella es un grupo con su color categórico, nombrado a lo largo de sus hojas con su tamaño; sobre el corte, gris. Una línea punteada marca el corte. |
| `clusters` | Nombres de los grupos, en el orden de las hojas. |
| `orientation` | `"horizontal"` (raíz a la izquierda, por defecto) o `"vertical"` (raíz arriba). |
| `labels` | Rótulos de hojas: `"auto"` (una de cada k si no caben), `true`, `false`; con `linkage`, la lista de nombres. |
| `label` | Entrada por filas: campo con el nombre visible de cada hoja. |
| `series` | Entrada por filas: un campo que colorea cada hoja (una muestra al pie y la barra de peso), con leyenda salvo `legend: false`. No necesita `cut`; `colors` fija el color de una categoría. |
| `size` | Entrada por filas: el peso de cada hoja (cuántas cosas cuelgan de ella), una barra con su cifra junto al nombre (`sizeFormat` le da formato). Cada unión suma sus hojas. En vertical va sólo en el tooltip. |
| `sub` | Entrada por filas: una segunda línea bajo el nombre de cada hoja (horizontal); cada hoja pide el doble de alto. Un `"\n"` en el valor la parte en varias líneas, y cada fila crece hasta que quepa la más larga. |
| `tickFormat` | Formato de las marcas del eje de alturas, aparte de `format` (tooltips): `format: { decimals: 2 }, tickFormat: "integer"`. También sirve `xFormat` (horizontal) o `yFormat` (vertical). El eje lleva hasta 4 marcas, menos si sus rótulos se tocarían (un `treeWidth` angosto). |
| `xLabel` | Título del eje de alturas («altura de fusión (Ward)»: una altura de fusión no es una distancia, dilo). |
| `tooltip` | El `tooltip` de siempre (campos de la fila de la hoja, `text`, `replace`…). Si se pone (`true` deja las líneas por omisión), cada unión lleva también su tarjeta: su altura, cuántas hojas, su peso total y los campos de su propia fila. |
| `labelWidth` / `treeWidth` | La columna de nombres ocupa a lo más el 30 % del ancho (120 px en vertical); `labelWidth` fija ese tope en px. `treeWidth` (horizontal) fija en cambio el ancho del árbol y deja a los nombres todo lo demás: `width: 1236, treeWidth: 250`. |

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
| `jitter`, `dodge`, `radius` | Disposición de strip y swarm. Cada punto de strip y swarm lleva el `tooltip` de su fila (`{ title, text, replace: true }`). En un enjambre `radius` es un punto de partida: se achica hasta que el grupo más ancho quepa en su banda. |
| `fixedRadius` | Enjambre: `radius` queda tal cual. En horizontal, sin `rowHeight` ni `height`, las filas crecen hasta que quepa el grupo más ancho; si no, los puntos que no caben se aprietan contra el borde de su banda y se tocan. |
| `rowHeight` | Gráficos horizontales: px por fila de categoría, el paso exacto entre filas (46 por omisión; con `hue` y `dodge`, 22 por grupo + 12). Fija el alto si no hay `height`. |
| `rowLine` | Una guía a lo largo de cada categoría, de punta a punta del eje de valores y detrás de las marcas: `true` continua, `"dashed"` punteada (2 3), en el color de la grilla del tema. |
| `clamp` | Con un dominio de valores (`xDomain` en horizontal, `yDomain` en vertical): lo que cae fuera se dibuja en el borde, y la marca del borde lo dice («≤ 0,0001 %», «≥ 100 %») cuando algún valor quedó más allá. `"always"` marca los dos bordes aunque nada quede más allá. En un eje log, un 0 va al borde de abajo. |
| `yLabelPosition` | Gráficos horizontales: `"above"` escribe el nombre de cada fila sobre ella, alineado a la izquierda, y el eje de valores se queda con todo el ancho (un teléfono). En strip y swarm cada fila es una franja de `rowHeight` con el nombre arriba y los puntos debajo, el nombre justo sobre su punto más alto. |
| `estimator`, `errorbar` | Gráfico de puntos: `"mean"`/`"median"`/`"sum"` y `"ci"`/`"sd"`/`"se"`/`"pi"`. |
| `order`, `hueOrder` | Orden de las categorías y de los grupos. |
| `xGroup` / `yGroup`, `xTicks` / `yTicks` | Eje de categorías con grupos y rótulos raleados, como en `bar`. |

### `dotplot` (`dot-plot`, `wilkinson`)

Un punto por fila, apilados por tramo (Wilkinson): un histograma en que cada cosa sigue siendo una, para señalarla, nombrarla y destacarla. `x` numérico se agrupa en tramos; `x` categórico apila por categoría.

| Opción | Significado |
|---|---|
| `bin`, `bins` | Ancho del tramo en unidades de `x`, o un número de tramos (30 por defecto). |
| `label` | Campo con el nombre de cada punto (tooltip, y el rótulo del punto destacado). |
| `series` | Colores de los puntos. |
| `highlight` | Un nombre (o lista): ese punto lleva un anillo y su nombre; el resto se aclara. |
| `ticks` | Marcas propias en el eje: `[[500000, "$500 mil"], [1000000, "$1 M"]]`. |
| `dotSize` | Diámetro máximo de un punto en px (14 por defecto); además, un punto nunca es más ancho que su tramo. |
| `dotRadius` | El radio del punto en px, sin el tope del ancho del tramo: un tramo fino en una caja angosta sigue dando puntos que se leen (los de tramos vecinos pueden tocarse). Con `height` explícito se achica igual para que quepa la pila más alta. |
| `refLines` | Valores de referencia que no son un punto más (la cifra de Chile): `[{ x: 18.4, label: "Chile" }]`, una línea vertical detrás de los puntos con su rótulo arriba (`rótulo · valor`; `showValue: false` escribe sólo el rótulo, en la línea y en el tooltip) y su propio tooltip. `dash: true` la punta (3 3), o da un patrón SVG (`"4 2"`). `x` puede ser un campo cuyas filas digan todas lo mismo (con `facet`, el de cada panel). El eje se abre para incluirla. |

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
| `tileLabels` | `"wrap"`: un nombre largo va en las líneas que permita el alto de la tesela, con su participación debajo siempre que quepa a algún tamaño; si no, el nombre solo; como último recurso se recorta con «…». Por defecto `"auto"`: el nombre sólo si cabe entero. Una participación bajo 0,05 % se escribe «<0,1%», nunca «0%». |
| `shareOf` | Con `focus`: qué participación escribe cada tesela, `"group"` (por defecto), `"total"` o `"both"` («53% · 11% del total»). Si la cifra no cabe, una más corta en vez de ninguna: `"both"` pasa a la del grupo y `"total"` a la cifra sola (el tooltip dice de qué es). |
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

### `waffle` (`squares`, `cuadros`)

Una cuenta hecha cuadros: un cuadro por fila, o por unidad de `value`, por `series`, la mayor primero, llenando por filas. La parte se lee como un número de cosas y no sólo como una proporción. Si el total pasa de `maxSquares` (400), cada cuadro vale una cantidad redonda (`unit`) y la leyenda lo dice («1 cuadro = 5»); los cuadros por serie se reparten por restos mayores, así que siempre suman el total redondeado. La leyenda lleva cada cuenta; un tooltip por serie con cuenta y participación. `facet` da una pared por valor.

| Opción | Significado |
|---|---|
| `value` | Campo a sumar (si no, un cuadro por fila). |
| `unit`, `maxSquares` | Cuánto vale un cuadro; cuándo entra la unidad redonda. |
| `perSquare` | Cada cuadro es su propia marca (un `<rect>`, con `rx` si va redondeado) con el tooltip de su fila (una verificación, una persona), en el orden de los datos dentro de cada serie; va bien con `tooltip: { title, text, replace: true }`. Sólo mientras un cuadro es una unidad; sobre `maxSquares` vuelve a un tooltip por serie. |
| `columns` | Cuadros por fila (10, 20 o 25 según el total). |
| `cellRadius` | Radio de las esquinas de cada cuadro en px; `0` para esquinas rectas (por omisión, el radio de las barras del tema, a lo más un cuarto del cuadro). |
| `order` | Orden de las series (por defecto, la mayor primero). |

## Mapas

### `choropleth` (`map`) · `symbolmap` (`bubblemap`)

Las regiones de Chile (`geo: "chile"`, por defecto), los estados de EE. UU. (`geo: "usa"`) y los países del mundo (`geo: "world"`) vienen con la biblioteca, y **cualquier geometría propia** también funciona (ver abajo). `key` es el campo de los datos que se empareja y `value` la medida; un `value` de texto (un partido, un idioma, una zona) colorea por categoría con una leyenda de muestras de color. El emparejamiento es tolerante: nombres, códigos y alias, sin importar tildes, mayúsculas ni "Región de" ("RM", "Biobio", "XIII", "Aisén", "ARG", "EE.UU.", "TX", "Nueva York", "48").

**Estados Unidos.** 50 estados y DC en una proyección cónica equivalente de Albers (`albersUsa`, la misma composición que `d3.geoAlbersUsa`): Alaska (a 0,35×) y Hawái van en recuadros abajo a la izquierda con un marco fino punteado; Puerto Rico recibe su propio recuadro solo cuando los datos lo incluyen (`territories: true` lo fuerza). Cada estado muestra su código postal, más el valor cuando cabe; los estados pequeños del noreste (VT, NH, MA, RI, CT, NJ, DE, MD, DC) se rotulan en una columna a la derecha con líneas guía. `values: false` deja solo los códigos; `labels: false` los quita.

| Opción | Significado |
|---|---|
| `geo` | `"chile"`, `"usa"`, `"world"`, un nombre registrado con `registerGeo()`, un objeto GeoJSON o TopoJSON, trazos ya proyectados (`{ paths, points?, names? }`), o (en el navegador) una URL. |
| `featureKey`, `nameKey` | Propiedad de la geometría que se empareja, y la que tiene el nombre para mostrar (ambas se detectan si las omites). |
| `fitTo` | Amplía a regiones, a una caja `[lonMin, latMin, lonMax, latMax]`, a `"markers"` o a `"mainland"` (islas lejanas y reclamos fuera del encuadre). |
| `fitPadding` | Margen alrededor de lo encuadrado con `fitTo`: una fracción de su largo a cada lado (`0.06` por omisión; `0` es a ras) o píxeles (`"12px"`). |
| `highlight`, `highlightMode` | Bordea algunas regiones. `"dim"` (por omisión) además dibuja el resto a media opacidad; `"outline"` sólo bordea. Con `labels: false` no se escribe nada. |
| `highlightColor`, `highlightWidth` | El color del borde (por omisión la tinta del tema; una piel, una vista o `var(--x, respaldo)` pueden fijarlo) y su ancho en px (1,5 por omisión). |
| `views` | Varias lecturas (indicadores, años) de una sola geometría en un SVG; la página cambia `data-view`, o un selector fuera del SVG (`viewSelector`). Ver más abajo. |
| `pathPrecision`, `simplify` | Trazos compactos: relativos, redondeados a `pathPrecision` decimales y simplificados en la pantalla con una tolerancia en píxeles. |
| `microstates` | Mundo: Singapur, Malta, Baréin y 71 más como puntos (`true`: los que tienen datos; `"all"`). |
| `href` | Campo de los datos con una URL: cada región enlaza a ella (sólo rutas y http(s)). |
| `links` | Líneas entre lugares, sobre las regiones: `[{ from, to, value }]` o `{ data, from, to, value, color, curveness, width: [mín, máx], widthScale, opacity, label, fromLabel, toLabel, format, ends }`. Los extremos son claves de región o `[lon, lat]`. |
| `orientation`, `rotate` | `"landscape"` acuesta un territorio más alto que ancho, con el norte a la izquierda; `"portrait"` para uno ancho; `rotate: 90 \| -90 \| 180` gira el mapa proyectado en sentido horario. Las etiquetas quedan derechas. |
| `markers`, `layers` | Puntos por lon/lat encima; líneas, polígonos o puntos GeoJSON adicionales sobre o bajo el mapa. |
| `only` | Dibuja sólo esas regiones (códigos o nombres). Con `sprite`, encuadradas en las coordenadas del archivo entero. |
| `edgeLabels` | Un riel de nombres a lo largo de un lado de un mapa ancho, fuera de la tierra: `[{ at, label }]` o `{ data, side, max, ticks }`. |
| `inlineSize` | `false` deja `max-width:100%;height:auto` fuera del style en línea de la raíz (cualquier gráfico). |
| `scale`, `classes` | `"quantile"` (por defecto), `"equal"`, `"continuous"` o una lista de cortes; 5 clases por defecto. Los cortes se redondean a dos cifras del rango; en datos sesgados, donde eso fundiría clases (de US$ 100 mil a 27.000 millones), cada corte se redondea a dos cifras de su propia magnitud. |
| `midpoint` / `diverging` | Clases divergentes en torno a un valor (p. ej. 0 para cambios). |
| `missing` | `"plain"` quita el achurado y la entrada "Sin datos" de la leyenda; `"context"` quita además el tooltip (regiones que sólo son entorno). |
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

- **Emparejamiento sin configuración.** Las filas se emparejan con las claves habituales (código, id, ISO-2, ISO-3, nombre, alias); si algunas filas no calzan, plotagents encuentra la propiedad de la geometría cuyos valores sí calzan (`NOM_COM`, `CUT_REG`, `GEOID`, `ADMIN`…). `featureKey` fuerza una. Los nombres para mostrar salen de `nameKey`, o de la primera de `name`, `NOMBRE`, `NAME_1`, `ADMIN` y similares.
- **Proyecciones.** Se eligen según la geometría: Mercator para un país o una región, Equal Earth para el mundo y un plano cartesiano simple cuando las coordenadas no son longitudes y latitudes (metros UTM, por ejemplo). Fija `projection` en `"equirectangular"`, `"conic"` (o `{ type: "conic", parallels: [-30, -45], rotate: 72 }`), `"identity"` (coordenadas tal como vienen, y hacia abajo, para mapas ya proyectados o dibujados a mano; `flipY: true` si y crece hacia arriba) o `"planar"` (y hacia arriba).
- **Encuadre.** `fitTo` amplía a algunas regiones, a una caja `[lonMin, latMin, lonMax, latMax]` o a `"markers"`; el resto del mapa queda recortado como contexto. `fitTo: "mainland"` deja fuera las islas lejanas y los reclamos (Rapa Nui, Juan Fernández, la Antártica), que se hallan por el mar que los separa y no por una lista. `tall: false` desactiva la columna lateral para formas alargadas.
- **Marcadores.** `markers: [{ lon, lat, label, value }]` o `{ data, lon, lat, label, size, color, legend, maxRadius }`: puntos encima, proporcionales al área cuando hay un `size`, con etiquetas ubicadas donde no chocan. `minRadius` (3 por omisión) es el punto más chico de un campo de tamaño, y `radius` (4,5) el punto sin él. Un punto lleva sólo su posición, su radio, su tarjeta y su clave: el borde va en el grupo `.pa-markers` (`stroke: false` o un color, `strokeWidth`; por omisión el fondo a 1,5 px), `opacity` fija ahí la opacidad del relleno de todos (por omisión 0,8 en los de más de 6 px) y el color es el `fill` del grupo cuando hay uno solo, o una clase por color (`pk0`, `pk1`…) con una regla en el `<style>` del mapa. La página los cambia sin `!important`, una piel cambia una regla en vez de cada punto y un color `var(--x, respaldo)` funciona. `precision` redondea `cx`, `cy` y `r` (por omisión `pathPrecision`, si no 2 decimales); `inset` es el margen que se deja en el borde del mapa para un punto y su rótulo (12 px). `tooltip` escribe la tarjeta de cada punto como el `tooltip` del gráfico, sobre la fila del marcador (`{ fields, text, title, replace }`, una función `(d) => …` con `d.row`, o `false`), y `format` fija el formato de su tamaño aparte del del mapa. Nueve mil puntos pesan unos 57 bytes cada uno más su tarjeta.
- **Líneas entre lugares.** `links: { data: comercio, from: 'origen', to: 'socio', value: 'usd' }` dibuja una línea curva por fila, de región a región (o `[lon, lat]`), con ancho proporcional al valor, un solo color y sin puntas de flecha: una línea es una relación, no una ruta. Cada línea es una marca con su tooltip y `data-key="origen→destino"`; los extremos que no calzan con ninguna región se nombran en la descripción en vez de dibujarse. Con `labels: false` el mapa no lleva texto. `widthScale: "sqrt"` da el ancho por la raíz de valor/máximo, para que un flujo chico se vea junto a uno gigante. Un extremo `[lon, lat]` se nombra «lat, lon» en el tooltip (en trazos ya proyectados, «x, y»); `fromLabel` / `toLabel` nombran un campo con el nombre de cada extremo («Puerto de San Antonio»). `format` fija el formato de las cifras en el tooltip de las líneas, aparte del del mapa. `ends: true` (o `{ radius }`) pone un punto en cada lugar que une una línea, uno por lugar. `ends: { radius: [mín, máx] }` le da a cada punto un radio según la suma de las líneas que llegan a él (área proporcional con `scale: "sqrt"`, por omisión, o `"linear"`); `skip: ["__o"]` deja sin punto esas claves y `skipPoints: true` a toda región que ya es un punto. Los puntos toman el color del grupo (uno) o de una clase (varios), nunca de un style en línea: `.pa-link-ends [data-key="X"] { fill: … }` cambia uno sin `!important`.
- **Acostado.** `orientation: "landscape"` gira un cuarto de vuelta un territorio largo y angosto (Chile, Noruega, Vietnam, una cuenca) después de proyectarlo, con el norte a la izquierda para que norte→sur se lea de izquierda a derecha; encuadre, zonas de clic, marcadores y líneas lo siguen, y las etiquetas quedan derechas. `rotate: 90 | -90 | 180` fija el giro a mano.
- **Claves para tu página.** Cada región, línea y marcador lleva `data-key`: la clave con que tus datos lo nombran (un CUT, un ISO, un nombre), o su código o nombre si no tiene datos. La página puede conectar sus propias listas y resaltados a ellas. Lo común se escribe una vez: el `stroke`, `stroke-width` y `stroke-linejoin` de las regiones van en el grupo `.pa-regions`, los del borde de lo destacado en `.pa-outlines`, y una región lleva `data-color` sólo cuando no es su `fill` (líneas, regiones rayadas). Las regiones ya no llevan el antiguo `data-k`: lee `data-key`.
- **Nombres en un borde.** `edgeLabels: [{ at, label, key? }]` (o `{ data, at, label, key, side, max, ticks }`) dibuja un riel fuera de la tierra de un mapa ancho, abajo por omisión (`side: "top" | "right" | "left"`): una marca en cada lugar (una clave de región, o `[x, y]` / `[lon, lat]`) y su nombre. Los nombres se reparten en el orden dado, el primero es el que más importa; uno que chocaría, o viene después de `max`, se escribe igual pero oculto (`display="none"`, clase `pa-edge-off`), y la página lo muestra al pasar el puntero. Cada uno es un `<g class="pa-edge" data-key>`. Chile acostado lleva sus regiones bajo la tira, donde no tapan nada.
- **Capas.** `layers: [{ geo, label, stroke, width, fill, dash, opacity, below }]` superpone ríos, caminos, rutas, fallas o límites de distritos (o los dibuja bajo las regiones con `below: true`). Un `label` agrega una clave a la leyenda.
- **Estilo.** `borderColor`, `borderWidth`, `pointRadius`, `lineWidth`, `ramp` (una rampa secuencial con nombre o propia), `palette` y `colors` (categorías).
- **Regístrala una vez y úsala por nombre.** `registerGeo('biobio', comunas, ['comunas-biobio'])` y luego `geo: 'biobio'` en cada especificación, lo que mantiene cortas las llamadas a herramientas de un agente.

#### Mapas para un sitio estático: trazos proyectados, vistas y nada de la biblioteca en el navegador

Un sitio que arma sus páginas de antemano puede dibujar cada mapa en el servidor y entregar el SVG terminado, sin nada de plotagents en el navegador.

**Trazos proyectados al construir.** `geo: { paths: { id: "M…Z" }, points?: { id: [x, y] }, names?: { id: nombre } }` recibe trazos SVG ya proyectados y simplificados (un `map.json` con un contorno por comuna), en píxeles y con y hacia abajo. No corre TopoJSON ni proyección: cada trazo se lee a puntos (`M L H V Z C S Q T A`, absolutos o relativos) y se encuadra, se gira (`orientation: "landscape"`), se empareja y se colorea como cualquier mapa. Un valor puede ser `{ d, at: [x, y] }`, donde `at` ancla las líneas; `points` son lugares demasiado chicos para un contorno, dibujados como puntos de `pointRadius`.

**Trazos compactos.** Un mapa detallado pesa lo que pesan sus coordenadas. `pathPrecision: 1` (decimales, en píxeles) escribe comandos relativos redondeados a esa grilla, y `simplify: 0.5` quita los puntos a menos de medio píxel de la línea (Douglas–Peucker en la pantalla). En las 345 comunas de Chile a 1.180 px, los trazos bajan de 516 KB a 176 KB (39 KB con gzip) sin cambio visible. Sin estas opciones los trazos se escriben como siempre.

**Los contornos en un archivo aparte.** Un sitio que muestra el mismo mapa en cientos de páginas no tiene por qué repetir sus contornos en cada una. `mapSprite(spec)` escribe un SVG con un `<path id>` por región, proyectado pero sin encuadre (su lado mayor mide 1000); se publica una vez (`/maps/chile.svg`) y el navegador lo guarda. Con `sprite: "/maps/chile.svg"`, cada región es un `<use href="/maps/chile.svg#id">` dentro de un grupo cuya transformación encuadra y gira el archivo, así que un solo archivo sirve al mapa ancho, al de teléfono y a cada encuadre (`fitTo` una región). Colores, clases de las vistas, tooltips y enlaces quedan en el `<use>`; los puntos se siguen dibujando en la página. `only: [ids]` dibuja un subconjunto (las comunas de una región) con la transformación del archivo entero: se pasa la geometría completa y los ids que se dibujan, nunca una geometría recortada a ellos (su encuadre sería otro y cada `<use>` caería corrido). Las 345 comunas de Chile: el archivo pesa 90 KB (26 KB con gzip); cada mapa de una página, 62 KB (10 KB con gzip) con una vista y 26 KB con gzip con seis. Un archivo de otro origen necesita CORS, y un SVG abierto solo (en un `<img>`) no lo carga.

**Vistas.** `views: [{ id, label, value, … }, …]` dibuja varias lecturas de una sola geometría en un SVG. Cada vista es un parche del spec (`value`, `data`, `format`, `colorScale`, `scale`, `classes`, `thresholds`, `colors`, `legendTitle`, `tooltip`, y `highlight`, `links` y `markers` sólo para esa vista; `markers: false` deja una vista sin puntos). La primera vista se dibuja como siempre. Las demás viajan como datos: una clase por región y vista (`pv2-3`: vista 2, clase de color 3), su tooltip en `data-vtip-<id>`, y un `<style>` dentro del SVG que pinta la vista que nombra `data-view` en la raíz y esconde las leyendas, rótulos y líneas de las otras. Las pieles y los colores `var(--x, respaldo)` funcionan como en cualquier gráfico. Una vista no puede cambiar las formas ni el marco (`geo`, `key`, `fitTo`, `only`, `orientation`, `width`, `title`, `viewSelector`, `highlightMode`…). Una vista puede traer su propio `highlightColor` y `highlightWidth`. Con `markers` en una vista, cada vista dibuja su tanda (la que no trae los suyos toma los del spec) dentro de su grupo `pv<i>`, así que cambiar de vista cambia sus puntos con la misma regla; los puntos de todas las vistas comparten una clase por color. Una vista sin datos y con el fondo de la primera (una que sólo cambia `markers` o `links`) no repinta regiones: sin clases ni reglas de vista, y si todas son así, una región cuya tarjeta es la misma en todas lleva sólo `data-tip`.

```js
plot({
  type: 'choropleth', geo: { paths: map.paths, names: map.label }, data: comunas, key: 'id',
  orientation: 'landscape', fitTo: 'mainland', pathPrecision: 1, simplify: 0.5, href: 'url',
  views: [
    { id: 'inmigrantes', label: 'Nacidos en el extranjero', value: 'pct_inmigrantes', format: { suffix: '%' } },
    { id: 'mayores', label: '65 años o más', value: 'pct_65_mas', highlight: 'c05101' },
  ],
});
```

Cambiar de vista es cambiar un atributo. `plotagents/views` (1,2 KB minificado, 0,6 KB con gzip, sin dependencias) lo hace y pasa el tooltip de la vista a `data-tip`, que es lo que lee cualquier capa de hover:

```js
import { setView, bindViews } from 'plotagents/views';
setView(document.querySelector('#mapa'), 'mayores');
bindViews(document);   // <button data-set-view="mayores"> cambia los mapas de la página
```

**Cambiar de vista sólo con CSS.** `viewSelector` ata las reglas de las vistas a un ancestro del `<svg>` en vez de a su `data-view`: un texto con `{id}` o, desde JavaScript, una función `(id, i) => selector`. Así unos radios cambian el mapa sin ningún script, antes de hidratar y cuando el botón «atrás» restaura el formulario:

```js
plot({ ...spec, views, viewSelector: '#distritos:has(input[data-set-view="{id}"]:checked)' });
// o una clase que pone la página: viewSelector: '.ver-{id}'
```

Si ningún selector calza, se ve la primera vista. La forma de función arma una vista con dos elecciones: ``viewSelector: (id) => { const [tipo, anillo] = id.split('-'); return `#gap:has(#k-${tipo}:checked):has(#r-${anillo}:checked)`; }``. Los colores, leyendas, rótulos y líneas siguen al selector; **los tooltips no**: son atributos y el CSS no los cambia, así que la capa de hover lee `data-vtip-<id>` por su cuenta o la página deja `bindViews` (sobre los mismos radios) para pasar el tooltip de cada vista a `data-tip`. Con `viewSelector`, `setView` sigue cambiando los tooltips pero ya no repinta el mapa.

**El mundo.** Los países calzan por ISO-2 (`"CL"`), ISO-3 o nombre. `microstates: true` dibuja como punto los estados demasiado chicos para tener contorno a esta escala (Singapur, Malta, Baréin, Hong Kong…; `"all"` los dibuja todos); las líneas llegan a ellos como a cualquier país. Las **líneas** siguen siendo lo que eran: una relación, no una ruta.

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
| `preset` | Posiciones que ya tienes (MDS, UMAP, t-SNE, Gephi): `nodes` trae `x` e `y` (`nodeX` / `nodeY` para otros nombres), ajustados con una sola escala para ambos ejes, así la nube no se deforma; y crece hacia abajo salvo `flipY: true`. Las aristas son opcionales: con `nodes` solo se dibuja una dispersión con tamaños, grupos y nombres que no se pisan. |

`labels` (número, lista o `true`), `highlight` (un nodo y sus vecinos), `focus` (el id de un nodo: va al centro, o a la raíz en `radial`/`tree`, y se destaca con sus vecinos, todos rotulados; en el navegador lo hace un clic con una transición suave, y un segundo clic o Esc vuelve), `iterations`, `maxRadius`, `curveness`.

Un mapa ya calculado (el espacio de productos, una red de conocimiento) suele pedir que el significado lo lleven los nodos y que las aristas se retiren:

| Opción | Significado |
|---|---|
| `filled` / `hollow` | Un campo de `nodes` (o una lista de ids): esos nodos quedan rellenos (o huecos) y el resto son anillos del mismo color con el fondo adentro. Una segunda codificación sin un segundo color, p. ej. los grupos en que una institución se especializa, encendidos sobre el mismo mapa. Los rellenos se rotulan primero; los huecos, en tinta tenue. |
| `edgeColor` | `"source"` (por omisión), `"neutral"` (la tinta tenue del tema) o cualquier color, incluido `var(--line, #e0d6c4)`. `colors["a→b"]` sigue fijando una arista, que va encima. |
| `edgeOpacity` / `edgeWidth` | Un número para todas las aristas, o `[mín, máx]` según el valor (la opacidad lineal, el ancho por la raíz). |
| `stretch` | Sólo con `layout: "preset"`: x e y se escalan por separado para llenar el área, para posiciones ya normalizadas por eje (MDS en 0–1). |
| `minRadius` | Radio mínimo de un nodo en px (2,5 por omisión). |
| `labelWidth` | Ancho máximo del nombre de un nodo en px antes de cortarlo con «…» (150 por omisión). |
| `edgeTip` | `false` no escribe tooltip en las aristas (`tooltip: false` también las deja sin él). Cientos de aristas con su propio texto pesan más que el dibujo. El tooltip de una arista nombra sus dos nodos como lo hacen sus propios tooltips: con `tooltip: { title: "full" }`, por ese campo de `nodes` (el nombre entero); si no, por su rótulo. |
| `href` | Un campo de `nodes` con una URL: cada nodo es un enlace. |

### `chord`

Filas `from`, `to`, `value`, o `matrix` + `names`. `directed` (por defecto false), `sort`, `ribbonColor: "smaller" | "larger" | "source"`, `labelOrientation: "radial"`.

### `flowchart` (`flow`, `diagram`)

`nodes` con `id`, `label`, `type` (`start`, `end`, `process`, `decision`, `data`, `note`), `lane` opcional (carriles) y `group`; `edges` (o `data`) con `from`, `to` y un `label` opcional ("Sí"/"No"). Diseño por capas con dirección automática (`direction: "TB" | "LR"`), conectores ortogonales con flechas y bucles que rodean por el costado. `nodeWidth`, `swimlanes: false`.

## Cuadrículas, flujos y números

### `heatmap`

Categorías `x`, `y` y `value`. Rampa secuencial por defecto; `midpoint` (o `diverging: true`) para una rampa divergente. Los valores se escriben en las celdas cuando caben.

| Opción | Qué hace |
|---|---|
| `colorScale: { colors, breaks }` | Clases discretas en vez de un degradado ([escalas de color](colorscales.md#clases)); la leyenda pasa a ser una clave escalonada con los cortes escritos debajo, con `format`. |
| `midClass: "neutral"` | Con cortes alrededor de 0, la clase que contiene el 0 va en el tinte neutro: lo que casi no se mueve no se pinta. `midClass: { color }` la pinta en ese color, así un parche de piel la fija sin reemplazar el tema. Con `midClass`, `colorScale.colors` puede traer además un color por corte (uno menos que las clases): los colores divergentes sin el del medio, p. ej. una paleta divergente de 6 con 6 cortes. El color del medio se inserta en la posición k = número de cortes negativos (contando desde arriba con `reverse`). Pide que el 0 quede estrictamente dentro de los cortes y no sea un corte; si no, la cuenta tiene que calzar como siempre. |
| `missingLabel` | Lo que dice el tooltip de una celda sin valor (`"—"` por omisión): `"sin dato"`. |
| `missing` | Celdas sin valor: `"tint"` (por defecto), `"plain"` (sólo el borde), `"hatch"` (rayado de «sin dato») o `"gap"` (nada). |
| `floor` / `ceiling` | Los valores bajo / sobre se dibujan como celdas vacías: el valor existe (el tooltip lo muestra), pero no se colorea ni estira la escala. |
| `emptyRow` | Texto escrito de lado a lado en una fila sin ningún valor (`"sin dato"`), en vez de una fila de celdas vacías. |
| `xGroup` / `yGroup` | Agrupa columnas / filas consecutivas: una banda teñida con el nombre del grupo junto al eje. Un nombre que no cabe se corta, y va entero en su tooltip. |
| `groupColors` | `{ [grupo]: color }`: cada grupo con color lleva una franja de 3 px de su color en el borde de su banda que mira a la grilla (el matiz de una familia bajo sus sectores), en vez del tinte alterno. |
| `groupStripe` | Dónde va la franja de `groupColors`: `"grid"` (por omisión) en la banda de grupos, o `"labels"` en el borde de la grilla del lado de los rótulos, entre los rótulos y las celdas (sobre la grilla con `xLabelPosition: "top"`, a su izquierda en las filas). La banda de grupos queda entonces sólo con los nombres. |
| `cornerLabel` | Un título en la esquina vacía donde se encuentran los rótulos de fila y de columna: `"nació en ↓ / vive en →"`; `"\n"` lo parte en líneas. La columna de rótulos de fila se ensancha para que quepa (con el mismo tope); lo que no cabe se corta y va entero en el tooltip. |
| `xTicks` / `yTicks` | `{ every: N }`: rotula una de cada N columnas / filas (los años de diez en diez, por ejemplo). |
| `rowTip` | Tooltip del rótulo de cada fila, desde este campo: lo que es de toda la fila y no tiene que repetirse en cada celda. Desde JS, también una función del rótulo. |
| `rowHref` / `colHref` | Los rótulos de fila / columna enlazan a la URL de este campo (sólo rutas y http(s)). Desde JS, también una función del rótulo. |
| `xLabelAngle`, `xLabelPosition` | Rótulos de columna girados (`-90` de pie, `-45` inclinados) cuando no caben de lado, bajo la grilla (por defecto) o sobre ella (`"top"`). La franja crece lo necesario; un rótulo cortado lleva su nombre entero en el tooltip. |
| `cellGap` | Aire entre celdas en px (`2` por defecto); `0` las junta con esquinas rectas; `[x, y]` por eje. |
| `diagonal` | Las celdas con `x` igual a `y` (se quedó en la misma región) van aparte: su propio color, fuera de la escala (una diagonal enorme no aplana el resto), una entrada en la leyenda y una línea en el tooltip. `true`, un rótulo o `{ label, color, opacity }`. Un valor que falta sigue siendo «sin dato». |
| `cellColor` | Un campo que nombra la clase de cada celda («Revisada»); esas celdas toman `colors[clase]`, fuera de la escala, con su entrada en la leyenda y su línea en el tooltip. Un valor escrito como color se usa tal cual. |
| `labelFormat` | Formato sólo del numeral dentro de las celdas (tooltip y leyenda siguen con `format`). Una función que devuelve `""` deja la celda sin cifra. |

```js
plot({ type: 'heatmap', data, x: 'vive', y: 'nacio', value: 'personas',
  diagonal: { label: 'Nació y vive aquí', color: '#7A3E9D' },
  xLabelAngle: -90, xLabelPosition: 'top', rowHref: 'url', cellGap: 0 });
```

### `sankey`

`from`, `to`, `value` (también detecta `source`/`target`). El color parte en la primera etapa con más de un nodo y fluye aguas abajo.

`nodes: [{ id, label, sub, color, column, tip }]` separa el id del rótulo: el mismo lugar puede estar en dos etapas sin fundirse ni formar un ciclo; `sub` es la segunda línea bajo el nombre y `column` fija la etapa. `order: "given"` respeta el orden de `nodes`, `stages: ["Región", "Aduana", "País"]` rotula las columnas, `linkColor: "source" | "target"` (o uno por etapa) colorea los flujos, y `colors["origen→destino"]` fija uno. Los trazos de los flujos van con dos decimales; `pathPrecision: 1` (o 0) escribe menos.

Muchos nodos chicos quedan a pocos píxeles unos de otros y sus nombres se enciman. `relax: true` separa los rótulos de cada columna: todo nodo lleva su nombre y su segunda línea, cada rótulo se corre lo mínimo para quedar a 31 px de sus vecinos (un número fija otra distancia; bajo 28 px el rótulo es de una línea) y el que quedó lejos de su nodo lleva una guía fina hasta él. Sin `height`, el gráfico crece hasta que caben; con `height`, los que no caben pasan a una línea y luego se aprietan.

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
| `link` | Enlace subrayado: `http(s)` y `mailto` abren en otra pestaña; una ruta del sitio (`"/es/…"`, `"./x"`, `"#y"`) enlaza en la misma; lo demás es texto. `text: 'campo'` muestra otro campo en vez de la URL | URLs |
| `rank` | Posición según el orden actual | `rank: true` |
| `range` | Un riel: el valor de la fila como punto sobre `min`–`max`, una `band: [lo, hi]` sombreada, una muesca en la `median` y una marca de referencia `ref` (cada una, un campo o un número fijo). El tooltip lista cada parte; `refLabel` y `bandLabel` las nombran. `scale: "row"` da a cada fila su propia escala (indicadores en unidades distintas); por defecto, una escala para la columna. `refs: [{ field \| value, label }]` agrega varias marcas con su rótulo; `clip: true` recorta la escala a mín–máx y `domain: [desde, hasta]` (números o campos, p. ej. p5–p95) a cualquier tramo, y lo que cae pasado un extremo es un chevrón; `minLabel`, `maxLabel`, `medianLabel`, `domainLabel` nombran las partes; `outsideLabel` dice cómo cae una pasado un extremo y `halo: false` quita el anillo del punto. Una fila sin `min`/`max` en una columna que los tiene escribe sólo su cifra. El mismo dibujo que el tipo `rail` | — |
| `text`, `number` | Texto (se divide en 2–3 líneas) y números simples | Todo lo demás |

| Opción | Significado |
|---|---|
| `columns` | Orden y tipo: nombres de campo o `{ field, label, type, format, align, width, good, target, colorScale, total, lines }`. Omítelo para usar todos los campos. `x`/`label` elige la columna con el nombre de la fila e `y` una lista de columnas de valores. |
| `formatBy` (columna) | Un formato por fila, para una tabla de indicadores en unidades distintas (porcentaje, conteo, dinero): un campo cuyo valor es un formato (`"percent"`, `{ suffix: " años", decimals: 1 }`; los decimales se infieren entre las filas que lo comparten) o, desde JS, una función `(valor, fila) => texto`. Sirve en `number`, `bar`, `heat`, `delta` y `range` (celda, tooltip y tarjeta); una columna `range` pasa a `scale: "row"` y la columna no lleva total. |
| `sortBy`, `sort` | Columna y dirección (`"desc"` para números, `"asc"` para texto por defecto). `sort: "-sales"` también funciona. Las celdas vacías siempre van al final. |
| `pageSize`, `page` | Hasta 15 filas se muestran completas; sobre eso, páginas de 10. `pageSize: false` muestra todo. El paginador son solo números y flechas (`11–20 / 248`, `‹ 1 2 3 … 25 ›`). |
| `query` | Conserva las filas que contienen esas palabras, sin importar tildes ni mayúsculas. |
| `total` | Fila de totales: suma los números, promedia porcentajes y avances, y deja en blanco los cambios. `{ sales: "mean" }` por columna; `totalLabel` le cambia el nombre. |
| `group` | Filas bajo una franja teñida por valor, con un conteo. |
| `highlight` | Las filas cuyo nombre coincide reciben un tinte y una marca de acento; las barras de las demás filas se atenúan. |
| `top` | Conserva las primeras N filas tras ordenar. |
| `cards` | `"auto"` (por defecto) convierte cada fila en una tarjeta cuando las columnas no caben (teléfonos): nombre y valor principal arriba, la barra debajo y las demás columnas como líneas etiqueta–valor. `true` siempre, `false` nunca. |
| `density`, `striped` | Filas `"compact"` / `"comfortable"`; franjas tipo cebra para tablas muy anchas. |
| `missingLabel` | Lo que escribe una celda sin valor (y su tooltip) en vez del guion: `"sin dato"`. |

En el navegador, `render()` agrega un cuadro de búsqueda sobre 20 filas (`search: false` lo oculta; `true` lo fuerza), encabezados que ordenan con un clic (orden natural, invertido y luego el orden original) y botones de página; todos funcionan desde el teclado y anuncian `aria-sort` y `aria-current`. Al cambiar el tamaño se vuelve a dibujar con el nuevo ancho, así que una tabla se vuelve tarjetas en un teléfono y columnas otra vez en un computador.

El idioma de las pocas palabras que escribe una tabla (Total, Buscar, Sin resultados) y el formato de los números vienen de `locale`; sin él, la tabla reconoce el idioma a partir de su propio título, encabezados y categorías.
