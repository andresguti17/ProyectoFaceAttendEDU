// ============================================================
//  FaceAttend EDU — Términos y condiciones y acudientes
//  identity guarda cada aceptación (versión, fecha, tipo de usuario, quién y en
//  qué sede) y el acudiente de cada menor de edad. Un adulto firma sus propios
//  términos; los del menor los registra el administrador de la sede con el
//  acudiente presente.
// ============================================================

import { request } from "../../api/apiClient";
import { endpoints } from "../../api/endpoints";
import { TERMS_VERSION } from "../../core/config/terms";

export const termsApi = {
    /**
     * { minor, guardianRegistered, termsAccepted, termsUpToDate, currentTermsVersion,
     *   status: ENABLED|TERMS_PENDING|GUARDIAN_PENDING|DOCUMENT_PENDING,
     *   pendingStep: NONE|TERMS|GUARDIAN|DOCUMENT, enabled }
     */
    get: (personId) => request(endpoints.identity.personTerms(personId), { method: "GET" }),

    /** Registra la aceptación de los términos vigentes (adulto: la persona; menor: el administrador). */
    accept: (personId) =>
        request(endpoints.identity.personTerms(personId), {
            method: "POST",
            body: { termsVersion: TERMS_VERSION },
        }),
};

/** Cuerpo que espera identity: solo los campos del acudiente. */
function guardianBody({ fullName, documentType, documentNumber, email, phone, relationship }) {
    return {
        fullName: String(fullName ?? "").trim(),
        documentType: String(documentType ?? "").trim(),
        documentNumber: String(documentNumber ?? "").trim(),
        email: String(email ?? "").trim() || null,
        phone: String(phone ?? "").trim() || null,
        relationship: String(relationship ?? "").trim(),
    };
}

export const guardianApi = {
    /** Acudiente vinculado al menor; 404 si todavía no hay (solo administradores). */
    get: (minorPersonId) => request(endpoints.identity.personGuardian(minorPersonId), { method: "GET" }),

    register: (minorPersonId, data) =>
        request(endpoints.identity.personGuardian(minorPersonId), { method: "POST", body: guardianBody(data) }),

    update: (minorPersonId, data) =>
        request(endpoints.identity.personGuardian(minorPersonId), { method: "PUT", body: guardianBody(data) }),

    /** Sube la autorización firmada del acudiente (PDF, JPG o PNG, máx. 5 MB) a MinIO a través de identity. */
    uploadDocument: (minorPersonId, file, fileName) => {
        const form = new FormData();
        form.append("file", file, fileName);
        return request(endpoints.identity.personGuardianDocument(minorPersonId), { method: "POST", body: form, timeoutMs: 60000 });
    },
};
