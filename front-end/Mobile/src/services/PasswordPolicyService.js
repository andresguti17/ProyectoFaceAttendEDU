import { request, GET } from '../api/apiClient';
import { toSnakeDeep } from '../api/backend';
import PasswordPolicy from '../models/identity/PasswordPolicy';

const ENDPOINT = 'api/v1/password-policies';

function unwrap(data) {
  if (data && Array.isArray(data.value)) return data.value;
  if (data && Array.isArray(data.data)) return data.data;
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') return [data];
  return [];
}

export const PasswordPolicyService = {
  // GET /api/v1/password-policies — reglas vigentes de contraseña (min/max, mayúsculas, números, símbolos, vigencia).
  getAll: async () => {
    const data = await request({ method: GET, url: ENDPOINT, requiresAuth: false });
    return unwrap(data).map((p) => PasswordPolicy.fromApi(toSnakeDeep(p)));
  },
};
