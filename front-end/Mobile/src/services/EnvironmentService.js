import { request, GET, POST, PUT, DELETE } from '../api/apiClient';
import { toCamelBody, toSnakeDeep } from '../api/backend';
import Environment from '../models/scheduling/Environment';

const ENDPOINT = 'environment';

function unwrap(data) {
  if (data && Array.isArray(data.value)) return data.value;
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') return [data];
  return [];
}

// 04-ms-scheduling habla camelCase: el modelo lee snake, así que la respuesta
// se normaliza y el cuerpo se convierte antes de enviarlo.
const fromRow = (row) => Environment.fromApi(toSnakeDeep(row));

export const EnvironmentService = {
  getAll: async (params = {}) => {
    const data = await request({ method: GET, url: ENDPOINT, params });
    return unwrap(data).map(fromRow);
  },

  getById: async (id) => {
    const data = await request({ method: GET, url: `${ENDPOINT}/${id}` });
    return fromRow(data);
  },

  getBySchool: async (schoolId) => {
    const data = await request({ method: GET, url: ENDPOINT, params: { schoolId } });
    return unwrap(data).map(fromRow);
  },

  create: async (envData) => {
    const data = await request({ method: POST, url: ENDPOINT, data: toCamelBody(envData.toApi()) });
    return fromRow(data);
  },

  update: async (id, envData) => {
    const data = await request({ method: PUT, url: `${ENDPOINT}/${id}`, data: toCamelBody(envData.toApi()) });
    return fromRow(data);
  },

  delete: async (id) => {
    return request({ method: DELETE, url: `${ENDPOINT}/${id}` });
  },
};
