import type { AcademicActorRecord } from '../../../domain/entities/AcademicActor';
import type { IAcademicActorRepository } from '../../../domain/ports/out/IAcademicActorRepository';
import type { PageOptions } from '../../../domain/ports/out/ICrudRepository';
import { PostgresCrudRepository, dateParam, type FieldSpec } from './crud.repository';
import { AUDIT_FIELDS } from './audit.fields';

/**
 * PostgreSQL adapter for `academic.academic_actor`.
 *
 * `person_id` is a native UUID column with **no** foreign key (cross-context
 * reference to `identity.person`, per database/MODELO.md §11), so a value that is
 * not valid UUID text is rejected by PostgreSQL with SQLSTATE 22P02 and mapped to
 * HTTP 400 rather than 500.
 *
 * `actor_type_id` and `school_id` *are* real FKs; dangling references map to
 * InvalidReferenceError -> HTTP 400.
 * UNIQUE (school_id, actor_type_id, actor_code) and (person_id, actor_type_id,
 * school_id) map to HTTP 409.
 */
export class PostgresAcademicActorRepository
  extends PostgresCrudRepository<AcademicActorRecord>
  implements IAcademicActorRepository
{
  protected readonly qualifiedTable = 'academic.academic_actor';
  protected readonly primaryKeyColumn = 'academic_actor_id';
  protected readonly primaryKeyField = 'academicActorId';
  protected readonly fields: readonly FieldSpec[] = [
    { field: 'academicActorId', column: 'academic_actor_id', writable: false },
    { field: 'personId', column: 'person_id' },
    { field: 'actorTypeId', column: 'actor_type_id' },
    { field: 'schoolId', column: 'school_id' },
    { field: 'actorCode', column: 'actor_code' },
    { field: 'startedOn', column: 'started_on', toParam: dateParam },
    { field: 'endedOn', column: 'ended_on', toParam: dateParam },
    { field: 'status', column: 'status' },
    ...AUDIT_FIELDS,
  ];

  findBySchool(schoolId: number, page?: PageOptions): Promise<AcademicActorRecord[]> {
    return this.listWhere([this.filterOn('schoolId', schoolId)], page);
  }

  countBySchool(schoolId: number): Promise<number> {
    return this.countWhere([this.filterOn('schoolId', schoolId)]);
  }

  findByPerson(personId: string, page?: PageOptions): Promise<AcademicActorRecord[]> {
    return this.listWhere([this.filterOn('personId', personId)], page);
  }

  countByPerson(personId: string): Promise<number> {
    return this.countWhere([this.filterOn('personId', personId)]);
  }
}
