import type { Course } from '../../entities/Course';
import type { ICrudRepository, Draft, PageOptions } from './ICrudRepository';

export type CourseDraft = Draft<Course, 'courseId'>;

/** `academic.course` — materia/asignatura de un programa. */
export interface ICourseRepository extends ICrudRepository<Course, number, CourseDraft> {
  findByProgram(programId: number, page?: PageOptions): Promise<Course[]>;
  countByProgram(programId: number): Promise<number>;
  /** Every row of one school, filtered and paged in SQL (no school_id column: it goes through program). */
  findBySchool(schoolId: number, page?: PageOptions): Promise<Course[]>;
  countBySchool(schoolId: number): Promise<number>;
}
