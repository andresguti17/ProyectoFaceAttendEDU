import type { PermissionRule } from './authGuard';

const BIOMETRIC_CASE_PATH = /^\/api\/v1\/(biometric-update-cases|persons\/[^/]+\/biometric-cases)/;
const SECURITY_PATH = /^\/api\/v1\/(configurations\/security|security-configurations)/;
// Academic config (per-school) — also gated, unlike the generic GET fallback below:
// without this, any authenticated role (Aprendiz included) could read any
// school's configuration, since GET otherwise needs no permission at all.
const ACADEMIC_CONFIG_PATH = /^\/api\/v1\/(configurations\/academic|academic-configurations|schools\/[^/]+\/configurations)/;

export const configurationPermission: PermissionRule = (method, path) => {
  if (path.startsWith('/api/v1/quality')) return 'configuration:manage';
  if (BIOMETRIC_CASE_PATH.test(path)) {
    return method === 'GET' || method === 'POST' ? 'biometric.case:request' : 'biometric.case:review';
  }
  if (SECURITY_PATH.test(path)) return 'configuration:manage';
  if (ACADEMIC_CONFIG_PATH.test(path)) return 'configuration:manage';
  return method === 'GET' ? null : 'configuration:manage';
};
