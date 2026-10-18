import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { ConfigurationRepositories } from '../persistence/postgres';
import { resolveCaseScope, caseScopeAllows, ScopeError, type CaseScope } from './caseScope';
import { resolveCallerSchool, ScopeError as SchoolScopeError, type CallerSchool } from './callerSchool';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const academicBody = z.object({
  schoolId: z.number().int(),
  configurationName: z.string().min(1),
  configurationValue: z.string(),
  description: z.string().optional(),
});

const securityBody = z.object({
  configurationName: z.string().min(1),
  configurationValue: z.string(),
  description: z.string().optional(),
});

const caseBody = z.object({
  personId: z.string().uuid(),
  biometricType: z.enum(['FACIAL', 'FINGERPRINT']),
  fingerNumber: z.number().int().min(1).max(10).nullable().optional(),
  currentEmbeddingRef: z.string().nullable().optional(),
  reason: z.string().min(1),
  requestedBy: z.string().uuid().nullable().optional(),
});

const reviewBody = z.object({
  updateStatus: z.enum(['In_Review', 'Approved', 'Rejected']),
  reviewedBy: z.string().uuid().optional(),
  resolutionNotes: z.string().optional(),
});

type Req = FastifyRequest;
type Reply = FastifyReply;

function badRequest(reply: Reply, details: unknown, message?: string) {
  return reply.code(400).send({ error: 'BadRequest', ...(message ? { message } : {}), details, timestamp: new Date().toISOString() });
}

/** Resolves who the caller may see; answers 403/503 itself when it cannot. */
async function scopeOf(req: Req, reply: Reply): Promise<CaseScope | null> {
  try {
    return await resolveCaseScope(req);
  } catch (err) {
    if (err instanceof ScopeError) {
      reply.code(err.statusCode).send({ error: err.statusCode === 403 ? 'Forbidden' : 'ServiceUnavailable', message: err.message, timestamp: new Date().toISOString() });
      return null;
    }
    throw err;
  }
}

/** Resolves the school the caller may manage; answers 403/503 itself when it cannot. */
async function callerSchoolOf(req: Req, reply: Reply): Promise<CallerSchool | null> {
  try {
    return await resolveCallerSchool(req);
  } catch (err) {
    if (err instanceof SchoolScopeError) {
      reply.code(err.statusCode).send({ error: err.statusCode === 403 ? 'Forbidden' : 'ServiceUnavailable', message: err.message, timestamp: new Date().toISOString() });
      return null;
    }
    throw err;
  }
}

function forbiddenOtherSchool(reply: Reply) {
  return reply.code(403).send({ error: 'Forbidden', message: 'You can only manage your own school', timestamp: new Date().toISOString() });
}

function notFound(reply: Reply) {
  return reply.code(404).send({ error: 'NotFound', timestamp: new Date().toISOString() });
}

/** Numeric path id, or `null` when it is not a positive integer (answered as 404). */
function intId(req: Req): number | null {
  const n = Number((req.params as any).id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Pagination is opt-in: without `limit`/`offset` the full list is returned, as before. */
function pagination(req: Req): { limit?: number; offset?: number } | null {
  const q = (req.query as any) ?? {};
  if (q.limit === undefined && q.offset === undefined) return null;
  let limit = Number(q.limit ?? 20);
  let offset = Number(q.offset ?? 0);
  if (!Number.isInteger(limit) || limit <= 0) limit = 20;
  if (!Number.isInteger(offset) || offset < 0) offset = 0;
  return { limit: Math.min(limit, 100), offset };
}

async function paged<T>(
  req: Req,
  reply: Reply,
  fetch: (page: { limit?: number; offset?: number }) => Promise<T[]>,
  total: () => Promise<number>,
): Promise<T[]> {
  const page = pagination(req);
  if (!page) return fetch({});
  reply.header('x-total-count', await total());
  return fetch(page);
}

function registerAcademicConfigRoutes(app: FastifyInstance, repos: ConfigurationRepositories, base: string) {
  app.post(base, async (req, reply) => {
    const parsed = academicBody.safeParse((req as any).body);
    if (!parsed.success) return badRequest(reply, parsed.error.flatten());
    const caller = await callerSchoolOf(req, reply);
    if (!caller) return reply;
    if (!caller.isSuperAdmin && parsed.data.schoolId !== caller.schoolId) return forbiddenOtherSchool(reply);
    return reply.code(201).send(await repos.academic.create(parsed.data));
  });
  app.get(base, async (req, reply) => {
    const name = ((req.query as any) ?? {}).name as string | undefined;
    const caller = await callerSchoolOf(req, reply);
    if (!caller) return reply;
    // Administrador only ever sees its own school; Super Administrador sees all.
    const schoolId = caller.isSuperAdmin ? undefined : caller.schoolId ?? -1;
    return paged(
      req,
      reply,
      (page) => repos.academic.search({ name, schoolId, ...page }),
      () => repos.academic.countMatching({ name, schoolId }),
    );
  });
  app.get(`${base}/:id`, async (req, reply) => {
    const id = intId(req);
    const found = id ? await repos.academic.findById(id) : null;
    if (!found) return notFound(reply);
    const caller = await callerSchoolOf(req, reply);
    if (!caller) return reply;
    // Someone else's school configuration looks exactly like a missing one.
    if (!caller.isSuperAdmin && found.schoolId !== caller.schoolId) return notFound(reply);
    return found;
  });
  app.put(`${base}/:id`, async (req, reply) => {
    const parsed = academicBody.partial().safeParse((req as any).body ?? {});
    if (!parsed.success) return badRequest(reply, parsed.error.flatten());
    const id = intId(req);
    const found = id ? await repos.academic.findById(id) : null;
    if (!found) return notFound(reply);
    const caller = await callerSchoolOf(req, reply);
    if (!caller) return reply;
    if (!caller.isSuperAdmin) {
      if (found.schoolId !== caller.schoolId) return notFound(reply);
      // Never let a school Administrador move a row into another school.
      if (parsed.data.schoolId !== undefined && parsed.data.schoolId !== caller.schoolId) return forbiddenOtherSchool(reply);
    }
    const updated = await repos.academic.update(id as number, parsed.data);
    return updated ?? notFound(reply);
  });
  app.delete(`${base}/:id`, async (req, reply) => {
    const id = intId(req);
    const found = id ? await repos.academic.findById(id) : null;
    if (!found) return notFound(reply);
    const caller = await callerSchoolOf(req, reply);
    if (!caller) return reply;
    if (!caller.isSuperAdmin && found.schoolId !== caller.schoolId) return notFound(reply);
    if (!(await repos.academic.softDelete(id as number))) return notFound(reply);
    return reply.code(204).send();
  });
}

/** security_configuration is platform-global (MODELO.md §4.7) — only Super Administrador writes it. */
async function requireSuperAdmin(req: Req, reply: Reply): Promise<boolean> {
  const caller = await callerSchoolOf(req, reply);
  if (!caller) return false;
  if (!caller.isSuperAdmin) {
    reply.code(403).send({ error: 'Forbidden', message: 'Only Super Administrador manages global security configuration', timestamp: new Date().toISOString() });
    return false;
  }
  return true;
}

function registerSecurityConfigRoutes(app: FastifyInstance, repos: ConfigurationRepositories, base: string) {
  app.post(base, async (req, reply) => {
    const parsed = securityBody.safeParse((req as any).body);
    if (!parsed.success) return badRequest(reply, parsed.error.flatten());
    if (!(await requireSuperAdmin(req, reply))) return reply;
    return reply.code(201).send(await repos.security.create(parsed.data));
  });
  app.get(base, async (req, reply) => {
    const name = ((req.query as any) ?? {}).name as string | undefined;
    return paged(
      req,
      reply,
      (page) => repos.security.search({ name, ...page }),
      () => repos.security.countMatching({ name }),
    );
  });
  app.get(`${base}/:id`, async (req, reply) => {
    const id = intId(req);
    const found = id ? await repos.security.findById(id) : null;
    return found ?? notFound(reply);
  });
  app.put(`${base}/:id`, async (req, reply) => {
    const parsed = securityBody.partial().safeParse((req as any).body ?? {});
    if (!parsed.success) return badRequest(reply, parsed.error.flatten());
    if (!(await requireSuperAdmin(req, reply))) return reply;
    const id = intId(req);
    const updated = id ? await repos.security.update(id, parsed.data) : null;
    return updated ?? notFound(reply);
  });
  app.delete(`${base}/:id`, async (req, reply) => {
    if (!(await requireSuperAdmin(req, reply))) return reply;
    const id = intId(req);
    if (!id || !(await repos.security.softDelete(id))) return notFound(reply);
    return reply.code(204).send();
  });
}

export async function registerConfigurationRoutes(app: FastifyInstance, repos: ConfigurationRepositories) {
  // SERVICE.md canonical bases
  registerAcademicConfigRoutes(app, repos, '/api/v1/configurations/academic');
  registerSecurityConfigRoutes(app, repos, '/api/v1/configurations/security');
  // Kong aliases (kong.yml) for gateway prefix matching
  registerAcademicConfigRoutes(app, repos, '/api/v1/academic-configurations');
  registerSecurityConfigRoutes(app, repos, '/api/v1/security-configurations');

  // Schools -> academic configs
  app.get('/api/v1/schools/:schoolId/configurations', async (req, reply) => {
    const schoolId = Number((req.params as any).schoolId);
    if (!Number.isInteger(schoolId)) return reply.send([]);
    const caller = await callerSchoolOf(req, reply);
    if (!caller) return reply;
    if (!caller.isSuperAdmin && schoolId !== caller.schoolId) return forbiddenOtherSchool(reply);
    return paged(
      req,
      reply,
      (page) => repos.academic.search({ schoolId, ...page }),
      () => repos.academic.countMatching({ schoolId }),
    );
  });

  // ---------- Biometric update cases ----------
  app.post('/api/v1/biometric-update-cases', async (req, reply) => {
    const parsed = caseBody.safeParse((req as any).body);
    if (!parsed.success) return badRequest(reply, parsed.error.flatten());
    const data = parsed.data;
    const scope = await scopeOf(req, reply);
    if (!scope) return reply;
    if (!caseScopeAllows(scope, data.personId)) {
      return reply.code(403).send({ error: 'Forbidden', message: 'You can only request an update for your own biometric data', timestamp: new Date().toISOString() });
    }
    if (data.biometricType === 'FINGERPRINT' && !data.fingerNumber) {
      return badRequest(reply, undefined, 'fingerNumber required for FINGERPRINT');
    }
    // The requester is the authenticated user unless the caller states one.
    const requestedBy = data.requestedBy ?? ((req as any).userId as string | undefined);
    if (!requestedBy || !UUID_RE.test(requestedBy)) {
      return badRequest(reply, undefined, 'requestedBy is required');
    }
    const created = await repos.cases.create({
      caseId: randomUUID(),
      personId: data.personId,
      biometricType: data.biometricType,
      // chk_finger_number: a facial case never carries a finger.
      fingerNumber: data.biometricType === 'FACIAL' ? null : data.fingerNumber,
      currentEmbeddingRef: data.currentEmbeddingRef ?? null,
      reason: data.reason,
      updateStatus: 'Pending',
      requestedBy,
      requestedAt: new Date().toISOString(),
    });
    return reply.code(201).send(created);
  });
  app.get('/api/v1/biometric-update-cases', async (req, reply) => {
    const status = ((req.query as any) ?? {}).status as string | undefined;
    const scope = await scopeOf(req, reply);
    if (!scope) return reply;
    const scopeQuery = scope.all ? {} : 'personIds' in scope ? { personIds: scope.personIds } : { personId: scope.personId };
    return paged(
      req,
      reply,
      (page) => repos.cases.search({ status, ...scopeQuery, ...page }),
      () => repos.cases.countMatching({ status, ...scopeQuery }),
    );
  });
  app.get('/api/v1/biometric-update-cases/:id', async (req, reply) => {
    const id = String((req.params as any).id);
    const found = UUID_RE.test(id) ? await repos.cases.findById(id) : null;
    if (!found) return notFound(reply);
    const scope = await scopeOf(req, reply);
    if (!scope) return reply;
    // Someone else's case looks exactly like a missing one.
    if (!caseScopeAllows(scope, found.personId)) return notFound(reply);
    return found;
  });
  app.put('/api/v1/biometric-update-cases/:id', async (req, reply) => {
    const parsed = caseBody.partial().safeParse((req as any).body ?? {});
    if (!parsed.success) return badRequest(reply, parsed.error.flatten());
    const id = String((req.params as any).id);
    const found = UUID_RE.test(id) ? await repos.cases.findById(id) : null;
    if (!found) return notFound(reply);
    const scope = await scopeOf(req, reply);
    if (!scope) return reply;
    if (!caseScopeAllows(scope, found.personId)) return notFound(reply);
    const updated = await repos.cases.update(id, parsed.data);
    return updated ?? notFound(reply);
  });
  app.patch('/api/v1/biometric-update-cases/:id/review', async (req, reply) => {
    const parsed = reviewBody.safeParse((req as any).body);
    if (!parsed.success) return badRequest(reply, parsed.error.flatten());
    const id = String((req.params as any).id);
    const reviewer = parsed.data.reviewedBy ?? ((req as any).userId as string | undefined);
    const caller = (req as any).userId as string | undefined;
    const found = UUID_RE.test(id) ? await repos.cases.findById(id) : null;
    if (!found) return notFound(reply);
    const scope = await scopeOf(req, reply);
    if (!scope) return reply;
    // Un admin/instructor de otra sede no puede revisar un caso ajeno a la suya.
    if (!caseScopeAllows(scope, found.personId)) return notFound(reply);
    // Separation of duties (RN-29): nobody approves or rejects their own request.
    if (caller && found.requestedBy === caller) {
      return reply.code(403).send({ error: 'Forbidden', message: 'You cannot review your own request', timestamp: new Date().toISOString() });
    }
    const updated = await repos.cases.update(id, {
      updateStatus: parsed.data.updateStatus,
      reviewedBy: reviewer ?? null,
      reviewedAt: new Date().toISOString(),
      ...(parsed.data.resolutionNotes !== undefined ? { resolutionNotes: parsed.data.resolutionNotes } : {}),
    });
    return updated ?? notFound(reply);
  });
  app.delete('/api/v1/biometric-update-cases/:id', async (req, reply) => {
    const id = String((req.params as any).id);
    const found = UUID_RE.test(id) ? await repos.cases.findById(id) : null;
    if (!found) return notFound(reply);
    const scope = await scopeOf(req, reply);
    if (!scope) return reply;
    if (!caseScopeAllows(scope, found.personId)) return notFound(reply);
    if (!(await repos.cases.softDelete(id))) return notFound(reply);
    return reply.code(204).send();
  });
  app.get('/api/v1/persons/:personId/biometric-cases', async (req, reply) => {
    const personId = String((req.params as any).personId);
    if (!UUID_RE.test(personId)) return reply.send([]);
    const scope = await scopeOf(req, reply);
    if (!scope) return reply;
    if (!caseScopeAllows(scope, personId)) {
      return reply.code(403).send({ error: 'Forbidden', message: 'You can only list your own cases', timestamp: new Date().toISOString() });
    }
    return paged(
      req,
      reply,
      (page) => repos.cases.search({ personId, ...page }),
      () => repos.cases.countMatching({ personId }),
    );
  });
}
