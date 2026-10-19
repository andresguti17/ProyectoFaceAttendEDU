import { request, GET, POST, PUT, DELETE } from '../api/apiClient';
import { toSnakeDeep } from '../api/backend';
import ClassSession from '../models/scheduling/ClassSession';

const ENDPOINT = 'class_session';

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

export const ClassSessionService = {
  getAll: async (params = {}) => {
    const data = await request({ method: GET, url: ENDPOINT, params, requiresAuth: false });
    return unwrap(data).map(ClassSession.fromApi);
  },

  getById: async (id) => {
    const data = await request({ method: GET, url: `${ENDPOINT}/${id}`, requiresAuth: false });
    return ClassSession.fromApi(data);
  },

  getByScheduleBlock: async (scheduleBlockId) => {
    const data = await request({ method: GET, url: ENDPOINT, params: { schedule_block_id: scheduleBlockId }, requiresAuth: false });
    return unwrap(data).map(ClassSession.fromApi);
  },

  getByDate: async (sessionDate) => {
    const data = await request({ method: GET, url: ENDPOINT, params: { session_date: sessionDate }, requiresAuth: false });
    return unwrap(data).map(ClassSession.fromApi);
  },

  getOpen: async (schoolId = null) => {
    const params = { session_status: 'Open' };
    if (schoolId) params.school_id = schoolId;
    const data = await request({ method: GET, url: ENDPOINT, params, requiresAuth: false });
    return unwrap(data).map(ClassSession.fromApi);
  },

  open: async (scheduleBlockId, sessionDate, instructorActorId) => {
    const data = await request({
      method: POST,
      url: ENDPOINT,
      data: {
        schedule_block_id: scheduleBlockId,
        session_date: sessionDate,
        opened_by: instructorActorId,
      },
      requiresAuth: false,
    });
    return ClassSession.fromApi(data);
  },

  close: async (id, instructorActorId) => {
    const data = await request({
      method: PUT,
      url: `${ENDPOINT}/${id}`,
      data: { closed_by: instructorActorId, session_status: 'Closed', closed_at: new Date().toISOString() },
      requiresAuth: false,
    });
    return ClassSession.fromApi(data);
  },

  cancel: async (id) => {
    const data = await request({ method: PUT, url: `${ENDPOINT}/${id}`, data: { session_status: 'Cancelled' }, requiresAuth: false });
    return ClassSession.fromApi(data);
  },

  // Endpoints de acción del backend (aplican las reglas de transición Open -> Closed | Cancelled):
  // POST /api/v1/class-sessions/:id/open | close | cancel.
  openById: async (id, openedBy = null) => {
    const data = await request({
      method: POST,
      url: `api/v1/class-sessions/${id}/open`,
      data: openedBy ? { openedBy } : null,
      requiresAuth: false,
    });
    return ClassSession.fromApi(toSnakeDeep(data));
  },

  closeById: async (id, closedBy = null) => {
    const data = await request({
      method: POST,
      url: `api/v1/class-sessions/${id}/close`,
      data: closedBy ? { closedBy } : null,
      requiresAuth: false,
    });
    return ClassSession.fromApi(toSnakeDeep(data));
  },

  cancelById: async (id) => {
    const data = await request({ method: POST, url: `api/v1/class-sessions/${id}/cancel`, requiresAuth: false });
    return ClassSession.fromApi(toSnakeDeep(data));
  },
};
