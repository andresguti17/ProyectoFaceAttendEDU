import { request, GET, POST, PUT, PATCH, DELETE } from '../api/apiClient';
import { toSnakeDeep } from '../api/backend';
import Alert from '../models/notification/Alert';

const ENDPOINT = 'alert';

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

export const AlertService = {
  getAll: async (params = {}) => {
    const data = await request({ method: GET, url: ENDPOINT, params, requiresAuth: false });
    return unwrap(data).map(Alert.fromApi);
  },

  getById: async (id) => {
    const data = await request({ method: GET, url: `${ENDPOINT}/${id}`, requiresAuth: false });
    return Alert.fromApi(data);
  },

  getByActor: async (academicActorId) => {
    const data = await request({ method: GET, url: ENDPOINT, params: { academic_actor_id: academicActorId }, requiresAuth: false });
    return unwrap(data).map(Alert.fromApi);
  },

  getUnresolvedByActor: async (academicActorId) => {
    const data = await request({
      method: GET,
      url: ENDPOINT,
      params: { academic_actor_id: academicActorId, resolved_at: null },
      requiresAuth: false,
    });
    return unwrap(data).map(Alert.fromApi);
  },

  create: async (alertData) => {
    const data = await request({ method: POST, url: ENDPOINT, data: alertData.toApi(), requiresAuth: false });
    return Alert.fromApi(data);
  },

  resolve: async (id) => {
    const data = await request({ method: PUT, url: `${ENDPOINT}/${id}`, data: { resolved_at: new Date().toISOString() }, requiresAuth: false });
    return Alert.fromApi(data);
  },

  // PATCH /api/v1/alerts/:id/resolve — endpoint dedicado del backend (fija resolved_at en el servidor).
  markResolved: async (id) => {
    const data = await request({ method: PATCH, url: `api/v1/alerts/${id}/resolve`, requiresAuth: false });
    return Alert.fromApi(toSnakeDeep(data));
  },

  delete: async (id) => {
    return request({ method: DELETE, url: `${ENDPOINT}/${id}`, requiresAuth: false });
  },
};
