import { request, GET, POST, PUT, DELETE } from '../api/apiClient';
import SecurityConfiguration from '../models/configuration/SecurityConfiguration';

const ENDPOINT = 'security_configuration';

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

export const SecurityConfigService = {
  getAll: async (params = {}) => {
    const data = await request({ method: GET, url: ENDPOINT, params, requiresAuth: false });
    return unwrap(data).map(SecurityConfiguration.fromApi);
  },

  getById: async (id) => {
    const data = await request({ method: GET, url: `${ENDPOINT}/${id}`, requiresAuth: false });
    return SecurityConfiguration.fromApi(data);
  },

  getByName: async (configName) => {
    const data = await request({
      method: GET,
      url: ENDPOINT,
      params: { configuration_name: configName },
      requiresAuth: false,
    });
    return SecurityConfiguration.fromApi(unwrapFirst(data));
  },

  create: async (configData) => {
    const data = await request({ method: POST, url: ENDPOINT, data: configData.toApi(), requiresAuth: false });
    return SecurityConfiguration.fromApi(data);
  },

  update: async (id, configData) => {
    const data = await request({ method: PUT, url: `${ENDPOINT}/${id}`, data: configData.toApi(), requiresAuth: false });
    return SecurityConfiguration.fromApi(data);
  },

  delete: async (id) => {
    return request({ method: DELETE, url: `${ENDPOINT}/${id}`, requiresAuth: false });
  },
};
