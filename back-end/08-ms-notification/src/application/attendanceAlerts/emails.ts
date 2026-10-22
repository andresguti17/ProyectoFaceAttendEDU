import type { EmailMessage } from '../../infrastructure/email/sender';

/**
 * E-mails of the attendance alerts. Subjects are fixed and every name that reaches the HTML is
 * escaped. They list only what the recipient needs (names and a status), nothing else about a
 * student.
 */
const APP_NAME = 'FaceAttend EDU';

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function page(title: string, intro: string, items: string[], outro: string): { text: string; html: string } {
  const text = `${APP_NAME}\n\n${intro}\n\n${items.map((item) => `  - ${item}`).join('\n')}\n\n${outro}\n`;
  const rows = items.map((item) => `<li style="margin:0 0 6px;">${esc(item)}</li>`).join('');
  const html = `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;padding:24px;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;border:1px solid #e5e7eb;">
    <h1 style="margin:0 0 16px;font-size:20px;color:#111827;">${esc(APP_NAME)}</h1>
    <p style="margin:0 0 12px;font-size:15px;color:#4b5563;">${esc(intro)}</p>
    <ul style="margin:0 0 16px;padding-left:20px;font-size:15px;color:#111827;">${rows}</ul>
    <p style="margin:0;font-size:13px;color:#6b7280;">${esc(outro)}</p>
  </div>
</body>
</html>`;
  return { text, html };
}

export interface AbsenceReport {
  to: string;
  instructorName: string;
  courseName: string;
  cohortCode: string;
  sessionDate: string;
  absentNames: string[];
}

export function absenceReportEmail(report: AbsenceReport): EmailMessage {
  const greeting = report.instructorName ? `Hola, ${report.instructorName}: ` : '';
  const intro =
    `${greeting}al cerrar la clase de ${report.courseName} (ficha ${report.cohortCode}) del ${report.sessionDate} ` +
    `quedaron ${report.absentNames.length} estudiante(s) sin registro de asistencia. Se marcaron como ausentes:`;
  const { text, html } = page(
    'Ausencias de la clase',
    intro,
    report.absentNames,
    'Puedes corregir un registro desde el kiosco de asistencia si alguien sí asistió.',
  );
  return {
    to: report.to,
    subject: `Ausencias en ${report.courseName} (${report.sessionDate}) - ${APP_NAME}`,
    textBody: text,
    htmlBody: html,
  };
}

export interface AtRiskStudent {
  name: string;
  /** Attendance percentage, already rounded. */
  rate: number;
}

export interface AtRiskReport {
  to: string;
  recipientName: string;
  /** Who the list is about: "tus fichas" for an instructor, the school name for an admin. */
  scope: string;
  minAttendance: number;
  students: AtRiskStudent[];
}

export function atRiskEmail(report: AtRiskReport): EmailMessage {
  const greeting = report.recipientName ? `Hola, ${report.recipientName}: ` : '';
  const intro =
    `${greeting}en ${report.scope} ${report.students.length} estudiante(s) bajaron del ${report.minAttendance}% ` +
    'de asistencia mínima y quedaron en riesgo:';
  const { text, html } = page(
    'Estudiantes en riesgo',
    intro,
    report.students.map((student) => `${student.name} (${student.rate}%)`),
    'Cada estudiante figura en la pantalla Alertas hasta que recupere la asistencia mínima.',
  );
  return {
    to: report.to,
    subject: `Estudiantes en riesgo de asistencia - ${APP_NAME}`,
    textBody: text,
    htmlBody: html,
  };
}
