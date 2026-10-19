/**
 * Persistence port for the AlertType catalog — 08-ms-notification.
 *
 * Hexagonal "driven" (out) port implemented by the infrastructure layer.
 */
import { AlertTypeRecord } from '../../entities/AlertType';
import { Draft, ICrudRepository } from './ICrudRepository';

export interface IAlertTypeRepository
  extends ICrudRepository<AlertTypeRecord, number, Draft<AlertTypeRecord, 'alertTypeId'>> {
  findByCode(code: string): Promise<AlertTypeRecord | null>;
}
