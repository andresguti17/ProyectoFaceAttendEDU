import type { AcademicActorRecord } from '../../entities/AcademicActor';
import type { ICrudRepository, Draft, PageOptions } from './ICrudRepository';

export type AcademicActorDraft = Draft<AcademicActorRecord, 'academicActorId'>;

/** `academic.academic_actor` — rol que una persona cumple en una sede. */
export interface IAcademicActorRepository
  extends ICrudRepository<AcademicActorRecord, number, AcademicActorDraft> {
  findBySchool(schoolId: number, page?: PageOptions): Promise<AcademicActorRecord[]>;
  countBySchool(schoolId: number): Promise<number>;
  /** Roles de una persona. Resuelve a que sede pertenece quien inicia sesion. */
  findByPerson(personId: string, page?: PageOptions): Promise<AcademicActorRecord[]>;
  countByPerson(personId: string): Promise<number>;
}
