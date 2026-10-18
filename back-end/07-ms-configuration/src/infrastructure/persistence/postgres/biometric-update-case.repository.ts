import type { BiometricUpdateCase } from '../../../domain/entities/BiometricUpdateCase';
import { PostgresCrudRepository, type FieldSpec, toInt } from './crud.repository';
import { AUDIT_FIELDS } from './audit.fields';

/**
 * PostgreSQL adapter for `configuration.biometric_update_case`.
 *
 * Logical owner is Biometric; the table is physically hosted in the
 * `configuration` schema (documented debt). The primary key is a UUID with no
 * database default, so `caseId` is writable and the caller generates it.
 */
export class PostgresBiometricUpdateCaseRepository extends PostgresCrudRepository<BiometricUpdateCase> {
  protected readonly qualifiedTable = 'configuration.biometric_update_case';
  protected readonly primaryKeyColumn = 'case_id';
  protected readonly primaryKeyField = 'caseId';
  protected readonly primaryKeyCast = 'uuid';
  protected readonly fields: readonly FieldSpec[] = [
    { field: 'caseId', column: 'case_id' },
    { field: 'personId', column: 'person_id', cast: 'uuid' },
    { field: 'biometricType', column: 'biometric_type', cast: 'configuration.biometric_type' },
    { field: 'fingerNumber', column: 'finger_number', fromRow: toInt },
    { field: 'currentEmbeddingRef', column: 'current_embedding_ref' },
    { field: 'reason', column: 'reason' },
    { field: 'updateStatus', column: 'update_status', cast: 'configuration.update_status' },
    { field: 'requestedBy', column: 'requested_by', cast: 'uuid' },
    { field: 'requestedAt', column: 'requested_at' },
    { field: 'reviewedBy', column: 'reviewed_by', cast: 'uuid' },
    { field: 'reviewedAt', column: 'reviewed_at' },
    { field: 'resolutionNotes', column: 'resolution_notes' },
    ...AUDIT_FIELDS,
  ];

  search(query: { status?: string; personId?: string; personIds?: readonly string[]; limit?: number; offset?: number } = {}) {
    return this.list({ filters: this.filtersFor(query), limit: query.limit, offset: query.offset });
  }

  countMatching(query: { status?: string; personId?: string; personIds?: readonly string[] } = {}) {
    return this.count({ filters: this.filtersFor(query) });
  }

  private filtersFor(query: { status?: string; personId?: string; personIds?: readonly string[] }) {
    return [
      ...(query.status !== undefined ? [this.filterOn('updateStatus', query.status)] : []),
      ...(query.personId !== undefined ? [this.filterOn('personId', query.personId)] : []),
      // School-scoped reviewer: restrict to a set of persons instead of one.
      ...(query.personIds !== undefined ? [{ ...this.filterOn('personId', query.personIds), op: 'in' as const }] : []),
    ];
  }
}
