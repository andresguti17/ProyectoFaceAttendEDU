import type { IstqbAssessment } from '../../entities/IstqbAssessment';
import type { ListPage, PagedResult } from './Paging';

/**
 * Datos de una evaluación ISTQB CTFL v4.0 tal y como los entrega la capa HTTP:
 * el payload validado + los agregados derivados por `scoreIstqbEvaluation()`.
 * `byCategory` es una proyección del catálogo y NO se persiste
 * (se recalcula al leer a partir de `quality.istqb_assessment_item`).
 */
export type IstqbAssessmentInput = Omit<
  IstqbAssessment,
  'assessmentId' | 'byCategory' | 'createdAt' | 'updatedAt' | 'deletedAt'
>;

export type IstqbAssessmentPatch = Partial<IstqbAssessmentInput>;

export interface IstqbAssessmentFilter {
  service?: string;
  status?: string;
  projectId?: number;
}

/**
 * Puerto de salida del agregado `IstqbAssessment` (ISTQB CTFL v4.0).
 * Tablas: `quality.istqb_assessment` (cabecera) + `quality.istqb_assessment_item` (30 ítems Likert).
 */
export interface IIstqbAssessmentRepository {
  create(input: IstqbAssessmentInput): Promise<IstqbAssessment>;
  findById(id: number): Promise<IstqbAssessment | null>;
  list(filter: IstqbAssessmentFilter, page: ListPage): Promise<PagedResult<IstqbAssessment>>;
  update(id: number, patch: IstqbAssessmentPatch): Promise<IstqbAssessment | null>;
  /** Marca `deleted_at`; devuelve `false` si el registro no existe o ya estaba borrado. */
  softDelete(id: number): Promise<boolean>;
}
