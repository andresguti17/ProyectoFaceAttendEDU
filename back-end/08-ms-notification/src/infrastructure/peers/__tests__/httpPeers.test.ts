import { alertsOffReason, HttpPeers, peerConfigFromEnv, PeerHttpError, type FetchFn, type PeerConfig } from '../httpPeers';

const cfg: PeerConfig = {
  identityUrl: 'http://identity',
  schedulingUrl: 'http://scheduling',
  academicUrl: 'http://academic',
  attendanceUrl: 'http://attendance',
  configurationUrl: 'http://configuration',
  username: 'svc',
  password: 'pw',
};

interface Call {
  url: string;
  method: string;
  auth: string | undefined;
  body: unknown;
}

/** A scripted fake of the other services: `routes` maps "METHOD url" to a status and body. */
function fakeFetch(routes: Record<string, { status: number; body?: unknown } | Array<{ status: number; body?: unknown }>>) {
  const calls: Call[] = [];
  const fetchFn: FetchFn = async (url, init) => {
    const method = init?.method ?? 'GET';
    calls.push({ url, method, auth: init?.headers?.authorization, body: init?.body ? JSON.parse(init.body) : undefined });
    const entry = routes[`${method} ${url}`];
    const next = Array.isArray(entry) ? entry.shift() : entry;
    const { status, body } = next ?? { status: 404 };
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  };
  return { fetchFn, calls };
}

const LOGIN = 'POST http://identity/api/v1/auth/login';

describe('peerConfigFromEnv', () => {
  it('is off without a service account', () => {
    expect(peerConfigFromEnv({})).toBeNull();
    expect(peerConfigFromEnv({ NOTIFICATION_SERVICE_USERNAME: 'svc' })).toBeNull();
  });

  it('is off when the alerts are switched off explicitly', () => {
    expect(peerConfigFromEnv({ NOTIFICATION_SERVICE_USERNAME: 'svc', NOTIFICATION_SERVICE_PASSWORD: 'pw', ATTENDANCE_ALERTS_ENABLED: 'false' })).toBeNull();
  });

  it('reads the service urls, with trailing slashes removed', () => {
    const config = peerConfigFromEnv({
      NOTIFICATION_SERVICE_USERNAME: 'svc',
      NOTIFICATION_SERVICE_PASSWORD: 'pw',
      ACADEMIC_URL: 'http://ms-academic:8083/',
    });
    expect(config).toMatchObject({ academicUrl: 'http://ms-academic:8083', username: 'svc' });
  });
});

describe('alertsOffReason', () => {
  const account = { NOTIFICATION_SERVICE_USERNAME: 'svc', NOTIFICATION_SERVICE_PASSWORD: 'pw' };

  it('reports a missing service account as a misconfiguration', () => {
    expect(alertsOffReason({})).toBe('no-service-account');
    expect(alertsOffReason({ NOTIFICATION_SERVICE_USERNAME: 'svc' })).toBe('no-service-account');
  });

  it('reports an explicit switch-off as a decision, with or without the account', () => {
    expect(alertsOffReason({ ATTENDANCE_ALERTS_ENABLED: 'false' })).toBe('switched-off');
    expect(alertsOffReason({ ...account, ATTENDANCE_ALERTS_ENABLED: 'False' })).toBe('switched-off');
  });

  it('is null when the alerts are on', () => {
    expect(alertsOffReason(account)).toBeNull();
  });
});

describe('HttpPeers', () => {
  it('logs in once and reuses the session for every call', async () => {
    const { fetchFn, calls } = fakeFetch({
      [LOGIN]: { status: 200, body: { sessionId: 'sess-1' } },
      'GET http://academic/api/v1/cohorts/25': { status: 200, body: { code: '3145556' } },
      'GET http://academic/api/v1/courses/3': { status: 200, body: { name: 'Bases de Datos' } },
    });
    const peers = new HttpPeers(cfg, fetchFn);

    expect(await peers.getCohortCode(25)).toBe('3145556');
    expect(await peers.getCourseName(3)).toBe('Bases de Datos');

    expect(calls.filter((c) => c.url.endsWith('/auth/login'))).toHaveLength(1);
    expect(calls.filter((c) => c.auth === 'Bearer sess-1')).toHaveLength(2);
  });

  it('logs in again and retries once when a call answers 401 (expired session)', async () => {
    const { fetchFn, calls } = fakeFetch({
      [LOGIN]: [
        { status: 200, body: { sessionId: 'old' } },
        { status: 200, body: { sessionId: 'new' } },
      ],
      'GET http://academic/api/v1/cohorts/25': [{ status: 401 }, { status: 200, body: { code: 'X' } }],
    });
    const peers = new HttpPeers(cfg, fetchFn);

    expect(await peers.getCohortCode(25)).toBe('X');
    expect(calls.map((c) => c.auth)).toEqual([undefined, 'Bearer old', undefined, 'Bearer new']);
  });

  it('fails clearly when the service account cannot log in', async () => {
    const { fetchFn } = fakeFetch({ [LOGIN]: { status: 401, body: { error: 'UNAUTHORIZED' } } });

    await expect(new HttpPeers(cfg, fetchFn).getCohortCode(25)).rejects.toThrow('service account login failed');
  });

  it('answers null for a missing resource and throws for a failing service', async () => {
    const { fetchFn } = fakeFetch({
      [LOGIN]: { status: 200, body: { sessionId: 's' } },
      'GET http://scheduling/api/v1/class-sessions/1': { status: 404 },
      'GET http://scheduling/api/v1/class-sessions/2': { status: 503 },
    });
    const peers = new HttpPeers(cfg, fetchFn);

    expect(await peers.getSession(1)).toBeNull();
    await expect(peers.getSession(2)).rejects.toBeInstanceOf(PeerHttpError);
  });

  it('creates an Absent record and treats "already there" (409) as done', async () => {
    const { fetchFn, calls } = fakeFetch({
      [LOGIN]: { status: 200, body: { sessionId: 's' } },
      'POST http://attendance/api/v1/attendance-records': [{ status: 201, body: {} }, { status: 409 }],
    });
    const peers = new HttpPeers(cfg, fetchFn);

    expect(await peers.createAbsentRecord(1216, 102)).toBe('created');
    expect(await peers.createAbsentRecord(1216, 102)).toBe('exists');
    expect(calls.find((c) => c.url.endsWith('/attendance-records'))?.body).toEqual({
      classSessionId: 1216,
      academicActorId: 102,
      attendanceStatus: 'Absent',
      captureMethod: 'MANUAL',
    });
  });

  it('only counts active enrollments in the roster', async () => {
    const { fetchFn } = fakeFetch({
      [LOGIN]: { status: 200, body: { sessionId: 's' } },
      'GET http://academic/api/v1/cohorts/25/enrollments?limit=100&offset=0': {
        status: 200,
        body: [
          { academicActorId: 1, enrollmentStatus: 'Active' },
          { academicActorId: 2, enrollmentStatus: 'Withdrawn' },
          { academicActorId: 3, enrollmentStatus: 'Active' },
        ],
      },
    });

    expect(await new HttpPeers(cfg, fetchFn).getCohortActorIds(25)).toEqual([1, 3]);
  });

  it('reads every page of a long list', async () => {
    const page = (from: number, n: number) => Array.from({ length: n }, (_, i) => ({ academicActorId: from + i, personId: 'p', actorTypeId: 1, schoolId: 3, status: true }));
    const { fetchFn } = fakeFetch({
      [LOGIN]: { status: 200, body: { sessionId: 's' } },
      'GET http://academic/api/v1/schools/3/actors?limit=100&offset=0': { status: 200, body: page(1, 100) },
      'GET http://academic/api/v1/schools/3/actors?limit=100&offset=100': { status: 200, body: page(101, 40) },
    });

    expect(await new HttpPeers(cfg, fetchFn).getSchoolActors(3)).toHaveLength(140);
  });

  it('asks for the attendance summary in chunks and merges the answers', async () => {
    const ids = Array.from({ length: 150 }, (_, i) => i + 1);
    const { fetchFn, calls } = fakeFetch({
      [LOGIN]: { status: 200, body: { sessionId: 's' } },
      [`GET http://attendance/api/v1/attendance-records/summary?academicActorIds=${ids.slice(0, 100).join(',')}`]: {
        status: 200,
        body: { '1': { present: 4, late: 1, absent: 0, justified: 0, total: 5 } },
      },
      [`GET http://attendance/api/v1/attendance-records/summary?academicActorIds=${ids.slice(100).join(',')}`]: {
        status: 200,
        body: { '120': { present: 1, late: 0, absent: 4, justified: 0, total: 5 } },
      },
    });

    const counts = await new HttpPeers(cfg, fetchFn).getAttendanceCounts(ids);

    expect(calls.filter((c) => c.url.includes('/summary'))).toHaveLength(2);
    expect(counts.get(1)).toEqual({ present: 4, late: 1, absent: 0, justified: 0, total: 5 });
    expect(counts.get(120)?.absent).toBe(4);
  });

  it('lists the closed sessions of a date range and counts a session by status', async () => {
    const { fetchFn } = fakeFetch({
      [LOGIN]: { status: 200, body: { sessionId: 's' } },
      'GET http://scheduling/api/v1/class-sessions?from=2026-10-14&to=2026-10-20&sessionStatus=Closed&limit=100&offset=0': {
        status: 200,
        body: [{ classSessionId: 5, scheduleBlockId: 2, sessionDate: '2026-10-15', sessionStatus: 'Closed' }],
      },
      'GET http://attendance/api/v1/class-sessions/5/attendance': {
        status: 200,
        body: [{ attendanceStatus: 'Present' }, { attendanceStatus: 'Present' }, { attendanceStatus: 'Late' }, { attendanceStatus: 'Absent' }, { attendanceStatus: 'Justified' }],
      },
    });
    const peers = new HttpPeers(cfg, fetchFn);

    expect(await peers.listClosedSessions('2026-10-14', '2026-10-20')).toEqual([
      { classSessionId: 5, scheduleBlockId: 2, sessionDate: '2026-10-15', sessionStatus: 'Closed' },
    ]);
    expect(await peers.getSessionCounts(5)).toEqual({ present: 2, late: 1, absent: 1, justified: 1, total: 5 });
  });

  it('reads the school settings as a name -> value map', async () => {
    const { fetchFn } = fakeFetch({
      [LOGIN]: { status: 200, body: { sessionId: 's' } },
      'GET http://configuration/api/v1/schools/3/configurations': {
        status: 200,
        body: [
          { configurationName: 'web.min_attendance', configurationValue: '75' },
          { configurationName: 'web.notify_email_alert', configurationValue: 'false' },
        ],
      },
    });

    expect(await new HttpPeers(cfg, fetchFn).getSchoolSettings(3)).toEqual({
      'web.min_attendance': '75',
      'web.notify_email_alert': 'false',
    });
  });

  it('returns a person without an address as null e-mail', async () => {
    const { fetchFn } = fakeFetch({
      [LOGIN]: { status: 200, body: { sessionId: 's' } },
      'GET http://identity/api/v1/persons/p1': { status: 200, body: { personId: 'p1', name: 'Ana', lastName: 'Pérez', email: '  ' } },
    });

    expect(await new HttpPeers(cfg, fetchFn).getPerson('p1')).toEqual({ personId: 'p1', name: 'Ana', lastName: 'Pérez', email: null });
  });
});
