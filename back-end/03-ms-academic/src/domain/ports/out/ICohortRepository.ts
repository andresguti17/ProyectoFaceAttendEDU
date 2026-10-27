import type { Cohort } from '../../entities/Cohort';
import type { ICrudRepository, Draft, PageOptions } from './ICrudRepository';

export type CohortDraft = Draft<Cohort, 'cohortId'>;

/** `academic.cohort` — grupo de estudiantes en programa + periodo. */
export interface ICohortRepository extends ICrudRepository<Cohort, number, CohortDraft> {
  findByProgram(programId: number, page?: PageOptions): Promise<Cohort[]>;
  countByProgram(programId: number): Promise<number>;
  /** Every row of one school, filtered and paged in SQL (no school_id column: it goes through program). */
  findBySchool(schoolId: number, page?: PageOptions): Promise<Cohort[]>;
  countBySchool(schoolId: number): Promise<number>;
}
