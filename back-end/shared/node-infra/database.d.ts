// No `pg` import here: this package is linked with `file:` and has no node_modules,
// so the pool and its clients are typed structurally (`any` where pg's own types live).

/** The parts of the `pg` module this package uses. */
export interface PgModule {
  Pool: new (config?: any) => any;
  types: { setTypeParser(oid: number, parser: (value: string) => unknown): void };
}

export interface DatabaseStatus {
  connected: boolean;
  schema: string;
  connectionString: string;
  poolTotal: number;
  poolIdle: number;
  poolWaiting: number;
  connectedAt: string | null;
  lastError: string | null;
}

export interface Database {
  getPool(): any;
  connectDatabase(opts?: { retries?: number; retryDelayMs?: number }): Promise<void>;
  closeDatabase(): Promise<void>;
  isDatabaseConnected(): boolean;
  getDatabaseStatus(): DatabaseStatus;
  runQuery<T extends Record<string, any> = Record<string, any>>(sql: string, params?: readonly unknown[]): Promise<T[]>;
  runCommand(sql: string, params?: readonly unknown[]): Promise<number>;
  withTransaction<T>(fn: (client: any) => Promise<T>): Promise<T>;
  healthCheck(): Promise<{ ok: boolean; latencyMs: number; error: string | null }>;
}

export function createDatabase(options: { pg: PgModule; defaultSchema: string }): Database;
export function toIsoTimestamp(raw: unknown): string | null;
export function toDateOnly(raw: unknown): string | null;
export function sanitiseSchema(raw: string | undefined, fallback: string): string;
export function redact(connectionString: string): string;
