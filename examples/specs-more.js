// Ejemplos de tiempo (slider), facetas, escala log, bandas e intervalos de
// confianza y temas JSON. Datos ILUSTRATIVOS, deterministas.
import { ventasMensuales, exportaciones } from './specs.js';

const SRC = 'datos ilustrativos';

// Generador pseudoaleatorio con semilla (LCG + Box-Muller).
function rng(seed) {
  let s = seed % 2147483647 || 1;
  const u = () => (s = (s * 16807) % 2147483647) / 2147483647;
  return { u, n: () => Math.sqrt(-2 * Math.log(u())) * Math.cos(2 * Math.PI * u()) };
}

// Exportaciones por año (2018–2025): minería cae en participación.
export const exportacionesAnuales = [];
for (let y = 2018; y <= 2025; y++) {
  for (const r of exportaciones) {
    const k = y - 2025;
    const trend = r.sector === 'Minería' ? -0.035 : r.producto === 'Cerezas' ? 0.12 : r.producto === 'Litio' ? 0.22 : 0.03;
    exportacionesAnuales.push({ año: y, sector: r.sector, producto: r.producto, valor: +(r.valor * Math.exp(trend * k)).toFixed(2) });
  }
}
const cobre = (y) => exportacionesAnuales.filter((r) => r.año === y && r.producto === 'Cobre')[0].valor;
const totalAño = (y) => exportacionesAnuales.filter((r) => r.año === y).reduce((a, r) => a + r.valor, 0);
const shareCobre = (y) => Math.round((cobre(y) / totalAño(y)) * 100);

// Usuarios de una app (crecimiento exponencial) para la escala log.
const R1 = rng(11);
export const usuarios = [];
for (let m = 0; m < 48; m++) {
  const mes = `${2022 + Math.floor(m / 12)}-${String((m % 12) + 1).padStart(2, '0')}`;
  usuarios.push({ mes, plataforma: 'App móvil', usuarios: Math.round(800 * Math.exp(0.105 * m) * (1 + 0.06 * R1.n())) });
  usuarios.push({ mes, plataforma: 'Sitio web', usuarios: Math.round(5200 * Math.exp(0.035 * m) * (1 + 0.05 * R1.n())) });
}
const appX = Math.round(usuarios.filter((r) => r.plataforma === 'App móvil').at(-1).usuarios / usuarios.filter((r) => r.plataforma === 'App móvil')[0].usuarios);

// Tiempos de espera por hora (muchas observaciones por hora → banda de confianza).
const R2 = rng(5);
export const esperas = [];
for (let h = 8; h <= 20; h++) for (let k = 0; k < 25; k++) {
  esperas.push({ hora: h, dia: 'Laboral', minutos: Math.max(1, 10 + 9 * Math.exp(-((h - 10) ** 2) / 4) + 11 * Math.exp(-((h - 18) ** 2) / 3) + 4 * R2.n()) });
  esperas.push({ hora: h, dia: 'Fin de semana', minutos: Math.max(1, 8 + 6 * Math.exp(-((h - 13) ** 2) / 8) + 3 * R2.n()) });
}

// Encuesta de satisfacción por sede (para barplot con IC y countplot).
const R3 = rng(23);
const sedes = ['Concepción', 'Talcahuano', 'Chillán', 'Los Ángeles'];
export const encuesta = [];
sedes.forEach((s, i) => {
  for (let k = 0; k < 60 - i * 8; k++) {
    const canal = k % 3 === 0 ? 'Teléfono' : 'Presencial';
    encuesta.push({ sede: s, canal, nota: Math.max(1, Math.min(7, 5.6 - i * 0.35 + (canal === 'Teléfono' ? -0.4 : 0) + 0.9 * R3.n())) });
  }
});
const meanBy = (s) => { const v = encuesta.filter((r) => r.sede === s).map((r) => r.nota); return v.reduce((a, b) => a + b, 0) / v.length; };
const fmt1 = (v) => v.toFixed(1).replace('.', ',');

const ultimo = ventasMensuales.filter((r) => r.mes === '2025-12');

export const moreGallery = [
  {
    id: 'slider-rango',
    section: 'Tiempo',
    name: 'Slider de rango',
    note: 'En series de tiempo, render() agrega un slider con la vista general debajo: arrastra los extremos para acercarte a un periodo. Sin configuración (`slider: false` lo quita).',
    spec: { type: 'line', title: 'Biobío sigue liderando, pero Ñuble acorta la distancia', subtitle: 'Ventas mensuales por región, millones de pesos', source: SRC, data: ventasMensuales, x: 'mes', y: 'ventas', series: 'region' },
  },
  {
    id: 'slider-periodo',
    section: 'Tiempo',
    name: 'Periodo con play (estilo d3plus)',
    note: '`time: "año"` muestra un año a la vez con un slider y botón de reproducir. Funciona con treemap, barras, dona, dispersión, radar y más.',
    spec: { type: 'treemap', title: `El cobre bajó de ${shareCobre(2018)}% a ${shareCobre(2025)}% de las exportaciones`, subtitle: 'Exportaciones por sector y producto, miles de millones de US$', source: SRC, data: exportacionesAnuales, path: ['sector', 'producto'], value: 'valor', time: 'año' },
  },
  {
    id: 'facetas',
    section: 'Tiempo',
    name: 'Paneles (facet)',
    note: '`facet: "region"` hace un panel por región con la misma escala y los mismos colores (col / col_wrap de seaborn). Mejor que muchas líneas enredadas.',
    spec: { type: 'area', title: 'Las tres regiones crecen, Ñuble desde una base menor', subtitle: 'Ventas mensuales, millones de pesos', source: SRC, data: ventasMensuales, x: 'mes', y: 'ventas', facet: 'region', columns: 3 },
  },
  {
    id: 'log',
    section: 'Tiempo',
    name: 'Escala logarítmica',
    note: '`yScale: "log"`: crecimientos exponenciales se ven como rectas y se comparan tasas, no niveles. Marcas 1-2-5 sin décadas vacías.',
    spec: { type: 'line', title: `Los usuarios de la app se multiplicaron por ${appX} en cuatro años`, subtitle: 'Usuarios activos mensuales, escala logarítmica', source: SRC, data: usuarios, x: 'mes', y: 'usuarios', series: 'plataforma', yScale: 'log' },
  },
  {
    id: 'banda',
    section: 'Distribuciones',
    name: 'Línea con banda de confianza',
    note: '`ci: true` (seaborn lineplot): con varias observaciones por x, dibuja la media y su intervalo de 95%. También `errorbar: "sd"`.',
    spec: { type: 'line', title: 'Entre semana la espera tiene dos peaks: 10:00 y 18:00', subtitle: 'Minutos de espera promedio por hora, con intervalo de confianza de 95%', source: SRC, data: esperas, x: 'hora', y: 'minutos', series: 'dia', ci: true, xLabel: 'Hora del día' },
  },
  {
    id: 'barplot',
    section: 'Distribuciones',
    name: 'Barplot con intervalo',
    note: '`type: "barplot"` (o `ci: true`): media por categoría con barras de error. El tooltip muestra el intervalo.',
    spec: { type: 'barplot', title: `Concepción tiene la mejor nota de satisfacción: ${fmt1(meanBy('Concepción'))}`, subtitle: 'Nota promedio (1 a 7) por sede y canal, intervalo de 95%', source: SRC, data: encuesta, x: 'sede', y: 'nota', series: 'canal', sort: 'none' },
  },
  {
    id: 'countplot',
    section: 'Comparar',
    name: 'Countplot',
    note: '`type: "countplot"` cuenta filas por categoría, sin agregar antes.',
    spec: { type: 'countplot', title: `Concepción concentra ${encuesta.filter((r) => r.sede === 'Concepción').length} de ${encuesta.length} respuestas`, subtitle: 'Respuestas de la encuesta por sede', source: SRC, data: encuesta, x: 'sede' },
  },
  {
    id: 'tema-json',
    section: 'Configuración',
    name: 'Tema 100% JSON',
    note: 'Colores, tipografía, grosor de líneas, radios y ejes se configuran con un objeto JSON. `palette` acepta un nombre ("okabe-ito", "tableau10", "udec") o una lista de colores; `validatePalette()` la revisa.',
    spec: {
      type: 'bar', title: 'Biobío y Araucanía suman la mitad de las ventas del sur', subtitle: 'Ventas por región y canal, 2025', source: SRC,
      data: ultimo.flatMap((r) => [{ region: r.region, canal: 'Tienda', ventas: Math.round(r.ventas * 0.6) }, { region: r.region, canal: 'Online', ventas: Math.round(r.ventas * 0.4) }]),
      x: 'region', y: 'ventas', series: 'canal', stack: true,
      theme: { extends: 'papel', categorical: 'okabe-ito', surface: '#FFFFFF', type: { title: 22, titleWeight: 700 }, marks: { barRadius: 8, barMax: 44 } },
    },
  },
];
