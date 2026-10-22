/**
 * The school settings that drive the attendance alerts. They are the ones the web saves in
 * Settings (stored by ms-configuration as `web.*` academic configurations); a missing one means
 * the default the web shows.
 */
export interface AlertSettings {
  /** "Alertas por correo": e-mail the instructor when students did not show up. */
  emailAbsences: boolean;
  /** "Alerta en riesgo": raise at-risk alerts and e-mail them. */
  atRiskAlerts: boolean;
  /** Minimum attendance percentage; below it a student is at risk. */
  minAttendance: number;
}

export const DEFAULT_MIN_ATTENDANCE = 80;

function flag(raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined || raw === '') return fallback;
  return raw === 'true';
}

function percent(raw: string | undefined, fallback: number): number {
  const value = Number(raw);
  return raw === undefined || raw === '' || !Number.isFinite(value) || value <= 0 || value > 100 ? fallback : value;
}

export function alertSettingsFrom(raw: Record<string, string>): AlertSettings {
  return {
    emailAbsences: flag(raw['web.notify_email_alert'], true),
    atRiskAlerts: flag(raw['web.notify_at_risk'], true),
    minAttendance: percent(raw['web.min_attendance'], DEFAULT_MIN_ATTENDANCE),
  };
}
