# plotagents

**Gráficos bellos con una sola llamada, pensados para agentes de IA.**
Un objeto JSON con datos y nombres de campos entra; sale un SVG accesible, con buena tipografía, colores validados para daltonismo y tooltips. 26 tipos de gráfico, incluidos los más usados de seaborn, sin dependencias. Funciona en Node, Deno, Bun y el navegador.

*Beautiful charts from one JSON spec, built for AI agents. 26 chart types including seaborn's (regplot, histplot, kdeplot, boxplot, violinplot…), multi-level treemaps and sunbursts, time sliders, small multiples and fully JSON-configurable themes. Zero dependencies, SVG output.*

```bash
npm install plotagents
```

```js
import { plot } from 'plotagents';

const svg = plot({
  title: 'Biobío concentra el 30% de las ventas del sur',
  subtitle: 'Ventas por región, millones de pesos, 2025',
  source: 'datos ilustrativos',
  data: [
    { region: 'Biobío', ventas: 1240 },
    { region: 'Araucanía', ventas: 880 },
    { region: 'Ñuble', ventas: 610 },
  ],
  x: 'region',
  y: 'ventas',
});
```

![Columnas](examples/svg/barras.svg)

La galería interactiva con 42 gráficos y el código de cada uno está en [`examples/index.html`](examples/index.html).

## Por qué

Los agentes producen buenos datos y malos gráficos: dobles ejes, tortas de 12 colores, títulos que no dicen nada. plotagents saca las decisiones de diseño de las manos del agente. Las reglas vienen de los cursos de visualización de datos para la gestión (Wilke, *Fundamentals of Data Visualization*; datavizcatalogue; el Atlas de Complejidad Económica) y están escritas en el código:

- **El título es un hecho.** `lint` lo sugiere y `describe` genera el texto alternativo.
- **Un eje.** No hay doble eje; `index: true` lleva series de escalas distintas a base 100, y `facet` hace paneles con la misma escala.
- **Etiquetas al final de cada línea**, siempre. Si chocan, se separan y una línea guía las une con su punto; la leyenda solo aparece si hace falta.
- **Todo el ancho para los datos.** El eje y va por dentro, sobre su línea de grilla; barras horizontales, heatmap y KPI calculan su alto.
- **Color por identidad, en orden fijo.** Ocho colores validados para daltonismo; desde la novena serie, gris "Otros".
- **Marcas finas, grilla recesiva.** Extremos de 4 px de radio, líneas de 2,25 px, separación de 2 px entre segmentos, sin bordes.
- **Formato chileno por defecto.** `1.234,5`, `56,1%`, `$18.500`, `1.250 M`. `locale: 'en'` para inglés.

## Tipos

| Para | `type` (alias) |
|---|---|
| Comparar categorías | `bar` (`barplot` con intervalo), `count` (`countplot`) |
| Evolución en el tiempo | `line` (`lineplot`, con `ci` para banda de confianza), `area` |
| Relación entre medidas | `scatter`, `bubble`, `regplot` (`lmplot`), `residplot`, `jointplot` |
| Perfiles | `radar` (`spider`) |
| Distribuciones | `hist` (`histplot`), `kde` (`kdeplot`), `ecdf`, `box` (`boxplot`), `violin`, `strip`, `swarm` (`beeswarm`), `point` (`pointplot`) |
| Partes de un todo | `treemap` (varios niveles), `sunburst`, `donut`, `pie` |
| Grillas y flujos | `heatmap`, `sankey` |
| Números | `kpi` |

Si no indicas `type`, se infiere: fechas → `line`, dos medidas → `scatter`, `source`/`target` → `sankey`, `path` → `treemap`, categorías → `bar`.

| | | |
|---|---|---|
| ![](examples/svg/lineas.svg) | ![](examples/svg/treemap-niveles.svg) | ![](examples/svg/regresion.svg) |
| ![](examples/svg/violin.svg) | ![](examples/svg/sunburst.svg) | ![](examples/svg/histograma.svg) |
| ![](examples/svg/radar.svg) | ![](examples/svg/sankey.svg) | ![](examples/svg/conjunto.svg) |

## Tiempo, paneles y niveles

```js
// Slider por periodo con botón de reproducir (estilo d3plus): un año a la vez.
plot({ type: 'treemap', data, path: ['sector', 'producto'], value: 'valor', time: 'año' });

// Series de tiempo: en el navegador aparece un slider de rango con vista general.
render('#grafico', { type: 'line', data, x: 'mes', y: 'ventas', series: 'region' });

// Small multiples (col / col_wrap de seaborn), con escala y colores compartidos.
plot({ type: 'area', data, x: 'mes', y: 'ventas', facet: 'region', columns: 3 });

// Treemap y sunburst de cualquier profundidad; clic para entrar a un nivel.
plot({ type: 'sunburst', data, path: ['area', 'unidad', 'item'], value: 'monto', focus: ['Docencia'] });

// Escala logarítmica con marcas 1-2-5.
plot({ type: 'line', data, x: 'mes', y: 'usuarios', series: 'plataforma', yScale: 'log' });
```

## Tema 100% JSON

Todo se configura con un objeto JSON que se fusiona sobre un tema base. Así un agente puede ajustar marca, tipografía y marcas sin tocar código:

```js
plot({
  ...spec,
  theme: {
    extends: 'papel',                // o 'noche' (oscuro)
    categorical: 'okabe-ito',        // nombre de paleta o lista de colores en orden fijo
    surface: '#FFFFFF',
    font: { family: "'Poppins', sans-serif" },
    type: { title: 22, titleWeight: 700 },
    marks: { lineWidth: 3, barRadius: 8, barMax: 44 },
    axes: { inside: false },
  },
});
```

| Clave | Contiene |
|---|---|
| colores | `surface`, `ink`, `lede`, `muted`, `grid`, `axis`, `tint`, `dim`, `other`, `status` |
| `categorical`, `sequential`, `diverging` | listas de colores o nombres: `cdia`, `okabe-ito`, `tableau10`, `udec`; `indigo`, `magenta`, `teal`, `amber` |
| `font` | `family`, `mono`, `import` (URL de Google Fonts) |
| `type` | `title`, `subtitle`, `label`, `axis`, `legend`, `source`, `titleWeight` |
| `marks` | `barRadius`, `barMax`, `lineWidth`, `pointRadius`, `gap`, `ring`, `areaOpacity`, `bandOpacity`, `dotOpacity` |
| `axes`, `layout` | `inside` (eje y por dentro), `padding` |

Atajos: `palette: [...]` y `ramp: 'teal'`. `validatePalette(colores)` revisa una paleta propia con los mismos criterios que la de fábrica (luminosidad, croma, separación bajo daltonismo y con visión normal), y `lint` la revisa sola.

## API

```js
import { plot, safePlot, lint, describe, render, toHTML, schema, toolDefinition, validatePalette } from 'plotagents';
```

| Función | Devuelve |
|---|---|
| `plot(spec)` | SVG (string). Lanza `PlotError` con una pista de corrección. |
| `safePlot(spec)` | `{ ok, svg, description, errors, warnings, suggestions }`. Nunca lanza. |
| `lint(spec)` | Revisión del spec sin dibujar: errores y sugerencias de diseño. |
| `describe(spec)` | Texto alternativo ("Mayor: Biobío con 1.240 (30%)…"). |
| `render(el, spec)` | Navegador: tooltips, ancho adaptable, slider temporal y navegación por niveles. |
| `toHTML(specs)` | Página HTML autónoma, interactiva, en un solo archivo. |
| `schema` / `toolDefinition({ flavor })` | JSON Schema del spec y definición de herramienta para Claude (`anthropic`) u OpenAI (`openai`). |
| `validatePalette(colores, opts)` | `{ ok, checks }`. |

En el navegador sin bundler: `<script src="dist/plotagents.js"></script>` define `window.plotagents`.

Los tipos completos y todas las opciones están en [`index.d.ts`](index.d.ts) y [`schema.json`](schema.json).

## Como herramienta de un agente

```js
import Anthropic from '@anthropic-ai/sdk';
import { safePlot, toolDefinition } from 'plotagents';

const client = new Anthropic();
const res = await client.messages.create({
  model: process.env.ANTHROPIC_MODEL, // el modelo que uses
  max_tokens: 4096,
  tools: [toolDefinition()],
  messages: [{ role: 'user', content: 'Grafica la distribución de tiempos de atención por centro: …' }],
});
const call = res.content.find((b) => b.type === 'tool_use');
const { ok, svg, errors, suggestions } = safePlot(call.input);
// Si !ok, devuelve `errors` al modelo como tool_result: cada error trae su `fix`.
```

[`AGENTS.md`](AGENTS.md) es una guía corta para pegar en el prompt de sistema de un agente.

## CLI

```bash
npx plotagents spec.json -o grafico.svg      # SVG
npx plotagents specs.json -o reporte.html    # varios gráficos interactivos en una página
npx plotagents spec.json --lint              # revisión y sugerencias
npx plotagents --tool                        # definición de herramienta
```

## Paleta de fábrica

| Tema | Fondo | Categórica (orden fijo) |
|---|---|---|
| `papel` | `#FCFBF9` | `#3A47B8` `#D42A5E` `#E8A33D` `#1E9C89` `#7B5CD6` `#B5562E` `#5BA3E0` `#8E9A2F` |
| `noche` | `#0B0F2B` | `#6170E0` `#E63369` `#C4851C` `#22A892` `#9780E8` `#D06A3E` `#499BDA` `#909D2D` |

Ambas pasan las comprobaciones de banda de luminosidad, croma mínimo, separación bajo daltonismo entre vecinos (ΔE OKLab ≥ 8) y separación con visión normal (≥ 15). El orden es parte de la validación. Tipografía: Mozilla Text, con respaldo `system-ui`.

## Desarrollo

```bash
npm test                 # pruebas (node:test)
npm run build            # dist/plotagents.js para el navegador
npm run examples         # regenera examples/svg y examples/index.html
```

MIT © Carlos Navarrete
