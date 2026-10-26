'use strict';

/**
 * PostgreSQL connection singleton shared by the Node services (academic,
 * configuration, notification). Single owner of the `pg` Pool for the process;
 * every repository goes through runQuery / runCommand / withTransaction, so all
 * SQL runs with bind parameters and the connection lifecycle lives in one place.
 *
 * Environment:
 *   DATABASE_URL                postgres://user:pass@host:5432/db  (preferred)
 *   POSTGRES_HOST/PORT/USER/PASSWORD/DB                            (fallback)
 *   PG_SCHEMA                   the service's schema (default given by the service)
 *   DB_SSL_MODE                 disable|require|verify-full (default disable)
 *   DB_POOL_MAX                 default 25
 *   DB_STATEMENT_TIMEOUT_MS     default 15000
 *   DB_CONNECT_RETRIES          default 10
 *   DB_CONNECT_RETRY_DELAY_MS   default 3000
 *
 * `pg` is passed in by the service: this package is linked with `file:` and has
 * no node_modules of its own, so it must not require it.
 */

const OID_INT8 = 20;
const OID_DATE = 1082;
const OID_TIMESTAMP = 1114;
const OID_TIMESTAMPTZ = 1184;

const TIMESTAMP_RE = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.(\d+))?/;

/**
 * `timestamp without time zone` wire text -> ISO-8601 UTC-shaped string. The stored
 * wall-clock value is kept verbatim (no timezone arithmetic), which is what the API
 * emitted before persistence existed.
 */
function toIsoTimestamp(raw) {
  if (raw === null || raw === undefined) return null;
  const text = String(raw);
  const m = TIMESTAMP_RE.exec(text);
  if (!m) return text;
  const millis = (m[3] ?? '').padEnd(3, '0').slice(0, 3);
  return `${m[1]}T${m[2]}.${millis}Z`;
}

/** `date` wire text (`YYYY-MM-DD`) passed through unchanged. */
function toDateOnly(raw) {
  if (raw === null || raw === undefined) return null;
  return String(raw).slice(0, 10);
}

function buildConnectionString() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const host = process.env.POSTGRES_HOST ?? 'localhost';
  const port = process.env.POSTGRES_PORT ?? '5432';
  const user = process.env.POSTGRES_USER ?? 'postgres';
  const password = process.env.POSTGRES_PASSWORD ?? 'postgres';
  const database = process.env.POSTGRES_DB ?? 'faceattend_db';
  return `postgres://${user}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

/**
 * The schema name goes into the connection's `search_path` startup option, so it is
 * restricted to a bare SQL identifier even though it comes from configuration.
 */
function sanitiseSchema(raw, fallback) {
  const candidate = (raw ?? fallback).trim();
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(candidate) ? candidate : fallback;
}

/** Redacted connection string, safe for logs and /health. */
function redact(connectionString) {
  return connectionString.replace(/\/\/([^:/@]+):([^@]*)@/, '//$1:***@');
}

/**
 * Builds the database module of one service.
 * @param {{ pg: typeof import('pg'), defaultSchema: string }} options
 */
function createDatabase({ pg, defaultSchema }) {
  // Raw wire text instead of Date objects (timezone shift) and strings for int8.
  pg.types.setTypeParser(OID_INT8, (value) => (value === null ? null : Number(value)));
  pg.types.setTypeParser(OID_DATE, (value) => toDateOnly(value));
  pg.types.setTypeParser(OID_TIMESTAMP, (value) => toIsoTimestamp(value));
  pg.types.setTypeParser(OID_TIMESTAMPTZ, (value) => (value === null ? null : new Date(value).toISOString()));

  let pool = null;
  let config = null;
  let connectedAt = null;
  let lastError = null;

  function buildConfig() {
    const sslMode = (process.env.DB_SSL_MODE ?? 'disable').toLowerCase();
    return {
      connectionString: buildConnectionString(),
      schema: sanitiseSchema(process.env.PG_SCHEMA, defaultSchema),
      max: Number(process.env.DB_POOL_MAX ?? 25),
      statementTimeoutMs: Number(process.env.DB_STATEMENT_TIMEOUT_MS ?? 15000),
      ssl: sslMode === 'disable' ? false : { rejectUnauthorized: sslMode === 'verify-full' },
    };
  }

  function getPool() {
    if (pool) return pool;
    config = buildConfig();
    pool = new pg.Pool({
      connectionString: config.connectionString,
      max: config.max,
      statement_timeout: config.statementTimeoutMs,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      ssl: config.ssl,
      // The service schema first so unqualified objects still resolve; repositories
      // nonetheless always schema-qualify their tables.
      options: `-c search_path=${config.schema},public`,
    });
    pool.on('error', (err) => {
      lastError = err.message;
    });
    return pool;
  }

  /** Verifies connectivity, retrying with a fixed delay (compose does not wait for Liquibase). */
  async function connectDatabase(opts) {
    const retries = opts?.retries ?? Number(process.env.DB_CONNECT_RETRIES ?? 10);
    const retryDelayMs = opts?.retryDelayMs ?? Number(process.env.DB_CONNECT_RETRY_DELAY_MS ?? 3000);
    const p = getPool();
    for (let attempt = 0; ; attempt += 1) {
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
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }
    }
  }

  async function closeDatabase() {
    const current = pool;
    pool = null;
    config = null;
    connectedAt = null;
    if (current) await current.end();
  }

  function isDatabaseConnected() {
    return pool !== null && connectedAt !== null && lastError === null;
  }

  function getDatabaseStatus() {
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
  async function runQuery(sql, params = []) {
    const result = await getPool().query(sql, params);
    return result.rows;
  }

  /** INSERT/UPDATE/DELETE where only the affected row count matters. */
  async function runCommand(sql, params = []) {
    const result = await getPool().query(sql, params);
    return result.rowCount ?? 0;
  }

  /** Runs `fn` inside one transaction, rolling back on any throw. */
  async function withTransaction(fn) {
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
  async function healthCheck() {
    const started = Date.now();
    try {
      await runQuery('SELECT 1 AS ok');
      connectedAt = connectedAt ?? Date.now();
      lastError = null;
      return { ok: true, latencyMs: Date.now() - started, error: null };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      connectedAt = null;
      return { ok: false, latencyMs: Date.now() - started, error: lastError };
    }
  }

  return {
    getPool,
    connectDatabase,
    closeDatabase,
    isDatabaseConnected,
    getDatabaseStatus,
    runQuery,
    runCommand,
    withTransaction,
    healthCheck,
  };
}

module.exports = { createDatabase, toIsoTimestamp, toDateOnly, sanitiseSchema, redact };
