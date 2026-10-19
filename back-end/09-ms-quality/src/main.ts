import Fastify from 'fastify';
import { randomUUID } from 'node:crypto';
import { registerQualityRoutes } from './infrastructure/http/routes';
import { registerAuthGuard } from './infrastructure/http/authGuard';
import { qualityPermission } from './infrastructure/http/permissions';
import { registerProcessRoutes } from './infrastructure/http/process.routes';
import { registerIstqbRoutes } from './infrastructure/http/istqb.routes';
import { registerEventHook } from './infrastructure/messaging/event.publisher';
import { closeDatabase, connectDatabase, healthCheck } from './infrastructure/db/database';
import { createQualityRepositories } from './infrastructure/persistence/pg';

const app = Fastify({ logger: true });
const startedAt = Date.now();

// ISO 25010 — Mantenibilidad/Seguridad: correlación de peticiones.
app.addHook('onRequest', async (req, reply) => {
  const requestId = (req.headers['x-request-id'] as string) || randomUUID();
  (req as any).requestId = requestId;
  reply.header('x-request-id', requestId);
});
app.addHook('onSend', async (_req, reply, payload) => {
  reply.header('x-content-type-options', 'nosniff');
  return payload;
});

// ISO 25010 — Fiabilidad: formato de error uniforme + sin fuga de stack.
app.setErrorHandler((error, req, reply) => {
  const status = (error as any).statusCode && (error as any).statusCode >= 400 ? (error as any).statusCode : 500;
  req.log.error({ err: error, path: req.url }, 'unhandled error');
  reply.code(status).send({
    error: status === 404 ? 'NotFound' : status === 400 ? 'BadRequest' : 'InternalError',
    message: status === 500 ? 'Unexpected internal error' : (error as Error).message,
    path: req.url,
    timestamp: new Date().toISOString(),
  });
});
app.setNotFoundHandler((req, reply) => {
  reply.code(404).send({ error: 'NotFound', message: `Route ${req.method} ${req.url} not found`, timestamp: new Date().toISOString() });
});

const version = process.env.npm_package_version || '0.1.0';
function healthPayload(service: string) {
  return { status: 'ok', service, version, uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000), timestamp: new Date().toISOString() };
}
app.get('/health', async () => healthPayload('quality-service'));
app.get('/api/v1/health', async () => healthPayload('quality-service'));

// Readiness is separate from liveness: `/health` keeps answering 200 for the
// compose healthcheck, while `/health/ready` reports whether PostgreSQL answers.
app.get('/health/ready', async (_req, reply) => {
  const probe = await healthCheck();
  const ready = probe.status === 'up';
  return reply.code(ready ? 200 : 503).send({
    status: ready ? 'ready' : 'not-ready',
    service: 'quality-service',
    database: probe,
    timestamp: new Date().toISOString(),
  });
});

async function start() {
  // PostgreSQL is the only persistence layer: there is no in-memory fallback, so
  // a database that cannot be reached is a fatal boot error (compose restarts us).
  try {
    await connectDatabase();
    app.log.info('postgres connected (quality)');
  } catch (err) {
    app.log.error({ err }, 'postgres unavailable — refusing to start');
    await closeDatabase().catch(() => undefined);
    throw err;
  }

  registerAuthGuard(app, qualityPermission);

  const repositories = createQualityRepositories();

  await registerQualityRoutes(app, repositories.evaluations);
  await registerProcessRoutes(app, repositories.projects, repositories.processAssessments);
  await registerIstqbRoutes(app, repositories.istqbAssessments);
  registerEventHook(app);
  app.addHook('onClose', async () => {
    await closeDatabase().catch(() => undefined);
  });

  const port = Number(process.env.PORT) || 8089;
  await app.listen({ port, host: '0.0.0.0' });
}

if (require.main === module) {
  start().catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
}

export { app, start };
