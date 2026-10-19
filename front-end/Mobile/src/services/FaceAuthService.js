import { request, GET, POST, DELETE } from '../api/apiClient';
import ENV from '../config/env';

// Biometría (06-ms-biometric) tras el gateway Kong: /api/v1/biometric/<ruta>.
// Usa la misma sesión Bearer de FaceAttend; el servicio delega la validación de
// sesión/permiso en ms-identity/ms-authorization (require_permission), igual
// que el resto de microservicios — ya no emite ni valida un token propio.
// No hay pantalla Mobile todavía que consuma esto (ver webParityRequests.test.js).
const BASE = () => `${ENV.API_BASE_URL}api/v1/biometric`;

// Procesar imágenes/muestras con dlib/OpenCV es lento: más holgura que el timeout general.
const BIOMETRIC_TIMEOUT_MS = 60000;

const call = (method, path, extra = {}) =>
  request({ method, url: `${BASE()}${path}`, requiresAuth: true, timeoutMs: BIOMETRIC_TIMEOUT_MS, ...extra });

export const FaceAuthService = {
  // /api/v1/biometric/health: Kong only proxies the /api/v1/biometric prefix,
  // so the service's bare /health has no route of its own behind the gateway.
  health: () => call(GET, '/health', { timeoutMs: 8000 }),

  // ── Prueba de vida (gestos aleatorios firmados por el backend) ──
  getLivenessChallenge: (actions = 3) => call(GET, '/facial/liveness-challenge', { params: { actions } }),
  submitLivenessStep: ({ challengeToken, actionIndex, images }) =>
    call(POST, '/facial/liveness-step', {
      data: { challenge_token: challengeToken, action_index: actionIndex, images },
    }),

  // ── Rostro (person_id, no username: este servicio no tiene identidad propia) ──
  enrollFace: ({ personId, imageBase64, challengeToken }) =>
    call(POST, '/facial/enroll-image', {
      data: { person_id: personId, image_base64: imageBase64, challenge_token: challengeToken },
    }),
  identifyFace: ({ imageBase64, challengeToken }) =>
    call(POST, '/facial/identify-image', { data: { image_base64: imageBase64, challenge_token: challengeToken } }),

  // ── Huella (muestra cruda + matching por keypoints, no vector/coseno) ──
  enrollFingerprint: ({ personId, fingerNumber, sampleFormat, data, quality }) =>
    call(POST, '/fingerprint/enroll-sample', {
      data: { person_id: personId, finger_number: fingerNumber, sample_format: sampleFormat, data_base64: data, quality },
    }),
  identifyFingerprint: ({ sampleFormat, data, quality, fingerNumber }) =>
    call(POST, '/fingerprint/identify-sample', {
      data: { sample_format: sampleFormat, data_base64: data, quality, finger_number: fingerNumber },
    }),

  // ── Resumen y ciclo de vida (person_id) ──
  summary: (personId) => call(GET, `/${personId}/summary`),
  revokeFace: (personId) => call(DELETE, `/facial/${personId}`),
  deleteFingerprint: (personId, fingerNumber) => call(DELETE, `/fingerprint/${personId}/${fingerNumber}`),
};
