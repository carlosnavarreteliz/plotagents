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

export const ampliacionSucursal = [
  { fase: 'Permisos', tarea: 'Levantamiento del local', inicio: '2026-03-02', fin: '2026-03-06', avance: 100 },
  { fase: 'Permisos', tarea: 'Planos y especificaciones', inicio: '2026-03-09', fin: '2026-03-20', avance: 100, depende: 'Levantamiento del local' },
  { fase: 'Permisos', tarea: 'Permiso municipal', inicio: '2026-03-23', fin: '2026-04-03', avance: 100, depende: 'Planos y especificaciones' },
  { fase: 'Permisos', tarea: 'Permiso aprobado', inicio: '2026-04-06', depende: 'Permiso municipal' },
  { fase: 'Obra gruesa', tarea: 'Demolición interior', inicio: '2026-04-06', fin: '2026-04-10', avance: 100, depende: 'Permiso aprobado' },
  { fase: 'Obra gruesa', tarea: 'Tabiquería', inicio: '2026-04-13', fin: '2026-04-24', avance: 30, depende: 'Demolición interior' },
  { fase: 'Obra gruesa', tarea: 'Instalaciones eléctricas', inicio: '2026-04-13', fin: '2026-05-01', avance: 20, depende: 'Demolición interior' },
  { fase: 'Obra gruesa', tarea: 'Climatización', inicio: '2026-04-27', fin: '2026-05-15', avance: 0, depende: 'Tabiquería' },
  { fase: 'Terminaciones', tarea: 'Pintura y pisos', inicio: '2026-05-18', fin: '2026-05-29', avance: 0, depende: 'Instalaciones eléctricas, Climatización' },
  { fase: 'Terminaciones', tarea: 'Señalética', inicio: '2026-05-25', fin: '2026-06-05', avance: 0 },
  { fase: 'Terminaciones', tarea: 'Mobiliario', inicio: '2026-06-01', fin: '2026-06-12', avance: 0, depende: 'Pintura y pisos' },
  { fase: 'Apertura', tarea: 'Capacitación del equipo', inicio: '2026-06-08', fin: '2026-06-17', avance: 0 },
  { fase: 'Apertura', tarea: 'Marcha blanca', inicio: '2026-06-15', fin: '2026-06-19', avance: 0, depende: 'Mobiliario' },
  { fase: 'Apertura', tarea: 'Apertura al público', inicio: '2026-06-22', depende: 'Marcha blanca, Capacitación del equipo' },
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
  {
    id: 'gantt-fases',
    name: 'Fases desplegables y ruta crítica',
    nameEn: 'Collapsible phases and critical path',
    note: 'Con `collapsed` una fase se resume en una sola fila: su avance ponderado por duración y sus hitos (`true` contrae todas). En el navegador, un clic en la fase la abre o la cierra. `critical: true` marca la ruta crítica, las tareas sin holgura; en planes cortos los fines de semana van sombreados.',
    noteEn: 'With `collapsed` a phase rolls up into one row: its duration-weighted progress and its milestones (`true` collapses them all). In the browser, a click on the phase opens or closes it. `critical: true` marks the critical path, the tasks with no slack; short plans shade weekends.',
    spec: {
      type: 'gantt',
      title: 'La apertura del 22 de junio no tiene holgura: un día de atraso en la climatización la mueve',
      subtitle: 'Plan de ampliación de la sucursal por fase, 2026. Permisos, ya cerrada, va contraída; la parte llena es el avance',
      source: SRC,
      data: ampliacionSucursal,
      task: 'tarea', start: 'inicio', end: 'fin', group: 'fase', progress: 'avance', dependsOn: 'depende',
      today: '2026-04-15', collapsed: ['Permisos'], critical: true,
    },
  },
];
