import type { AlertRecord } from '../../../domain/entities/Alert';
import type { IAlertRepository } from '../../../domain/ports/out/IAlertRepository';
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
}
