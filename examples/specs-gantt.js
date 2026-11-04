// Cartas Gantt. Datos ILUSTRATIVOS.
const SRC = 'datos ilustrativos';

export const planProyecto = [
  { fase: 'Diagnóstico', tarea: 'Entrevistas con usuarios', inicio: '2026-01-05', fin: '2026-01-23', avance: 100 },
  { fase: 'Diagnóstico', tarea: 'Mapa de procesos', inicio: '2026-01-19', fin: '2026-02-06', avance: 100, depende: 'Entrevistas con usuarios' },
  { fase: 'Diagnóstico', tarea: 'Informe de hallazgos', inicio: '2026-02-09', fin: '2026-02-09', hito: true, depende: 'Mapa de procesos' },
  { fase: 'Diseño', tarea: 'Arquitectura de datos', inicio: '2026-02-09', fin: '2026-03-06', avance: 80, depende: 'Informe de hallazgos' },
  { fase: 'Diseño', tarea: 'Prototipo del agente', inicio: '2026-02-23', fin: '2026-03-27', avance: 45 },
  { fase: 'Construcción', tarea: 'Integración con el ERP', inicio: '2026-03-16', fin: '2026-04-30', avance: 10, depende: 'Arquitectura de datos' },
  { fase: 'Construcción', tarea: 'Panel de indicadores', inicio: '2026-04-06', fin: '2026-05-15', avance: 0, depende: 'Prototipo del agente' },
  { fase: 'Construcción', tarea: 'Pruebas con usuarios', inicio: '2026-05-04', fin: '2026-05-29', avance: 0, tentativo: true },
  { fase: 'Cierre', tarea: 'Capacitación', inicio: '2026-06-01', fin: '2026-06-12', avance: 0, tentativo: true, depende: 'Pruebas con usuarios' },
  { fase: 'Cierre', tarea: 'Puesta en marcha', inicio: '2026-06-15', fin: '2026-06-15', hito: true, depende: 'Capacitación' },
];

export const lanzamiento = [
  { equipo: 'Producto', tarea: 'Definir alcance', semana: 1, semanas: 2 },
  { equipo: 'Diseño', tarea: 'Identidad y empaque', semana: 2, semanas: 4 },
  { equipo: 'Producto', tarea: 'Versión beta', semana: 3, semanas: 5 },
  { equipo: 'Marketing', tarea: 'Campaña en redes', semana: 6, semanas: 5 },
  { equipo: 'Ventas', tarea: 'Capacitar canal', semana: 7, semanas: 3 },
  { equipo: 'Marketing', tarea: 'Evento de lanzamiento', semana: 11, semanas: 1 },
  { equipo: 'Ventas', tarea: 'Primeros pedidos', semana: 11, semanas: 2 },
];

export const ganttGallery = [
  {
    id: 'gantt',
    name: 'Carta Gantt',
    nameEn: 'Gantt chart',
    note: 'Tareas con `start` y `end`, agrupadas por fase con `group`. La parte llena es el avance (`progress`), los rombos son hitos, las flechas salen de `dependsOn` y `today` marca dónde estamos. Lo tentativo va rayado con `dashed`.',
    noteEn: 'Tasks with `start` and `end`, grouped by phase with `group`. The filled part is the progress (`progress`), diamonds are milestones, arrows come from `dependsOn` and `today` marks where we are. Tentative work is hatched with `dashed`.',
    spec: {
      type: 'gantt',
      title: 'El proyecto llega a producción el 15 de junio; la integración con el ERP es la ruta crítica',
      subtitle: 'Plan de trabajo por fase, 2026. La parte llena de cada barra es el avance',
      source: SRC,
      data: planProyecto,
      task: 'tarea', start: 'inicio', end: 'fin', group: 'fase', progress: 'avance', dependsOn: 'depende', milestone: 'hito',
      today: '2026-03-12', dashed: 'tentativo', dashedLabel: 'Por confirmar',
    },
  },
  {
    id: 'gantt-semanas',
    name: 'Cronograma en semanas',
    nameEn: 'Schedule in weeks',
    note: 'Sin fechas: `start` en número de semana y `duration` en semanas. Con `groupHeaders: false` los equipos van en una leyenda de colores y `highlight` destaca uno.',
    noteEn: 'No dates: `start` as a week number and `duration` in weeks. With `groupHeaders: false` teams go in a color legend, and `highlight` brings one forward.',
    spec: {
      type: 'gantt',
      title: 'Marketing concentra su trabajo en las últimas seis semanas del lanzamiento',
      subtitle: 'Cronograma de lanzamiento por equipo, semanas desde el inicio',
      source: SRC,
      data: lanzamiento,
      task: 'tarea', start: 'semana', duration: 'semanas', group: 'equipo', groupHeaders: false, highlight: 'Marketing', xLabel: 'Semana',
    },
  },
];
