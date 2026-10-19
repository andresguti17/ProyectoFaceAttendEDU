import { request, GET, POST, PUT, DELETE } from '../api/apiClient';
import City from '../models/identity/City';

const ENDPOINT = 'city';

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

export const CityService = {
  getAll: async (params = {}) => {
    const data = await request({ method: GET, url: ENDPOINT, params, requiresAuth: false });
    return unwrap(data).map(City.fromApi);
  },

  getById: async (id) => {
    const data = await request({ method: GET, url: `${ENDPOINT}/${id}`, requiresAuth: false });
    return City.fromApi(data);
  },

  create: async (cityData) => {
    const data = await request({ method: POST, url: ENDPOINT, data: cityData.toApi(), requiresAuth: false });
    return City.fromApi(data);
  },

  update: async (id, cityData) => {
    const data = await request({ method: PUT, url: `${ENDPOINT}/${id}`, data: cityData.toApi(), requiresAuth: false });
    return City.fromApi(data);
  },

  delete: async (id) => {
    return request({ method: DELETE, url: `${ENDPOINT}/${id}`, requiresAuth: false });
  },
};
