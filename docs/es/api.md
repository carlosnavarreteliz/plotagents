# Referencia de la API

```js
import {
  plot, safePlot, lint, describe, render, toHTML, configure,
  dashboard, safeDashboard, renderDashboard, lintDashboard, planDashboard,
  schema, dashboardSchema, toolDefinition, validatePalette, registerGeo, countWords,
} from 'plotagents';
```

Los tipos completos están en [`index.d.ts`](../index.d.ts) y cada opción del spec, en [`schema.json`](../schema.json).

## Dibujo

### `plot(spec)`

Dibuja un gráfico y devuelve una cadena SVG. Funciona en Node, Deno, Bun y el navegador. Lanza un `PlotError` cuando el spec no se puede dibujar; el `hint` del error dice cómo corregirlo.

```js
const svg = plot({ type: 'bar', data, x: 'region', y: 'sales', title: 'Biobío leads with 30%' });
```

La raíz `<svg>` lleva `style="max-width:100%;height:auto;…"` para achicarse con su contenedor. `inlineSize: false` deja fuera esas dos (width, height y viewBox quedan), y el CSS de la página fija el tamaño sin `!important`.

### `safePlot(spec)`

La versión que debes exponer como herramienta de un agente: nunca lanza excepciones.

```js
const { ok, svg, type, description, errors, warnings, suggestions } = safePlot(spec);
```

| Campo | Significado |
|---|---|
| `ok` | `true` cuando el gráfico se dibujó. |
| `svg` | La cadena SVG, o `null`. |
| `type` | El tipo de gráfico resuelto (útil cuando `type` se infirió). |
| `description` | Texto alternativo del gráfico. |
| `errors` | Problemas que impiden dibujar el gráfico: `{ code, message, fix }`. |
| `warnings` | Problemas que vuelven el gráfico engañoso o difícil de leer. |
| `suggestions` | Mejoras de diseño, como un mejor título o `highlight`. |

### `lint(spec)`

Revisa un spec sin dibujarlo y devuelve `{ ok, type, errors, warnings, suggestions }`. Los mensajes siguen el `locale` del spec (español por defecto, inglés con `locale: "en"`); cada uno trae un `fix` con el cambio que hay que hacer.

### `dashboard(spec)` · `safeDashboard(spec)` · `renderDashboard(el, spec)`

Un dashboard HTML autocontenido con una disposición según buenas prácticas, colores compartidos, KPI y filtros. `safeDashboard` nunca lanza excepciones y devuelve `{ ok, html, plan, errors, warnings, suggestions }`; `renderDashboard` dibuja dentro de un elemento en el navegador; `lintDashboard` revisa; `planDashboard` devuelve las decisiones de disposición. Consulta [Tableros](dashboards.md).

### `describe(spec)`

Devuelve una descripción en texto del gráfico, como "Mayor: Biobío con 1.240 (30%)…". El mismo texto va en el `<desc>` del SVG para los lectores de pantalla.

### `skinCSS(specs)`

Las reglas de las pieles de specs `bare` dibujados con `bare: { skinCSS: false }`, para escribirlas una vez en la página en vez de una vez por SVG: `".pa-skins{--pa-k1:#6e86c8}html.classic .pa-skins{--pa-k1:#0b3f8c}"`. Cada variable va una vez aunque la compartan muchos specs; vacío si sólo cambian variables de la página entre pieles. Ver [Marcas livianas](themes.md#marcas-livianas-bare).

## En el navegador

### `render(target, spec, opts?)`

Dibuja dentro de un elemento (un selector CSS o un nodo del DOM) con tooltips, ancho adaptable, controles de tiempo cuando el spec los pide (`slider: true`), drill-down en treemaps y sunbursts, clic para enfocar en redes, fases plegables en Gantt y clics en la leyenda (shift + clic excluye una entrada; en treemaps y sunbursts, un clic hace zoom en la categoría).

```js
const chart = plotagents.render('#chart', spec);
chart.update({ ...spec, highlight: 'Ñuble' });   // redraw
chart.destroy();                                // remove listeners and markup
```

| Opción | Significado |
|---|---|
| `controls` | `false` oculta los controles de tiempo aunque el spec los pida (`slider: true`). |

El controlador expone `svg` (el elemento `<svg>` actual) y `spec`.

### `attach(root)`

Agrega tooltips a un contenedor que ya tiene un SVG de plotagents, por ejemplo uno generado en el servidor.

### `toHTML(specs, opts?)`

Una página HTML autocontenida con uno o más gráficos interactivos y la biblioteca incluida.

| Opción | Por defecto | Significado |
|---|---|---|
| `title` | `"Gráficos"` | Título de la página. |
| `lang` | `"es"` | Idioma de la página. |
| `columns` | `1` | Con dos o más, los gráficos se ordenan en una grilla. |

## Configuración

### `configure(options)`

Define valores por defecto para todos los gráficos siguientes; el spec siempre tiene prioridad.

```js
configure({ font: 'Poppins', textScale: 1.5, locale: 'en' });
configure();       // returns the current defaults
configure(null);   // clears them
```

Acepta cualquier opción del spec: `font`, `textScale`, `locale`, `theme`, `palette`, `ramp`, `colorScale`, `legend`, etc. Si un spec trae su propio objeto `theme`, este se combina sobre el global.

### `registerTheme(name, theme)`

Registra un tema con nombre (combinado sobre `extends`, `papel` por defecto) para que `theme: name` y `configure({ theme: name })` puedan usarlo. Consulta [Temas](themes.md#your-own-theme-everywhere).

```js
registerTheme('acme', { background: '#FFF', text: '#111', categorical: 'tab10', grid: { dash: '2 3' } });
configure({ theme: 'acme' });
```

### `colorScaleNames()` · `resolveColorScale(name)`

Todos los nombres de escalas de color agrupados por tipo (`sequential`, `diverging`, `cyclic`, `qualitative`), y las paradas de una escala: `{ name, stops, kind }`. `interpolateColor(stops, t)` devuelve el color en `t ∈ [0, 1]` (OKLab).

### `validatePalette(colors, opts?)`

Revisa una paleta propia con las mismas pruebas que pasa la paleta incluida. Consulta [temas](themes.md#validating-a-palette).

```js
validatePalette(['#223C6A', '#E69B0A', '#D21428'], { mode: 'light', surface: '#FFFFFF' });
// → { ok: false, checks: [{ name: 'lightness', status: 'fail', detail: '…' }, …] }
```

### `registerGeo(name, featureCollection, aliases?)`

Registra tu propio GeoJSON para que los specs puedan usar `geo: name`. Chile y el mundo vienen incluidos.

## Para agentes

### `toolDefinition({ name?, flavor? })`

Devuelve una definición de herramienta construida a partir del JSON Schema: `flavor: "anthropic"` (por defecto) entrega `{ name, description, input_schema }` y `flavor: "openai"` entrega `{ type: "function", function: { … } }`.

```js
import Anthropic from '@anthropic-ai/sdk';
import { safePlot, toolDefinition } from 'plotagents';

const client = new Anthropic();
const res = await client.messages.create({
  model: process.env.ANTHROPIC_MODEL,
  max_tokens: 4096,
  tools: [toolDefinition()],
  messages: [{ role: 'user', content: 'Plot the distribution of service times per clinic: …' }],
});
const call = res.content.find((b) => b.type === 'tool_use');
const { ok, svg, errors } = safePlot(call.input);
// If !ok, send `errors` back as the tool_result: every error carries a `fix`.
```

### `schema`

El JSON Schema de un spec, publicado también como [`schema.json`](../schema.json) e importable como `plotagents/schema.json`.

## Utilidades

| Exportación | Significado |
|---|---|
| `TYPES` | Todos los nombres de tipos de gráfico. |
| `themes`, `getTheme(t)`, `themeFor(spec)` | Los temas incluidos y el tema resuelto de un spec. |
| `palettes`, `ramps` | Paletas categóricas con nombre y rampas secuenciales y divergentes. |
| `timeValues(spec)` | Valores ordenados del campo `time`. |
| `makeFormat(fmt, locale, values)` | El formateador de números que usaría un gráfico. |
| `formatNumber(v, decimals, locale)`, `formatCompact(v, locale)` | Formato de números según el idioma. |
| `squarify(items, x, y, w, h)` | El algoritmo de disposición del treemap. |
| `bundleSource()` | Solo en Node: la versión para navegador como cadena, para incrustarla. |

## Puntos de entrada del paquete

| Importación | Contenido |
|---|---|
| `plotagents` | Todo lo anterior (módulo ES). |
| `plotagents/core` | `plot()`, `configure()`, temas, pieles y todos los tipos salvo mapas y tablas. Sin geometrías incluidas, lint, esquema ni tableros: para empaquetadores sin tree-shaking. |
| `plotagents/types/<archivo>` | La base más una familia: `line` (line, area), `bar` (bar, column, count), `scatter`, `treemap`, `sunburst`, `donut`, `dist`, `regplot`, `categorical`, `radar`, `network`, `chord`, `pyramid`, `flowchart`, `gantt`, `wordcloud`, `heatmap`, `corr`, `sankey`, `kpi`. Se combinan importando varias. |
| `plotagents/maps` | La base más `choropleth`, `symbolmap`, `pointmap` y `registerGeo()`, sin las geometrías incluidas: pasa tu propio GeoJSON/TopoJSON. |
| `plotagents/table` | La base más `table`. |
| `plotagents/schema.json` | El JSON Schema. |
| `plotagents/browser` | `dist/plotagents.js`: un `<script>` que define `window.plotagents`. |
| `plotagents/browser/geo` | `dist/plotagents-geo.js`: geometrías de Chile y del mundo para la versión de navegador. |
| `plotagents/geo/chile`, `plotagents/geo/world` | Las geometrías como módulos ES. |
