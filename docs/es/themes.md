# Temas

Un tema es un objeto JSON. Pasa un nombre o un objeto; los objetos se combinan en profundidad sobre un tema base, así que solo escribes lo que cambia.

```js
plot({ ...spec, theme: 'noche' });                         // built-in dark theme
plot({ ...spec, theme: { extends: 'noche', marks: { lineWidth: 3 } } });
plot({ ...spec, palette: 'okabe-ito' });                    // shortcut for theme.categorical
plot({ ...spec, ramp: 'teal' });                            // shortcut for theme.sequential
```

## Valores por defecto de toda la biblioteca

```js
configure({ font: 'Poppins', textScale: 1.4, theme: { extends: 'papel', marks: { lineWidth: 2.5 } } });
```

Cada `plot()`, `render()`, `toHTML()` y dashboard posterior parte de estos valores; la especificación siempre manda. El objeto `theme` propio de una especificación se combina en profundidad **sobre** el tema global, así que `configure({ theme: 'noche' })` más `theme: { marks: { barRadius: 0 } }` sigue siendo oscuro. `configure()` devuelve los valores por defecto actuales y `configure(null)` los borra.

## Tu propio tema, en todas partes

El tema por defecto (`papel`) nunca cambia a menos que lo pidas. Para cambiar el estilo de todos los gráficos, registra un tema una vez y déjalo como predeterminado:

```js
import { registerTheme, configure } from 'plotagents';

registerTheme('acme', {
  extends: 'papel',              // or 'noche', or another registered theme
  background: '#FFFFFF',         // alias of surface
  text: '#111827',               // alias of ink
  lede: '#4B5563',
  muted: '#6B7280',
  grid: { color: '#EEF0F4', dash: '2 3', width: 1 },
  axis: '#C7CBD6',
  categorical: 'tab10',          // any palette or matplotlib qualitative map
  sequential: 'viridis',         // any colormap name
  tooltip: { bg: '#111827', ink: '#FFFFFF' },
  radius: 2,                     // bar, tile and swatch corners
  font: 'Inter',                 // Google Fonts name or CSS stack
});

configure({ theme: 'acme' });
```

`theme: 'acme'` también funciona en cada gráfico, y `{ extends: 'acme', … }` se construye sobre él. Los colores se validan: todo lo que no sea un color CSS (hex, `rgb()`, `hsl()` o un nombre de color) se descarta y se mantiene el valor base.

## Temas incluidos

| Nombre | Modo | Superficie | Uso |
|---|---|---|---|
| `papel` (alias `light`) | claro | `#FCFBF9` papel | por defecto |
| `noche` (alias `dark`) | oscuro | `#0B0F2B` azul marino profundo | páginas oscuras, presentaciones |

Ambos comparten los mismos ocho tonos, escalonados por separado para cada superficie y validados sobre ella.

## Claves

| Clave | Tipo | Significado |
|---|---|---|
| `extends` | nombre u objeto de tema | Base sobre la que se combina (por defecto `papel`, o `noche` cuando `mode: 'dark'`). |
| `mode` | `'light' \| 'dark'` | Afecta los tooltips y el contraste del texto sobre rellenos. |
| `surface` (alias `background`) | color | Fondo del gráfico. También se usa en las separaciones de 2 px y en los anillos alrededor de las marcas. |
| `ink` (alias `text`), `lede`, `muted` | color | Texto principal, texto secundario, texto de ejes y de la fuente. |
| `grid` | color o `{ color, dash, width }` | Líneas de cuadrícula (por defecto 1 px, continuas). `dash: '2 3'` dibuja líneas de cuadrícula punteadas. |
| `axis` | color o `{ color, width }` | Líneas base. |
| `tooltip` | `{ bg, ink }` | Colores de la tarjeta del tooltip en el navegador (por defecto: tarjeta blanca en temas claros, azul marino en oscuros). |
| `radius`, `barRadius` | número | Radio de las esquinas de las barras (por defecto 4). `radius` lo fija para todas las marcas que tienen esquinas. |
| `tint`, `tint2` | color | Rellenos discretos: tarjetas KPI, rieles de deslizadores, medidores. |
| `dim` | color | Marcas atenuadas cuando se usa `highlight`. |
| `other` | color | El grupo "Otros" y las series desde la novena. |
| `categorical` | colores, paleta o nombre de mapa de colores | Colores de identidad, asignados en este orden. |
| `sequential` | colores, rampa o nombre de mapa de colores | De claro → oscuro, para mapas de calor y mapas. |
| `diverging` | colores, rampa o nombre de mapa de colores | Dos polos con un punto medio neutro. |
| `status` | `{ good, warning, critical }` | Deltas y medidores de KPI. Nunca se usa para series. |
| `font` | `{ family, mono, import }` | Pila de fuentes y URL opcional de Google Fonts (`fontImport: true` la incrusta en el SVG). |
| `type` | `{ title, subtitle, label, axis, legend, source, titleWeight }` | Tamaños de letra en px. Los títulos se achican de forma automática en anchos angostos. |
| `marks` | `{ barRadius, barMax, barMaxH, lineWidth, pointRadius, gap, ring, areaOpacity, bandOpacity, dotOpacity }` | Geometría de las marcas. |
| `axes` | `{ inside, grid }` | `inside: true` pone las etiquetas de y sobre sus líneas de cuadrícula, dentro del gráfico (más ancho para los datos). |
| `layout` | `{ padding, paddingSmall }` | Margen exterior en anchos amplios y angostos. |

## Paletas y rampas con nombre

| Paletas (`categorical`) | Rampas (`sequential` / `diverging`) |
|---|---|
| `cdia` (por defecto), `cdia-noche`, `okabe-ito`, `tableau10`, `udec`, más las de matplotlib `tab10`, `tab20`, `tab20b`, `tab20c`, `Set1`, `Set2`, `Set3`, `Pastel1`, `Pastel2`, `Paired`, `Accent`, `Dark2` | `indigo`, `magenta`, `teal`, `amber`, `indigo-magenta`, `teal-rust`, más todos los mapas de colores de matplotlib (consulta [Escalas de color](colorscales.md)) |

## Validar una paleta

```js
import { validatePalette } from 'plotagents';

validatePalette(['#223C6A', '#E69B0A', '#D21428'], { mode: 'light', surface: '#FFFFFF', locale: 'en' });
// { ok: false, checks: [
//   { name: 'lightness', status: 'fail', detail: 'Outside the lightness band 0.43–0.77: #223C6A' }, … ] }
```

| Prueba | Umbral | Por qué |
|---|---|---|
| Banda de luminosidad | OKLCH L 0.43–0.77 (claro), 0.48–0.67 (oscuro) | Demasiado claro desaparece; demasiado oscuro se lee como texto. |
| Croma mínimo | OKLCH C ≥ 0.10 | Por debajo, un tono se lee como gris. |
| Separación para daltonismo | ΔE OKLab × 100 ≥ 8 entre vecinos, con protanopía y deuteranopía simuladas (Machado 2009) | Los vecinos deben seguir distinguiéndose con deficiencias de visión del color. |
| Separación con visión normal | ΔE ≥ 15 | Los vecinos deben ser fáciles de distinguir para todos. |
| Contraste con la superficie | ≥ 3:1, solo advertencia | Por debajo, las marcas necesitan etiquetas visibles. |

Usa `pairs: 'all'` para diagramas de dispersión y mapas, donde dos colores cualesquiera pueden quedar uno al lado del otro. La paleta incluida pasa la prueba de todos los pares para sus tres primeros colores; por eso `lint` advierte sobre diagramas de dispersión con más de tres grupos.

`lint(spec)` ejecuta esta validación de forma automática cada vez que una especificación trae su propia paleta. Los mensajes siguen `locale` (español por defecto, `'en'` para inglés).

## Colores que decide la página

Cualquier color de un spec (`colors`, `palette`, `ramp`, `colorScale`, cualquier clave del tema) puede ser una variable CSS con un respaldo:

```js
plot({ ...spec, palette: ['var(--accent, #3A47B8)'], theme: { ink: 'var(--ink, #141A3F)', grid: 'var(--rule, #E9EBF3)' } });
```

La marca se escribe con la variable, así que una sección, un modo oscuro o un cambio de marca en la página la recolorea sin un SVG nuevo. Con el respaldo calcula la biblioteca (el texto sobre una marca elige blanco u oscuro a partir de él, los tintes se mezclan desde él), y es lo que muestra el SVG fuera de la página, en un `<img>` o en un archivo. Una variable sin respaldo hex o `rgb()` es un error.

## Pieles: varios juegos de colores en un SVG

Un sitio estático no puede entregar otro relleno cuando el lector cambia de aspecto: el relleno ya está en el archivo. `skins` escribe todos los juegos en el mismo SVG y deja que el CSS de la página elija:

```js
plot({
  ...spec,
  skins: [
    { palette: ['#6E86C8', '#D9714F'] },                                     // la de siempre, en los atributos
    { when: 'html.classic', palette: ['#0B3F8C', '#D52B1E'], theme: { surface: '#FFFFFF' } },
  ],
});
```

Cada piel cambia sólo colores (`theme`, `palette`, `ramp`, `colorScale`, `colors`) y se dibuja aparte; donde dos pieles difieren, la marca recibe una variable CSS definida en el `<style>` del propio SVG bajo el selector `when` de cada piel. Los atributos conservan la primera piel, así que un `<img>` y el resaltado desde la leyenda siguen funcionando. Posiciones, textos y orden tienen que salir iguales en todas las pieles; si no, `plot` lanza un error. Las pieles se combinan con los colores como variables CSS, y `configure({ skins })` las fija para todos los gráficos (`skins: null` las apaga en uno).

## El color sigue a la entidad

Los colores se asignan a entidades, nunca a posiciones:

- Con `time`, los colores se calculan sobre todos los períodos, así que un grupo mantiene su color mientras se mueve el deslizador aunque cambie su posición en el ranking.
- Con `focus` (navegación en profundidad), el subárbol mantiene la familia de colores de su padre.
- Con `facet`, todos los paneles comparten un mismo mapa de colores.
- `colors: { "Copper": "#B5562E" }` fija cualquier entidad a un color.
