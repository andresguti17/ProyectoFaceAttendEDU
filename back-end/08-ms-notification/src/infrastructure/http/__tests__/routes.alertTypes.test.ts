import Fastify from 'fastify';
import { registerNotificationRoutes } from '../routes';

function fakeAlertTypeRepo() {
  const store = new Map<number, any>();
  let nextId = 1;
  return {
    async create(draft: any) { const row = { alertTypeId: nextId++, ...draft }; store.set(row.alertTypeId, row); return row; },
    async list() { return [...store.values()]; },
    async count() { return store.size; },
    async findById(id: number) { return store.get(id) ?? null; },
    async existsById(id: number) { return store.has(id); },
    async update(id: number, patch: any) { const row = store.get(id); if (!row) return null; Object.assign(row, patch); return row; },
    async softDelete(id: number) { return store.delete(id); },
    async findByCode(code: string) { return [...store.values()].find((r) => r.code === code) ?? null; },
  };
}

describe('alert-type routes', () => {
  it('rejects an invalid channel on create', async () => {
    const app = Fastify();
    await registerNotificationRoutes(app, { alerts: {} as any, alertTypes: fakeAlertTypeRepo() as any });
    const res = await app.inject({ method: 'POST', url: '/api/v1/alert-types', payload: { code: 'X', name: 'Y', severity: 'WARNING', channel: 'SMS' } });
    expect(res.statusCode).toBe(400);
  });
  it('creates and lists on both the canonical path and the alias', async () => {
    const app = Fastify();
    await registerNotificationRoutes(app, { alerts: {} as any, alertTypes: fakeAlertTypeRepo() as any });
    await app.inject({ method: 'POST', url: '/api/v1/alert-types', payload: { code: 'X', name: 'Y', severity: 'WARNING' } });
    const canonical = await app.inject({ method: 'GET', url: '/api/v1/alert-types' });
    const alias = await app.inject({ method: 'GET', url: '/alert-types' });
    expect(canonical.json().alert_types).toHaveLength(1);
    expect(alias.json().alert_types).toHaveLength(1);
  });
});
