import { summaryEmail, type SummaryLine } from './emails';
import type { AlertDeps } from './deps';
import { ACTOR_TYPE_ADMIN, type AttendanceCounts, type BlockInfo } from './peers';
import { alertSettingsFrom, type AlertSettings } from './settings';

export const DAILY_KIND = 'DAILY_SUMMARY';
export const WEEKLY_KIND = 'WEEKLY_REPORT';

export interface PeriodOutcome {
  schools: number;
  emails: number;
}

interface Group {
  label: string;
  sessions: number;
  counts: AttendanceCounts;
  instructorIds: Set<number>;
}

export function rateOf(counts: AttendanceCounts): number | null {
  if (counts.total <= 0) return null;
  return Math.round(((counts.present + counts.late + counts.justified) / counts.total) * 100);
}

/** YYYY-MM-DD in the server's local time. */
export function dateKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

interface PeriodSpec {
  kind: string;
  from: string;
  to: string;
  period: string;
  admins: boolean;
  instructors: boolean;
  enabled: (settings: AlertSettings) => boolean;
}

/** Today's summary, sent in the evening to the school admins that turned it on. */
export function runDailySummary(deps: AlertDeps, now: Date = new Date()): Promise<PeriodOutcome> {
  const day = dateKey(now);
  return runPeriod(deps, { kind: DAILY_KIND, from: day, to: day, period: day, admins: true, instructors: false, enabled: (s) => s.dailySummary });
}

/** The last seven days, sent to the admins (every cohort) and the instructors (their own). */
export function runWeeklyReport(deps: AlertDeps, now: Date = new Date()): Promise<PeriodOutcome> {
  const from = dateKey(addDays(now, -7));
  const to = dateKey(addDays(now, -1));
  return runPeriod(deps, { kind: WEEKLY_KIND, from, to, period: `${from} al ${to}`, admins: true, instructors: true, enabled: (s) => s.weeklyReport });
}

/**
 * Idempotent per recipient and period (notification log), so running it twice sends nothing new;
 * one school failing does not stop the others.
 */
async function runPeriod(deps: AlertDeps, spec: PeriodSpec): Promise<PeriodOutcome> {
  const outcome: PeriodOutcome = { schools: 0, emails: 0 };
  const sessions = await deps.peers.listClosedSessions(spec.from, spec.to);
  if (sessions.length === 0) {
    deps.logger.info('no closed classes in the period', { kind: spec.kind, period: spec.period });
    return outcome;
  }

  // Resolve each session's block and school once (a block repeats every week).
  const blocks = new Map<number, BlockInfo | null>();
  const schoolOfEnv = new Map<number, number | null>();
  const bySchool = new Map<number, Array<{ sessionId: number; block: BlockInfo }>>();
  for (const session of sessions) {
    if (!blocks.has(session.scheduleBlockId)) blocks.set(session.scheduleBlockId, await deps.peers.getBlock(session.scheduleBlockId));
    const block = blocks.get(session.scheduleBlockId);
    if (!block) continue;
    if (!schoolOfEnv.has(block.environmentId)) schoolOfEnv.set(block.environmentId, await deps.peers.getEnvironmentSchoolId(block.environmentId));
    const schoolId = schoolOfEnv.get(block.environmentId);
    if (schoolId == null) continue;
    bySchool.set(schoolId, [...(bySchool.get(schoolId) ?? []), { sessionId: session.classSessionId, block }]);
  }

  const schools = new Map((await deps.peers.listSchools()).map((school) => [school.schoolId, school.name]));
  for (const [schoolId, items] of bySchool) {
    try {
      const sent = await passForSchool(deps, spec, schoolId, schools.get(schoolId) ?? `Sede ${schoolId}`, items);
      if (sent !== null) {
        outcome.schools += 1;
        outcome.emails += sent;
      }
    } catch (err) {
      deps.logger.warn('period report failed for a school', { kind: spec.kind, schoolId, error: (err as Error).message });
    }
  }
  deps.logger.info('period report finished', { kind: spec.kind, period: spec.period, ...outcome });
  return outcome;
}

/** E-mails sent for the school, or null when the school has this report switched off. */
async function passForSchool(
  deps: AlertDeps,
  spec: PeriodSpec,
  schoolId: number,
  schoolName: string,
  items: Array<{ sessionId: number; block: BlockInfo }>,
): Promise<number | null> {
  const { peers } = deps;
  if (!spec.enabled(alertSettingsFrom(await peers.getSchoolSettings(schoolId)))) return null;

  const groups = new Map<string, Group>();
  for (const { sessionId, block } of items) {
    const key = `${block.cohortId}:${block.courseId}`;
    let group = groups.get(key);
    if (!group) {
      const [course, cohort] = await Promise.all([peers.getCourseName(block.courseId), peers.getCohortCode(block.cohortId)]);
      group = {
        label: `${course} (ficha ${cohort})`,
        sessions: 0,
        counts: { present: 0, late: 0, absent: 0, justified: 0, total: 0 },
        instructorIds: new Set(),
      };
      groups.set(key, group);
    }
    const counts = await peers.getSessionCounts(sessionId);
    group.sessions += 1;
    group.instructorIds.add(block.instructorActorId);
    for (const field of ['present', 'late', 'absent', 'justified', 'total'] as const) group.counts[field] += counts[field];
  }
  const toLine = (group: Group): SummaryLine => ({ label: group.label, sessions: group.sessions, absent: group.counts.absent, rate: rateOf(group.counts) });
  const all = [...groups.values()].sort((a, b) => a.label.localeCompare(b.label, 'es'));

  const recipients = new Map<number, { scope: string; lines: SummaryLine[] }>();
  if (spec.instructors) {
    for (const group of all) {
      for (const instructorId of group.instructorIds) {
        const entry = recipients.get(instructorId) ?? { scope: 'tus fichas', lines: [] };
        entry.lines.push(toLine(group));
        recipients.set(instructorId, entry);
      }
    }
  }
  if (spec.admins) {
    for (const actor of await peers.getSchoolActors(schoolId)) {
      if (actor.actorTypeId === ACTOR_TYPE_ADMIN && actor.status) {
        recipients.set(actor.academicActorId, { scope: schoolName, lines: all.map(toLine) });
      }
    }
  }

  let sent = 0;
  for (const [actorId, recipient] of recipients) {
    const key = `${spec.kind}:${schoolId}:${spec.to}:${actorId}`;
    if (!(await deps.log.claim(spec.kind, key, schoolId))) continue;
    try {
      const actor = await peers.getActor(actorId);
      const person = actor ? await peers.getPerson(actor.personId) : null;
      if (!person?.email) {
        deps.logger.warn('recipient has no e-mail; report not sent', { kind: spec.kind, actorId });
        continue;
      }
      await deps.sendEmail(
        summaryEmail({
          to: person.email,
          recipientName: person.name,
          kind: spec.kind === DAILY_KIND ? 'daily' : 'weekly',
          period: spec.period,
          scope: recipient.scope,
          lines: recipient.lines,
        }),
      );
      sent += 1;
    } catch (err) {
      await deps.log.release(spec.kind, key).catch(() => undefined);
      deps.logger.warn('report e-mail failed', { kind: spec.kind, actorId, error: (err as Error).message });
    }
  }
  return sent;
}
