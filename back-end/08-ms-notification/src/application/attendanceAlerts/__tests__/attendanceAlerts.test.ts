import { handleClassSessionClosed, InvalidClassSessionEventError, type ClassSessionClosed } from '../absenceReport';
import { attendanceRate, MIN_SESSIONS_FOR_RISK, runRiskAlertPass } from '../riskReport';
import { alertSettingsFrom } from '../settings';
import type { AlertDeps } from '../deps';
import type { ActorInfo, AttendanceCounts, PersonInfo, Peers } from '../peers';
import type { AlertRecord } from '../../../domain/entities/Alert';
import type { EmailMessage } from '../../../infrastructure/email/sender';

// ── in-memory world ─────────────────────────────────────────────────────────

function actor(id: number, type: number, personId: string, schoolId = 30): ActorInfo {
  return { academicActorId: id, personId, actorTypeId: type, schoolId, status: true };
}

function person(id: string, name: string, lastName: string, email: string | null): PersonInfo {
  return { personId: id, name, lastName, email };
}

function counts(present: number, absent: number): AttendanceCounts {
  return { present, late: 0, absent, justified: 0, total: present + absent };
}

interface World {
  settings: Record<string, string>;
  roster: number[];
  recorded: number[];
  actors: ActorInfo[];
  people: PersonInfo[];
  attendance: Map<number, AttendanceCounts>;
  cohortsOf: Map<number, number[]>;
  instructorsOf: Map<number, number[]>;
  created: Array<[number, number]>;
  existing: Set<string>;
}

function world(overrides: Partial<World> = {}): World {
  return {
    settings: {},
    roster: [101, 102, 103],
    recorded: [101],
    actors: [
      actor(7, 2, 'p-inst'),
      actor(9, 3, 'p-admin'),
      actor(101, 1, 'p-101'),
      actor(102, 1, 'p-102'),
      actor(103, 1, 'p-103'),
    ],
    people: [
      person('p-inst', 'Carlos', 'Restrepo', 'carlos@example.com'),
      person('p-admin', 'Rosa', 'Rectora', 'rosa@example.com'),
      person('p-101', 'Ana', 'Pérez', null),
      person('p-102', 'Luis', 'Gómez', null),
      person('p-103', 'Zoe', 'Díaz', null),
    ],
    attendance: new Map(),
    cohortsOf: new Map([[102, [25]], [103, [25]]]),
    instructorsOf: new Map([[25, [7]]]),
    created: [],
    existing: new Set(),
    ...overrides,
  };
}

function peersFor(w: World): Peers {
  return {
    listClosedSessions: async () => [],
    getSessionCounts: async () => ({ present: 0, late: 0, absent: 0, justified: 0, total: 0 }),
    getSession: async (id) => ({ classSessionId: id, scheduleBlockId: 4, sessionDate: '2026-10-22', sessionStatus: 'Closed' }),
    getBlock: async (id) => ({ scheduleBlockId: id, cohortId: 25, courseId: 3, instructorActorId: 7, environmentId: 2, startsAt: '07:00:00' }),
    getEnvironmentSchoolId: async () => 30,
    getCohortActorIds: async () => w.roster,
    getActorCohortIds: async (id) => w.cohortsOf.get(id) ?? [],
    getCohortInstructorIds: async (id) => w.instructorsOf.get(id) ?? [],
    getSessionRecordedActorIds: async () => w.recorded,
    createAbsentRecord: async (session, actorId) => {
      const key = `${session}:${actorId}`;
      if (w.existing.has(key)) return 'exists';
      w.existing.add(key);
      w.created.push([session, actorId]);
      return 'created';
    },
    getActor: async (id) => w.actors.find((a) => a.academicActorId === id) ?? null,
    getPerson: async (id) => w.people.find((p) => p.personId === id) ?? null,
    getSchoolActors: async () => w.actors,
    getSchoolSettings: async () => w.settings,
    getCourseName: async () => 'Bases de Datos',
    getCohortCode: async () => '3145556',
    listSchools: async () => [{ schoolId: 30, name: 'Sede QA' }],
    getAttendanceCounts: async (ids) => new Map(ids.filter((id) => w.attendance.has(id)).map((id) => [id, w.attendance.get(id)!])),
  };
}

function depsFor(w: World) {
  const claims = new Set<string>();
  const alerts: AlertRecord[] = [];
  const sent: EmailMessage[] = [];
  const deps: AlertDeps = {
    peers: peersFor(w),
    log: {
      claim: async (kind, key) => (claims.has(`${kind}|${key}`) ? false : (claims.add(`${kind}|${key}`), true)),
      release: async (kind, key) => void claims.delete(`${kind}|${key}`),
    },
    alerts: {
      create: async (draft: Partial<AlertRecord>) => {
        const record = { alertId: alerts.length + 1, createdAt: '', updatedAt: '', deletedAt: null, ...draft } as AlertRecord;
        alerts.push(record);
        return record;
      },
      update: async (id: number, patch: Partial<AlertRecord>) => {
        const found = alerts.find((a) => a.alertId === id);
        if (!found) return null;
        Object.assign(found, patch);
        return found;
      },
      findFiltered: async (filter: { typeId?: number; resolved?: boolean }) =>
        alerts.filter((a) => (filter.typeId === undefined || a.alertTypeId === filter.typeId) && (filter.resolved === undefined || (a.resolvedAt !== null) === filter.resolved)),
    } as unknown as AlertDeps['alerts'],
    alertTypes: { findByCode: async () => ({ alertTypeId: 3, code: 'ATTENDANCE_LOW' }) } as unknown as AlertDeps['alertTypes'],
    sendEmail: async (message) => void sent.push(message),
    logger: { info: () => undefined, warn: () => undefined },
  };
  return { deps, claims, alerts, sent };
}

const closed: ClassSessionClosed = {
  eventType: 'ClassSessionClosed',
  classSessionId: 1216,
  scheduleBlockId: 4,
  sessionDate: '2026-10-22',
  closedAt: '2026-10-22T10:00:00Z',
};

// ── class closed: absences ──────────────────────────────────────────────────

describe('handleClassSessionClosed', () => {
  it('marks as Absent every student of the cohort without a record, and e-mails the instructor', async () => {
    const w = world();
    const { deps, sent } = depsFor(w);

    const outcome = await handleClassSessionClosed(deps, closed);

    expect(outcome).toEqual({ absent: 2, recorded: 2, emailed: true });
    expect(w.created).toEqual([[1216, 102], [1216, 103]]);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('carlos@example.com');
    expect(sent[0].textBody).toContain('Luis Gómez');
    expect(sent[0].textBody).toContain('Zoe Díaz');
    expect(sent[0].textBody).not.toContain('Ana Pérez'); // she was registered
    expect(sent[0].subject).toContain('Bases de Datos');
  });

  it('does nothing when everyone was registered', async () => {
    const w = world({ recorded: [101, 102, 103] });
    const { deps, sent } = depsFor(w);

    expect(await handleClassSessionClosed(deps, closed)).toEqual({ absent: 0, recorded: 0, emailed: false });
    expect(sent).toHaveLength(0);
  });

  it('records the absences but sends no e-mail when the school turned "Alertas por correo" off', async () => {
    const w = world({ settings: { 'web.notify_email_alert': 'false' } });
    const { deps, sent } = depsFor(w);

    expect(await handleClassSessionClosed(deps, closed)).toEqual({ absent: 2, recorded: 2, emailed: false });
    expect(sent).toHaveLength(0);
  });

  it('is idempotent: a redelivered event neither records nor e-mails again', async () => {
    const w = world();
    const { deps, sent } = depsFor(w);

    await handleClassSessionClosed(deps, closed);
    const again = await handleClassSessionClosed(deps, closed);

    expect(again).toBeNull();
    expect(w.created).toHaveLength(2);
    expect(sent).toHaveLength(1);
  });

  it('gives the claim back when something fails, so the retry can do the work', async () => {
    const w = world();
    const { deps, claims, sent } = depsFor(w);
    const failing = { ...deps, sendEmail: async () => { throw new Error('smtp down'); } };

    await expect(handleClassSessionClosed(failing, closed)).rejects.toThrow('smtp down');
    expect(claims.size).toBe(0);

    const retry = await handleClassSessionClosed(deps, closed);
    expect(retry).toEqual({ absent: 2, recorded: 0, emailed: true }); // records existed already
    expect(sent).toHaveLength(1);
  });

  it('skips an event that is not ours and rejects one that is malformed', async () => {
    const { deps } = depsFor(world());

    expect(await handleClassSessionClosed(deps, { ...closed, eventType: 'SomethingElse' })).toBeNull();
    await expect(handleClassSessionClosed(deps, { ...closed, classSessionId: 0 })).rejects.toBeInstanceOf(
      InvalidClassSessionEventError,
    );
  });

  it('does not e-mail (and says so) when the instructor has no address', async () => {
    const w = world({ people: world().people.map((p) => (p.personId === 'p-inst' ? { ...p, email: null } : p)) });
    const { deps, sent } = depsFor(w);

    expect(await handleClassSessionClosed(deps, closed)).toEqual({ absent: 2, recorded: 2, emailed: false });
    expect(sent).toHaveLength(0);
  });

  it('escapes names in the HTML body', async () => {
    const w = world({ people: world().people.map((p) => (p.personId === 'p-102' ? { ...p, name: '<b>Luis</b>' } : p)) });
    const { deps, sent } = depsFor(w);

    await handleClassSessionClosed(deps, closed);

    expect(sent[0].htmlBody).toContain('&lt;b&gt;Luis&lt;/b&gt;');
    expect(sent[0].htmlBody).not.toContain('<b>Luis</b>');
  });
});

// ── daily pass: students at risk ────────────────────────────────────────────

describe('runRiskAlertPass', () => {
  const now = new Date('2026-10-22T22:00:00Z');
  const lowAndHigh = () =>
    world({
      attendance: new Map([
        [101, counts(9, 1)], // 90 %
        [102, counts(5, 5)], // 50 %: at risk
        [103, counts(1, 2)], // too few sessions to judge
      ]),
    });

  it('flags a student under the minimum, e-mailing their instructor and the school admin', async () => {
    const w = lowAndHigh();
    const { deps, alerts, sent } = depsFor(w);

    const outcome = await runRiskAlertPass(deps, now);

    expect(outcome).toEqual({ schools: 1, newlyAtRisk: 1, recovered: 0, emails: 2 });
    expect(alerts.map((a) => a.academicActorId)).toEqual([102]);
    expect(sent.map((m) => m.to).sort()).toEqual(['carlos@example.com', 'rosa@example.com']);
    expect(sent.every((m) => m.textBody.includes('Luis Gómez (50%)'))).toBe(true);
    expect(sent.some((m) => m.textBody.includes('Ana Pérez'))).toBe(false);
  });

  it(`ignores students with fewer than ${MIN_SESSIONS_FOR_RISK} sessions on record`, async () => {
    const { deps, alerts } = depsFor(lowAndHigh());

    await runRiskAlertPass(deps, now);

    expect(alerts.some((a) => a.academicActorId === 103)).toBe(false);
  });

  it('does not alert or e-mail again while the alert is still open', async () => {
    const { deps, alerts, sent } = depsFor(lowAndHigh());

    await runRiskAlertPass(deps, now);
    const second = await runRiskAlertPass(deps, new Date('2026-10-23T22:00:00Z'));

    expect(second).toMatchObject({ newlyAtRisk: 0, emails: 0 });
    expect(alerts).toHaveLength(1);
    expect(sent).toHaveLength(2);
  });

  it('resolves the alert when the student recovers, so they can be flagged again later', async () => {
    const w = lowAndHigh();
    const { deps, alerts } = depsFor(w);
    await runRiskAlertPass(deps, now);

    w.attendance.set(102, counts(9, 1));
    const outcome = await runRiskAlertPass(deps, new Date('2026-10-30T22:00:00Z'));

    expect(outcome.recovered).toBe(1);
    expect(alerts[0].resolvedAt).not.toBeNull();
  });

  it('sends at most one e-mail per recipient per day even if the pass runs twice', async () => {
    const w = lowAndHigh();
    const first = depsFor(w);
    await runRiskAlertPass(first.deps, now);

    // a fresh set of alerts (as if they had been resolved) but the same notification log
    first.alerts.length = 0;
    const again = await runRiskAlertPass(first.deps, now);

    expect(again.newlyAtRisk).toBe(1);
    expect(again.emails).toBe(0);
    expect(first.sent).toHaveLength(2);
  });

  it('does nothing for a school that turned the at-risk alert off', async () => {
    const w = lowAndHigh();
    w.settings['web.notify_at_risk'] = 'false';
    const { deps, alerts, sent } = depsFor(w);

    expect(await runRiskAlertPass(deps, now)).toMatchObject({ schools: 0, newlyAtRisk: 0 });
    expect(alerts).toHaveLength(0);
    expect(sent).toHaveLength(0);
  });

  it('uses the school minimum attendance setting', async () => {
    const w = lowAndHigh();
    w.settings['web.min_attendance'] = '40'; // 50 % is now fine
    const { deps, alerts } = depsFor(w);

    expect((await runRiskAlertPass(deps, now)).newlyAtRisk).toBe(0);
    expect(alerts).toHaveLength(0);
  });
});

describe('helpers', () => {
  it('counts Present, Late and Justified as attended', () => {
    expect(attendanceRate({ present: 6, late: 2, absent: 1, justified: 1, total: 10 })).toBe(90);
    expect(attendanceRate(undefined)).toBeNull();
    expect(attendanceRate({ present: 0, late: 0, absent: 0, justified: 0, total: 0 })).toBeNull();
  });

  it('reads the school settings with the defaults the web shows', () => {
    expect(alertSettingsFrom({})).toEqual({ emailAbsences: true, atRiskAlerts: true, dailySummary: false, weeklyReport: true, minAttendance: 80 });
    expect(alertSettingsFrom({ 'web.notify_email_alert': 'false', 'web.min_attendance': '70' })).toEqual({
      emailAbsences: false,
      atRiskAlerts: true,
      dailySummary: false,
      weeklyReport: true,
      minAttendance: 70,
    });
    expect(alertSettingsFrom({ 'web.min_attendance': 'nope' }).minAttendance).toBe(80);
  });
});
