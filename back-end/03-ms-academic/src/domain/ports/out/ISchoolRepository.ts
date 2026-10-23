import type { School } from '../../entities/School';
import type { ICrudRepository, Draft } from './ICrudRepository';

export type SchoolDraft = Draft<School, 'schoolId'>;

/** `academic.school` — sede educativa. */
export interface ISchoolRepository extends ICrudRepository<School, number, SchoolDraft> {
  /**
   * Soft-deletes the school together with everything it owns inside this context
   * (programs, cohorts, courses, periods, actors, enrollments), atomically.
   * `false` when the school does not exist or is already deleted.
   */
  softDeleteCascade(id: number): Promise<boolean>;
}
