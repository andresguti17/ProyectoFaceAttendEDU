import type { Program } from '../../../domain/entities/Program';
import type { IProgramRepository } from '../../../domain/ports/out/IProgramRepository';
import type { PageOptions } from '../../../domain/ports/out/ICrudRepository';
import { PostgresCrudRepository, type FieldSpec } from './crud.repository';
import { AUDIT_FIELDS } from './audit.fields';

/**
 * PostgreSQL adapter for `academic.program`.
 * `school_id` is a real FK to `academic.school` (ON DELETE CASCADE); a dangling
 * reference surfaces as InvalidReferenceError -> HTTP 400, never a 500.
 */
export class PostgresProgramRepository extends PostgresCrudRepository<Program> implements IProgramRepository {
  protected readonly qualifiedTable = 'academic.program';
  protected readonly primaryKeyColumn = 'program_id';
  protected readonly primaryKeyField = 'programId';
  protected readonly fields: readonly FieldSpec[] = [
    { field: 'programId', column: 'program_id', writable: false },
    { field: 'schoolId', column: 'school_id' },
    { field: 'code', column: 'code' },
    { field: 'name', column: 'name' },
    { field: 'status', column: 'status' },
    ...AUDIT_FIELDS,
  ];

  findBySchool(schoolId: number, page?: PageOptions): Promise<Program[]> {
    return this.listWhere([this.filterOn('schoolId', schoolId)], page);
  }

  countBySchool(schoolId: number): Promise<number> {
    return this.countWhere([this.filterOn('schoolId', schoolId)]);
  }
}
