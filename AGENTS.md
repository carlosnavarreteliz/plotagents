# plotagents · guía para agentes de IA

Una función, un objeto JSON. Sin decisiones de diseño: la biblioteca las toma.

```js
import { plot, safePlot } from 'plotagents';
const svg = plot({ type, data, x, y, series, title, subtitle, source });
```

## Reglas para un buen gráfico

1. **`title` es el hallazgo**, una frase completa con la cifra clave: "Biobío concentra el 30% de las ventas", no "Ventas por región".
2. **`subtitle` dice cómo leerlo**: medida, unidad y periodo.
3. **`source` siempre**. Si los datos son inventados, `source: "datos ilustrativos"`.
4. `data` va en filas (`[{ region: "Biobío", ventas: 1240 }]`). Si tienes una tabla ancha, pasa `y: ["ingresos", "costos"]`.
5. Usa `safePlot(spec)` como herramienta: nunca lanza y devuelve `errors`, `warnings` y `suggestions` con la corrección (`fix`). Si `ok` es `false`, corrige y vuelve a llamar.

## Qué tipo elegir

| Quiero mostrar | `type` | Campos clave |
|---|---|---|
| Comparar categorías | `bar` | `x`, `y`, `series?`, `stack?` (`true` / `"percent"`), `top?` |
| Contar filas por categoría | `countplot` | `x` |
| Media por categoría con intervalo | `barplot` o `point` | `x`, `y`, `hue?` |
| Evolución en el tiempo | `line` | `x` fecha (`"2024-03"`) o año, `y`, `series?`; `ci: true` si hay varias observaciones por x |
| Volumen en el tiempo | `area` | igual que `line`; con `series` se apila |
| Medidas con escalas distintas | `line` + `index: true`, o `facet` | **no existe doble eje** |
| Crecimiento exponencial | `line` + `yScale: "log"` | |
| Relación entre dos medidas | `regplot` (recta + intervalo) / `scatter` / `bubble` | `x`, `y`, `hue?`, `size?`, `label?` |
| Relación + distribuciones | `jointplot` | `x`, `y` |
| Distribución de una medida | `hist` (`kde: true`), `kde`, `ecdf` | `x`, `hue?` |
| Distribución por categoría | `box`, `violin`, `strip`, `swarm` | `x` categoría, `y` medida, `hue?` |
| Perfil en varias dimensiones | `radar` | `axis`, `value`, `series` (≤ 4 series) |
| Partes de un todo con jerarquía | `treemap` o `sunburst` | `path: [nivel1, nivel2, …]`, `value` |
| Parte-todo con ≤ 6 partes | `donut` / `pie` | `label`, `value`; `half: true` para semicírculo |
| Magnitud en una grilla | `heatmap` | `x`, `y`, `value` |
| Flujos entre etapas | `sankey` | `from`, `to`, `value` |
| Uno o varios números | `kpi` | `items: [{ label, value, delta, period, trend, target, good }]` |

Se aceptan los nombres de seaborn (`histplot`, `kdeplot`, `boxplot`, `violinplot`, `lmplot`, `stripplot`, `swarmplot`, `pointplot`) y `hue` como alias de `series`. Si omites `type`, se infiere de los datos.

## Opciones que más sirven

- `highlight: "Ñuble"`: destaca una categoría o serie y atenúa el resto.
- `facet: "region"` (+ `columns`): un panel por valor, con la misma escala.
- `time: "año"`: un periodo a la vez (el último); en el navegador, slider con play.
- `refLines: [{ y: 600, label: "Meta" }]` y `annotations: [{ x: "2024-01", label: "Nueva sucursal" }]`.
- `format: "percent" | "currency" | "compact" | "integer"` o `{ prefix, suffix, decimals }`.
- `xScale` / `yScale: "log"`.
- `theme: "noche"` o un objeto JSON (`{ extends, categorical, type, marks, font }`); `palette: [...]` para colores propios.
- `locale: "en"`: formato en inglés.

## Errores comunes que la biblioteca ya resuelve

- Más de 8 series → desde la 9.ª van en gris; `lint` sugiere `highlight` o `facet`.
- Etiquetas de líneas que chocan → se separan con líneas guía.
- Dona con más de 6 partes → agrupa en "Otros".
- Etiquetas largas en columnas o categorías → cambia a horizontal.
- Paleta propia poco distinguible → `lint` avisa con el par problemático.
- Números en texto ("1.234,5", "12%", "$ 3.000") → se convierten solos.

## Salidas

- `plot(spec)` → SVG (string). Va directo a HTML, Markdown, un archivo `.svg` o un PDF.
- `toHTML([spec1, spec2])` → página autónoma con tooltips, sliders y navegación por niveles.
- `describe(spec)` → texto alternativo del gráfico.
- `schema` / `toolDefinition()` → JSON Schema y definición de herramienta (Anthropic u OpenAI).
- CLI: `npx plotagents spec.json -o grafico.svg`.
