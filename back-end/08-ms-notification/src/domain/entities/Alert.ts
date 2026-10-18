/**
 * Alert aggregate — 08-ms-notification.
 *
 * Raised against an academic actor (student or instructor) for a given alert
 * type. `academic_actor_id` is a cross-context reference (no FK).
 */
export interface AlertRecord {
  alertId: number;
  academicActorId: number;
  alertTypeId: number;
  raisedAt: string;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

/**
 * Returns the first validation error for an alert draft, or `null` when valid.
 */
export function validateAlertDraft(draft: {
  academicActorId?: number;
  alertTypeId?: number;
}): string | null {
  if (draft.academicActorId === undefined) {
    return 'academic_actor_id is required';
  }
  if (draft.alertTypeId === undefined) {
    return 'alert_type_id is required';
  }
  return null;
}
