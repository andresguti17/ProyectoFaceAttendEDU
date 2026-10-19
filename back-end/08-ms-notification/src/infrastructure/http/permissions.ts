import type { PermissionRule } from './authGuard';

/**
 * Notification permission matrix. Quality routes are admin-only; reads need
 * alert visibility; resolving an alert follows attendance write rights; every
 * other write requires configuration management.
 */
export const notificationPermission: PermissionRule = (method, path) => {
  if (path.startsWith('/api/v1/quality')) return 'configuration:manage';
  if (method === 'GET') return 'notification.alert:read';
  if (method === 'PATCH' && path.endsWith('/resolve')) return 'attendance.record:write';
  return 'configuration:manage';
};
