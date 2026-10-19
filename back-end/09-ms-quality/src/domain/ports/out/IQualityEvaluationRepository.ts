import type { QualityEvaluation } from '../../entities/QualityEvaluation';
import type { ListPage, PagedResult } from './Paging';

/**
 * Datos de una evaluación ISO/IEC 25010 tal y como los entrega la capa HTTP:
 * el payload validado + los agregados derivados por `scoreEvaluation()`.
 * `byCharacteristic` es una proyección del catálogo y NO se persiste
 * (se recalcula al leer a partir de `quality.quality_evaluation_item`).
 */
export type QualityEvaluationInput = Omit<
  QualityEvaluation,
  'evaluationId' | 'byCharacteristic' | 'createdAt' | 'updatedAt' | 'deletedAt'
>;

export type QualityEvaluationPatch = Partial<QualityEvaluationInput>;

export interface QualityEvaluationFilter {
  service?: string;
  status?: string;
}

/**
 * Puerto de salida del agregado `QualityEvaluation` (ISO/IEC 25010).
 * Tablas: `quality.quality_evaluation` (cabecera) + `quality.quality_evaluation_item` (24 ítems Likert).
 */
export interface IQualityEvaluationRepository {
  create(input: QualityEvaluationInput): Promise<QualityEvaluation>;
  findById(id: number): Promise<QualityEvaluation | null>;
  list(filter: QualityEvaluationFilter, page: ListPage): Promise<PagedResult<QualityEvaluation>>;
  update(id: number, patch: QualityEvaluationPatch): Promise<QualityEvaluation | null>;
  /** Marca `deleted_at`; devuelve `false` si el registro no existe o ya estaba borrado. */
  softDelete(id: number): Promise<boolean>;
}
