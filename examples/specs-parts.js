// Galería de partes de un todo: treemap de varios niveles, sunburst, torta
// y dona. Todos los datos son ILUSTRATIVOS.

const SRC = 'datos ilustrativos';

export const exportaciones3 = [
  ['Minería', 'Metálica', 'Cobre', 50.1], ['Minería', 'Metálica', 'Molibdeno', 3.1], ['Minería', 'Metálica', 'Hierro', 2.4],
  ['Minería', 'Metálica', 'Oro', 1.2], ['Minería', 'Metálica', 'Plata', 0.7],
  ['Minería', 'No metálica', 'Litio', 6.2], ['Minería', 'No metálica', 'Yodo', 1.1], ['Minería', 'No metálica', 'Sal', 0.3],
  ['Agro', 'Fruta fresca', 'Cerezas', 3.5], ['Agro', 'Fruta fresca', 'Uvas', 1.2], ['Agro', 'Fruta fresca', 'Arándanos', 0.8], ['Agro', 'Fruta fresca', 'Manzanas', 0.6],
  ['Agro', 'Vinos y bebidas', 'Vino', 1.6], ['Agro', 'Vinos y bebidas', 'Pisco', 0.1],
  ['Agro', 'Frutos secos', 'Nueces', 0.5], ['Agro', 'Frutos secos', 'Almendras', 0.1],
  ['Acuicultura', 'Salmónidos', 'Salmón', 6.5], ['Acuicultura', 'Salmónidos', 'Trucha', 0.4], ['Acuicultura', 'Moluscos', 'Choritos', 0.3],
  ['Industria', 'Alimentos', 'Alimentos procesados', 3.1], ['Industria', 'Química', 'Químicos', 2.6], ['Industria', 'Metalmecánica', 'Maquinaria', 1.0],
  ['Forestal', 'Celulosa', 'Celulosa', 3.0], ['Forestal', 'Madera', 'Madera aserrada', 1.8], ['Forestal', 'Madera', 'Tableros', 0.9],
].map(([sector, subsector, producto, valor]) => ({ sector, subsector, producto, valor }));

export const presupuesto3 = [
  ['Docencia', 'Pregrado', 'Remuneraciones', 2100], ['Docencia', 'Pregrado', 'Operación', 520], ['Docencia', 'Pregrado', 'Becas', 380],
  ['Docencia', 'Postgrado', 'Remuneraciones', 640], ['Docencia', 'Postgrado', 'Operación', 180], ['Docencia', 'Postgrado', 'Becas', 380],
  ['Investigación', 'Proyectos', 'Remuneraciones', 900], ['Investigación', 'Proyectos', 'Equipamiento', 700], ['Investigación', 'Proyectos', 'Operación', 300],
  ['Investigación', 'Centros', 'Remuneraciones', 400], ['Investigación', 'Centros', 'Equipamiento', 300],
  ['Gestión', 'Administración', 'Remuneraciones', 620], ['Gestión', 'Administración', 'Operación', 280],
  ['Gestión', 'Tecnología', 'Licencias', 180], ['Gestión', 'Tecnología', 'Equipamiento', 120],
  ['Vinculación', 'Extensión', 'Remuneraciones', 210], ['Vinculación', 'Extensión', 'Operación', 140],
  ['Vinculación', 'Educación continua', 'Remuneraciones', 160], ['Vinculación', 'Educación continua', 'Operación', 90],
].map(([area, unidad, item, monto]) => ({ area, unidad, item, monto }));

export const matriz = [
  { fuente: 'Hidroeléctrica', gwh: 27 }, { fuente: 'Solar', gwh: 22 }, { fuente: 'Gas natural', gwh: 18 },
  { fuente: 'Carbón', gwh: 15 }, { fuente: 'Eólica', gwh: 11 }, { fuente: 'Otras', gwh: 7 },
];

export const presupuesto = [
  { area: 'Docencia', monto: 4200 }, { area: 'Investigación', monto: 2600 }, { area: 'Gestión', monto: 1200 },
  { area: 'Vinculación', monto: 600 }, { area: 'Infraestructura', monto: 450 }, { area: 'Bienestar', monto: 300 },
];

export const canales = [
  { canal: 'Online', ventas: 780 }, { canal: 'Tienda', ventas: 740 }, { canal: 'Mayorista', ventas: 310 },
];

export const partsGallery = [
  {
    id: 'treemap-niveles',
    name: 'Treemap de tres niveles',
    note: 'Sector › subsector › producto con `path`. Áreas exactas (sin bandas de encabezado), un color sólido por sector, más espacio entre sectores que dentro de ellos y la participación de cada uno en la leyenda.',
    spec: { type: 'treemap', title: 'El cobre por sí solo explica el 54% de las exportaciones', subtitle: 'Exportaciones por sector, subsector y producto, miles de millones de US$', source: SRC, data: exportaciones3, path: ['sector', 'subsector', 'producto'], value: 'valor' },
  },
  {
    id: 'treemap-foco',
    name: 'Treemap con foco (drill-down)',
    note: '`focus: ["Agro"]` muestra solo esa rama, con migas de pan para volver. En el navegador, un clic en un grupo hace lo mismo.',
    spec: { type: 'treemap', title: 'Dentro del agro, la fruta fresca suma el 73%', subtitle: 'Exportaciones agropecuarias por subsector y producto, miles de millones de US$', source: SRC, data: exportaciones3, path: ['sector', 'subsector', 'producto'], value: 'valor', focus: ['Agro'] },
  },
  {
    id: 'sunburst',
    name: 'Sunburst',
    note: 'La misma jerarquía en anillos: el interior es el primer nivel; los exteriores heredan el color. Total al centro.',
    spec: { type: 'sunburst', title: 'Docencia concentra el 49% del presupuesto', subtitle: 'Presupuesto por área, unidad e ítem, millones de pesos', source: SRC, data: presupuesto3, path: ['area', 'unidad', 'item'], value: 'monto', format: 'currency' },
  },
  {
    id: 'torta',
    name: 'Torta',
    note: 'Porcentajes dentro de cada porción y tabla-leyenda al lado. Seis partes como máximo.',
    spec: { type: 'pie', title: 'Hidroeléctrica y solar generan casi la mitad de la electricidad', subtitle: 'Generación eléctrica por fuente, % del total anual', source: SRC, data: matriz, label: 'fuente', value: 'gwh' },
  },
  {
    id: 'dona-exterior',
    name: 'Dona con etiquetas exteriores',
    note: '`labels: "outside"` pone nombre y porcentaje afuera, con líneas guía que nunca chocan.',
    spec: { type: 'donut', title: 'Docencia e investigación suman el 73% del presupuesto', subtitle: 'Presupuesto 2025 por área, millones de pesos', source: SRC, data: presupuesto, label: 'area', value: 'monto', format: 'currency', labels: 'outside' },
  },
  {
    id: 'media-dona',
    name: 'Media dona',
    note: '`half: true` dibuja un semicírculo con el total en la base. Útil para composiciones simples en poco alto.',
    spec: { type: 'donut', half: true, title: 'El canal online ya vende más que la tienda', subtitle: 'Ventas 2025 por canal, millones de pesos', source: SRC, data: canales, label: 'canal', value: 'ventas', format: 'currency' },
  },
];
