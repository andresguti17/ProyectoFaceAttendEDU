import { request, GET } from '../api/apiClient';
import { toSnakeDeep } from '../api/backend';

// Calidad (ms-quality :8089 vía gateway): ISO/IEC 25010, 29110 e ISTQB. Las respuestas son
// documentos (no entidades del modelo relacional), así que se devuelven normalizados a snake_case.
const BASE = 'api/v1/quality';

const get = async (path, params = null) =>
  toSnakeDeep(await request({ method: GET, url: `${BASE}/${path}`, params, requiresAuth: false }));

export const QualityService = {
  getCharacteristics: () => get('characteristics'),
  getEvaluations: (params = null) => get('evaluations', params),
  getServiceSummary: (service) => get(`services/${encodeURIComponent(service)}/summary`),
  getProcessProfile: () => get('process/profile'),
  getProjects: () => get('projects'),
  getIstqbCategories: () => get('istqb/categories'),
};
