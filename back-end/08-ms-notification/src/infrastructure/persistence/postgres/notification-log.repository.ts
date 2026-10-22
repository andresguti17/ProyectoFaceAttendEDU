import type { INotificationLogRepository } from '../../../domain/ports/out/INotificationLogRepository';
import { runQuery } from '../../db/database';
import { translateDbError } from '../errors';

/**
 * PostgreSQL adapter for `notification.notification_log`.
 *
 * `uq_notification_log_dedupe` is a partial unique index on (kind, dedupe_key) for live rows, so
 * `claim` is a single atomic INSERT that does nothing when the pair is already there, and
 * `release` soft-deletes the row (rows are never physically removed in this schema) so it can be
 * claimed again.
 */
export class PostgresNotificationLogRepository implements INotificationLogRepository {
  private readonly table = 'notification.notification_log';

  async claim(kind: string, dedupeKey: string, schoolId: number | null): Promise<boolean> {
    try {
      const rows = await runQuery<{ log_id: number }>(
        `INSERT INTO ${this.table} (kind, dedupe_key, school_id, sent_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (kind, dedupe_key) WHERE deleted_at IS NULL DO NOTHING
         RETURNING log_id`,
        [kind, dedupeKey, schoolId],
      );
      return rows.length > 0;
    } catch (err) {
      throw translateDbError(err, this.table);
    }
  }

  async release(kind: string, dedupeKey: string): Promise<void> {
    try {
      await runQuery(
        `UPDATE ${this.table} SET deleted_at = NOW() WHERE kind = $1 AND dedupe_key = $2 AND deleted_at IS NULL`,
        [kind, dedupeKey],
      );
    } catch (err) {
      throw translateDbError(err, this.table);
    }
  }
}
