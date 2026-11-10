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
// Organización con más proyectos (grado ponderado): el centro de la red concéntrica.
const proyPorOrg = new Map();
for (const e of colab) for (const id of [e.from, e.to]) proyPorOrg.set(id, (proyPorOrg.get(id) || 0) + e.proyectos);
const [proyTop, proyN] = [...proyPorOrg.entries()].sort((a, b) => b[1] - a[1])[0];

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

// ── Personajes que comparten escena (al estilo de Les Misérables) ──────────
// Novela ficticia: 70 personajes en 9 círculos, ~250 pares que coinciden en escena.
const elenco = {
  'Casa Valdés': ['Julián', 'Inés', 'Tomasa', 'Bruno', 'Rosaura', 'Elías', 'Catalina', 'Gaspar', 'Leonor', 'Matías', 'Abril', 'Ramiro', 'Celia', 'Dámaso', 'Olga', 'Fermín', 'Nieves'],
  Barricada: ['Andrés', 'Lucio', 'Teo', 'Marcial', 'Simón', 'Vera', 'Íñigo', 'Pablo', 'Ruth', 'Noé', 'Hugo'],
  Puerto: ['Capitán Ríos', 'Marta', 'Esteban', 'Lola', 'Basilio', 'Ciro', 'Dora', 'Eloy', 'Fabia'],
  Convento: ['Sor Clara', 'Sor Edith', 'Padre Anselmo', 'Sor Pía', 'Hermano Luis', 'Sor Rita', 'Sor Ana', 'Novicia Eva'],
  Posada: ['Doña Benita', 'Don Cosme', 'Paca', 'Remigio', 'Toña', 'Zoilo', 'Quique'],
  Tribunal: ['Juez Arteaga', 'Fiscal Ponce', 'Escribano Gil', 'Alguacil Mora', 'Abogado Sanz', 'Testigo Roca'],
  Taller: ['Maestro Ibar', 'Aprendiz Leo', 'Clemente', 'Sabina', 'Rufo'],
  Mercado: ['Pepa', 'Vicente', 'Amparo', 'Telmo'],
  Colegio: ['Profesor Lago', 'Alumna Sol', 'Bedel Juan'],
};
const nodosElenco = Object.entries(elenco).flatMap(([circulo, ns]) => ns.map((id) => ({ id, circulo })));
const r3 = rng(1862);
const escenas = [];
const parEsc = new Set();
const escena = (a, b, v) => {
  const k = a < b ? a + '|' + b : b + '|' + a;
  if (a === b || parEsc.has(k)) return;
  parEsc.add(k);
  escenas.push({ from: a, to: b, escenas: v });
};
const circulos = Object.values(elenco);
const protagonista = circulos[0][0];
circulos.forEach((ns, gi) => {
  const hub = ns[0];
  // Todos coinciden con la figura central de su círculo; algunos, entre sí.
  ns.slice(1).forEach((id, i) => escena(hub, id, 1 + Math.floor(r3() * (i < 3 ? 12 : 5))));
  const p = gi === 1 ? 0.62 : ns.length > 10 ? 0.2 : 0.4;
  for (let i = 1; i < ns.length; i++) for (let j = i + 1; j < ns.length; j++) if (r3() < p) escena(ns[i], ns[j], 1 + Math.floor(r3() * 4));
  // La protagonista cruza todos los círculos.
  if (gi > 0) ns.slice(0, Math.min(ns.length, 1 + Math.ceil(ns.length * 0.4))).forEach((id) => escena(protagonista, id, 1 + Math.floor(r3() * 9)));
});
// Figuras centrales que se cruzan entre círculos, y algún encuentro suelto.
const centrales = circulos.map((ns) => ns[0]);
for (let i = 1; i < centrales.length; i++) for (let j = i + 1; j < centrales.length; j++) if (r3() < 0.3) escena(centrales[i], centrales[j], 1 + Math.floor(r3() * 6));
const todosElenco = nodosElenco.map((n) => n.id);
for (let k = 0; k < 80; k++) escena(todosElenco[Math.floor(r3() * todosElenco.length)], todosElenco[Math.floor(r3() * todosElenco.length)], 1 + Math.floor(r3() * 2));
const gradoElenco = new Map();
for (const e of escenas) for (const id of [e.from, e.to]) gradoElenco.set(id, (gradoElenco.get(id) || 0) + 1);
const [elencoTop, elencoDeg] = [...gradoElenco.entries()].sort((a, b) => b[1] - a[1])[0];

// Distancia (en escenas compartidas) de cada personaje a la protagonista.
const vecinos = new Map();
for (const e of escenas) for (const [a, b] of [[e.from, e.to], [e.to, e.from]]) { if (!vecinos.has(a)) vecinos.set(a, []); vecinos.get(a).push(b); }
const pasos = new Map([[protagonista, 0]]);
for (const cola = [protagonista]; cola.length;) { const a = cola.shift(); for (const b of vecinos.get(a) || []) if (!pasos.has(b)) { pasos.set(b, pasos.get(a) + 1); cola.push(b); } }
const directos = [...pasos.values()].filter((d) => d === 1).length;
const maxPasos = Math.max(...pasos.values());
const tamCirculo = Object.entries(elenco).map(([k, ns]) => [k, ns.length]).sort((a, b) => b[1] - a[1]);

// ── Red de referidos de una cooperativa (árbol con algunos cruces) ─────────
const nombresRef = ['Ana', 'Beto', 'Carla', 'Diego', 'Elena', 'Fabio', 'Gala', 'Héctor', 'Irene', 'Jorge', 'Karen', 'Luis', 'Mila', 'Nico', 'Olivia', 'Pedro', 'Rocío', 'Samuel', 'Tania', 'Ulises', 'Valeria', 'Walter', 'Ximena', 'Yago', 'Zoe'];
const comunas = ['Concepción', 'Talcahuano', 'Chiguayante', 'Hualpén'];
const r4 = rng(2024);
const socios4 = [];
const referidos = [];
const nuevoSocio = (comuna) => { const id = `${nombresRef[socios4.length % nombresRef.length]} ${String.fromCharCode(65 + Math.floor(socios4.length / nombresRef.length) * 3 + Math.floor(r4() * 3))}.`; socios4.push({ id, comuna }); return id; };
const fundadora = nuevoSocio('Concepción');
let frente = [fundadora];
for (let nivel = 0; nivel < 4 && socios4.length < 46; nivel++) {
  const sig = [];
  for (const quien of frente) {
    const k = nivel === 0 ? 4 : Math.floor(r4() * (nivel < 2 ? 4 : 3));
    const com = socios4.find((x) => x.id === quien).comuna;
    for (let i = 0; i < k && socios4.length < 46; i++) {
      const c = r4() < 0.7 ? (nivel === 0 ? comunas[i % comunas.length] : com) : comunas[Math.floor(r4() * comunas.length)];
      const nuevo = nuevoSocio(c);
      referidos.push({ from: quien, to: nuevo, compras: 1 + Math.floor(r4() * 9) });
      sig.push(nuevo);
    }
  }
  frente = sig;
}
for (let k = 0; k < 6; k++) { const a = socios4[1 + Math.floor(r4() * (socios4.length - 1))].id, b = socios4[1 + Math.floor(r4() * (socios4.length - 1))].id; if (a !== b) referidos.push({ from: a, to: b, compras: 1 }); }
const refDirectos = referidos.filter((e) => e.from === fundadora).length;

export { colab, nodosColab, coord, nodosMuni, migracion, escenas, nodosElenco, referidos, socios4 };

export const networkGallery = [
  {
    id: 'red',
    name: 'Red de colaboración',
    nameEn: 'Collaboration network',
    note: 'Disposición por fuerzas, determinista. Tamaño = proyectos (grado ponderado), color = tipo de organización; se rotulan las mayores. `highlight` deja a la vista un nodo y sus vecinos.',
    noteEn: 'Click a node: it glides to the center with its connections highlighted (click again or press Esc to go back). Deterministic force layout. Size = projects (weighted degree), color = kind of organization; the largest are labeled. `highlight` keeps one node and its neighbors in view.',
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
    id: 'red-personajes',
    name: 'Red de personajes',
    nameEn: 'Character network',
    note: 'Al estilo del grafo de *Los miserables* de ECharts: conexiones curvas del color del personaje de origen, nodos con área ∝ escenas compartidas y nombres sin choques (se rotulan los mayores; el resto, en el tooltip). `curveness` ajusta la curva (0 = rectas).',
    noteEn: 'In the style of the ECharts *Les Misérables* graph: curved links in the color of the source character, node area ∝ shared scenes and non-overlapping names (the largest are labeled; the rest are in the tooltip). `curveness` sets the bend (0 = straight).',
    spec: {
      type: 'network',
      title: `${elencoTop} comparte escena con ${elencoDeg} personajes, más que nadie`,
      subtitle: `Personajes que aparecen juntos en una novela ficticia (${nodosElenco.length} personajes, ${escenas.length} pares)`,
      source: SRC, data: escenas, nodes: nodosElenco, value: 'escenas', group: 'circulo',
    },
  },
  {
    id: 'red-circular',
    name: 'Red circular',
    nameEn: 'Circular network',
    note: '`layout: "circular"`: los nodos rodean un círculo ordenados por grupo, con un hueco entre grupos; los nombres salen hacia afuera, girados, y se omiten solo los que no caben.',
    noteEn: '`layout: "circular"`: nodes go around a circle ordered by group, with a gap between groups; names point outward, rotated, and only those that do not fit are left out.',
    spec: {
      type: 'network', layout: 'circular',
      title: `${elencoTop} conecta los ${Object.keys(elenco).length} círculos de la novela`,
      subtitle: 'Personajes que aparecen juntos en escena, ordenados por círculo',
      source: SRC, data: escenas, nodes: nodosElenco, value: 'escenas', group: 'circulo',
    },
  },
  {
    id: 'red-radial',
    name: 'Árbol radial',
    nameEn: 'Radial tree',
    note: '`layout: "radial"`: un árbol desde el nodo más conectado (o desde `focus`): cada anillo es un paso más de distancia. Las conexiones que no son del árbol quedan tenues.',
    noteEn: '`layout: "radial"`: a tree from the most connected node (or from `focus`): each ring is one more step away. Links outside the tree are faint.',
    spec: {
      type: 'network', layout: 'radial',
      title: `${directos} de los ${nodosElenco.length - 1} personajes comparten escena directamente con ${protagonista}; nadie está a más de ${maxPasos} pasos`,
      subtitle: 'Anillos según la distancia a la protagonista, en escenas compartidas',
      source: SRC, data: escenas, nodes: nodosElenco, value: 'escenas', group: 'circulo',
    },
  },
  {
    id: 'red-concentrica',
    name: 'Red concéntrica',
    nameEn: 'Concentric network',
    note: '`layout: "concentric"`: anillos por peso, el mayor al centro; dentro de cada anillo, ordenados por grupo. Se ve de un vistazo quién concentra la red.',
    noteEn: '`layout: "concentric"`: rings by weight, the largest in the middle; within each ring, ordered by group. Who concentrates the network shows at a glance.',
    spec: {
      type: 'network', layout: 'concentric',
      title: `${proyTop} participa en ${proyN} proyectos conjuntos, más que cualquier otra organización`,
      subtitle: `Proyectos conjuntos de I+D; anillos de mayor a menor número de proyectos`,
      source: SRC, data: colab, nodes: nodosColab, value: 'proyectos', group: 'grupo',
    },
  },
  {
    id: 'red-racimos',
    name: 'Red por grupos',
    nameEn: 'Clustered network',
    note: '`layout: "clusters"`: un racimo por grupo (espiral de girasol, el mayor al centro), con espacio ∝ √tamaño. Lo de adentro de cada grupo queda corto; los puentes entre grupos, a la vista.',
    noteEn: '`layout: "clusters"`: one cluster per group (sunflower spiral, the largest in the middle), with room ∝ √size. Links inside a group stay short; bridges between groups stand out.',
    spec: {
      type: 'network', layout: 'clusters',
      title: `${tamCirculo[0][0]} es el círculo más grande (${tamCirculo[0][1]} personajes) y ${protagonista} lo une a todos los demás`,
      subtitle: 'Personajes que aparecen juntos en escena, agrupados por círculo',
      source: SRC, data: escenas, nodes: nodosElenco, value: 'escenas', group: 'circulo',
    },
  },
  {
    id: 'red-arbol',
    name: 'Red como árbol',
    nameEn: 'Network as a tree',
    note: '`layout: "tree"`: el mismo árbol que `radial`, extendido: de izquierda a derecha si el área es más ancha que alta. Conectores en S; los cruces que no son del árbol, tenues.',
    noteEn: '`layout: "tree"`: the same tree as `radial`, laid flat: left to right when the area is wider than tall. S-shaped connectors; cross links outside the tree are faint.',
    spec: {
      type: 'network', layout: 'tree',
      title: `${fundadora} trajo a ${refDirectos} socios, y por ellos llegaron ${socios4.length - 1 - refDirectos} más`,
      subtitle: 'Quién invitó a quién a la cooperativa; color según comuna',
      source: SRC, data: referidos, nodes: socios4, value: 'compras', group: 'comuna',
    },
  },
  {
    id: 'red-grilla',
    name: 'Red en grilla',
    nameEn: 'Grid network',
    note: '`layout: "grid"`: los nodos en una grilla ordenada por grupo y peso; útil cuando importa ubicar a cada uno más que la forma de la red.',
    noteEn: '`layout: "grid"`: nodes on a grid ordered by group and weight; useful when finding each node matters more than the shape of the network.',
    spec: {
      type: 'network', layout: 'grid',
      title: `${muniTop} se coordina con ${muniDeg} de las ${nodosMuni.length - 1} otras áreas`,
      subtitle: 'Reuniones de coordinación entre áreas municipales en un año, por área',
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
