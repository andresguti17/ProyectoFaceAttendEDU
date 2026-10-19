import { request, GET, POST, PUT, PATCH, DELETE } from '../api/apiClient';
import { toSnakeDeep } from '../api/backend';
import Person from '../models/identity/Person';

const ENDPOINT = 'person';

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

export const PersonService = {
  getAll: async (params = {}) => {
    const data = await request({ method: GET, url: ENDPOINT, params, requiresAuth: false });
    return unwrap(data).map((p) => Person.fromApi(toSnakeDeep(p)));
  },

  getById: async (id) => {
    const data = await request({ method: GET, url: `${ENDPOINT}/${id}`, requiresAuth: false });
    return Person.fromApi(toSnakeDeep(unwrapFirst(data)));
  },

  getByDocument: async (documentNumber) => {
    const data = await request({ method: GET, url: ENDPOINT, params: { document_number: documentNumber }, requiresAuth: false });
    return Person.fromApi(toSnakeDeep(unwrapFirst(data)));
  },

  create: async (personData) => {
    // ms-identity (PersonDto) habla camelCase y exige
    // documentNumber/name/lastName: el toApi en snake respondía 400.
    const p = personData ?? {};
    const body = {
      documentNumber: p.documentNumber ?? p.document_number,
      name: p.name,
      lastName: p.lastName ?? p.last_name,
      email: p.email,
      phone: p.phone,
      documentType: p.documentType ?? p.document_type,
      status: p.status,
    };
    Object.keys(body).forEach((k) => (body[k] === null || body[k] === undefined) && delete body[k]);
    const data = await request({ method: POST, url: ENDPOINT, data: body, requiresAuth: false });
    return Person.fromApi(toSnakeDeep(data));
  },

  update: async (id, personData) => {
    // ms-identity (PersonDto + validate()) habla camelCase y exige
    // documentNumber/name/lastName: el toApi en snake respondía 400.
    const p = personData ?? {};
    const body = {
      documentNumber: p.documentNumber ?? p.document_number,
      name: p.name,
      lastName: p.lastName ?? p.last_name,
      email: p.email,
      phone: p.phone,
      status: p.status,
    };
    Object.keys(body).forEach((k) => (body[k] === null || body[k] === undefined) && delete body[k]);
    const data = await request({ method: PUT, url: `${ENDPOINT}/${id}`, data: body, requiresAuth: true });
    return Person.fromApi(toSnakeDeep(data));
  },

  // Actualización con payload camelCase tal como lo espera ms-identity
  // (PersonDto): se usa para edición de perfil desde el móvil.
  updateFields: async (id, fields) => {
    const data = await request({ method: PUT, url: `${ENDPOINT}/${id}`, data: fields, requiresAuth: true });
    return Person.fromApi(toSnakeDeep(data));
  },

  setStatus: async (id, status) => {
    return request({ method: PATCH, url: `${ENDPOINT}/${id}/status`, params: { status }, requiresAuth: true });
  },

  delete: async (id) => {
    return request({ method: DELETE, url: `${ENDPOINT}/${id}`, requiresAuth: false });
  },
};
