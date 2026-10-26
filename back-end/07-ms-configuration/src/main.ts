import Fastify from 'fastify';
import { registerServiceBasics } from '@faceattend/infra/http';
import { registerConfigurationRoutes } from './infrastructure/http/routes';
import { registerEventHook } from './infrastructure/messaging/event.publisher';
import { registerQualityMiddleware, registerQualityHealthEndpoint } from './infrastructure/http/qualityMiddleware';
import { registerAuthGuard } from './infrastructure/http/authGuard';
import { configurationPermission } from './infrastructure/http/permissions';
import { closeDatabase, connectDatabase, getDatabaseStatus, healthCheck } from './infrastructure/db/database';
import { createConfigurationRepositories } from './infrastructure/persistence/postgres';

const app = Fastify({ logger: true });
// Correlation id, security headers, error envelope, 404 and /health + /health/ready.
registerServiceBasics(app, { service: 'configuration-service', healthCheck });

async function start() {
  // PostgreSQL is the only persistence layer: there is no in-memory fallback, so
  // a database that cannot be reached is a fatal boot error (compose restarts us).
  try {
    await connectDatabase();
    app.log.info({ database: getDatabaseStatus() }, 'postgres connected (configuration)');
  } catch (err) {
    app.log.error({ err, database: getDatabaseStatus() }, 'postgres unavailable — refusing to start');
    await closeDatabase().catch(() => undefined);
    throw err;
  }

  registerAuthGuard(app, configurationPermission);

  // ISO/IEC 9001 — Quality audit middleware (Cláusula 8.5.2 / 9.1)
  registerQualityMiddleware(app);
  registerQualityHealthEndpoint(app);

  await registerConfigurationRoutes(app, createConfigurationRepositories());
  registerEventHook(app);
  app.addHook('onClose', async () => {
    await closeDatabase().catch(() => undefined);
  });

  const port = Number(process.env.PORT) || 8087;
  await app.listen({ port, host: '0.0.0.0' });
}

if (require.main === module) {
  start().catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
}

export { app, start };
