import { request, GET, POST, PUT, DELETE } from '../api/apiClient';
import { toSnakeDeep } from '../api/backend';
import UserSession from '../models/identity/UserSession';

const ENDPOINT = 'user_session';

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

export const SessionService = {
  getAll: async (params = {}) => {
    const data = await request({ method: GET, url: ENDPOINT, params, requiresAuth: false });
    return unwrap(data).map(UserSession.fromApi);
  },

  // GET /api/v1/user_session?user_id= no filtra; la ruta GET /api/v1/sessions/user/:userId sí.
  listByUser: async (id) => {
    const data = await request({ method: GET, url: `api/v1/sessions/user/${id}`, requiresAuth: false });
    return unwrap(data).map((x) => UserSession.fromApi(toSnakeDeep(x)));
  },

  getById: async (id) => {
    const data = await request({ method: GET, url: `${ENDPOINT}/${id}`, requiresAuth: false });
    return UserSession.fromApi(data);
  },

  getByUserId: async (userId) => {
    const data = await request({ method: GET, url: ENDPOINT, params: { user_id: userId }, requiresAuth: false });
    return unwrap(data).map(UserSession.fromApi);
  },

  getActiveByUserId: async (userId) => {
    const data = await request({ method: GET, url: ENDPOINT, params: { user_id: userId, session_status: 'Active' }, requiresAuth: false });
    return UserSession.fromApi(unwrapFirst(data));
  },

  close: async (id) => {
    const data = await request({
      method: PUT,
      url: `${ENDPOINT}/${id}`,
      data: { session_status: 'Closed', end_date: new Date().toISOString() },
      requiresAuth: false,
    });
    return UserSession.fromApi(data);
  },
};
