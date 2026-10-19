/**
 * Generic PostgreSQL CRUD adapter — 03-ms-academic.
 *
 * Holds every statement the concrete repositories issue, so the SQL lives in one
 * audited place and each aggregate adapter only declares its table, its column
 * map and its row->JSON projection.
 *
 * Injection safety (OWASP A03):
 *   - **values** always travel as bind parameters (`$1`, `$2`, ...);
 *   - **identifiers** (table, columns, ORDER BY) come exclusively from the
 *     static `FieldSpec` whitelist declared in code. Nothing from a request body,
 *     query string or path parameter is ever concatenated into SQL text.
 *
 * Audit columns (`created_at`, `updated_at`, `deleted_at`, `row_version`) are
 * declared read-only (`writable: false`) — the `fn_audit_timestamps()` BEFORE
 * INSERT OR UPDATE trigger owns them, so this layer never writes them.
 *
 * Soft delete: every read filters `deleted_at IS NULL`; `softDelete()` stamps
 * `deleted_at` and never issues a physical DELETE.
 */

import { runCommand, runQuery } from '../../db/database';
import { RepositoryError, translateDbError } from '../errors';

export type Row = Record<string, unknown>;
export type JsonRecord = Record<string, unknown>;

/** One API field <-> one database column. */
export interface FieldSpec {
  /** camelCase key emitted in the JSON response. */
  readonly field: string;
  /** snake_case column in PostgreSQL. */
  readonly column: string;
  /**
   * Explicit cast appended to the bind parameter on writes, required for native
   * enum columns because PostgreSQL cannot infer the target type from `$n`
   * alone — e.g. `'academic.enrollment_status'`.
   */
  readonly cast?: string;
  /** `false` for primary keys and audit columns (never written by this layer). */
  readonly writable?: boolean;
  /** API value -> PostgreSQL parameter. */
  readonly toParam?: (value: unknown) => unknown;
  /** PostgreSQL value -> API value. */
  readonly fromRow?: (value: unknown) => unknown;
}

export interface ColumnFilter {
  readonly column: string;
  readonly value: unknown;
  readonly cast?: string;
}

export interface ListQuery {
  readonly filters?: readonly ColumnFilter[];
  readonly limit?: number;
  readonly offset?: number;
}

export abstract class PostgresCrudRepository<T extends object> {
  /** Schema-qualified table, e.g. `'academic.school'`. Static code only. */
  protected abstract readonly qualifiedTable: string;
  /** Primary key column, e.g. `'school_id'`. */
  protected abstract readonly primaryKeyColumn: string;
  /** Primary key JSON field, e.g. `'schoolId'`. */
  protected abstract readonly primaryKeyField: string;
  /** Complete column map, in JSON key order. */
  protected abstract readonly fields: readonly FieldSpec[];
  /** Optional cast for the primary key bind parameter. */
  protected readonly primaryKeyCast: string | undefined = undefined;

  // ── SQL fragments (identifiers from the static whitelist only) ──────────

  private get selectColumns(): string {
    return this.fields.map((f) => f.column).join(', ');
  }

  /**
   * Resolves a JSON field name to its whitelisted column name. Subclasses must
   * build filters through this so no identifier can ever originate outside the
   * static `fields` declaration.
   */
  protected columnOf(field: string): string {
    const spec = this.fields.find((f) => f.field === field);
    if (!spec) throw new Error(`${this.qualifiedTable}: unmapped field '${field}'`);
    return spec.column;
  }

  /** Cast declared for a JSON field, if the column is a native enum. */
  protected castOf(field: string): string | undefined {
    return this.fields.find((f) => f.field === field)?.cast;
  }

  /** Deterministic ordering; the identity primary key doubles as insert order. */
  private get orderByClause(): string {
    return `${this.primaryKeyColumn} ASC`;
  }

  private pkPlaceholder(index: number): string {
    return `$${index}${this.primaryKeyCast ? `::${this.primaryKeyCast}` : ''}`;
  }

  private buildFilters(
    filters: readonly ColumnFilter[] | undefined,
    startIndex: number,
  ): { clause: string; params: unknown[] } {
    const params: unknown[] = [];
    if (!filters || filters.length === 0) return { clause: '', params };
    let index = startIndex;
    const parts = filters.map((filter) => {
      // Defence in depth: every column used as an SQL identifier must appear in
      // the static whitelist, even though filters are only built via filterOn().
      if (!this.fields.some((f) => f.column === filter.column)) {
        throw new RepositoryError(500, 'InternalError', `Unmapped filter column for ${this.qualifiedTable}`);
      }
      params.push(filter.value);
      const cast = filter.cast ? `::${filter.cast}` : '';
      return `${filter.column} = $${index++}${cast}`;
    });
    return { clause: ` AND ${parts.join(' AND ')}`, params };
  }

  /** Builds a filter from a whitelisted JSON field name, carrying its enum cast. */
  protected filterOn(field: string, value: unknown): ColumnFilter {
    return { column: this.columnOf(field), value, cast: this.castOf(field) };
  }

  // ── Row projection ──────────────────────────────────────────────────────

  protected mapRow(row: Row): T {
    const out: JsonRecord = {};
    for (const f of this.fields) {
      const raw = row[f.column];
      out[f.field] = f.fromRow ? f.fromRow(raw) : (raw ?? null);
    }
    // `T` is a declared interface (no index signature), so the projection has to
    // be bridged through `unknown`. Every key comes from the static field map.
    return out as unknown as T;
  }

  // ── Execution helpers ───────────────────────────────────────────────────

  protected async select<R extends Row>(sql: string, params: readonly unknown[]): Promise<R[]> {
    try {
      return await runQuery<R>(sql, params);
    } catch (err) {
      throw translateDbError(err, this.qualifiedTable);
    }
  }

  protected async execute(sql: string, params: readonly unknown[]): Promise<number> {
    try {
      return await runCommand(sql, params);
    } catch (err) {
      throw translateDbError(err, this.qualifiedTable);
    }
  }

  // ── Reads ───────────────────────────────────────────────────────────────

  async list(query: ListQuery = {}): Promise<T[]> {
    const { clause, params } = this.buildFilters(query.filters, 1);
    let sql = `SELECT ${this.selectColumns} FROM ${this.qualifiedTable} WHERE deleted_at IS NULL${clause} ORDER BY ${this.orderByClause}`;
    let index = params.length + 1;
    if (query.limit !== undefined) {
      sql += ` LIMIT $${index++}`;
      params.push(query.limit);
    }
    if (query.offset !== undefined) {
      sql += ` OFFSET $${index}`;
      params.push(query.offset);
    }
    const rows = await this.select<Row>(sql, params);
    return rows.map((row) => this.mapRow(row));
  }

  /** Total matching rows, ignoring LIMIT/OFFSET — backs the `x-total-count` header. */
  async count(query: ListQuery = {}): Promise<number> {
    const { clause, params } = this.buildFilters(query.filters, 1);
    const rows = await this.select<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM ${this.qualifiedTable} WHERE deleted_at IS NULL${clause}`,
      params,
    );
    return Number(rows[0]?.total ?? 0);
  }

  async findById(id: unknown): Promise<T | null> {
    const rows = await this.select<Row>(
      `SELECT ${this.selectColumns} FROM ${this.qualifiedTable} WHERE ${this.primaryKeyColumn} = ${this.pkPlaceholder(1)} AND deleted_at IS NULL`,
      [id],
    );
    return rows.length > 0 ? this.mapRow(rows[0]) : null;
  }

  async existsById(id: unknown): Promise<boolean> {
    const rows = await this.select<{ found: boolean }>(
      `SELECT EXISTS(SELECT 1 FROM ${this.qualifiedTable} WHERE ${this.primaryKeyColumn} = ${this.pkPlaceholder(1)} AND deleted_at IS NULL) AS found`,
      [id],
    );
    return rows[0]?.found === true;
  }

  // ── Writes ──────────────────────────────────────────────────────────────

  /**
   * INSERT ... RETURNING. Only whitelisted, writable fields present in `input`
   * are written; `created_at` / `updated_at` / `row_version` are left to the
   * database trigger.
   */
  async create(input: JsonRecord): Promise<T> {
    const columns: string[] = [];
    const placeholders: string[] = [];
    const params: unknown[] = [];

    for (const f of this.fields) {
      if (f.writable === false) continue;
      if (!(f.field in input) || input[f.field] === undefined) continue;
      columns.push(f.column);
      params.push(f.toParam ? f.toParam(input[f.field]) : input[f.field]);
      placeholders.push(`$${params.length}${f.cast ? `::${f.cast}` : ''}`);
    }

    if (columns.length === 0) {
      throw new RepositoryError(400, 'BadRequest', `No writable fields supplied for ${this.qualifiedTable}`);
    }

    const rows = await this.select<Row>(
      `INSERT INTO ${this.qualifiedTable} (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING ${this.selectColumns}`,
      params,
    );
    return this.mapRow(rows[0]);
  }

  /**
   * Partial UPDATE ... RETURNING, restricted to non-deleted rows.
   * Returns `null` when the row does not exist so callers can answer 404.
   * An empty patch is a no-op read: no statement is issued and no audit column moves.
   */
  async update(id: unknown, patch: JsonRecord): Promise<T | null> {
    const sets: string[] = [];
    const params: unknown[] = [];

    for (const f of this.fields) {
      if (f.writable === false) continue;
      if (!(f.field in patch) || patch[f.field] === undefined) continue;
      params.push(f.toParam ? f.toParam(patch[f.field]) : patch[f.field]);
      sets.push(`${f.column} = $${params.length}${f.cast ? `::${f.cast}` : ''}`);
    }

    params.push(id);
    const where = `WHERE ${this.primaryKeyColumn} = ${this.pkPlaceholder(params.length)} AND deleted_at IS NULL`;

    const sql =
      sets.length > 0
        ? `UPDATE ${this.qualifiedTable} SET ${sets.join(', ')} ${where} RETURNING ${this.selectColumns}`
        : `SELECT ${this.selectColumns} FROM ${this.qualifiedTable} ${where}`;

    const rows = await this.select<Row>(sql, params);
    return rows.length > 0 ? this.mapRow(rows[0]) : null;
  }

  /** Soft delete: stamps `deleted_at` (the trigger owns `updated_at`/`row_version`). */
  async softDelete(id: unknown): Promise<boolean> {
    const affected = await this.execute(
      `UPDATE ${this.qualifiedTable} SET deleted_at = NOW() WHERE ${this.primaryKeyColumn} = ${this.pkPlaceholder(1)} AND deleted_at IS NULL`,
      [id],
    );
    return affected > 0;
  }

  // ── Helpers for the per-aggregate finders declared by the domain ports ───

  protected listWhere(filters: readonly ColumnFilter[], page?: { limit?: number; offset?: number }): Promise<T[]> {
    return this.list({ filters, limit: page?.limit, offset: page?.offset });
  }

  protected countWhere(filters: readonly ColumnFilter[]): Promise<number> {
    return this.count({ filters });
  }
}

// ── Shared value coercion ──────────────────────────────────────────────────

/** BIGINT/INT columns arrive as numbers (see db/database.ts parsers). */
export function toInt(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * `academic.school.city_id` is VARCHAR(100) in PostgreSQL while the API contract
 * exposes `cityId` as a number. Written as text, read back as a number.
 */
export function intToText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return String(value);
}

/** `date` columns: pass the `YYYY-MM-DD` wire text straight through. */
export function dateParam(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  return String(value).slice(0, 10);
}

/** Smallint/int columns: reject anything that is not a finite number. */
export function numberParam(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}
