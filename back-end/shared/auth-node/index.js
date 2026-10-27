'use strict';

/**
 * Session + RBAC guard shared by the Node services (academic, configuration,
 * notification, quality); same contract as the Java SessionAuthClient: the
 * Bearer is an opaque session UUID validated against identity, and each
 * permission is evaluated by authorization with the caller's own token.
 * Each service keeps its permission rules (PermissionRule) in its own code.
 *
 * Positive-only cache with a short TTL: every request cost 1-2 sequential
 * lookups and under the frontend fan-out that saturated identity/authorization.
 * A failure is never cached (fail-secure); revocation/logout window: CACHE_TTL_MS.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Escapes the router keeps encoded (/, \, %, ?, #) and `;`, where it may cut the path:
// decoding them would hand the guard a different path than the one routed, so such
// paths are refused. No client of the API needs them in a path.
const AMBIGUOUS_PATH_RE = /%(2f|5c|25|3f|23)|;/i;
const PUBLIC_PREFIXES = ['/health', '/api/v1/health', '/api/health'];
const TIMEOUT_MS = 4000;
const CACHE_TTL_MS = 10_000;
const CACHE_MAX = 5000;

const sessionCache = new Map();
const evalCache = new Map();

function deny(reply, status, message, path) {
  return reply.code(status).send({
    status,
    error: status === 400 ? 'Bad Request' : status === 401 ? 'Unauthorized' : status === 403 ? 'Forbidden' : 'ServiceUnavailable',
    message,
    path,
  });
}

function fresh(cache, key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.exp <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

function remember(cache, key, value) {
  if (cache.size > CACHE_MAX) cache.clear();
  cache.set(key, { value, exp: Date.now() + CACHE_TTL_MS });
}

async function getJson(url, token) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = res.ok ? await res.json().catch(() => null) : null;
  return { status: res.status, body };
}

/** Default: only /api/** is guarded, health checks are open. */
function defaultIsPublic(path) {
  return !path.startsWith('/api/') || PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(p));
}

/**
 * Default: the path decoded the way the router decodes it. Deciding on the raw URL let
 * `/%61pi/v1/...` reach the `/api/v1/...` handler as a public path. Throws on a path
 * that cannot be decoded unambiguously; the hook answers 400.
 */
function defaultResolvePath(req) {
  const raw = req.url.split('?')[0];
  if (AMBIGUOUS_PATH_RE.test(raw)) throw new URIError(`Ambiguous request path: ${raw}`);
  return decodeURIComponent(raw);
}

function registerAuthGuard(app, requiredPermission, options = {}) {
  const isPublic = options.isPublic || defaultIsPublic;
  const resolvePath = options.resolvePath || defaultResolvePath;
  const identityUrl = process.env.IDENTITY_URL || 'http://localhost:8081';
  const authorizationUrl = process.env.AUTHORIZATION_URL || 'http://localhost:8082';

  app.addHook('onRequest', async (req, reply) => {
    let path;
    try {
      path = resolvePath(req);
    } catch {
      return deny(reply, 400, 'Invalid request path', req.url.split('?')[0]);
    }
    if (req.method === 'OPTIONS' || isPublic(path, req.method)) return;

    const header = req.headers.authorization;
    const token = header && /^bearer\s+/i.test(header) ? header.replace(/^bearer\s+/i, '').trim() : '';
    if (!token) return deny(reply, 401, 'Missing bearer token', path);
    if (!UUID_RE.test(token)) return deny(reply, 401, 'Invalid token format', path);

    let userId = fresh(sessionCache, token);
    if (userId == null) {
      let session;
      try {
        session = await getJson(`${identityUrl}/api/v1/sessions/${token}`, token);
      } catch {
        return deny(reply, 503, 'Cannot verify session', path);
      }
      if (session.status !== 200 || session.body?.sessionStatus !== 'Active' || !session.body?.userId) {
        return deny(reply, 401, 'Invalid or expired session', path);
      }
      userId = String(session.body.userId);
      remember(sessionCache, token, userId);
    }

    const permission = requiredPermission(req.method, path);
    if (permission) {
      const key = `${token}\n${userId}\n${permission}`;
      let allowed = fresh(evalCache, key);
      if (allowed == null) {
        try {
          const url = `${authorizationUrl}/api/v1/auth/evaluate?userId=${encodeURIComponent(userId)}`
            + `&permission=${encodeURIComponent(permission)}`;
          const result = await getJson(url, token);
          allowed = result.status === 200 && result.body?.allowed === true;
        } catch {
          return deny(reply, 503, 'Cannot verify permissions', path);
        }
        if (allowed) remember(evalCache, key, true);
      }
      if (!allowed) return deny(reply, 403, `Forbidden: requires ${permission}`, path);
    }
    req.userId = userId;
    req.authToken = token;
  });
}

function clearAuthCache() {
  sessionCache.clear();
  evalCache.clear();
}

module.exports = { registerAuthGuard, getJson, clearAuthCache, PUBLIC_PREFIXES };
