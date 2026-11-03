// Pirámides de población y diagrama de flujo. Datos ILUSTRATIVOS (con la
// forma de una población que envejece; no son cifras oficiales del INE).

const SRC = 'datos ilustrativos';

const AGES = ['0-4', '5-9', '10-14', '15-19', '20-24', '25-29', '30-34', '35-39', '40-44', '45-49', '50-54', '55-59', '60-64', '65-69', '70-74', '75-79', '80+'];

// Miles de personas por tramo: base que envejece (2024) y una más joven (2002).
function population(year) {
  const rows = [];
  // Supervivencia: casi plana hasta los 50, luego cae cada vez más rápido.
  const surv = (mid, k) => Math.exp(-((Math.max(0, mid - 48) / k) ** 2));
  AGES.forEach((age, i) => {
    const mid = i * 5 + 2;
    let base;
    if (year === 2024) {
      // Natalidad en baja: los tramos jóvenes son menores que los de 25–44.
      const cohort = 560 + 190 * Math.exp(-((mid - 33) ** 2) / 300) - (mid < 20 ? (20 - mid) * 9 : 0);
      base = i === 16 ? 0 : cohort * surv(mid, 31);
    } else {
      const cohort = 690 - 4.2 * mid;
      base = i === 16 ? 0 : cohort * surv(mid, 30);
    }
    rows.push({ age, mid, base });
  });
  // 80+: la cola completa (tramo abierto), algo menor que 75–79 × 1,4.
  rows[16].base = rows[15].base * (year === 2024 ? 0.95 : 0.7);
  const out = [];
  for (const { age, mid, base } of rows) {
    const fem = mid < 45 ? 0.985 : 1 + (mid - 45) * 0.011;
    out.push({ año: year, edad: age, sexo: 'Hombres', personas: Math.round(base) });
    out.push({ año: year, edad: age, sexo: 'Mujeres', personas: Math.round(base * fem) });
  }
  return out;
}

export const poblacion2024 = population(2024);
export const poblacion2002 = population(2002);
export const poblacionAmbas = [...poblacion2002, ...poblacion2024];

const sumWhere = (rows, f) => rows.filter(f).reduce((a, r) => a + r.personas, 0);
const lead = (a) => parseInt(a, 10);
const tot24 = sumWhere(poblacion2024, () => true);
const tot02 = sumWhere(poblacion2002, () => true);
const under15 = (rows) => sumWhere(rows, (r) => lead(r.edad) < 15);
const over65 = (rows) => sumWhere(rows, (r) => lead(r.edad) >= 65);
const pct = (v, t) => String(Math.round((v / t) * 100));
const ratio24 = over65(poblacion2024) / under15(poblacion2024);
const fem80 = sumWhere(poblacion2024, (r) => r.edad === '80+' && r.sexo === 'Mujeres') / sumWhere(poblacion2024, (r) => r.edad === '80+' && r.sexo === 'Hombres');

const tituloPiramide = ratio24 >= 1
  ? `Ya hay más personas de 65 años y más (${pct(over65(poblacion2024), tot24)}%) que menores de 15 (${pct(under15(poblacion2024), tot24)}%)`
  : `Los menores de 15 años son solo el ${pct(under15(poblacion2024), tot24)}% de la población`;

// Proceso de compra pública (esquema ilustrativo).
const nodosCompra = [
  { id: 'inicio', label: 'Necesidad de compra', type: 'start', lane: 'Unidad requirente' },
  { id: 'req', label: 'Elaborar requerimiento y especificaciones técnicas', lane: 'Unidad requirente', detail: 'Incluye presupuesto estimado y criterios de evaluación.' },
  { id: 'presup', label: '¿Hay disponibilidad presupuestaria?', type: 'decision', lane: 'Finanzas' },
  { id: 'ajustar', label: 'Ajustar el requerimiento', lane: 'Unidad requirente' },
  { id: 'cdp', label: 'Emitir certificado de disponibilidad', lane: 'Finanzas' },
  { id: 'monto', label: '¿Monto sobre 100 UTM?', type: 'decision', lane: 'Abastecimiento' },
  { id: 'lic', label: 'Publicar licitación en Mercado Público', lane: 'Abastecimiento', detail: 'Plazos mínimos de publicación según el monto.' },
  { id: 'agil', label: 'Compra ágil o convenio marco', lane: 'Abastecimiento' },
  { id: 'eval', label: 'Evaluar ofertas con la comisión', lane: 'Unidad requirente' },
  { id: 'oc', label: 'Adjudicar y emitir orden de compra', lane: 'Abastecimiento' },
  { id: 'recep', label: 'Recepción conforme', lane: 'Unidad requirente' },
  { id: 'pago', label: 'Pagar la factura', lane: 'Finanzas' },
  { id: 'fin', label: 'Proceso cerrado', type: 'end', lane: 'Finanzas' },
];
const pasosCompra = [
  { from: 'inicio', to: 'req' },
  { from: 'req', to: 'presup' },
  { from: 'presup', to: 'cdp', label: 'Sí' },
  { from: 'presup', to: 'ajustar', label: 'No' },
  { from: 'ajustar', to: 'req' },
  { from: 'cdp', to: 'monto' },
  { from: 'monto', to: 'lic', label: 'Sí' },
  { from: 'monto', to: 'agil', label: 'No' },
  { from: 'lic', to: 'eval' },
  { from: 'eval', to: 'oc' },
  { from: 'agil', to: 'oc' },
  { from: 'oc', to: 'recep' },
  { from: 'recep', to: 'pago' },
  { from: 'pago', to: 'fin' },
];
const lanesCompra = new Set(nodosCompra.map((n) => n.lane)).size;
const decisionesCompra = nodosCompra.filter((n) => n.type === 'decision').length;

export const flowGallery = [
  {
    id: 'piramide',
    name: 'Pirámide de población',
    nameEn: 'Population pyramid',
    note: 'Barras espalda con espalda desde un eje central; los tramos de edad van en la columna del medio, sin ejes repetidos. Cada lado lleva su nombre y su participación en su color.',
    noteEn: 'Back-to-back bars from a central axis; age groups sit in the middle column, with no duplicated axes. Each side is named, with its share, in its own color.',
    spec: { type: 'pyramid', title: tituloPiramide, subtitle: 'Población por sexo y tramo de edad, miles de personas, 2024', source: SRC, data: poblacion2024, age: 'edad', sex: 'sexo', value: 'personas' },
  },
  {
    id: 'piramide-comparada',
    name: 'Pirámide con comparación',
    nameEn: 'Pyramid with a comparison',
    note: '`compare: 2002` dibuja el año anterior como un contorno escalonado sobre las barras: se ve dónde la base se angostó y dónde creció la cima.',
    noteEn: '`compare: 2002` draws the earlier year as a stepped outline over the bars, showing where the base narrowed and the top grew.',
    spec: { type: 'pyramid', title: `Los menores de 15 años pasaron de ${pct(under15(poblacion2002), tot02)}% a ${pct(under15(poblacion2024), tot24)}% de la población`, subtitle: 'Participación por sexo y tramo de edad, 2024 frente a 2002', source: SRC, data: poblacionAmbas, age: 'edad', sex: 'sexo', value: 'personas', compareField: 'año', compare: 2002, percent: true, compareLabel: '2002' },
  },
  {
    id: 'flujo-compra',
    name: 'Diagrama de flujo con carriles',
    nameEn: 'Flow chart with swimlanes',
    note: 'Nodos y conexiones con `type` (inicio, proceso, decisión, fin) y `lane` por unidad. El orden se calcula solo, las decisiones salen por el costado y los retornos rodean el diagrama sin cruzar nodos.',
    noteEn: 'Nodes and edges with a `type` (start, process, decision, end) and a `lane` per unit. Layout is automatic; decisions branch from the side and loops go around without crossing nodes.',
    spec: { type: 'flowchart', title: `Una compra pública pasa por ${lanesCompra} unidades y ${decisionesCompra} decisiones antes del pago`, subtitle: 'Proceso de compra, esquema ilustrativo', source: SRC, nodes: nodosCompra, data: pasosCompra },
  },
];
