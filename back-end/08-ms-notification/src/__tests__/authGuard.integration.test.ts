import Fastify from 'fastify';
import { registerAuthGuard } from '../infrastructure/http/authGuard';
import { notificationPermission } from '../infrastructure/http/permissions';
import { registerNotificationRoutes, registerEmailRoute } from '../infrastructure/http/routes';
import { registerQualityMiddleware, registerQualityHealthEndpoint } from '../infrastructure/http/qualityMiddleware';

/**
 * Boots the guard together with the real routes, in the SAME order as
 * `main.ts`'s `start()`: registerAuthGuard -> quality middleware/health ->
 * notification routes -> email route. Every prior test built a bare Fastify
 * app with no guard at all, which is exactly why neither the percent-encoding
 * bypass nor the bare-alias bypass (`/alerts`, `/alert-types`) would ever
 * have been caught by CI.
 */
function fakeAlertRepo() {
  return {
    async create(draft: any) { return { alertId: 1, resolvedAt: null, ...draft }; },
    async list() { return []; },
    async count() { return 0; },
    async findById() { return null; },
    async existsById() { return false; },
    async update() { return null; },
    async softDelete() { return false; },
    async findByActorAndType() { return []; },
    async findFiltered() { return []; },
  } as any;
}
function fakeAlertTypeRepo() {
  return {
    async create(draft: any) { return { alertTypeId: 1, ...draft }; },
    async list() { return []; },
    async findById() { return null; },
    async findByCode() { return null; },
    async update() { return null; },
    async softDelete() { return false; },
  } as any;
}

async function buildApp() {
  const app = Fastify();
  app.get('/health', async () => ({ status: 'ok' }));
  app.get('/health/ready', async () => ({ status: 'ready' }));
  registerAuthGuard(app, notificationPermission);
  registerQualityMiddleware(app);
  registerQualityHealthEndpoint(app);
  await registerNotificationRoutes(app, { alerts: fakeAlertRepo(), alertTypes: fakeAlertTypeRepo() });
  registerEmailRoute(app, { host: '', port: 587, user: '', pass: '', from: '', internalToken: undefined } as any);
  await app.ready();
  return app;
}

const mockFetchNeverCalled = () => {
  (global as any).fetch = jest.fn(async () => {
    throw new Error('fetch must not be called when the guard denies before reaching identity/authorization');
  });
};

describe('authGuard integration — booted with the real routes (main.ts order)', () => {
  beforeEach(() => {
    mockFetchNeverCalled();
  });

  const protectedRoutes: Array<{ method: 'GET' | 'POST'; url: string }> = [
    { method: 'GET', url: '/api/v1/alerts' },
    { method: 'GET', url: '/alerts' },
    { method: 'POST', url: '/alert-types' },
    { method: 'POST', url: '/api/v1/alert-types' },
  ];

  it.each(protectedRoutes)('denies $method $url without a token (401)', async ({ method, url }) => {
    const app = await buildApp();
    const res = await app.inject({ method, url });
    expect(res.statusCode).toBe(401);
  });

  it.each(protectedRoutes)(
    'denies the percent-encoded equivalent of $method $url without a token (401) — the Critical finding',
    async ({ method, url }) => {
      const app = await buildApp();
      // Encode every letter 'a' in the path as %61 — find-my-way decodes this
      // before routing, so it still dispatches to the real protected handler.
      const encoded = url.replace(/a/g, '%61');
      const res = await app.inject({ method, url: encoded });
      expect(res.statusCode).toBe(401);
    },
  );

  it('denies /%61pi/v1/alerts (encoded "api") without a token — exact reviewer repro', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/%61pi/v1/alerts' });
    expect(res.statusCode).toBe(401);
  });

  it('denies /%61lerts (encoded "alerts") without a token — exact reviewer repro', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/%61lerts' });
    expect(res.statusCode).toBe(401);
  });

  it('denies /health/quality without a token (quality report consistency fix)', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/health/quality' });
    expect(res.statusCode).toBe(401);
  });

  it('denies /api/v1/quality/report without a token', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/v1/quality/report' });
    expect(res.statusCode).toBe(401);
  });

  it('rejects /api/v1/emailsX (not a true boundary match) with a 400, never treated as the public /emails route', async () => {
    const app = await buildApp();
    // No token at all: if the guard mistook this for the public prefix, it
    // would fall through to the email handler (400 for a missing body would
    // still differ from the guard's 401, but critically the handler would be
    // reached). We assert 401, proving the guard intercepted it first.
    const res = await app.inject({ method: 'POST', url: '/api/v1/emailsX', payload: {} });
    expect(res.statusCode).toBe(401);
  });

  const publicRoutes = ['/health', '/health/ready'];
  it.each(publicRoutes)('keeps %s reachable without a token', async (url) => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url });
    expect(res.statusCode).not.toBe(401);
  });

  it('keeps /api/v1/emails reachable without a bearer token (guard-level: SMTP/internal-token is the email route\'s own concern)', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/emails',
      payload: { to: 'a@b.com', template: 'verification_code', data: { code: '123456' } },
    });
    expect(res.statusCode).not.toBe(401);
  });
});
