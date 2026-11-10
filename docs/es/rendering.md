# Renderizado: ¿SVG o Canvas?

**Decisión: SVG en todas partes, con agrupación automática de trazados para marcas densas.** Evaluamos Canvas y lo descartamos: el SVG agrupado es más rápido que Canvas en todos los tamaños que probamos y conserva las propiedades que importan en una biblioteca que usan agentes.

## Qué medimos

Gráfico de dispersión, dos colores, 720 × 420 px, Chromium (Playwright), tiempo desde que se inserta el marcado hasta el segundo cuadro de animación. Misma máquina, mismos datos.

| Puntos | SVG, un `<circle>` por punto | Canvas 2D (`arc` + `fill`) | SVG, un `<path>` por color | plotagents (SVG agrupado, gráfico completo) |
|---|---|---|---|---|
| 1.000 | 32 ms | 29 ms | 22 ms | 26 ms |
| 5.000 | 62 ms | 30 ms | 13 ms | 12 ms |
| 20.000 | 671 ms · 2,9 MB | 100 ms | 37 ms | 38 ms · 2,1 MB |
| 50.000 | 1.468 ms · 7,2 MB | 357 ms | 138 ms | 123 ms · 3,4 MB |

El costo del SVG ingenuo es el DOM: un elemento por marca. Dibujar todos los círculos de un color como arcos dentro de un solo `<path>` elimina ese costo, y el navegador rasteriza un trazado más rápido de lo que un script puede emitir decenas de miles de llamadas a Canvas.

Reprodúcelo con `node scripts/bench.js` (necesita Playwright con Chromium instalado).

## Por qué SVG gana en esta biblioteca

| Necesidad | SVG | Canvas |
|---|---|---|
| Renderizar en un servidor, en Node, sin dependencias | Sí: el SVG es una cadena de texto | Necesita un módulo nativo (`node-canvas`) o un navegador headless |
| Que un agente pueda leer y revisar lo que generó | Sí: títulos, etiquetas y valores son texto | No: es un mapa de bits |
| Accesibilidad (`aria-label`, `<desc>`, lectores de pantalla, selección de texto) | Incluida | Hay que reconstruirla a mano junto al canvas |
| Nitidez con cualquier zoom, en impresión y en PDF | Vectorial | Resolución fija; hay que volver a renderizar para cada densidad de píxeles |
| Pegar en diapositivas, Word, Figma, Markdown o correo | Funciona como archivo | Solo como imagen |
| Temas con CSS, modo oscuro, estados al pasar el cursor | Clases CSS | Redibujo manual |
| 50.000 puntos o más | Rápido con agrupación (ver arriba) | Rápido |

Canvas solo gana cuando un gráfico necesita redibujar cientos de miles de marcas en cada cuadro, como en transmisiones en vivo o campos de partículas animados. Eso está fuera de lo que necesita un gráfico para tomar decisiones, y mucho más allá del punto en que un mapa de calor o un gráfico de densidad (`kde`, `hist`) cuenta la historia mejor que puntos superpuestos.

## Cómo funciona la agrupación

`dotLayer()` en `src/svg.js` recibe los círculos que un gráfico quiere dibujar:

- **Hasta 1.500 puntos:** un `<circle>` por punto, cada uno con su propio tooltip y estado al pasar el cursor.
- **Más de 1.500 puntos:** los círculos se agrupan por estilo (color, radio, opacidad) y cada grupo se convierte en un `<path>` de arcos. Un `<rect class="pa-near">` transparente lleva las coordenadas y el texto del tooltip de hasta 20.000 puntos, y la capa del navegador busca el punto más cercano dentro de 14 px al pasar el cursor y lo marca con un anillo.

Scatter, bubble, regplot, residplot, jointplot, strip y swarm la usan automáticamente. No hace falta ninguna opción.

## Otras decisiones de rendimiento

- **Medición de texto sin DOM.** Tablas de anchos calibradas para tipografías sans humanistas permiten ajustar, partir y truncar las etiquetas de la misma forma en Node y en el navegador.
- **Números redondeados a dos decimales** en todas las coordenadas, para que los archivos sean livianos.
- **Un solo archivo para el navegador.** `toHTML()` incrusta `dist/plotagents.js` (sin dependencias), así que las páginas interactivas funcionan sin conexión, desde un archivo local o dentro de un artifact.
