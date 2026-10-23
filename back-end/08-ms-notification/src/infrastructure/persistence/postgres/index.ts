import type { IAlertRepository } from '../../../domain/ports/out/IAlertRepository';
import type { IAlertTypeRepository } from '../../../domain/ports/out/IAlertTypeRepository';
import type { INotificationLogRepository } from '../../../domain/ports/out/INotificationLogRepository';
import { PostgresAlertRepository } from './alert.repository';
import { PostgresAlertTypeRepository } from './alert-type.repository';
import { PostgresNotificationLogRepository } from './notification-log.repository';

export { PostgresAlertRepository } from './alert.repository';
export { PostgresAlertTypeRepository } from './alert-type.repository';
export { PostgresNotificationLogRepository } from './notification-log.repository';

/** Builds the notification aggregates' PostgreSQL adapters. */
export function createNotificationRepositories(): {
  alerts: IAlertRepository;
  alertTypes: IAlertTypeRepository;
  notificationLog: INotificationLogRepository;
} {
  return {
    alerts: new PostgresAlertRepository(),
    alertTypes: new PostgresAlertTypeRepository(),
    notificationLog: new PostgresNotificationLogRepository(),
  };
}
