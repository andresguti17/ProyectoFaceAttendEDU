import { createCallerSchoolResolver, mayDeleteCourse, clearCallerSchoolCache, ScopeError } from '../callerSchool';
import { getJson } from '../authGuard';
import type { AcademicRepositories } from '../../persistence/postgres';

jest.mock('../authGuard', () => ({ getJson: jest.fn() }));

const mockGetJson = getJson as jest.MockedFunction<typeof getJson>;

function reqFor(userId: string, token = 't') {
  return { userId, authToken: token } as any;
}

function reposWithActors(actors: Array<{ schoolId: number; personId: string }>): AcademicRepositories {
  return {
    actors: {
      findByPerson: jest.fn(async (personId: string) => actors.filter((a) => a.personId === personId)),
    },
  } as unknown as AcademicRepositories;
}

describe('createCallerSchoolResolver (03-ms-academic)', () => {
  beforeEach(() => {
    clearCallerSchoolCache();
    mockGetJson.mockReset();
  });

  it('returns isSuperAdmin:true without touching the local actors repository', async () => {
    mockGetJson.mockResolvedValueOnce({ status: 200, body: [{ roleName: 'Super Administrador' }] });
    const repos = reposWithActors([]);
    const resolve = createCallerSchoolResolver(repos);

    const result = await resolve(reqFor('admin-1'));

    expect(result).toEqual({ isSuperAdmin: true, schoolId: null });
    expect(repos.actors.findByPerson).not.toHaveBeenCalled();
  });

  it('resolves a school Administrador to their own school via the local academic_actor repository', async () => {
    mockGetJson
      .mockResolvedValueOnce({ status: 200, body: [{ roleName: 'Administrador' }] })
      .mockResolvedValueOnce({ status: 200, body: { personId: 'p-1' } });
    const repos = reposWithActors([{ schoolId: 100, personId: 'p-1' }]);
    const resolve = createCallerSchoolResolver(repos);

    const result = await resolve(reqFor('admin-2'));

    expect(result).toEqual({ isSuperAdmin: false, schoolId: 100 });
  });

  it('fails secure (schoolId: null) for a caller without an academic_actor, never "see everything"', async () => {
    mockGetJson
      .mockResolvedValueOnce({ status: 200, body: [{ roleName: 'Instructor' }] })
      .mockResolvedValueOnce({ status: 200, body: { personId: 'p-2' } });
    const repos = reposWithActors([]);
    const resolve = createCallerSchoolResolver(repos);

    const result = await resolve(reqFor('teacher-1'));

    expect(result).toEqual({ isSuperAdmin: false, schoolId: null });
  });

  it('caches a positive result within the TTL, so a second call skips the HTTP round-trips', async () => {
    mockGetJson.mockResolvedValueOnce({ status: 200, body: [{ roleName: 'Super Administrador' }] });
    const repos = reposWithActors([]);
    const resolve = createCallerSchoolResolver(repos);

    await resolve(reqFor('admin-3'));
    await resolve(reqFor('admin-3'));

    expect(mockGetJson).toHaveBeenCalledTimes(1);
  });

  it('throws a 503 ScopeError when the roles lookup fails, instead of defaulting to unrestricted', async () => {
    mockGetJson.mockRejectedValueOnce(new Error('network error'));
    const resolve = createCallerSchoolResolver(reposWithActors([]));

    await expect(resolve(reqFor('admin-4'))).rejects.toMatchObject(new ScopeError(503, 'Cannot verify roles'));
  });

  it('throws a 403 ScopeError when the request has no authenticated user', async () => {
    const resolve = createCallerSchoolResolver(reposWithActors([]));
    await expect(resolve({} as any)).rejects.toMatchObject(new ScopeError(403, 'No authenticated user'));
  });
});

describe('mayDeleteCourse', () => {
  it('allows only the unrestricted caller', () => {
    expect(mayDeleteCourse({ isSuperAdmin: true, schoolId: null })).toBe(true);
    expect(mayDeleteCourse({ isSuperAdmin: false, schoolId: 1 })).toBe(false);
    expect(mayDeleteCourse({ isSuperAdmin: false, schoolId: null })).toBe(false);
  });
});
