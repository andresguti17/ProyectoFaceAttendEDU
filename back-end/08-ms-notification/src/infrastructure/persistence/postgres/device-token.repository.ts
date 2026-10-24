import type {
  ActiveDeviceToken,
  DeviceLocale,
  DevicePlatform,
  IDeviceTokenRepository,
} from '../../../domain/ports/out/IDeviceTokenRepository';
import { runQuery } from '../../db/database';
import { translateDbError } from '../errors';

/**
 * PostgreSQL adapter for `notification.device_token`.
 *
 * `token` is unique, so registering is one atomic upsert: a token moved to another
 * account or reinstalled app is re-activated for the new actor instead of duplicated.
 */
export class PostgresDeviceTokenRepository implements IDeviceTokenRepository {
  private readonly table = 'notification.device_token';

  async upsert(academicActorId: number, token: string, platform: DevicePlatform, locale: DeviceLocale): Promise<number> {
    try {
      const rows = await runQuery<{ device_token_id: number }>(
        `INSERT INTO ${this.table} (academic_actor_id, token, platform, locale, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         ON CONFLICT (token) DO UPDATE
           SET academic_actor_id = EXCLUDED.academic_actor_id,
               platform = EXCLUDED.platform,
               locale = EXCLUDED.locale,
               revoked_at = NULL,
               updated_at = NOW()
         RETURNING device_token_id`,
        [academicActorId, token, platform, locale],
      );
      return rows[0].device_token_id;
    } catch (err) {
      throw translateDbError(err, this.table);
    }
  }

  async revokeOwned(token: string, academicActorIds: number[]): Promise<boolean> {
    if (academicActorIds.length === 0) return false;
    try {
      const rows = await runQuery(
        `UPDATE ${this.table} SET revoked_at = NOW(), updated_at = NOW()
         WHERE token = $1 AND academic_actor_id = ANY($2::bigint[]) AND revoked_at IS NULL
         RETURNING device_token_id`,
        [token, academicActorIds],
      );
      return rows.length > 0;
    } catch (err) {
      throw translateDbError(err, this.table);
    }
  }

  async findActiveByActor(academicActorId: number): Promise<ActiveDeviceToken[]> {
    try {
      return await runQuery<ActiveDeviceToken>(
        `SELECT token, locale FROM ${this.table} WHERE academic_actor_id = $1 AND revoked_at IS NULL`,
        [academicActorId],
      );
    } catch (err) {
      throw translateDbError(err, this.table);
    }
  }

  async revokeTokens(tokens: string[]): Promise<void> {
    if (tokens.length === 0) return;
    try {
      await runQuery(
        `UPDATE ${this.table} SET revoked_at = NOW(), updated_at = NOW()
         WHERE token = ANY($1::text[]) AND revoked_at IS NULL`,
        [tokens],
      );
    } catch (err) {
      throw translateDbError(err, this.table);
    }
  }
}
