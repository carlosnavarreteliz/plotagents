// Galería de gráficos estadísticos (estilo seaborn). Datos ILUSTRATIVOS
// generados con semilla fija: los títulos se calculan desde los propios datos.
import { quantile, mean, median, polyfit } from '../src/stats.js';
import { formatNumber } from '../src/format.js';
import { correlations } from '../src/charts/corr.js';

const SRC = 'datos ilustrativos';

// ── Generador determinista ─────────────────────────────────────────────────
function rng(seed) {
  let a = seed >>> 0;
  const u = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const n = () => Math.sqrt(-2 * Math.log(u() || 1e-12)) * Math.cos(2 * Math.PI * u());
  return { u, n };
}
const r1 = (v, d = 1) => Math.round(v * 10 ** d) / 10 ** d;
const fmt = (v, d = 1) => formatNumber(v, d, 'es', true);
const sorted = (a) => [...a].sort((x, y) => x - y);

// 1 · Tiempos de atención (lognormal)
const R1 = rng(11);
export const atencion = Array.from({ length: 600 }, () => ({ minutos: r1(Math.exp(2.2 + 0.45 * R1.n()), 1) }));
const medAt = median(atencion.map((r) => r.minutos));

// 2 · Notas por modalidad (escala chilena 1,0–7,0)
const R2 = rng(22);
const nota = (m) => Math.min(7, Math.max(1, r1(m + 0.75 * R2.n(), 1)));
export const notas = [
  ...Array.from({ length: 320 }, () => ({ modalidad: 'Presencial', nota: nota(5.3) })),
  ...Array.from({ length: 280 }, () => ({ modalidad: 'En línea', nota: nota(4.8) })),
];
const mPres = mean(notas.filter((r) => r.modalidad === 'Presencial').map((r) => r.nota));
const mLin = mean(notas.filter((r) => r.modalidad === 'En línea').map((r) => r.nota));

// 3 · Salarios por área (miles de pesos, lognormal)
const R3 = rng(33);
const areas = [['Operaciones', 6.75, 0.28, 260], ['Administración', 6.95, 0.3, 180], ['Tecnología', 7.35, 0.32, 140]];
export const salarios = areas.flatMap(([area, mu, s, n]) => Array.from({ length: n }, () => ({ area, sueldo: Math.round(Math.exp(mu + s * R3.n())) })));
const medSal = Object.fromEntries(areas.map(([a]) => [a, median(salarios.filter((r) => r.area === a).map((r) => r.sueldo))]));
const topArea = Object.entries(medSal).sort((a, b) => b[1] - a[1])[0];

// 4 · Días de despacho por región
const R4 = rng(44);
const regiones = [['Biobío', 1.2, 0.45], ['Ñuble', 1.45, 0.5], ['Araucanía', 1.65, 0.55]];
export const despachos = regiones.flatMap(([region, mu, s]) => Array.from({ length: 220 }, () => ({ region, dias: r1(Math.exp(mu + s * R4.n()), 1) })));
const p80 = Object.fromEntries(regiones.map(([r]) => [r, quantile(sorted(despachos.filter((d) => d.region === r).map((d) => d.dias)), 0.8)]));

// 5 · Horas de estudio vs nota
const R5 = rng(55);
export const estudio = Array.from({ length: 140 }, () => {
  const horas = r1(Math.max(0, 2 + 10 * R5.u() + 1.5 * R5.n()), 1);
  return { horas, nota: Math.min(7, Math.max(1, r1(3.4 + 0.27 * horas + 0.55 * R5.n(), 1))) };
});
const fitEst = polyfit(estudio.map((r) => r.horas), estudio.map((r) => r.nota));
const slopeEst = fitEst.coef[1];

// 6 · Ingreso per cápita (log) vs esperanza de vida, tres regiones del mundo
const R6 = rng(66);
const reg6 = [['América', 3.9, 0.3], ['Europa', 4.45, 0.22], ['Asia', 3.85, 0.45]];
export const paisesSint = reg6.flatMap(([region, mu, s]) => Array.from({ length: 24 }, () => {
  const lx = mu + s * R6.n();
  return { region, ingreso: Math.round(10 ** lx), vida: r1(46 + 8.2 * lx + 1.8 * R6.n(), 1) };
}));
const fitVida = polyfit(paisesSint.map((r) => Math.log10(r.ingreso)), paisesSint.map((r) => r.vida));
const dupl = fitVida.coef[1] * Math.log10(2);

// 7 · Superficie vs precio de departamentos
const R7 = rng(77);
export const deptos = Array.from({ length: 260 }, () => {
  const m2 = Math.round(Math.max(28, 38 + 70 * R7.u() ** 1.3 + 6 * R7.n()));
  return { m2, uf: Math.round(Math.max(900, 420 + 46 * m2 + 380 * R7.n())) };
});
const fitDep = polyfit(deptos.map((r) => r.m2), deptos.map((r) => r.uf));

// 8 · Indicadores de 120 barrios: dos factores latentes (nivel socioeconómico y densidad urbana)
const R8 = rng(88);
const zonas8 = [['Centro', 0.5, 0.9], ['Oriente', 1.0, 0.1], ['Periferia', -0.9, -0.6]];
export const barrios = Array.from({ length: 120 }, (_, i) => {
  const [zona, s0, u0] = zonas8[i % 3];
  const S = s0 + 0.7 * R8.n(), U = u0 + 0.6 * R8.n();
  return {
    zona,
    ingreso: Math.round(Math.exp(6.6 + 0.32 * S + 0.12 * R8.n())),
    escolaridad: r1(12 + 1.7 * S + 0.8 * R8.n(), 1),
    pobreza: r1(Math.max(0.8, 11 - 4.2 * S + 2.6 * R8.n()), 1),
    hacinamiento: r1(Math.max(0.4, 7 - 2.2 * S + 1.4 * U + 1.4 * R8.n()), 1),
    areas_verdes: r1(Math.max(0.3, 4.5 + 1.8 * S - 1.3 * U + 1.1 * R8.n()), 1),
    densidad: Math.round(Math.exp(8.4 + 0.55 * U + 0.25 * R8.n())),
    tiempo_viaje: Math.round(Math.max(12, 42 - 7 * U - 3 * S + 6 * R8.n())),
    edad_media: r1(36 + 1.6 * S - 1.2 * U + 1.8 * R8.n(), 1),
  };
});
const VARS8 = ['ingreso', 'escolaridad', 'pobreza', 'hacinamiento', 'areas_verdes', 'densidad', 'tiempo_viaje', 'edad_media'];
const LBL8 = { ingreso: 'Ingreso', escolaridad: 'Escolaridad', pobreza: 'Pobreza', hacinamiento: 'Hacinamiento', areas_verdes: 'Áreas verdes', densidad: 'Densidad', tiempo_viaje: 'Tiempo de viaje', edad_media: 'Edad media' };
const C8 = correlations(barrios, VARS8);
const rIE = C8.r[0][1], rEP = C8.r[1][2], rDT = C8.r[5][6];
const rr = (v) => formatNumber(v, 2, 'es');
const PV8 = ['ingreso', 'escolaridad', 'pobreza', 'tiempo_viaje'];

export const statsGallery = [
  {
    id: 'histograma',
    name: 'Histograma con densidad',
    note: 'Anchos de barra "bonitos" por Freedman–Diaconis y la curva de densidad (KDE) en la misma escala.',
    spec: { type: 'hist', title: `La mitad de las atenciones dura menos de ${fmt(medAt)} minutos`, subtitle: 'Duración de 600 atenciones presenciales, minutos', source: SRC, data: atencion, x: 'minutos', kde: true, xLabel: 'Minutos' },
  },
  {
    id: 'histograma-grupos',
    name: 'Histogramas superpuestos',
    note: '`hue` separa grupos; `multiple: "layer"` los superpone con transparencia. También: "stack", "dodge" y "fill".',
    spec: { type: 'hist', title: `Los estudiantes presenciales promedian ${fmt(mPres - mLin)} puntos más que los de modalidad en línea`, subtitle: 'Distribución de notas finales (escala 1,0 a 7,0)', source: SRC, data: notas, x: 'nota', hue: 'modalidad', binWidth: 0.25, stat: 'percent', commonNorm: false, xLabel: 'Nota final' },
  },
  {
    id: 'densidad',
    name: 'Densidad por grupo',
    note: 'Curvas de densidad rellenas, una por área, con el nombre sobre su pico. `xScale: "log"` también funciona.',
    spec: { type: 'kde', title: `${topArea[0]} tiene la mediana salarial más alta: $${formatNumber(topArea[1] * 1000, 0, 'es')}`, subtitle: 'Distribución del sueldo bruto mensual por área, miles de pesos', source: SRC, data: salarios, x: 'sueldo', hue: 'area', format: { prefix: '$' }, xLabel: 'Sueldo (miles de $)' },
  },
  {
    id: 'ecdf',
    name: 'Distribución acumulada',
    note: 'Responde "¿qué proporción está bajo este valor?" sin elegir anchos de barra. La mediana queda marcada.',
    spec: { type: 'ecdf', title: `En Biobío el 80% de los despachos llega en ${fmt(p80['Biobío'])} días o menos; en Araucanía, en ${fmt(p80['Araucanía'])}`, subtitle: 'Días entre la compra y la entrega, por región', source: SRC, data: despachos, x: 'dias', hue: 'region', xLabel: 'Días de despacho' },
  },
  {
    id: 'regresion',
    name: 'Regresión con intervalo de confianza',
    note: 'Puntos, recta ajustada y banda de confianza al 95% para la media. `annotate` agrega R² y n.',
    spec: { type: 'regplot', title: `Cada hora semanal de estudio se asocia a ${fmt(slopeEst, 2)} puntos más en la nota`, subtitle: 'Horas de estudio semanales y nota final de 140 estudiantes', source: SRC, data: estudio, x: 'horas', y: 'nota', annotate: true, xLabel: 'Horas de estudio por semana', yLabel: 'Nota final' },
  },
  {
    id: 'regresion-log',
    name: 'Regresión con eje logarítmico',
    note: '`logx: true` ajusta y ~ log(x) y dibuja el eje x en escala log. Con `hue`, una recta por grupo con su nombre al final.',
    spec: { type: 'regplot', title: `Duplicar el ingreso por persona se asocia a ${fmt(dupl)} años más de esperanza de vida`, subtitle: 'Ingreso per cápita (US$, escala log) y esperanza de vida al nacer, 72 países', source: SRC, data: paisesSint, x: 'ingreso', y: 'vida', hue: 'region', logx: true, xFormat: { prefix: 'US$' }, xLabel: 'Ingreso per cápita (escala log)', yLabel: 'Años de vida' },
  },
  {
    id: 'conjunto',
    name: 'Gráfico conjunto (jointplot)',
    note: 'Dispersión con histogramas marginales arriba y a la derecha, en las mismas escalas. `kind: "reg"` agrega el ajuste.',
    spec: { type: 'jointplot', kind: 'reg', title: `La superficie explica el ${Math.round(fitDep.r2 * 100)}% de la variación del precio`, subtitle: 'Departamentos en venta: superficie útil (m²) y precio (UF)', source: SRC, data: deptos, x: 'm2', y: 'uf', xLabel: 'Superficie (m²)', yLabel: 'Precio (UF)' },
  },
  {
    id: 'residuos',
    name: 'Residuos',
    note: 'Para revisar el ajuste: los residuos deben repartirse sin patrón alrededor de cero. `lowess` muestra la tendencia.',
    spec: { type: 'residplot', title: 'Los residuos no muestran patrón: el ajuste lineal es adecuado', subtitle: 'Residuos de la nota sobre las horas de estudio', source: SRC, data: estudio, x: 'horas', y: 'nota', lowess: true, xLabel: 'Horas de estudio por semana' },
  },
  {
    id: 'correlacion',
    name: 'Matriz de correlación',
    note: 'Cada par una sola vez, bajo la diagonal, en una escala divergente fija de −1 a 1. `alpha: 0.05` apaga las correlaciones no significativas; `method: "spearman"` usa rangos.',
    spec: { type: 'corr', title: `En los barrios con más escolaridad el ingreso es mayor (r = ${rr(rIE)}) y la pobreza menor (r = ${rr(rEP)})`, subtitle: 'Correlación de Pearson entre ocho indicadores de 120 barrios', source: SRC, data: barrios, vars: VARS8, labelsFor: LBL8, alpha: 0.05 },
  },
  {
    id: 'clustermap',
    name: 'Matriz agrupada (clustermap)',
    note: '`cluster: true` (o `type: "clustermap"`) reordena las variables por agrupamiento jerárquico y dibuja el dendrograma: los bloques que se mueven juntos saltan a la vista.',
    spec: { type: 'clustermap', title: 'Ingreso, escolaridad y áreas verdes se mueven juntos; pobreza y hacinamiento, en sentido contrario', subtitle: `Correlación de Pearson, variables ordenadas por agrupamiento jerárquico. Densidad y tiempo de viaje: r = ${rr(rDT)}`, source: SRC, data: barrios, vars: VARS8, labelsFor: LBL8 },
  },
  {
    id: 'pares',
    name: 'Matriz de dispersión (pairplot)',
    note: 'Dispersión de cada par bajo la diagonal, la distribución de cada variable en ella y el r de Pearson arriba (por grupo si hay `hue`). `corner: true` deja solo el triángulo inferior.',
    spec: { type: 'pairplot', title: 'La periferia concentra menos ingreso, más pobreza y viajes más largos', subtitle: 'Cuatro indicadores de 120 barrios, por zona. Ingreso en miles de pesos, pobreza en %, viaje en minutos', source: SRC, data: barrios, vars: PV8, hue: 'zona', labelsFor: LBL8 },
  },
];
