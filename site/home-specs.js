// Specs de la portada del sitio, en inglés o en español. Datos ilustrativos.
import { southAmerica, capitales, tropico } from '../examples/specs-geo-custom.js';

/** Todos los specs de la portada en un idioma (`en` o `es`). Mismos datos, mismas cifras. */
export function homeSpecs(lang = 'en') {
  const es = lang === 'es';
  const t = (en, sp) => (es ? sp : en);
  const SRC = t('illustrative data', 'datos ilustrativos');

  // ── Exportaciones por sector y producto ──
  const years = [2021, 2022, 2023, 2024, 2025];
  const base = [
    [t('Mining', 'Minería'), [[t('Copper', 'Cobre'), [380, 410, 395, 430, 470]], [t('Lithium', 'Litio'), [20, 60, 85, 70, 95]], [t('Molybdenum', 'Molibdeno'), [22, 25, 24, 26, 27]]]],
    [t('Agriculture', 'Agricultura'), [[t('Fruit', 'Fruta'), [62, 66, 70, 74, 80]], [t('Wine', 'Vino'), [21, 22, 20, 19, 19]], [t('Seeds', 'Semillas'), [7, 8, 8, 9, 9]]]],
    [t('Forestry', 'Forestal'), [[t('Pulp', 'Celulosa'), [32, 40, 34, 33, 36]], [t('Timber', 'Madera'), [15, 17, 14, 14, 15]]]],
    [t('Fishing', 'Pesca'), [[t('Salmon', 'Salmón'), [52, 60, 63, 66, 70]], [t('Other seafood', 'Otros productos del mar'), [14, 15, 15, 16, 16]]]],
    [t('Manufacturing', 'Industria'), [[t('Chemicals', 'Químicos'), [18, 19, 20, 21, 22]], [t('Machinery', 'Maquinaria'), [9, 10, 10, 11, 12]]]],
  ];
  const exportsRows = [];
  for (const [sector, products] of base)
    for (const [product, vals] of products)
      years.forEach((year, i) => exportsRows.push({ year, sector, product, value: vals[i] }));

  const heroSpec = {
    type: 'treemap',
    title: t('Mining makes up two thirds of exports', 'La minería explica dos tercios de las exportaciones'),
    subtitle: t('Exports by sector and product, USD billions', 'Exportaciones por sector y producto, miles de millones de USD'),
    source: SRC,
    data: exportsRows,
    path: ['sector', 'product'],
    value: 'value',
    time: 'year',
    slider: true,
    locale: lang,
  };

  const quickSpec = {
    type: 'bar',
    title: t('Biobío accounts for 30% of southern sales', 'Biobío concentra el 30% de las ventas del sur'),
    subtitle: t('Sales by region, CLP millions, 2025', 'Ventas por región, millones de CLP, 2025'),
    source: SRC,
    data: [
      { region: 'Biobío', sales: 1240 },
      { region: 'Araucanía', sales: 880 },
      { region: 'Ñuble', sales: 610 },
      { region: 'Maule', sales: 530 },
      { region: 'Los Ríos', sales: 420 },
      { region: 'Los Lagos', sales: 390 },
    ],
    x: 'region',
    y: 'sales',
    highlight: 'Biobío',
    locale: lang,
  };

  // ── Plan de implementación (Gantt) ──
  const plan = [
    [t('Discovery', 'Diagnóstico'), t('User interviews', 'Entrevistas a usuarios'), '2026-01-05', '2026-01-23', 100],
    [t('Discovery', 'Diagnóstico'), t('Process map', 'Mapa de procesos'), '2026-01-19', '2026-02-06', 100, t('User interviews', 'Entrevistas a usuarios')],
    [t('Discovery', 'Diagnóstico'), t('Findings report', 'Informe de hallazgos'), '2026-02-09', null, null, t('Process map', 'Mapa de procesos')],
    [t('Design', 'Diseño'), t('Data model', 'Modelo de datos'), '2026-02-09', '2026-03-06', 80, t('Findings report', 'Informe de hallazgos')],
    [t('Design', 'Diseño'), t('Agent prototype', 'Prototipo del agente'), '2026-02-23', '2026-03-27', 45],
    [t('Build', 'Desarrollo'), t('ERP integration', 'Integración con el ERP'), '2026-03-16', '2026-04-30', 10, t('Data model', 'Modelo de datos')],
    [t('Build', 'Desarrollo'), t('KPI dashboard', 'Tablero de KPI'), '2026-04-06', '2026-05-15', 0, t('Agent prototype', 'Prototipo del agente')],
    [t('Build', 'Desarrollo'), t('User testing', 'Pruebas con usuarios'), '2026-05-04', '2026-05-29', 0, null, true],
    [t('Launch', 'Lanzamiento'), t('Training', 'Capacitación'), '2026-06-01', '2026-06-12', 0, t('User testing', 'Pruebas con usuarios'), true],
    [t('Launch', 'Lanzamiento'), t('Go-live', 'Puesta en marcha'), '2026-06-15', null, null, t('Training', 'Capacitación')],
  ].map(([phase, task, start, end, progress, after, tentative]) => ({ phase, task, start, ...(end ? { end } : {}), ...(progress !== null && progress !== undefined ? { progress } : {}), ...(after ? { after } : {}), ...(tentative ? { tentative: true } : {}) }));

  const ganttSpec = {
    type: 'gantt',
    title: t('Go-live is June 15, and the ERP integration is the critical path', 'La puesta en marcha es el 15 de junio y la integración con el ERP es la ruta crítica'),
    subtitle: t('Rollout plan by phase, 2026. The filled part of each bar is progress', 'Plan de implementación por fase, 2026. La parte rellena de cada barra es el avance'),
    source: SRC,
    data: plan,
    task: 'task', start: 'start', end: 'end', group: 'phase', progress: 'progress', dependsOn: 'after',
    today: '2026-03-12', dashed: 'tentative', dashedLabel: t('To be confirmed', 'Por confirmar'),
    locale: lang,
  };

  // ── Mapa con geometría propia ──
  const LANGS = es ? { Brasil: 'Portugués', Guyana: 'Inglés', Surinam: 'Neerlandés' } : { Brazil: 'Portuguese', Guyana: 'English', Suriname: 'Dutch' };
  const saGeo = southAmerica(lang);
  const capricorn = t('Tropic of Capricorn', 'Trópico de Capricornio');
  const languageSpec = {
    type: 'choropleth',
    geo: saGeo,
    title: t('Spanish is an official language in 9 of the 12 South American countries', 'El español es idioma oficial en 9 de los 12 países de Sudamérica'),
    subtitle: t('Main official language by country, with capitals', 'Principal idioma oficial por país, con sus capitales'),
    source: t('Natural Earth (public domain)', 'Natural Earth (dominio público)'),
    data: saGeo.features.map((f) => ({ country: f.properties.ADMIN, language: LANGS[f.properties.ADMIN] || t('Spanish', 'Español') })),
    key: 'country', value: 'language',
    markers: { data: capitales.map((c) => ({ city: c.ciudad, lon: c.lon, lat: c.lat })), label: 'city', legend: t('Capital', 'Capital') },
    layers: [{ geo: tropico(capricorn), label: capricorn, dash: true, width: 1 }],
    locale: lang,
  };

  // ── Usuarios activos mensuales de tres productos (determinista) ──
  const months = Array.from({ length: 24 }, (_, i) => `${2024 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`);
  const growth = { Atlas: [12, 0.105], Beacon: [30, 0.025], Compass: [18, 0.045] };
  const wave = (i, k) => 1 + 0.035 * Math.sin(i * 0.9 + k);
  const usersRows = [];
  Object.entries(growth).forEach(([product, [b, g]], k) => months.forEach((month, i) => usersRows.push({ month, product, users: Math.round(b * (1 + g) ** i * wave(i, k) * 10) / 10 })));
  const last = (p) => usersRows.filter((r) => r.product === p).at(-1).users;
  const val = (p, m) => usersRows.find((r) => r.product === p && r.month === m).users;
  const cross = months.find((m) => val('Atlas', m) > val('Beacon', m));
  const MONTH = es
    ? ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
    : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const when = `${MONTH[+cross.slice(5) - 1]}${es ? ' de' : ''} ${cross.slice(0, 4)}`;
  const times = Math.round(last('Atlas') / last('Beacon'));
  const trendSpec = {
    type: 'line',
    title: t(`Atlas passed Beacon in ${when} and now has ${times}× its users`, `Atlas superó a Beacon en ${when} y hoy tiene ${times} veces sus usuarios`),
    subtitle: t('Monthly active users by product, thousands', 'Usuarios activos mensuales por producto, miles'),
    source: SRC,
    data: usersRows, x: 'month', y: 'users', series: 'product', highlight: 'Atlas',
    annotations: [{ x: '2024-09', label: t('Atlas goes free', 'Atlas pasa a ser gratis') }],
    locale: lang,
  };

  // ── El ciclo de reparación: primera llamada con errores reales, y la corregida ──
  const storesRows = [['Santiago', 430], ['Valparaíso', 96], ['Concepción', 88], ['La Serena', 41], ['Antofagasta', 39], ['Temuco', 35], ['Rancagua', 30], ['Talca', 26], ['Arica', 21], ['Iquique', 19], ['Puerto Montt', 18]].map(([city, stores]) => ({ city, stores }));
  const badSpec = { type: 'donut', data: storesRows, label: 'city', value: 'store_count', locale: lang };
  const rest = storesRows.slice(1).reduce((a, r) => a + r.stores, 0);
  const fixedSpec = {
    type: 'bar',
    title: t(`Santiago has more stores than the next ten cities combined: ${storesRows[0].stores} vs ${rest}`, `Santiago tiene más tiendas que las diez ciudades siguientes juntas: ${storesRows[0].stores} contra ${rest}`),
    subtitle: t('Stores by city, 2025', 'Tiendas por ciudad, 2025'),
    source: SRC,
    data: storesRows, x: 'city', y: 'stores', highlight: 'Santiago',
    locale: lang,
  };

  /** Escenarios de la conversación en vivo de la portada. */
  const exchanges = [
    { id: 'plan', label: t('A plan', 'Un plan'), ask: t('Here’s our rollout plan. Where are we, and what could slip?', 'Este es nuestro plan de implementación. ¿Dónde estamos y qué se podría atrasar?'), spec: ganttSpec, data: t('/* 10 tasks: phase, task, start, end, progress, after */', '/* 10 tareas: phase, task, start, end, progress, after */') },
    { id: 'map', label: t('A map', 'Un mapa'), ask: t('Which South American countries don’t speak Spanish? Use this GeoJSON.', '¿Qué países de Sudamérica no hablan español? Usa este GeoJSON.'), spec: languageSpec, data: t('/* 12 rows: country, language */', '/* 12 filas: country, language */'), geo: t('southAmerica, // any GeoJSON or TopoJSON', 'southAmerica, // cualquier GeoJSON o TopoJSON'), omit: ['markers', 'layers'], extra: { markers: '{ data: capitals, label: "city" }' } },
    { id: 'trend', label: t('A trend', 'Una tendencia'), ask: t('How did our three products grow since launch?', '¿Cómo crecieron nuestros tres productos desde el lanzamiento?'), spec: trendSpec, data: t('/* 72 rows: month, product, users */', '/* 72 filas: month, product, users */') },
    { id: 'mix', label: t('A breakdown', 'Una composición'), ask: t('Break exports down by sector and product, year by year.', 'Desglosa las exportaciones por sector y producto, año a año.'), spec: heroSpec, data: t('/* 65 rows: year, sector, product, value */', '/* 65 filas: year, sector, product, value */') },
  ];

  return { heroSpec, quickSpec, ganttSpec, languageSpec, trendSpec, badSpec, fixedSpec, exchanges, exportsRows, usersRows, storesRows };
}

// Exportaciones con nombre en inglés, como antes.
export const { heroSpec, quickSpec, ganttSpec, languageSpec, trendSpec, badSpec, fixedSpec, exchanges, exportsRows, usersRows, storesRows } = homeSpecs('en');
