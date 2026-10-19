import type { QualityProject } from '../../entities/QualityProject';
import type { ListPage, PagedResult } from './Paging';

/** Datos necesarios para crear un proyecto (sin campos derivados de la persistencia). */
export type QualityProjectInput = Omit<QualityProject, 'projectId' | 'createdAt' | 'updatedAt' | 'deletedAt'>;

/** Parche parcial: solo las claves presentes se actualizan. */
export type QualityProjectPatch = Partial<QualityProjectInput>;

export interface QualityProjectFilter {
  status?: string;
}

/**
 * Puerto de salida del agregado `QualityProject` (ISO/IEC 29110).
 * Tabla: `quality.quality_project`. Borrado lógico (`deleted_at`).
 */
export interface IQualityProjectRepository {
  create(input: QualityProjectInput): Promise<QualityProject>;
  findById(id: number): Promise<QualityProject | null>;
  list(filter: QualityProjectFilter, page: ListPage): Promise<PagedResult<QualityProject>>;
  update(id: number, patch: QualityProjectPatch): Promise<QualityProject | null>;
  /** Marca `deleted_at`; devuelve `false` si el registro no existe o ya estaba borrado. */
  softDelete(id: number): Promise<boolean>;
}
