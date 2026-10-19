import type { FastifyRequest } from 'fastify';
import { getJson } from './authGuard';

/**
 * Whose biometric update cases a caller may see.
 *  - `all`: Super Administrador (no school of its own) sees every case.
 *  - `personIds`: reviewers (permission `biometric.case:review` — Administrador,
 *    Instructor) see the cases of persons in their own school, never other
 *    institutions'.
 *  - `personId`: anyone else sees only their own cases.
 */
export type CaseScope =
  | { readonly all: true }
  | { readonly all: false; readonly personId: string }
  | { readonly all: false; readonly personIds: readonly string[] };

/** Thrown when the scope cannot be resolved; the route answers with this status. */
export class ScopeError extends Error {
  constructor(readonly statusCode: 403 | 503, message: string) {
    super(message);
  }
}

const REVIEW_PERMISSION = 'biometric.case:review';
const SUPER_ADMIN_ROLE = 'Super Administrador';
const CACHE_TTL_MS = 30_000;
const ACTOR_PAGE_SIZE = 100;

const personCache = new Map<string, { personId: string; expiresAt: number }>();
const reviewerCache = new Map<string, number>();
const superAdminCache = new Map<string, number>();
const schoolScopeCache = new Map<string, { personIds: string[]; expiresAt: number }>();

/** Test hook: forget what has been resolved so far. */
export function clearCaseScopeCache(): void {
  personCache.clear();
  reviewerCache.clear();
  superAdminCache.clear();
  schoolScopeCache.clear();
}

async function resolveOwnPersonId(userId: string, token: string, identityUrl: string): Promise<string> {
  const now = Date.now();
  const cached = personCache.get(userId);
  if (cached && cached.expiresAt > now) return cached.personId;
  let personId: unknown;
  try {
    const user = await getJson(`${identityUrl}/api/v1/users/${encodeURIComponent(userId)}`, token);
    personId = user.status === 200 ? user.body?.personId : undefined;
  } catch {
    throw new ScopeError(503, 'Cannot resolve the user person');
  }
  if (typeof personId !== 'string' || !personId) throw new ScopeError(403, 'The user is not linked to a person');
  personCache.set(userId, { personId, expiresAt: now + CACHE_TTL_MS });
  return personId;
}

/**
 * Persons in the caller's own school (via academic_actor), for a scoped
 * reviewer. A reviewer without an academic_actor of their own (shouldn't
 * happen for Administrador/Instructor) fails secure to just themselves,
 * instead of falling back to "see everyone".
 */
async function resolveOwnSchoolPersonIds(
  userId: string,
  token: string,
  identityUrl: string,
  academicUrl: string,
): Promise<string[]> {
  const now = Date.now();
  const cached = schoolScopeCache.get(userId);
  if (cached && cached.expiresAt > now) return cached.personIds;

  const ownPerson = await resolveOwnPersonId(userId, token, identityUrl);
  const actors: Array<{ personId?: string; schoolId?: number }> = [];
  try {
    // The academic service caps each page at 100, so the full list is walked page by page.
    for (let offset = 0; ; offset += ACTOR_PAGE_SIZE) {
      const res = await getJson(`${academicUrl}/api/v1/academic-actors?limit=${ACTOR_PAGE_SIZE}&offset=${offset}`, token);
      const page: Array<{ personId?: string; schoolId?: number }> = res.status === 200 && Array.isArray(res.body) ? res.body : [];
      actors.push(...page);
      if (page.length < ACTOR_PAGE_SIZE) break;
    }
  } catch {
    throw new ScopeError(503, 'Cannot resolve the school scope');
  }

  const ownSchools = new Set<number>();
  for (const actor of actors) {
    if (actor.schoolId != null && actor.personId && actor.personId.toLowerCase() === ownPerson.toLowerCase()) {
      ownSchools.add(actor.schoolId);
    }
  }
  const personIds =
    ownSchools.size === 0
      ? [ownPerson]
      : [...new Set(actors.filter((a) => a.schoolId != null && ownSchools.has(a.schoolId) && a.personId).map((a) => a.personId as string))];

  schoolScopeCache.set(userId, { personIds, expiresAt: now + CACHE_TTL_MS });
  return personIds;
}

/**
 * Resolves the scope of an authenticated request (the auth guard has already
 * validated the session and set `userId` / `authToken`). Only positive answers
 * are cached, for a few seconds, like the auth filters of the other services.
 */
export async function resolveCaseScope(req: FastifyRequest): Promise<CaseScope> {
  const userId = (req as any).userId as string | undefined;
  const token = (req as any).authToken as string | undefined;
  if (!userId || !token) throw new ScopeError(403, 'No authenticated user');

  const now = Date.now();
  const identityUrl = process.env.IDENTITY_URL || 'http://localhost:8081';
  const authorizationUrl = process.env.AUTHORIZATION_URL || 'http://localhost:8082';
  const academicUrl = process.env.ACADEMIC_URL || 'http://localhost:8083';

  if ((superAdminCache.get(userId) ?? 0) <= now) {
    try {
      const rolesRes = await getJson(`${authorizationUrl}/api/v1/users/${encodeURIComponent(userId)}/roles`, token);
      const roles: string[] = rolesRes.status === 200 && Array.isArray(rolesRes.body)
        ? rolesRes.body.map((r: any) => r?.roleName).filter((n: unknown): n is string => typeof n === 'string')
        : [];
      if (roles.includes(SUPER_ADMIN_ROLE)) {
        superAdminCache.set(userId, now + CACHE_TTL_MS);
      }
    } catch {
      throw new ScopeError(503, 'Cannot verify roles');
    }
  }
  if ((superAdminCache.get(userId) ?? 0) > now) return { all: true };

  if ((reviewerCache.get(userId) ?? 0) > now) {
    const personIds = await resolveOwnSchoolPersonIds(userId, token, identityUrl, academicUrl);
    return { all: false, personIds };
  }
  try {
    const url = `${authorizationUrl}/api/v1/auth/evaluate?userId=${encodeURIComponent(userId)}&permission=${encodeURIComponent(REVIEW_PERMISSION)}`;
    const evaluated = await getJson(url, token);
    if (evaluated.status === 200 && evaluated.body?.allowed === true) {
      reviewerCache.set(userId, now + CACHE_TTL_MS);
      const personIds = await resolveOwnSchoolPersonIds(userId, token, identityUrl, academicUrl);
      return { all: false, personIds };
    }
  } catch {
    throw new ScopeError(503, 'Cannot verify permissions');
  }

  const personId = await resolveOwnPersonId(userId, token, identityUrl);
  return { all: false, personId };
}

/** Whether `scope` includes `personId`, across all three scope shapes. */
export function caseScopeAllows(scope: CaseScope, personId: string): boolean {
  if (scope.all) return true;
  if ('personIds' in scope) return scope.personIds.includes(personId);
  return scope.personId === personId;
}
