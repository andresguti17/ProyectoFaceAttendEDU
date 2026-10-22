import { runDailySummary, runWeeklyReport, rateOf, dateKey } from '../periodReport';
import type { AlertDeps } from '../deps';
import type { ActorInfo, AttendanceCounts, BlockInfo, PersonInfo, Peers, SessionInfo } from '../peers';
import type { EmailMessage } from '../../../infrastructure/email/sender';

const counts = (present: number, late: number, absent: number, justified = 0): AttendanceCounts => ({
  present,
  late,
  absent,
  justified,
  total: present + late + absent + justified,
});

interface World {
  sessions: SessionInfo[];
  settings: Record<string, string>;
}

function build(world: World) {
  const sent: EmailMessage[] = [];
  const claimed = new Set<string>();
  const blocks: Record<number, BlockInfo> = {
    1: { scheduleBlockId: 1, cohortId: 10, courseId: 100, instructorActorId: 500, environmentId: 7, startsAt: '08:00' },
    2: { scheduleBlockId: 2, cohortId: 11, courseId: 101, instructorActorId: 501, environmentId: 7, startsAt: '10:00' },
  };
  const actors: Record<number, ActorInfo> = {
    500: { academicActorId: 500, personId: 'p500', actorTypeId: 2, schoolId: 3, status: true },
    501: { academicActorId: 501, personId: 'p501', actorTypeId: 2, schoolId: 3, status: true },
    900: { academicActorId: 900, personId: 'p900', actorTypeId: 3, schoolId: 3, status: true },
  };
  const people: Record<string, PersonInfo> = {
    p500: { personId: 'p500', name: 'Ana', lastName: 'Docente', email: 'ana@x.test' },
    p501: { personId: 'p501', name: 'Beto', lastName: 'Docente', email: null },
    p900: { personId: 'p900', name: 'Admin', lastName: 'Sede', email: 'admin@x.test' },
  };
  const bySession: Record<number, AttendanceCounts> = { 1: counts(8, 1, 1), 2: counts(5, 0, 5), 3: counts(10, 0, 0) };
  const peers = {
    listClosedSessions: async () => world.sessions,
    getBlock: async (id: number) => blocks[id] ?? null,
    getEnvironmentSchoolId: async () => 3,
    listSchools: async () => [{ schoolId: 3, name: 'Sede Norte' }],
    getSchoolSettings: async () => world.settings,
    getCourseName: async (id: number) => `Curso ${id}`,
    getCohortCode: async (id: number) => `F${id}`,
    getSessionCounts: async (id: number) => bySession[id],
    getSchoolActors: async () => [actors[900]],
    getActor: async (id: number) => actors[id] ?? null,
    getPerson: async (id: string) => people[id] ?? null,
  } as unknown as Peers;
  const deps: AlertDeps = {
    peers,
    log: {
      claim: async (kind: string, key: string) => (claimed.has(`${kind}|${key}`) ? false : (claimed.add(`${kind}|${key}`), true)),
      release: async (kind: string, key: string) => void claimed.delete(`${kind}|${key}`),
    },
    alerts: {} as AlertDeps['alerts'],
    alertTypes: {} as AlertDeps['alertTypes'],
    sendEmail: async (message) => void sent.push(message),
    logger: { info: () => undefined, warn: () => undefined },
  };
  return { deps, sent };
}

const closed = (id: number, block: number): SessionInfo => ({ classSessionId: id, scheduleBlockId: block, sessionDate: '2026-10-21', sessionStatus: 'Closed' });
const NOW = new Date(2026, 9, 21, 19, 0, 0);

describe('period helpers', () => {
  it('rounds the attendance rate and has none without records', () => {
    expect(rateOf(counts(8, 1, 1))).toBe(90);
    expect(rateOf(counts(0, 0, 0))).toBeNull();
  });

  it('formats local dates', () => {
    expect(dateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('runDailySummary', () => {
  it('is off by default: the school has to turn it on', async () => {
    const { deps, sent } = build({ sessions: [closed(1, 1)], settings: {} });

    expect(await runDailySummary(deps, NOW)).toEqual({ schools: 0, emails: 0 });
    expect(sent).toHaveLength(0);
  });

  it('e-mails the school admin one line per course and cohort', async () => {
    const { deps, sent } = build({ sessions: [closed(1, 1), closed(2, 2)], settings: { 'web.notify_daily_summary': 'true' } });

    const outcome = await runDailySummary(deps, NOW);

    expect(outcome).toEqual({ schools: 1, emails: 1 });
    expect(sent[0].to).toBe('admin@x.test');
    expect(sent[0].subject).toContain('Resumen diario');
    expect(sent[0].textBody).toContain('Curso 100 (ficha F10): 1 clase(s), asistencia 90%, 1 ausencia(s)');
    expect(sent[0].textBody).toContain('Curso 101 (ficha F11): 1 clase(s), asistencia 50%, 5 ausencia(s)');
  });

  it('does not send twice for the same day', async () => {
    const { deps, sent } = build({ sessions: [closed(1, 1)], settings: { 'web.notify_daily_summary': 'true' } });

    await runDailySummary(deps, NOW);
    const again = await runDailySummary(deps, NOW);

    expect(again.emails).toBe(0);
    expect(sent).toHaveLength(1);
  });

  it('sends nothing when no class was closed', async () => {
    const { deps, sent } = build({ sessions: [], settings: { 'web.notify_daily_summary': 'true' } });

    expect(await runDailySummary(deps, NOW)).toEqual({ schools: 0, emails: 0 });
    expect(sent).toHaveLength(0);
  });
});

describe('runWeeklyReport', () => {
  it('goes to the admin (everything) and to each instructor with an e-mail (their own cohorts)', async () => {
    const { deps, sent } = build({ sessions: [closed(1, 1), closed(2, 2), closed(3, 1)], settings: {} });

    const outcome = await runWeeklyReport(deps, NOW);

    // Beto (instructor 501) has no e-mail: skipped, not an error.
    expect(outcome.emails).toBe(2);
    const admin = sent.find((m) => m.to === 'admin@x.test')!;
    const ana = sent.find((m) => m.to === 'ana@x.test')!;
    expect(admin.textBody).toContain('Curso 100 (ficha F10): 2 clase(s), asistencia 95%');
    expect(admin.textBody).toContain('Curso 101');
    expect(ana.textBody).toContain('Curso 100');
    expect(ana.textBody).not.toContain('Curso 101');
    expect(ana.subject).toContain('Reporte semanal');
    expect(ana.subject).toContain('2026-10-14 al 2026-10-20');
  });

  it('respects the school switch', async () => {
    const { deps, sent } = build({ sessions: [closed(1, 1)], settings: { 'web.notify_weekly_report': 'false' } });

    expect(await runWeeklyReport(deps, NOW)).toEqual({ schools: 0, emails: 0 });
    expect(sent).toHaveLength(0);
  });
});
