import { request, GET, POST, PUT, DELETE } from '../api/apiClient';
import { toSnakeDeep } from '../api/backend';
import Program from '../models/academic/Program';

const ENDPOINT = 'program';

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

export const ProgramService = {
  getAll: async (params = {}) => {
    const data = await request({ method: GET, url: ENDPOINT, params, requiresAuth: false });
    return unwrap(data).map(Program.fromApi);
  },

  // GET /api/v1/program?school_id= no filtra; la ruta anidada GET /api/v1/schools/:id/programs sí.
  listBySchool: async (id) => {
    const data = await request({ method: GET, url: `api/v1/schools/${id}/programs`, requiresAuth: false });
    return unwrap(data).map((x) => Program.fromApi(toSnakeDeep(x)));
  },

  getById: async (id) => {
    const data = await request({ method: GET, url: `${ENDPOINT}/${id}`, requiresAuth: false });
    return Program.fromApi(toSnakeDeep(data));
  },

  getBySchool: async (schoolId) => {
    const data = await request({ method: GET, url: ENDPOINT, params: { school_id: schoolId }, requiresAuth: false });
    return unwrap(data).map(Program.fromApi);
  },

  create: async (programData) => {
    const data = await request({ method: POST, url: ENDPOINT, data: programData.toApi(), requiresAuth: false });
    return Program.fromApi(data);
  },

  update: async (id, programData) => {
    const data = await request({ method: PUT, url: `${ENDPOINT}/${id}`, data: programData.toApi(), requiresAuth: false });
    return Program.fromApi(data);
  },

  delete: async (id) => {
    return request({ method: DELETE, url: `${ENDPOINT}/${id}`, requiresAuth: false });
  },
};
