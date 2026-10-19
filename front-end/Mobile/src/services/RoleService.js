import { request, GET, POST, PUT, DELETE } from '../api/apiClient';
import { toSnakeDeep } from '../api/backend';
import Role from '../models/authorization/Role';

const ENDPOINT = 'role';

function unwrap(data) {
  if (data && Array.isArray(data.value)) return data.value;
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') return [data];
  return [];
}

function unwrapFirst(data) {
  const arr = unwrap(data);
  return arr.length > 0 ? arr[0] : null;
}

export const RoleService = {
  getAll: async (params = {}) => {
    const data = await request({ method: GET, url: ENDPOINT, params, requiresAuth: false });
    return unwrap(data).map((r) => Role.fromApi(toSnakeDeep(r)));
  },

  getById: async (id) => {
    const data = await request({ method: GET, url: `${ENDPOINT}/${id}`, requiresAuth: false });
    return Role.fromApi(toSnakeDeep(data));
  },

  getByName: async (roleName) => {
    const data = await request({ method: GET, url: ENDPOINT, params: { role_name: roleName }, requiresAuth: false });
    return Role.fromApi(unwrapFirst(data));
  },

  create: async (roleData) => {
    const data = await request({ method: POST, url: ENDPOINT, data: roleData.toApi(), requiresAuth: false });
    return Role.fromApi(data);
  },

  update: async (id, roleData) => {
    const data = await request({ method: PUT, url: `${ENDPOINT}/${id}`, data: roleData.toApi(), requiresAuth: false });
    return Role.fromApi(data);
  },

  delete: async (id) => {
    return request({ method: DELETE, url: `${ENDPOINT}/${id}`, requiresAuth: false });
  },
};
