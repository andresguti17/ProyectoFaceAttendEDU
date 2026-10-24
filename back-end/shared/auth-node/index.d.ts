/** Permission a route needs, or null when a valid session is enough. */
export type PermissionRule = (method: string, path: string) => string | null;

/** The request fields the guard reads (a FastifyRequest has all of them). */
export interface GuardRequest {
  method: string;
  url: string;
  headers: { authorization?: string };
  routeOptions?: { url?: string };
}

export interface AuthGuardOptions {
  /** Paths that skip the guard. Default: everything outside /api/ plus the health checks. */
  isPublic?: (path: string, method: string) => boolean;
  /** Path the decision is made on. Default: the raw URL without its query string. */
  resolvePath?: (req: GuardRequest) => string;
}

/** Adds the onRequest hook; on success sets req.userId and req.authToken. */
export function registerAuthGuard(
  app: { addHook(name: 'onRequest', hook: (req: any, reply: any) => Promise<unknown>): unknown },
  requiredPermission: PermissionRule,
  options?: AuthGuardOptions,
): void;

/** GET with the caller's bearer and a 4 s timeout; body is null unless 2xx. */
export function getJson(url: string, token: string): Promise<{ status: number; body: any }>;

/** Tests only: forget cached sessions and permissions. */
export function clearAuthCache(): void;

export const PUBLIC_PREFIXES: readonly string[];
