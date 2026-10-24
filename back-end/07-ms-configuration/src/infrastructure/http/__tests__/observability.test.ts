import Fastify, { type FastifyInstance } from 'fastify';
import { registerQualityHealthEndpoint, registerQualityMiddleware } from '../qualityMiddleware';

// The ISO 9001 report counts real requests and keeps module-level state, so
// assertions compare against a reading taken first.
let app: FastifyInstance;

beforeAll(async () => {
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  app = Fastify();
  registerQualityMiddleware(app);
  registerQualityHealthEndpoint(app);
  app.get('/api/v1/things', async () => [{ id: 1 }]);
  app.get('/api/v1/things/:id', async (req, reply) =>
    (req.params as any).id === '1' ? { id: 1 } : reply.code(404).send({ error: 'NotFound' }));
  app.post('/api/v1/things', async (_req, reply) => reply.code(201).send({ id: 2 }));
  app.put('/api/v1/things/:id', async () => ({ id: 1 }));
  app.delete('/api/v1/things/:id', async (_req, reply) => reply.code(204).send());
  app.get('/api/v1/broken', async (_req, reply) => reply.code(500).send({ error: 'Internal' }));
  app.get('/api/v1/silent-error', async (_req, reply) => reply.code(400).send({}));
  await app.ready();
});

afterAll(async () => {
  await app.close();
  jest.restoreAllMocks();
});

const report = async () => (await app.inject({ method: 'GET', url: '/api/v1/quality/report' })).json();

describe('ISO 9001 quality report', () => {
  it('counts operations by kind and classifies errors', async () => {
    const before = await report();
    await app.inject({ method: 'GET', url: '/api/v1/things' });
    await app.inject({ method: 'POST', url: '/api/v1/things', payload: {} });
    await app.inject({ method: 'PUT', url: '/api/v1/things/1', payload: {} });
    await app.inject({ method: 'DELETE', url: '/api/v1/things/1' });
    await app.inject({ method: 'GET', url: '/api/v1/things/9' });
    await app.inject({ method: 'GET', url: '/api/v1/broken' });
    const after = await report();

    expect(after.crud_operations.creates - before.crud_operations.creates).toBe(1);
    expect(after.crud_operations.updates - before.crud_operations.updates).toBe(1);
    expect(after.crud_operations.deletes - before.crud_operations.deletes).toBe(1);
    expect(after.error_classification.client_errors_4xx - before.error_classification.client_errors_4xx).toBe(1);
    expect(after.error_classification.server_errors_5xx - before.error_classification.server_errors_5xx).toBe(1);
    expect(after.kpis.availability_status).toBe('DEGRADED');
    expect(after.meets_target).toBe(false);
    expect((await app.inject({ method: 'GET', url: '/health/quality' })).json().service).toBe('07-ms-configuration');
  });
});
