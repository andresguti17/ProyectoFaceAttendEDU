import { request, GET, POST, PUT, DELETE } from '../api/apiClient';
import { toSnakeDeep } from '../api/backend';
import School from '../models/academic/School';
import { ActorService } from './ActorService';
import { getCurrentUser } from './UserService';

const ENDPOINT = 'school';

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
  return School.fromApi(toSnakeDeep(row));
}

// El backend (03, zod) habla camelCase y desconoce las llaves snake: antes
// el PUT llegaba con school_id/code/name en snake, zod las descartaba y el
// guardado era un no-op silencioso. Los null se omiten (zod los rechaza).
function schoolBody(schoolData) {
  const body = {
    code: schoolData.code,
    name: schoolData.name,
    cityId: schoolData.cityId ?? schoolData.city_id,
    address: schoolData.address,
    phone: schoolData.phone,
    email: schoolData.email,
  };
  Object.keys(body).forEach((k) => (body[k] === null || body[k] === undefined) && delete body[k]);
  return body;
}

export const SchoolService = {
  getAll: async (params = {}) => {
    const data = await request({ method: GET, url: ENDPOINT, params, requiresAuth: false });
    return unwrap(data).map((s) => School.fromApi(toSnakeDeep(s)));
  },

  getById: async (id) => {
    const data = await request({ method: GET, url: `${ENDPOINT}/${id}`, requiresAuth: false });
    return School.fromApi(toSnakeDeep(unwrapFirst(data)));
  },

  create: async (schoolData) => {
    const data = await request({ method: POST, url: ENDPOINT, data: schoolBody(schoolData), requiresAuth: false });
    return fromRow(data);
  },

  update: async (id, schoolData) => {
    const data = await request({ method: PUT, url: `${ENDPOINT}/${id}`, data: schoolBody(schoolData), requiresAuth: false });
    return fromRow(data);
  },

  delete: async (id) => {
    return request({ method: DELETE, url: `${ENDPOINT}/${id}`, requiresAuth: false });
  },

  // Sede del usuario actual: la de su actor académico; sin actor (admin), la
  // sede con más actores (la principal) y, si no hay actores, la primera.
  getCurrentSchoolId: async () => {
    const user = await getCurrentUser();
    const actors = await ActorService.getByPerson(user?.personId);
    if (actors?.[0]?.schoolId) return actors[0].schoolId;
    const counts = {};
    for (const a of (await ActorService.getAll()) || []) {
      if (a?.schoolId != null) counts[a.schoolId] = (counts[a.schoolId] || 0) + 1;
    }
    const top = Object.entries(counts).sort((x, y) => y[1] - x[1] || Number(x[0]) - Number(y[0]))[0];
    if (top) return Number(top[0]);
    const schools = await SchoolService.getAll();
    return schools?.[0]?.schoolId || null;
  },
};
