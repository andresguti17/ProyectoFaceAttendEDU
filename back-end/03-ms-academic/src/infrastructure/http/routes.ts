import { patchSchema } from './patchSchema';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { PageOptions } from '../../domain/ports/out/ICrudRepository';
import type { AcademicRepositories } from '../persistence/postgres';
import { createCallerSchoolResolver, mayDeleteCourse, ScopeError as SchoolScopeError, type CallerSchool } from './callerSchool';
import { ownSchoolEdit } from './schoolEditPolicy';

/**
 * HTTP adapters — 03-ms-academic.
 *
 * Persistence goes through the injected `AcademicRepositories` ports
 * (`domain/ports/out/*`), which are implemented by the PostgreSQL adapters in
 * `infrastructure/persistence/postgres`. There is no in-memory store: every
 * response is exactly what is in the `academic` schema.
 *
 * Error contract: repositories throw `RepositoryError`s carrying an HTTP status
 * (409 unique violation, 400 dangling FK / bad value, 503 database down). They
 * are not caught here — `main.ts`'s Fastify error handler renders them into the
 * same envelope used for validation failures, so no database error can leak as a
 * 500 or as a raw driver message.
 */

function parseId(raw: unknown): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function send400(reply: any, message: string, details?: unknown) {
  return reply.code(400).send({ error: 'BadRequest', message, details, timestamp: new Date().toISOString() });
}

// ISO 25010 Eficiencia (capacidad) + Compatibilidad: paginación uniforme ?limit&offset.
function getPagination(req: any): { limit: number; offset: number } {
  let limit = Number(req?.query?.limit ?? 20);
  let offset = Number(req?.query?.offset ?? 0);
  if (!Number.isInteger(limit) || limit <= 0) limit = 20;
  if (!Number.isInteger(offset) || offset < 0) offset = 0;
  return { limit: Math.min(limit, 100), offset };
}

/**
 * Same contract the in-memory `page()` helper had:
 *   - no `limit`/`offset` in the query string -> bare array of every match, no header;
 *   - either present -> sliced array plus `x-total-count` = total matching rows.
 * LIMIT/OFFSET are pushed into SQL and bound as parameters.
 */
/** Same pagination contract as `pageOf`, for a result already resolved in memory. */
function pageOfArray<T>(items: T[], req: any, reply: any): T[] {
  const q = (req as any)?.query as any;
  if (!q || (q.limit === undefined && q.offset === undefined)) return items;
  const { limit, offset } = getPagination(req);
  reply.header('x-total-count', items.length);
  return items.slice(offset, offset + limit);
}

async function pageOf<T>(
  req: any,
  reply: any,
  list: (page: PageOptions) => Promise<T[]>,
  count: () => Promise<number>,
): Promise<T[]> {
  const q = (req as any)?.query as any;
  if (!q || (q.limit === undefined && q.offset === undefined)) return list({});
  const { limit, offset } = getPagination(req);
  const [items, total] = await Promise.all([list({ limit, offset }), count()]);
  reply.header('x-total-count', total);
  return items;
}

export async function registerAcademicRoutes(app: FastifyInstance, repos: AcademicRepositories) {
  // ---------- School isolation ----------
  // Every role here resolves its own school (`permissions.ts` lets any
  // authenticated session read — that stays, since Instructor/Aprendiz need
  // this data to function) — but reads/writes must stay inside that school.
  // Super Administrador (no school of its own) is the only unrestricted caller.
  const resolveCallerSchool = createCallerSchoolResolver(repos);

  async function callerSchoolOf(req: any, reply: any): Promise<CallerSchool | null> {
    try {
      return await resolveCallerSchool(req);
    } catch (err) {
      if (err instanceof SchoolScopeError) {
        reply.code(err.statusCode).send({
          error: err.statusCode === 403 ? 'Forbidden' : 'ServiceUnavailable',
          message: err.message,
          timestamp: new Date().toISOString(),
        });
        return null;
      }
      throw err;
    }
  }

  function notFound(reply: any) {
    return reply.code(404).send({ error: 'NotFound' });
  }

  function forbiddenOtherSchool(reply: any) {
    return reply.code(403).send({ error: 'Forbidden', message: 'You can only manage your own school', timestamp: new Date().toISOString() });
  }

  /** Resolves a program's school (programs carry it directly). */
  async function schoolOfProgram(programId: number | null | undefined): Promise<number | null> {
    if (programId == null) return null;
    const program = await repos.programs.findById(programId);
    return program?.schoolId ?? null;
  }

  /** Resolves an academic actor's school (actors carry it directly). */
  async function schoolOfActor(actorId: number | null | undefined): Promise<number | null> {
    if (actorId == null) return null;
    const actor = await repos.actors.findById(actorId);
    return actor?.schoolId ?? null;
  }

  /** Program ids of a school — the join cohorts/courses need to be scoped by school. */
  async function programIdsOfSchool(schoolId: number): Promise<number[]> {
    const programs = await repos.programs.findBySchool(schoolId);
    return programs.map((p) => p.programId).filter((id): id is number => id != null);
  }

  /** Cohorts across every program of a school — cohort has no schoolId of its own. */
  async function cohortsOfSchool(schoolId: number, page?: PageOptions) {
    const programIds = await programIdsOfSchool(schoolId);
    const pages = await Promise.all(programIds.map((id) => repos.cohorts.findByProgram(id)));
    const all = pages.flat();
    if (!page) return all;
    return all.slice(page.offset ?? 0, (page.offset ?? 0) + (page.limit ?? all.length));
  }
  async function countCohortsOfSchool(schoolId: number): Promise<number> {
    return (await cohortsOfSchool(schoolId)).length;
  }

  /** Resolves a cohort's school — cohorts carry programId, programs carry schoolId. */
  async function schoolOfCohort(cohortId: number | null | undefined): Promise<number | null> {
    if (cohortId == null) return null;
    const cohort = await repos.cohorts.findById(cohortId);
    return schoolOfProgram(cohort?.programId);
  }

  /** Enrollments across every cohort of a school — enrollment has no schoolId of its own. */
  async function enrollmentsOfSchool(schoolId: number, page?: PageOptions) {
    const cohorts = await cohortsOfSchool(schoolId);
    const cohortIds = cohorts.map((c) => c.cohortId).filter((id): id is number => id != null);
    const pages = await Promise.all(cohortIds.map((id) => repos.enrollments.findByCohort(id)));
    const all = pages.flat();
    if (!page) return all;
    return all.slice(page.offset ?? 0, (page.offset ?? 0) + (page.limit ?? all.length));
  }
  async function countEnrollmentsOfSchool(schoolId: number): Promise<number> {
    return (await enrollmentsOfSchool(schoolId)).length;
  }

  /** Courses across every program of a school — course has no schoolId of its own. */
  async function coursesOfSchool(schoolId: number, page?: PageOptions) {
    const programIds = await programIdsOfSchool(schoolId);
    const pages = await Promise.all(programIds.map((id) => repos.courses.findByProgram(id)));
    const all = pages.flat();
    if (!page) return all;
    return all.slice(page.offset ?? 0, (page.offset ?? 0) + (page.limit ?? all.length));
  }
  async function countCoursesOfSchool(schoolId: number): Promise<number> {
    return (await coursesOfSchool(schoolId)).length;
  }

  // ---------- Schools ----------
  const schoolBody = z.object({
    code: z.string().min(1).max(50),
    name: z.string().min(1).max(255),
    cityId: z.number().int().default(1),
    cityName: z.string().max(100).optional(),
    address: z.string().max(255).optional(),
    phone: z.string().max(50).optional(),
    email: z.string().email().max(255).optional(),
    status: z.boolean().default(true),
  });

  // Creating/editing a school is a platform-level action (frontend's
  // canManageSchools: isSuperAdmin) — configuration:manage alone would let
  // any school Administrador touch OTHER schools, not just configure its own.
  async function requireSuperAdminForSchool(req: any, reply: any): Promise<boolean> {
    const caller = await callerSchoolOf(req, reply);
    if (!caller) return false;
    if (!caller.isSuperAdmin) {
      reply.code(403).send({ error: 'Forbidden', message: 'Only Super Administrador manages schools', timestamp: new Date().toISOString() });
      return false;
    }
    return true;
  }

  app.post('/api/v1/schools', async (req, reply) => {
    const parsed = schoolBody.safeParse((req as any).body);
    if (!parsed.success) return send400(reply, 'Invalid school payload', parsed.error.flatten());
    if (!(await requireSuperAdminForSchool(req, reply))) return reply;
    const created = await repos.schools.create(parsed.data);
    return reply.code(201).send(created);
  });
  app.get('/api/v1/schools', async (req, reply) => {
    const caller = await callerSchoolOf(req, reply);
    if (!caller) return reply;
    if (caller.isSuperAdmin) {
      return pageOf(req, reply, (page) => repos.schools.list(page), () => repos.schools.count());
    }
    // Non-super-admin: only its own school, never the full list.
    const own = caller.schoolId != null ? await repos.schools.findById(caller.schoolId) : null;
    return own ? [own] : [];
  });
  app.get('/api/v1/schools/:id', async (req, reply) => {
    const id = parseId((req.params as any).id);
    const found = id ? await repos.schools.findById(id) : null;
    if (!found) return notFound(reply);
    const caller = await callerSchoolOf(req, reply);
    if (!caller) return reply;
    if (!caller.isSuperAdmin && found.schoolId !== caller.schoolId) return notFound(reply);
    return found;
  });
  app.put('/api/v1/schools/:id', async (req, reply) => {
    const id = parseId((req.params as any).id);
    if (!id) return notFound(reply);
    const parsed = patchSchema(schoolBody).safeParse((req as any).body);
    if (!parsed.success) return send400(reply, 'Invalid school payload', parsed.error.flatten());
    const caller = await callerSchoolOf(req, reply);
    if (!caller) return reply;
    let changes: Record<string, unknown> = parsed.data;
    if (!caller.isSuperAdmin) {
      // A school Administrador edits its own school's name and contact data only.
      if (id !== caller.schoolId) return notFound(reply);
      const current = await repos.schools.findById(id);
      if (!current) return notFound(reply);
      const edit = ownSchoolEdit(current, parsed.data);
      if (!edit.allowed) {
        return reply.code(403).send({ error: 'Forbidden', message: edit.reason, timestamp: new Date().toISOString() });
      }
      changes = edit.changes;
    }
    const updated = await repos.schools.update(id, changes);
    if (!updated) return notFound(reply);
    return updated;
  });
  app.patch('/api/v1/schools/:id/status', async (req, reply) => {
    const id = parseId((req.params as any).id);
    const parsed = z.object({ status: z.boolean() }).safeParse((req as any).body);
    if (!id || !parsed.success) return send400(reply, 'Invalid status payload');
    if (!(await requireSuperAdminForSchool(req, reply))) return reply;
    const updated = await repos.schools.update(id, parsed.data);
    if (!updated) return notFound(reply);
    return updated;
  });
  app.delete('/api/v1/schools/:id', async (req, reply) => {
    const id = parseId((req.params as any).id);
    if (!(await requireSuperAdminForSchool(req, reply))) return reply;
    if (!id || !(await repos.schools.softDeleteCascade(id))) return notFound(reply);
    return reply.code(204).send();
  });

  // ---------- Programs ----------
  const programBody = z.object({
    schoolId: z.number().int().optional(),
    code: z.string().min(1).max(50),
    name: z.string().min(1).max(255),
    status: z.boolean().default(true),
  });
  const createProgram = async (schoolId: number, body: unknown, req: any, reply: any) => {
    const parsed = programBody.safeParse(body);
    if (!parsed.success) return send400(reply, 'Invalid program payload', parsed.error.flatten());
    if (!(await repos.schools.existsById(schoolId))) return reply.code(404).send({ error: 'SchoolNotFound' });
    const caller = await callerSchoolOf(req, reply);
    if (!caller) return reply;
    if (!caller.isSuperAdmin && schoolId !== caller.schoolId) return forbiddenOtherSchool(reply);
    const created = await repos.programs.create({ ...parsed.data, schoolId });
    return reply.code(201).send(created);
  };
  app.post('/api/v1/schools/:schoolId/programs', async (req, reply) => {
    const schoolId = parseId((req.params as any).schoolId);
    if (!schoolId) return reply.code(404).send({ error: 'SchoolNotFound' });
    return createProgram(schoolId, (req as any).body, req, reply);
  });
  app.post('/api/v1/programs', async (req, reply) => {
    const body = ((req as any).body ?? {}) as Record<string, unknown>;
    const schoolId = Number(body.schoolId);
    if (!Number.isInteger(schoolId)) return send400(reply, 'schoolId is required');
    return createProgram(schoolId, body, req, reply);
  });
  app.get('/api/v1/schools/:schoolId/programs', async (req, reply) => {
    const schoolId = parseId((req.params as any).schoolId);
    if (!schoolId) return [];
    const caller = await callerSchoolOf(req, reply);
    if (!caller) return reply;
    if (!caller.isSuperAdmin && schoolId !== caller.schoolId) return forbiddenOtherSchool(reply);
    return pageOf(
      req,
      reply,
      (page) => repos.programs.findBySchool(schoolId, page),
      () => repos.programs.countBySchool(schoolId),
    );
  });
  app.get('/api/v1/programs', async (req, reply) => {
    const caller = await callerSchoolOf(req, reply);
    if (!caller) return reply;
    if (caller.isSuperAdmin) {
      return pageOf(req, reply, (page) => repos.programs.list(page), () => repos.programs.count());
    }
    const schoolId = caller.schoolId ?? -1;
    return pageOf(
      req,
      reply,
      (page) => repos.programs.findBySchool(schoolId, page),
      () => repos.programs.countBySchool(schoolId),
    );
  });
  app.get('/api/v1/programs/:id', async (req, reply) => {
    const id = parseId((req.params as any).id);
    const found = id ? await repos.programs.findById(id) : null;
    if (!found) return notFound(reply);
    const caller = await callerSchoolOf(req, reply);
    if (!caller) return reply;
    if (!caller.isSuperAdmin && found.schoolId !== caller.schoolId) return notFound(reply);
    return found;
  });
  app.put('/api/v1/programs/:id', async (req, reply) => {
    const id = parseId((req.params as any).id);
    const found = id ? await repos.programs.findById(id) : null;
    if (!found) return notFound(reply);
    const parsed = patchSchema(programBody).safeParse((req as any).body);
    if (!parsed.success) return send400(reply, 'Invalid program payload', parsed.error.flatten());
    const caller = await callerSchoolOf(req, reply);
    if (!caller) return reply;
    if (!caller.isSuperAdmin) {
      if (found.schoolId !== caller.schoolId) return notFound(reply);
      if (parsed.data.schoolId !== undefined && parsed.data.schoolId !== caller.schoolId) return forbiddenOtherSchool(reply);
    }
    const updated = await repos.programs.update(id as number, parsed.data);
    return updated ?? notFound(reply);
  });
  app.delete('/api/v1/programs/:id', async (req, reply) => {
    const id = parseId((req.params as any).id);
    const found = id ? await repos.programs.findById(id) : null;
    if (!found) return notFound(reply);
    const caller = await callerSchoolOf(req, reply);
    if (!caller) return reply;
    if (!caller.isSuperAdmin && found.schoolId !== caller.schoolId) return notFound(reply);
    if (!(await repos.programs.softDelete(id as number))) return notFound(reply);
    return reply.code(204).send();
  });

  // ---------- Periods (canonical /academic-periods + alias /periods) ----------
  const periodBody = z.object({
    schoolId: z.number().int().optional(),
    name: z.string().min(1).max(255),
    startsOn: z.string().min(1),
    endsOn: z.string().min(1),
    isActive: z.boolean().default(false),
  });
  const createPeriod = async (schoolId: number, body: unknown, req: any, reply: any) => {
    const parsed = periodBody.safeParse(body);
    if (!parsed.success) return send400(reply, 'Invalid period payload', parsed.error.flatten());
    const caller = await callerSchoolOf(req, reply);
    if (!caller) return reply;
    if (!caller.isSuperAdmin && schoolId !== caller.schoolId) return forbiddenOtherSchool(reply);
    // `academic_period.school_id` is a real FK: a missing school answers 400.
    const created = await repos.periods.create({ ...parsed.data, schoolId });
    return reply.code(201).send(created);
  };
  for (const base of ['/api/v1/academic-periods', '/api/v1/periods']) {
    app.post(base, async (req, reply) => {
      const body = ((req as any).body ?? {}) as Record<string, unknown>;
      const schoolId = Number(body.schoolId);
      if (!Number.isInteger(schoolId)) return send400(reply, 'schoolId is required');
      return createPeriod(schoolId, body, req, reply);
    });
    app.get(base, async (req, reply) => {
      const caller = await callerSchoolOf(req, reply);
      if (!caller) return reply;
      if (caller.isSuperAdmin) {
        return pageOf(req, reply, (page) => repos.periods.list(page), () => repos.periods.count());
      }
      const schoolId = caller.schoolId ?? -1;
      return pageOf(
        req,
        reply,
        (page) => repos.periods.findBySchool(schoolId, page),
        () => repos.periods.countBySchool(schoolId),
      );
    });
    app.get(`${base}/:id`, async (req, reply) => {
      const id = parseId((req.params as any).id);
      const found = id ? await repos.periods.findById(id) : null;
      if (!found) return notFound(reply);
      const caller = await callerSchoolOf(req, reply);
      if (!caller) return reply;
      if (!caller.isSuperAdmin && found.schoolId !== caller.schoolId) return notFound(reply);
      return found;
    });
    app.put(`${base}/:id`, async (req, reply) => {
      const id = parseId((req.params as any).id);
      const found = id ? await repos.periods.findById(id) : null;
      if (!found) return notFound(reply);
      const parsed = patchSchema(periodBody).safeParse((req as any).body);
      if (!parsed.success) return send400(reply, 'Invalid period payload', parsed.error.flatten());
      const caller = await callerSchoolOf(req, reply);
      if (!caller) return reply;
      if (!caller.isSuperAdmin) {
        if (found.schoolId !== caller.schoolId) return notFound(reply);
        if (parsed.data.schoolId !== undefined && parsed.data.schoolId !== caller.schoolId) return forbiddenOtherSchool(reply);
      }
      const updated = await repos.periods.update(id as number, parsed.data);
      return updated ?? notFound(reply);
    });
    app.delete(`${base}/:id`, async (req, reply) => {
      const id = parseId((req.params as any).id);
      const found = id ? await repos.periods.findById(id) : null;
      if (!found) return notFound(reply);
      const caller = await callerSchoolOf(req, reply);
      if (!caller) return reply;
      if (!caller.isSuperAdmin && found.schoolId !== caller.schoolId) return notFound(reply);
      if (!(await repos.periods.softDelete(id as number))) return notFound(reply);
      return reply.code(204).send();
    });
  }
  app.post('/api/v1/schools/:schoolId/periods', async (req, reply) => {
    const schoolId = parseId((req.params as any).schoolId);
    if (!schoolId) return reply.code(404).send({ error: 'SchoolNotFound' });
    return createPeriod(schoolId, (req as any).body, req, reply);
  });
  app.get('/api/v1/schools/:schoolId/periods', async (req, reply) => {
    const schoolId = parseId((req.params as any).schoolId);
    if (!schoolId) return [];
    const caller = await callerSchoolOf(req, reply);
    if (!caller) return reply;
    if (!caller.isSuperAdmin && schoolId !== caller.schoolId) return forbiddenOtherSchool(reply);
    return pageOf(
      req,
      reply,
      (page) => repos.periods.findBySchool(schoolId, page),
      () => repos.periods.countBySchool(schoolId),
    );
  });

  // ---------- Cohorts ----------
  // program_id and academic_period_id are NOT NULL FKs in PostgreSQL, so they are
  // required here; the in-memory store used to accept cohorts without them.
  const cohortBody = z.object({
    programId: z.number().int().positive(),
    academicPeriodId: z.number().int().positive(),
    code: z.string().min(1).max(50),
    status: z.boolean().default(true),
  });
  app.post('/api/v1/cohorts', async (req, reply) => {
    const parsed = cohortBody.safeParse((req as any).body);
    if (!parsed.success) return send400(reply, 'Invalid cohort payload', parsed.error.flatten());
    const caller = await callerSchoolOf(req, reply);
    if (!caller) return reply;
    if (!caller.isSuperAdmin) {
      const programSchool = await schoolOfProgram(parsed.data.programId);
      if (programSchool !== caller.schoolId) return forbiddenOtherSchool(reply);
    }
    const created = await repos.cohorts.create(parsed.data);
    return reply.code(201).send(created);
  });
  app.get('/api/v1/cohorts', async (req, reply) => {
    const caller = await callerSchoolOf(req, reply);
    if (!caller) return reply;
    if (caller.isSuperAdmin) {
      return pageOf(req, reply, (page) => repos.cohorts.list(page), () => repos.cohorts.count());
    }
    const schoolId = caller.schoolId ?? -1;
    return pageOf(req, reply, (page) => cohortsOfSchool(schoolId, page), () => countCohortsOfSchool(schoolId));
  });
  app.get('/api/v1/cohorts/:id', async (req, reply) => {
    const id = parseId((req.params as any).id);
    const found = id ? await repos.cohorts.findById(id) : null;
    if (!found) return notFound(reply);
    const caller = await callerSchoolOf(req, reply);
    if (!caller) return reply;
    if (!caller.isSuperAdmin && (await schoolOfProgram(found.programId)) !== caller.schoolId) return notFound(reply);
    return found;
  });
  app.put('/api/v1/cohorts/:id', async (req, reply) => {
    const id = parseId((req.params as any).id);
    const found = id ? await repos.cohorts.findById(id) : null;
    if (!found) return notFound(reply);
    const parsed = patchSchema(cohortBody).safeParse((req as any).body);
    if (!parsed.success) return send400(reply, 'Invalid cohort payload', parsed.error.flatten());
    const caller = await callerSchoolOf(req, reply);
    if (!caller) return reply;
    if (!caller.isSuperAdmin) {
      if ((await schoolOfProgram(found.programId)) !== caller.schoolId) return notFound(reply);
      if (parsed.data.programId !== undefined) {
        const targetSchool = await schoolOfProgram(parsed.data.programId);
        if (targetSchool !== caller.schoolId) return forbiddenOtherSchool(reply);
      }
    }
    const updated = await repos.cohorts.update(id as number, parsed.data);
    return updated ?? notFound(reply);
  });
  app.delete('/api/v1/cohorts/:id', async (req, reply) => {
    const id = parseId((req.params as any).id);
    const found = id ? await repos.cohorts.findById(id) : null;
    if (!found) return notFound(reply);
    const caller = await callerSchoolOf(req, reply);
    if (!caller) return reply;
    if (!caller.isSuperAdmin && (await schoolOfProgram(found.programId)) !== caller.schoolId) return notFound(reply);
    if (!(await repos.cohorts.softDelete(id as number))) return notFound(reply);
    return reply.code(204).send();
  });
  app.get('/api/v1/programs/:programId/cohorts', async (req, reply) => {
    const programId = parseId((req.params as any).programId);
    if (!programId) return [];
    const caller = await callerSchoolOf(req, reply);
    if (!caller) return reply;
    if (!caller.isSuperAdmin && (await schoolOfProgram(programId)) !== caller.schoolId) return forbiddenOtherSchool(reply);
    return pageOf(
      req,
      reply,
      (page) => repos.cohorts.findByProgram(programId, page),
      () => repos.cohorts.countByProgram(programId),
    );
  });

  // ---------- Courses ----------
  const courseBody = z.object({
    programId: z.number().int().optional(),
    code: z.string().min(1).max(50),
    name: z.string().min(1).max(255),
    creditHours: z.number().int().min(0).max(32767).default(3),
    status: z.boolean().default(true),
  });
  const createCourse = async (programId: number | null, body: unknown, req: any, reply: any) => {
    if (!programId) return send400(reply, 'programId is required');
    const parsed = courseBody.safeParse(body);
    if (!parsed.success) return send400(reply, 'Invalid course payload', parsed.error.flatten());
    const caller = await callerSchoolOf(req, reply);
    if (!caller) return reply;
    if (!caller.isSuperAdmin && (await schoolOfProgram(programId)) !== caller.schoolId) return forbiddenOtherSchool(reply);
    // `course.program_id` is a NOT NULL FK: a missing program answers 400.
    const created = await repos.courses.create({ ...parsed.data, programId });
    return reply.code(201).send(created);
  };
  app.post('/api/v1/programs/:programId/courses', async (req, reply) =>
    createCourse(parseId((req.params as any).programId), (req as any).body, req, reply),
  );
  app.post('/api/v1/courses', async (req, reply) => {
    const body = ((req as any).body ?? {}) as Record<string, unknown>;
    const programId = Number(body.programId);
    if (!Number.isInteger(programId)) return send400(reply, 'programId is required');
    return createCourse(programId, body, req, reply);
  });
  app.get('/api/v1/courses', async (req, reply) => {
    const caller = await callerSchoolOf(req, reply);
    if (!caller) return reply;
    if (caller.isSuperAdmin) {
      return pageOf(req, reply, (page) => repos.courses.list(page), () => repos.courses.count());
    }
    const schoolId = caller.schoolId ?? -1;
    return pageOf(req, reply, (page) => coursesOfSchool(schoolId, page), () => countCoursesOfSchool(schoolId));
  });
  app.get('/api/v1/courses/:id', async (req, reply) => {
    const id = parseId((req.params as any).id);
    const found = id ? await repos.courses.findById(id) : null;
    if (!found) return notFound(reply);
    const caller = await callerSchoolOf(req, reply);
    if (!caller) return reply;
    if (!caller.isSuperAdmin && (await schoolOfProgram(found.programId)) !== caller.schoolId) return notFound(reply);
    return found;
  });
  app.put('/api/v1/courses/:id', async (req, reply) => {
    const id = parseId((req.params as any).id);
    const found = id ? await repos.courses.findById(id) : null;
    if (!found) return notFound(reply);
    const parsed = patchSchema(courseBody).safeParse((req as any).body);
    if (!parsed.success) return send400(reply, 'Invalid course payload', parsed.error.flatten());
    const caller = await callerSchoolOf(req, reply);
    if (!caller) return reply;
    if (!caller.isSuperAdmin) {
      if ((await schoolOfProgram(found.programId)) !== caller.schoolId) return notFound(reply);
      if (parsed.data.programId !== undefined) {
        const targetSchool = await schoolOfProgram(parsed.data.programId);
        if (targetSchool !== caller.schoolId) return forbiddenOtherSchool(reply);
      }
    }
    const updated = await repos.courses.update(id as number, parsed.data);
    return updated ?? notFound(reply);
  });
  app.delete('/api/v1/courses/:id', async (req, reply) => {
    // Deleting a course is reserved to Super Administrador (frontend: canDeleteCourse).
    const caller = await callerSchoolOf(req, reply);
    if (!caller) return reply;
    if (!mayDeleteCourse(caller)) {
      return reply.code(403).send({ error: 'Forbidden', message: 'Only Super Administrador deletes courses', timestamp: new Date().toISOString() });
    }
    const id = parseId((req.params as any).id);
    const found = id ? await repos.courses.findById(id) : null;
    if (!found) return notFound(reply);
    if (!(await repos.courses.softDelete(id as number))) return notFound(reply);
    return reply.code(204).send();
  });
  app.get('/api/v1/programs/:programId/courses', async (req, reply) => {
    const programId = parseId((req.params as any).programId);
    if (!programId) return [];
    const caller = await callerSchoolOf(req, reply);
    if (!caller) return reply;
    if (!caller.isSuperAdmin && (await schoolOfProgram(programId)) !== caller.schoolId) return forbiddenOtherSchool(reply);
    return pageOf(
      req,
      reply,
      (page) => repos.courses.findByProgram(programId, page),
      () => repos.courses.countByProgram(programId),
    );
  });

  // ---------- Actor types ----------
  // Seeded by Liquibase (1=STUDENT, 2=INSTRUCTOR); nothing is seeded at boot.
  const actorTypeBody = z.object({
    code: z.string().min(1).max(50),
    name: z.string().min(1).max(255),
  });
  app.post('/api/v1/actor-types', async (req, reply) => {
    const parsed = actorTypeBody.safeParse((req as any).body);
    if (!parsed.success) return send400(reply, 'Invalid actor-type payload', parsed.error.flatten());
    // Un code retirado sigue ocupando el UNIQUE, así que crearlo de nuevo daba 409
    // para siempre. Si existe borrado, se revive en vez de rechazar.
    const revived = await repos.actorTypes.restoreByCode(parsed.data.code, parsed.data.name);
    if (revived) return reply.code(201).send(revived);
    const created = await repos.actorTypes.create(parsed.data);
    return reply.code(201).send(created);
  });
  app.get('/api/v1/actor-types', async (req, reply) =>
    pageOf(req, reply, (page) => repos.actorTypes.list(page), () => repos.actorTypes.count()),
  );
  app.get('/api/v1/actor-types/:id', async (req, reply) => {
    const id = parseId((req.params as any).id);
    const found = id ? await repos.actorTypes.findById(id) : null;
    if (!found) return reply.code(404).send({ error: 'NotFound' });
    return found;
  });
  app.put('/api/v1/actor-types/:id', async (req, reply) => {
    const id = parseId((req.params as any).id);
    if (!id) return reply.code(404).send({ error: 'NotFound' });
    const parsed = patchSchema(actorTypeBody).safeParse((req as any).body);
    if (!parsed.success) return send400(reply, 'Invalid actor-type payload', parsed.error.flatten());
    const updated = await repos.actorTypes.update(id, parsed.data);
    if (!updated) return reply.code(404).send({ error: 'NotFound' });
    return updated;
  });
  app.delete('/api/v1/actor-types/:id', async (req, reply) => {
    const id = parseId((req.params as any).id);
    if (!id || !(await repos.actorTypes.softDelete(id))) return reply.code(404).send({ error: 'NotFound' });
    return reply.code(204).send();
  });

  // ---------- Academic actors ----------
  // `academic_actor.person_id` is a native UUID column (cross-context reference to
  // identity.person, no FK), so the payload must be valid UUID text.
  const actorBody = z.object({
    personId: z.string().uuid(),
    actorTypeId: z.number().int().default(1),
    schoolId: z.number().int(),
    actorCode: z.string().min(1).max(50),
    startedOn: z.string().min(1).default(new Date().toISOString().slice(0, 10)),
    endedOn: z.string().nullable().optional(),
    status: z.boolean().default(true),
  });
  app.post('/api/v1/academic-actors', async (req, reply) => {
    const parsed = actorBody.safeParse((req as any).body);
    if (!parsed.success) return send400(reply, 'Invalid actor payload', parsed.error.flatten());
    const caller = await callerSchoolOf(req, reply);
    if (!caller) return reply;
    if (!caller.isSuperAdmin && parsed.data.schoolId !== caller.schoolId) return forbiddenOtherSchool(reply);
    const created = await repos.actors.create(parsed.data);
    return reply.code(201).send(created);
  });
  // ?personId= resuelve en una peticion a que sede pertenece quien inicia sesion (o a
  // la de un tercero); sin el, la coleccion completa — ambos acotados a la sede del
  // llamante salvo Super Administrador.
  app.get('/api/v1/academic-actors', async (req, reply) => {
    const personId = (req.query as any)?.personId;
    const caller = await callerSchoolOf(req, reply);
    if (!caller) return reply;
    if (typeof personId === 'string' && personId.length > 0) {
      const all = await repos.actors.findByPerson(personId);
      const scoped = caller.isSuperAdmin ? all : all.filter((a) => a.schoolId === caller.schoolId);
      return pageOfArray(scoped, req, reply);
    }
    if (caller.isSuperAdmin) {
      return pageOf(req, reply, (page) => repos.actors.list(page), () => repos.actors.count());
    }
    const schoolId = caller.schoolId ?? -1;
    return pageOf(
      req,
      reply,
      (page) => repos.actors.findBySchool(schoolId, page),
      () => repos.actors.countBySchool(schoolId),
    );
  });
  app.get('/api/v1/academic-actors/:id', async (req, reply) => {
    const id = parseId((req.params as any).id);
    const found = id ? await repos.actors.findById(id) : null;
    if (!found) return notFound(reply);
    const caller = await callerSchoolOf(req, reply);
    if (!caller) return reply;
    if (!caller.isSuperAdmin && found.schoolId !== caller.schoolId) return notFound(reply);
    return found;
  });
  app.put('/api/v1/academic-actors/:id', async (req, reply) => {
    const id = parseId((req.params as any).id);
    const found = id ? await repos.actors.findById(id) : null;
    if (!found) return notFound(reply);
    const parsed = patchSchema(actorBody).safeParse((req as any).body);
    if (!parsed.success) return send400(reply, 'Invalid actor payload', parsed.error.flatten());
    const caller = await callerSchoolOf(req, reply);
    if (!caller) return reply;
    if (!caller.isSuperAdmin) {
      if (found.schoolId !== caller.schoolId) return notFound(reply);
      if (parsed.data.schoolId !== undefined && parsed.data.schoolId !== caller.schoolId) return forbiddenOtherSchool(reply);
    }
    const updated = await repos.actors.update(id as number, parsed.data);
    return updated ?? notFound(reply);
  });
  app.patch('/api/v1/academic-actors/:id/status', async (req, reply) => {
    const parsed = z.object({ status: z.boolean() }).safeParse((req as any).body);
    if (!parsed.success) return send400(reply, 'Invalid status payload');
    const id = parseId((req.params as any).id);
    const found = id ? await repos.actors.findById(id) : null;
    if (!found) return notFound(reply);
    const caller = await callerSchoolOf(req, reply);
    if (!caller) return reply;
    if (!caller.isSuperAdmin && found.schoolId !== caller.schoolId) return notFound(reply);
    const updated = await repos.actors.update(id as number, parsed.data);
    return updated ?? notFound(reply);
  });
  app.delete('/api/v1/academic-actors/:id', async (req, reply) => {
    const id = parseId((req.params as any).id);
    const found = id ? await repos.actors.findById(id) : null;
    if (!found) return notFound(reply);
    const caller = await callerSchoolOf(req, reply);
    if (!caller) return reply;
    if (!caller.isSuperAdmin && found.schoolId !== caller.schoolId) return notFound(reply);
    if (!(await repos.actors.softDelete(id as number))) return notFound(reply);
    return reply.code(204).send();
  });
  app.get('/api/v1/schools/:schoolId/actors', async (req, reply) => {
    const schoolId = parseId((req.params as any).schoolId);
    if (!schoolId) return [];
    const caller = await callerSchoolOf(req, reply);
    if (!caller) return reply;
    if (!caller.isSuperAdmin && schoolId !== caller.schoolId) return forbiddenOtherSchool(reply);
    return pageOf(
      req,
      reply,
      (page) => repos.actors.findBySchool(schoolId, page),
      () => repos.actors.countBySchool(schoolId),
    );
  });

  // ---------- Enrollments ----------
  const enrollmentBody = z.object({
    academicActorId: z.number().int(),
    cohortId: z.number().int(),
    enrolledOn: z.string().min(1).default(new Date().toISOString().slice(0, 10)),
    enrollmentStatus: z.enum(['Active', 'Withdrawn', 'Completed']).default('Active'),
  });
  app.post('/api/v1/enrollments', async (req, reply) => {
    const parsed = enrollmentBody.safeParse((req as any).body);
    if (!parsed.success) return send400(reply, 'Invalid enrollment payload', parsed.error.flatten());
    const caller = await callerSchoolOf(req, reply);
    if (!caller) return reply;
    if (!caller.isSuperAdmin) {
      const [actorSchool, cohortSchool] = await Promise.all([
        schoolOfActor(parsed.data.academicActorId),
        schoolOfCohort(parsed.data.cohortId),
      ]);
      if (actorSchool !== caller.schoolId || cohortSchool !== caller.schoolId) return forbiddenOtherSchool(reply);
    }
    // Re-enrolling someone who was unenrolled brings their old row back (see createOrRestore).
    const created = await repos.enrollments.createOrRestore(parsed.data);
    return reply.code(201).send(created);
  });
  app.get('/api/v1/enrollments', async (req, reply) => {
    const caller = await callerSchoolOf(req, reply);
    if (!caller) return reply;
    if (caller.isSuperAdmin) {
      return pageOf(req, reply, (page) => repos.enrollments.list(page), () => repos.enrollments.count());
    }
    const schoolId = caller.schoolId ?? -1;
    return pageOf(req, reply, (page) => enrollmentsOfSchool(schoolId, page), () => countEnrollmentsOfSchool(schoolId));
  });
  app.get('/api/v1/enrollments/:id', async (req, reply) => {
    const id = parseId((req.params as any).id);
    const found = id ? await repos.enrollments.findById(id) : null;
    if (!found) return notFound(reply);
    const caller = await callerSchoolOf(req, reply);
    if (!caller) return reply;
    if (!caller.isSuperAdmin && (await schoolOfActor(found.academicActorId)) !== caller.schoolId) return notFound(reply);
    return found;
  });
  app.patch('/api/v1/enrollments/:id/status', async (req, reply) => {
    const parsed = z
      .object({ enrollmentStatus: z.enum(['Active', 'Withdrawn', 'Completed']) })
      .safeParse((req as any).body);
    if (!parsed.success) return send400(reply, 'Invalid enrollment status');
    const id = parseId((req.params as any).id);
    const found = id ? await repos.enrollments.findById(id) : null;
    if (!found) return notFound(reply);
    const caller = await callerSchoolOf(req, reply);
    if (!caller) return reply;
    if (!caller.isSuperAdmin && (await schoolOfActor(found.academicActorId)) !== caller.schoolId) return notFound(reply);
    const updated = await repos.enrollments.update(id as number, parsed.data);
    return updated ?? notFound(reply);
  });
  app.put('/api/v1/enrollments/:id', async (req, reply) => {
    const id = parseId((req.params as any).id);
    const found = id ? await repos.enrollments.findById(id) : null;
    if (!found) return notFound(reply);
    const parsed = patchSchema(enrollmentBody).safeParse((req as any).body);
    if (!parsed.success) return send400(reply, 'Invalid enrollment payload', parsed.error.flatten());
    const caller = await callerSchoolOf(req, reply);
    if (!caller) return reply;
    if (!caller.isSuperAdmin) {
      if ((await schoolOfActor(found.academicActorId)) !== caller.schoolId) return notFound(reply);
      if (parsed.data.academicActorId !== undefined && (await schoolOfActor(parsed.data.academicActorId)) !== caller.schoolId) {
        return forbiddenOtherSchool(reply);
      }
      if (parsed.data.cohortId !== undefined && (await schoolOfCohort(parsed.data.cohortId)) !== caller.schoolId) {
        return forbiddenOtherSchool(reply);
      }
    }
    const updated = await repos.enrollments.update(id as number, parsed.data);
    return updated ?? notFound(reply);
  });
  app.delete('/api/v1/enrollments/:id', async (req, reply) => {
    const id = parseId((req.params as any).id);
    const found = id ? await repos.enrollments.findById(id) : null;
    if (!found) return notFound(reply);
    const caller = await callerSchoolOf(req, reply);
    if (!caller) return reply;
    if (!caller.isSuperAdmin && (await schoolOfActor(found.academicActorId)) !== caller.schoolId) return notFound(reply);
    if (!(await repos.enrollments.softDelete(id as number))) return notFound(reply);
    return reply.code(204).send();
  });
  app.get('/api/v1/cohorts/:cohortId/enrollments', async (req, reply) => {
    const cohortId = parseId((req.params as any).cohortId);
    if (!cohortId) return [];
    const caller = await callerSchoolOf(req, reply);
    if (!caller) return reply;
    if (!caller.isSuperAdmin && (await schoolOfCohort(cohortId)) !== caller.schoolId) return forbiddenOtherSchool(reply);
    return pageOf(
      req,
      reply,
      (page) => repos.enrollments.findByCohort(cohortId, page),
      () => repos.enrollments.countByCohort(cohortId),
    );
  });
  app.get('/api/v1/academic-actors/:actorId/enrollments', async (req, reply) => {
    const actorId = parseId((req.params as any).actorId);
    if (!actorId) return [];
    const caller = await callerSchoolOf(req, reply);
    if (!caller) return reply;
    if (!caller.isSuperAdmin && (await schoolOfActor(actorId)) !== caller.schoolId) return forbiddenOtherSchool(reply);
    return pageOf(
      req,
      reply,
      (page) => repos.enrollments.findByAcademicActor(actorId, page),
      () => repos.enrollments.countByAcademicActor(actorId),
    );
  });
}
