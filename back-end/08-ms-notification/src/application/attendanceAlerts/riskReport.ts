import { atRiskEmail, type AtRiskStudent } from './emails';
import { fullName, type AlertDeps } from './deps';
import { ACTOR_TYPE_ADMIN, ACTOR_TYPE_STUDENT, type AttendanceCounts } from './peers';
import { alertSettingsFrom } from './settings';

export const AT_RISK_KIND = 'AT_RISK_REPORT';
export const AT_RISK_ALERT_CODE = 'ATTENDANCE_LOW';
/** Sessions a student needs on record before a low percentage means something. */
export const MIN_SESSIONS_FOR_RISK = 5;

export interface RiskPassOutcome {
  schools: number;
  newlyAtRisk: number;
  recovered: number;
  emails: number;
}

/** Percentage of sessions attended (`Present`, `Late` and `Justified` count), or null without data. */
export function attendanceRate(counts: AttendanceCounts | undefined): number | null {
  if (!counts || counts.total <= 0) return null;
  return ((counts.present + counts.late + counts.justified) / counts.total) * 100;
}

function dateKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/**
 * One pass over every school: students below the school's minimum attendance get an
 * `ATTENDANCE_LOW` alert (once, while it stays open), and the ones that were not already flagged
 * are e-mailed to their instructors and to the school admins. Students that recovered have their
 * open alert resolved, so they can be flagged again later.
 *
 * Safe to run more than once a day: an open alert is never duplicated and each recipient gets at
 * most one e-mail per school per day (notification log). One school failing does not stop the
 * others.
 */
export async function runRiskAlertPass(deps: AlertDeps, now: Date = new Date()): Promise<RiskPassOutcome> {
  const outcome: RiskPassOutcome = { schools: 0, newlyAtRisk: 0, recovered: 0, emails: 0 };
  for (const school of await deps.peers.listSchools()) {
    try {
      const result = await passForSchool(deps, school.schoolId, school.name, now);
      if (result) {
        outcome.schools += 1;
        outcome.newlyAtRisk += result.newlyAtRisk;
        outcome.recovered += result.recovered;
        outcome.emails += result.emails;
      }
    } catch (err) {
      deps.logger.warn('at-risk pass failed for a school', { schoolId: school.schoolId, error: (err as Error).message });
    }
  }
  deps.logger.info('at-risk pass finished', { ...outcome });
  return outcome;
}

async function passForSchool(
  deps: AlertDeps,
  schoolId: number,
  schoolName: string,
  now: Date,
): Promise<{ newlyAtRisk: number; recovered: number; emails: number } | null> {
  const { peers } = deps;
  const settings = alertSettingsFrom(await peers.getSchoolSettings(schoolId));
  if (!settings.atRiskAlerts) return null;

  const alertType = await deps.alertTypes.findByCode(AT_RISK_ALERT_CODE);
  if (!alertType) {
    deps.logger.warn('missing alert-type seed', { code: AT_RISK_ALERT_CODE });
    return null;
  }

  const actors = await peers.getSchoolActors(schoolId);
  const students = actors.filter((actor) => actor.actorTypeId === ACTOR_TYPE_STUDENT && actor.status);
  const counts = await peers.getAttendanceCounts(students.map((student) => student.academicActorId));

  const atRisk = new Map<number, number>(); // actorId -> rounded rate
  for (const student of students) {
    const summary = counts.get(student.academicActorId);
    const rate = attendanceRate(summary);
    if (summary && summary.total >= MIN_SESSIONS_FOR_RISK && rate !== null && rate < settings.minAttendance) {
      atRisk.set(student.academicActorId, Math.round(rate));
    }
  }

  const open = await deps.alerts.findFiltered({ typeId: alertType.alertTypeId, resolved: false });
  const openByActor = new Map(open.map((alert) => [alert.academicActorId, alert]));
  const schoolStudentIds = new Set(students.map((student) => student.academicActorId));

  const newly = [...atRisk.keys()].filter((actorId) => !openByActor.has(actorId));
  for (const actorId of newly) {
    await deps.alerts.create({
      academicActorId: actorId,
      alertTypeId: alertType.alertTypeId,
      raisedAt: now.toISOString(),
      resolvedAt: null,
    });
  }

  let recovered = 0;
  for (const alert of open) {
    if (schoolStudentIds.has(alert.academicActorId) && !atRisk.has(alert.academicActorId)) {
      await deps.alerts.update(alert.alertId, { resolvedAt: now.toISOString() });
      recovered += 1;
    }
  }

  let emails = 0;
  if (newly.length > 0) {
    emails = await emailRecipients(deps, schoolId, schoolName, settings.minAttendance, newly, atRisk, actors, now);
  }
  return { newlyAtRisk: newly.length, recovered, emails };
}

async function emailRecipients(
  deps: AlertDeps,
  schoolId: number,
  schoolName: string,
  minAttendance: number,
  newly: number[],
  rates: Map<number, number>,
  actors: Array<{ academicActorId: number; personId: string; actorTypeId: number; status: boolean }>,
  now: Date,
): Promise<number> {
  const { peers } = deps;

  const students = new Map<number, AtRiskStudent>();
  for (const actorId of newly) {
    const actor = actors.find((candidate) => candidate.academicActorId === actorId);
    const person = actor ? await peers.getPerson(actor.personId) : null;
    students.set(actorId, { name: fullName(person) || `Estudiante ${actorId}`, rate: rates.get(actorId) ?? 0 });
  }

  // instructor actor id -> the newly flagged students of the cohorts they teach
  const byInstructor = new Map<number, AtRiskStudent[]>();
  for (const actorId of newly) {
    const instructors = new Set<number>();
    for (const cohortId of await peers.getActorCohortIds(actorId)) {
      for (const instructorId of await peers.getCohortInstructorIds(cohortId)) instructors.add(instructorId);
    }
    for (const instructorId of instructors) {
      byInstructor.set(instructorId, [...(byInstructor.get(instructorId) ?? []), students.get(actorId)!]);
    }
  }

  const everyone = [...students.values()];
  const recipients: Array<{ actorId: number; scope: string; list: AtRiskStudent[] }> = [
    ...[...byInstructor].map(([actorId, list]) => ({ actorId, scope: 'tus fichas', list })),
    ...actors
      .filter((actor) => actor.actorTypeId === ACTOR_TYPE_ADMIN && actor.status)
      .map((actor) => ({ actorId: actor.academicActorId, scope: schoolName, list: everyone })),
  ];

  let sent = 0;
  const day = dateKey(now);
  for (const recipient of recipients) {
    const key = `risk:${schoolId}:${day}:${recipient.actorId}`;
    if (!(await deps.log.claim(AT_RISK_KIND, key, schoolId))) continue;
    try {
      const actor = actors.find((candidate) => candidate.academicActorId === recipient.actorId) ?? (await peers.getActor(recipient.actorId));
      const person = actor ? await peers.getPerson(actor.personId) : null;
      if (!person?.email) {
        deps.logger.warn('recipient has no e-mail; at-risk report not sent', { actorId: recipient.actorId });
        continue;
      }
      await deps.sendEmail(
        atRiskEmail({
          to: person.email,
          recipientName: person.name,
          scope: recipient.scope,
          minAttendance,
          students: [...recipient.list].sort((a, b) => a.name.localeCompare(b.name, 'es')),
        }),
      );
      sent += 1;
    } catch (err) {
      await deps.log.release(AT_RISK_KIND, key).catch(() => undefined);
      deps.logger.warn('at-risk e-mail failed', { actorId: recipient.actorId, error: (err as Error).message });
    }
  }
  return sent;
}
