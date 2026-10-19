import type { Cohort } from '../../entities/Cohort';
import type { ICrudRepository, Draft, PageOptions } from './ICrudRepository';

export type CohortDraft = Draft<Cohort, 'cohortId'>;

/** `academic.cohort` — grupo de estudiantes en programa + periodo. */
export interface ICohortRepository extends ICrudRepository<Cohort, number, CohortDraft> {
  findByProgram(programId: number, page?: PageOptions): Promise<Cohort[]>;
  countByProgram(programId: number): Promise<number>;
}
