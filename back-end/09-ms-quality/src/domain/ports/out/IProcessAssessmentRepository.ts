import type { ProcessAssessment } from '../../entities/QualityProject';
import type { ListPage, PagedResult } from './Paging';

/**
 * Datos de una valoración de proceso ISO/IEC 29110 tal y como los entrega la capa HTTP:
 * el payload validado + `score`/`rating` derivados por `scoreProcess()`/`rateProcess()`.
 * `ratings` se persiste normalizado en `quality.process_assessment_rating`.
 */
export type ProcessAssessmentInput = Omit<
  ProcessAssessment,
  'assessmentId' | 'createdAt' | 'updatedAt' | 'deletedAt'
>;

export type ProcessAssessmentPatch = Partial<ProcessAssessmentInput>;

export interface ProcessAssessmentFilter {
  projectId?: number;
  processId?: string;
}

/**
 * Puerto de salida del agregado `ProcessAssessment` (ISO/IEC 29110, perfil Basic).
 * Tablas: `quality.process_assessment` (cabecera) + `quality.process_assessment_rating` (objetivos N/P/L/F).
 */
export interface IProcessAssessmentRepository {
  create(input: ProcessAssessmentInput): Promise<ProcessAssessment>;
  findById(id: number): Promise<ProcessAssessment | null>;
  list(filter: ProcessAssessmentFilter, page: ListPage): Promise<PagedResult<ProcessAssessment>>;
  update(id: number, patch: ProcessAssessmentPatch): Promise<ProcessAssessment | null>;
  /** Marca `deleted_at`; devuelve `false` si el registro no existe o ya estaba borrado. */
  softDelete(id: number): Promise<boolean>;
}
