# Primeros pasos

plotagents convierte un objeto JSON en un gráfico SVG terminado y accesible. Tú pasas filas de datos y nombras los campos; la biblioteca toma todas las decisiones de diseño: disposición del gráfico, colores, etiquetas, formatos numéricos y espaciado.

## Instalación

```bash
npm install plotagents
```

O directo desde GitHub, para tener los últimos cambios aún no publicados:

```bash
npm install github:carlosnavarreteliz/plotagents
```

Funciona tal cual en Node 18 o superior, Deno y Bun. El paquete no tiene dependencias.

## Tu primer gráfico

```js
import { plot } from 'plotagents';

const svg = plot({
  type: 'bar',
  title: 'Biobío accounts for 30% of southern sales',
  subtitle: 'Sales by region, CLP millions, 2025',
  source: 'illustrative data',
  data: [
    { region: 'Biobío', sales: 1240 },
    { region: 'Araucanía', sales: 880 },
    { region: 'Ñuble', sales: 610 },
  ],
  x: 'region',
  y: 'sales',
  locale: 'en',
});
```

`svg` es una cadena de texto. Guárdala en un archivo `.svg`, ponla en HTML o Markdown, o conviértela a PDF o PNG con cualquier herramienta de SVG.

## Anatomía de un spec

| Campo | Qué es |
|---|---|
| `type` | El tipo de gráfico, como `bar`, `line` o `treemap`. Omítelo para que se infiera de los datos. |
| `data` | Una lista de filas: `[{ region: "Biobío", sales: 1240 }]`. |
| `x`, `y`, `series` | Qué campo va en cada lugar. Cada tipo de gráfico documenta sus propios roles en la [referencia de gráficos](charts.md). |
| `title` | El hallazgo, como una oración completa con la cifra clave. |
| `subtitle` | Cómo leer el gráfico: medida, unidad y período. |
| `source` | De dónde vienen los datos. Usa `"illustrative data"` cuando sean inventados. |
| `locale` | `"es"` (el valor por defecto, `1.234,5`) o `"en"` (`1,234.5`). |

### Tablas anchas

Cuando cada medida está en su propia columna, pasa una lista en `y` y cada campo se convierte en una serie:

```js
plot({
  type: 'line',
  data: [
    { month: '2025-01', revenue: 120, costs: 90 },
    { month: '2025-02', revenue: 132, costs: 94 },
  ],
  x: 'month',
  y: ['revenue', 'costs'],
});
```

### Números escritos como texto

Valores como `"1.234,5"`, `"12%"` o `"$ 3.000"` se interpretan automáticamente, así que los datos copiados desde una planilla funcionan sin limpiarlos.

## En el navegador

Sin un bundler, carga la versión para navegador y llama a `render()`. Dibuja dentro de un elemento y agrega tooltips, ancho adaptable, deslizadores de tiempo y drill-down.

```html
<div id="chart"></div>
<script src="https://cdn.jsdelivr.net/gh/carlosnavarreteliz/plotagents@master/dist/plotagents.js"></script>
<script>
  plotagents.render('#chart', {
    type: 'line',
    data: [
      { month: '2025-01', sales: 120 },
      { month: '2025-02', sales: 140 },
      { month: '2025-03', sales: 135 },
    ],
    x: 'month',
    y: 'sales',
    title: 'Sales rose 12% in the first quarter',
    locale: 'en',
  });
</script>
```

El mismo archivo viene en el paquete como `dist/plotagents.js`. Los mapas también necesitan las geometrías: agrega `dist/plotagents-geo.js` después de `plotagents.js`.

`render()` devuelve un controlador con `update(spec)`, para volver a dibujar con un spec nuevo, y `destroy()`, para quitar el gráfico y sus listeners.

## Un informe completo en un archivo

`toHTML()` arma una página interactiva y autocontenida con la biblioteca incluida, así que funciona sin conexión y desde un archivo local.

```js
import { writeFileSync } from 'node:fs';
import { toHTML } from 'plotagents';

writeFileSync('report.html', toHTML([spec1, spec2], { title: 'Monthly report', lang: 'en', columns: 2 }));
```

## Desde la línea de comandos

```bash
npx plotagents spec.json -o chart.svg       # SVG
npx plotagents specs.json -o report.html    # several interactive charts on one page
npx plotagents spec.json --lint             # review and suggestions
npx plotagents spec.json --describe         # alt text
npx plotagents --tool                       # tool definition for an agent
```

La CLI también lee un spec desde la entrada estándar: `cat spec.json | npx plotagents > chart.svg`.

## Detectar errores

`plot()` lanza un `PlotError` con una pista cuando un spec no se puede dibujar. `safePlot()` nunca lanza excepciones, y `lint()` revisa un spec sin dibujarlo:

```js
import { safePlot } from 'plotagents';

const { ok, svg, errors, warnings, suggestions } = safePlot(spec);
if (!ok) console.log(errors.map((e) => `${e.message} → ${e.fix}`));
```

Cada error, advertencia y sugerencia trae un `fix` que dice qué cambiar.

## Próximos pasos

- Recorre la [galería](../examples/) para encontrar el gráfico que necesitas y copiar su código.
- Prueba specs en vivo en el [playground](../playground/).
- Lee la [referencia de gráficos](charts.md) para conocer cada opción de cada tipo.
- Entrégale a un agente la [guía para agentes](agents.md) y la definición de la herramienta.
