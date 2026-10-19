import type { Cohort } from '../../../domain/entities/Cohort';
import type { ICohortRepository } from '../../../domain/ports/out/ICohortRepository';
import type { PageOptions } from '../../../domain/ports/out/ICrudRepository';
import { PostgresCrudRepository, type FieldSpec } from './crud.repository';
import { AUDIT_FIELDS } from './audit.fields';

/**
 * PostgreSQL adapter for `academic.cohort`.
 * `cohort_id` is BIGINT; the int8 parser in `db/database.ts` turns it into a JSON
 * number so the response shape matches the previous in-memory implementation.
 * Both `program_id` and `academic_period_id` are NOT NULL FKs (ON DELETE CASCADE).
 */
export class PostgresCohortRepository extends PostgresCrudRepository<Cohort> implements ICohortRepository {
  protected readonly qualifiedTable = 'academic.cohort';
  protected readonly primaryKeyColumn = 'cohort_id';
  protected readonly primaryKeyField = 'cohortId';
  protected readonly fields: readonly FieldSpec[] = [
    { field: 'cohortId', column: 'cohort_id', writable: false },
    { field: 'programId', column: 'program_id' },
    { field: 'academicPeriodId', column: 'academic_period_id' },
    { field: 'code', column: 'code' },
    { field: 'status', column: 'status' },
    ...AUDIT_FIELDS,
  ];

  findByProgram(programId: number, page?: PageOptions): Promise<Cohort[]> {
    return this.listWhere([this.filterOn('programId', programId)], page);
  }

  countByProgram(programId: number): Promise<number> {
    return this.countWhere([this.filterOn('programId', programId)]);
  }
}
