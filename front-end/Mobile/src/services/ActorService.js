import { request, GET, POST, PUT, DELETE } from '../api/apiClient';
import { backendGet, toSnakeDeep } from '../api/backend';
import ENV from '../config/env';
import AcademicActor from '../models/academic/AcademicActor';

const ENDPOINT = 'api/v1/academic-actors';
const BASE = () => ENV.ACADEMIC_BASE_URL;

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

export const ActorService = {
  getAll: async (params = {}) => {
    const data = await request({ method: GET, url: ENDPOINT, params, requiresAuth: false });
    return unwrap(data).map((a) => AcademicActor.fromApi(toSnakeDeep(a)));
  },

  getById: async (id) => {
    const data = await request({ method: GET, url: `${ENDPOINT}/${id}`, requiresAuth: false });
    return AcademicActor.fromApi(toSnakeDeep(unwrapFirst(data)));
  },

  // Backend: GET /api/v1/academic-actors no filtra; existe la ruta anidada
  // GET /api/v1/schools/:schoolId/actors. actorType: 'STUDENT' (1) | 'INSTRUCTOR' (2).
  getBySchool: async (schoolId, actorType = null) => {
    const data = await request({ method: GET, url: `api/v1/schools/${schoolId}/actors`, requiresAuth: false });
    const typeId = actorType === 'STUDENT' ? 1 : actorType === 'INSTRUCTOR' ? 2 : null;
    return unwrap(data)
      .map((a) => AcademicActor.fromApi(toSnakeDeep(a)))
      .filter((a) => !typeId || a?.actorTypeId === typeId);
  },

  getByPerson: async (personId) => {
    if (!personId) return [];
    // ?personId= filtra en el servidor: el listado completo se corta en 100
    // filas (ms-academic), así que con más actores el del usuario no aparecía.
    // Caché de 5 min: cada pantalla pide el actor del usuario al montarse.
    const actors = await backendGet(BASE(), ENDPOINT, { personId }, { useCache: true });
    return actors
      .filter((a) => String(a.person_id ?? a.personId) === String(personId))
      .map(AcademicActor.fromApi);
  },

  getStudents: async (schoolId) => {
    return ActorService.getBySchool(schoolId, 'STUDENT');
  },

  getInstructors: async (schoolId) => {
    return ActorService.getBySchool(schoolId, 'INSTRUCTOR');
  },

  create: async (actorData) => {
    // ms-academic (zod) habla camelCase y descarta las llaves snake:
    // el toApi en snake fallaba con 400. Los null se omiten.
    const a = actorData ?? {};
    const body = {
      personId: a.personId ?? a.person_id,
      actorTypeId: a.actorTypeId ?? a.actor_type_id,
      schoolId: a.schoolId ?? a.school_id,
      actorCode: a.actorCode ?? a.actor_code,
      startedOn: a.startedOn ?? a.started_on,
      status: a.status,
    };
    Object.keys(body).forEach((k) => (body[k] === null || body[k] === undefined) && delete body[k]);
    const data = await request({ method: POST, url: ENDPOINT, data: body, requiresAuth: false });
    return AcademicActor.fromApi(toSnakeDeep(data));
  },

  update: async (id, actorData) => {
    const data = await request({ method: PUT, url: `${ENDPOINT}/${id}`, data: actorData.toApi(), requiresAuth: false });
    return AcademicActor.fromApi(data);
  },

  delete: async (id) => {
    return request({ method: DELETE, url: `${ENDPOINT}/${id}`, requiresAuth: false });
  },
};
