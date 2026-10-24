/**
 * In-memory implementation of every academic repository port, for HTTP tests.
 * Same contract as the PostgreSQL adapters: soft delete hides rows from reads,
 * paging applies only when limit/offset are given.
 */
import type { AcademicRepositories } from '../../infrastructure/persistence/postgres';

type Row = Record<string, any>;
type Page = { limit?: number; offset?: number };

export class MemoryRepo {
  readonly rows = new Map<number, Row>();
  private seq = 1;

  constructor(readonly idField: string) {}

  live(): Row[] {
    return [...this.rows.values()].filter((r) => !r.deletedAt).map((r) => ({ ...r }));
  }

  page(items: Row[], page?: Page): Row[] {
    if (!page || (page.limit === undefined && page.offset === undefined)) return items;
    const offset = page.offset ?? 0;
    return items.slice(offset, offset + (page.limit ?? items.length));
  }

  by(field: string, value: unknown): Row[] {
    return this.live().filter((r) => r[field] === value);
  }

  async list(page?: Page) {
    return this.page(this.live(), page);
  }

  async count() {
    return this.live().length;
  }

  async findById(id: number) {
    const row = this.rows.get(id);
    return row && !row.deletedAt ? { ...row } : null;
  }

  async existsById(id: number) {
    return (await this.findById(id)) !== null;
  }

  async create(draft: Row) {
    const id = this.seq++;
    const row = { ...draft, [this.idField]: id, createdAt: '2026-10-01T00:00:00.000Z', updatedAt: null, deletedAt: null };
    this.rows.set(id, row);
    return { ...row };
  }

  async update(id: number, patch: Row) {
    const row = this.rows.get(id);
    if (!row || row.deletedAt) return null;
    Object.assign(row, patch, { updatedAt: '2026-10-02T00:00:00.000Z' });
    return { ...row };
  }

  async softDelete(id: number) {
    const row = this.rows.get(id);
    if (!row || row.deletedAt) return false;
    row.deletedAt = '2026-10-03T00:00:00.000Z';
    return true;
  }
}

function scoped(repo: MemoryRepo, field: string) {
  return {
    find: async (value: unknown, page?: Page) => repo.page(repo.by(field, value), page),
    count: async (value: unknown) => repo.by(field, value).length,
  };
}

export interface MemoryRepositories extends AcademicRepositories {
  readonly stores: Record<keyof AcademicRepositories, MemoryRepo>;
}

export function memoryRepositories(): MemoryRepositories {
  const stores = {
    schools: new MemoryRepo('schoolId'),
    programs: new MemoryRepo('programId'),
    periods: new MemoryRepo('academicPeriodId'),
    cohorts: new MemoryRepo('cohortId'),
    courses: new MemoryRepo('courseId'),
    actorTypes: new MemoryRepo('actorTypeId'),
    actors: new MemoryRepo('academicActorId'),
    enrollments: new MemoryRepo('enrollmentId'),
  };
  const programsBySchool = scoped(stores.programs, 'schoolId');
  const periodsBySchool = scoped(stores.periods, 'schoolId');
  const cohortsByProgram = scoped(stores.cohorts, 'programId');
  const coursesByProgram = scoped(stores.courses, 'programId');
  const actorsBySchool = scoped(stores.actors, 'schoolId');
  const actorsByPerson = scoped(stores.actors, 'personId');
  const enrollmentsByCohort = scoped(stores.enrollments, 'cohortId');
  const enrollmentsByActor = scoped(stores.enrollments, 'academicActorId');

  const repos = {
    schools: Object.assign(stores.schools, { softDeleteCascade: (id: number) => stores.schools.softDelete(id) }),
    programs: Object.assign(stores.programs, { findBySchool: programsBySchool.find, countBySchool: programsBySchool.count }),
    periods: Object.assign(stores.periods, { findBySchool: periodsBySchool.find, countBySchool: periodsBySchool.count }),
    cohorts: Object.assign(stores.cohorts, { findByProgram: cohortsByProgram.find, countByProgram: cohortsByProgram.count }),
    courses: Object.assign(stores.courses, { findByProgram: coursesByProgram.find, countByProgram: coursesByProgram.count }),
    actorTypes: Object.assign(stores.actorTypes, {
      restoreByCode: async (code: string, name: string) => {
        const gone = [...stores.actorTypes.rows.values()].find((r) => r.code === code && r.deletedAt);
        if (!gone) return null;
        Object.assign(gone, { name, deletedAt: null });
        return { ...gone };
      },
    }),
    actors: Object.assign(stores.actors, {
      findBySchool: actorsBySchool.find,
      countBySchool: actorsBySchool.count,
      findByPerson: actorsByPerson.find,
      countByPerson: actorsByPerson.count,
    }),
    enrollments: Object.assign(stores.enrollments, {
      save: async (e: { academicActorId: number; cohortId: number; status: string }) => {
        await stores.enrollments.create({ academicActorId: e.academicActorId, cohortId: e.cohortId, enrollmentStatus: e.status });
      },
      createOrRestore: async (draft: Row) => {
        const gone = [...stores.enrollments.rows.values()].find(
          (r) => r.deletedAt && r.academicActorId === draft.academicActorId && r.cohortId === draft.cohortId,
        );
        if (!gone) return stores.enrollments.create(draft);
        Object.assign(gone, draft, { deletedAt: null });
        return { ...gone };
      },
      findByCohort: enrollmentsByCohort.find,
      countByCohort: enrollmentsByCohort.count,
      findByAcademicActor: enrollmentsByActor.find,
      countByAcademicActor: enrollmentsByActor.count,
    }),
  };
  return { ...(repos as unknown as AcademicRepositories), stores };
}
