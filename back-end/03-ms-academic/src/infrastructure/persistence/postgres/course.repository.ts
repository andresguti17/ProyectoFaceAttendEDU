import type { Course } from '../../../domain/entities/Course';
import type { ICourseRepository } from '../../../domain/ports/out/ICourseRepository';
import type { PageOptions } from '../../../domain/ports/out/ICrudRepository';
import { PostgresCrudRepository, numberParam, type FieldSpec } from './crud.repository';
import { AUDIT_FIELDS } from './audit.fields';

/** Live ids of a school's programs; $1 = school_id. */
const PROGRAMS_OF_SCHOOL =
  `SELECT program_id FROM academic.program WHERE school_id = $1 AND deleted_at IS NULL`;

/**
 * PostgreSQL adapter for `academic.course`.
 * `credit_hours` is SMALLINT NOT NULL; `program_id` is an FK to `academic.program`.
 * UNIQUE (program_id, code) -> duplicate codes answer 409.
 */
export class PostgresCourseRepository extends PostgresCrudRepository<Course> implements ICourseRepository {
  protected readonly qualifiedTable = 'academic.course';
  protected readonly primaryKeyColumn = 'course_id';
  protected readonly primaryKeyField = 'courseId';
  protected readonly fields: readonly FieldSpec[] = [
    { field: 'courseId', column: 'course_id', writable: false },
    { field: 'programId', column: 'program_id' },
    { field: 'code', column: 'code' },
    { field: 'name', column: 'name' },
    { field: 'creditHours', column: 'credit_hours', toParam: numberParam },
    { field: 'status', column: 'status' },
    ...AUDIT_FIELDS,
  ];

  findByProgram(programId: number, page?: PageOptions): Promise<Course[]> {
    return this.listWhere([this.filterOn('programId', programId)], page);
  }

  countByProgram(programId: number): Promise<number> {
    return this.countWhere([this.filterOn('programId', programId)]);
  }

  findBySchool(schoolId: number, page?: PageOptions): Promise<Course[]> {
    return this.listInSubquery('programId', PROGRAMS_OF_SCHOOL, [schoolId], page);
  }

  countBySchool(schoolId: number): Promise<number> {
    return this.countInSubquery('programId', PROGRAMS_OF_SCHOOL, [schoolId]);
  }
}
