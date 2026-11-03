// Galería de gráficos categóricos (seaborn) y radar. Datos ILUSTRATIVOS
// generados con una semilla fija: los títulos se calculan desde los datos.
import { median, mean } from '../src/stats.js';

const SRC = 'datos ilustrativos';

function rng(seed) {
  let a = seed >>> 0;
  const u = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const normal = () => Math.sqrt(-2 * Math.log(u() || 1e-12)) * Math.cos(2 * Math.PI * u());
  return { u, normal };
}
const fmt1 = (v) => v.toFixed(1).replace('.', ',');
const by = (rows, k) => rows.reduce((m, r) => ((m[r[k]] ||= []).push(r), m), {});

// ── Tiempos de espera por CESFAM (log-normal) ──
const R1 = rng(11);
const centros = [['CESFAM Lorenzo Arenas', 34], ['CESFAM Tucapel', 27], ['CESFAM Santa Sabina', 41], ['CESFAM Pedro de Valdivia', 22], ['CESFAM Juan Soto Fernández', 30]];
export const esperas = centros.flatMap(([centro, med]) => Array.from({ length: 70 }, () => ({ centro, minutos: Math.round(med * Math.exp(0.42 * R1.normal())) })));
const espMed = Object.entries(by(esperas, 'centro')).map(([c, rs]) => [c, median(rs.map((r) => r.minutos))]).sort((a, b) => b[1] - a[1]);

// ── Sueldos por cargo y sector (violín dividido) ──
const R2 = rng(23);
const cargos = [['Analista', 1.35], ['Jefatura', 2.3], ['Gerencia', 4.1]];
export const sueldos = cargos.flatMap(([cargo, base]) => ['Público', 'Privado'].flatMap((sector) => Array.from({ length: 90 }, () => ({ cargo, sector, sueldo: +(base * (sector === 'Privado' ? 1.18 : 1) * Math.exp(0.22 * R2.normal())).toFixed(2) }))));
const gerPriv = median(sueldos.filter((r) => r.cargo === 'Gerencia' && r.sector === 'Privado').map((r) => r.sueldo));
const gerPub = median(sueldos.filter((r) => r.cargo === 'Gerencia' && r.sector === 'Público').map((r) => r.sueldo));
const gap = Math.round((gerPriv / gerPub - 1) * 100);

// ── Notas por sección (strip con promedio) ──
const R3 = rng(37);
const secciones = [['Sección 1', 5.1], ['Sección 2', 4.6], ['Sección 3', 5.5], ['Sección 4', 4.9]];
export const notas = secciones.flatMap(([seccion, mu]) => Array.from({ length: 45 }, () => ({ seccion, nota: +Math.max(1, Math.min(7, mu + 0.75 * R3.normal())).toFixed(1) })));
const notaMean = Object.entries(by(notas, 'seccion')).map(([s, rs]) => [s, mean(rs.map((r) => r.nota))]).sort((a, b) => b[1] - a[1]);
const aprob = Math.round((notas.filter((r) => r.nota >= 4).length / notas.length) * 100);

// ── Días de tramitación por región (enjambre) ──
const R4 = rng(41);
const regiones = [['Biobío', 38], ['Ñuble', 46], ['Araucanía', 52], ['Maule', 43]];
export const tramites = regiones.flatMap(([region, mu]) => Array.from({ length: 55 }, () => ({ region, dias: Math.max(5, Math.round(mu + 12 * R4.normal())) })));
const tramMed = Object.entries(by(tramites, 'region')).map(([r, rs]) => [r, median(rs.map((x) => x.dias))]).sort((a, b) => a[1] - b[1]);

// ── Satisfacción por trimestre y sede (point) ──
const R5 = rng(53);
const sedes = [['Concepción', [5.3, 5.5, 5.6, 5.9]], ['Chillán', [5.0, 5.0, 5.2, 5.3]], ['Los Ángeles', [5.6, 5.4, 5.2, 5.0]]];
export const encuestas = sedes.flatMap(([sede, mus]) => ['T1', 'T2', 'T3', 'T4'].flatMap((t, i) => Array.from({ length: 60 }, () => ({ trimestre: t, sede, nota: +Math.max(1, Math.min(7, mus[i] + 0.9 * R5.normal())).toFixed(1) }))));
const satMean = (sede, t) => mean(encuestas.filter((r) => r.sede === sede && r.trimestre === t).map((r) => r.nota));
const conT1 = satMean('Concepción', 'T1'), conT4 = satMean('Concepción', 'T4');
const laT1 = satMean('Los Ángeles', 'T1'), laT4 = satMean('Los Ángeles', 'T4');

// ── Montos adjudicados (escala log) ──
const R6 = rng(67);
const tipos = [['Trato directo', 4.2], ['Licitación L1', 5.6], ['Licitación LE', 6.9], ['Licitación LP', 8.0], ['Convenio marco', 5.0]];
export const montos = tipos.flatMap(([tipo, mu]) => Array.from({ length: 50 }, () => ({ tipo, monto: Math.round(10 ** (mu + 0.45 * R6.normal())) })));
const lpMed = median(montos.filter((r) => r.tipo === 'Licitación LP').map((r) => r.monto));
const tdMed = median(montos.filter((r) => r.tipo === 'Trato directo').map((r) => r.monto));
const veces = Math.round(lpMed / tdMed / 100) * 100;

// ── Competencias de dos candidaturas (radar) ──
export const competencias = [
  ['Liderazgo', 4.5, 3.2], ['Análisis de datos', 3.1, 4.7], ['Comunicación', 4.3, 3.6],
  ['Gestión de proyectos', 4.0, 3.9], ['Negociación', 4.4, 2.8], ['Conocimiento técnico', 3.0, 4.6],
].flatMap(([competencia, a, b]) => [{ competencia, candidatura: 'Candidatura A', puntaje: a }, { competencia, candidatura: 'Candidatura B', puntaje: b }]);

export const catGallery = [
  {
    id: 'caja',
    name: 'Diagrama de caja',
    note: 'Mediana, cuartiles y bigotes a 1,5 veces el rango intercuartílico; los atípicos van como puntos huecos. Etiquetas largas → horizontal automático.',
    spec: { type: 'box', title: `En ${espMed[0][0]} la espera mediana es de ${espMed[0][1]} minutos, la más alta de la comuna`, subtitle: 'Minutos de espera para atención, 70 pacientes por centro', source: SRC, data: esperas, x: 'centro', y: 'minutos', highlight: espMed[0][0], xLabel: 'Minutos de espera' },
  },
  {
    id: 'violin',
    name: 'Violín dividido',
    note: 'Densidad de cada grupo (KDE) espejada. Con dos niveles de `hue` y `split: true`, cada mitad es un grupo; adentro, rango intercuartílico y mediana.',
    spec: { type: 'violin', title: `En gerencia, el sector privado paga ${gap}% más en la mediana`, subtitle: 'Sueldo bruto mensual, millones de pesos', source: SRC, data: sueldos, x: 'cargo', y: 'sueldo', hue: 'sector', split: true, yScale: 'log', yLabel: 'Millones de pesos (escala log)' },
  },
  {
    id: 'strip',
    name: 'Puntos por categoría',
    note: 'Cada estudiante es un punto con dispersión lateral determinista; la barra marca el promedio de la sección.',
    spec: { type: 'strip', title: `La ${notaMean[0][0]} tiene el mejor promedio (${fmt1(notaMean[0][1])}); en total aprueba el ${aprob}% del curso`, subtitle: 'Notas finales en escala de 1 a 7', source: SRC, data: notas, x: 'seccion', y: 'nota', mean: true, refLines: [{ y: 4, label: 'Aprobación' }], yDomain: [1, 7], yLabel: 'Nota' },
  },
  {
    id: 'swarm',
    name: 'Enjambre',
    note: 'Sin traslapes: cada punto se corre lo mínimo para no tocar a los demás, así la forma muestra la distribución.',
    spec: { type: 'swarm', title: `${tramMed[0][0]} resuelve sus trámites en ${tramMed[0][1]} días en la mediana, el más rápido`, subtitle: 'Días hábiles desde el ingreso hasta la resolución', source: SRC, data: tramites, x: 'region', y: 'dias', highlight: tramMed[0][0], yLabel: 'Días' },
  },
  {
    id: 'point',
    name: 'Estimación con intervalo',
    note: 'Promedio con intervalo de confianza del 95% (t de Student), unido por sede. Etiquetas al final de cada serie.',
    spec: { type: 'point', title: `Concepción sube de ${fmt1(conT1)} a ${fmt1(conT4)} en el año y Los Ángeles baja a ${fmt1(laT4)}`, subtitle: 'Satisfacción promedio (1 a 7) con intervalo de confianza del 95%', source: SRC, data: encuestas, x: 'trimestre', y: 'nota', hue: 'sede', yLabel: 'Satisfacción promedio' },
  },
  {
    id: 'caja-log',
    name: 'Caja en escala logarítmica',
    note: 'Montos que abarcan varios órdenes de magnitud: `xScale: "log"` en el eje de valores y puntos encima de cada caja.',
    spec: { type: 'box', title: `La mediana de una licitación LP es unas ${veces.toLocaleString('es-CL')} veces la de un trato directo`, subtitle: 'Montos adjudicados por modalidad de compra, pesos', source: SRC, data: montos, x: 'monto', y: 'tipo', xScale: 'log', points: true, format: 'currency', xLabel: 'Monto adjudicado (escala log)' },
  },
  {
    id: 'radar',
    name: 'Radar',
    note: 'Perfil de dos series en ejes comparables (misma escala 1–5). Polígonos finos con relleno suave; las etiquetas se anclan según el ángulo.',
    spec: { type: 'radar', title: 'La candidatura A destaca en liderazgo y la B en análisis de datos', subtitle: 'Puntaje de la evaluación por competencias, escala 1 a 5', source: SRC, data: competencias, axis: 'competencia', value: 'puntaje', series: 'candidatura', domain: [0, 5] },
  },
];
