import type { Config } from 'drizzle-kit';

// Host runs (drizzle-kit on the workstation) also read the repo-root .env;
// in Docker the environment is injected by compose and this is a no-op.
try {
  (process as unknown as { loadEnvFile?: (file: string) => void }).loadEnvFile?.('../../.env');
} catch {
  /* no root .env */
}

export default {
  schema: './src/infrastructure/persistence/schema.ts',
  out: './drizzle',
  driver: 'pg',
  dbCredentials: { connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/faceattend_db' }
} satisfies Config;
