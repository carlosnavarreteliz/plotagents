// Formas punteadas: estimaciones, proyecciones y cifras provisorias.
// Datos ILUSTRATIVOS (no oficiales).
const SRC = 'datos ilustrativos';

const exportaciones = [
  [2016, 15.2], [2017, 18.6], [2018, 19.8], [2019, 17.9], [2020, 18.4], [2021, 26.9], [2022, 23.4], [2023, 22.7], [2024, 24.1], [2025, 25.6], [2026, 27.0], [2027, 28.1], [2028, 29.0],
].map(([año, valor]) => ({ año, valor }));

const ventasCanal = [
  ['2021', 'Tienda', 410], ['2021', 'Web', 120], ['2022', 'Tienda', 395], ['2022', 'Web', 180], ['2023', 'Tienda', 388], ['2023', 'Web', 246],
  ['2024', 'Tienda', 372], ['2024', 'Web', 318], ['2025', 'Tienda', 360], ['2025', 'Web', 390], ['2026', 'Tienda', 350], ['2026', 'Web', 450],
].map(([año, canal, ventas]) => ({ año, canal, ventas }));

const cosechas = [
  ['Maule', 412, false], ['Ñuble', 298, false], ['Biobío', 265, true], ["O'Higgins", 240, false], ['La Araucanía', 188, true], ['Los Ríos', 96, false], ['Los Lagos', 74, true],
].map(([region, toneladas, provisional]) => ({ region, toneladas, provisional }));

const gastos = [
  ['Remuneraciones', 4620], ['Arriendo', 1810], ['Tecnología', 1390], ['Marketing', 880], ['Sin clasificar', 1300],
].map(([partida, monto]) => ({ partida, monto }));

const proy = exportaciones.find((r) => r.año === 2028).valor;
const ultimo = exportaciones.find((r) => r.año === 2024).valor;
const webCruza = ventasCanal.find((r) => r.canal === 'Web' && r.ventas > ventasCanal.find((q) => q.año === r.año && q.canal === 'Tienda').ventas).año;

export const dashedGallery = [
  {
    id: 'linea-proyeccion',
    section: 'Tiempo',
    name: 'Línea con proyección',
    nameEn: 'Line with a projection',
    note: '`dashedFrom: 2025` dibuja el tramo proyectado con trazo discontinuo y puntos huecos, sobre una banda suave rotulada con `dashedLabel`. La línea sólida y la discontinua se unen en el último dato firme; el tooltip dice qué valores son proyección.',
    noteEn: '`dashedFrom: 2025` draws the projected stretch with a dashed stroke and hollow points over a soft band labeled with `dashedLabel`. Solid and dashed meet at the last firm value; the tooltip says which values are projected.',
    spec: { type: 'line', title: `Las exportaciones llegarían a US$ ${String(proy).replace('.', ',')} mil millones en 2028`, subtitle: 'Exportaciones de fruta fresca, miles de millones de US$', source: SRC, data: exportaciones, x: 'año', y: 'valor', dashedFrom: 2025, dashedLabel: 'Proyección', points: true, format: { decimals: 1 } },
  },
  {
    id: 'area-proyeccion',
    section: 'Tiempo',
    name: 'Áreas apiladas con proyección',
    nameEn: 'Stacked areas with a projection',
    note: 'En áreas apiladas, el tramo desde `dashedFrom` se raya en el color de cada serie: la composición se sigue leyendo, pero se nota que es estimada.',
    noteEn: 'In stacked areas, the stretch from `dashedFrom` is hatched in each series\' color: the composition still reads, but it is clearly an estimate.',
    spec: { type: 'area', title: `La venta web superaría a la tienda desde ${webCruza}`, subtitle: 'Ventas por canal, millones de $', source: SRC, data: ventasCanal, x: 'año', y: 'ventas', series: 'canal', dashedFrom: '2025', dashedLabel: 'Estimación' },
  },
  {
    id: 'columnas-estimadas',
    section: 'Comparar',
    name: 'Columnas estimadas',
    nameEn: 'Estimated columns',
    note: 'Con un eje de tiempo, `dashedFrom` raya las columnas desde ese año: relleno de franjas del mismo color y borde discontinuo. La leyenda explica qué significa el rayado y al pasar sobre ella se destacan solo esas columnas.',
    noteEn: 'On a time axis, `dashedFrom` hatches the columns from that year on: stripes of the same color and a dashed border. The legend explains the hatching, and hovering it highlights only those columns.',
    spec: { type: 'bar', title: `De US$ ${String(ultimo).replace('.', ',')} mil millones en 2024 a casi US$ 29 mil millones en 2028`, subtitle: 'Exportaciones de fruta fresca, miles de millones de US$', source: SRC, data: exportaciones, x: 'año', y: 'valor', dashedFrom: 2025, dashedLabel: 'Estimado', format: { decimals: 1 } },
  },
  {
    id: 'barras-provisorias',
    section: 'Comparar',
    name: 'Cifras provisorias',
    nameEn: 'Provisional figures',
    note: '`dashed: "provisional"` toma un campo de los datos: las filas con valor verdadero se dibujan punteadas. También acepta una lista de categorías (`dashed: ["Biobío"]`).',
    noteEn: '`dashed: "provisional"` reads a data field: rows with a truthy value are drawn dashed. It also takes a list of categories (`dashed: ["Biobío"]`).',
    spec: { type: 'bar', title: 'Maule lidera la cosecha; tres regiones aún no cierran su cifra', subtitle: 'Cosecha de cerezas por región, miles de toneladas', source: SRC, data: cosechas, x: 'region', y: 'toneladas', horizontal: true, dashed: 'provisional', dashedLabel: 'Provisorio' },
  },
  {
    id: 'dona-estimada',
    section: 'Partes de un todo',
    name: 'Dona con una parte estimada',
    nameEn: 'Donut with an estimated part',
    note: 'Un segmento punteado conserva su color y su lugar, pero con rayado y borde discontinuo por dentro; en la tabla-leyenda su muestra también va rayada.',
    noteEn: 'A dashed segment keeps its color and place, with hatching and an inner dashed border; its swatch in the table-legend is hatched too.',
    spec: { type: 'donut', title: 'Las remuneraciones son casi la mitad del gasto', subtitle: 'Gasto operacional por partida, millones de $', source: SRC, data: gastos, label: 'partida', value: 'monto', dashed: 'Sin clasificar', dashedLabel: 'Estimado', format: { prefix: '$', suffix: ' M' } },
  },
];
