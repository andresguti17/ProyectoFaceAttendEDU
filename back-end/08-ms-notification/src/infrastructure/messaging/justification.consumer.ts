/**
 * Kafka consumer for `attendance.justification.events` — 08-ms-notification.
 *
 * Ports `internal/application/usecase/notify_justification_result.go` and
 * `internal/infrastructure/kafka/justification_consumer.go` to kafkajs.
 */
import { Kafka, type Consumer, type EachMessagePayload } from 'kafkajs';
import type { IAlertRepository } from '../../domain/ports/out/IAlertRepository';
import type { IAlertTypeRepository } from '../../domain/ports/out/IAlertTypeRepository';

/**
 * Integration event Attendance publishes on `attendance.justification.events`
 * when a justification is approved or rejected (fae-docs
 * 09-microservices/event-catalog.md).
 */
export interface JustificationReviewed {
  eventType: string;
  justificationId: number;
  academicActorId: number;
  status: string;
  reviewedAt: string;
}

export const JUSTIFICATION_TOPIC = 'attendance.justification.events';
export const CONSUMER_GROUP = 'notification-service';

const MAX_BACKOFF_MS = 30_000;

/** Marks a message that can never be processed: retrying would only block the partition. */
export class InvalidJustificationEventError extends Error {}

const resultAlertCode: Record<string, string> = {
  Approved: 'JUSTIFICATION_APPROVED',
  Rejected: 'JUSTIFICATION_REJECTED',
};

interface Repos {
  alerts: IAlertRepository;
  alertTypes: IAlertTypeRepository;
}

/**
 * Raises the DASHBOARD alert the apprentice sees in Novedades (ERF 6.3).
 *
 * Delivery is at-least-once, so this is idempotent on the natural key
 * (actor, alert type, raised_at = reviewedAt): a redelivered event finds its
 * alert and resolves without creating a duplicate.
 *
 * - Resolves silently (no alert) for an event whose `eventType` is not
 *   `JustificationReviewed` — it is not ours.
 * - Throws `InvalidJustificationEventError` for a bad status, a zero actor
 *   id, or an empty `reviewedAt` — the caller must not retry these.
 * - Throws a plain `Error` (and the caller must retry) for a DB error or a
 *   missing alert-type seed.
 */
export async function handleJustificationReviewed(
  repos: Repos,
  ev: JustificationReviewed,
): Promise<void> {
  if (ev.eventType !== 'JustificationReviewed') {
    return;
  }

  const code = resultAlertCode[ev.status];
  if (!code || !ev.academicActorId || !ev.reviewedAt) {
    throw new InvalidJustificationEventError(
      `invalid JustificationReviewed event: status=${ev.status} academicActorId=${ev.academicActorId} reviewedAt=${ev.reviewedAt}`,
    );
  }

  const alertType = await repos.alertTypes.findByCode(code);
  if (!alertType) {
    throw new Error(`missing alert-type seed for code ${code}`);
  }

  const raisedAt = new Date(ev.reviewedAt).toISOString();
  const existing = await repos.alerts.findByActorAndType(ev.academicActorId, alertType.alertTypeId);
  if (existing.some((a) => a.raisedAt === raisedAt)) {
    return;
  }

  await repos.alerts.create({
    academicActorId: ev.academicActorId,
    alertTypeId: alertType.alertTypeId,
    raisedAt,
    resolvedAt: null,
  });
}

function backoffMs(attempt: number): number {
  if (attempt >= 5) {
    return MAX_BACKOFF_MS;
  }
  return 1000 << attempt;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * kafkajs consumer loop for `attendance.justification.events`.
 *
 * kafkajs has no manual fetch/commit primitive like the Go reader's
 * `FetchMessage`/`CommitMessages`, so the Go consumer's per-message
 * retry-then-commit loop is ported *inside* `eachMessage`: on a retryable
 * error we sleep for the backoff delay and try again in the same call,
 * never returning (so kafkajs never auto-commits the offset) until the
 * handler succeeds or raises `InvalidJustificationEventError` — at which
 * point we return normally and kafkajs commits as usual. This keeps the
 * partition blocked on a stuck message exactly like the Go loop, instead of
 * either dropping the event or advancing past it.
 */
export async function runJustificationConsumer(brokers: string[], repos: Repos): Promise<void> {
  const kafka = new Kafka({ clientId: CONSUMER_GROUP, brokers });
  const consumer: Consumer = kafka.consumer({ groupId: CONSUMER_GROUP });

  await consumer.connect();
  await consumer.subscribe({ topic: JUSTIFICATION_TOPIC, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }: EachMessagePayload) => {
      if (!message.value) {
        return;
      }

      let ev: JustificationReviewed;
      try {
        ev = JSON.parse(message.value.toString());
      } catch (err) {
        console.warn(`WARN: skipping invalid justification event offset=${message.offset}: ${err}`);
        return;
      }

      for (let attempt = 0; ; attempt++) {
        try {
          await handleJustificationReviewed(repos, ev);
          return;
        } catch (err) {
          if (err instanceof InvalidJustificationEventError) {
            console.warn(`WARN: skipping invalid justification event offset=${message.offset}: ${err.message}`);
            return;
          }
          console.warn(
            `WARN: justification event offset=${message.offset} attempt=${attempt + 1} failed, retrying: ${err}`,
          );
          await sleep(backoffMs(attempt));
        }
      }
    },
  });
}
