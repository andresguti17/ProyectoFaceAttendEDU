import Fastify from 'fastify';
import { registerNotificationRoutes } from '../routes';
import * as actorScope from '../actorScope';
import * as notifier from '../../webhook/notifier';

function fakeAlertRepo() {
  const store = new Map<number, any>();
  let nextId = 1;
  return {
    async create(draft: any) { const row = { alertId: nextId++, resolvedAt: null, ...draft }; store.set(row.alertId, row); return row; },
    async list() { return [...store.values()]; },
    async count() { return store.size; },
    async findById(id: number) { return store.get(id) ?? null; },
    async existsById(id: number) { return store.has(id); },
    async update(id: number, patch: any) { const row = store.get(id); if (!row) return null; Object.assign(row, patch); return row; },
    async softDelete(id: number) { return store.delete(id); },
    async findByActorAndType() { return []; },
    async findFiltered(filter: any) {
      let rows = [...store.values()];
      if (filter.actorId !== undefined) rows = rows.filter((r) => r.academicActorId === filter.actorId);
      if (filter.typeId !== undefined) rows = rows.filter((r) => r.alertTypeId === filter.typeId);
      if (filter.resolved !== undefined) rows = rows.filter((r) => (r.resolvedAt != null) === filter.resolved);
      const offset = filter.offset ?? 0;
      const limit = filter.limit;
      return limit !== undefined ? rows.slice(offset, offset + limit) : rows.slice(offset);
    },
  };
}
function fakeAlertTypeRepo(row: any) {
  return { findById: async () => row, findByCode: async () => row } as any;
}

describe('alert routes — scope filtering', () => {
  it('GET /api/v1/alerts omits alerts outside the caller scope', async () => {
    const app = Fastify();
    const alerts = fakeAlertRepo();
    await alerts.create({ academicActorId: 1, alertTypeId: 1 });
    await alerts.create({ academicActorId: 2, alertTypeId: 1 });
    jest.spyOn(actorScope, 'resolveActorScope').mockResolvedValue(new Set([1]));
    await registerNotificationRoutes(app, { alerts: alerts as any, alertTypes: fakeAlertTypeRepo({ alertTypeId: 1, channel: 'DASHBOARD' }) });
    const res = await app.inject({ method: 'GET', url: '/api/v1/alerts' });
    expect(res.json().alerts).toHaveLength(1);
    expect(res.json().alerts[0].academicActorId).toBe(1);
  });

  it('dispatches a webhook for an EMAIL/PUSH alert type but not for DASHBOARD', async () => {
    const app = Fastify();
    const alerts = fakeAlertRepo();
    jest.spyOn(actorScope, 'resolveActorScope').mockResolvedValue(null);
    const spy = jest.spyOn(notifier, 'notifyWebhook').mockResolvedValue(undefined);
    await registerNotificationRoutes(app, { alerts: alerts as any, alertTypes: fakeAlertTypeRepo({ alertTypeId: 1, code: 'X', severity: 'WARNING', channel: 'EMAIL' }) });
    await app.inject({ method: 'POST', url: '/api/v1/alerts', payload: { academicActorId: 1, alertTypeId: 1 } });
    await new Promise((r) => setImmediate(r));
    expect(spy).toHaveBeenCalled();
  });

  it('filters actorId at the repository layer before paginating, like the Go FindAll', async () => {
    const app = Fastify();
    const alerts = fakeAlertRepo();
    // Nine other actors' alerts come first; actor 5's alert would be pushed
    // off a limit=5 unfiltered page if the filter were applied in-memory
    // after pagination instead of in the (fake) SQL layer.
    for (let actorId = 10; actorId < 19; actorId++) {
      await alerts.create({ academicActorId: actorId, alertTypeId: 1 });
    }
    await alerts.create({ academicActorId: 5, alertTypeId: 1 });
    jest.spyOn(actorScope, 'resolveActorScope').mockResolvedValue(null);
    await registerNotificationRoutes(app, { alerts: alerts as any, alertTypes: fakeAlertTypeRepo({ alertTypeId: 1, channel: 'DASHBOARD' }) });
    const res = await app.inject({ method: 'GET', url: '/api/v1/alerts?actorId=5&limit=5' });
    expect(res.json().alerts).toHaveLength(1);
    expect(res.json().alerts[0].academicActorId).toBe(5);
  });

  it('POST /api/v1/alerts 404s on a nonexistent alertTypeId and persists nothing', async () => {
    const app = Fastify();
    const alerts = fakeAlertRepo();
    const createSpy = jest.spyOn(alerts, 'create');
    await registerNotificationRoutes(app, { alerts: alerts as any, alertTypes: fakeAlertTypeRepo(null) });
    const res = await app.inject({ method: 'POST', url: '/api/v1/alerts', payload: { academicActorId: 1, alertTypeId: 999 } });
    expect(res.statusCode).toBe(404);
    expect(createSpy).not.toHaveBeenCalled();
    expect(await alerts.list()).toHaveLength(0);
  });
});
