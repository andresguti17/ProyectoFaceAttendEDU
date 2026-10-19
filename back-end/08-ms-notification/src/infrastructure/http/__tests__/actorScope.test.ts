import { resolveActorScope, actorAllowed, clearActorScopeCache, ScopeError } from '../actorScope';

const mockFetch = (responses: Record<string, any>) => {
  (global as any).fetch = jest.fn(async (url: string) => {
    for (const key of Object.keys(responses)) {
      if (url.includes(key)) {
        const r = responses[key];
        return { ok: r.status === 200, status: r.status, json: async () => r.body };
      }
    }
    throw new Error(`unexpected URL ${url}`);
  });
};

function reqWith(userId: string, token = 't') {
  return { userId, authToken: token } as any;
}

beforeEach(() => clearActorScopeCache());

describe('resolveActorScope', () => {
  it('Super Administrador gets an unrestricted (null) scope', async () => {
    mockFetch({ '/roles': { status: 200, body: [{ roleName: 'Super Administrador' }] } });
    expect(await resolveActorScope(reqWith('u1'))).toBeNull();
  });

  it('a school Administrador with no school of its own fails secure to only its own actors', async () => {
    mockFetch({
      '/roles': { status: 200, body: [{ roleName: 'Administrador' }] },
      '/users/u2': { status: 200, body: { personId: 'p-2' } },
      'personId=p-2': { status: 200, body: [{ academicActorId: 9, personId: 'p-2', schoolId: null }] },
      'limit=100&offset=0': { status: 200, body: [{ academicActorId: 9, personId: 'p-2', schoolId: null }] },
    });
    const scope = await resolveActorScope(reqWith('u2'));
    expect(scope).toEqual(new Set([9]));
  });

  it('retries once on a 503 then succeeds', async () => {
    let calls = 0;
    (global as any).fetch = jest.fn(async (url: string) => {
      if (url.includes('/roles')) {
        calls++;
        if (calls === 1) return { ok: false, status: 503, json: async () => null };
        return { ok: true, status: 200, json: async () => [{ roleName: 'Super Administrador' }] };
      }
      throw new Error('unexpected');
    });
    expect(await resolveActorScope(reqWith('u3'))).toBeNull();
    expect(calls).toBe(2);
  });

  it('does not retry on a 4xx and fails the scope resolution', async () => {
    (global as any).fetch = jest.fn(async () => ({ ok: false, status: 400, json: async () => null }));
    await expect(resolveActorScope(reqWith('u4'))).rejects.toBeInstanceOf(ScopeError);
  });
});

describe('actorAllowed', () => {
  it('allows everything when scope is null', () => {
    expect(actorAllowed(null, 123)).toBe(true);
  });
  it('allows only actors in the scope set otherwise', () => {
    const scope = new Set([1, 2]);
    expect(actorAllowed(scope, 1)).toBe(true);
    expect(actorAllowed(scope, 3)).toBe(false);
  });
});
