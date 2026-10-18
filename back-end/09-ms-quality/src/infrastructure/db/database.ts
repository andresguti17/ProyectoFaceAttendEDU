import { Pool, types } from 'pg';
import type { PoolClient, QueryResultRow } from 'pg';

// Host runs also read the repo-root .env, so one file governs Docker and
// workstation runs alike; in Docker compose injects the environment and the
// file is absent, so this is a no-op there. Runs before the module-level
// `resolveDatabaseConfig()` below snapshots `process.env`.
try {
  (process as unknown as { loadEnvFile?: (file: string) => void }).loadEnvFile?.('../../.env');
} catch {
  /* no root .env */
}

/**
 * Singleton de acceso a PostgreSQL para `09-ms-quality` (esquema `quality`).
 *
 * Patrón idéntico al de los servicios hermanos: un único `Pool` por proceso,
 * apertura perezosa en `connectDatabase()` y cierre en `closeDatabase()`.
 *
 * Resolución de configuración (en orden de prioridad):
 *  1. `DATABASE_URL`  — lo que inyecta `back-end/docker-compose.yml` al contenedor.
 *  2. `POSTGRES_HOST` / `POSTGRES_PORT` / `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB`.
 * Esquema: `DB_SCHEMA` → `PG_SCHEMA` → `quality`.
 */

/** OID de los tipos de PostgreSQL cuya representación por defecto de `pg` no nos sirve. */
const OID_INT8 = 20; // BIGSERIAL / BIGINT   → pg devuelve string
const OID_NUMERIC = 1700; // DECIMAL / NUMERIC → pg devuelve string
const OID_TIMESTAMP = 1114; // TIMESTAMP (sin zona) → pg devuelve Date interpretado en zona local

// `pg` devuelve int8/numeric como string y parsea `timestamp without time zone`
// como un Date en la zona horaria LOCAL del proceso (no UTC), lo que desplazaría
// los ISO strings que la API ya emite. Se normaliza aquí:
//  - int8/numeric → number (ids y puntajes siempre dentro del rango seguro de JS)
//  - timestamp    → cadena cruda de PostgreSQL; `toIsoTimestamp()` la convierte a ISO-8601 UTC.
types.setTypeParser(OID_INT8, (value: string) => Number(value));
types.setTypeParser(OID_NUMERIC, (value: string) => Number(value));
types.setTypeParser(OID_TIMESTAMP, (value: string) => value);

/** Un nombre de esquema/identificador seguro: solo letras, dígitos y guion bajo. */
const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

export interface DatabaseConfig {
  connectionString?: string;
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  schema: string;
  max: number;
}

export function resolveDatabaseConfig(env: NodeJS.ProcessEnv = process.env): DatabaseConfig {
  const requestedSchema = env.DB_SCHEMA || env.PG_SCHEMA || 'quality';
  // El esquema proviene de una variable de entorno y se interpola en `search_path`;
  // se valida contra una lista de caracteres segura en lugar de confiar en ella.
  const schema = IDENTIFIER_PATTERN.test(requestedSchema) ? requestedSchema : 'quality';
  return {
    connectionString: env.DATABASE_URL || undefined,
    host: env.POSTGRES_HOST || 'localhost',
    port: Number(env.POSTGRES_PORT) || 5432,
    user: env.POSTGRES_USER || 'postgres',
    password: env.POSTGRES_PASSWORD || 'postgres',
    database: env.POSTGRES_DB || 'faceattend_db',
    schema,
    max: Number(env.POSTGRES_POOL_MAX) || 25,
  };
}

let pool: Pool | null = null;
let config: DatabaseConfig = resolveDatabaseConfig();

/** Devuelve el `Pool` del proceso, creándolo si aún no existe. */
export function getPool(): Pool {
  if (!pool) {
    config = resolveDatabaseConfig();
    pool = new Pool({
      ...(config.connectionString
        ? { connectionString: config.connectionString }
        : {
            host: config.host,
            port: config.port,
            user: config.user,
            password: config.password,
            database: config.database,
          }),
      max: config.max,
      // Todo el SQL de los repositorios va calificado con `quality.`; el search_path
      // se fija igualmente para que los casts a tipos nativos (`::quality.objective_rating`)
      // y cualquier referencia no calificada resuelvan de forma determinista.
      options: `-c search_path=${config.schema},public`,
    });
  }
  return pool;
}

/** Esquema PostgreSQL que usa este servicio (`quality` por defecto). */
export function getSchema(): string {
  return config.schema;
}

/** Abre el pool y valida la conectividad con la base de datos. */
export async function connectDatabase(): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query('SELECT 1');
  } finally {
    client.release();
  }
}

/** Cierra el pool. Idempotente: seguro en `SIGTERM`/`SIGINT`. */
export async function closeDatabase(): Promise<void> {
  const current = pool;
  pool = null;
  if (current) await current.end();
}

/** Ejecuta una consulta parametrizada ($1, $2, ...) y devuelve sus filas. */
export async function runQuery<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: readonly unknown[] = [],
): Promise<T[]> {
  const result = await getPool().query<T>(sql, params as unknown[]);
  return result.rows;
}

/** Igual que `runQuery`, pero sobre una conexión ya abierta (transacciones). */
export async function runQueryWith<T extends QueryResultRow = QueryResultRow>(
  client: PoolClient,
  sql: string,
  params: readonly unknown[] = [],
): Promise<T[]> {
  const result = await client.query<T>(sql, params as unknown[]);
  return result.rows;
}

/**
 * Ejecuta `fn` dentro de una transacción. Cualquier error provoca ROLLBACK
 * (las escrituras multi-tabla de los repositorios son atómicas).
 */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export interface DatabaseHealth {
  status: 'up' | 'down';
  schema: string;
  error?: string;
}

/** Sonda de salud: `SELECT 1` con timeout corto para no bloquear `/health`. */
export async function healthCheck(timeoutMs = 2000): Promise<DatabaseHealth> {
  const schema = getSchema();
  let client: PoolClient | null = null;
  try {
    client = await getPool().connect();
    await Promise.race([
      client.query('SELECT 1'),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`database health check timed out after ${timeoutMs}ms`)), timeoutMs),
      ),
    ]);
    return { status: 'up', schema };
  } catch (error) {
    return { status: 'down', schema, error: (error as Error).message };
  } finally {
    if (client) client.release();
  }
}
