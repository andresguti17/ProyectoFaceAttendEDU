/**
 * HTTP tests for configuration routes on in-memory repositories. Covers school
 * isolation for academic settings, Super Administrador-only security settings,
 * the public security keys and the biometric update cases (own cases, reviewers
 * limited to their school, no self-review).
 */
import Fastify, { type FastifyInstance } from 'fastify';
import { getJson } from '../infrastructure/http/authGuard';
import { registerConfigurationRoutes } from '../infrastructure/http/routes';
import { clearCallerSchoolCache } from '../infrastructure/http/callerSchool';
import { clearCaseScopeCache } from '../infrastructure/http/caseScope';
import { memoryRepositories } from './support/memoryRepositories';

jest.mock('../infrastructure/http/authGuard', () => ({ getJson: jest.fn() }));
const mockGetJson = getJson as jest.MockedFunction<typeof getJson>;

type User = { id: string; roles: string[]; personId?: string; reviewer?: boolean };
const USERS: Record<string, User> = {
  super: { id: 'aaaaaaaa-0000-4000-8000-000000000001', roles: ['Super Administrador'] },
  admin1: { id: 'aaaaaaaa-0000-4000-8000-000000000002', roles: ['Administrador'], personId: 'pppppppp-0000-4000-8000-0000000000a1', reviewer: true },
  admin2: { id: 'aaaaaaaa-0000-4000-8000-000000000003', roles: ['Administrador'], personId: 'pppppppp-0000-4000-8000-0000000000a2', reviewer: true },
  student1: { id: 'aaaaaaaa-0000-4000-8000-000000000004', roles: ['Aprendiz'], personId: 'pppppppp-0000-4000-8000-0000000000s1' },
  student2: { id: 'aaaaaaaa-0000-4000-8000-000000000005', roles: ['Aprendiz'], personId: 'pppppppp-0000-4000-8000-0000000000s2' },
  ghost: { id: 'aaaaaaaa-0000-4000-8000-000000000006', roles: ['Aprendiz'] },
};
// Person ids must be UUIDs for the case payloads; swap the placeholder letters for hex.
for (const u of Object.values(USERS)) if (u.personId) u.personId = u.personId.replace(/p/g, 'b').replace(/s/g, 'c');
const PERSON = (name: string) => USERS[name].personId as string;
const ACTORS = [
  { personId: PERSON('admin1'), schoolId: 1 },
  { personId: PERSON('student1'), schoolId: 1 },
  { personId: PERSON('admin2'), schoolId: 2 },
  { personId: PERSON('student2'), schoolId: 2 },
];
const byId = (id: string) => Object.values(USERS).find((u) => u.id === id);

let app: FastifyInstance;
let repos: ReturnType<typeof memoryRepositories>;

beforeEach(async () => {
  clearCallerSchoolCache();
  clearCaseScopeCache();
  mockGetJson.mockReset();
  mockGetJson.mockImplementation(async (url: string) => {
    const u = new URL(url);
    const roles = u.pathname.match(/\/users\/([^/]+)\/roles$/);
    if (roles) return { status: 200, body: (byId(decodeURIComponent(roles[1]))?.roles ?? []).map((roleName) => ({ roleName })) };
    if (u.pathname.endsWith('/auth/evaluate')) return { status: 200, body: { allowed: !!byId(u.searchParams.get('userId') ?? '')?.reviewer } };
    const user = u.pathname.match(/\/users\/([^/]+)$/);
    if (user) {
      const found = byId(decodeURIComponent(user[1]));
      return found ? { status: 200, body: { personId: found.personId ?? null } } : { status: 404, body: null };
    }
    if (u.pathname.endsWith('/academic-actors')) {
      const personId = u.searchParams.get('personId');
      if (personId) return { status: 200, body: ACTORS.filter((a) => a.personId === personId) };
      const offset = Number(u.searchParams.get('offset') ?? 0);
      return { status: 200, body: ACTORS.slice(offset, offset + Number(u.searchParams.get('limit') ?? 100)) };
    }
    return { status: 404, body: null };
  });
  repos = memoryRepositories();
  app = Fastify();
  app.addHook('onRequest', async (req) => {
    const who = req.headers['x-test-user'];
    if (typeof who === 'string' && USERS[who]) {
      (req as any).userId = USERS[who].id;
      (req as any).authToken = `token-${who}`;
    }
  });
  await registerConfigurationRoutes(app, repos);
});

afterEach(async () => {
  await app.close();
});

function call(user: string | null, method: string, url: string, payload?: unknown) {
  return app.inject({ method: method as any, url, payload: payload as any, headers: user ? { 'x-test-user': user } : {} });
}

describe.each(['/api/v1/configurations/academic', '/api/v1/academic-configurations'])('academic configuration at %s', (base) => {
  const row = (schoolId: number, name = 'attendance.late_minutes') => ({ schoolId, configurationName: name, configurationValue: '10' });

  it('is created only for the caller school, after validating the payload', async () => {
    expect((await call('admin1', 'POST', base, { schoolId: 1 })).statusCode).toBe(400);
    expect((await call('admin1', 'POST', base, row(2))).statusCode).toBe(403);
    const created = await call('admin1', 'POST', base, row(1));
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ schoolId: 1, configurationValue: '10' });
    expect((await call(null, 'POST', base, row(1))).statusCode).toBe(403);
  });

  it('lists only the caller school (name filter and paging); Super Administrador sees all', async () => {
    await repos.academic.create(row(1));
    await repos.academic.create(row(1, 'attendance.absent_after'));
    await repos.academic.create(row(2));
    expect((await call('admin1', 'GET', base)).json()).toHaveLength(2);
    expect((await call('admin1', 'GET', `${base}?name=attendance.absent_after`)).json()).toHaveLength(1);
    const paged = await call('super', 'GET', `${base}?limit=1&offset=2`);
    expect(paged.headers['x-total-count']).toBe('3');
    expect(paged.json()[0].schoolId).toBe(2);
    expect((await call('ghost', 'GET', base)).json()).toEqual([]);
  });

  it('reads, edits and deletes only own rows and never moves one to another school', async () => {
    const own = (await repos.academic.create(row(1))).configurationId;
    const foreign = (await repos.academic.create(row(2))).configurationId;
    expect((await call('admin1', 'GET', `${base}/${foreign}`)).statusCode).toBe(404);
    expect((await call('admin1', 'GET', `${base}/abc`)).statusCode).toBe(404);
    expect((await call('admin1', 'GET', `${base}/${own}`)).json().schoolId).toBe(1);
    expect((await call('admin1', 'PUT', `${base}/${own}`, { schoolId: 2 })).statusCode).toBe(403);
    expect((await call('admin1', 'PUT', `${base}/${foreign}`, { configurationValue: '5' })).statusCode).toBe(404);
    expect((await call('admin1', 'PUT', `${base}/${own}`, { configurationName: '' })).statusCode).toBe(400);
    expect((await call('admin1', 'PUT', `${base}/${own}`, { configurationValue: '15' })).json().configurationValue).toBe('15');
    expect((await call('admin1', 'DELETE', `${base}/${foreign}`)).statusCode).toBe(404);
    expect((await call('admin1', 'DELETE', `${base}/${own}`)).statusCode).toBe(204);
    expect((await call('admin1', 'DELETE', `${base}/${own}`)).statusCode).toBe(404);
  });
});

describe.each(['/api/v1/configurations/security', '/api/v1/security-configurations'])('security configuration at %s', (base) => {
  it('only Super Administrador writes it; anyone authenticated reads it', async () => {
    expect((await call('super', 'POST', base, { configurationValue: 'x' })).statusCode).toBe(400);
    const denied = await call('admin1', 'POST', base, { configurationName: 'auth.max_attempts', configurationValue: '5' });
    expect(denied.statusCode).toBe(403);
    expect(denied.json().message).toMatch(/Super Administrador/);
    const created = await call('super', 'POST', base, { configurationName: 'auth.max_attempts', configurationValue: '5' });
    expect(created.statusCode).toBe(201);
    const id = created.json().configurationId;

    expect((await call('admin1', 'GET', `${base}?name=auth.max_attempts`)).json()).toHaveLength(1);
    expect((await call('admin1', 'GET', `${base}?limit=10`)).headers['x-total-count']).toBe('1');
    expect((await call('admin1', 'GET', `${base}/${id}`)).json().configurationValue).toBe('5');
    expect((await call('admin1', 'GET', `${base}/999`)).statusCode).toBe(404);

    expect((await call('admin1', 'PUT', `${base}/${id}`, { configurationValue: '9' })).statusCode).toBe(403);
    expect((await call('super', 'PUT', `${base}/${id}`, { configurationName: '' })).statusCode).toBe(400);
    expect((await call('super', 'PUT', `${base}/${id}`, { configurationValue: '9' })).json().configurationValue).toBe('9');
    expect((await call('super', 'PUT', `${base}/abc`, { configurationValue: '9' })).statusCode).toBe(404);
    expect((await call('admin1', 'DELETE', `${base}/${id}`)).statusCode).toBe(403);
    expect((await call('super', 'DELETE', `${base}/${id}`)).statusCode).toBe(204);
    expect((await call('super', 'DELETE', `${base}/${id}`)).statusCode).toBe(404);
  });
});

describe('public security settings', () => {
  it('exposes only the idle sign-out time and the two-factor preference', async () => {
    await repos.security.create({ configurationName: 'web.session_time', configurationValue: '30' });
    await repos.security.create({ configurationName: 'web.two_factor', configurationValue: 'true' });
    await repos.security.create({ configurationName: 'auth.lockout_minutes', configurationValue: '15' });
    const res = await call('student1', 'GET', '/api/v1/configurations/security/public');
    expect(res.json()).toEqual([
      { configurationName: 'web.session_time', configurationValue: '30' },
      { configurationName: 'web.two_factor', configurationValue: 'true' },
    ]);
  });
});

describe('school configurations', () => {
  it('lists a school configuration only for that school', async () => {
    await repos.academic.create({ schoolId: 1, configurationName: 'a', configurationValue: '1' });
    expect((await call('admin1', 'GET', '/api/v1/schools/2/configurations')).statusCode).toBe(403);
    expect((await call('admin1', 'GET', '/api/v1/schools/1/configurations')).json()).toHaveLength(1);
    expect((await call('admin1', 'GET', '/api/v1/schools/1/configurations?limit=1')).headers['x-total-count']).toBe('1');
    expect((await call('admin1', 'GET', '/api/v1/schools/x/configurations')).json()).toEqual([]);
  });
});

describe('biometric update cases', () => {
  const facial = (person: string) => ({ personId: PERSON(person), biometricType: 'FACIAL', reason: 'Cambio de apariencia' });

  it('a person requests an update only for themselves; the requester is the session user', async () => {
    expect((await call('student1', 'POST', '/api/v1/biometric-update-cases', { reason: 'x' })).statusCode).toBe(400);
    const other = await call('student1', 'POST', '/api/v1/biometric-update-cases', facial('student2'));
    expect(other.statusCode).toBe(403);
    expect(other.json().message).toMatch(/your own biometric data/);
    const created = await call('student1', 'POST', '/api/v1/biometric-update-cases', { ...facial('student1'), fingerNumber: 3 });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ updateStatus: 'Pending', requestedBy: USERS.student1.id, fingerNumber: null });
    const finger = await call('student1', 'POST', '/api/v1/biometric-update-cases', { ...facial('student1'), biometricType: 'FINGERPRINT' });
    expect(finger.statusCode).toBe(400);
    expect(finger.json().message).toBe('fingerNumber required for FINGERPRINT');
  });

  it('a user without a person cannot request anything', async () => {
    const res = await call('ghost', 'POST', '/api/v1/biometric-update-cases', facial('student1'));
    expect(res.statusCode).toBe(403);
    expect(res.json().message).toBe('The user is not linked to a person');
  });

  it('lists: own cases for a person, school cases for a reviewer, everything for Super Administrador', async () => {
    await call('student1', 'POST', '/api/v1/biometric-update-cases', facial('student1'));
    await call('student2', 'POST', '/api/v1/biometric-update-cases', facial('student2'));
    expect((await call('student1', 'GET', '/api/v1/biometric-update-cases')).json().map((c: any) => c.personId)).toEqual([PERSON('student1')]);
    expect((await call('admin1', 'GET', '/api/v1/biometric-update-cases')).json().map((c: any) => c.personId)).toEqual([PERSON('student1')]);
    expect((await call('super', 'GET', '/api/v1/biometric-update-cases?limit=1')).headers['x-total-count']).toBe('2');
    expect((await call('super', 'GET', '/api/v1/biometric-update-cases?status=Approved')).json()).toEqual([]);
  });

  it('someone else case looks missing; a reviewer of another school cannot review it', async () => {
    const id = (await call('student1', 'POST', '/api/v1/biometric-update-cases', facial('student1'))).json().caseId;
    expect((await call('student2', 'GET', `/api/v1/biometric-update-cases/${id}`)).statusCode).toBe(404);
    expect((await call('student1', 'GET', '/api/v1/biometric-update-cases/not-a-uuid')).statusCode).toBe(404);
    expect((await call('student1', 'GET', `/api/v1/biometric-update-cases/${id}`)).json().caseId).toBe(id);
    expect((await call('admin2', 'PATCH', `/api/v1/biometric-update-cases/${id}/review`, { updateStatus: 'Approved' })).statusCode).toBe(404);
    expect((await call('admin1', 'PATCH', `/api/v1/biometric-update-cases/${id}/review`, { updateStatus: 'Maybe' })).statusCode).toBe(400);
    const reviewed = await call('admin1', 'PATCH', `/api/v1/biometric-update-cases/${id}/review`, { updateStatus: 'Approved', resolutionNotes: 'ok' });
    expect(reviewed.statusCode).toBe(200);
    expect(reviewed.json()).toMatchObject({ updateStatus: 'Approved', reviewedBy: USERS.admin1.id, resolutionNotes: 'ok' });
  });

  it('nobody reviews their own request (separation of duties)', async () => {
    const id = (await call('admin1', 'POST', '/api/v1/biometric-update-cases', facial('admin1'))).json().caseId;
    const res = await call('admin1', 'PATCH', `/api/v1/biometric-update-cases/${id}/review`, { updateStatus: 'Approved' });
    expect(res.statusCode).toBe(403);
    expect(res.json().message).toBe('You cannot review your own request');
    expect((await call('admin1', 'PATCH', '/api/v1/biometric-update-cases/nope/review', { updateStatus: 'Approved' })).statusCode).toBe(404);
  });

  it('the owner edits and withdraws a case; strangers cannot', async () => {
    const id = (await call('student1', 'POST', '/api/v1/biometric-update-cases', facial('student1'))).json().caseId;
    expect((await call('student2', 'PUT', `/api/v1/biometric-update-cases/${id}`, { reason: 'x' })).statusCode).toBe(404);
    expect((await call('student1', 'PUT', `/api/v1/biometric-update-cases/${id}`, { reason: '' })).statusCode).toBe(400);
    expect((await call('student1', 'PUT', '/api/v1/biometric-update-cases/nope', { reason: 'x' })).statusCode).toBe(404);
    expect((await call('student1', 'PUT', `/api/v1/biometric-update-cases/${id}`, { reason: 'Nueva foto' })).json().reason).toBe('Nueva foto');
    expect((await call('student2', 'DELETE', `/api/v1/biometric-update-cases/${id}`)).statusCode).toBe(404);
    expect((await call('student1', 'DELETE', '/api/v1/biometric-update-cases/nope')).statusCode).toBe(404);
    expect((await call('student1', 'DELETE', `/api/v1/biometric-update-cases/${id}`)).statusCode).toBe(204);
    expect((await call('student1', 'GET', `/api/v1/biometric-update-cases/${id}`)).statusCode).toBe(404);
  });

  it('a person lists their own cases only', async () => {
    await call('student1', 'POST', '/api/v1/biometric-update-cases', facial('student1'));
    expect((await call('student2', 'GET', `/api/v1/persons/${PERSON('student1')}/biometric-cases`)).statusCode).toBe(403);
    expect((await call('student1', 'GET', `/api/v1/persons/${PERSON('student1')}/biometric-cases?limit=5`)).headers['x-total-count']).toBe('1');
    expect((await call('student1', 'GET', '/api/v1/persons/nope/biometric-cases')).json()).toEqual([]);
  });

  it('fails closed with 503 when roles, permissions or the school cannot be resolved', async () => {
    mockGetJson.mockRejectedValueOnce(new Error('authorization down'));
    expect((await call('student1', 'GET', '/api/v1/biometric-update-cases')).statusCode).toBe(503);
    clearCaseScopeCache();
    const real = mockGetJson.getMockImplementation()!;
    mockGetJson.mockImplementation(async (url: string, token: string) => {
      if (url.includes('/auth/evaluate')) throw new Error('down');
      return real(url, token);
    });
    expect((await call('student1', 'GET', '/api/v1/biometric-update-cases')).statusCode).toBe(503);
    clearCaseScopeCache();
    mockGetJson.mockImplementation(async (url: string, token: string) => {
      if (url.includes('/academic-actors')) throw new Error('down');
      return real(url, token);
    });
    expect((await call('admin1', 'GET', '/api/v1/biometric-update-cases')).statusCode).toBe(503);
    expect((await call('admin1', 'GET', '/api/v1/configurations/academic')).statusCode).toBe(503);
  });
});
