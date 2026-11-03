// Redes y cuerdas. Datos ILUSTRATIVOS y deterministas (nombres ficticios).
const SRC = 'datos ilustrativos';

function rng(seed) {
  let s = seed % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
const fmtN = (v) => String(v).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

// ── Red de colaboración en proyectos de I+D ────────────────────────────────
const grupos = {
  Universidades: ['U. del Pacífico Sur', 'U. Austral Andina', 'U. Técnica del Litoral', 'U. del Valle Central', 'U. Minera del Norte', 'U. de los Lagos Altos'],
  'Centros de investigación': ['Centro de Genómica Vegetal', 'Centro de Energía Marina', 'Instituto de Datos Abiertos', 'Lab. de Materiales', 'Centro de Acuicultura', 'Instituto del Litio', 'Centro de Bosque Nativo', 'Lab. de Robótica Agrícola'],
  Empresas: ['Forestal Ríos', 'Salmones Fiordo', 'Viña Cordillera', 'Minera Altiplano', 'Agrícola Itata', 'Pesquera Bahía', 'Solar Atacama', 'Celulosa Laja', 'Frutícola Maule', 'Lácteos del Sur', 'Química Pacífico', 'Logística Puerto', 'Cervecera Calle-Calle', 'Metalúrgica Bío'],
  'Servicios públicos': ['Gobierno Regional', 'Servicio de Salud Regional', 'Agencia de Fomento', 'Oficina de Riego', 'Servicio de Pesca', 'Agencia Ambiental', 'Municipalidad Costera'],
  Startups: ['AgroSense', 'DataMar', 'BioLitio', 'SolarTrack', 'AquaIA', 'Riego360', 'ForestEye', 'VinoLab', 'RoboFruit'],
};
const nodosColab = Object.entries(grupos).flatMap(([grupo, ns]) => ns.map((id) => ({ id, grupo })));
const r1 = rng(42);
const hubs = [...grupos.Universidades, ...grupos['Centros de investigación']];
const colab = [];
const addEdge = (a, b, v) => { if (a !== b) colab.push({ from: a, to: b, proyectos: v }); };
// Cada organización externa colabora con 1–3 universidades o centros.
for (const id of [...grupos.Empresas, ...grupos['Servicios públicos'], ...grupos.Startups]) {
  const k = 1 + Math.floor(r1() * 3);
  for (let i = 0; i < k; i++) {
    // Los primeros hubs atraen más colaboraciones (crecimiento preferencial).
    const h = hubs[Math.floor(Math.pow(r1(), 1.8) * hubs.length)];
    addEdge(id, h, 1 + Math.floor(r1() * 6));
  }
}
// Colaboración entre universidades y centros.
for (let i = 0; i < hubs.length; i++) for (let j = i + 1; j < hubs.length; j++) if (r1() < 0.22) addEdge(hubs[i], hubs[j], 1 + Math.floor(r1() * 4));
// Algunas startups trabajan con empresas.
for (const s of grupos.Startups) if (r1() < 0.5) addEdge(s, grupos.Empresas[Math.floor(r1() * grupos.Empresas.length)], 1 + Math.floor(r1() * 3));

// Hecho para el título: la organización con más socios distintos.
const socios = new Map();
const pares = new Set();
for (const e of colab) {
  const k = [e.from, e.to].sort().join('|');
  if (pares.has(k)) continue;
  pares.add(k);
  socios.set(e.from, (socios.get(e.from) || 0) + 1);
  socios.set(e.to, (socios.get(e.to) || 0) + 1);
}
const [hubTop, hubDeg] = [...socios.entries()].sort((a, b) => b[1] - a[1])[0];
const totalProy = colab.reduce((a, e) => a + e.proyectos, 0);

// ── Coordinación entre áreas de un municipio (círculo) ─────────────────────
const areas = {
  Gestión: ['Alcaldía', 'Planificación', 'Finanzas', 'Jurídica'],
  Territorio: ['Obras', 'Tránsito', 'Medio Ambiente', 'Aseo y Ornato'],
  Social: ['Desarrollo Social', 'Salud', 'Educación', 'Deportes'],
  Comunidad: ['Cultura', 'Turismo', 'Seguridad'],
};
const nodosMuni = Object.entries(areas).flatMap(([grupo, ns]) => ns.map((id) => ({ id, grupo })));
const r2 = rng(7);
const coord = [];
const todos = nodosMuni.map((n) => n.id);
for (let i = 0; i < todos.length; i++)
  for (let j = i + 1; j < todos.length; j++) {
    const a = todos[i], b = todos[j];
    let p = 0.18;
    if (a === 'Planificación' || b === 'Planificación') p = 0.8;
    else if (a === 'Alcaldía' || b === 'Alcaldía' || a === 'Finanzas' || b === 'Finanzas') p = 0.5;
    if (r2() < p) coord.push({ from: a, to: b, reuniones: 2 + Math.floor(r2() * 18) });
  }
const gradoMuni = new Map();
for (const e of coord) { gradoMuni.set(e.from, (gradoMuni.get(e.from) || 0) + 1); gradoMuni.set(e.to, (gradoMuni.get(e.to) || 0) + 1); }
const [muniTop, muniDeg] = [...gradoMuni.entries()].sort((a, b) => b[1] - a[1])[0];

// ── Migración entre macrozonas (cuerdas) ───────────────────────────────────
const zonas = ['Norte Grande', 'Norte Chico', 'Centro', 'Metropolitana', 'Sur', 'Austral'];
// Personas que cambiaron de residencia entre zonas en 5 años (miles), de fila → columna.
const M = [
  [0, 9, 6, 28, 5, 1],
  [8, 0, 14, 22, 6, 1],
  [5, 12, 0, 64, 18, 2],
  [31, 26, 71, 0, 52, 9],
  [4, 5, 21, 47, 0, 11],
  [1, 1, 2, 8, 13, 0],
];
const migracion = [];
zonas.forEach((a, i) => zonas.forEach((b, j) => { if (M[i][j] > 0) migracion.push({ origen: a, destino: b, personas: M[i][j] * 1000 }); }));
let bestPair = null;
for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) { const v = M[i][j] + M[j][i]; if (!bestPair || v > bestPair[2]) bestPair = [zonas[i], zonas[j], v]; }

export { colab, nodosColab, coord, nodosMuni, migracion };

export const networkGallery = [
  {
    id: 'red',
    name: 'Red de colaboración',
    nameEn: 'Collaboration network',
    note: 'Disposición por fuerzas, determinista. Tamaño = proyectos (grado ponderado), color = tipo de organización; se rotulan las mayores. `highlight` deja a la vista un nodo y sus vecinos.',
    noteEn: 'Deterministic force layout. Size = projects (weighted degree), color = kind of organization; the largest are labeled. `highlight` keeps one node and its neighbors in view.',
    spec: {
      type: 'network',
      title: `${hubTop} colabora con ${hubDeg} organizaciones, más que ninguna otra`,
      subtitle: `Proyectos conjuntos de I+D entre ${nodosColab.length} organizaciones (${fmtN(totalProy)} proyectos)`,
      source: SRC, data: colab, nodes: nodosColab, from: 'from', to: 'to', value: 'proyectos', group: 'grupo',
    },
  },
  {
    id: 'red-circulo',
    name: 'Red en círculo',
    nameEn: 'Circular network',
    note: '`layout: "circle"` ordena los nodos por grupo alrededor de un círculo; las conexiones se curvan hacia el centro. Ideal para redes chicas y densas.',
    noteEn: '`layout: "circle"` orders nodes by group around a circle; links curve toward the center. Good for small, dense networks.',
    spec: {
      type: 'network', layout: 'circle',
      title: `${muniTop} se coordina con ${muniDeg} de las ${nodosMuni.length - 1} otras áreas del municipio`,
      subtitle: 'Reuniones de coordinación entre áreas municipales en un año',
      source: SRC, data: coord, nodes: nodosMuni, from: 'from', to: 'to', value: 'reuniones', group: 'grupo',
    },
  },
  {
    id: 'cuerdas',
    name: 'Diagrama de cuerdas',
    nameEn: 'Chord diagram',
    note: 'Cada arco es el total de una zona; cada cinta, el intercambio entre dos zonas (el tooltip separa ambos sentidos). El color es el de la zona que más envía.',
    noteEn: 'Each arc is a zone\'s total; each ribbon, the exchange between two zones (the tooltip splits both directions). Ribbons take the color of the zone that sends more.',
    spec: {
      type: 'chord',
      title: `${bestPair[1]} y ${bestPair[0]} intercambian más personas que cualquier otro par: ${fmtN(bestPair[2] * 1000)}`,
      subtitle: 'Cambios de residencia entre macrozonas en cinco años',
      source: SRC, data: migracion, from: 'origen', to: 'destino', value: 'personas',
    },
  },
];
