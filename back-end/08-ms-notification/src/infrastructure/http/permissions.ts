import type { PermissionRule } from './authGuard';

/**
 * Notification permission matrix. Quality routes are admin-only; reads need
 * alert visibility; resolving an alert follows attendance write rights; every
 * other write requires configuration management.
 */
export const notificationPermission: PermissionRule = (method, path) => {
  // `/health/quality` serves the same ISO quality report as
  // `/api/v1/quality/report` (see qualityMiddleware.ts); it must carry the
  // same RBAC requirement, not the bare-liveness openness of `/health`.
  if (path.startsWith('/api/v1/quality') || path === '/health/quality') return 'configuration:manage';
  if (method === 'GET') return 'notification.alert:read';
  if (method === 'PATCH' && path.endsWith('/resolve')) return 'attendance.record:write';
  return 'configuration:manage';
};
