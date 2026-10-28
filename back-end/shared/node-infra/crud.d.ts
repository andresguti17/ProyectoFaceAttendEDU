export type Row = Record<string, unknown>;
export type JsonRecord = Record<string, unknown>;

/** One API field <-> one database column. */
export interface FieldSpec {
  /** camelCase key emitted in the JSON response. */
  readonly field: string;
  /** snake_case column in PostgreSQL. */
  readonly column: string;
  /** Explicit cast for native enum columns (PostgreSQL cannot infer it from `$n`). */
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
  /** `'eq'` (default) binds a single value; `'in'` binds an array via `= ANY($n)`. */
  readonly op?: 'eq' | 'in';
}

export interface ListQuery {
  readonly filters?: readonly ColumnFilter[];
  readonly limit?: number;
  readonly offset?: number;
}

export interface Page {
  readonly limit?: number;
  readonly offset?: number;
}

export declare abstract class PostgresCrudRepositoryBase<T extends object> {
  /** Schema-qualified table, e.g. `'academic.school'`. Static code only. */
  protected abstract readonly qualifiedTable: string;
  /** Primary key column, e.g. `'school_id'`. */
  protected abstract readonly primaryKeyColumn: string;
  /** Primary key JSON field, e.g. `'schoolId'`. */
  protected abstract readonly primaryKeyField: string;
  /** Complete column map, in JSON key order. */
  protected abstract readonly fields: readonly FieldSpec[];
  /** Optional cast for the primary key bind parameter. */
  protected readonly primaryKeyCast: string | undefined;

  protected columnOf(field: string): string;
  protected castOf(field: string): string | undefined;
  protected filterOn(field: string, value: unknown): ColumnFilter;
  protected mapRow(row: Row): T;
  protected select<R extends Row>(sql: string, params: readonly unknown[]): Promise<R[]>;
  protected execute(sql: string, params: readonly unknown[]): Promise<number>;

  list(query?: ListQuery): Promise<T[]>;
  count(query?: ListQuery): Promise<number>;
  findById(id: unknown): Promise<T | null>;
  existsById(id: unknown): Promise<boolean>;
  create(input: JsonRecord): Promise<T>;
  update(id: unknown, patch: JsonRecord): Promise<T | null>;
  softDelete(id: unknown): Promise<boolean>;

  protected listWhere(filters: readonly ColumnFilter[], page?: Page): Promise<T[]>;
  protected countWhere(filters: readonly ColumnFilter[]): Promise<number>;
  protected listInSubquery(field: string, subquery: string, subParams: readonly unknown[], page?: Page): Promise<T[]>;
  protected countInSubquery(field: string, subquery: string, subParams: readonly unknown[]): Promise<number>;
}

export interface QueryRunner {
  runQuery(sql: string, params?: readonly unknown[]): Promise<Row[]>;
  runCommand(sql: string, params?: readonly unknown[]): Promise<number>;
}

export function definePostgresCrudRepository(db: QueryRunner): typeof PostgresCrudRepositoryBase;
export function toInt(value: unknown): number | null;
export function intToText(value: unknown): string | null;
export function dateParam(value: unknown): string | null;
export function numberParam(value: unknown): number | null;
