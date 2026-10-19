import { request, GET, POST, PUT, DELETE } from '../api/apiClient';
import Permission from '../models/authorization/Permission';

const ENDPOINT = 'permission';

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

export const PermissionService = {
  getAll: async (params = {}) => {
    const data = await request({ method: GET, url: ENDPOINT, params, requiresAuth: false });
    return unwrap(data).map(Permission.fromApi);
  },

  getById: async (id) => {
    const data = await request({ method: GET, url: `${ENDPOINT}/${id}`, requiresAuth: false });
    return Permission.fromApi(data);
  },

  getByRoleId: async (roleId) => {
    const data = await request({ method: GET, url: ENDPOINT, params: { role_id: roleId }, requiresAuth: false });
    return unwrap(data).map(Permission.fromApi);
  },

  create: async (permissionData) => {
    const data = await request({ method: POST, url: ENDPOINT, data: permissionData.toApi(), requiresAuth: false });
    return Permission.fromApi(data);
  },

  update: async (id, permissionData) => {
    const data = await request({ method: PUT, url: `${ENDPOINT}/${id}`, data: permissionData.toApi(), requiresAuth: false });
    return Permission.fromApi(data);
  },

  delete: async (id) => {
    return request({ method: DELETE, url: `${ENDPOINT}/${id}`, requiresAuth: false });
  },
};
