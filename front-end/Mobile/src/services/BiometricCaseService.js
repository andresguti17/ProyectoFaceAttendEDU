import { request, GET, POST, PATCH, DELETE } from '../api/apiClient';
import { toSnakeDeep } from '../api/backend';
import BiometricUpdateCase from '../models/configuration/BiometricUpdateCase';

// Casos RN-29 en 07-ms-configuration (camelCase). Quien no revisa solo ve los suyos.
const ENDPOINT = 'api/v1/biometric-update-cases';

function unwrap(data) {
  if (data && Array.isArray(data.value)) return data.value;
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') return [data];
  return [];
}

const fromRow = (row) => BiometricUpdateCase.fromApi(toSnakeDeep(row));
const newestFirst = (a, b) => String(b.requestedAt || '').localeCompare(String(a.requestedAt || ''));

export const BiometricCaseService = {
  getAll: async (params = {}) => {
    const data = await request({ method: GET, url: ENDPOINT, params });
    return unwrap(data).map(fromRow).sort(newestFirst);
  },

  getById: async (id) => {
    const data = await request({ method: GET, url: `${ENDPOINT}/${id}` });
    return fromRow(data);
  },

  getByPerson: async (personId) => {
    const data = await request({ method: GET, url: `api/v1/persons/${personId}/biometric-cases` });
    return unwrap(data).map(fromRow).sort(newestFirst);
  },

  getPending: async () => {
    const data = await request({ method: GET, url: ENDPOINT, params: { status: 'Pending' } });
    return unwrap(data).map(fromRow).sort(newestFirst);
  },

  /** Solicitud facial del propio usuario (biometric.case:request). */
  requestFacialUpdate: async (personId, reason) => {
    const data = await request({ method: POST, url: ENDPOINT, data: { personId, biometricType: 'FACIAL', reason } });
    return fromRow(data);
  },

  // PATCH /review: { updateStatus: In_Review | Approved | Rejected, reviewedBy?, resolutionNotes? }.
  // El backend fija reviewedAt y rechaza revisar la solicitud propia.
  review: async (id, { updateStatus, reviewedBy, resolutionNotes }) => {
    const data = await request({
      method: PATCH,
      url: `${ENDPOINT}/${id}/review`,
      data: {
        updateStatus,
        ...(reviewedBy ? { reviewedBy } : {}),
        ...(resolutionNotes ? { resolutionNotes } : {}),
      },
    });
    return fromRow(data);
  },

  approve: (id, reviewedBy, resolutionNotes) => BiometricCaseService.review(id, { updateStatus: 'Approved', reviewedBy, resolutionNotes }),

  reject: (id, reviewedBy, resolutionNotes) => BiometricCaseService.review(id, { updateStatus: 'Rejected', reviewedBy, resolutionNotes }),

  delete: async (id) => {
    return request({ method: DELETE, url: `${ENDPOINT}/${id}` });
  },
};
