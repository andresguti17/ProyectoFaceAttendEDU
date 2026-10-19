// Entidad de dominio: evaluación de madurez de pruebas según ISTQB CTFL v4.0.
export type IstqbAssessmentStatus = 'Draft' | 'Completed';

export interface IstqbAssessment {
  assessmentId: number;
  service: string; // ej: "03-ms-academic", "05-ms-attendance"
  evaluator: string;
  scope: string; // ej: "CRUD enrollments", "CRUD alerts"
  scores: Record<string, number>; // itemId -> 1..5
  comments?: string;
  status: IstqbAssessmentStatus;
  // Derivados del instrumento ISTQB
  globalScore?: number;
  percentage?: number;
  level?: string;
  byCategory?: Record<string, number>;
  // Trazabilidad con ISO 29110 / ISO 25010
  projectId?: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}
