import type { FieldSpec } from './crud.repository';

/**
 * Audit block shared by every table in the `academic` schema
 * (`created_at, updated_at, deleted_at, created_by, updated_by, deleted_by, row_version`).
 *
 * Only the three columns the API already exposed are selected. All are declared
 * `writable: false`: the `fn_audit_timestamps()` BEFORE INSERT OR UPDATE trigger
 * owns `created_at`, `updated_at` and `row_version`, and `deleted_at` is written
 * exclusively by `PostgresCrudRepository.softDelete()`.
 */
export const AUDIT_FIELDS: readonly FieldSpec[] = [
  { field: 'createdAt', column: 'created_at', writable: false },
  { field: 'updatedAt', column: 'updated_at', writable: false },
  { field: 'deletedAt', column: 'deleted_at', writable: false },
];
