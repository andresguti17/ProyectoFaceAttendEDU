import Fastify from 'fastify';
import { registerServiceBasics } from '@faceattend/infra/http';
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
import { createAcademicRepositories } from './infrastructure/persistence/postgres';
import { registerAuthGuard } from './infrastructure/http/authGuard';
import { academicPermission } from './infrastructure/http/permissions';

const app = Fastify({ logger: true });
// Correlation id, security headers, error envelope, 404 and /health + /health/ready.
registerServiceBasics(app, { service: 'academic-service', healthCheck });

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
