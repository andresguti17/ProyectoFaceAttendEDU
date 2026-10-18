/**
 * PostgreSQL connection singleton — 03-ms-academic.
 *
 * Single owner of the `pg` Pool for the whole process. Every repository goes
 * through `runQuery` / `runCommand` / `withTransaction` so that:
 *   - all SQL is executed with bind parameters ($1, $2, ...) — never string
 *     concatenation of request data (OWASP A03 / fae-docs security-rules);
 *   - connection lifecycle is centralised (boot, graceful shutdown, health).
 *
 * Environment (docker-compose `ms-academic`):
 *   DATABASE_URL                postgres://user:pass@host:5432/db  (preferred)
 *   POSTGRES_HOST/PORT/USER/PASSWORD/DB                            (fallback)
 *   PG_SCHEMA                   academic      (default `academic`)
 *   DB_SSL_MODE                 disable|require|verify-full (default disable)
 *   DB_POOL_MAX                 default 10
 *   DB_STATEMENT_TIMEOUT_MS     default 15000
 *   DB_CONNECT_RETRIES          default 10
 *   DB_CONNECT_RETRY_DELAY_MS   default 3000
 */

import { Pool, types as pgTypes, type PoolClient, type QueryResultRow } from 'pg';

// Host runs also read the repo-root .env, so one file governs Docker and
// workstation runs alike; in Docker compose injects the environment and the
// file is absent, so this is a no-op there.
try {
  (process as unknown as { loadEnvFile?: (file: string) => void }).loadEnvFile?.('../../.env');
} catch {
  /* no root .env */
}

// ── Wire-format normalisation ────────────────────────────────────────────
//
// The public JSON contract of this service predates real persistence: dates are
// emitted as `YYYY-MM-DD`, timestamps as ISO-8601 UTC strings, and BIGINT
// identifiers (cohort_id, academic_actor_id, enrollment_id) as JSON numbers.
//
// node-postgres' default parsers would instead hand back `Date` objects (which
// re-serialise with a timezone shift, because every column here is
// `timestamp without time zone`) and *strings* for int8. Both would silently
// change response bodies, so the raw wire text is normalised here.

const OID_INT8 = 20;
const OID_DATE = 1082;
const OID_TIMESTAMP = 1114;
const OID_TIMESTAMPTZ = 1184;

const TIMESTAMP_RE = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.(\d+))?/;

/**
 * `timestamp without time zone` wire text -> ISO-8601 UTC-shaped string.
 * The stored wall-clock value is preserved verbatim (no timezone arithmetic),
 * which is what `new Date().toISOString()` produced before persistence existed.
 */
export function toIsoTimestamp(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const text = String(raw);
  const m = TIMESTAMP_RE.exec(text);
  if (!m) return text;
  const millis = (m[3] ?? '').padEnd(3, '0').slice(0, 3);
  return `${m[1]}T${m[2]}.${millis}Z`;
}

/** `date` wire text (`YYYY-MM-DD`) passed through unchanged. */
export function toDateOnly(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  return String(raw).slice(0, 10);
}

pgTypes.setTypeParser(OID_INT8, (value) => (value === null ? null : Number(value)));
pgTypes.setTypeParser(OID_DATE, (value) => toDateOnly(value));
pgTypes.setTypeParser(OID_TIMESTAMP, (value) => toIsoTimestamp(value));
pgTypes.setTypeParser(OID_TIMESTAMPTZ, (value) => (value === null ? null : new Date(value).toISOString()));

// ── Configuration ────────────────────────────────────────────────────────

export interface DatabaseConfig {
  connectionString: string;
  schema: string;
  max: number;
  statementTimeoutMs: number;
  ssl: false | { rejectUnauthorized: boolean };
}

function buildConnectionString(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const host = process.env.POSTGRES_HOST ?? 'localhost';
  const port = process.env.POSTGRES_PORT ?? '5432';
  const user = process.env.POSTGRES_USER ?? 'postgres';
  const password = process.env.POSTGRES_PASSWORD ?? 'postgres';
  const database = process.env.POSTGRES_DB ?? 'faceattend_db';
  return `postgres://${user}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

/**
 * The schema name is interpolated into the connection's `search_path` startup
 * option, so it is restricted to a bare SQL identifier even though it comes
 * from trusted configuration rather than from a request.
 */
function sanitiseSchema(raw: string | undefined, fallback: string): string {
  const candidate = (raw ?? fallback).trim();
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(candidate) ? candidate : fallback;
}

function buildConfig(): DatabaseConfig {
  const sslMode = (process.env.DB_SSL_MODE ?? 'disable').toLowerCase();
  return {
    connectionString: buildConnectionString(),
    schema: sanitiseSchema(process.env.PG_SCHEMA, 'academic'),
    max: Number(process.env.DB_POOL_MAX ?? 25),
    statementTimeoutMs: Number(process.env.DB_STATEMENT_TIMEOUT_MS ?? 15000),
    ssl: sslMode === 'disable' ? false : { rejectUnauthorized: sslMode === 'verify-full' },
  };
}

/** Redacted form of the connection string, safe for logs and /health. */
function redact(connectionString: string): string {
  return connectionString.replace(/\/\/([^:/@]+):([^@]*)@/, '//$1:***@');
}

// ── Pool singleton ───────────────────────────────────────────────────────

let pool: Pool | null = null;
let config: DatabaseConfig | null = null;
let connectedAt: number | null = null;
let lastError: string | null = null;

function createPool(): Pool {
  config = buildConfig();
  const created = new Pool({
    connectionString: config.connectionString,
    max: config.max,
    statement_timeout: config.statementTimeoutMs,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: config.ssl,
    // Explicit schema first so unqualified objects (e.g. shared helpers,
    // `public` functions) still resolve. Repositories nonetheless always
    // schema-qualify their tables.
    options: `-c search_path=${config.schema},public`,
  });
  created.on('error', (err) => {
    lastError = err.message;
  });
  return created;
}

/** Returns the shared pool, creating it on first use. Never throws. */
export function getPool(): Pool {
  if (!pool) pool = createPool();
  return pool;
}

/**
 * Verifies connectivity, retrying with a fixed delay.
 * Called from `main.ts` before the HTTP listener opens; compose only gates on
 * the postgres *container* being healthy, not on Liquibase having finished.
 */
export async function connectDatabase(opts?: { retries?: number; retryDelayMs?: number }): Promise<void> {
  const retries = opts?.retries ?? Number(process.env.DB_CONNECT_RETRIES ?? 10);
  const retryDelayMs = opts?.retryDelayMs ?? Number(process.env.DB_CONNECT_RETRY_DELAY_MS ?? 3000);
  const p = getPool();

  let attempt = 0;
  for (;;) {
    try {
      const client = await p.connect();
      try {
        await client.query('SELECT 1');
      } finally {
        client.release();
      }
      connectedAt = Date.now();
      lastError = null;
      return;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      if (attempt >= retries) throw err;
      attempt += 1;
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }
}

export async function closeDatabase(): Promise<void> {
  const current = pool;
  pool = null;
  config = null;
  connectedAt = null;
  if (current) await current.end();
}

export function isDatabaseConnected(): boolean {
  return pool !== null && connectedAt !== null && lastError === null;
}

export function getDatabaseStatus(): {
  connected: boolean;
  schema: string;
  connectionString: string;
  poolTotal: number;
  poolIdle: number;
  poolWaiting: number;
  connectedAt: string | null;
  lastError: string | null;
} {
  const cfg = config ?? buildConfig();
  return {
    connected: isDatabaseConnected(),
    schema: cfg.schema,
    connectionString: redact(cfg.connectionString),
    poolTotal: pool?.totalCount ?? 0,
    poolIdle: pool?.idleCount ?? 0,
    poolWaiting: pool?.waitingCount ?? 0,
    connectedAt: connectedAt === null ? null : new Date(connectedAt).toISOString(),
    lastError,
  };
}

/** Read/multi-row statement. Always parameterised. */
export async function runQuery<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: readonly unknown[] = [],
): Promise<T[]> {
  const result = await getPool().query<T>(sql, params as unknown[]);
  return result.rows;
}

/** INSERT/UPDATE/DELETE where only the affected row count matters. */
export async function runCommand(sql: string, params: readonly unknown[] = []): Promise<number> {
  const result = await getPool().query(sql, params as unknown[]);
  return result.rowCount ?? 0;
}

/** Runs `fn` inside a single transaction, rolling back on any throw. */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // the connection is already unusable; the outer error is the real one
    }
    throw err;
  } finally {
    client.release();
  }
}

/** Lightweight liveness probe used by `/health/ready`. */
export async function healthCheck(): Promise<{ ok: boolean; latencyMs: number; error: string | null }> {
  const started = Date.now();
  try {
    await runQuery<{ ok: number }>('SELECT 1 AS ok');
    connectedAt = connectedAt ?? Date.now();
    lastError = null;
    return { ok: true, latencyMs: Date.now() - started, error: null };
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
    connectedAt = null;
    return { ok: false, latencyMs: Date.now() - started, error: lastError };
  }
}
