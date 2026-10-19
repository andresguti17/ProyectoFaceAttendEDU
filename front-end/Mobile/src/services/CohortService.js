import { request, GET, POST, PUT, DELETE } from '../api/apiClient';
import { toSnakeDeep } from '../api/backend';
import Cohort from '../models/academic/Cohort';

const ENDPOINT = 'cohort';

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

export const CohortService = {
  getAll: async (params = {}) => {
    const data = await request({ method: GET, url: ENDPOINT, params, requiresAuth: false });
    return unwrap(data).map(Cohort.fromApi);
  },

  // GET /api/v1/cohort?program_id= no filtra; la ruta anidada GET /api/v1/programs/:id/cohorts sí.
  listByProgram: async (id) => {
    const data = await request({ method: GET, url: `api/v1/programs/${id}/cohorts`, requiresAuth: false });
    return unwrap(data).map((x) => Cohort.fromApi(toSnakeDeep(x)));
  },

  getById: async (id) => {
    const data = await request({ method: GET, url: `${ENDPOINT}/${id}`, requiresAuth: false });
    return Cohort.fromApi(toSnakeDeep(data));
  },

  getByProgram: async (programId) => {
    const data = await request({ method: GET, url: ENDPOINT, params: { program_id: programId }, requiresAuth: false });
    return unwrap(data).map(Cohort.fromApi);
  },

  getByPeriod: async (periodId) => {
    const data = await request({ method: GET, url: ENDPOINT, params: { academic_period_id: periodId }, requiresAuth: false });
    return unwrap(data).map(Cohort.fromApi);
  },

  create: async (cohortData) => {
    const data = await request({ method: POST, url: ENDPOINT, data: cohortData.toApi(), requiresAuth: false });
    return Cohort.fromApi(data);
  },

  update: async (id, cohortData) => {
    const data = await request({ method: PUT, url: `${ENDPOINT}/${id}`, data: cohortData.toApi(), requiresAuth: false });
    return Cohort.fromApi(data);
  },

  delete: async (id) => {
    return request({ method: DELETE, url: `${ENDPOINT}/${id}`, requiresAuth: false });
  },
};
