import { request, GET, POST, PUT, PATCH, DELETE } from '../api/apiClient';
import { backendGet, toSnakeDeep } from '../api/backend';
import ENV from '../config/env';
import Justification from '../models/attendance/Justification';

const BASE = () => ENV.ATTENDANCE_BASE_URL;
const ENDPOINT = 'api/v1/justifications';
const TYPES_ENDPOINT = 'api/v1/justification-types';
const DOCS_ENDPOINT = 'api/v1/supporting-documents';

async function review(id, reviewStatus, reviewerId, notes = null) {
  const body = { reviewStatus };
  if (reviewerId) body.reviewedBy = reviewerId;
  if (notes) body.resolutionNotes = notes;
  const data = await request({
    method: PATCH,
    url: `${BASE()}${ENDPOINT}/${id}/review`,
    data: body,
    requiresAuth: false,
  });
  return Justification.fromApi(toSnakeDeep(data));
}

export const JustificationService = {
  getAll: async (params = {}) => {
    const list = await backendGet(BASE(), ENDPOINT, params && Object.keys(params).length ? params : null);
    return list.map(Justification.fromApi);
  },

  getById: async (id) => {
    const list = await backendGet(BASE(), `${ENDPOINT}/${id}`);
    return Justification.fromApi(list[0] || null);
  },

  getByAttendanceRecord: async (attendanceRecordId) => {
    const list = await backendGet(BASE(), ENDPOINT, { attendanceRecordId });
    return list.map(Justification.fromApi);
  },

  getPending: async () => {
    const list = await backendGet(BASE(), ENDPOINT, { status: 'Pending' });
    return list.map(Justification.fromApi);
  },

  getByStatus: async (status) => {
    const list = await backendGet(BASE(), ENDPOINT, { status });
    return list.map(Justification.fromApi);
  },

  getByActor: async (academicActorId) => {
    if (!academicActorId) return [];
    const records = await backendGet(BASE(), 'api/v1/attendance-records', { academicActorId });
    // En paralelo acotado (8): en serie, cada registro sumaba un viaje y la
    // pantalla tardaba minutos con decenas de registros.
    const nested = await mapConcurrent(records, async (r) => {
      const js = await backendGet(BASE(), ENDPOINT, { attendanceRecordId: r.attendance_record_id });
      return js.map(Justification.fromApi);
    });
    return nested.flat();
  },

  create: async ({ attendanceRecordId, justificationTypeId, reason }) => {
    const data = await request({
      method: POST,
      url: `${BASE()}${ENDPOINT}`,
      data: { attendanceRecordId, justificationTypeId, reason },
      requiresAuth: false,
    });
    return Justification.fromApi(toSnakeDeep(data));
  },

  approve: async (id, reviewerId, notes = null) => review(id, 'Approved', reviewerId, notes),

  // ERF 6.2: el rechazo exige comentario; se corta aquí para que ningún llamador lo omita.
  reject: async (id, reviewerId, notes = null) => {
    if (!notes?.trim()) throw new Error('REJECTION_NOTES_REQUIRED');
    return review(id, 'Rejected', reviewerId, notes.trim());
  },

  delete: async (id) => request({ method: DELETE, url: `${BASE()}${ENDPOINT}/${id}`, requiresAuth: false }),

  getTypes: async () => backendGet(BASE(), TYPES_ENDPOINT),

  getType: async (id) => {
    const list = await backendGet(BASE(), `${TYPES_ENDPOINT}/${id}`);
    return list[0] || null;
  },

  createType: async ({ name, description = null, requiresAttachment = false }) => {
    const data = await request({
      method: POST,
      url: `${BASE()}${TYPES_ENDPOINT}`,
      data: { name, description, requiresAttachment },
      requiresAuth: false,
    });
    return toSnakeDeep(data);
  },

  updateType: async (id, { name, description = null, requiresAttachment = false }) => {
    const data = await request({
      method: PUT,
      url: `${BASE()}${TYPES_ENDPOINT}/${id}`,
      data: { name, description, requiresAttachment },
    });
    return toSnakeDeep(data);
  },

  deleteType: async (id) => request({ method: DELETE, url: `${BASE()}${TYPES_ENDPOINT}/${id}` }),

  createDocument: async ({ justificationId, fileName, storageUri, mimeType, sizeBytes }) => {
    const data = await request({
      method: POST,
      url: `${BASE()}${DOCS_ENDPOINT}`,
      data: { justificationId, fileName, storageUri, mimeType, sizeBytes: sizeBytes || 1 },
      requiresAuth: false,
    });
    return toSnakeDeep(data);
  },

  getDocuments: async (justificationId) => backendGet(BASE(), DOCS_ENDPOINT, { justificationId }),
};

// ---- shared enrichment (single-flight caches + bounded concurrency) ----
const recordCache = new Map();
const personCache = new Map();
let actorMapPromise = null;
let typeMapPromise = null;

export async function mapConcurrent(items, fn, limit = 8) {
  const out = new Array(items.length);
  let i = 0;
  const workers = new Array(Math.min(limit, items.length)).fill(null).map(async () => {
    while (i < items.length) {
      const idx = i++;
      try {
        out[idx] = await fn(items[idx], idx);
      } catch {
        out[idx] = null;
      }
    }
  });
  await Promise.all(workers);
  return out.filter((x) => x !== null && x !== undefined);
}

export function getJustificationTypeMap() {
  if (!typeMapPromise) {
    typeMapPromise = JustificationService.getTypes()
      .then((types) => {
        const map = {};
        types.forEach((t) => { map[t.justification_type_id] = t; });
        return map;
      })
      .catch(() => ({}));
  }
  return typeMapPromise;
}

export function getAcademicActorMap() {
  if (!actorMapPromise) {
    actorMapPromise = backendGet(ENV.ACADEMIC_BASE_URL, 'api/v1/academic-actors', { limit: 2000 })
      .then((actors) => {
        const map = {};
        actors.forEach((a) => { map[String(a.academic_actor_id)] = a; });
        return map;
      })
      .catch(() => ({}));
  }
  return actorMapPromise;
}

export async function getAttendanceRecordCached(attendanceRecordId) {
  const key = String(attendanceRecordId);
  if (!recordCache.has(key)) {
    const p = backendGet(BASE(), `api/v1/attendance-records/${attendanceRecordId}`)
      .then((list) => list[0] || null)
      .catch(() => null);
    recordCache.set(key, p);
  }
  return recordCache.get(key);
}

export async function getPersonCached(personId) {
  if (!personId) return null;
  const key = String(personId);
  if (!personCache.has(key)) {
    const p = backendGet(ENV.API_BASE_URL, `api/v1/persons/${personId}`)
      .then((list) => list[0] || null)
      .catch(() => null);
    personCache.set(key, p);
  }
  return personCache.get(key);
}

export function clearJustificationCaches() {
  recordCache.clear();
  personCache.clear();
  actorMapPromise = null;
  typeMapPromise = null;
}
