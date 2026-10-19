/**
 * AlertType catalog — 08-ms-notification.
 *
 * Catalog of alert kinds (ATTENDANCE_LOW, BIOMETRIC_UPDATE, ...). `channel`
 * is a VARCHAR column constrained to the values below.
 */
export const ALERT_TYPE_CHANNELS = ['DASHBOARD', 'EMAIL', 'PUSH'] as const;

export interface AlertTypeRecord {
  alertTypeId: number;
  code: string;
  name: string;
  severity: string;
  channel: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

/**
 * Returns the first validation error for an alert type draft, or `null` when
 * valid. An empty or missing `channel` is accepted (the DB default applies).
 */
export function validateAlertTypeDraft(draft: {
  code?: string;
  name?: string;
  severity?: string;
  channel?: string;
}): string | null {
  if (!draft.code) {
    return 'code is required';
  }
  if (!draft.name) {
    return 'name is required';
  }
  if (!draft.severity) {
    return 'severity is required';
  }
  if (draft.channel && !(ALERT_TYPE_CHANNELS as readonly string[]).includes(draft.channel)) {
    return `channel must be one of ${ALERT_TYPE_CHANNELS.join(', ')}`;
  }
  return null;
}
