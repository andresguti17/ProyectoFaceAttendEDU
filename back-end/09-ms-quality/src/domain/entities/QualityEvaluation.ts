// Entidad de dominio: evaluación de calidad ISO 25010 aplicada a un CRUD/servicio.
export type EvaluationStatus = 'Draft' | 'Completed';

export interface QualityEvaluation {
  evaluationId: number;
  service: string; // ej: "01-ms-identity", "03-ms-academic", ...
  evaluator: string;
  scope: string; // ej: "CRUD cities", "CRUD enrollments"
  scores: Record<string, number>; // subcharacteristicId -> 1..5
  comments?: string;
  status: EvaluationStatus;
  globalScore?: number;
  percentage?: number;
  level?: string;
  byCharacteristic?: Record<string, number>;
  // Trazabilidad con ISO 29110 (la columna project_id existe en BD y el HTTP la acepta).
  projectId?: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}
