/**
 * Persistence port for the Alert aggregate — 08-ms-notification.
 *
 * Hexagonal "driven" (out) port implemented by the infrastructure layer.
 */
import { AlertRecord } from '../../entities/Alert';
import { Draft, ICrudRepository } from './ICrudRepository';

export interface IAlertRepository
  extends ICrudRepository<AlertRecord, number, Draft<AlertRecord, 'alertId'>> {
  findByActorAndType(actorId: number, typeId: number): Promise<AlertRecord[]>;
}
