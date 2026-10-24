/**
 * HTTP tests for every academic route, on in-memory repositories.
 * Focus: school isolation (an Administrador only sees and changes its own school;
 * Super Administrador sees all), payload validation, 404s and paging.
 */
import Fastify, { type FastifyInstance } from 'fastify';
import { getJson } from '../infrastructure/http/authGuard';
import { registerAcademicRoutes } from '../infrastructure/http/routes';
import { clearCallerSchoolCache } from '../infrastructure/http/callerSchool';
import { memoryRepositories, type MemoryRepositories } from './support/memoryRepositories';

jest.mock('../infrastructure/http/authGuard', () => ({ getJson: jest.fn() }));
const mockGetJson = getJson as jest.MockedFunction<typeof getJson>;

const P_ADMIN1 = '11111111-1111-4111-8111-111111111111';
const P_ADMIN2 = '22222222-2222-4222-8222-222222222222';
const P_STUDENT1 = '33333333-3333-4333-8333-333333333333';
const P_STUDENT2 = '44444444-4444-4444-8444-444444444444';

const USERS: Record<string, { roles: string[]; personId?: string }> = {
  super: { roles: ['Super Administrador'] },
  admin1: { roles: ['Administrador'], personId: P_ADMIN1 },
  admin2: { roles: ['Administrador'], personId: P_ADMIN2 },
  orphan: { roles: ['Aprendiz'] },
};

let app: FastifyInstance;
let repos: MemoryRepositories;
let ids: Record<string, number>;

async function seed() {
  const s1 = await repos.schools.create({ code: 'S1', name: 'Sede 1', cityId: 1, status: true } as any);
  const s2 = await repos.schools.create({ code: 'S2', name: 'Sede 2', cityId: 1, status: true } as any);
  const p1 = await repos.programs.create({ schoolId: s1.schoolId, code: 'P1', name: 'Programa 1', status: true } as any);
  const p2 = await repos.programs.create({ schoolId: s2.schoolId, code: 'P2', name: 'Programa 2', status: true } as any);
  const per1 = await repos.periods.create({ schoolId: s1.schoolId, name: '2026-I', startsOn: '2026-01-01', endsOn: '2026-06-30', isActive: true } as any);
  const per2 = await repos.periods.create({ schoolId: s2.schoolId, name: '2026-I', startsOn: '2026-01-01', endsOn: '2026-06-30', isActive: true } as any);
  const c1 = await repos.cohorts.create({ programId: p1.programId, academicPeriodId: per1.academicPeriodId, code: 'C1', status: true } as any);
  const c2 = await repos.cohorts.create({ programId: p2.programId, academicPeriodId: per2.academicPeriodId, code: 'C2', status: true } as any);
  const co1 = await repos.courses.create({ programId: p1.programId, code: 'MAT', name: 'Matemáticas', creditHours: 3, status: true } as any);
  const co2 = await repos.courses.create({ programId: p2.programId, code: 'FIS', name: 'Física', creditHours: 3, status: true } as any);
  await repos.actors.create({ personId: P_ADMIN1, actorTypeId: 3, schoolId: s1.schoolId, actorCode: 'A1', startedOn: '2026-01-01', status: true } as any);
  await repos.actors.create({ personId: P_ADMIN2, actorTypeId: 3, schoolId: s2.schoolId, actorCode: 'A2', startedOn: '2026-01-01', status: true } as any);
  const st1 = await repos.actors.create({ personId: P_STUDENT1, actorTypeId: 1, schoolId: s1.schoolId, actorCode: 'E1', startedOn: '2026-01-01', status: true } as any);
  const st2 = await repos.actors.create({ personId: P_STUDENT2, actorTypeId: 1, schoolId: s2.schoolId, actorCode: 'E2', startedOn: '2026-01-01', status: true } as any);
  const e1 = await repos.enrollments.create({ academicActorId: st1.academicActorId, cohortId: c1.cohortId, enrolledOn: '2026-01-10', enrollmentStatus: 'Active' } as any);
  const e2 = await repos.enrollments.create({ academicActorId: st2.academicActorId, cohortId: c2.cohortId, enrolledOn: '2026-01-10', enrollmentStatus: 'Active' } as any);
  return {
    s1: s1.schoolId, s2: s2.schoolId, p1: p1.programId, p2: p2.programId,
    per1: per1.academicPeriodId, per2: per2.academicPeriodId, c1: c1.cohortId, c2: c2.cohortId,
    co1: co1.courseId, co2: co2.courseId, st1: st1.academicActorId, st2: st2.academicActorId,
    e1: e1.enrollmentId, e2: e2.enrollmentId,
  } as Record<string, number>;
}

beforeEach(async () => {
  clearCallerSchoolCache();
  mockGetJson.mockReset();
  mockGetJson.mockImplementation(async (url: string) => {
    const roles = url.match(/\/users\/([^/]+)\/roles$/);
    if (roles) return { status: 200, body: (USERS[decodeURIComponent(roles[1])]?.roles ?? []).map((roleName) => ({ roleName })) };
    const user = url.match(/\/users\/([^/]+)$/);
    const found = user ? USERS[decodeURIComponent(user[1])] : undefined;
    return found ? { status: 200, body: { personId: found.personId ?? null } } : { status: 404, body: null };
  });
  repos = memoryRepositories();
  ids = await seed();
  app = Fastify();
  // Stands in for the auth guard: it sets who is calling.
  app.addHook('onRequest', async (req) => {
    const who = req.headers['x-test-user'];
    if (typeof who === 'string') {
      (req as any).userId = who;
      (req as any).authToken = `token-${who}`;
    }
  });
  await registerAcademicRoutes(app, repos);
});

afterEach(async () => {
  await app.close();
});

function call(user: string | null, method: string, url: string, payload?: unknown) {
  return app.inject({ method: method as any, url, payload: payload as any, headers: user ? { 'x-test-user': user } : {} });
}

describe('caller resolution', () => {
  it('refuses a request without an authenticated user', async () => {
    const res = await call(null, 'GET', '/api/v1/schools');
    expect(res.statusCode).toBe(403);
    expect(res.json().message).toBe('No authenticated user');
  });

  it('answers 503 when the roles cannot be verified', async () => {
    mockGetJson.mockRejectedValueOnce(new Error('authorization down'));
    const res = await call('admin1', 'GET', '/api/v1/schools');
    expect(res.statusCode).toBe(503);
    expect(res.json().error).toBe('ServiceUnavailable');
  });

  it('answers 503 when the user person cannot be resolved', async () => {
    mockGetJson
      .mockResolvedValueOnce({ status: 200, body: [{ roleName: 'Administrador' }] })
      .mockRejectedValueOnce(new Error('identity down'));
    expect((await call('admin1', 'GET', '/api/v1/schools')).statusCode).toBe(503);
  });

  it('a caller without a school owns nothing', async () => {
    const res = await call('orphan', 'GET', '/api/v1/schools');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
    expect((await call('orphan', 'GET', '/api/v1/programs')).json()).toEqual([]);
  });
});

describe('schools', () => {
  it('only Super Administrador creates a school; the payload is validated first', async () => {
    expect((await call('super', 'POST', '/api/v1/schools', { name: 'Sin código' })).statusCode).toBe(400);
    const denied = await call('admin1', 'POST', '/api/v1/schools', { code: 'S9', name: 'Nueva' });
    expect(denied.statusCode).toBe(403);
    expect(denied.json().message).toMatch(/Super Administrador/);
    const created = await call('super', 'POST', '/api/v1/schools', { code: 'S9', name: 'Nueva' });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ code: 'S9', name: 'Nueva', cityId: 1, status: true });
  });

  it('Super Administrador lists every school (with paging); an Administrador only its own', async () => {
    expect((await call('super', 'GET', '/api/v1/schools')).json()).toHaveLength(2);
    const paged = await call('super', 'GET', '/api/v1/schools?limit=1&offset=1');
    expect(paged.headers['x-total-count']).toBe('2');
    expect(paged.json().map((s: any) => s.code)).toEqual(['S2']);
    expect((await call('admin1', 'GET', '/api/v1/schools')).json().map((s: any) => s.code)).toEqual(['S1']);
  });

  it('an Administrador cannot read another school', async () => {
    expect((await call('admin1', 'GET', `/api/v1/schools/${ids.s1}`)).statusCode).toBe(200);
    expect((await call('admin1', 'GET', `/api/v1/schools/${ids.s2}`)).statusCode).toBe(404);
    expect((await call('admin1', 'GET', '/api/v1/schools/abc')).statusCode).toBe(404);
    expect((await call('super', 'GET', `/api/v1/schools/${ids.s2}`)).statusCode).toBe(200);
  });

  it('an Administrador edits name and contact of its own school, nothing else', async () => {
    const ok = await call('admin1', 'PUT', `/api/v1/schools/${ids.s1}`, { name: 'Sede Uno', phone: '3001234567' });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toMatchObject({ name: 'Sede Uno', phone: '3001234567', code: 'S1' });
    const code = await call('admin1', 'PUT', `/api/v1/schools/${ids.s1}`, { code: 'X1' });
    expect(code.statusCode).toBe(403);
    expect(code.json().message).toMatch(/school code/);
    expect((await call('admin1', 'PUT', `/api/v1/schools/${ids.s2}`, { name: 'Ajena' })).statusCode).toBe(404);
    expect((await call('admin1', 'PUT', `/api/v1/schools/${ids.s1}`, { email: 'no-es-correo' })).statusCode).toBe(400);
    expect((await call('admin1', 'PUT', '/api/v1/schools/0', { name: 'x' })).statusCode).toBe(404);
  });

  it('Super Administrador edits any field of any school', async () => {
    const res = await call('super', 'PUT', `/api/v1/schools/${ids.s2}`, { code: 'S2B', status: false });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ code: 'S2B', status: false });
    expect((await call('super', 'PUT', '/api/v1/schools/999', { name: 'x' })).statusCode).toBe(404);
  });

  it('only Super Administrador changes the status', async () => {
    expect((await call('super', 'PATCH', `/api/v1/schools/${ids.s1}/status`, { status: 'no' })).statusCode).toBe(400);
    expect((await call('admin1', 'PATCH', `/api/v1/schools/${ids.s1}/status`, { status: false })).statusCode).toBe(403);
    const res = await call('super', 'PATCH', `/api/v1/schools/${ids.s1}/status`, { status: false });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe(false);
    expect((await call('super', 'PATCH', '/api/v1/schools/999/status', { status: true })).statusCode).toBe(404);
  });

  it('only Super Administrador deletes a school', async () => {
    expect((await call('admin1', 'DELETE', `/api/v1/schools/${ids.s1}`)).statusCode).toBe(403);
    expect((await call('super', 'DELETE', `/api/v1/schools/${ids.s2}`)).statusCode).toBe(204);
    expect((await call('super', 'GET', `/api/v1/schools/${ids.s2}`)).statusCode).toBe(404);
    expect((await call('super', 'DELETE', `/api/v1/schools/${ids.s2}`)).statusCode).toBe(404);
  });
});

describe('programs', () => {
  it('creates programs only in the caller school', async () => {
    const own = await call('admin1', 'POST', `/api/v1/schools/${ids.s1}/programs`, { code: 'P9', name: 'Nuevo' });
    expect(own.statusCode).toBe(201);
    expect(own.json()).toMatchObject({ schoolId: ids.s1, code: 'P9' });
    expect((await call('admin1', 'POST', `/api/v1/schools/${ids.s2}/programs`, { code: 'P9', name: 'Ajeno' })).statusCode).toBe(403);
    expect((await call('admin1', 'POST', '/api/v1/schools/999/programs', { code: 'P9', name: 'x' })).json().error).toBe('SchoolNotFound');
    expect((await call('admin1', 'POST', '/api/v1/schools/abc/programs', { code: 'P9', name: 'x' })).statusCode).toBe(404);
    expect((await call('admin1', 'POST', `/api/v1/schools/${ids.s1}/programs`, { name: 'Sin código' })).statusCode).toBe(400);
    expect((await call('admin1', 'POST', '/api/v1/programs', { code: 'P8', name: 'x' })).statusCode).toBe(400);
    expect((await call('super', 'POST', '/api/v1/programs', { schoolId: ids.s2, code: 'P8', name: 'x' })).statusCode).toBe(201);
  });

  it('lists and reads only the caller school programs', async () => {
    expect((await call('admin1', 'GET', '/api/v1/programs')).json().map((p: any) => p.code)).toEqual(['P1']);
    expect((await call('super', 'GET', '/api/v1/programs')).json()).toHaveLength(2);
    expect((await call('super', 'GET', '/api/v1/programs?limit=5')).headers['x-total-count']).toBe('2');
    expect((await call('admin1', 'GET', `/api/v1/programs/${ids.p2}`)).statusCode).toBe(404);
    expect((await call('admin1', 'GET', `/api/v1/programs/${ids.p1}`)).json().code).toBe('P1');
    expect((await call('admin1', 'GET', `/api/v1/schools/${ids.s2}/programs`)).statusCode).toBe(403);
    expect((await call('admin1', 'GET', `/api/v1/schools/${ids.s1}/programs?limit=1`)).headers['x-total-count']).toBe('1');
    expect((await call('admin1', 'GET', '/api/v1/schools/abc/programs')).json()).toEqual([]);
  });

  it('cannot move a program to another school or touch a foreign one', async () => {
    expect((await call('admin1', 'PUT', `/api/v1/programs/${ids.p1}`, { schoolId: ids.s2 })).statusCode).toBe(403);
    expect((await call('admin1', 'PUT', `/api/v1/programs/${ids.p2}`, { name: 'x' })).statusCode).toBe(404);
    expect((await call('admin1', 'PUT', `/api/v1/programs/${ids.p1}`, { code: '' })).statusCode).toBe(400);
    const renamed = await call('admin1', 'PUT', `/api/v1/programs/${ids.p1}`, { name: 'Renombrado' });
    expect(renamed.json().name).toBe('Renombrado');
    expect((await call('admin1', 'DELETE', `/api/v1/programs/${ids.p2}`)).statusCode).toBe(404);
    expect((await call('admin1', 'DELETE', `/api/v1/programs/${ids.p1}`)).statusCode).toBe(204);
    expect((await call('admin1', 'DELETE', `/api/v1/programs/${ids.p1}`)).statusCode).toBe(404);
  });
});

describe('academic periods (canonical route and /periods alias)', () => {
  it.each(['/api/v1/academic-periods', '/api/v1/periods'])('%s: create, list, read, edit and delete inside the school', async (base) => {
    const body = { schoolId: ids.s1, name: '2026-II', startsOn: '2026-07-01', endsOn: '2026-12-15' };
    expect((await call('admin1', 'POST', base, { ...body, schoolId: undefined })).statusCode).toBe(400);
    expect((await call('admin1', 'POST', base, { schoolId: ids.s1, name: '' })).statusCode).toBe(400);
    expect((await call('admin1', 'POST', base, { ...body, schoolId: ids.s2 })).statusCode).toBe(403);
    const created = await call('admin1', 'POST', base, body);
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ isActive: false, schoolId: ids.s1 });
    const id = created.json().academicPeriodId;

    expect((await call('admin1', 'GET', base)).json().every((p: any) => p.schoolId === ids.s1)).toBe(true);
    expect((await call('super', 'GET', `${base}?offset=0`)).headers['x-total-count']).toBe('3');
    expect((await call('admin2', 'GET', `${base}/${id}`)).statusCode).toBe(404);
    expect((await call('admin1', 'GET', `${base}/${id}`)).statusCode).toBe(200);
    expect((await call('admin1', 'PUT', `${base}/${id}`, { schoolId: ids.s2 })).statusCode).toBe(403);
    expect((await call('admin2', 'PUT', `${base}/${id}`, { name: 'x' })).statusCode).toBe(404);
    expect((await call('admin1', 'PUT', `${base}/${id}`, { startsOn: '' })).statusCode).toBe(400);
    expect((await call('admin1', 'PUT', `${base}/${id}`, { isActive: true })).json().isActive).toBe(true);
    expect((await call('admin2', 'DELETE', `${base}/${id}`)).statusCode).toBe(404);
    expect((await call('admin1', 'DELETE', `${base}/${id}`)).statusCode).toBe(204);
    expect((await call('admin1', 'GET', `${base}/${id}`)).statusCode).toBe(404);
  });

  it('nested /schools/:id/periods respects the school', async () => {
    const body = { name: '2027-I', startsOn: '2027-01-01', endsOn: '2027-06-30' };
    expect((await call('admin1', 'POST', `/api/v1/schools/${ids.s1}/periods`, body)).statusCode).toBe(201);
    expect((await call('admin1', 'POST', '/api/v1/schools/abc/periods', body)).statusCode).toBe(404);
    expect((await call('admin1', 'GET', `/api/v1/schools/${ids.s2}/periods`)).statusCode).toBe(403);
    expect((await call('admin1', 'GET', `/api/v1/schools/${ids.s1}/periods`)).json()).toHaveLength(2);
    expect((await call('admin1', 'GET', '/api/v1/schools/abc/periods')).json()).toEqual([]);
  });
});

describe('cohorts', () => {
  it('creates a cohort only for a program of the caller school', async () => {
    expect((await call('admin1', 'POST', '/api/v1/cohorts', { programId: ids.p1 })).statusCode).toBe(400);
    const foreign = await call('admin1', 'POST', '/api/v1/cohorts', { programId: ids.p2, academicPeriodId: ids.per2, code: 'X' });
    expect(foreign.statusCode).toBe(403);
    const own = await call('admin1', 'POST', '/api/v1/cohorts', { programId: ids.p1, academicPeriodId: ids.per1, code: 'C9' });
    expect(own.statusCode).toBe(201);
    expect(own.json()).toMatchObject({ code: 'C9', status: true });
  });

  it('lists the cohorts of the caller school across its programs, with paging', async () => {
    await call('admin1', 'POST', '/api/v1/cohorts', { programId: ids.p1, academicPeriodId: ids.per1, code: 'C9' });
    expect((await call('admin1', 'GET', '/api/v1/cohorts')).json().map((c: any) => c.code)).toEqual(['C1', 'C9']);
    const paged = await call('admin1', 'GET', '/api/v1/cohorts?limit=1&offset=1');
    expect(paged.headers['x-total-count']).toBe('2');
    expect(paged.json().map((c: any) => c.code)).toEqual(['C9']);
    expect((await call('super', 'GET', '/api/v1/cohorts')).json()).toHaveLength(3);
    expect((await call('admin1', 'GET', `/api/v1/programs/${ids.p2}/cohorts`)).statusCode).toBe(403);
    expect((await call('admin1', 'GET', `/api/v1/programs/${ids.p1}/cohorts?limit=10`)).headers['x-total-count']).toBe('2');
    expect((await call('admin1', 'GET', '/api/v1/programs/abc/cohorts')).json()).toEqual([]);
  });

  it('reads, edits and deletes only own cohorts and never moves them to another school', async () => {
    expect((await call('admin1', 'GET', `/api/v1/cohorts/${ids.c2}`)).statusCode).toBe(404);
    expect((await call('admin1', 'GET', `/api/v1/cohorts/${ids.c1}`)).json().code).toBe('C1');
    expect((await call('admin1', 'PUT', `/api/v1/cohorts/${ids.c1}`, { programId: ids.p2 })).statusCode).toBe(403);
    expect((await call('admin1', 'PUT', `/api/v1/cohorts/${ids.c2}`, { code: 'X' })).statusCode).toBe(404);
    expect((await call('admin1', 'PUT', `/api/v1/cohorts/${ids.c1}`, { code: '' })).statusCode).toBe(400);
    expect((await call('admin1', 'PUT', `/api/v1/cohorts/${ids.c1}`, { programId: ids.p1, code: 'C1B' })).json().code).toBe('C1B');
    expect((await call('admin1', 'DELETE', `/api/v1/cohorts/${ids.c2}`)).statusCode).toBe(404);
    expect((await call('admin1', 'DELETE', `/api/v1/cohorts/${ids.c1}`)).statusCode).toBe(204);
    expect((await call('admin1', 'DELETE', '/api/v1/cohorts/999')).statusCode).toBe(404);
  });
});

describe('courses', () => {
  it('creates a course only in a program of the caller school', async () => {
    expect((await call('admin1', 'POST', '/api/v1/courses', { code: 'X', name: 'x' })).statusCode).toBe(400);
    expect((await call('admin1', 'POST', '/api/v1/programs/abc/courses', { code: 'X', name: 'x' })).statusCode).toBe(400);
    expect((await call('admin1', 'POST', `/api/v1/programs/${ids.p1}/courses`, { code: 'X' })).statusCode).toBe(400);
    expect((await call('admin1', 'POST', `/api/v1/programs/${ids.p2}/courses`, { code: 'X', name: 'x' })).statusCode).toBe(403);
    const created = await call('admin1', 'POST', '/api/v1/courses', { programId: ids.p1, code: 'QUI', name: 'Química' });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ programId: ids.p1, creditHours: 3 });
  });

  it('lists, reads and edits only own courses', async () => {
    expect((await call('admin1', 'GET', '/api/v1/courses')).json().map((c: any) => c.code)).toEqual(['MAT']);
    expect((await call('super', 'GET', '/api/v1/courses?limit=1')).headers['x-total-count']).toBe('2');
    expect((await call('admin1', 'GET', '/api/v1/courses?offset=0')).headers['x-total-count']).toBe('1');
    expect((await call('admin1', 'GET', `/api/v1/courses/${ids.co2}`)).statusCode).toBe(404);
    expect((await call('admin1', 'GET', `/api/v1/courses/${ids.co1}`)).json().code).toBe('MAT');
    expect((await call('admin1', 'PUT', `/api/v1/courses/${ids.co1}`, { programId: ids.p2 })).statusCode).toBe(403);
    expect((await call('admin1', 'PUT', `/api/v1/courses/${ids.co2}`, { name: 'x' })).statusCode).toBe(404);
    expect((await call('admin1', 'PUT', `/api/v1/courses/${ids.co1}`, { creditHours: -1 })).statusCode).toBe(400);
    expect((await call('admin1', 'PUT', `/api/v1/courses/${ids.co1}`, { programId: ids.p1, creditHours: 4 })).json().creditHours).toBe(4);
    expect((await call('admin1', 'GET', `/api/v1/programs/${ids.p2}/courses`)).statusCode).toBe(403);
    expect((await call('admin1', 'GET', `/api/v1/programs/${ids.p1}/courses?limit=1`)).headers['x-total-count']).toBe('1');
    expect((await call('admin1', 'GET', '/api/v1/programs/abc/courses')).json()).toEqual([]);
  });

  it('only Super Administrador deletes a course', async () => {
    const denied = await call('admin1', 'DELETE', `/api/v1/courses/${ids.co1}`);
    expect(denied.statusCode).toBe(403);
    expect(denied.json().message).toMatch(/Super Administrador/);
    expect((await call('super', 'DELETE', `/api/v1/courses/${ids.co1}`)).statusCode).toBe(204);
    expect((await call('super', 'DELETE', `/api/v1/courses/${ids.co1}`)).statusCode).toBe(404);
  });
});

describe('actor types', () => {
  it('creates, lists, edits and deletes', async () => {
    expect((await call('super', 'POST', '/api/v1/actor-types', { code: '' })).statusCode).toBe(400);
    const created = await call('super', 'POST', '/api/v1/actor-types', { code: 'TUTOR', name: 'Tutor' });
    expect(created.statusCode).toBe(201);
    const id = created.json().actorTypeId;
    expect((await call('super', 'GET', '/api/v1/actor-types')).json()).toHaveLength(1);
    expect((await call('super', 'GET', '/api/v1/actor-types?limit=1')).headers['x-total-count']).toBe('1');
    expect((await call('super', 'GET', `/api/v1/actor-types/${id}`)).json().code).toBe('TUTOR');
    expect((await call('super', 'GET', '/api/v1/actor-types/999')).statusCode).toBe(404);
    expect((await call('super', 'PUT', `/api/v1/actor-types/${id}`, { name: 'Tutora' })).json().name).toBe('Tutora');
    expect((await call('super', 'PUT', `/api/v1/actor-types/${id}`, { code: '' })).statusCode).toBe(400);
    expect((await call('super', 'PUT', '/api/v1/actor-types/abc', { name: 'x' })).statusCode).toBe(404);
    expect((await call('super', 'PUT', '/api/v1/actor-types/999', { name: 'x' })).statusCode).toBe(404);
    expect((await call('super', 'DELETE', `/api/v1/actor-types/${id}`)).statusCode).toBe(204);
    expect((await call('super', 'DELETE', `/api/v1/actor-types/${id}`)).statusCode).toBe(404);
  });

  it('re-creating a deleted code brings the same type back instead of a duplicate', async () => {
    const first = (await call('super', 'POST', '/api/v1/actor-types', { code: 'TUTOR', name: 'Tutor' })).json();
    await call('super', 'DELETE', `/api/v1/actor-types/${first.actorTypeId}`);
    const again = await call('super', 'POST', '/api/v1/actor-types', { code: 'TUTOR', name: 'Tutor nuevo' });
    expect(again.statusCode).toBe(201);
    expect(again.json()).toMatchObject({ actorTypeId: first.actorTypeId, name: 'Tutor nuevo' });
  });
});

describe('academic actors', () => {
  const actor = (schoolId: number) => ({ personId: '55555555-5555-4555-8555-555555555555', schoolId, actorCode: 'NEW' });

  it('creates actors only in the caller school, with a valid person UUID', async () => {
    expect((await call('admin1', 'POST', '/api/v1/academic-actors', { ...actor(ids.s1), personId: 'not-a-uuid' })).statusCode).toBe(400);
    expect((await call('admin1', 'POST', '/api/v1/academic-actors', actor(ids.s2))).statusCode).toBe(403);
    const created = await call('admin1', 'POST', '/api/v1/academic-actors', actor(ids.s1));
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ actorTypeId: 1, status: true, schoolId: ids.s1 });
  });

  it('?personId= answers only inside the caller school', async () => {
    expect((await call('admin1', 'GET', `/api/v1/academic-actors?personId=${P_STUDENT2}`)).json()).toEqual([]);
    expect((await call('super', 'GET', `/api/v1/academic-actors?personId=${P_STUDENT2}`)).json()).toHaveLength(1);
    const paged = await call('admin1', 'GET', `/api/v1/academic-actors?personId=${P_STUDENT1}&limit=5`);
    expect(paged.headers['x-total-count']).toBe('1');
  });

  it('lists the caller school actors; Super Administrador sees all', async () => {
    expect((await call('admin1', 'GET', '/api/v1/academic-actors')).json().every((a: any) => a.schoolId === ids.s1)).toBe(true);
    expect((await call('super', 'GET', '/api/v1/academic-actors?limit=2')).headers['x-total-count']).toBe('4');
    expect((await call('admin1', 'GET', `/api/v1/schools/${ids.s2}/actors`)).statusCode).toBe(403);
    expect((await call('admin1', 'GET', `/api/v1/schools/${ids.s1}/actors?limit=1`)).headers['x-total-count']).toBe('2');
    expect((await call('admin1', 'GET', '/api/v1/schools/abc/actors')).json()).toEqual([]);
  });

  it('reads, edits, changes status and deletes only own actors', async () => {
    expect((await call('admin1', 'GET', `/api/v1/academic-actors/${ids.st2}`)).statusCode).toBe(404);
    expect((await call('admin1', 'GET', `/api/v1/academic-actors/${ids.st1}`)).json().actorCode).toBe('E1');
    expect((await call('admin1', 'PUT', `/api/v1/academic-actors/${ids.st1}`, { schoolId: ids.s2 })).statusCode).toBe(403);
    expect((await call('admin1', 'PUT', `/api/v1/academic-actors/${ids.st2}`, { actorCode: 'x' })).statusCode).toBe(404);
    expect((await call('admin1', 'PUT', `/api/v1/academic-actors/${ids.st1}`, { personId: 'x' })).statusCode).toBe(400);
    expect((await call('admin1', 'PUT', `/api/v1/academic-actors/${ids.st1}`, { actorCode: 'E1B' })).json().actorCode).toBe('E1B');
    expect((await call('admin1', 'PATCH', `/api/v1/academic-actors/${ids.st1}/status`, {})).statusCode).toBe(400);
    expect((await call('admin1', 'PATCH', `/api/v1/academic-actors/${ids.st2}/status`, { status: false })).statusCode).toBe(404);
    expect((await call('admin1', 'PATCH', `/api/v1/academic-actors/${ids.st1}/status`, { status: false })).json().status).toBe(false);
    expect((await call('admin1', 'DELETE', `/api/v1/academic-actors/${ids.st2}`)).statusCode).toBe(404);
    expect((await call('admin1', 'DELETE', `/api/v1/academic-actors/${ids.st1}`)).statusCode).toBe(204);
    expect((await call('admin1', 'DELETE', `/api/v1/academic-actors/${ids.st1}`)).statusCode).toBe(404);
  });
});

describe('enrollments', () => {
  it('enrolls only an own student into an own cohort', async () => {
    expect((await call('admin1', 'POST', '/api/v1/enrollments', { cohortId: ids.c1 })).statusCode).toBe(400);
    expect((await call('admin1', 'POST', '/api/v1/enrollments', { academicActorId: ids.st2, cohortId: ids.c1 })).statusCode).toBe(403);
    expect((await call('admin1', 'POST', '/api/v1/enrollments', { academicActorId: ids.st1, cohortId: ids.c2 })).statusCode).toBe(403);
    const created = await call('super', 'POST', '/api/v1/enrollments', { academicActorId: ids.st2, cohortId: ids.c1 });
    expect(created.statusCode).toBe(201);
    expect(created.json().enrollmentStatus).toBe('Active');
  });

  it('re-enrolling a removed enrollment restores the same row', async () => {
    expect((await call('admin1', 'DELETE', `/api/v1/enrollments/${ids.e1}`)).statusCode).toBe(204);
    const again = await call('admin1', 'POST', '/api/v1/enrollments', { academicActorId: ids.st1, cohortId: ids.c1 });
    expect(again.statusCode).toBe(201);
    expect(again.json().enrollmentId).toBe(ids.e1);
  });

  it('lists only enrollments of the caller school, with paging', async () => {
    expect((await call('admin1', 'GET', '/api/v1/enrollments')).json().map((e: any) => e.enrollmentId)).toEqual([ids.e1]);
    expect((await call('admin1', 'GET', '/api/v1/enrollments?limit=1')).headers['x-total-count']).toBe('1');
    expect((await call('super', 'GET', '/api/v1/enrollments?limit=1')).headers['x-total-count']).toBe('2');
    expect((await call('admin1', 'GET', `/api/v1/cohorts/${ids.c2}/enrollments`)).statusCode).toBe(403);
    expect((await call('admin1', 'GET', `/api/v1/cohorts/${ids.c1}/enrollments?limit=1`)).headers['x-total-count']).toBe('1');
    expect((await call('admin1', 'GET', '/api/v1/cohorts/abc/enrollments')).json()).toEqual([]);
    expect((await call('admin1', 'GET', `/api/v1/academic-actors/${ids.st2}/enrollments`)).statusCode).toBe(403);
    expect((await call('admin1', 'GET', `/api/v1/academic-actors/${ids.st1}/enrollments?limit=1`)).headers['x-total-count']).toBe('1');
    expect((await call('admin1', 'GET', '/api/v1/academic-actors/abc/enrollments')).json()).toEqual([]);
  });

  it('reads, edits, changes status and deletes only own enrollments', async () => {
    expect((await call('admin1', 'GET', `/api/v1/enrollments/${ids.e2}`)).statusCode).toBe(404);
    expect((await call('admin1', 'GET', `/api/v1/enrollments/${ids.e1}`)).json().cohortId).toBe(ids.c1);
    expect((await call('admin1', 'PATCH', `/api/v1/enrollments/${ids.e1}/status`, { enrollmentStatus: 'Paused' })).statusCode).toBe(400);
    expect((await call('admin1', 'PATCH', `/api/v1/enrollments/${ids.e2}/status`, { enrollmentStatus: 'Withdrawn' })).statusCode).toBe(404);
    expect((await call('admin1', 'PATCH', `/api/v1/enrollments/${ids.e1}/status`, { enrollmentStatus: 'Withdrawn' })).json().enrollmentStatus).toBe('Withdrawn');
    expect((await call('admin1', 'PUT', `/api/v1/enrollments/${ids.e1}`, { cohortId: ids.c2 })).statusCode).toBe(403);
    expect((await call('admin1', 'PUT', `/api/v1/enrollments/${ids.e1}`, { academicActorId: ids.st2 })).statusCode).toBe(403);
    expect((await call('admin1', 'PUT', `/api/v1/enrollments/${ids.e2}`, { enrolledOn: '2026-02-01' })).statusCode).toBe(404);
    expect((await call('admin1', 'PUT', `/api/v1/enrollments/${ids.e1}`, { enrolledOn: '' })).statusCode).toBe(400);
    expect((await call('admin1', 'PUT', `/api/v1/enrollments/${ids.e1}`, { enrolledOn: '2026-02-01', cohortId: ids.c1, academicActorId: ids.st1 })).json().enrolledOn).toBe('2026-02-01');
    expect((await call('admin1', 'DELETE', `/api/v1/enrollments/${ids.e2}`)).statusCode).toBe(404);
    expect((await call('admin1', 'DELETE', '/api/v1/enrollments/999')).statusCode).toBe(404);
  });
});
