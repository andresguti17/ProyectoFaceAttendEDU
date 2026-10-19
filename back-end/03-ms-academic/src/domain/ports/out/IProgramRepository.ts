import type { Program } from '../../entities/Program';
import type { ICrudRepository, Draft, PageOptions } from './ICrudRepository';

export type ProgramDraft = Draft<Program, 'programId'>;

/** `academic.program` — oferta curricular de una sede. */
export interface IProgramRepository extends ICrudRepository<Program, number, ProgramDraft> {
  /** Programs belonging to one school, ordered by `program_id`. */
  findBySchool(schoolId: number, page?: PageOptions): Promise<Program[]>;
  countBySchool(schoolId: number): Promise<number>;
}
