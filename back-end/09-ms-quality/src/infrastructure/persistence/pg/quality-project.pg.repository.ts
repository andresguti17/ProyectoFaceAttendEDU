import { runQuery } from '../../db/database';
import type {
  IQualityProjectRepository,
  QualityProjectFilter,
  QualityProjectInput,
  QualityProjectPatch,
} from '../../../domain/ports/out/IQualityProjectRepository';
import type { ListPage, PagedResult } from '../../../domain/ports/out/Paging';
import type { QualityProject } from '../../../domain/entities/QualityProject';
import { buildAndFilters, buildSetClause } from './sql.builder';
import { mapQualityProjectRow, type QualityProjectRow } from './row.mapper';

/** Lista blanca campo de dominio → columna física. Única fuente de nombres de columna. */
const PROJECT_FIELDS = {
  name: 'project_name',
  description: 'description',
  customer: 'customer',
  plannedStart: 'planned_start_on',
  plannedEnd: 'planned_end_on',
  status: 'project_status',
} as const;

/**
 * `created_at` / `updated_at` / `row_version` NUNCA se escriben desde SQL:
 * son propiedad del trigger `quality.trg_audit_quality_project`.
 */
const RETURNING_COLUMNS = `
  project_id, project_name, description, customer,
  planned_start_on, planned_end_on, project_status,
  created_at, updated_at, deleted_at`;

export class PgQualityProjectRepository implements IQualityProjectRepository {
  async create(input: QualityProjectInput): Promise<QualityProject> {
    const rows = await runQuery<QualityProjectRow>(
      `INSERT INTO quality.quality_project
         (project_name, description, customer, planned_start_on, planned_end_on, project_status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${RETURNING_COLUMNS}`,
      [
        input.name,
        input.description ?? null,
        input.customer ?? null,
        input.plannedStart ?? null,
        input.plannedEnd ?? null,
        input.status,
      ],
    );
    return mapQualityProjectRow(rows[0]);
  }

  async findById(id: number): Promise<QualityProject | null> {
    const rows = await runQuery<QualityProjectRow>(
      `SELECT ${RETURNING_COLUMNS}
         FROM quality.quality_project
        WHERE project_id = $1 AND deleted_at IS NULL`,
      [id],
    );
    return rows.length ? mapQualityProjectRow(rows[0]) : null;
  }

  async list(filter: QualityProjectFilter, page: ListPage): Promise<PagedResult<QualityProject>> {
    const where = buildAndFilters([{ column: 'project_status', value: filter.status }]);
    const baseWhere = `WHERE deleted_at IS NULL${where.sql}`;

    const counted = await runQuery<{ total: number }>(
      `SELECT count(*) AS total FROM quality.quality_project ${baseWhere}`,
      where.values,
    );
    const rows = await runQuery<QualityProjectRow>(
      `SELECT ${RETURNING_COLUMNS}
         FROM quality.quality_project
         ${baseWhere}
        ORDER BY project_id ASC
        LIMIT $${where.values.length + 1} OFFSET $${where.values.length + 2}`,
      [...where.values, page.limit, page.offset],
    );
    return { data: rows.map(mapQualityProjectRow), total: counted[0]?.total ?? 0 };
  }

  async update(id: number, patch: QualityProjectPatch): Promise<QualityProject | null> {
    const set = buildSetClause(PROJECT_FIELDS, patch as Partial<Record<string, unknown>>);
    if (!set.sql) return this.findById(id);
    const rows = await runQuery<QualityProjectRow>(
      `UPDATE quality.quality_project
          SET ${set.sql}
        WHERE project_id = $1 AND deleted_at IS NULL
        RETURNING ${RETURNING_COLUMNS}`,
      [id, ...set.values],
    );
    return rows.length ? mapQualityProjectRow(rows[0]) : null;
  }

  async softDelete(id: number): Promise<boolean> {
    const rows = await runQuery<{ project_id: number }>(
      `UPDATE quality.quality_project
          SET deleted_at = CURRENT_TIMESTAMP
        WHERE project_id = $1 AND deleted_at IS NULL
        RETURNING project_id`,
      [id],
    );
    return rows.length > 0;
  }
}
