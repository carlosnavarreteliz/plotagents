// Nubes de palabras. Datos ILUSTRATIVOS.
const SRC = 'datos ilustrativos';
const prioridades = [['datos', 120], ['inteligencia artificial', 96], ['clientes', 80], ['automatización', 74], ['costos', 61], ['tiempo', 58], ['equipo', 52], ['reportes', 47], ['seguridad', 41], ['capacitación', 38], ['ventas', 35], ['procesos', 33], ['calidad', 30], ['nube', 27], ['integración', 25], ['dashboard', 23], ['ERP', 22], ['privacidad', 20], ['proveedores', 18], ['contratos', 17], ['atención', 16], ['eficiencia', 15], ['innovación', 14], ['soporte', 13], ['licencias', 12], ['inventario', 11], ['regulación', 10], ['sostenibilidad', 9], ['talento', 9], ['pronósticos', 8], ['Excel', 7], ['agentes', 7], ['métricas', 6], ['riesgo', 6], ['logística', 5]]
  .map(([palabra, menciones]) => ({ palabra, menciones }));
const TEMA = { datos: 'Tecnología', 'inteligencia artificial': 'Tecnología', automatización: 'Tecnología', nube: 'Tecnología', integración: 'Tecnología', dashboard: 'Tecnología', ERP: 'Tecnología', seguridad: 'Tecnología', privacidad: 'Tecnología', Excel: 'Tecnología', agentes: 'Tecnología', equipo: 'Personas', capacitación: 'Personas', talento: 'Personas', atención: 'Personas', soporte: 'Personas' };

export const wordsGallery = [
  {
    id: 'nube-palabras',
    name: 'Nube de palabras',
    nameEn: 'Word cloud',
    note: 'Todas las palabras horizontales; el área de cada una es proporcional a su frecuencia, colocadas en espiral desde la más frecuente, sin choques y siempre igual para el mismo spec. Un solo tono que se oscurece con la frecuencia. Con `text: "…"` cuenta las palabras de un texto crudo, sin las vacías.',
    noteEn: 'Every word horizontal; each word\'s area is proportional to its frequency, placed in a spiral from the most frequent, without collisions and identical for the same spec. One hue that darkens with frequency. With `text: "…"` it counts the words in raw text, dropping stopwords.',
    spec: { type: 'wordcloud', title: '“Datos” e “inteligencia artificial” dominan lo que piden las empresas', subtitle: 'Menciones en 312 respuestas abiertas sobre prioridades digitales, 2026', source: SRC, data: prioridades, text: 'palabra', value: 'menciones' },
  },
  {
    id: 'nube-temas',
    name: 'Nube por tema',
    nameEn: 'Word cloud by theme',
    note: 'Con `series` cada palabra toma el color de su tema, con leyenda: el color dice algo, no decora.',
    noteEn: 'With `series` each word takes its theme\'s color, with a legend: color carries meaning instead of decorating.',
    spec: { type: 'wordcloud', title: 'Las peticiones de tecnología superan a las de personas y negocio', subtitle: 'Menciones por tema en 312 respuestas abiertas, 2026', source: SRC, data: prioridades.map((r) => ({ ...r, tema: TEMA[r.palabra] || 'Negocio' })), text: 'palabra', value: 'menciones', series: 'tema' },
  },
];
