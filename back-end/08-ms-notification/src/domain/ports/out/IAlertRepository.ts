/**
 * Persistence port for the Alert aggregate — 08-ms-notification.
 *
 * Hexagonal "driven" (out) port implemented by the infrastructure layer.
 */
import { AlertRecord } from '../../entities/Alert';
import { Draft, ICrudRepository } from './ICrudRepository';

/** `GET /alerts` query shape — mirrors the Go `port.AlertFilter` / `ListAlertsQuery`. */
export interface AlertFilter {
  actorId?: number;
  typeId?: number;
  /** `true` = only resolved (`resolved_at IS NOT NULL`), `false` = only open (`IS NULL`). */
  resolved?: boolean;
  limit?: number;
  offset?: number;
}

export interface IAlertRepository
  extends ICrudRepository<AlertRecord, number, Draft<AlertRecord, 'alertId'>> {
  findByActorAndType(actorId: number, typeId: number): Promise<AlertRecord[]>;
  /**
   * `actorId`/`typeId`/`resolved` are pushed into the SQL `WHERE` clause
   * combined with `LIMIT`/`OFFSET`, matching the Go `AlertRepository.FindAll`
   * (`internal/infrastructure/postgres/alert_repository.go:56-104`): those
   * three filters narrow the result set *before* the page is cut. Only the
   * caller's actor-scope check stays a post-pagination, in-memory step.
   */
  findFiltered(filter: AlertFilter): Promise<AlertRecord[]>;
}
