/**
 * Persistence port for the notification log — 08-ms-notification.
 *
 * Remembers what has already been notified so that a redelivered Kafka event or a restarted
 * scheduler never sends the same message twice. It stores no personal data: only the kind of
 * notification, a key describing what it was about, and the school.
 */
export interface INotificationLogRepository {
  /**
   * Records that `(kind, dedupeKey)` is being handled. Resolves `true` when this call is the first
   * to record it (the caller should do the work) and `false` when it was already recorded.
   */
  claim(kind: string, dedupeKey: string, schoolId: number | null): Promise<boolean>;

  /** Gives a claim back after the work failed, so a retry can claim it again. */
  release(kind: string, dedupeKey: string): Promise<void>;
}
