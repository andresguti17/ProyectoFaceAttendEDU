import { request, GET, POST } from '../api/apiClient';
import { toSnakeDeep } from '../api/backend';
import AlertType from '../models/notification/AlertType';

const ENDPOINT = 'api/v1/alert-types';

// El servicio Go devuelve { alert_types: [...] } (null si está vacío).
function unwrap(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.alert_types)) return data.alert_types;
  if (data && Array.isArray(data.value)) return data.value;
  return [];
}

export const AlertTypeService = {
  // GET /api/v1/alert-types — catálogo de tipos de alerta.
  getAll: async () => {
    const data = await request({ method: GET, url: ENDPOINT, requiresAuth: false });
    return unwrap(data).map((t) => AlertType.fromApi(toSnakeDeep(t)));
  },

  // POST /api/v1/alert-types — { code, name, severity: INFO|WARNING|CRITICAL, channel?: DASHBOARD|EMAIL|PUSH }.
  create: async ({ code, name, severity, channel }) => {
    const data = await request({
      method: POST,
      url: ENDPOINT,
      data: { code, name, severity, ...(channel ? { channel } : {}) },
      requiresAuth: false,
    });
    return AlertType.fromApi(toSnakeDeep(data));
  },
};
