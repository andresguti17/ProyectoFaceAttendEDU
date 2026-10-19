import type { SecurityConfiguration } from '../../../domain/entities/SecurityConfiguration';
import { PostgresCrudRepository, type FieldSpec } from './crud.repository';
import { AUDIT_FIELDS } from './audit.fields';

/** PostgreSQL adapter for `configuration.security_configuration` (name is globally unique). */
export class PostgresSecurityConfigurationRepository extends PostgresCrudRepository<SecurityConfiguration> {
  protected readonly qualifiedTable = 'configuration.security_configuration';
  protected readonly primaryKeyColumn = 'configuration_id';
  protected readonly primaryKeyField = 'configurationId';
  protected readonly fields: readonly FieldSpec[] = [
    { field: 'configurationId', column: 'configuration_id', writable: false },
    { field: 'configurationName', column: 'configuration_name' },
    { field: 'configurationValue', column: 'configuration_value' },
    { field: 'description', column: 'description' },
    ...AUDIT_FIELDS,
  ];

  search(query: { name?: string; limit?: number; offset?: number } = {}) {
    return this.list({ filters: this.filtersFor(query), limit: query.limit, offset: query.offset });
  }

  countMatching(query: { name?: string } = {}) {
    return this.count({ filters: this.filtersFor(query) });
  }

  private filtersFor(query: { name?: string }) {
    return query.name !== undefined ? [this.filterOn('configurationName', query.name)] : [];
  }
}
