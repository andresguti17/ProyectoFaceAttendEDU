/**
 * Shared persistence port shape — 03-ms-academic.
 *
 * Hexagonal "driven" (out) port: the application/HTTP layer depends on this
 * abstraction only; `infrastructure/persistence/postgres/*` provides the adapter.
 */

/** LIMIT/OFFSET paging. Omit both to fetch every matching row. */
export interface PageOptions {
  limit?: number;
  offset?: number;
}

/**
 * Uniform CRUD contract for one aggregate.
 *
 * - `TRecord` is the persisted, fully-populated shape returned to the API.
 * - `TDraft` is the writable subset accepted on create (no primary key, no audit
 *   columns — the database owns those).
 *
 * Soft delete semantics: reads never return rows whose `deleted_at` is set, and
 * `softDelete` only stamps `deleted_at`.
 */
export interface ICrudRepository<TRecord, TId, TDraft> {
  list(page?: PageOptions): Promise<TRecord[]>;
  count(): Promise<number>;
  findById(id: TId): Promise<TRecord | null>;
  existsById(id: TId): Promise<boolean>;
  create(draft: TDraft): Promise<TRecord>;
  update(id: TId, patch: Partial<TDraft>): Promise<TRecord | null>;
  softDelete(id: TId): Promise<boolean>;
}

/** Audit columns owned by the `fn_audit_timestamps()` trigger. */
export type AuditFields = 'createdAt' | 'updatedAt' | 'deletedAt';

/** Strips the primary key and the trigger-owned audit columns from a record. */
export type Draft<TRecord, TIdField extends keyof TRecord> = Omit<
  TRecord,
  TIdField | AuditFields | 'rowVersion'
>;
