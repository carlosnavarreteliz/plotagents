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

| Quiero mostrar | `type` | Campos |
|---|---|---|
| Comparar categorías | `bar` | `x` categoría, `y` valor, `series?`, `stack?` (`true` o `"percent"`) |
| Evolución en el tiempo | `line` | `x` fecha (`"2024-03"`, `"2024-03-15"`) o año, `y`, `series?` |
| Volumen en el tiempo | `area` | igual que `line`; con `series` se apila |
| Crecimientos de medidas con escalas distintas | `line` + `index: true` | base 100; **no existe doble eje** |
| Relación entre dos medidas | `scatter` / `bubble` | `x`, `y` numéricos, `size?`, `series?`, `label?`, `trend?` |
| Partes de un todo con jerarquía | `treemap` | `path: [grupo, elemento]`, `value` |
| Parte-todo con ≤ 6 partes | `donut` | `label`, `value` |
| Magnitud en una grilla | `heatmap` | `x`, `y` categorías, `value` |
| Flujos entre etapas | `sankey` | `from`, `to`, `value` |
| Uno o varios números | `kpi` | `items: [{ label, value, delta, period, trend, target, good }]` |

Si omites `type`, se infiere de los datos.

## Opciones que más sirven

- `highlight: "Ñuble"`: destaca una categoría o serie y atenúa el resto.
- `refLines: [{ y: 600, label: "Meta" }]`: metas y umbrales.
- `annotations: [{ x: "2024-01", label: "Nueva sucursal" }]`: eventos en líneas.
- `format: "percent" | "currency" | "compact" | "integer"` o `{ prefix, suffix, decimals }`.
- `top: 10`: barras con las 10 mayores y el resto en "Otros".
- `theme: "noche"`: tema oscuro. `locale: "en"`: formato en inglés.

## Errores comunes que la biblioteca ya resuelve

- Más de 8 series → desde la 9.ª van en gris; `lint` sugiere `highlight` o agrupar.
- Dona con más de 6 partes → agrupa en "Otros".
- Etiquetas largas en columnas → cambia a barras horizontales.
- Más de 40 categorías → muestra 25 y agrupa el resto.
- Números en texto ("1.234,5", "12%", "$ 3.000") → se convierten solos.

## Salidas

- `plot(spec)` → SVG (string). Va directo a HTML, Markdown, un archivo `.svg` o un PDF.
- `toHTML([spec1, spec2])` → página autónoma con tooltips.
- `describe(spec)` → texto alternativo del gráfico.
- `schema` / `toolDefinition()` → JSON Schema y definición de herramienta (Anthropic u OpenAI).
- CLI: `npx plotagents spec.json -o grafico.svg`.
