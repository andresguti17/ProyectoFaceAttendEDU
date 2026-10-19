import type { PermissionRule } from './authGuard';

/** The quality instruments are an administrative tool: admin only. */
export const qualityPermission: PermissionRule = () => 'configuration:manage';
