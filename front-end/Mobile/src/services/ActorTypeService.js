import { request, GET } from '../api/apiClient';
import { toSnakeDeep } from '../api/backend';
import AcademicActorType from '../models/academic/AcademicActorType';

const ENDPOINT = 'api/v1/actor-types';

function unwrap(data) {
  if (data && Array.isArray(data.value)) return data.value;
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') return [data];
  return [];
}

export const ActorTypeService = {
  // GET /api/v1/actor-types — catálogo STUDENT / INSTRUCTOR.
  getAll: async () => {
    const data = await request({ method: GET, url: ENDPOINT, requiresAuth: false });
    return unwrap(data).map((t) => AcademicActorType.fromApi(toSnakeDeep(t)));
  },
};
