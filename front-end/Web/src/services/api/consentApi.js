// ============================================================
//  FaceAttend EDU — Autorización de tratamiento de datos (Ley 1581)
//  identity guarda la aceptación (versión + fecha + parte biométrica) y su
//  revocación; biometric borra las plantillas cuando se revoca.
// ============================================================

import { request } from "../../api/apiClient";
import { endpoints } from "../../api/endpoints";
import { PRIVACY_POLICY_VERSION } from "../../core/config/privacy";

export const consentApi = {
    /** { accepted, upToDate, biometricAuthorized, policyVersion, currentPolicyVersion, acceptedAt, channel } */
    get: (personId) => request(endpoints.identity.personConsent(personId), { method: "GET" }),

    /** Acepta el aviso vigente; la parte biométrica es opcional (art. 6-a). */
    accept: (personId, { biometricAccepted = false } = {}) =>
        request(endpoints.identity.personConsent(personId), {
            method: "POST",
            body: { policyVersion: PRIVACY_POLICY_VERSION, biometricAccepted: biometricAccepted === true },
        }),

    /** Revoca la autorización biométrica y suprime las plantillas (art. 8-e). */
    revokeBiometric: async (personId) => {
        await request(endpoints.biometric.personData(personId), { method: "DELETE" });
        return request(endpoints.identity.personConsentBiometric(personId), { method: "DELETE" });
    },
};

/** Cuerpo de consentimiento para las altas: el administrador confirma lo que aceptó el titular. */
export function consentBody({ biometricAccepted = false } = {}) {
    return { policyVersion: PRIVACY_POLICY_VERSION, biometricAccepted: biometricAccepted === true };
}
