import type { IAlertRepository } from '../../domain/ports/out/IAlertRepository';
import type { IAlertTypeRepository } from '../../domain/ports/out/IAlertTypeRepository';
import type { INotificationLogRepository } from '../../domain/ports/out/INotificationLogRepository';
import type { EmailMessage } from '../../infrastructure/email/sender';
import type { Peers, PersonInfo } from './peers';

export interface AlertLogger {
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
}

export interface AlertDeps {
  peers: Peers;
  log: INotificationLogRepository;
  alerts: IAlertRepository;
  alertTypes: IAlertTypeRepository;
  /** Resolves once handed to the transport, or immediately when SMTP is not configured (skipped). */
  sendEmail: (message: EmailMessage) => Promise<void>;
  logger: AlertLogger;
}

export function fullName(person: PersonInfo | null): string {
  return person ? `${person.name} ${person.lastName}`.trim() : '';
}
