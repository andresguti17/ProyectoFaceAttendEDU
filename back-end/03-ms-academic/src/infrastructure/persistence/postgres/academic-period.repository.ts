import type { AcademicPeriod } from '../../../domain/entities/AcademicPeriod';
import type { IAcademicPeriodRepository } from '../../../domain/ports/out/IAcademicPeriodRepository';
import type { PageOptions } from '../../../domain/ports/out/ICrudRepository';
import { PostgresCrudRepository, dateParam, type FieldSpec } from './crud.repository';
import { AUDIT_FIELDS } from './audit.fields';

/**
 * PostgreSQL adapter for `academic.academic_period`.
 * `starts_on` / `ends_on` are DATE columns; they are bound as `YYYY-MM-DD` text
 * and returned as the same wire text so the JSON stays a plain date string.
 */
export class PostgresAcademicPeriodRepository
  extends PostgresCrudRepository<AcademicPeriod>
  implements IAcademicPeriodRepository
{
  protected readonly qualifiedTable = 'academic.academic_period';
  protected readonly primaryKeyColumn = 'academic_period_id';
  protected readonly primaryKeyField = 'academicPeriodId';
  protected readonly fields: readonly FieldSpec[] = [
    { field: 'academicPeriodId', column: 'academic_period_id', writable: false },
    { field: 'schoolId', column: 'school_id' },
    { field: 'name', column: 'name' },
    { field: 'startsOn', column: 'starts_on', toParam: dateParam },
    { field: 'endsOn', column: 'ends_on', toParam: dateParam },
    { field: 'isActive', column: 'is_active' },
    ...AUDIT_FIELDS,
  ];

  findBySchool(schoolId: number, page?: PageOptions): Promise<AcademicPeriod[]> {
    return this.listWhere([this.filterOn('schoolId', schoolId)], page);
  }

  countBySchool(schoolId: number): Promise<number> {
    return this.countWhere([this.filterOn('schoolId', schoolId)]);
  }
}
