# Dashboards

`dashboard(spec)` convierte un puñado de especificaciones de gráficos en un dashboard HTML terminado y autocontenido. Igual que en un gráfico individual, las decisiones de diseño vienen incluidas: tú dices qué va en la página y la biblioteca decide dónde y cómo.

```js
import { dashboard } from 'plotagents';
import { writeFileSync } from 'node:fs';

writeFileSync('sales.html', dashboard({
  title: 'How are southern sales doing?',
  subtitle: 'Sales by month, region and channel, 2024–2025, CLP millions',
  source: 'Commercial ERP',
  updated: '2026-01-05',
  locale: 'en',
  data: sales,                              // shared rows
  kpis: [
    { label: 'Sales 2025', field: 'sales', agg: 'sum', format: 'compact',
      compare: { field: 'year', current: 2025, previous: 2024 }, trendBy: 'month' },
    { label: 'Orders 2025', field: 'orders', agg: 'sum', format: 'compact',
      compare: { field: 'year', current: 2025, previous: 2024 } },
    { label: 'Online share', value: 0.361, delta: 0.13, format: 'percent', period: 'vs 2024' },
  ],
  filters: ['region', 'channel'],
  charts: [
    { type: 'line', x: 'month', y: 'sales', series: 'region', highlight: 'Ñuble',
      title: 'Ñuble grew 37% this year, faster than any other region' },
    { type: 'choropleth', geo: 'chile', key: 'region', value: 'sales', fitTo: ['Biobío', 'Ñuble', 'Maule', 'Araucanía'],
      title: 'Biobío makes 36% of sales' },
    { type: 'bar', x: 'channel', y: 'sales', series: 'year',
      title: 'Online is the only channel growing strongly' },
    { type: 'treemap', path: ['region', 'channel'], value: 'sales',
      title: 'Physical stores are still half the business' },
  ],
}));
```

La página funciona sin JavaScript: cada gráfico se dibuja en el servidor, así que se abre en cualquier navegador, se imprime y se convierte a PDF. Cuando la versión para navegador está disponible (lo está, en Node), la página también recibe tooltips, ampliación de mapas y filtros en vivo. En una aplicación web, `renderDashboard('#board', spec)` dibuja el mismo dashboard dentro de un elemento.

## Lo que decide por ti

Estos valores por defecto vienen de la práctica del diseño de dashboards: *Information Dashboard Design* de Stephen Few, el patrón de lectura en Z y lo que hace difíciles de leer los dashboards de negocio.

| Regla | Lo que hace plotagents |
|---|---|
| **Una pregunta por dashboard** | El `title` es la pregunta ("¿Cómo van las ventas del sur?"). `lintDashboard` advierte sobre 9 gráficos y sugiere dividir sobre 6. |
| **Primero los números** | Los KPI van en una fila arriba, como máximo 5 (advertencia sobre eso). Cada uno tiene una etiqueta, la cifra, su cambio con una flecha **y** un signo (nunca solo color), el período de comparación y una minilínea opcional. |
| **Lectura en Z** | El gráfico principal va justo después de los KPI, a todo el ancho: el marcado con `primary: true` o, si no, la primera serie de tiempo. |
| **Filas completas, sin huecos** | Una cuadrícula de 12 columnas en filas equilibradas: 2 gráficos → 6 + 6 (8 + 4 cuando uno es ancho), 3 → 4 + 4 + 4, 4 → dos filas de dos, 5 → 3 + 2. Los paneles de una fila comparten la altura. |
| **El ancho sigue al gráfico** | Las series de tiempo, las cartas Gantt, los mapas de calor y los flujos se leen de izquierda a derecha, así que reciben paneles anchos. Las donas, los KPI y los rankings cortos reciben paneles angostos. El mapa de Chile recibe una columna angosta. |
| **Lo mismo, del mismo color** | Un solo mapa de colores para todos los gráficos: "Ñuble" tiene el mismo color en la línea, el treemap y las barras. `colors` fija colores para toda la página. |
| **Una sola voz** | Un tema, un idioma y una tipografía para todos los paneles. La fuente aparece una vez, abajo; un gráfico conserva su propia fuente solo cuando es distinta. |
| **Filtros como botones** | `filters` se convierten en botones cuando un campo tiene hasta 6 valores, y en una lista desplegable cuando tiene más. Filtran todos los gráficos que tienen el campo, recalculan los KPI y dicen qué está filtrado en cada subtítulo. Un filtro sobre el campo `time` de un gráfico lleva ese gráfico al período elegido. |
| **Teléfonos** | Una columna en orden de lectura; los KPI en dos columnas. |
| **Impresión** | Los paneles no se cortan entre páginas; la barra de filtros no queda fija en papel. |

## Especificación

| Opción | Significado |
|---|---|
| `title`, `subtitle` | La pregunta y el alcance (medida, unidad, período). |
| `source`, `updated`, `note` | Metadatos del pie y del encabezado. |
| `locale`, `theme`, `font`, `palette` | Se aplican a todos los gráficos (`theme: "noche"` para un dashboard oscuro). |
| `data` | Filas compartidas. Los gráficos sin `data` las usan; los KPI calculados y los filtros trabajan sobre ellas. |
| `kpis` | `[{ label, value, delta, period, trend, good, format }]` (fijos) o `[{ label, field, agg, over, scale, compare, trendBy, format }]` (calculados). `agg`: `sum`, `mean`, `median`, `min`, `max`, `count`, `distinct`, `ratio` (con `over`). `compare: { field, current, previous }` muestra el período actual y su cambio. `trendBy: "month"` dibuja la minilínea. |
| `charts` | Especificaciones de gráficos, como en `plot()`. Por gráfico: `primary: true`, `size: "full" \| "large" \| "medium" \| "small"` o `span` (de 12). |
| `filters` | `["region"]` o `[{ field, label, control: "buttons" \| "select", value }]`. |
| `layout` | `"auto"` (por defecto), `"executive"` (gráfico principal a todo el ancho y luego pares) o `"grid"` (paneles iguales). |
| `colors` | `{ "Biobío": "#3A47B8" }` para todos los gráficos. |

## Para agentes

```js
import { safeDashboard, toolDefinition } from 'plotagents';

const tool = toolDefinition({ kind: 'dashboard' });   // JSON Schema of the dashboard spec
const { ok, html, errors, warnings, suggestions } = safeDashboard(input);
```

`safeDashboard` nunca lanza errores. Revisa el dashboard como un todo (demasiados gráficos o KPI, varios gráficos de torta, temas mezclados, filtros sobre campos que ningún gráfico tiene, paneles sin título) y cada gráfico que contiene, y etiqueta cada problema con el número y el título del gráfico para que el modelo sepa cuál corregir. `planDashboard(spec)` devuelve las decisiones de diseño (paneles, anchos, filas, colores, filtros) sin dibujar nada.
