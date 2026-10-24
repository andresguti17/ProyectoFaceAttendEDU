// The session + RBAC guard lives in back-end/shared/auth-node (shared by the four
// Node services); this service only brings its permission rules (permissions.ts).
export { registerAuthGuard, getJson } from '@faceattend/auth';
export type { PermissionRule } from '@faceattend/auth';
