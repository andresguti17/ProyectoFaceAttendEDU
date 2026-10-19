import type { FieldSpec } from './crud.repository';

/**
 * Audit block shared by every table in the `notification` schema
 * (`created_at, updated_at, deleted_at, created_by, updated_by, deleted_by, row_version`).
 *
 * All six selected columns are declared `writable: false`: the
 * `fn_audit_timestamps()` BEFORE INSERT OR UPDATE trigger owns `created_at`,
 * `updated_at` and `row_version`, and `deleted_at` / `deleted_by` are written
 * exclusively by `PostgresCrudRepository.softDelete()`. `created_by` and
 * `updated_by` are stamped by the application layer, never by the request body.
 * `row_version` is intentionally not mapped here; it is handled by the
 * optimistic-locking path.
 */
export const AUDIT_FIELDS: readonly FieldSpec[] = [
  { field: 'createdAt', column: 'created_at', writable: false },
  { field: 'updatedAt', column: 'updated_at', writable: false },
  { field: 'deletedAt', column: 'deleted_at', writable: false },
  { field: 'createdBy', column: 'created_by', writable: false },
  { field: 'updatedBy', column: 'updated_by', writable: false },
  { field: 'deletedBy', column: 'deleted_by', writable: false },
];
