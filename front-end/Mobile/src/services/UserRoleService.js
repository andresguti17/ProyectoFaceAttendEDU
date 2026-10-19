import { request, GET, POST } from '../api/apiClient';
import { toSnakeDeep } from '../api/backend';
import Role from '../models/authorization/Role';

// El endpoint por lotes acepta hasta 300 ids por petición: se parte en lotes de 200.
const ROLES_BATCH = 200;

function unwrap(data) {
  if (data && Array.isArray(data.value)) return data.value;
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') return [data];
  return [];
}

export const UserRoleService = {
  // POST /api/v1/users/:userId/roles — asigna un rol a un usuario.
  assign: async (userId, roleId) => {
    return request({
      method: POST,
      url: `api/v1/users/${userId}/roles`,
      data: { roleId },
      requiresAuth: false,
    });
  },

  // GET /api/v1/user-roles?userIds=a,b,... — roles de varios usuarios en UNA petición.
  // Devuelve Map<userId, Role[]>; un usuario sin roles no aparece en el mapa.
  getByUsers: async (userIds = []) => {
    const ids = [...new Set(userIds)].filter(Boolean);
    const batches = [];
    for (let i = 0; i < ids.length; i += ROLES_BATCH) batches.push(ids.slice(i, i + ROLES_BATCH));

    const responses = await Promise.all(
      batches.map((batch) =>
        request({
          method: GET,
          url: 'api/v1/user-roles',
          params: { userIds: batch.join(',') },
          requiresAuth: false,
        }),
      ),
    );

    const byUser = new Map();
    for (const response of responses) {
      for (const [userId, roles] of Object.entries(response ?? {})) {
        byUser.set(userId, unwrap(roles).map((r) => Role.fromApi(toSnakeDeep(r))));
      }
    }
    return byUser;
  },
};
