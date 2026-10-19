import type { PoolClient } from 'pg';
import { runQuery, runQueryWith, withTransaction } from '../../db/database';
import type {
  IProcessAssessmentRepository,
  ProcessAssessmentFilter,
  ProcessAssessmentInput,
  ProcessAssessmentPatch,
} from '../../../domain/ports/out/IProcessAssessmentRepository';
import type { ListPage, PagedResult } from '../../../domain/ports/out/Paging';
import type { ProcessAssessment } from '../../../domain/entities/QualityProject';
import { buildAndFilters, buildSetClause, recordToArrays } from './sql.builder';
import { loadItems, toStringRecord, writeItems, type ItemCollectionConfig } from './item-collection';
import { mapProcessAssessmentRow, type ProcessAssessmentRow } from './row.mapper';

/** Lista blanca campo de dominio → columna física de `quality.process_assessment`. */
const ASSESSMENT_FIELDS = {
  projectId: 'project_id',
  processId: 'process_code',
  assessor: 'assessor_name',
  status: 'assessment_status',
  comments: 'comments',
  score: 'process_score',
  rating: 'process_rating',
} as const;

/** Calificaciones N/P/L/F por objetivo ISO/IEC 29110. */
const RATING_COLLECTION: ItemCollectionConfig = {
  table: 'quality.process_assessment_rating',
  parentColumn: 'assessment_id',
  codeColumn: 'objective_code',
  valueColumn: 'objective_rating',
  codeArrayType: 'varchar[]',
  valueArrayType: 'quality.objective_rating[]',
};

/**
 * `created_at` / `updated_at` / `row_version` NUNCA se escriben desde SQL:
 * los gestiona el trigger `quality.trg_audit_process_assessment`.
 */
const RETURNING_COLUMNS = `
  assessment_id, project_id, process_code, assessor_name, assessment_status,
  comments, process_score, process_rating, created_at, updated_at, deleted_at`;

export class PgProcessAssessmentRepository implements IProcessAssessmentRepository {
  async create(input: ProcessAssessmentInput): Promise<ProcessAssessment> {
    return withTransaction(async (client) => {
      const rows = await runQueryWith<ProcessAssessmentRow>(
        client,
        `INSERT INTO quality.process_assessment
           (project_id, process_code, assessor_name, assessment_status, comments, process_score, process_rating)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING ${RETURNING_COLUMNS}`,
        [
          input.projectId,
          input.processId,
          input.assessor,
          input.status,
          input.comments ?? null,
          input.score ?? null,
          input.rating ?? null,
        ],
      );
      const row = rows[0];
      await this.replaceRatings(client, row.assessment_id, input.ratings);
      return mapProcessAssessmentRow(row, input.ratings);
    });
  }

  async findById(id: number): Promise<ProcessAssessment | null> {
    const rows = await runQuery<ProcessAssessmentRow>(
      `SELECT ${RETURNING_COLUMNS}
         FROM quality.process_assessment
        WHERE assessment_id = $1 AND deleted_at IS NULL`,
      [id],
    );
    if (!rows.length) return null;
    const ratings = await loadItems(RATING_COLLECTION, [id]);
    return mapProcessAssessmentRow(rows[0], toStringRecord(ratings.get(id)));
  }

  async list(filter: ProcessAssessmentFilter, page: ListPage): Promise<PagedResult<ProcessAssessment>> {
    const where = buildAndFilters([
      { column: 'project_id', value: filter.projectId },
      { column: 'process_code', value: filter.processId },
    ]);
    const baseWhere = `WHERE deleted_at IS NULL${where.sql}`;

    const counted = await runQuery<{ total: number }>(
      `SELECT count(*) AS total FROM quality.process_assessment ${baseWhere}`,
      where.values,
    );
    const rows = await runQuery<ProcessAssessmentRow>(
      `SELECT ${RETURNING_COLUMNS}
         FROM quality.process_assessment
         ${baseWhere}
        ORDER BY assessment_id ASC
        LIMIT $${where.values.length + 1} OFFSET $${where.values.length + 2}`,
      [...where.values, page.limit, page.offset],
    );
    const total = counted[0]?.total ?? 0;
    if (!rows.length) return { data: [], total };

    const ratings = await loadItems(RATING_COLLECTION, rows.map((row) => row.assessment_id));
    return {
      data: rows.map((row) => mapProcessAssessmentRow(row, toStringRecord(ratings.get(row.assessment_id)))),
      total,
    };
  }

  async update(id: number, patch: ProcessAssessmentPatch): Promise<ProcessAssessment | null> {
    const set = buildSetClause(ASSESSMENT_FIELDS, patch as Partial<Record<string, unknown>>);
    const hasRatings = Object.prototype.hasOwnProperty.call(patch, 'ratings') && patch.ratings !== undefined;

    return withTransaction(async (client) => {
      const rows = set.sql
        ? await runQueryWith<ProcessAssessmentRow>(
            client,
            `UPDATE quality.process_assessment
                SET ${set.sql}
              WHERE assessment_id = $1 AND deleted_at IS NULL
              RETURNING ${RETURNING_COLUMNS}`,
            [id, ...set.values],
          )
        : await runQueryWith<ProcessAssessmentRow>(
            client,
            `SELECT ${RETURNING_COLUMNS}
               FROM quality.process_assessment
              WHERE assessment_id = $1 AND deleted_at IS NULL
              FOR UPDATE`,
            [id],
          );
      if (!rows.length) return null;

      const ratings = hasRatings
        ? (patch.ratings as Record<string, string>)
        : toStringRecord((await loadItems(RATING_COLLECTION, [id], client)).get(id));
      if (hasRatings) await this.replaceRatings(client, id, patch.ratings as Record<string, string>);

      return mapProcessAssessmentRow(rows[0], ratings);
    });
  }

  async softDelete(id: number): Promise<boolean> {
    const rows = await runQuery<{ assessment_id: number }>(
      `UPDATE quality.process_assessment
          SET deleted_at = CURRENT_TIMESTAMP
        WHERE assessment_id = $1 AND deleted_at IS NULL
        RETURNING assessment_id`,
      [id],
    );
    return rows.length > 0;
  }

  /** UPSERT de las calificaciones recibidas + borrado lógico de las que dejaron de existir. */
  private async replaceRatings(
    client: PoolClient,
    assessmentId: number,
    ratings: Record<string, string> | undefined,
  ): Promise<void> {
    await writeItems(client, RATING_COLLECTION, assessmentId, recordToArrays(ratings ?? {}));
  }
}
