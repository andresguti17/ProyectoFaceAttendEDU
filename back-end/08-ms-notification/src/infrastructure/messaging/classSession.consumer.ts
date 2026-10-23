/**
 * Kafka consumer for `scheduling.class-session.closed`: records the absences of the class and
 * e-mails the instructor (see `handleClassSessionClosed`).
 *
 * Same retry contract as the justification consumer: a retryable failure sleeps and tries again
 * inside `eachMessage` (so the partition stays blocked on a stuck message instead of dropping it),
 * and an invalid message is skipped.
 */
import { Kafka, type Consumer, type EachMessagePayload } from 'kafkajs';
import {
  CLASS_SESSION_CLOSED_TOPIC,
  handleClassSessionClosed,
  InvalidClassSessionEventError,
  type ClassSessionClosed,
} from '../../application/attendanceAlerts/absenceReport';
import type { AlertDeps } from '../../application/attendanceAlerts/deps';

export const CLASS_SESSION_CONSUMER_GROUP = 'notification-service-class-session';

const MAX_BACKOFF_MS = 30_000;

export function backoffMs(attempt: number): number {
  return attempt >= 5 ? MAX_BACKOFF_MS : 1000 << attempt;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Processes one raw message: returns when it is handled or skipped, retries until it succeeds otherwise. */
export async function processClassSessionMessage(
  deps: AlertDeps,
  raw: string,
  offset: string,
  wait: (ms: number) => Promise<void> = sleep,
): Promise<void> {
  let ev: ClassSessionClosed;
  try {
    ev = JSON.parse(raw);
  } catch (err) {
    deps.logger.warn('skipping invalid class-session event', { offset, error: String(err) });
    return;
  }

  for (let attempt = 0; ; attempt += 1) {
    try {
      await handleClassSessionClosed(deps, ev);
      return;
    } catch (err) {
      if (err instanceof InvalidClassSessionEventError) {
        deps.logger.warn('skipping invalid class-session event', { offset, error: err.message });
        return;
      }
      deps.logger.warn('class-session event failed, retrying', { offset, attempt: attempt + 1, error: String(err) });
      await wait(backoffMs(attempt));
    }
  }
}

/**
 * Starts the consumer, retrying while the broker or the topic is not there yet: nothing publishes
 * `scheduling.class-session.closed` until the first class closes, and the first (failed) attempt
 * is what makes the broker auto-create the topic.
 */
export async function runClassSessionConsumer(brokers: string[], deps: AlertDeps): Promise<void> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      await startClassSessionConsumer(brokers, deps);
      return;
    } catch (err) {
      deps.logger.warn('class-session consumer could not start, retrying', { attempt: attempt + 1, error: String(err) });
      await sleep(backoffMs(attempt));
    }
  }
}

async function startClassSessionConsumer(brokers: string[], deps: AlertDeps): Promise<void> {
  const kafka = new Kafka({ clientId: CLASS_SESSION_CONSUMER_GROUP, brokers });
  const consumer: Consumer = kafka.consumer({ groupId: CLASS_SESSION_CONSUMER_GROUP });

  try {
    await consumer.connect();
    await consumer.subscribe({ topic: CLASS_SESSION_CLOSED_TOPIC, fromBeginning: false });
  } catch (err) {
    await consumer.disconnect().catch(() => undefined);
    throw err;
  }
  await consumer.run({
    eachMessage: async ({ message }: EachMessagePayload) => {
      if (!message.value) return;
      await processClassSessionMessage(deps, message.value.toString(), message.offset);
    },
  });
}
