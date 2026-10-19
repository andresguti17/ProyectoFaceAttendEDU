import { request, GET, POST, PUT, DELETE } from '../api/apiClient';
import { toSnakeDeep } from '../api/backend';
import AcademicConfiguration from '../models/configuration/AcademicConfiguration';

const ENDPOINT = 'academic_configuration';

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
  return AcademicConfiguration.fromApi(toSnakeDeep(row));
}

// El backend (07, zod) habla camelCase: las respuestas se normalizan antes
// del modelo y los cuerpos se arman en camelCase. Antes se leía sin
// normalizar (todo null, la pantalla quedaba vacía) y se escribía en snake
// (400 "Invalid payload", el guardado fallaba).
function configBody(configData) {
  const body = {
    schoolId: configData.schoolId ?? configData.school_id,
    configurationName: configData.configurationName ?? configData.configuration_name,
    configurationValue: configData.configurationValue ?? configData.configuration_value,
    description: configData.description,
  };
  Object.keys(body).forEach((k) => (body[k] === null || body[k] === undefined) && delete body[k]);
  return body;
}

export const AcademicConfigService = {
  getAll: async (params = {}) => {
    const data = await request({ method: GET, url: ENDPOINT, params, requiresAuth: false });
    return unwrap(data).map(fromRow);
  },

  // GET /api/v1/schools/:schoolId/configurations — configuraciones académicas de una sede, filtradas en el servidor.
  listBySchool: async (schoolId) => {
    const data = await request({ method: GET, url: `api/v1/schools/${schoolId}/configurations`, requiresAuth: false });
    return unwrap(data).map((c) => AcademicConfiguration.fromApi(toSnakeDeep(c)));
  },

  getById: async (id) => {
    const data = await request({ method: GET, url: `${ENDPOINT}/${id}`, requiresAuth: false });
    return fromRow(unwrapFirst(data));
  },

  // Backend: GET /api/v1/academic-configurations solo filtra ?name=, así que
  // school_id se filtra en cliente.
  getBySchool: async (schoolId) => {
    const data = await request({ method: GET, url: ENDPOINT, requiresAuth: false });
    return unwrap(data)
      .map(fromRow)
      .filter((c) => String(c?.schoolId) === String(schoolId));
  },

  getByName: async (schoolId, configName) => {
    const data = await request({
      method: GET,
      url: ENDPOINT,
      params: { name: configName },
      requiresAuth: false,
    });
    return fromRow(
      unwrap(data)
        .map(fromRow)
        .find((c) => String(c?.schoolId) === String(schoolId) && c?.configurationName === configName) || null,
    );
  },

  create: async (configData) => {
    const data = await request({ method: POST, url: ENDPOINT, data: configBody(configData), requiresAuth: false });
    return fromRow(data);
  },

  update: async (id, configData) => {
    const data = await request({ method: PUT, url: `${ENDPOINT}/${id}`, data: configBody(configData), requiresAuth: false });
    return fromRow(data);
  },

  delete: async (id) => {
    return request({ method: DELETE, url: `${ENDPOINT}/${id}`, requiresAuth: false });
  },
};
