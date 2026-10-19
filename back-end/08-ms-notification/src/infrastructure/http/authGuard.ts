import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

/**
 * Session + RBAC guard for every /api/** route (same contract as the Java
 * AuthTokenFilter): the Bearer is an opaque session UUID validated against
 * identity, and the permission is evaluated by authorization.
 * Duplicated per service on purpose: the repo has no shared module.
 */
export type PermissionRule = (method: string, path: string) => string | null;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Deny-by-default (mirrors the Go `isPublicPath`): every path requires auth
// UNLESS it matches this explicit allowlist. `/health` and `/health/ready`
// are bare liveness/readiness checks with no sensitive payload; everything
// else — including `/health/quality` — goes through the guard like any
// other route. Matches use a segment boundary (`path === p || path.startsWith(p+'/')`),
// never a bare prefix, so e.g. `/api/v1/emailsX` is not mistaken for `/api/v1/emails`.
const PUBLIC_EXACT_PATHS = ['/health', '/health/ready', '/api/v1/health', '/api/health'];
const PUBLIC_PREFIXES = ['/api/v1/emails'];
const TIMEOUT_MS = 4000;

function isPublicPath(path: string): boolean {
  if (PUBLIC_EXACT_PATHS.includes(path)) return true;
  return PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

function deny(reply: FastifyReply, status: number, message: string, path: string) {
  return reply.code(status).send({
    status,
    error: status === 401 ? 'Unauthorized' : status === 403 ? 'Forbidden' : 'ServiceUnavailable',
    message,
    path,
  });
}

/**
 * Caché positiva de autenticación (TTL corto). Cada request autenticado
 * costaba 1-2 introspecciones secuenciales; bajo fan-out eso saturaba
 * identity/authorization y el gateway respondía 503. Solo se cachean
 * resultados POSITIVOS: cualquier fallo se revalida en vivo (fail-secure).
 * Ventana de revocación/logout: AUTH_CACHE_TTL_MS.
 */
const AUTH_CACHE_TTL_MS = 10_000;
const AUTH_CACHE_MAX = 5000;

const sessionCache = new Map<string, { userId: string; exp: number }>();
const evalCache = new Map<string, { allowed: boolean; exp: number }>();

function cachedSession(token: string): string | null {
    const hit = sessionCache.get(token);
    const now = Date.now();
    if (!hit) return null;
    if (hit.exp <= now) {
        sessionCache.delete(token);
        return null;
    }
    return hit.userId;
}

function storeSession(token: string, userId: string): void {
    if (sessionCache.size > AUTH_CACHE_MAX) sessionCache.clear();
    sessionCache.set(token, { userId, exp: Date.now() + AUTH_CACHE_TTL_MS });
}

async function cachedEvaluate(
    key: string,
    loader: () => Promise<boolean | null>,
): Promise<boolean | null> {
    const hit = evalCache.get(key);
    const now = Date.now();
    if (hit) {
        if (hit.exp > now) return hit.allowed;
        evalCache.delete(key);
    }
    const allowed = await loader();
    if (allowed === true) {
        if (evalCache.size > AUTH_CACHE_MAX) evalCache.clear();
        evalCache.set(key, { allowed: true, exp: now + AUTH_CACHE_TTL_MS });
    }
    return allowed;
}

export async function getJson(url: string, token: string): Promise<{ status: number; body: any }> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = res.ok ? await res.json().catch(() => null) : null;
  return { status: res.status, body };
}

export function registerAuthGuard(app: FastifyInstance, requiredPermission: PermissionRule): void {
  const identityUrl = process.env.IDENTITY_URL || 'http://localhost:8081';
  const authorizationUrl = process.env.AUTHORIZATION_URL || 'http://localhost:8082';

  app.addHook('onRequest', async (req: FastifyRequest, reply: FastifyReply) => {
    // Routing runs before `onRequest` in Fastify's lifecycle (see
    // docs/Reference/Lifecycle.md), so `req.routeOptions.url` is already the
    // decoded, canonical route pattern find-my-way matched the request to —
    // e.g. a request to `/%61pi/v1/alerts` resolves here to `/api/v1/alerts`,
    // the SAME path the handler actually runs under. Deciding on the raw
    // `req.url` instead (as before) let percent-encoding desync the guard's
    // decision from the router's: an encoded path could look unguarded here
    // while find-my-way still dispatched it to a real, protected handler.
    // When no route matched (404) there is no routeOptions.url; fall back to
    // the decoded raw path so even an unknown path is deny-by-default.
    const matchedPath = req.routeOptions?.url;
    const path = matchedPath ?? decodeURIComponent(req.url.split('?')[0]);
    if (req.method === 'OPTIONS' || isPublicPath(path)) return;

    const header = req.headers.authorization;
    const token = header && /^bearer\s+/i.test(header) ? header.replace(/^bearer\s+/i, '').trim() : '';
    if (!token) return deny(reply, 401, 'Missing bearer token', path);
    if (!UUID_RE.test(token)) return deny(reply, 401, 'Invalid token format', path);

    let userId: string;
    const sessionHit = cachedSession(token);
    if (sessionHit != null) {
      userId = sessionHit;
    } else {
      let session: { status: number; body: any };
      try {
        session = await getJson(`${identityUrl}/api/v1/sessions/${token}`, token);
      } catch {
        return deny(reply, 503, 'Cannot verify session', path);
      }
      if (session.status !== 200 || session.body?.sessionStatus !== 'Active' || !session.body?.userId) {
        return deny(reply, 401, 'Invalid or expired session', path);
      }
      userId = String(session.body.userId);
      storeSession(token, userId);
    }

    const permission = requiredPermission(req.method, path);
    if (permission) {
      const evalKey = token + "\n" + userId + "\n" + permission;
      const allowed = await cachedEvaluate(evalKey, async () => {
        try {
          const url = `${authorizationUrl}/api/v1/auth/evaluate?userId=${encodeURIComponent(userId)}&permission=${encodeURIComponent(permission)}`;
          const result = await getJson(url, token);
          return result.status === 200 && result.body?.allowed === true;
        } catch {
          return null;
        }
      });
      if (allowed === null) return deny(reply, 503, 'Cannot verify permissions', path);
      if (!allowed) return deny(reply, 403, `Forbidden: requires ${permission}`, path);
    }
    (req as any).userId = userId;
    (req as any).authToken = token;
  });
}
