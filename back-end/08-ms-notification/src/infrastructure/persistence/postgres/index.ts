import type { IAlertRepository } from '../../../domain/ports/out/IAlertRepository';
import type { IAlertTypeRepository } from '../../../domain/ports/out/IAlertTypeRepository';
import { PostgresAlertRepository } from './alert.repository';
import { PostgresAlertTypeRepository } from './alert-type.repository';

export { PostgresAlertRepository } from './alert.repository';
export { PostgresAlertTypeRepository } from './alert-type.repository';

/** Builds the notification aggregates' PostgreSQL adapters. */
export function createNotificationRepositories(): {
  alerts: IAlertRepository;
  alertTypes: IAlertTypeRepository;
} {
  return {
    alerts: new PostgresAlertRepository(),
    alertTypes: new PostgresAlertTypeRepository(),
  };
}
