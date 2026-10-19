import type { Course } from '../../entities/Course';
import type { ICrudRepository, Draft, PageOptions } from './ICrudRepository';

export type CourseDraft = Draft<Course, 'courseId'>;

/** `academic.course` — materia/asignatura de un programa. */
export interface ICourseRepository extends ICrudRepository<Course, number, CourseDraft> {
  findByProgram(programId: number, page?: PageOptions): Promise<Course[]>;
  countByProgram(programId: number): Promise<number>;
}
