import Fastify from 'fastify';
import { randomUUID } from 'node:crypto';
import { registerNotificationRoutes, registerEmailRoute } from './infrastructure/http/routes';
import { registerQualityMiddleware, registerQualityHealthEndpoint } from './infrastructure/http/qualityMiddleware';
import {
  connectDatabase,
  closeDatabase,
  getDatabaseStatus,
  healthCheck,
} from './infrastructure/db/database';
import { RepositoryError } from './infrastructure/persistence/errors';
import { createNotificationRepositories } from './infrastructure/persistence/postgres';
import { registerAuthGuard } from './infrastructure/http/authGuard';
import { notificationPermission } from './infrastructure/http/permissions';
import { smtpConfigFromEnv } from './infrastructure/email/sender';
import { runJustificationConsumer } from './infrastructure/messaging/justification.consumer';

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
app.get('/health', async () => healthPayload('notification-service'));
app.get('/api/v1/health', async () => healthPayload('notification-service'));

// Readiness is separate from liveness: `/health` keeps answering 200 for the
// compose healthcheck, while `/health/ready` reports whether PostgreSQL answers.
app.get('/health/ready', async (req, reply) => {
  const probe = await healthCheck();
  const payload = {
    status: probe.ok ? 'ready' : 'not-ready',
    service: 'notification-service',
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
    app.log.info({ database: getDatabaseStatus() }, 'postgres connected (notification)');
  } catch (err) {
    app.log.error({ err, database: getDatabaseStatus() }, 'postgres unavailable — refusing to start');
    await closeDatabase().catch(() => undefined);
    throw err;
  }

  registerAuthGuard(app, notificationPermission);

  // ISO/IEC 9001 — Quality audit middleware (Cláusula 8.5.2 / 9.1)
  registerQualityMiddleware(app);
  registerQualityHealthEndpoint(app);

  const repositories = createNotificationRepositories();
  await registerNotificationRoutes(app, repositories);
  registerEmailRoute(app, smtpConfigFromEnv());

  // Kafka is optional: only start the justification-reviewed consumer when a
  // broker list is configured, matching the Go `main.go`'s
  // `if brokers := os.Getenv("KAFKA_BROKERS"); brokers != ""` guard. Failures
  // are logged but never crash the process — the HTTP API stays up.
  const brokersEnv = process.env.KAFKA_BROKERS;
  if (brokersEnv) {
    const brokers = brokersEnv.split(',').map((b) => b.trim()).filter(Boolean);
    runJustificationConsumer(brokers, repositories).catch((err) => {
      app.log.error({ err }, 'justification consumer failed');
    });
  }

  app.addHook('onClose', async () => {
    await closeDatabase().catch(() => undefined);
  });

  const port = Number(process.env.PORT) || 8088;
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
