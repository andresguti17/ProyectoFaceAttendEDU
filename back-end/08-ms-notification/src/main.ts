import Fastify from 'fastify';
import { registerServiceBasics } from '@faceattend/infra/http';
import { registerNotificationRoutes, registerEmailRoute, registerDeviceTokenRoutes } from './infrastructure/http/routes';
import { pushConfigFromEnv, withAlertPush } from './infrastructure/push/expoPush';
import { registerQualityMiddleware, registerQualityHealthEndpoint } from './infrastructure/http/qualityMiddleware';
import {
  connectDatabase,
  closeDatabase,
  getDatabaseStatus,
  healthCheck,
} from './infrastructure/db/database';
import { createNotificationRepositories } from './infrastructure/persistence/postgres';
import { registerAuthGuard } from './infrastructure/http/authGuard';
import { notificationPermission } from './infrastructure/http/permissions';
import { smtpConfigFromEnv, sendEmail } from './infrastructure/email/sender';
import { runJustificationConsumer } from './infrastructure/messaging/justification.consumer';
import { runClassSessionConsumer } from './infrastructure/messaging/classSession.consumer';
import type { AlertDeps } from './application/attendanceAlerts/deps';
import { HttpPeers, peerConfigFromEnv } from './infrastructure/peers/httpPeers';
import { startAttendanceSchedulers, type RiskScheduler } from './infrastructure/scheduler/riskScheduler';

const app = Fastify({ logger: true });
// Correlation id, security headers, error envelope, 404 and /health + /health/ready.
registerServiceBasics(app, { service: 'notification-service', healthCheck });

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

  // Every alert created through `repositories.alerts` is also pushed to the actor's devices.
  const persistence = createNotificationRepositories();
  const repositories = {
    ...persistence,
    alerts: withAlertPush(persistence.alerts, persistence.alertTypes, {
      tokens: persistence.deviceTokens,
      config: pushConfigFromEnv(),
      logger: app.log,
    }),
  };
  await registerNotificationRoutes(app, repositories);
  registerDeviceTokenRoutes(app, repositories.deviceTokens);
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

  // Absence e-mails and at-risk alerts need a service account to read the other services; without
  // NOTIFICATION_SERVICE_USERNAME/PASSWORD the feature stays off and the rest keeps working.
  const peerConfig = peerConfigFromEnv();
  let riskScheduler: RiskScheduler | undefined;
  if (peerConfig) {
    const smtp = smtpConfigFromEnv();
    const deps: AlertDeps = {
      peers: new HttpPeers(peerConfig),
      log: repositories.notificationLog,
      alerts: repositories.alerts,
      alertTypes: repositories.alertTypes,
      sendEmail: async (message) => {
        await sendEmail(smtp, message);
      },
      logger: {
        info: (message, data) => app.log.info(data ?? {}, message),
        warn: (message, data) => app.log.warn(data ?? {}, message),
      },
    };
    if (brokersEnv) {
      const brokers = brokersEnv.split(',').map((b) => b.trim()).filter(Boolean);
      runClassSessionConsumer(brokers, deps).catch((err) => {
        app.log.error({ err }, 'class-session consumer failed');
      });
    }
    riskScheduler = startAttendanceSchedulers(deps);
    app.log.info('attendance alerts enabled (absence e-mails on class close, daily at-risk pass)');
  } else {
    app.log.info('attendance alerts disabled: NOTIFICATION_SERVICE_USERNAME/PASSWORD not set');
  }

  app.addHook('onClose', async () => {
    riskScheduler?.stop();
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
