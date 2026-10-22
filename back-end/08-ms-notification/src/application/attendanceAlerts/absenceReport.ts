import { absenceReportEmail } from './emails';
import { fullName, type AlertDeps } from './deps';
import { alertSettingsFrom } from './settings';

/** Integration event scheduling publishes when a class session is closed. */
export interface ClassSessionClosed {
  eventType: string;
  classSessionId: number;
  scheduleBlockId: number;
  sessionDate: string;
  closedAt: string;
}

export const CLASS_SESSION_CLOSED_TOPIC = 'scheduling.class-session.closed';
export const ABSENCE_KIND = 'ABSENCE_REPORT';

/** A message that can never be processed: retrying would only block the partition. */
export class InvalidClassSessionEventError extends Error {}

export interface AbsenceOutcome {
  /** Students of the cohort that had no record when the class closed. */
  absent: number;
  /** `Absent` records this call created (the rest already existed). */
  recorded: number;
  emailed: boolean;
}

/**
 * When a class closes, every active student of its cohort without a record is marked `Absent`
 * (so attendance percentages and reports count real absences), and the instructor gets one
 * e-mail listing them when the school has "Alertas por correo" on.
 *
 * Delivery is at-least-once, so the whole thing is idempotent on the session: the claim in the
 * notification log makes a redelivered event a no-op, and the claim is given back when anything
 * fails so the retry starts clean (creating an `Absent` record twice is harmless: the second
 * answers "exists").
 *
 * Returns `null` for an event that is not ours or a session that is not (or no longer) closed.
 */
export async function handleClassSessionClosed(
  deps: AlertDeps,
  ev: ClassSessionClosed,
): Promise<AbsenceOutcome | null> {
  if (ev.eventType !== 'ClassSessionClosed') return null;
  if (!Number.isInteger(ev.classSessionId) || ev.classSessionId <= 0) {
    throw new InvalidClassSessionEventError(`invalid ClassSessionClosed event: classSessionId=${ev.classSessionId}`);
  }

  const { peers } = deps;
  const session = await peers.getSession(ev.classSessionId);
  if (!session || session.sessionStatus !== 'Closed') {
    deps.logger.info('class session is not closed any more; nothing to record', { classSessionId: ev.classSessionId });
    return null;
  }
  const block = await peers.getBlock(session.scheduleBlockId);
  if (!block) throw new Error(`schedule block ${session.scheduleBlockId} not found`);
  const schoolId = await peers.getEnvironmentSchoolId(block.environmentId);

  const dedupeKey = `session:${session.classSessionId}`;
  if (!(await deps.log.claim(ABSENCE_KIND, dedupeKey, schoolId))) {
    return null; // redelivered: already handled
  }

  try {
    const [roster, recorded] = await Promise.all([
      peers.getCohortActorIds(block.cohortId),
      peers.getSessionRecordedActorIds(session.classSessionId),
    ]);
    const present = new Set(recorded);
    const absentIds = roster.filter((actorId) => !present.has(actorId));

    let created = 0;
    for (const actorId of absentIds) {
      if ((await peers.createAbsentRecord(session.classSessionId, actorId)) === 'created') created += 1;
    }

    let emailed = false;
    if (absentIds.length > 0 && schoolId !== null) {
      const settings = alertSettingsFrom(await peers.getSchoolSettings(schoolId));
      if (settings.emailAbsences) emailed = await emailInstructor(deps, block, session.sessionDate, absentIds);
    }
    deps.logger.info('class session closed: absences recorded', {
      classSessionId: session.classSessionId,
      absent: absentIds.length,
      recorded: created,
      emailed,
    });
    return { absent: absentIds.length, recorded: created, emailed };
  } catch (err) {
    await deps.log.release(ABSENCE_KIND, dedupeKey).catch(() => undefined);
    throw err;
  }
}

async function emailInstructor(
  deps: AlertDeps,
  block: { cohortId: number; courseId: number; instructorActorId: number },
  sessionDate: string,
  absentIds: number[],
): Promise<boolean> {
  const { peers } = deps;
  const instructor = await peers.getActor(block.instructorActorId);
  const person = instructor ? await peers.getPerson(instructor.personId) : null;
  if (!person?.email) {
    deps.logger.warn('instructor has no e-mail; absence report not sent', { instructorActorId: block.instructorActorId });
    return false;
  }

  const names: string[] = [];
  for (const actorId of absentIds) {
    const actor = await peers.getActor(actorId);
    const student = actor ? await peers.getPerson(actor.personId) : null;
    names.push(fullName(student) || `Estudiante ${actorId}`);
  }
  names.sort((a, b) => a.localeCompare(b, 'es'));

  const [courseName, cohortCode] = await Promise.all([peers.getCourseName(block.courseId), peers.getCohortCode(block.cohortId)]);
  await deps.sendEmail(
    absenceReportEmail({
      to: person.email,
      instructorName: person.name,
      courseName,
      cohortCode,
      sessionDate,
      absentNames: names,
    }),
  );
  return true;
}
