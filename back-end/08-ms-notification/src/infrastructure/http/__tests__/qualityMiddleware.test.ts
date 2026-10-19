import Fastify from 'fastify';
import { registerQualityMiddleware, registerQualityHealthEndpoint } from '../qualityMiddleware';

describe('quality middleware', () => {
  it('reports counts and rates after requests', async () => {
    const app = Fastify();
    registerQualityMiddleware(app);
    registerQualityHealthEndpoint(app);
    app.get('/ok', async () => ({ ok: true }));
    app.get('/bad', async (_req, reply) => reply.code(400).send({ error: 'x' }));
    await app.inject({ method: 'GET', url: '/ok' });
    await app.inject({ method: 'GET', url: '/bad' });
    const res = await app.inject({ method: 'GET', url: '/health/quality' });
    const body = res.json();
    expect(body.service).toBe('08-ms-notification');
    expect(body.kpis.total_operations).toBeGreaterThanOrEqual(2);
    expect(body.error_classification.client_errors_4xx).toBeGreaterThanOrEqual(1);
  });
});
