import type { PermissionRule } from './authGuard';

/**
 * Reads need only a session: every role resolves its own school, period and
 * actor data. Writes follow the seeded RBAC matrix (admin only).
 */
export const academicPermission: PermissionRule = (method, path) => {
  if (path.startsWith('/api/v1/quality')) return 'configuration:manage';
  if (method === 'GET') return null;
  if (path.startsWith('/api/v1/enrollments')) return 'academic.enrollment:manage';
  return 'academic.school:manage';
};
