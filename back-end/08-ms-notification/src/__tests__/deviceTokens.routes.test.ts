import Fastify from 'fastify';
import { registerDeviceTokenRoutes } from '../infrastructure/http/routes';
import { notificationPermission } from '../infrastructure/http/permissions';
import * as actorScope from '../infrastructure/http/actorScope';
import { ScopeError } from '../infrastructure/http/actorScope';
import { PostgresDeviceTokenRepository } from '../infrastructure/persistence/postgres/device-token.repository';

jest.mock('../infrastructure/db/database', () => ({ runQuery: jest.fn() }));
const database = require('../infrastructure/db/database');

const TOKEN_A = 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]';
const TOKEN_B = 'ExponentPushToken[bbbbbbbbbbbbbbbbbbbbbb]';

/** In-memory twin of PostgresDeviceTokenRepository (same upsert/ownership rules as its SQL). */
function fakeTokenRepo() {
  const rows = new Map<string, { id: number; actor: number; platform: string; locale: string; revoked: boolean }>();
  let nextId = 1;
  return {
    rows,
    async upsert(actor: number, token: string, platform: any, locale: any) {
      const row = rows.get(token);
      if (row) {
        Object.assign(row, { actor, platform, locale, revoked: false });
        return row.id;
      }
      const id = nextId++;
      rows.set(token, { id, actor, platform, locale, revoked: false });
      return id;
    },
    async revokeOwned(token: string, actors: number[]) {
      const row = rows.get(token);
      if (!row || row.revoked || !actors.includes(row.actor)) return false;
      row.revoked = true;
      return true;
    },
    async findActiveByActor(actor: number) {
      return [...rows.entries()]
        .filter(([, r]) => r.actor === actor && !r.revoked)
        .map(([token, r]) => ({ token, locale: r.locale }));
    },
    async revokeTokens(tokens: string[]) {
      for (const t of tokens) {
        const row = rows.get(t);
        if (row) row.revoked = true;
      }
    },
  };
}

async function appWith(repo: ReturnType<typeof fakeTokenRepo>) {
  const app = Fastify();
  registerDeviceTokenRoutes(app, repo);
  await app.ready();
  return app;
}

const ownActors = (ids: number[]) => jest.spyOn(actorScope, 'resolveOwnActorIds').mockResolvedValue(ids);

afterEach(() => jest.restoreAllMocks());

describe('POST /device-tokens', () => {
  it('registers the token for the caller actor (from the session) and answers 201 { device_token_id }', async () => {
    const repo = fakeTokenRepo();
    ownActors([7, 3]);
    const app = await appWith(repo);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/device-tokens',
      payload: { token: TOKEN_A, platform: 'android', locale: 'en' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ device_token_id: 1 });
    expect(repo.rows.get(TOKEN_A)).toMatchObject({ actor: 3, platform: 'android', locale: 'en', revoked: false });
  });

  it('upserts by token: re-activates it and moves it to the new caller with the new locale', async () => {
    const repo = fakeTokenRepo();
    const app = await appWith(repo);
    ownActors([3]);
    await app.inject({ method: 'POST', url: '/device-tokens', payload: { token: TOKEN_A, platform: 'ios', locale: 'es' } });
    repo.rows.get(TOKEN_A)!.revoked = true;

    ownActors([9]);
    const res = await app.inject({ method: 'POST', url: '/device-tokens', payload: { token: TOKEN_A, platform: 'ios', locale: 'fr' } });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ device_token_id: 1 });
    expect(repo.rows.size).toBe(1);
    expect(repo.rows.get(TOKEN_A)).toMatchObject({ actor: 9, locale: 'fr', revoked: false });
  });

  it.each([
    [{ token: 'not-a-token', platform: 'ios', locale: 'es' }],
    [{ token: TOKEN_A, platform: 'web', locale: 'es' }],
    [{ token: TOKEN_A, platform: 'ios', locale: 'de' }],
    [{ token: TOKEN_A, platform: 'ios' }],
  ])('rejects an invalid body with 400: %j', async (payload) => {
    const repo = fakeTokenRepo();
    ownActors([3]);
    const app = await appWith(repo);
    const res = await app.inject({ method: 'POST', url: '/api/v1/device-tokens', payload });
    expect(res.statusCode).toBe(400);
    expect(repo.rows.size).toBe(0);
  });

  it('answers 403 when the user has no academic actor', async () => {
    ownActors([]);
    const app = await appWith(fakeTokenRepo());
    const res = await app.inject({ method: 'POST', url: '/api/v1/device-tokens', payload: { token: TOKEN_A, platform: 'ios', locale: 'es' } });
    expect(res.statusCode).toBe(403);
  });

  it('answers 503 when the actor lookup fails', async () => {
    jest.spyOn(actorScope, 'resolveOwnActorIds').mockRejectedValue(new ScopeError(503, 'academic down'));
    const app = await appWith(fakeTokenRepo());
    const res = await app.inject({ method: 'POST', url: '/api/v1/device-tokens', payload: { token: TOKEN_A, platform: 'ios', locale: 'es' } });
    expect(res.statusCode).toBe(503);
  });
});

describe('DELETE /device-tokens/:token', () => {
  it('revokes a token of the caller and answers 204', async () => {
    const repo = fakeTokenRepo();
    await repo.upsert(3, TOKEN_A, 'ios', 'es');
    ownActors([3]);
    const app = await appWith(repo);
    const res = await app.inject({ method: 'DELETE', url: `/api/v1/device-tokens/${encodeURIComponent(TOKEN_A)}` });
    expect(res.statusCode).toBe(204);
    expect(repo.rows.get(TOKEN_A)!.revoked).toBe(true);
  });

  it("never revokes another user's token (still 204, nothing revealed)", async () => {
    const repo = fakeTokenRepo();
    await repo.upsert(8, TOKEN_B, 'android', 'es');
    ownActors([3]);
    const app = await appWith(repo);
    const res = await app.inject({ method: 'DELETE', url: `/device-tokens/${encodeURIComponent(TOKEN_B)}` });
    expect(res.statusCode).toBe(204);
    expect(repo.rows.get(TOKEN_B)!.revoked).toBe(false);
  });
});

describe('device-token permission and SQL', () => {
  it('needs only a valid session, on both paths', () => {
    expect(notificationPermission('POST', '/api/v1/device-tokens')).toBeNull();
    expect(notificationPermission('DELETE', '/api/v1/device-tokens/:token')).toBeNull();
    expect(notificationPermission('POST', '/device-tokens')).toBeNull();
    expect(notificationPermission('POST', '/api/v1/device-tokensX')).toBe('configuration:manage');
  });

  it('upserts on the token and re-activates it', async () => {
    database.runQuery.mockResolvedValueOnce([{ device_token_id: 5 }]);
    const id = await new PostgresDeviceTokenRepository().upsert(3, TOKEN_A, 'ios', 'pt');
    const [sql, params] = database.runQuery.mock.calls.at(-1);
    expect(id).toBe(5);
    expect(sql).toContain('ON CONFLICT (token) DO UPDATE');
    expect(sql).toContain('revoked_at = NULL');
    expect(params).toEqual([3, TOKEN_A, 'ios', 'pt']);
  });

  it('revokes only rows owned by the given actors', async () => {
    database.runQuery.mockResolvedValueOnce([]);
    const repo = new PostgresDeviceTokenRepository();
    expect(await repo.revokeOwned(TOKEN_A, [3, 4])).toBe(false);
    const [sql, params] = database.runQuery.mock.calls.at(-1);
    expect(sql).toContain('academic_actor_id = ANY($2::bigint[])');
    expect(params).toEqual([TOKEN_A, [3, 4]]);
    database.runQuery.mockClear();
    expect(await repo.revokeOwned(TOKEN_A, [])).toBe(false);
    expect(database.runQuery).not.toHaveBeenCalled();
  });
});
