import type { PoolClient } from 'pg';
import { runQuery, runQueryWith, withTransaction } from '../../db/database';
import type {
  IIstqbAssessmentRepository,
  IstqbAssessmentFilter,
  IstqbAssessmentInput,
  IstqbAssessmentPatch,
} from '../../../domain/ports/out/IIstqbAssessmentRepository';
import type { ListPage, PagedResult } from '../../../domain/ports/out/Paging';
import type { IstqbAssessment } from '../../../domain/entities/IstqbAssessment';
import { scoreIstqbEvaluation } from '../../../domain/istqb';
import { buildAndFilters, buildSetClause, recordToArrays } from './sql.builder';
import { loadItems, toNumberRecord, writeItems, type ItemCollectionConfig } from './item-collection';
import { mapIstqbAssessmentRow, type IstqbAssessmentRow } from './row.mapper';

/** Lista blanca campo de dominio → columna física de `quality.istqb_assessment`. */
const ASSESSMENT_FIELDS = {
  service: 'service_name',
  evaluator: 'evaluator_name',
  scope: 'assessment_scope',
  projectId: 'project_id',
  status: 'assessment_status',
  comments: 'comments',
  globalScore: 'global_score',
  percentage: 'percentage',
  level: 'quality_level',
} as const;

/** Ítems Likert 1-5 del catálogo ISTQB CTFL v4.0. */
const ITEM_COLLECTION: ItemCollectionConfig = {
  table: 'quality.istqb_assessment_item',
  parentColumn: 'istqb_assessment_id',
  codeColumn: 'item_code',
  valueColumn: 'score',
  codeArrayType: 'varchar[]',
  valueArrayType: 'smallint[]',
};

/**
 * `created_at` / `updated_at` / `row_version` NUNCA se escriben desde SQL:
 * los gestiona el trigger `quality.trg_audit_istqb_assessment`.
 */
const RETURNING_COLUMNS = `
  istqb_assessment_id, service_name, evaluator_name, assessment_scope, project_id,
  assessment_status, comments, global_score, percentage, quality_level,
  created_at, updated_at, deleted_at`;

export class PgIstqbAssessmentRepository implements IIstqbAssessmentRepository {
  async create(input: IstqbAssessmentInput): Promise<IstqbAssessment> {
    return withTransaction(async (client) => {
      const rows = await runQueryWith<IstqbAssessmentRow>(
        client,
        `INSERT INTO quality.istqb_assessment
           (service_name, evaluator_name, assessment_scope, project_id,
            assessment_status, comments, global_score, percentage, quality_level)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING ${RETURNING_COLUMNS}`,
        [
          input.service,
          input.evaluator,
          input.scope,
          input.projectId ?? null,
          input.status,
          input.comments ?? null,
          input.globalScore ?? null,
          input.percentage ?? null,
          input.level ?? null,
        ],
      );
      const row = rows[0];
      await this.replaceItems(client, row.istqb_assessment_id, input.scores);
      return this.toEntity(row, input.scores);
    });
  }

  async findById(id: number): Promise<IstqbAssessment | null> {
    const rows = await runQuery<IstqbAssessmentRow>(
      `SELECT ${RETURNING_COLUMNS}
         FROM quality.istqb_assessment
        WHERE istqb_assessment_id = $1 AND deleted_at IS NULL`,
      [id],
    );
    if (!rows.length) return null;
    const items = await loadItems(ITEM_COLLECTION, [id]);
    return this.toEntity(rows[0], toNumberRecord(items.get(id)));
  }

  async list(filter: IstqbAssessmentFilter, page: ListPage): Promise<PagedResult<IstqbAssessment>> {
    const where = buildAndFilters([
      { column: 'service_name', value: filter.service },
      { column: 'assessment_status', value: filter.status },
      { column: 'project_id', value: filter.projectId },
    ]);
    const baseWhere = `WHERE deleted_at IS NULL${where.sql}`;

    const counted = await runQuery<{ total: number }>(
      `SELECT count(*) AS total FROM quality.istqb_assessment ${baseWhere}`,
      where.values,
    );
    const rows = await runQuery<IstqbAssessmentRow>(
      `SELECT ${RETURNING_COLUMNS}
         FROM quality.istqb_assessment
         ${baseWhere}
        ORDER BY istqb_assessment_id ASC
        LIMIT $${where.values.length + 1} OFFSET $${where.values.length + 2}`,
      [...where.values, page.limit, page.offset],
    );
    if (!rows.length) return { data: [], total: counted[0]?.total ?? 0 };

    const items = await loadItems(ITEM_COLLECTION, rows.map((row) => row.istqb_assessment_id));
    return {
      data: rows.map((row) => this.toEntity(row, toNumberRecord(items.get(row.istqb_assessment_id)))),
      total: counted[0]?.total ?? 0,
    };
  }

  async update(id: number, patch: IstqbAssessmentPatch): Promise<IstqbAssessment | null> {
    const set = buildSetClause(ASSESSMENT_FIELDS, patch as Partial<Record<string, unknown>>);
    const hasScores = Object.prototype.hasOwnProperty.call(patch, 'scores') && patch.scores !== undefined;

    return withTransaction(async (client) => {
      const rows = set.sql
        ? await runQueryWith<IstqbAssessmentRow>(
            client,
            `UPDATE quality.istqb_assessment
                SET ${set.sql}
              WHERE istqb_assessment_id = $1 AND deleted_at IS NULL
              RETURNING ${RETURNING_COLUMNS}`,
            [id, ...set.values],
          )
        : await runQueryWith<IstqbAssessmentRow>(
            client,
            `SELECT ${RETURNING_COLUMNS}
               FROM quality.istqb_assessment
              WHERE istqb_assessment_id = $1 AND deleted_at IS NULL
              FOR UPDATE`,
            [id],
          );
      if (!rows.length) return null;

      const scores = hasScores
        ? (patch.scores as Record<string, number>)
        : toNumberRecord((await loadItems(ITEM_COLLECTION, [id], client)).get(id));
      if (hasScores) await this.replaceItems(client, id, patch.scores as Record<string, number>);

      return this.toEntity(rows[0], scores);
    });
  }

  async softDelete(id: number): Promise<boolean> {
    const rows = await runQuery<{ istqb_assessment_id: number }>(
      `UPDATE quality.istqb_assessment
          SET deleted_at = CURRENT_TIMESTAMP
        WHERE istqb_assessment_id = $1 AND deleted_at IS NULL
        RETURNING istqb_assessment_id`,
      [id],
    );
    return rows.length > 0;
  }

  /** UPSERT de los ítems recibidos + borrado lógico de los que dejaron de existir. */
  private async replaceItems(
    client: PoolClient,
    assessmentId: number,
    scores: Record<string, number> | undefined,
  ): Promise<void> {
    await writeItems(client, ITEM_COLLECTION, assessmentId, recordToArrays(scores ?? {}));
  }

  /**
   * Reconstruye la entidad. Los escalares derivados salen de las columnas persistidas;
   * `byCategory` es una proyección pura del catálogo ISTQB en código y se recalcula
   * a partir de los ítems leídos.
   */
  private toEntity(row: IstqbAssessmentRow, scores: Record<string, number>): IstqbAssessment {
    return mapIstqbAssessmentRow(row, scores, scoreIstqbEvaluation(scores).byCategory);
  }
}
