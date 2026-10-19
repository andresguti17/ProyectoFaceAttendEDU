// Biometría web (06-ms-biometric, FastAPI). Rostro con prueba de vida y huella
// DigitalPersona, fusionado desde el antiguo 10-ms-face-auth. Se consume por el
// gateway Kong: /api/v1/biometric/* -> ms-biometric:8086/* (strip_path: false),
// con la misma sesión Bearer de FaceAttend (ms-biometric valida la sesión
// contra ms-identity/ms-authorization, igual que el resto de servicios — ya no
// hay un token propio de biometría). Mismo código en local y en remoto: solo
// cambia EXPO_PUBLIC_API_URL.
//
// Indexado por person_id (UUID de Identity/Academic), no por username: a
// diferencia del antiguo face-auth, este servicio no tiene concepto de
// identidad/usuario propio.
import { request } from "../../api/apiClient";
import { endpoints } from "../../api/endpoints";

// Registro/verificación procesan imágenes con dlib/OpenCV: más holgura que el timeout general.
const BIOMETRIC_TIMEOUT_MS = 60000;

const call = (path, opts = {}) => request(path, { timeoutMs: BIOMETRIC_TIMEOUT_MS, ...opts });

export const biometricCaptureApi = {
    health: () => call(endpoints.biometric.health, { method: "GET", timeoutMs: 8000 }),

    // ── Prueba de vida (gestos aleatorios firmados por el backend) ──
    livenessChallenge: (actions = 3) =>
        call(endpoints.biometric.facialLivenessChallenge, { method: "GET", query: { actions } }),
    livenessStep: ({ challengeToken, actionIndex, images }) =>
        call(endpoints.biometric.facialLivenessStep, {
            method: "POST",
            body: { challenge_token: challengeToken, action_index: actionIndex, images },
        }),

    // ── Rostro ──
    enrollFace: ({ personId, imageBase64, challengeToken }) =>
        call(endpoints.biometric.facialEnrollImage, {
            method: "POST",
            body: { person_id: personId, image_base64: imageBase64, challenge_token: challengeToken },
        }),
    identifyFace: ({ imageBase64, challengeToken }) =>
        call(endpoints.biometric.facialIdentifyImage, {
            method: "POST",
            body: { image_base64: imageBase64, challenge_token: challengeToken },
        }),

    // ── Huella (muestra cruda + matching por keypoints, no vector/coseno) ──
    enrollFingerprint: ({ personId, fingerNumber, sampleFormat, data, quality }) =>
        call(endpoints.biometric.fingerprintEnrollSample, {
            method: "POST",
            body: {
                person_id: personId,
                finger_number: fingerNumber,
                sample_format: sampleFormat,
                data_base64: data,
                quality,
            },
        }),
    identifyFingerprint: ({ sampleFormat, data, quality, fingerNumber }) =>
        call(endpoints.biometric.fingerprintIdentifySample, {
            method: "POST",
            body: { sample_format: sampleFormat, data_base64: data, quality, finger_number: fingerNumber },
        }),

    // ── Resumen y ciclo de vida ──
    summary: (personId) => call(endpoints.biometric.summaryByPerson(personId), { method: "GET" }),
    revokeFace: (personId) => call(endpoints.biometric.facialByPerson(personId), { method: "DELETE" }),
    listFingerprints: (personId) => call(endpoints.biometric.fingerprintsByPerson(personId), { method: "GET" }),
    deleteFingerprint: (personId, fingerNumber) =>
        call(endpoints.biometric.fingerprintByPersonFinger(personId, fingerNumber), { method: "DELETE" }),
    /** Borra todas las biometrías de una persona: huella es por dedo, no hay un DELETE único. */
    deleteAllBiometrics: async (personId) => {
        const { templates } = await biometricCaptureApi.listFingerprints(personId);
        await Promise.allSettled([
            biometricCaptureApi.revokeFace(personId),
            ...(templates ?? []).map((template) =>
                biometricCaptureApi.deleteFingerprint(personId, template.finger_number)
            ),
        ]);
    },
};
