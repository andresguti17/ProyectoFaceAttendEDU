// Autorización de tratamiento de datos (Ley 1581 de 2012): identity guarda la
// aceptación del aviso (versión + fecha) y, aparte, la autorización biométrica,
// que es facultativa (art. 6-a). Revocarla suprime las plantillas (art. 8-e).
import { request, GET, POST, DELETE } from '../api/apiClient';

// Debe coincidir con faceattend.privacy.policy-version de ms-identity.
export const PRIVACY_POLICY_VERSION = '2026-10';

export const ConsentService = {
  get: (personId) => request({ method: GET, url: `api/v1/persons/${personId}/consent` }),

  accept: (personId, { biometricAccepted = false } = {}) => request({
    method: POST,
    url: `api/v1/persons/${personId}/consent`,
    data: { policyVersion: PRIVACY_POLICY_VERSION, biometricAccepted: biometricAccepted === true },
  }),

  /** Suprime las plantillas biométricas y registra la revocación. */
  revokeBiometric: async (personId) => {
    await request({ method: DELETE, url: `api/v1/biometric/persons/${personId}` });
    return request({ method: DELETE, url: `api/v1/persons/${personId}/consent/biometric` });
  },

  /**
   * Tras el login: si falta la aceptación del aviso vigente, la registra con la que la
   * persona dio al marcar los términos en la pantalla de ingreso. La parte biométrica
   * no se toca: se pide aparte, al registrar el rostro.
   */
  ensureAccepted: async (personId) => {
    if (!personId) return false;
    const consent = await ConsentService.get(personId);
    if (consent?.accepted && consent?.upToDate) return false;
    await ConsentService.accept(personId, { biometricAccepted: consent?.biometricAuthorized === true });
    return true;
  },
};
