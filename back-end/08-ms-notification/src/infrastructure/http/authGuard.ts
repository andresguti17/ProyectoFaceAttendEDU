import type { FastifyInstance } from 'fastify';
import { registerAuthGuard as registerSharedGuard } from '@faceattend/auth';
import type { PermissionRule } from '@faceattend/auth';

/**
 * Session + RBAC guard from back-end/shared/auth-node, in this service's strict
 * mode: deny-by-default on the routed path instead of "only /api/**".
 */
export { getJson } from '@faceattend/auth';
export type { PermissionRule };

// Deny-by-default (mirrors the Go `isPublicPath`): every path requires auth
// UNLESS it matches this explicit allowlist. `/health` and `/health/ready`
// are bare liveness/readiness checks with no sensitive payload; everything
// else — including `/health/quality` — goes through the guard like any
// other route. Matches use a segment boundary (`path === p || path.startsWith(p+'/')`),
// never a bare prefix, so e.g. `/api/v1/emailsX` is not mistaken for `/api/v1/emails`.
const PUBLIC_EXACT_PATHS = ['/health', '/health/ready', '/api/v1/health', '/api/health'];
const PUBLIC_PREFIXES = ['/api/v1/emails'];

function isPublicPath(path: string): boolean {
  if (PUBLIC_EXACT_PATHS.includes(path)) return true;
  return PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

export function registerAuthGuard(app: FastifyInstance, requiredPermission: PermissionRule): void {
  registerSharedGuard(app, requiredPermission, {
    isPublic: isPublicPath,
    // Routing runs before `onRequest` in Fastify's lifecycle (see
    // docs/Reference/Lifecycle.md), so `req.routeOptions.url` is already the
    // decoded, canonical route pattern find-my-way matched the request to —
    // e.g. a request to `/%61pi/v1/alerts` resolves here to `/api/v1/alerts`,
    // the SAME path the handler actually runs under. Deciding on the raw
    // `req.url` instead let percent-encoding desync the guard's decision from
    // the router's. When no route matched (404) there is no routeOptions.url;
    // fall back to the decoded raw path so even an unknown path is deny-by-default.
    resolvePath: (req) => req.routeOptions?.url ?? decodeURIComponent(req.url.split('?')[0]),
  });
}
