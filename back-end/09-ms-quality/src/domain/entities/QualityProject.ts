// Entidades de dominio: gestión de proyecto y valoración de procesos ISO/IEC 29110 (perfil Basic).
export type ProjectStatus = 'Planned' | 'Active' | 'Closed';
export type AssessmentStatus = 'Draft' | 'Completed';

export interface QualityProject {
  projectId: number;
  name: string;
  description?: string;
  customer?: string;
  plannedStart?: string;
  plannedEnd?: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface ProcessAssessment {
  assessmentId: number;
  projectId: number;
  processId: string; // "PM" | "SI"
  assessor: string;
  ratings: Record<string, string>; // objectiveId -> "N" | "P" | "L" | "F"
  comments?: string;
  status: AssessmentStatus;
  score?: number; // % de logro del proceso 0-100
  rating?: string; // N | P | L | F agregado
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}
