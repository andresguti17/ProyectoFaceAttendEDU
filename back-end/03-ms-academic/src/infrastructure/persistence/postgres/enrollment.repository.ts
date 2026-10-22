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

  /**
   * Enrolls an actor in a cohort, bringing back a previously deleted enrollment of
   * the same pair if there is one.
   *
   * "Desmatricular" is a soft delete, and `uq_enrollment_actor_cohort` used to cover
   * (academic_actor_id, cohort_id) INCLUDING deleted rows, so a plain INSERT of a
   * pair that was unenrolled before failed with a unique violation. Reviving the row
   * keeps one row per pair, and only the most recent deleted row is revived so a pair
   * with several deleted rows never ends up with two live ones; an enrollment that is
   * still active keeps answering 409. With the partial unique indexes of the db
   * changelog applied a plain INSERT works too: this stays as a fallback for databases
   * that have not run that migration yet.
   */
  async createOrRestore(draft: JsonRecord): Promise<EnrollmentRecord> {
    const revived = await this.select<{ enrollment_id: number }>(
      `UPDATE ${this.qualifiedTable}
          SET deleted_at = NULL, deleted_by = NULL,
              enrollment_status = $3::${ENROLLMENT_STATUS_TYPE}, enrolled_on = $4
        WHERE enrollment_id = (
                SELECT enrollment_id FROM ${this.qualifiedTable}
                 WHERE academic_actor_id = $1 AND cohort_id = $2 AND deleted_at IS NOT NULL
                 ORDER BY enrollment_id DESC LIMIT 1)
        RETURNING enrollment_id`,
      [draft.academicActorId, draft.cohortId, draft.enrollmentStatus ?? 'Active', dateParam(draft.enrolledOn)],
    );
    if (revived.length > 0) {
      const record = await this.findById(revived[0].enrollment_id);
      if (record) return record;
    }
    return this.create(draft);
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
    const created = await this.createOrRestore(draft);
    // `enrollmentId` is `readonly` on the value object; the persistence layer is
    // the only place that knows the generated identity.
    (e as { enrollmentId: number }).enrollmentId = created.enrollmentId;
  }
}
