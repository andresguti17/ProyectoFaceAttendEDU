import { request, GET, POST, PUT, DELETE } from '../api/apiClient';
import { toSnakeDeep } from '../api/backend';
import Course from '../models/academic/Course';

const ENDPOINT = 'course';

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

export const CourseService = {
  getAll: async (params = {}) => {
    const data = await request({ method: GET, url: ENDPOINT, params, requiresAuth: false });
    return unwrap(data).map(Course.fromApi);
  },

  // GET /api/v1/course?program_id= no filtra; la ruta anidada GET /api/v1/programs/:id/courses sí.
  listByProgram: async (id) => {
    const data = await request({ method: GET, url: `api/v1/programs/${id}/courses`, requiresAuth: false });
    return unwrap(data).map((x) => Course.fromApi(toSnakeDeep(x)));
  },

  getById: async (id) => {
    const data = await request({ method: GET, url: `${ENDPOINT}/${id}`, requiresAuth: false });
    return Course.fromApi(toSnakeDeep(data));
  },

  getByProgram: async (programId) => {
    const data = await request({ method: GET, url: ENDPOINT, params: { program_id: programId }, requiresAuth: false });
    return unwrap(data).map(Course.fromApi);
  },

  create: async (courseData) => {
    const data = await request({ method: POST, url: ENDPOINT, data: courseData.toApi(), requiresAuth: false });
    return Course.fromApi(data);
  },

  update: async (id, courseData) => {
    const data = await request({ method: PUT, url: `${ENDPOINT}/${id}`, data: courseData.toApi(), requiresAuth: false });
    return Course.fromApi(data);
  },

  delete: async (id) => {
    return request({ method: DELETE, url: `${ENDPOINT}/${id}`, requiresAuth: false });
  },
};
