import type { AcademicConfiguration } from '../../../domain/entities/AcademicConfiguration';
import { PostgresCrudRepository, type FieldSpec, toInt } from './crud.repository';
import { AUDIT_FIELDS } from './audit.fields';

/** PostgreSQL adapter for `configuration.academic_configuration` (unique per school + name). */
export class PostgresAcademicConfigurationRepository extends PostgresCrudRepository<AcademicConfiguration> {
  protected readonly qualifiedTable = 'configuration.academic_configuration';
  protected readonly primaryKeyColumn = 'configuration_id';
  protected readonly primaryKeyField = 'configurationId';
  protected readonly fields: readonly FieldSpec[] = [
    { field: 'configurationId', column: 'configuration_id', writable: false },
    { field: 'schoolId', column: 'school_id', fromRow: toInt },
    { field: 'configurationName', column: 'configuration_name' },
    { field: 'configurationValue', column: 'configuration_value' },
    { field: 'description', column: 'description' },
    ...AUDIT_FIELDS,
  ];

  search(query: { name?: string; schoolId?: number; limit?: number; offset?: number } = {}) {
    return this.list({ filters: this.filtersFor(query), limit: query.limit, offset: query.offset });
  }

  countMatching(query: { name?: string; schoolId?: number } = {}) {
    return this.count({ filters: this.filtersFor(query) });
  }

  private filtersFor(query: { name?: string; schoolId?: number }) {
    return [
      ...(query.name !== undefined ? [this.filterOn('configurationName', query.name)] : []),
      ...(query.schoolId !== undefined ? [this.filterOn('schoolId', query.schoolId)] : []),
    ];
  }
}
