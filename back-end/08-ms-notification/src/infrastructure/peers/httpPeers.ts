import {
  type ActorInfo,
  type AttendanceCounts,
  type BlockInfo,
  type Peers,
  type PersonInfo,
  type SessionInfo,
} from '../../application/attendanceAlerts/peers';

/**
 * HTTP implementation of `Peers`: reads the other services with a service account.
 *
 * The other services authorize every call with a session (Bearer = session id from identity) and
 * RBAC, so this logs in once with the service account configured in the environment, reuses the
 * session, and logs in again when a call answers 401 (an expired session).
 */
export interface PeerConfig {
  identityUrl: string;
  schedulingUrl: string;
  academicUrl: string;
  attendanceUrl: string;
  configurationUrl: string;
  username: string;
  password: string;
}

/** Environment: `null` (feature off) unless a service account is configured. */
export function peerConfigFromEnv(env: NodeJS.ProcessEnv = process.env): PeerConfig | null {
  const username = (env.NOTIFICATION_SERVICE_USERNAME ?? '').trim();
  const password = env.NOTIFICATION_SERVICE_PASSWORD ?? '';
  if (!username || !password) return null;
  if ((env.ATTENDANCE_ALERTS_ENABLED ?? 'true').trim().toLowerCase() === 'false') return null;
  const url = (name: string, fallback: string) => ((env[name] ?? '').trim() || fallback).replace(/\/$/, '');
  return {
    identityUrl: url('IDENTITY_URL', 'http://localhost:8081'),
    schedulingUrl: url('SCHEDULING_URL', 'http://localhost:8084'),
    academicUrl: url('ACADEMIC_URL', 'http://localhost:8083'),
    attendanceUrl: url('ATTENDANCE_URL', 'http://localhost:8085'),
    configurationUrl: url('CONFIGURATION_URL', 'http://localhost:8087'),
    username,
    password,
  };
}

export type FetchFn = (input: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

const PAGE_SIZE = 100;
const SUMMARY_CHUNK = 100;

export class PeerHttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

type Row = Record<string, unknown>;
type Service = 'scheduling' | 'academic' | 'attendance' | 'configuration' | 'identity';

export class HttpPeers implements Peers {
  private token: string | null = null;

  constructor(
    private readonly cfg: PeerConfig,
    private readonly fetchFn: FetchFn = (globalThis.fetch as unknown as FetchFn),
  ) {}

  // ── transport ────────────────────────────────────────────────────────────

  private base(service: Service): string {
    return {
      scheduling: this.cfg.schedulingUrl,
      academic: this.cfg.academicUrl,
      attendance: this.cfg.attendanceUrl,
      configuration: this.cfg.configurationUrl,
      identity: this.cfg.identityUrl,
    }[service];
  }

  private async login(): Promise<string> {
    const res = await this.fetchFn(`${this.cfg.identityUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: this.cfg.username, password: this.cfg.password }),
    });
    const body = (await res.json().catch(() => null)) as Row | null;
    const sessionId = body?.sessionId ?? body?.session_id;
    if (!res.ok || typeof sessionId !== 'string') {
      throw new PeerHttpError(res.status, `service account login failed (status ${res.status})`);
    }
    this.token = sessionId;
    return sessionId;
  }

  private async send(service: Service, method: string, path: string, body?: unknown): Promise<{ status: number; data: unknown }> {
    for (let attempt = 0; ; attempt += 1) {
      const token = this.token ?? (await this.login());
      const res = await this.fetchFn(`${this.base(service)}${path}`, {
        method,
        headers: { authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (res.status === 401 && attempt === 0) {
        this.token = null; // expired: log in again once
        continue;
      }
      const data = res.status === 204 ? null : await res.json().catch(() => null);
      return { status: res.status, data };
    }
  }

  /** The parsed body, or `null` for 404. Any other failure throws. */
  private async get(service: Service, path: string): Promise<unknown> {
    const { status, data } = await this.send(service, 'GET', path);
    if (status === 404) return null;
    if (status < 200 || status >= 300) throw new PeerHttpError(status, `GET ${service}${path} answered ${status}`);
    return data;
  }

  private async getList(service: Service, path: string): Promise<Row[]> {
    const data = await this.get(service, path);
    return Array.isArray(data) ? (data as Row[]) : [];
  }

  /** Every page of a `?limit=&offset=` list. */
  private async getAll(service: Service, path: string): Promise<Row[]> {
    const rows: Row[] = [];
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const sep = path.includes('?') ? '&' : '?';
      const page = await this.getList(service, `${path}${sep}limit=${PAGE_SIZE}&offset=${offset}`);
      rows.push(...page);
      if (page.length < PAGE_SIZE) return rows;
    }
  }

  // ── Peers ────────────────────────────────────────────────────────────────

  async getSession(id: number): Promise<SessionInfo | null> {
    const row = (await this.get('scheduling', `/api/v1/class-sessions/${id}`)) as Row | null;
    return row && { classSessionId: Number(row.classSessionId), scheduleBlockId: Number(row.scheduleBlockId), sessionDate: String(row.sessionDate), sessionStatus: String(row.sessionStatus) };
  }

  async getBlock(id: number): Promise<BlockInfo | null> {
    const row = (await this.get('scheduling', `/api/v1/schedule-blocks/${id}`)) as Row | null;
    return row && {
      scheduleBlockId: Number(row.scheduleBlockId),
      cohortId: Number(row.cohortId),
      courseId: Number(row.courseId),
      instructorActorId: Number(row.instructorActorId),
      environmentId: Number(row.environmentId),
      startsAt: String(row.startsAt),
    };
  }

  async getEnvironmentSchoolId(environmentId: number): Promise<number | null> {
    const row = (await this.get('scheduling', `/api/v1/environments/${environmentId}`)) as Row | null;
    return row && row.schoolId != null ? Number(row.schoolId) : null;
  }

  async getCohortActorIds(cohortId: number): Promise<number[]> {
    const rows = await this.getAll('academic', `/api/v1/cohorts/${cohortId}/enrollments`);
    return rows.filter((r) => r.enrollmentStatus === 'Active').map((r) => Number(r.academicActorId));
  }

  async getActorCohortIds(actorId: number): Promise<number[]> {
    const rows = await this.getList('academic', `/api/v1/academic-actors/${actorId}/enrollments`);
    return rows.filter((r) => r.enrollmentStatus === 'Active').map((r) => Number(r.cohortId));
  }

  async getCohortInstructorIds(cohortId: number): Promise<number[]> {
    const rows = await this.getList('scheduling', `/api/v1/schedule-blocks?cohortId=${cohortId}`);
    return [...new Set(rows.map((r) => Number(r.instructorActorId)))];
  }

  async getSessionRecordedActorIds(sessionId: number): Promise<number[]> {
    const rows = await this.getList('attendance', `/api/v1/class-sessions/${sessionId}/attendance`);
    return rows.map((r) => Number(r.academicActorId));
  }

  async createAbsentRecord(sessionId: number, actorId: number): Promise<'created' | 'exists'> {
    const { status } = await this.send('attendance', 'POST', '/api/v1/attendance-records', {
      classSessionId: sessionId,
      academicActorId: actorId,
      attendanceStatus: 'Absent',
      captureMethod: 'MANUAL',
    });
    if (status === 409) return 'exists';
    if (status < 200 || status >= 300) throw new PeerHttpError(status, `creating the Absent record answered ${status}`);
    return 'created';
  }

  private toActor(row: Row): ActorInfo {
    return {
      academicActorId: Number(row.academicActorId),
      personId: String(row.personId),
      actorTypeId: Number(row.actorTypeId),
      schoolId: Number(row.schoolId),
      status: row.status !== false,
    };
  }

  async getActor(actorId: number): Promise<ActorInfo | null> {
    const row = (await this.get('academic', `/api/v1/academic-actors/${actorId}`)) as Row | null;
    return row && this.toActor(row);
  }

  async getPerson(personId: string): Promise<PersonInfo | null> {
    const row = (await this.get('identity', `/api/v1/persons/${personId}`)) as Row | null;
    return row && {
      personId: String(row.personId),
      name: String(row.name ?? ''),
      lastName: String(row.lastName ?? ''),
      email: typeof row.email === 'string' && row.email.trim() ? row.email.trim() : null,
    };
  }

  async getSchoolActors(schoolId: number): Promise<ActorInfo[]> {
    return (await this.getAll('academic', `/api/v1/schools/${schoolId}/actors`)).map((row) => this.toActor(row));
  }

  async getSchoolSettings(schoolId: number): Promise<Record<string, string>> {
    const rows = await this.getList('configuration', `/api/v1/schools/${schoolId}/configurations`);
    return Object.fromEntries(rows.map((r) => [String(r.configurationName), String(r.configurationValue ?? '')]));
  }

  async getCourseName(courseId: number): Promise<string> {
    const row = (await this.get('academic', `/api/v1/courses/${courseId}`)) as Row | null;
    return row ? String(row.name) : `Curso ${courseId}`;
  }

  async getCohortCode(cohortId: number): Promise<string> {
    const row = (await this.get('academic', `/api/v1/cohorts/${cohortId}`)) as Row | null;
    return row ? String(row.code) : String(cohortId);
  }

  async listSchools(): Promise<Array<{ schoolId: number; name: string }>> {
    const rows = await this.getAll('academic', '/api/v1/schools');
    return rows.filter((r) => r.status !== false).map((r) => ({ schoolId: Number(r.schoolId), name: String(r.name) }));
  }

  async listClosedSessions(from: string, to: string): Promise<SessionInfo[]> {
    const rows = await this.getAll('scheduling', `/api/v1/class-sessions?from=${from}&to=${to}&sessionStatus=Closed`);
    return rows.map((row) => ({
      classSessionId: Number(row.classSessionId),
      scheduleBlockId: Number(row.scheduleBlockId),
      sessionDate: String(row.sessionDate),
      sessionStatus: String(row.sessionStatus),
    }));
  }

  async getSessionCounts(sessionId: number): Promise<AttendanceCounts> {
    const rows = await this.getList('attendance', `/api/v1/class-sessions/${sessionId}/attendance`);
    const counts: AttendanceCounts = { present: 0, late: 0, absent: 0, justified: 0, total: rows.length };
    for (const row of rows) {
      const key = String(row.attendanceStatus ?? '').toLowerCase() as 'present' | 'late' | 'absent' | 'justified';
      if (key in counts) counts[key] += 1;
    }
    return counts;
  }

  async getAttendanceCounts(actorIds: number[]): Promise<Map<number, AttendanceCounts>> {
    const result = new Map<number, AttendanceCounts>();
    for (let i = 0; i < actorIds.length; i += SUMMARY_CHUNK) {
      const chunk = actorIds.slice(i, i + SUMMARY_CHUNK);
      const data = (await this.get('attendance', `/api/v1/attendance-records/summary?academicActorIds=${chunk.join(',')}`)) as Record<string, Row> | null;
      for (const [id, row] of Object.entries(data ?? {})) {
        result.set(Number(id), {
          present: Number(row.present ?? 0),
          late: Number(row.late ?? 0),
          absent: Number(row.absent ?? 0),
          justified: Number(row.justified ?? 0),
          total: Number(row.total ?? 0),
        });
      }
    }
    return result;
  }
}
