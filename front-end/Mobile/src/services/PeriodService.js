import { request, GET, POST, PUT, DELETE } from '../api/apiClient';
import { toSnakeDeep } from '../api/backend';
import AcademicPeriod from '../models/academic/AcademicPeriod';

const ENDPOINT = 'academic_period';

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

export const PeriodService = {
  getAll: async (params = {}) => {
    const data = await request({ method: GET, url: ENDPOINT, params, requiresAuth: false });
    return unwrap(data).map((p) => AcademicPeriod.fromApi(toSnakeDeep(p)));
  },

  getById: async (id) => {
    const data = await request({ method: GET, url: `${ENDPOINT}/${id}`, requiresAuth: false });
    return AcademicPeriod.fromApi(toSnakeDeep(data));
  },

  // Backend: GET /api/v1/academic-periods no filtra (?school_id/ ?is_active se
  // ignoran), así que se filtra en cliente.
  getBySchool: async (schoolId) => {
    const data = await request({ method: GET, url: ENDPOINT, requiresAuth: false });
    return unwrap(data)
      .map((p) => AcademicPeriod.fromApi(toSnakeDeep(p)))
      .filter((p) => String(p?.schoolId) === String(schoolId));
  },

  getActiveBySchool: async (schoolId) => {
    const data = await request({ method: GET, url: ENDPOINT, requiresAuth: false });
    return AcademicPeriod.fromApi(
      unwrap(data)
        .map((p) => AcademicPeriod.fromApi(toSnakeDeep(p)))
        .find((p) => String(p?.schoolId) === String(schoolId) && p?.isActive) || null,
    );
  },

  create: async (periodData) => {
    const data = await request({ method: POST, url: ENDPOINT, data: periodData.toApi(), requiresAuth: false });
    return AcademicPeriod.fromApi(data);
  },

  update: async (id, periodData) => {
    const data = await request({ method: PUT, url: `${ENDPOINT}/${id}`, data: periodData.toApi(), requiresAuth: false });
    return AcademicPeriod.fromApi(data);
  },

  delete: async (id) => {
    return request({ method: DELETE, url: `${ENDPOINT}/${id}`, requiresAuth: false });
  },
};
