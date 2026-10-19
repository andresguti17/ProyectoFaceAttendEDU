import { request, GET, POST, PUT, DELETE } from '../api/apiClient';
import { toSnakeDeep } from '../api/backend';
import Enrollment from '../models/academic/Enrollment';

const ENDPOINT = 'enrollment';

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

export const EnrollmentService = {
  getAll: async (params = {}) => {
    const data = await request({ method: GET, url: ENDPOINT, params, requiresAuth: false });
    return unwrap(data).map(Enrollment.fromApi);
  },

  // GET /api/v1/enrollment?cohort_id= no filtra; la ruta anidada GET /api/v1/cohorts/:id/enrollments sí.
  listByCohort: async (id) => {
    const data = await request({ method: GET, url: `api/v1/cohorts/${id}/enrollments`, requiresAuth: false });
    return unwrap(data).map((x) => Enrollment.fromApi(toSnakeDeep(x)));
  },

  getById: async (id) => {
    const data = await request({ method: GET, url: `${ENDPOINT}/${id}`, requiresAuth: false });
    return Enrollment.fromApi(data);
  },

  getByActor: async (academicActorId) => {
    const data = await request({ method: GET, url: ENDPOINT, params: { academic_actor_id: academicActorId }, requiresAuth: false });
    return unwrap(data).map(Enrollment.fromApi);
  },

  getByCohort: async (cohortId) => {
    const data = await request({ method: GET, url: ENDPOINT, params: { cohort_id: cohortId }, requiresAuth: false });
    return unwrap(data).map(Enrollment.fromApi);
  },

  getActiveByActor: async (academicActorId) => {
    const data = await request({ method: GET, url: ENDPOINT, params: { academic_actor_id: academicActorId, enrollment_status: 'Active' }, requiresAuth: false });
    return unwrap(data).map(Enrollment.fromApi);
  },

  // Ruta anidada (filtra en el servidor): GET /api/v1/academic-actors/:id/enrollments.
  listByActor: async (academicActorId) => {
    if (!academicActorId) return [];
    const data = await request({ method: GET, url: `api/v1/academic-actors/${academicActorId}/enrollments`, requiresAuth: false });
    return unwrap(data).map((x) => Enrollment.fromApi(toSnakeDeep(x)));
  },

  create: async (enrollmentData) => {
    const data = await request({ method: POST, url: ENDPOINT, data: enrollmentData.toApi(), requiresAuth: false });
    return Enrollment.fromApi(data);
  },

  update: async (id, enrollmentData) => {
    const data = await request({ method: PUT, url: `${ENDPOINT}/${id}`, data: enrollmentData.toApi(), requiresAuth: false });
    return Enrollment.fromApi(data);
  },

  delete: async (id) => {
    return request({ method: DELETE, url: `${ENDPOINT}/${id}`, requiresAuth: false });
  },
};
