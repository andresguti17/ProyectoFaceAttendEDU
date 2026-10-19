import type { AlertTypeRecord } from '../../../domain/entities/AlertType';
import type { IAlertTypeRepository } from '../../../domain/ports/out/IAlertTypeRepository';
import { PostgresCrudRepository, type FieldSpec } from './crud.repository';
import { AUDIT_FIELDS } from './audit.fields';

/**
 * PostgreSQL adapter for `notification.alert_type` (catalogo de tipos de alerta).
 *
 * `alert_type_id` is SMALLINT and assigned by the database, so it is read-only here.
 */
export class PostgresAlertTypeRepository
  extends PostgresCrudRepository<AlertTypeRecord>
  implements IAlertTypeRepository
{
  protected readonly qualifiedTable = 'notification.alert_type';
  protected readonly primaryKeyColumn = 'alert_type_id';
  protected readonly primaryKeyField = 'alertTypeId';
  protected readonly fields: readonly FieldSpec[] = [
    { field: 'alertTypeId', column: 'alert_type_id', writable: false },
    { field: 'code', column: 'code' },
    { field: 'name', column: 'name' },
    { field: 'severity', column: 'severity' },
    { field: 'channel', column: 'channel' },
    ...AUDIT_FIELDS,
  ];

  async findByCode(code: string): Promise<AlertTypeRecord | null> {
    const columns = this.fields.map((f) => f.column).join(', ');
    const rows = await this.select(
      `SELECT ${columns} FROM ${this.qualifiedTable} WHERE code = $1 AND deleted_at IS NULL`,
      [code],
    );
    return rows.length > 0 ? this.mapRow(rows[0]) : null;
  }
}
