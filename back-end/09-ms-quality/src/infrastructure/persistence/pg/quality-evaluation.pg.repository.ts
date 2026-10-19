import type { PoolClient } from 'pg';
import { runQuery, runQueryWith, withTransaction } from '../../db/database';
import type {
  IQualityEvaluationRepository,
  QualityEvaluationFilter,
  QualityEvaluationInput,
  QualityEvaluationPatch,
} from '../../../domain/ports/out/IQualityEvaluationRepository';
import type { ListPage, PagedResult } from '../../../domain/ports/out/Paging';
import type { QualityEvaluation } from '../../../domain/entities/QualityEvaluation';
import { scoreEvaluation } from '../../../domain/iso25010';
import { buildAndFilters, buildSetClause, recordToArrays } from './sql.builder';
import { loadItems, toNumberRecord, writeItems, type ItemCollectionConfig } from './item-collection';
import { mapQualityEvaluationRow, type QualityEvaluationRow } from './row.mapper';

/** Lista blanca campo de dominio → columna física de `quality.quality_evaluation`. */
const EVALUATION_FIELDS = {
  service: 'service_name',
  evaluator: 'evaluator_name',
  scope: 'evaluation_scope',
  projectId: 'project_id',
  status: 'evaluation_status',
  comments: 'comments',
  globalScore: 'global_score',
  percentage: 'percentage',
  level: 'quality_level',
} as const;

/** Ítems Likert 1-5 por subcaracterística del catálogo ISO/IEC 25010. */
const ITEM_COLLECTION: ItemCollectionConfig = {
  table: 'quality.quality_evaluation_item',
  parentColumn: 'evaluation_id',
  codeColumn: 'subcharacteristic_code',
  valueColumn: 'score',
  codeArrayType: 'varchar[]',
  valueArrayType: 'smallint[]',
};

/**
 * `created_at` / `updated_at` / `row_version` NUNCA se escriben desde SQL:
 * los gestiona el trigger `quality.trg_audit_quality_evaluation`.
 */
const RETURNING_COLUMNS = `
  evaluation_id, service_name, evaluator_name, evaluation_scope, project_id,
  evaluation_status, comments, global_score, percentage, quality_level,
  created_at, updated_at, deleted_at`;

export class PgQualityEvaluationRepository implements IQualityEvaluationRepository {
  async create(input: QualityEvaluationInput): Promise<QualityEvaluation> {
    return withTransaction(async (client) => {
      const rows = await runQueryWith<QualityEvaluationRow>(
        client,
        `INSERT INTO quality.quality_evaluation
           (service_name, evaluator_name, evaluation_scope, project_id,
            evaluation_status, comments, global_score, percentage, quality_level)
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
      await this.replaceItems(client, row.evaluation_id, input.scores);
      return this.toEntity(row, input.scores);
    });
  }

  async findById(id: number): Promise<QualityEvaluation | null> {
    const rows = await runQuery<QualityEvaluationRow>(
      `SELECT ${RETURNING_COLUMNS}
         FROM quality.quality_evaluation
        WHERE evaluation_id = $1 AND deleted_at IS NULL`,
      [id],
    );
    if (!rows.length) return null;
    const items = await loadItems(ITEM_COLLECTION, [id]);
    return this.toEntity(rows[0], toNumberRecord(items.get(id)));
  }

  async list(filter: QualityEvaluationFilter, page: ListPage): Promise<PagedResult<QualityEvaluation>> {
    const where = buildAndFilters([
      { column: 'service_name', value: filter.service },
      { column: 'evaluation_status', value: filter.status },
    ]);
    const baseWhere = `WHERE deleted_at IS NULL${where.sql}`;

    const counted = await runQuery<{ total: number }>(
      `SELECT count(*) AS total FROM quality.quality_evaluation ${baseWhere}`,
      where.values,
    );
    const rows = await runQuery<QualityEvaluationRow>(
      `SELECT ${RETURNING_COLUMNS}
         FROM quality.quality_evaluation
         ${baseWhere}
        ORDER BY evaluation_id ASC
        LIMIT $${where.values.length + 1} OFFSET $${where.values.length + 2}`,
      [...where.values, page.limit, page.offset],
    );
    if (!rows.length) return { data: [], total: counted[0]?.total ?? 0 };

    const items = await loadItems(ITEM_COLLECTION, rows.map((row) => row.evaluation_id));
    return {
      data: rows.map((row) => this.toEntity(row, toNumberRecord(items.get(row.evaluation_id)))),
      total: counted[0]?.total ?? 0,
    };
  }

  async update(id: number, patch: QualityEvaluationPatch): Promise<QualityEvaluation | null> {
    const set = buildSetClause(EVALUATION_FIELDS, patch as Partial<Record<string, unknown>>);
    const hasScores = Object.prototype.hasOwnProperty.call(patch, 'scores') && patch.scores !== undefined;

    return withTransaction(async (client) => {
      const rows = set.sql
        ? await runQueryWith<QualityEvaluationRow>(
            client,
            `UPDATE quality.quality_evaluation
                SET ${set.sql}
              WHERE evaluation_id = $1 AND deleted_at IS NULL
              RETURNING ${RETURNING_COLUMNS}`,
            [id, ...set.values],
          )
        : await runQueryWith<QualityEvaluationRow>(
            client,
            `SELECT ${RETURNING_COLUMNS}
               FROM quality.quality_evaluation
              WHERE evaluation_id = $1 AND deleted_at IS NULL
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
    const rows = await runQuery<{ evaluation_id: number }>(
      `UPDATE quality.quality_evaluation
          SET deleted_at = CURRENT_TIMESTAMP
        WHERE evaluation_id = $1 AND deleted_at IS NULL
        RETURNING evaluation_id`,
      [id],
    );
    return rows.length > 0;
  }

  /** UPSERT de los ítems recibidos + borrado lógico de los que dejaron de existir. */
  private async replaceItems(
    client: PoolClient,
    evaluationId: number,
    scores: Record<string, number> | undefined,
  ): Promise<void> {
    await writeItems(client, ITEM_COLLECTION, evaluationId, recordToArrays(scores ?? {}));
  }

  /**
   * Reconstruye la entidad. Los escalares derivados (`globalScore`, `percentage`, `level`)
   * salen de las columnas persistidas; `byCharacteristic` es una proyección pura del
   * catálogo ISO 25010 en código y se recalcula a partir de los ítems leídos.
   */
  private toEntity(row: QualityEvaluationRow, scores: Record<string, number>): QualityEvaluation {
    return mapQualityEvaluationRow(row, scores, scoreEvaluation(scores).byCharacteristic);
  }
}
