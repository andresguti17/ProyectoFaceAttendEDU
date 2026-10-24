import Fastify, { type FastifyInstance } from 'fastify';
import { registerQualityHealthEndpoint, registerQualityMiddleware } from '../qualityMiddleware';
import { registerIEEE829TestLogEndpoints, registerIEEE829TestLogMiddleware } from '../ieee829TestLogMiddleware';

// The ISO 9001 report and the IEEE 829 test log count real requests; both keep
// module-level state, so assertions compare against a reading taken first.
let app: FastifyInstance;

beforeAll(async () => {
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  app = Fastify();
  registerQualityMiddleware(app);
  registerIEEE829TestLogMiddleware(app);
  registerQualityHealthEndpoint(app);
  registerIEEE829TestLogEndpoints(app);
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
    expect((await app.inject({ method: 'GET', url: '/health/quality' })).json().service).toBe('03-ms-academic');
  });
});

describe('IEEE 829 test log', () => {
  it('logs each request as PASS or FAIL and pages and filters the log', async () => {
    await app.inject({ method: 'GET', url: '/api/v1/things' });
    await app.inject({ method: 'GET', url: '/api/v1/silent-error' });

    const log = (await app.inject({ method: 'GET', url: '/api/v1/quality/test-log?limit=1' })).json();
    expect(log.pagination.limit).toBe(1);
    expect(log.entries).toHaveLength(1);
    expect(log.summary.ieee829_compliance).toBe('IEEE 829-1998');

    const failed = (await app.inject({ method: 'GET', url: '/api/v1/quality/test-log?status=fail&limit=100' })).json();
    expect(failed.entries.length).toBeGreaterThan(0);
    expect(failed.entries.every((e: any) => e.status === 'FAIL')).toBe(true);
    const silent = failed.entries.find((e: any) => e.endpoint === '/api/v1/silent-error');
    expect(silent.assertions.find((a: any) => a.name === 'Error response has message').passed).toBe(false);

    const one = await app.inject({ method: 'GET', url: `/api/v1/quality/test-log/${encodeURIComponent(log.entries[0].testId)}` });
    expect(one.statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/api/v1/quality/test-log/nope' })).statusCode).toBe(404);

    const summary = (await app.inject({ method: 'GET', url: '/api/v1/quality/test-summary' })).json();
    expect(summary.report_type).toBe('IEEE 829 Test Summary Report');
    expect(summary.summary.total_tests).toBeGreaterThan(1);
  });
});
