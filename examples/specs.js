// Galería de ejemplos. Todos los datos son ILUSTRATIVOS (no son cifras
// oficiales): sirven para mostrar cada tipo de gráfico.

const SRC = 'datos ilustrativos';

// ── Datos ──────────────────────────────────────────────────────────────────
export const ventasRegion = [
  { region: 'Biobío', ventas: 1240 },
  { region: 'Araucanía', ventas: 880 },
  { region: 'Ñuble', ventas: 610 },
  { region: 'Maule', ventas: 530 },
  { region: 'Los Ríos', ventas: 420 },
  { region: 'Los Lagos', ventas: 390 },
];

export const reclamos = [
  { servicio: 'Retraso en la entrega del pedido', casos: 412 },
  { servicio: 'Cobro duplicado en la tarjeta', casos: 268 },
  { servicio: 'Producto distinto al solicitado', casos: 201 },
  { servicio: 'Problemas para acceder a la cuenta', casos: 176 },
  { servicio: 'Atención telefónica sin respuesta', casos: 154 },
  { servicio: 'Devolución no procesada', casos: 120 },
  { servicio: 'Boleta o factura con errores', casos: 86 },
];

export const canales = [
  { año: 2022, canal: 'Tienda', ventas: 820 }, { año: 2022, canal: 'Online', ventas: 310 }, { año: 2022, canal: 'Mayorista', ventas: 260 },
  { año: 2023, canal: 'Tienda', ventas: 790 }, { año: 2023, canal: 'Online', ventas: 450 }, { año: 2023, canal: 'Mayorista', ventas: 280 },
  { año: 2024, canal: 'Tienda', ventas: 760 }, { año: 2024, canal: 'Online', ventas: 610 }, { año: 2024, canal: 'Mayorista', ventas: 300 },
  { año: 2025, canal: 'Tienda', ventas: 740 }, { año: 2025, canal: 'Online', ventas: 780 }, { año: 2025, canal: 'Mayorista', ventas: 310 },
];

export const mezclaRegion = ['Biobío', 'Araucanía', 'Ñuble', 'Maule', 'Los Ríos'].flatMap((r, i) => [
  { region: r, canal: 'Tienda', ventas: [520, 430, 330, 300, 250][i] },
  { region: r, canal: 'Online', ventas: [480, 250, 160, 120, 110][i] },
  { region: r, canal: 'Mayorista', ventas: [240, 200, 120, 110, 60][i] },
]);

const meses = [];
for (let y = 2022; y <= 2025; y++) for (let m = 1; m <= 12; m++) meses.push(`${y}-${String(m).padStart(2, '0')}`);
const ruido = (i, k) => Math.sin(i * 0.9 + k * 2.1) * 4 + Math.cos(i * 0.37 + k) * 3;
export const ventasMensuales = meses.flatMap((mes, i) => [
  { mes, region: 'Biobío', ventas: Math.round(118 + i * 0.55 + 9 * Math.sin((i / 12) * 2 * Math.PI) + ruido(i, 1)) },
  { mes, region: 'Araucanía', ventas: Math.round(86 + i * 0.35 + 7 * Math.sin((i / 12) * 2 * Math.PI) + ruido(i, 2)) },
  { mes, region: 'Ñuble', ventas: Math.round(46 + (i < 24 ? i * 0.3 : 7 + (i - 24) * 1.9) + 5 * Math.sin((i / 12) * 2 * Math.PI) + ruido(i, 3)) },
]);

export const empresa = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025].map((año, i) => ({
  año,
  ingresos: [1180, 1260, 1010, 1240, 1390, 1480, 1560, 1690][i],
  dotacion: [212, 220, 205, 208, 214, 219, 221, 226][i],
  clientes: [3100, 3400, 3350, 4100, 4900, 5600, 6300, 7400][i],
}));

export const flujoCaja = meses.slice(24).map((mes, i) => ({ mes, saldo: Math.round(420 + i * 18 + 40 * Math.sin(i / 2)) }));

export const paises = [
  ['Chile', 30.2, 90.2, 19.8, 'Sudamérica'], ['Perú', 16.0, 75.0, 34.0, 'Sudamérica'], ['Argentina', 27.0, 88.0, 46.0, 'Sudamérica'],
  ['Brasil', 20.5, 84.0, 216.0, 'Sudamérica'], ['Uruguay', 30.0, 90.0, 3.4, 'Sudamérica'], ['Colombia', 19.0, 73.0, 52.0, 'Sudamérica'],
  ['Bolivia', 10.0, 66.0, 12.4, 'Sudamérica'], ['Paraguay', 16.5, 77.0, 6.9, 'Sudamérica'], ['Ecuador', 14.0, 72.0, 18.0, 'Sudamérica'],
  ['México', 23.0, 79.0, 128.0, 'Norteamérica'], ['Estados Unidos', 80.0, 92.0, 335.0, 'Norteamérica'], ['Canadá', 60.0, 94.0, 40.0, 'Norteamérica'],
  ['España', 50.0, 95.0, 48.0, 'Europa'], ['Portugal', 45.0, 86.0, 10.4, 'Europa'], ['Alemania', 66.0, 93.0, 84.0, 'Europa'], ['Italia', 55.0, 87.0, 59.0, 'Europa'],
].map(([pais, pib, internet, poblacion, continente]) => ({ pais, pib, internet, poblacion, continente }));

export const exportaciones = [
  ['Minería', 'Cobre', 50.1], ['Minería', 'Litio', 6.2], ['Minería', 'Hierro', 2.4], ['Minería', 'Molibdeno', 3.1], ['Minería', 'Oro y plata', 1.9],
  ['Agro', 'Cerezas', 3.5], ['Agro', 'Uvas', 1.2], ['Agro', 'Arándanos', 0.8], ['Agro', 'Vino', 1.6], ['Agro', 'Manzanas', 0.6], ['Agro', 'Nueces', 0.5],
  ['Forestal', 'Celulosa', 3.0], ['Forestal', 'Madera aserrada', 1.8], ['Forestal', 'Tableros', 0.9],
  ['Pesca y acuicultura', 'Salmón', 6.5], ['Pesca y acuicultura', 'Choritos', 0.3], ['Pesca y acuicultura', 'Harina de pescado', 0.6],
  ['Industria', 'Químicos', 2.6], ['Industria', 'Alimentos procesados', 3.1], ['Industria', 'Metalmecánica', 1.0],
].map(([sector, producto, valor]) => ({ sector, producto, valor }));

export const presupuesto = [
  { area: 'Docencia', monto: 4200 }, { area: 'Investigación', monto: 2600 }, { area: 'Gestión', monto: 1200 }, { area: 'Vinculación', monto: 600 },
];

const dias = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
export const atenciones = dias.flatMap((dia, d) =>
  ['08', '10', '12', '14', '16', '18', '20'].map((h, k) => {
    const base = d < 5 ? 60 + 70 * Math.exp(-((k - 2) ** 2) / 3) + 40 * Math.exp(-((k - 5) ** 2) / 2) : 25 + 30 * Math.exp(-((k - 3) ** 2) / 4);
    return { dia, hora: `${h}:00`, atenciones: Math.round(base * (1 + (d === 0 ? 0.18 : d === 4 ? -0.08 : 0))) };
  })
);

export const flujoPresupuesto = [
  ['Aporte fiscal', 'Docencia', 2400], ['Aporte fiscal', 'Investigación', 900], ['Aporte fiscal', 'Gestión', 500],
  ['Aranceles', 'Docencia', 1800], ['Aranceles', 'Gestión', 500],
  ['Proyectos', 'Investigación', 1700], ['Proyectos', 'Vinculación', 400], ['Aranceles', 'Vinculación', 200], ['Proyectos', 'Gestión', 200],
  ['Docencia', 'Remuneraciones', 3100], ['Docencia', 'Operación', 1100],
  ['Investigación', 'Remuneraciones', 1300], ['Investigación', 'Equipamiento', 1300],
  ['Gestión', 'Remuneraciones', 800], ['Gestión', 'Operación', 400],
  ['Vinculación', 'Remuneraciones', 350], ['Vinculación', 'Operación', 250],
].map(([origen, destino, monto]) => ({ origen, destino, monto }));

// ── Especificaciones ───────────────────────────────────────────────────────
export const gallery = [
  {
    id: 'barras',
    name: 'Columnas',
    note: 'Pocas categorías cortas → columnas, ordenadas de mayor a menor, con el valor en la punta y sin eje (los valores ya están escritos).',
    spec: { type: 'bar', title: 'Biobío concentra el 30% de las ventas del sur', subtitle: 'Ventas por región, millones de pesos, 2025', source: SRC, data: ventasRegion, x: 'region', y: 'ventas' },
  },
  {
    id: 'barras-horizontales',
    name: 'Barras horizontales con foco',
    note: 'Etiquetas largas → barras horizontales automáticamente. `highlight` destaca una categoría y atenúa el resto.',
    spec: { type: 'bar', title: 'Casi tres de cada diez reclamos son por retrasos en la entrega', subtitle: 'Reclamos recibidos por motivo, enero a junio', source: SRC, data: reclamos, x: 'servicio', y: 'casos', highlight: 'Retraso en la entrega del pedido' },
  },
  {
    id: 'barras-agrupadas',
    name: 'Barras agrupadas',
    note: 'Una serie por color, en orden fijo. Con 2+ series la leyenda siempre está presente.',
    spec: { type: 'bar', title: 'En 2025 el canal online superó por primera vez a la tienda', subtitle: 'Ventas por canal, millones de pesos', source: SRC, data: canales, x: 'año', y: 'ventas', series: 'canal' },
  },
  {
    id: 'barras-100',
    name: 'Apiladas al 100%',
    note: '`stack: "percent"` compara composición. Las cifras van dentro del segmento solo si caben.',
    spec: { type: 'bar', title: 'En Biobío casi 4 de cada 10 pesos se venden online', subtitle: 'Participación de cada canal en las ventas regionales', source: SRC, data: mezclaRegion, x: 'region', y: 'ventas', series: 'canal', stack: 'percent', horizontal: true },
  },
  {
    id: 'lineas',
    name: 'Líneas con anotación',
    note: 'Fechas "YYYY-MM" se detectan solas. Etiquetas directas al final de cada línea y anotaciones de eventos.',
    spec: { type: 'line', title: 'Ñuble acelera desde la apertura de su nueva sucursal', subtitle: 'Ventas mensuales por región, millones de pesos', source: SRC, data: ventasMensuales, x: 'mes', y: 'ventas', series: 'region', annotations: [{ x: '2024-01', label: 'Nueva sucursal en Chillán' }] },
  },
  {
    id: 'indice',
    name: 'Índice base 100 (sin doble eje)',
    note: 'Medidas de escalas distintas no van en dos ejes: `index: true` las lleva a base 100 y se comparan crecimientos.',
    spec: { type: 'line', title: 'Los clientes crecieron 2,4 veces; la dotación, solo 7%', subtitle: 'Índice 2018 = 100', source: SRC, data: empresa, x: 'año', y: ['clientes', 'ingresos', 'dotacion'], labelsFor: { dotacion: 'Dotación' }, index: true, refLines: [{ y: 100, label: 'Base' }] },
  },
  {
    id: 'area-meta',
    name: 'Área con meta',
    note: 'Área de un solo tono a 12% de opacidad y una línea de referencia (meta, promedio, umbral).',
    spec: { type: 'area', title: 'El saldo de caja superó la meta en enero de 2025', subtitle: 'Saldo de caja a fin de mes, millones de pesos', source: SRC, data: flujoCaja, x: 'mes', y: 'saldo', refLines: [{ y: 600, label: 'Meta' }] },
  },
  {
    id: 'area-apilada',
    name: 'Áreas apiladas',
    note: 'Con `series`, el área se apila. `curve: "smooth"` usa una curva monótona que no inventa picos.',
    spec: { type: 'area', title: 'Las ventas del sur crecieron 28% entre 2022 y 2025', subtitle: 'Ventas mensuales por región, millones de pesos', source: SRC, data: ventasMensuales, x: 'mes', y: 'ventas', series: 'region', curve: 'smooth' },
  },
  {
    id: 'burbujas',
    name: 'Burbujas con tendencia',
    note: 'Tamaño = área proporcional a la población. Rotula solo los puntos que importan y agrega la recta de tendencia con R².',
    spec: { type: 'bubble', title: 'A mayor ingreso por persona, mayor uso de internet', subtitle: 'PIB per cápita (miles de US$ PPA) y % de la población que usa internet', source: SRC, data: paises, x: 'pib', y: 'internet', size: 'poblacion', series: 'continente', label: 'pais', labels: ['Chile', 'Estados Unidos', 'Brasil', 'Alemania', 'Bolivia', 'México'], xLabel: 'PIB per cápita (miles US$)', yLabel: 'Usuarios de internet (%)', trend: true },
  },
  {
    id: 'treemap',
    name: 'Treemap',
    note: 'Partes de un todo con jerarquía, al estilo del Atlas de Complejidad Económica. Color por sector y participación en cada rectángulo.',
    spec: { type: 'treemap', title: 'El cobre explica más de la mitad de las exportaciones', subtitle: 'Exportaciones por sector y producto, miles de millones de US$', source: SRC, data: exportaciones, path: ['sector', 'producto'], value: 'valor' },
  },
  {
    id: 'dona',
    name: 'Dona',
    note: 'Parte-todo de un vistazo con 6 segmentos como máximo. La leyenda es una tabla: la identidad nunca depende solo del color.',
    spec: { type: 'donut', title: 'Docencia se lleva casi la mitad del presupuesto', subtitle: 'Presupuesto 2025 por área, millones de pesos', source: SRC, data: presupuesto, label: 'area', value: 'monto', format: 'currency' },
  },
  {
    id: 'calor',
    name: 'Mapa de calor',
    note: 'Rampa secuencial de un solo tono. Los valores se escriben en la celda cuando caben, en blanco o tinta según el contraste.',
    spec: { type: 'heatmap', title: 'Los lunes a mediodía se concentra la demanda de atención', subtitle: 'Atenciones promedio por día y hora', source: SRC, data: atenciones, x: 'hora', y: 'dia', value: 'atenciones' },
  },
  {
    id: 'sankey',
    name: 'Sankey',
    note: 'Flujos entre etapas. El color nace en el origen y se hereda aguas abajo.',
    spec: { type: 'sankey', title: 'Casi dos de cada tres pesos terminan en remuneraciones', subtitle: 'Fuentes, áreas y destino del gasto, millones de pesos', source: SRC, data: flujoPresupuesto, from: 'origen', to: 'destino', value: 'monto', height: 460 },
  },
  {
    id: 'kpi',
    name: 'Indicadores (KPI)',
    note: 'Cuando la historia es un número, el número es el gráfico. Variación con flecha + texto, tendencia y meta.',
    spec: {
      type: 'kpi', title: 'El trimestre cierra con ventas 12% sobre el año anterior', source: SRC,
      items: [
        { label: 'Ventas', value: 1250000000, format: 'currency', delta: 0.124, period: 'vs T3 2025', trend: [8.1, 8.6, 8.4, 9.8, 10.9, 12.5] },
        { label: 'Clientes activos', value: 8420, delta: -0.032, period: 'vs T3 2025', trend: [9, 8.9, 8.7, 8.6, 8.5, 8.4] },
        { label: 'Costo por cliente', value: 18500, format: 'currency', delta: -0.08, good: 'down', period: 'vs T3 2025' },
        { label: 'Satisfacción (NPS)', value: 62, target: 70, delta: 0.05, period: 'vs T3 2025' },
      ],
    },
  },
  {
    id: 'noche',
    name: 'Tema noche + foco',
    note: '`theme: "noche"` usa la misma paleta, re-escalonada y validada para fondo oscuro. `highlight` atenúa el resto.',
    spec: { type: 'line', theme: 'noche', title: 'Ñuble creció 60% en dos años, el triple que Biobío', subtitle: 'Ventas mensuales por región, millones de pesos', source: SRC, data: ventasMensuales, x: 'mes', y: 'ventas', series: 'region', highlight: 'Ñuble' },
  },
];
