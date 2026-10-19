import type { FastifyRequest } from 'fastify';
import { getJson } from './authGuard';

/**
 * The school a caller may manage. `isSuperAdmin: true` means unrestricted
 * (Super Administrador, no school of its own). Otherwise `schoolId` is the
 * caller's own school (via their academic_actor), or `null` for a caller
 * without one — which must fail secure (own nothing), never fall back to
 * "manage everything".
 */
export interface CallerSchool {
  readonly isSuperAdmin: boolean;
  readonly schoolId: number | null;
}

/** Thrown when the scope cannot be resolved; the route answers with this status. */
export class ScopeError extends Error {
  constructor(readonly statusCode: 403 | 503, message: string) {
    super(message);
  }
}

const SUPER_ADMIN_ROLE = 'Super Administrador';
const CACHE_TTL_MS = 30_000;

const cache = new Map<string, { value: CallerSchool; expiresAt: number }>();

/** Test hook: forget what has been resolved so far. */
export function clearCallerSchoolCache(): void {
  cache.clear();
}

/**
 * Resolves the school of an authenticated request (the auth guard has
 * already validated the session and set `userId` / `authToken`). Only
 * positive answers are cached, like the auth filters of the other services.
 */
export async function resolveCallerSchool(req: FastifyRequest): Promise<CallerSchool> {
  const userId = (req as any).userId as string | undefined;
  const token = (req as any).authToken as string | undefined;
  if (!userId || !token) throw new ScopeError(403, 'No authenticated user');

  const now = Date.now();
  const cached = cache.get(userId);
  if (cached && cached.expiresAt > now) return cached.value;

  const identityUrl = process.env.IDENTITY_URL || 'http://localhost:8081';
  const authorizationUrl = process.env.AUTHORIZATION_URL || 'http://localhost:8082';
  const academicUrl = process.env.ACADEMIC_URL || 'http://localhost:8083';

  let roles: string[];
  try {
    const rolesRes = await getJson(`${authorizationUrl}/api/v1/users/${encodeURIComponent(userId)}/roles`, token);
    roles = rolesRes.status === 200 && Array.isArray(rolesRes.body)
      ? rolesRes.body.map((r: any) => r?.roleName).filter((n: unknown): n is string => typeof n === 'string')
      : [];
  } catch {
    throw new ScopeError(503, 'Cannot verify roles');
  }

  if (roles.includes(SUPER_ADMIN_ROLE)) {
    return store(userId, now, { isSuperAdmin: true, schoolId: null });
  }

  let personId: unknown;
  try {
    const user = await getJson(`${identityUrl}/api/v1/users/${encodeURIComponent(userId)}`, token);
    personId = user.status === 200 ? user.body?.personId : undefined;
  } catch {
    throw new ScopeError(503, 'Cannot resolve the user person');
  }
  if (typeof personId !== 'string' || !personId) {
    return store(userId, now, { isSuperAdmin: false, schoolId: null });
  }

  let schoolId: number | null = null;
  try {
    const actorsRes = await getJson(
      `${academicUrl}/api/v1/academic-actors?personId=${encodeURIComponent(personId)}&limit=5`,
      token,
    );
    const actors: Array<{ schoolId?: number }> = actorsRes.status === 200 && Array.isArray(actorsRes.body) ? actorsRes.body : [];
    const withSchool = actors.find((a) => a.schoolId != null);
    schoolId = withSchool?.schoolId ?? null;
  } catch {
    throw new ScopeError(503, 'Cannot resolve the caller school');
  }

  return store(userId, now, { isSuperAdmin: false, schoolId });
}

function store(userId: string, now: number, value: CallerSchool): CallerSchool {
  cache.set(userId, { value, expiresAt: now + CACHE_TTL_MS });
  return value;
}
