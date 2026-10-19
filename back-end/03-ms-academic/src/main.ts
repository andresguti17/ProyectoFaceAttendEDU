import Fastify from 'fastify';
import { randomUUID } from 'node:crypto';
import { registerAcademicRoutes } from './infrastructure/http/routes';
import { registerEventHook } from './infrastructure/messaging/event.publisher';
import { registerQualityMiddleware, registerQualityHealthEndpoint } from './infrastructure/http/qualityMiddleware';
import { registerIEEE829TestLogMiddleware, registerIEEE829TestLogEndpoints } from './infrastructure/http/ieee829TestLogMiddleware';
import {
  connectDatabase,
  closeDatabase,
  getDatabaseStatus,
  healthCheck,
} from './infrastructure/db/database';
import { RepositoryError } from './infrastructure/persistence/errors';
import { createAcademicRepositories } from './infrastructure/persistence/postgres';
import { registerAuthGuard } from './infrastructure/http/authGuard';
import { academicPermission } from './infrastructure/http/permissions';

const app = Fastify({ logger: true });
const startedAt = Date.now();

app.addHook('onRequest', async (req, reply) => {
  const requestId = (req.headers['x-request-id'] as string) || randomUUID();
  (req as any).requestId = requestId;
  reply.header('x-request-id', requestId);
});
app.addHook('onSend', async (_req, reply, payload) => {
  reply.header('x-content-type-options', 'nosniff');
  return payload;
});

/** Error name rendered in the response envelope, by HTTP status. */
function errorNameFor(status: number): string {
  switch (status) {
    case 400: return 'BadRequest';
    case 404: return 'NotFound';
    case 409: return 'Conflict';
    case 503: return 'ServiceUnavailable';
    default: return status >= 500 ? 'InternalError' : 'BadRequest';
  }
}

app.setErrorHandler((error, req, reply) => {
  const status = (error as any).statusCode && (error as any).statusCode >= 400 ? (error as any).statusCode : 500;
  req.log.error({ err: error, path: req.url }, 'unhandled error');
  const details = error instanceof RepositoryError ? error.details : undefined;
  reply.code(status).send({
    error: errorNameFor(status),
    // Never echo a raw driver message for a server-side failure.
    message: status >= 500 && status !== 503 ? 'Unexpected internal error' : (error as Error).message,
    ...(details === undefined ? {} : { details }),
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
app.get('/health', async () => healthPayload('academic-service'));
app.get('/api/v1/health', async () => healthPayload('academic-service'));

// Readiness is separate from liveness: `/health` keeps answering 200 for the
// compose healthcheck, while `/health/ready` reports whether PostgreSQL answers.
app.get('/health/ready', async (req, reply) => {
  const probe = await healthCheck();
  const payload = {
    status: probe.ok ? 'ready' : 'not-ready',
    service: 'academic-service',
    database: { ...getDatabaseStatus(), latencyMs: probe.latencyMs, error: probe.error },
    timestamp: new Date().toISOString(),
  };
  return reply.code(probe.ok ? 200 : 503).send(payload);
});

async function start() {
  // PostgreSQL is the only persistence layer: there is no in-memory fallback, so
  // a database that cannot be reached is a fatal boot error (compose restarts us).
  try {
    await connectDatabase();
    app.log.info({ database: getDatabaseStatus() }, 'postgres connected (academic)');
  } catch (err) {
    app.log.error({ err, database: getDatabaseStatus() }, 'postgres unavailable — refusing to start');
    await closeDatabase().catch(() => undefined);
    throw err;
  }

  registerAuthGuard(app, academicPermission);

  // ISO/IEC 9001 — Quality audit middleware (Cláusula 8.5.2 / 9.1)
  registerQualityMiddleware(app);
  registerQualityHealthEndpoint(app);

  // IEEE 829 — Test log middleware (Cláusula 6 - Test Log)
  registerIEEE829TestLogMiddleware(app);
  registerIEEE829TestLogEndpoints(app);

  const repositories = createAcademicRepositories();
  await registerAcademicRoutes(app, repositories);
  registerEventHook(app);

  app.addHook('onClose', async () => {
    await closeDatabase().catch(() => undefined);
  });

  const port = Number(process.env.PORT) || 8083;
  await app.listen({ port, host: '0.0.0.0' });
}

if (require.main === module) {
  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'shutting down');
    try {
      await app.close();
      process.exit(0);
    } catch (err) {
      app.log.error({ err }, 'error during shutdown');
      process.exit(1);
    }
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  start().catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
}

export { app, start };
