/**
 * Repository composition root — 03-ms-academic.
 *
 * `main.ts` builds this bundle once at boot (after `connectDatabase()`) and hands
 * it to `registerAcademicRoutes`. The HTTP layer depends only on the domain ports
 * in `domain/ports/out`, never on `pg` or on SQL.
 */

import type { ISchoolRepository } from '../../../domain/ports/out/ISchoolRepository';
import type { IProgramRepository } from '../../../domain/ports/out/IProgramRepository';
import type { IAcademicPeriodRepository } from '../../../domain/ports/out/IAcademicPeriodRepository';
import type { ICohortRepository } from '../../../domain/ports/out/ICohortRepository';
import type { ICourseRepository } from '../../../domain/ports/out/ICourseRepository';
import type { IAcademicActorTypeRepository } from '../../../domain/ports/out/IAcademicActorTypeRepository';
import type { IAcademicActorRepository } from '../../../domain/ports/out/IAcademicActorRepository';
import type { IEnrollmentRepository } from '../../../domain/ports/out/IEnrollmentRepository';

import { PostgresSchoolRepository } from './school.repository';
import { PostgresProgramRepository } from './program.repository';
import { PostgresAcademicPeriodRepository } from './academic-period.repository';
import { PostgresCohortRepository } from './cohort.repository';
import { PostgresCourseRepository } from './course.repository';
import { PostgresAcademicActorTypeRepository } from './academic-actor-type.repository';
import { PostgresAcademicActorRepository } from './academic-actor.repository';
import { PostgresEnrollmentRepository } from './enrollment.repository';

export interface AcademicRepositories {
  readonly schools: ISchoolRepository;
  readonly programs: IProgramRepository;
  readonly periods: IAcademicPeriodRepository;
  readonly cohorts: ICohortRepository;
  readonly courses: ICourseRepository;
  readonly actorTypes: IAcademicActorTypeRepository;
  readonly actors: IAcademicActorRepository;
  readonly enrollments: IEnrollmentRepository;
}

/** Instantiates the PostgreSQL adapter for every academic aggregate. */
export function createAcademicRepositories(): AcademicRepositories {
  return {
    schools: new PostgresSchoolRepository(),
    programs: new PostgresProgramRepository(),
    periods: new PostgresAcademicPeriodRepository(),
    cohorts: new PostgresCohortRepository(),
    courses: new PostgresCourseRepository(),
    actorTypes: new PostgresAcademicActorTypeRepository(),
    actors: new PostgresAcademicActorRepository(),
    enrollments: new PostgresEnrollmentRepository(),
  };
}

export {
  PostgresSchoolRepository,
  PostgresProgramRepository,
  PostgresAcademicPeriodRepository,
  PostgresCohortRepository,
  PostgresCourseRepository,
  PostgresAcademicActorTypeRepository,
  PostgresAcademicActorRepository,
  PostgresEnrollmentRepository,
};
