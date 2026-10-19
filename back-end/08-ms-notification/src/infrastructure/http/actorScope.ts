import type { FastifyRequest } from 'fastify';

/**
 * Actor scope of the caller, same rule as the Java services (05-attendance
 * CallerScopeResolver) and the Go handler this ports
 * (internal/infrastructure/http/handler/actor_scope.go): Super Administrador
 * sees every alert (null scope, no school of its own); Administrador sees
 * only the alerts of actors in its own school; everyone else sees the alerts
 * of their own academic actors plus, for instructors, the active students of
 * the cohorts they teach. Cached 60 s per user.
 */

/** Thrown when the scope cannot be resolved; the route answers with this status. */
export class ScopeError extends Error {
  constructor(readonly statusCode: 403 | 503, message: string) {
    super(message);
  }
}

const SUPER_ADMIN_ROLE = 'Super Administrador';
const SCHOOL_ADMIN_ROLE = 'Administrador';
const ACTOR_PAGE_SIZE = 100;
const CACHE_TTL_MS = 60_000;
const RETRY_PAUSE_MS = 250;

interface ActorRow {
  academicActorId: number;
  personId?: string;
  schoolId?: number | null;
}

const cache = new Map<string, { value: Set<number>; expiresAt: number }>();

/** Test hook: forget what has been resolved so far. */
export function clearActorScopeCache(): void {
  cache.clear();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Transport failure (status 0) or a 5xx answer; 4xx are final. */
function isTransient(status: number): boolean {
  return status === 0 || status >= 500;
}

async function fetchOnce(url: string, token: string): Promise<{ status: number; body: any }> {
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const body = res.ok ? await res.json().catch(() => null) : null;
    return { status: res.status, body };
  } catch {
    return { status: 0, body: null };
  }
}

/**
 * getJson that treats any non-200 answer as an error: a partial scope must
 * never widen what the caller can see. One retry after a short pause on a
 * transient failure (transport error or 5xx); a 4xx is final.
 */
async function getJsonStrict(url: string, token: string): Promise<any> {
  let result = await fetchOnce(url, token);
  if (result.status !== 200 && isTransient(result.status)) {
    await sleep(RETRY_PAUSE_MS);
    result = await fetchOnce(url, token);
  }
  if (result.status !== 200) {
    const code = isTransient(result.status) ? 503 : 403;
    throw new ScopeError(code, `GET ${url} answered ${result.status}`);
  }
  return result.body;
}

function store(userId: string, now: number, value: Set<number>): Set<number> {
  cache.set(userId, { value, expiresAt: now + CACHE_TTL_MS });
  return value;
}

/**
 * Resolves the academic-actor scope of an authenticated request (the auth
 * guard has already validated the session and set `userId` / `authToken`).
 * `null` = unrestricted (Super Administrador); otherwise the set of
 * academic_actor_id the caller may see. Only positive, fully-resolved scopes
 * are cached, mirroring `callerSchool.ts`.
 */
export async function resolveActorScope(req: FastifyRequest): Promise<Set<number> | null> {
  const userId = (req as any).userId as string | undefined;
  const token = (req as any).authToken as string | undefined;
  if (!userId || !token) throw new ScopeError(403, 'No authenticated user');

  const authorizationUrl = process.env.AUTHORIZATION_URL || 'http://localhost:8082';
  const identityUrl = process.env.IDENTITY_URL || 'http://localhost:8081';
  const academicUrl = process.env.ACADEMIC_URL || 'http://localhost:8083';
  const schedulingUrl = process.env.SCHEDULING_URL || 'http://localhost:8084';

  const roles = await getJsonStrict(
    `${authorizationUrl}/api/v1/users/${encodeURIComponent(userId)}/roles`,
    token,
  );
  let isSuperAdmin = false;
  let isSchoolAdmin = false;
  if (Array.isArray(roles)) {
    for (const r of roles) {
      if (r?.roleName === SUPER_ADMIN_ROLE) isSuperAdmin = true;
      if (r?.roleName === SCHOOL_ADMIN_ROLE) isSchoolAdmin = true;
    }
  }
  if (isSuperAdmin) return null;

  const now = Date.now();
  const cached = cache.get(userId);
  if (cached && cached.expiresAt > now) return cached.value;

  const user = await getJsonStrict(`${identityUrl}/api/v1/users/${encodeURIComponent(userId)}`, token);
  const personId = user?.personId;
  if (typeof personId !== 'string' || !personId) {
    return store(userId, now, new Set());
  }

  // ?personId= filters in academic: the caller's own actor without walking
  // the capped listing.
  const ownActors = await getJsonStrict(
    `${academicUrl}/api/v1/academic-actors?personId=${encodeURIComponent(personId)}`,
    token,
  );
  const scope = new Set<number>();
  const own: number[] = [];
  if (Array.isArray(ownActors)) {
    for (const a of ownActors as ActorRow[]) {
      if (typeof a?.personId === 'string' && a.personId.toLowerCase() === personId.toLowerCase()) {
        scope.add(a.academicActorId);
        own.push(a.academicActorId);
      }
    }
  }

  if (isSchoolAdmin) {
    // School admin: the school is deduced from the full listing, walked page
    // by page.
    const all: ActorRow[] = [];
    for (let offset = 0; ; offset += ACTOR_PAGE_SIZE) {
      const page = await getJsonStrict(
        `${academicUrl}/api/v1/academic-actors?limit=${ACTOR_PAGE_SIZE}&offset=${offset}`,
        token,
      );
      const list: ActorRow[] = Array.isArray(page) ? page : [];
      all.push(...list);
      if (list.length < ACTOR_PAGE_SIZE) break;
    }

    // School admin: only the actors of its own school, never other
    // institutions' (unlike Super Administrador = null).
    const ownSchools = new Set<number>();
    for (const a of all) {
      if (scope.has(a.academicActorId) && a.schoolId != null) ownSchools.add(a.schoolId);
    }
    let adminScope: Set<number>;
    if (ownSchools.size > 0) {
      adminScope = new Set();
      for (const a of all) {
        if (a.schoolId != null && ownSchools.has(a.schoolId)) adminScope.add(a.academicActorId);
      }
    } else {
      // No school of its own (should not happen for an Administrador): fail
      // secure, own actors only, never fall back to "see everything".
      adminScope = scope;
    }
    return store(userId, now, adminScope);
  }

  for (const actorId of own) {
    const blocks = await getJsonStrict(
      `${schedulingUrl}/api/v1/schedule-blocks?instructorActorId=${actorId}`,
      token,
    );
    const blockList: Array<{ cohortId?: number }> = Array.isArray(blocks) ? blocks : [];
    for (const b of blockList) {
      if (b?.cohortId == null) continue;
      const enrollments = await getJsonStrict(
        `${academicUrl}/api/v1/cohorts/${b.cohortId}/enrollments`,
        token,
      );
      const enrollList: Array<{ academicActorId: number; enrollmentStatus?: string }> = Array.isArray(
        enrollments,
      )
        ? enrollments
        : [];
      for (const e of enrollList) {
        if (e?.enrollmentStatus === 'Active') scope.add(e.academicActorId);
      }
    }
  }
  return store(userId, now, scope);
}

/** Reports whether the request's scope (if any) includes actorId. */
export function actorAllowed(scope: Set<number> | null, actorId: number): boolean {
  return scope === null || scope.has(actorId);
}
