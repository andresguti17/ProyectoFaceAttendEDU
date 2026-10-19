// ISO/IEC 29110 — Instrumento de valoración de procesos para entidades muy pequeñas (VSE).
// Perfil Basic (adaptado): 2 procesos — Gestión de Proyecto (PM) e Implementación de Software (SI).
// Escala de calificación por objetivo adaptada de ISO/IEC 33020: N/P/L/F.

export type ObjectiveRating = 'N' | 'P' | 'L' | 'F';

export const RATING_VALUES: Record<ObjectiveRating, number> = { N: 0, P: 1, L: 2, F: 3 };

export const RATING_LABELS: Record<ObjectiveRating, string> = {
  N: 'No alcanzado (0-15%)',
  P: 'Parcialmente alcanzado (>15-50%)',
  L: 'Largamente alcanzado (>50-85%)',
  F: 'Completamente alcanzado (>85%)',
};

export interface ProcessObjective {
  id: string; // ej: "PM.O1"
  statement: string; // objetivo evaluable del instrumento
  evidence: string; // evidencia esperada (producto de trabajo)
}

export interface Iso29110Process {
  id: string; // "PM" | "SI"
  name: string;
  purpose: string;
  activities: string[];
  objectives: ProcessObjective[];
}

export interface WorkProduct {
  id: string; // ej: "WP5"
  name: string;
  process: string; // proceso que lo genera
}

export const ISO29110_PROCESSES: Iso29110Process[] = [
  {
    id: 'PM',
    name: 'Gestión de Proyecto',
    purpose: 'Establecer y llevar a cabo de forma sistemática las tareas del proyecto (planificación, ejecución, evaluación y cierre).',
    activities: ['PM.1 Planificación del proyecto', 'PM.2 Ejecución del plan', 'PM.3 Evaluación y control', 'PM.4 Cierre del proyecto'],
    objectives: [
      { id: 'PM.O1', statement: 'El plan de proyecto (alcance, tareas, cronograma, recursos y riesgos) está documentado y aceptado.', evidence: 'WP2 Plan de proyecto' },
      { id: 'PM.O2', statement: 'Las tareas están asignadas y su avance se monitorea contra el plan.', evidence: 'WP3 Registro de avance/estado' },
      { id: 'PM.O3', statement: 'Los riesgos y desviaciones se identifican y se aplican acciones correctivas.', evidence: 'WP3 Registro de avance/estado' },
      { id: 'PM.O4', statement: 'Las solicitudes de cambio se registran, evalúan y aprueban antes de implementarse.', evidence: 'WP4 Solicitudes de cambio' },
      { id: 'PM.O5', statement: 'Se realizan revisiones con el cliente/usuario y quedan registradas.', evidence: 'WP3 Registro de avance/estado' },
      { id: 'PM.O6', statement: 'Existe estrategia de control de versiones y respaldo del repositorio del proyecto.', evidence: 'WP11 Repositorio/configuración' },
      { id: 'PM.O7', statement: 'La entrega cuenta con aceptación formal del cliente.', evidence: 'WP10 Acta de aceptación' },
      { id: 'PM.O8', statement: 'Al cierre se archivan productos, lecciones aprendidas y línea base del proyecto.', evidence: 'WP11 Repositorio/configuración' },
    ],
  },
  {
    id: 'SI',
    name: 'Implementación de Software',
    purpose: 'Ejecutar de forma sistemática las actividades de análisis, diseño, construcción, integración, pruebas y entrega.',
    activities: [
      'SI.1 Inicio de la implementación',
      'SI.2 Análisis de requerimientos',
      'SI.3 Diseño de software',
      'SI.4 Construcción',
      'SI.5 Integración y pruebas',
      'SI.6 Entrega del producto',
    ],
    objectives: [
      { id: 'SI.O1', statement: 'Los requerimientos están documentados, verificados y validados con el cliente.', evidence: 'WP5 Especificación de requerimientos' },
      { id: 'SI.O2', statement: 'Existe trazabilidad entre requerimientos, diseño, código y pruebas.', evidence: 'WP7 Matriz de trazabilidad' },
      { id: 'SI.O3', statement: 'El diseño de software está documentado y verificado antes de construir.', evidence: 'WP6 Diseño de software' },
      { id: 'SI.O4', statement: 'Los componentes están construidos y cuentan con pruebas unitarias.', evidence: 'WP8 Componentes + pruebas unitarias' },
      { id: 'SI.O5', statement: 'La integración es incremental e incluye pruebas de integración y regresión.', evidence: 'WP9 Reportes de prueba' },
      { id: 'SI.O6', statement: 'Los defectos se registran, corrigen y re-verifican hasta su cierre.', evidence: 'WP9 Reportes de prueba' },
      { id: 'SI.O7', statement: 'Los casos y procedimientos de prueba están documentados y ejecutados.', evidence: 'WP9 Casos de prueba' },
      { id: 'SI.O8', statement: 'El ambiente y los datos de prueba están controlados y son reproducibles.', evidence: 'WP9 Reportes de prueba' },
      { id: 'SI.O9', statement: 'Los cambios de requerimientos se evalúan en impacto y se incorporan a la línea base.', evidence: 'WP4 Solicitudes de cambio' },
      { id: 'SI.O10', statement: 'Los productos de trabajo pasan por verificación o revisión entre pares.', evidence: 'WP3 Registro de avance/estado' },
      { id: 'SI.O11', statement: 'La línea base del producto está bajo control de versiones e identificada.', evidence: 'WP11 Repositorio/configuración' },
      { id: 'SI.O12', statement: 'La entrega incluye manuales/documentación de usuario u operación según aplique.', evidence: 'WP10 Producto/entrega' },
    ],
  },
];

export const ISO29110_WORK_PRODUCTS: WorkProduct[] = [
  { id: 'WP1', name: 'Enunciado de trabajo', process: 'PM' },
  { id: 'WP2', name: 'Plan de proyecto', process: 'PM' },
  { id: 'WP3', name: 'Registro de avance/estado', process: 'PM' },
  { id: 'WP4', name: 'Solicitudes de cambio', process: 'PM' },
  { id: 'WP5', name: 'Especificación de requerimientos', process: 'SI' },
  { id: 'WP6', name: 'Diseño de software', process: 'SI' },
  { id: 'WP7', name: 'Matriz de trazabilidad', process: 'SI' },
  { id: 'WP8', name: 'Componentes + pruebas unitarias', process: 'SI' },
  { id: 'WP9', name: 'Casos y reportes de prueba', process: 'SI' },
  { id: 'WP10', name: 'Producto/entrega + acta de aceptación', process: 'SI' },
  { id: 'WP11', name: 'Repositorio/configuración y línea base', process: 'PM' },
];

export const ISO29110_OBJECTIVE_COUNT = ISO29110_PROCESSES.reduce((acc, p) => acc + p.objectives.length, 0); // 20

export const ALL_OBJECTIVE_IDS = ISO29110_PROCESSES.flatMap((p) => p.objectives.map((o) => o.id));

export function processOfObjective(objectiveId: string): string | null {
  const prefix = objectiveId.split('.')[0];
  return ISO29110_PROCESSES.some((p) => p.id === prefix) ? prefix : null;
}

/** % de logro de un proceso (0-100) a partir de calificaciones N/P/L/F. */
export function scoreProcess(ratings: Record<string, ObjectiveRating>, processId: string): number {
  const proc = ISO29110_PROCESSES.find((p) => p.id === processId);
  if (!proc || !proc.objectives.length) return 0;
  const total = proc.objectives.reduce((acc, o) => acc + (RATING_VALUES[ratings[o.id]] ?? 0), 0);
  return Math.round((total / (proc.objectives.length * 3)) * 1000) / 10;
}

/** Calificación agregada del proceso según umbrales adaptados de ISO/IEC 33020. */
export function rateProcess(percentage: number): ObjectiveRating {
  if (percentage <= 15) return 'N';
  if (percentage <= 50) return 'P';
  if (percentage <= 85) return 'L';
  return 'F';
}

/** Preparación para entrega: todos los procesos al menos Largamente alcanzados (>50%). */
export function deliveryReadiness(byProcess: Record<string, number>): { ready: boolean; label: string } {
  const ready = Object.values(byProcess).length > 0 && Object.values(byProcess).every((v) => v > 50);
  return { ready, label: ready ? 'Listo para entrega' : 'No listo para entrega' };
}
