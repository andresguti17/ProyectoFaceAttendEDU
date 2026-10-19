import type { AlertRecord } from '../../../domain/entities/Alert';
import type { AlertFilter, IAlertRepository } from '../../../domain/ports/out/IAlertRepository';
import { PostgresCrudRepository, type FieldSpec } from './crud.repository';
import { AUDIT_FIELDS } from './audit.fields';

/**
 * PostgreSQL adapter for `notification.alert`.
 *
 * `academic_actor_id` and `alert_type_id` are plain columns; `academic_actor_id`
 * is a cross-context reference (no FK), validated by the application layer.
 */
export class PostgresAlertRepository
  extends PostgresCrudRepository<AlertRecord>
  implements IAlertRepository
{
  protected readonly qualifiedTable = 'notification.alert';
  protected readonly primaryKeyColumn = 'alert_id';
  protected readonly primaryKeyField = 'alertId';
  protected readonly fields: readonly FieldSpec[] = [
    { field: 'alertId', column: 'alert_id', writable: false },
    { field: 'academicActorId', column: 'academic_actor_id' },
    { field: 'alertTypeId', column: 'alert_type_id' },
    { field: 'raisedAt', column: 'raised_at' },
    { field: 'resolvedAt', column: 'resolved_at' },
    ...AUDIT_FIELDS,
  ];

  async findByActorAndType(actorId: number, typeId: number): Promise<AlertRecord[]> {
    const columns = this.fields.map((f) => f.column).join(', ');
    const rows = await this.select(
      `SELECT ${columns} FROM ${this.qualifiedTable} WHERE academic_actor_id = $1 AND alert_type_id = $2 AND deleted_at IS NULL`,
      [actorId, typeId],
    );
    return rows.map((row) => this.mapRow(row));
  }

  /**
   * `actorId`/`typeId`/`resolved` filter the SQL query itself, combined with
   * `LIMIT`/`OFFSET`, ports `AlertRepository.FindAll`
   * (`internal/infrastructure/postgres/alert_repository.go:56-104`).
   */
  async findFiltered(filter: AlertFilter): Promise<AlertRecord[]> {
    const columns = this.fields.map((f) => f.column).join(', ');
    const conditions: string[] = ['deleted_at IS NULL'];
    const params: unknown[] = [];

    if (filter.actorId !== undefined) {
      params.push(filter.actorId);
      conditions.push(`academic_actor_id = $${params.length}`);
    }
    if (filter.typeId !== undefined) {
      params.push(filter.typeId);
      conditions.push(`alert_type_id = $${params.length}`);
    }
    if (filter.resolved !== undefined) {
      conditions.push(filter.resolved ? 'resolved_at IS NOT NULL' : 'resolved_at IS NULL');
    }

    let sql = `SELECT ${columns} FROM ${this.qualifiedTable} WHERE ${conditions.join(' AND ')} ORDER BY raised_at DESC`;
    if (filter.limit !== undefined) {
      params.push(filter.limit);
      sql += ` LIMIT $${params.length}`;
    }
    if (filter.offset !== undefined) {
      params.push(filter.offset);
      sql += ` OFFSET $${params.length}`;
    }

    const rows = await this.select(sql, params);
    return rows.map((row) => this.mapRow(row));
  }
}
