// ISO/IEC 25010:2011 — Instrumento de valoración de calidad del producto.
// 8 características + subcaracterísticas con pregunta Likert 1-5 y peso por característica.
// Pesos suman 1.0 y reflejan criticidad en FaceAttend-Edu (asistencia biométrica).

export interface IsoSubcharacteristic {
  id: string; // ej: "functional-completeness"
  name: string;
  question: string; // ítem del instrumento (escala 1-5)
}

export interface IsoCharacteristic {
  id: string; // ej: "functional-suitability"
  name: string;
  weight: number; // peso en el puntaje global
  subcharacteristics: IsoSubcharacteristic[];
}

export const ISO25010_CHARACTERISTICS: IsoCharacteristic[] = [
  {
    id: 'functional-suitability',
    name: 'Adecuación funcional',
    weight: 0.2,
    subcharacteristics: [
      { id: 'functional-completeness', name: 'Completitud funcional', question: 'El CRUD implementa todas las operaciones requeridas (crear, leer, actualizar, eliminar) sin funciones faltantes.' },
      { id: 'functional-correctness', name: 'Corrección funcional', question: 'Los resultados del CRUD son correctos (códigos HTTP, datos persistidos y validaciones).' },
      { id: 'functional-appropriateness', name: 'Pertinencia funcional', question: 'Las operaciones del CRUD son apropiadas y suficientes para la tarea del usuario.' },
    ],
  },
  {
    id: 'performance-efficiency',
    name: 'Eficiencia de desempeño',
    weight: 0.15,
    subcharacteristics: [
      { id: 'time-behaviour', name: 'Comportamiento temporal', question: 'Los tiempos de respuesta del CRUD son aceptables bajo carga normal.' },
      { id: 'resource-utilization', name: 'Utilización de recursos', question: 'El CRUD usa eficientemente CPU, memoria y conexiones a BD.' },
      { id: 'capacity', name: 'Capacidad', question: 'El CRUD soporta paginación y volúmenes altos sin degradarse (limit/offset, índices).' },
    ],
  },
  {
    id: 'compatibility',
    name: 'Compatibilidad',
    weight: 0.1,
    subcharacteristics: [
      { id: 'co-existence', name: 'Coexistencia', question: 'El servicio convive con los demás microservicios sin conflictos (puertos, gateway, contratos).' },
      { id: 'interoperability', name: 'Interoperabilidad', question: 'El formato de errores/respuestas es interoperable y consistente entre servicios y gateway.' },
    ],
  },
  {
    id: 'usability',
    name: 'Usabilidad',
    weight: 0.1,
    subcharacteristics: [
      { id: 'operability', name: 'Capacidad de operación', question: 'Los mensajes de error y validación son claros y accionables para el consumidor del API.' },
      { id: 'user-error-protection', name: 'Protección contra errores', question: 'El CRUD previene errores de entrada mediante validación (tipos, requeridos, rangos).' },
      { id: 'learnability', name: 'Capacidad de aprendizaje', question: 'Los endpoints son predecibles y autodocumentados (nombres, verbos HTTP, códigos).' },
    ],
  },
  {
    id: 'reliability',
    name: 'Fiabilidad',
    weight: 0.15,
    subcharacteristics: [
      { id: 'maturity', name: 'Madurez', question: 'El CRUD opera sin fallos inesperados (excepciones controladas, sin 500 expuestos).' },
      { id: 'fault-tolerance', name: 'Tolerancia a fallos', question: 'Ante datos inválidos o caídas parciales el servicio responde con error controlado.' },
      { id: 'recoverability', name: 'Capacidad de recuperación', question: 'El servicio expone salud (health) y se recupera/reinicia correctamente.' },
      { id: 'availability', name: 'Disponibilidad', question: 'El CRUD está disponible vía gateway con rate-limit y CORS correctos.' },
    ],
  },
  {
    id: 'security',
    name: 'Seguridad',
    weight: 0.15,
    subcharacteristics: [
      { id: 'confidentiality', name: 'Confidencialidad', question: 'No se exponen datos sensibles ni stack traces en respuestas de error.' },
      { id: 'integrity', name: 'Integridad', question: 'Se preserva la integridad (soft-delete, validación, sin escrituras parciales).' },
      { id: 'authenticity', name: 'Autenticidad', question: 'Los endpoints sensibles exigen autenticación/autorización (JWT vía gateway).' },
      { id: 'accountability', name: 'Responsabilidad', question: 'Las operaciones son trazables (request-id, logs, auditoría created_by/updated_by).' },
    ],
  },
  {
    id: 'maintainability',
    name: 'Mantenibilidad',
    weight: 0.1,
    subcharacteristics: [
      { id: 'modularity', name: 'Modularidad', question: 'El código sigue arquitectura hexagonal por capas sin acoplamiento indebido.' },
      { id: 'analysability', name: 'Capacidad de análisis', question: 'Es fácil diagnosticar fallos (logs estructurados, códigos de error, health).' },
      { id: 'testability', name: 'Capacidad de prueba', question: 'El CRUD es verificable automáticamente (contratos y casos de prueba claros).' },
    ],
  },
  {
    id: 'portability',
    name: 'Portabilidad',
    weight: 0.05,
    subcharacteristics: [
      { id: 'adaptability', name: 'Adaptabilidad', question: 'El servicio es portable entre entornos (env vars, Docker, sin rutas hardcodeadas).' },
      { id: 'installability', name: 'Capacidad de instalación', question: 'El servicio se despliega e integra fácilmente (Dockerfile, health, kong.yml).' },
    ],
  },
];

export const ISO25010_QUESTION_COUNT = ISO25010_CHARACTERISTICS.reduce(
  (acc, c) => acc + c.subcharacteristics.length,
  0,
); // 24 ítems

export type QualityLevel = 'Deficiente' | 'En proceso' | 'Aceptable' | 'Bueno' | 'Excelente';

export function levelForScore(score: number): QualityLevel {
  if (score < 2) return 'Deficiente';
  if (score < 3) return 'En proceso';
  if (score < 3.75) return 'Aceptable';
  if (score < 4.5) return 'Bueno';
  return 'Excelente';
}

/** Calcula puntaje por característica (promedio simple 1-5) y global ponderado. */
export function scoreEvaluation(scores: Record<string, number>): {
  byCharacteristic: Record<string, number>;
  globalScore: number;
  percentage: number;
  level: QualityLevel;
} {
  const byCharacteristic: Record<string, number> = {};
  let global = 0;
  for (const c of ISO25010_CHARACTERISTICS) {
    const vals = c.subcharacteristics.map((s) => scores[s.id]).filter((v) => typeof v === 'number');
    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    byCharacteristic[c.id] = Math.round(avg * 100) / 100;
    global += avg * c.weight;
  }
  const globalScore = Math.round(global * 100) / 100;
  return {
    byCharacteristic,
    globalScore,
    percentage: Math.round((globalScore / 5) * 1000) / 10,
    level: levelForScore(globalScore),
  };
}

/** Todos los ids de subcaracterística válidos (claves esperadas en `scores`). */
export const ALL_SUBCHARACTERISTIC_IDS = ISO25010_CHARACTERISTICS.flatMap((c) =>
  c.subcharacteristics.map((s) => s.id),
);
