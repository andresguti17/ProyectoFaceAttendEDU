import { Enrollment, type EnrollmentRecord } from '../../entities/Enrollment';
import type { ICrudRepository, Draft, PageOptions } from './ICrudRepository';

export type EnrollmentDraft = Draft<EnrollmentRecord, 'enrollmentId'>;

/**
 * `academic.enrollment` — matrícula de un actor en una cohorte.
 *
 * `enrollment_status` is the native PostgreSQL enum `academic.enrollment_status`
 * ('Active','Withdrawn','Completed'); the adapter casts bind parameters to it
 * explicitly and the `fn_validate_enrollment_status()` trigger re-checks the value.
 *
 * Note: `findById` now returns the persisted `EnrollmentRecord` rather than the
 * anemic `Enrollment` value object, because the HTTP layer needs the full row.
 * The domain-facing `save(Enrollment)` member is unchanged.
 */
export interface IEnrollmentRepository extends ICrudRepository<EnrollmentRecord, number, EnrollmentDraft> {
  /** Domain write used by `CreateEnrollmentUseCase`; stamps the generated id back onto the entity. */
  save(e: Enrollment): Promise<void>;

  findByCohort(cohortId: number, page?: PageOptions): Promise<EnrollmentRecord[]>;
  countByCohort(cohortId: number): Promise<number>;
  findByAcademicActor(academicActorId: number, page?: PageOptions): Promise<EnrollmentRecord[]>;
  countByAcademicActor(academicActorId: number): Promise<number>;
}
