// ISTQB CTFL v4.0 — Instrumento de valoración de madurez de pruebas.
// 6 áreas + 30 ítems Likert 1-5 y peso por área.
// Pesos suman 1.0 y reflejan criticidad en FaceAttend-Edu (énfasis en técnicas y gestión).

export interface IstqbItem {
  id: string;
  name: string;
  question: string;
}

export interface IstqbCategory {
  id: string;
  name: string;
  syllabusRef: string;
  weight: number;
  items: IstqbItem[];
}

export const ISTQB_CATEGORIES: IstqbCategory[] = [
  {
    id: 'fundamentals',
    name: 'Fundamentos de pruebas',
    syllabusRef: 'CTFL 1',
    weight: 0.15,
    items: [
      { id: 'fund-principles', name: 'Principios del testing', question: 'Se aplican los 7 principios del testing (no exhaustivo, clustering de defectos, paradoja del pesticida, etc.) en la estrategia del CRUD.' },
      { id: 'fund-activities', name: 'Actividades del proceso de prueba', question: 'El proceso de prueba del CRUD cubre planificación, análisis, diseño, implementación, ejecución y cierre de forma trazable.' },
      { id: 'fund-psychology', name: 'Psicología y roles', question: 'Existe separación de roles e independencia (ej. revisión entre pares) y se comunica el defecto sin culpar.' },
      { id: 'fund-ethics', name: 'Ética y objetivo', question: 'El objetivo de cada nivel de prueba (detectar fallos vs. generar confianza) está definido y comunicado.' },
      { id: 'fund-debugging-vs-testing', name: 'Testing vs. debugging', question: 'Se distingue validación/testing de debugging y cada incidente genera corrección + retest.' },
    ],
  },
  {
    id: 'lifecycle',
    name: 'Pruebas a lo largo del ciclo de vida',
    syllabusRef: 'CTFL 2',
    weight: 0.15,
    items: [
      { id: 'lc-models', name: 'Modelos de ciclo de vida', question: 'Las pruebas están integradas al SDLC (shift-left, iterativo) y no son fase final.' },
      { id: 'lc-levels', name: 'Niveles de prueba', question: 'Están definidos y ejecutados los niveles unitario, integración, sistema y aceptación para el CRUD.' },
      { id: 'lc-types', name: 'Tipos de prueba', question: 'Se ejecutan tipos funcionales, no funcionales, caja blanca y de cambio (regresión/confirmación).' },
      { id: 'lc-maintenance', name: 'Pruebas de mantenimiento', question: 'Existe estrategia de regresión y análisis de impacto ante cambios en el CRUD.' },
      { id: 'lc-traceability', name: 'Trazabilidad', question: 'Hay trazabilidad bidireccional requisito ↔ caso de prueba ↔ defecto (matriz o herramienta).' },
    ],
  },
  {
    id: 'static-testing',
    name: 'Pruebas estáticas',
    syllabusRef: 'CTFL 3',
    weight: 0.15,
    items: [
      { id: 'static-reviews', name: 'Tipos de revisión', question: 'Se aplican revisiones informales, walkthrough, revisión técnica e inspección según criticidad.' },
      { id: 'static-process', name: 'Proceso de revisión', question: 'El proceso de revisión está formalizado (planificación, preparación, reunión, rework, seguimiento).' },
      { id: 'static-roles', name: 'Roles y responsabilidades', question: 'Están definidos autor, moderador, revisor, lector y registrador en cada revisión.' },
      { id: 'static-benefits', name: 'Análisis estático', question: 'Se usa análisis estático/linting Sonar/similar y sus hallazgos se miden (defectos tempranos).' },
    ],
  },
  {
    id: 'techniques',
    name: 'Técnicas de prueba',
    syllabusRef: 'CTFL 4',
    weight: 0.2,
    items: [
      { id: 'tech-ep', name: 'Partición de equivalencia', question: 'Los casos de prueba aplican partición de equivalencia en entradas del CRUD (válidas/inválidas).' },
      { id: 'tech-bva', name: 'Valores límite', question: 'Se cubren valores límite en paginación (0,1,100,101), IDs y longitudes de campos.' },
      { id: 'tech-dt', name: 'Tabla de decisión', question: 'Reglas de negocio combinatorias (permisos, estados) se validan con tabla de decisión.' },
      { id: 'tech-st', name: 'Transición de estados', question: 'Ciclos de vida de entidad (Draft→Completed, Planned→Closed, soft-delete) se prueban como máquinas de estado.' },
      { id: 'tech-wb', name: 'Cobertura caja blanca', question: 'Se mide cobertura de sentencia/decisión en rutas críticas y se exige umbral (>80%).' },
      { id: 'tech-eb', name: 'Basadas en experiencia', question: 'Se complementa con error guessing, exploratory testing y checklists de defectos históricos.' },
    ],
  },
  {
    id: 'management',
    name: 'Gestión de las actividades de prueba',
    syllabusRef: 'CTFL 5',
    weight: 0.2,
    items: [
      { id: 'mgmt-planning', name: 'Planificación', question: 'Existe plan de pruebas (IEEE 829) con alcance, criterios de entrada/salida y enfoque por riesgo.' },
      { id: 'mgmt-risk', name: 'Pruebas basadas en riesgo', question: 'Se priorizan pruebas por riesgo de producto/proyecto (probabilidad × impacto).' },
      { id: 'mgmt-monitoring', name: 'Seguimiento y control', question: 'Se monitorean métricas (coverage, defect density, pass rate) y se toman acciones correctivas.' },
      { id: 'mgmt-config', name: 'Gestión de configuración', question: 'Casos, datos y entornos de prueba están versionados y son reproducibles.' },
      { id: 'mgmt-defect', name: 'Gestión de defectos', question: 'El ciclo de defecto (nuevo→asignado→corregido→retesteado→cerrado) está definido y se mide tiempo de vida.' },
      { id: 'mgmt-closure', name: 'Cierre y lecciones', question: 'Al cierre se documentan lecciones aprendidas y se archivan pruebas para reutilización.' },
    ],
  },
  {
    id: 'tools',
    name: 'Herramientas de soporte',
    syllabusRef: 'CTFL 6',
    weight: 0.15,
    items: [
      { id: 'tool-classification', name: 'Clasificación de herramientas', question: 'Se usan herramientas de gestión, ejecución, análisis estático y CI/CD de forma integrada.' },
      { id: 'tool-selection', name: 'Selección e implantación', question: 'La selección de herramienta sigue piloto, criterios objetivos y análisis costo/beneficio.' },
      { id: 'tool-automation', name: 'Automatización', question: 'Existe pirámide de automatización (unit > integration > e2e) ejecutada en pipeline.' },
      { id: 'tool-risks', name: 'Riesgos y beneficios', question: 'Se evalúan riesgos de herramientas (vendor lock-in, falsos positivos) y se mitigan.' },
    ],
  },
];

export const ISTQB_QUESTION_COUNT = ISTQB_CATEGORIES.reduce((acc, c) => acc + c.items.length, 0); // 30 ítems

export type IstqbLevel = 'Deficiente' | 'En proceso' | 'Aceptable' | 'Bueno' | 'Excelente';

export function istqbLevelForScore(score: number): IstqbLevel {
  if (score < 2) return 'Deficiente';
  if (score < 3) return 'En proceso';
  if (score < 3.75) return 'Aceptable';
  if (score < 4.5) return 'Bueno';
  return 'Excelente';
}

/** Calcula puntaje por categoría (promedio 1-5) y global ponderado. */
export function scoreIstqbEvaluation(scores: Record<string, number>): {
  byCategory: Record<string, number>;
  globalScore: number;
  percentage: number;
  level: IstqbLevel;
} {
  const byCategory: Record<string, number> = {};
  let global = 0;
  for (const c of ISTQB_CATEGORIES) {
    const vals = c.items.map((s) => scores[s.id]).filter((v) => typeof v === 'number');
    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    byCategory[c.id] = Math.round(avg * 100) / 100;
    global += avg * c.weight;
  }
  const globalScore = Math.round(global * 100) / 100;
  return {
    byCategory,
    globalScore,
    percentage: Math.round((globalScore / 5) * 1000) / 10,
    level: istqbLevelForScore(globalScore),
  };
}

export const ALL_ISTQB_ITEM_IDS = ISTQB_CATEGORIES.flatMap((c) => c.items.map((s) => s.id));
