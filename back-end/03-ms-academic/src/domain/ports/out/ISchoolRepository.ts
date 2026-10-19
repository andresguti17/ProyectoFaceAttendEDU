import type { School } from '../../entities/School';
import type { ICrudRepository, Draft } from './ICrudRepository';

export type SchoolDraft = Draft<School, 'schoolId'>;

/** `academic.school` — sede educativa. */
export interface ISchoolRepository extends ICrudRepository<School, number, SchoolDraft> {}
