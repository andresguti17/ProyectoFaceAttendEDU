import { resolveCallerSchool, clearCallerSchoolCache, ScopeError } from '../callerSchool';
import { getJson } from '../authGuard';

jest.mock('../authGuard', () => ({ getJson: jest.fn() }));

const mockGetJson = getJson as jest.MockedFunction<typeof getJson>;

function reqFor(userId: string, token = 't') {
  return { userId, authToken: token } as any;
}

describe('resolveCallerSchool', () => {
  beforeEach(() => {
    clearCallerSchoolCache();
    mockGetJson.mockReset();
  });

  it('returns isSuperAdmin:true without resolving a school for Super Administrador', async () => {
    mockGetJson.mockResolvedValueOnce({ status: 200, body: [{ roleName: 'Super Administrador' }] });

    const result = await resolveCallerSchool(reqFor('admin-1'));

    expect(result).toEqual({ isSuperAdmin: true, schoolId: null });
    // Only the roles lookup was needed — no identity/academic calls for a super admin.
    expect(mockGetJson).toHaveBeenCalledTimes(1);
  });

  it('resolves a school Administrador to their own school via their academic_actor', async () => {
    mockGetJson
      .mockResolvedValueOnce({ status: 200, body: [{ roleName: 'Administrador' }] })
      .mockResolvedValueOnce({ status: 200, body: { personId: 'p-1' } })
      .mockResolvedValueOnce({ status: 200, body: [{ schoolId: 100 }] });

    const result = await resolveCallerSchool(reqFor('admin-2'));

    expect(result).toEqual({ isSuperAdmin: false, schoolId: 100 });
  });

  it('fails secure (schoolId: null) for an Administrador without an academic_actor, never "see everything"', async () => {
    mockGetJson
      .mockResolvedValueOnce({ status: 200, body: [{ roleName: 'Administrador' }] })
      .mockResolvedValueOnce({ status: 200, body: { personId: 'p-2' } })
      .mockResolvedValueOnce({ status: 200, body: [] });

    const result = await resolveCallerSchool(reqFor('admin-3'));

    expect(result).toEqual({ isSuperAdmin: false, schoolId: null });
  });

  it('caches a positive result for subsequent calls within the TTL', async () => {
    mockGetJson.mockResolvedValueOnce({ status: 200, body: [{ roleName: 'Super Administrador' }] });

    await resolveCallerSchool(reqFor('admin-4'));
    await resolveCallerSchool(reqFor('admin-4'));

    expect(mockGetJson).toHaveBeenCalledTimes(1);
  });

  it('throws a 503 ScopeError when the roles lookup fails, instead of defaulting to unrestricted', async () => {
    mockGetJson.mockRejectedValueOnce(new Error('network error'));

    await expect(resolveCallerSchool(reqFor('admin-5'))).rejects.toMatchObject(
      new ScopeError(503, 'Cannot verify roles'),
    );
  });

  it('throws a 403 ScopeError when the request has no authenticated user', async () => {
    await expect(resolveCallerSchool({} as any)).rejects.toMatchObject(new ScopeError(403, 'No authenticated user'));
  });
});
