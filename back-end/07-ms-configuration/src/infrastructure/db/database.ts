/**
 * PostgreSQL pool of 07-ms-configuration: the implementation shared by the Node services
 * (back-end/shared/node-infra/database.js) bound to this service's schema. Every
 * repository goes through runQuery / runCommand / withTransaction, always with bind
 * parameters. Environment: see the shared module (DATABASE_URL, PG_SCHEMA, DB_*).
 */
import pg from 'pg';
import { createDatabase } from '@faceattend/infra/database';

// Host runs also read the repo-root .env, so one file governs Docker and
// workstation runs alike; in Docker compose injects the environment and the
// file is absent, so this is a no-op there.
try {
  (process as unknown as { loadEnvFile?: (file: string) => void }).loadEnvFile?.('../../.env');
} catch {
  /* no root .env */
}

export const {
  getPool,
  connectDatabase,
  closeDatabase,
  isDatabaseConnected,
  getDatabaseStatus,
  runQuery,
  runCommand,
  withTransaction,
  healthCheck,
} = createDatabase({ pg, defaultSchema: 'configuration' });

export { toIsoTimestamp, toDateOnly } from '@faceattend/infra/database';
