import { Enrollment, type EnrollmentRecord, type EnrollmentStatus } from '../../../domain/entities/Enrollment';
import type { IEnrollmentRepository } from '../../../domain/ports/out/IEnrollmentRepository';
import type { PageOptions } from '../../../domain/ports/out/ICrudRepository';
import { PostgresCrudRepository, dateParam, type FieldSpec, type JsonRecord } from './crud.repository';
import { AUDIT_FIELDS } from './audit.fields';

/** Native PostgreSQL enum — bind parameters must carry an explicit cast. */
const ENROLLMENT_STATUS_TYPE = 'academic.enrollment_status';

const ENROLLMENT_STATUSES: readonly EnrollmentStatus[] = ['Active', 'Withdrawn', 'Completed'];

/**
 * PostgreSQL adapter for `academic.enrollment`.
 *
 * `enrollment_status` is the native enum `academic.enrollment_status`
 * ('Active','Withdrawn','Completed'), so every bind parameter for that column is
 * written as `$n::academic.enrollment_status` — without the cast PostgreSQL cannot
 * infer the type of an untyped parameter and fails with 42804/22P02.
 * The `fn_validate_enrollment_status()` trigger re-validates the value server-side.
 *
 * `enrollment_id` is BIGINT with a `nextval()` default; INSERT omits it.
 */
export class PostgresEnrollmentRepository
  extends PostgresCrudRepository<EnrollmentRecord>
  implements IEnrollmentRepository
{
  protected readonly qualifiedTable = 'academic.enrollment';
  protected readonly primaryKeyColumn = 'enrollment_id';
  protected readonly primaryKeyField = 'enrollmentId';
  protected readonly fields: readonly FieldSpec[] = [
    { field: 'enrollmentId', column: 'enrollment_id', writable: false },
    { field: 'academicActorId', column: 'academic_actor_id' },
    { field: 'cohortId', column: 'cohort_id' },
    { field: 'enrolledOn', column: 'enrolled_on', toParam: dateParam },
    { field: 'enrollmentStatus', column: 'enrollment_status', cast: ENROLLMENT_STATUS_TYPE },
    ...AUDIT_FIELDS,
  ];

  /** True when `value` is one of the enum's labels. */
  static isEnrollmentStatus(value: unknown): value is EnrollmentStatus {
    return typeof value === 'string' && (ENROLLMENT_STATUSES as readonly string[]).includes(value);
  }

  findByCohort(cohortId: number, page?: PageOptions): Promise<EnrollmentRecord[]> {
    return this.listWhere([this.filterOn('cohortId', cohortId)], page);
  }

  countByCohort(cohortId: number): Promise<number> {
    return this.countWhere([this.filterOn('cohortId', cohortId)]);
  }

  findByAcademicActor(academicActorId: number, page?: PageOptions): Promise<EnrollmentRecord[]> {
    return this.listWhere([this.filterOn('academicActorId', academicActorId)], page);
  }

  countByAcademicActor(academicActorId: number): Promise<number> {
    return this.countWhere([this.filterOn('academicActorId', academicActorId)]);
  }

  /**
   * Domain-facing write used by `CreateEnrollmentUseCase`.
   * `Enrollment.create()` carries no date and `enrolled_on` is NOT NULL without a
   * default, so today's date is supplied here. The generated identity is written
   * back onto the entity so the use case can return a real id.
   */
  async save(e: Enrollment): Promise<void> {
    const draft: JsonRecord = {
      academicActorId: e.academicActorId,
      cohortId: e.cohortId,
      enrolledOn: new Date().toISOString().slice(0, 10),
      enrollmentStatus: PostgresEnrollmentRepository.isEnrollmentStatus(e.status) ? e.status : 'Active',
    };
    const created = await this.create(draft);
    // `enrollmentId` is `readonly` on the value object; the persistence layer is
    // the only place that knows the generated identity.
    (e as { enrollmentId: number }).enrollmentId = created.enrollmentId;
  }
}
