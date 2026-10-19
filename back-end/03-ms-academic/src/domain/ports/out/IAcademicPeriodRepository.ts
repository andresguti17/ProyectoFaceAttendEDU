import type { AcademicPeriod } from '../../entities/AcademicPeriod';
import type { ICrudRepository, Draft, PageOptions } from './ICrudRepository';

export type AcademicPeriodDraft = Draft<AcademicPeriod, 'academicPeriodId'>;

/** `academic.academic_period` — ventana temporal (trimestre/semestre). */
export interface IAcademicPeriodRepository extends ICrudRepository<AcademicPeriod, number, AcademicPeriodDraft> {
  findBySchool(schoolId: number, page?: PageOptions): Promise<AcademicPeriod[]>;
  countBySchool(schoolId: number): Promise<number>;
}
