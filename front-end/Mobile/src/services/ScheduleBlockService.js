import { request, GET, POST, PUT, DELETE } from '../api/apiClient';
import { toSnakeDeep } from '../api/backend';
import ScheduleBlock from '../models/scheduling/ScheduleBlock';

const ENDPOINT = 'schedule_block';

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

function fromRow(row) {
  return ScheduleBlock.fromApi(toSnakeDeep(row));
}

// ms-scheduling (Java) habla camelCase: los filtros en snake se ignoraban
// en silencio y las respuestas llegaban sin normalizar (todo null).
function blockBody(blockData) {
  const b = blockData ?? {};
  const body = {
    cohortId: b.cohortId ?? b.cohort_id,
    courseId: b.courseId ?? b.course_id,
    environmentId: b.environmentId ?? b.environment_id,
    instructorActorId: b.instructorActorId ?? b.instructor_actor_id,
    dayOfWeek: b.dayOfWeek ?? b.day_of_week,
    startsAt: b.startsAt ?? b.starts_at,
    endsAt: b.endsAt ?? b.ends_at,
  };
  Object.keys(body).forEach((k) => (body[k] === null || body[k] === undefined) && delete body[k]);
  return body;
}

export const ScheduleBlockService = {
  getAll: async (params = {}) => {
    const data = await request({ method: GET, url: ENDPOINT, params, requiresAuth: false });
    return unwrap(data).map(fromRow);
  },

  getById: async (id) => {
    const data = await request({ method: GET, url: `${ENDPOINT}/${id}`, requiresAuth: false });
    return fromRow(unwrapFirst(data) ?? data);
  },

  getByCohort: async (cohortId) => {
    const data = await request({ method: GET, url: ENDPOINT, params: { cohortId }, requiresAuth: false });
    return unwrap(data).map(fromRow);
  },

  getByInstructor: async (instructorActorId) => {
    const data = await request({ method: GET, url: ENDPOINT, params: { instructorActorId }, requiresAuth: false });
    return unwrap(data).map(fromRow);
  },

  getByEnvironment: async (environmentId) => {
    const data = await request({ method: GET, url: ENDPOINT, params: { environmentId }, requiresAuth: false });
    return unwrap(data).map(fromRow);
  },

  getByDay: async (dayOfWeek) => {
    const data = await request({ method: GET, url: ENDPOINT, params: { dayOfWeek }, requiresAuth: false });
    return unwrap(data).map(fromRow);
  },

  create: async (blockData) => {
    const data = await request({ method: POST, url: ENDPOINT, data: blockBody(blockData), requiresAuth: false });
    return fromRow(data);
  },

  update: async (id, blockData) => {
    const data = await request({ method: PUT, url: `${ENDPOINT}/${id}`, data: blockBody(blockData), requiresAuth: false });
    return fromRow(data);
  },

  delete: async (id) => {
    return request({ method: DELETE, url: `${ENDPOINT}/${id}`, requiresAuth: false });
  },
};
