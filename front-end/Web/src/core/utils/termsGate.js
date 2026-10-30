// ============================================================
//  FaceAttend EDU — termsGate
//  Decide qué ve la persona al ingresar según su edad y sus términos:
//   - NONE     habilitada (adulto con términos vigentes; menor con acudiente y términos).
//   - ACCEPT   adulto que debe leer y firmar los términos (primer ingreso o versión nueva).
//   - BLOCKED  menor: el registro lo completa el administrador de la sede con el acudiente
//              presente; mientras tanto no usa funciones que exigen términos ni verificación facial.
// ============================================================

export const TERMS_GATE = { NONE: "NONE", ACCEPT: "ACCEPT", BLOCKED: "BLOCKED" };

/** Paso pendiente para el menor: GUARDIAN (falta el acudiente), DOCUMENT (falta su autorización firmada) o TERMS (falta su aceptación). */
export function resolveTermsGate(enablement) {
    if (!enablement || enablement.enabled === true) return { gate: TERMS_GATE.NONE, step: "NONE", minor: false };
    const minor = enablement.minor === true;
    const step = ["GUARDIAN", "DOCUMENT"].includes(enablement.pendingStep) ? enablement.pendingStep : "TERMS";
    return { gate: minor ? TERMS_GATE.BLOCKED : TERMS_GATE.ACCEPT, step, minor };
}

export const TERMS_UNAVAILABLE = "No se pudo verificar tu aceptación de los términos y condiciones. Revisa tu conexión e intenta ingresar de nuevo.";

/**
 * Estado de términos de la persona según identity (`getEnablement` = termsApi.get). Falla
 * cerrado, igual que la app móvil: sin persona o sin respuesta válida no se sabe si ya firmó,
 * así que lanza TERMS_UNAVAILABLE y quien llama no abre la sesión.
 */
export async function fetchTermsGate(getEnablement, personId) {
    if (!personId) throw new Error(TERMS_UNAVAILABLE);
    let enablement;
    try {
        enablement = await getEnablement(personId);
    } catch {
        throw new Error(TERMS_UNAVAILABLE);
    }
    if (typeof enablement?.enabled !== "boolean") throw new Error(TERMS_UNAVAILABLE);
    return resolveTermsGate(enablement);
}

/** Misma regla que identity: la fecha de nacimiento manda; sin fecha, una TI se trata como menor. */
export function isMinorPerson({ birthDate, documentType } = {}, today = new Date()) {
    if (birthDate) {
        const birth = new Date(birthDate);
        if (!Number.isNaN(birth.getTime())) {
            const adultOn = new Date(birth);
            adultOn.setFullYear(adultOn.getFullYear() + 18);
            return adultOn > today;
        }
    }
    return String(documentType ?? "").toUpperCase() === "TI";
}
