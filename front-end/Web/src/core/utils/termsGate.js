// ============================================================
//  FaceAttend EDU — termsGate
//  Decide qué ve la persona al ingresar según su edad y sus términos:
//   - NONE     habilitada (adulto con términos vigentes; menor con acudiente y términos).
//   - ACCEPT   adulto que debe leer y firmar los términos (primer ingreso o versión nueva).
//   - BLOCKED  menor: el registro lo completa el administrador de la sede con el acudiente
//              presente; mientras tanto no usa funciones que exigen términos ni verificación facial.
// ============================================================

export const TERMS_GATE = { NONE: "NONE", ACCEPT: "ACCEPT", BLOCKED: "BLOCKED" };

/** Paso pendiente para el menor: GUARDIAN (falta el acudiente) o TERMS (falta su aceptación). */
export function resolveTermsGate(enablement) {
    if (!enablement || enablement.enabled === true) return { gate: TERMS_GATE.NONE, step: "NONE", minor: false };
    const minor = enablement.minor === true;
    const step = enablement.pendingStep === "GUARDIAN" ? "GUARDIAN" : "TERMS";
    return { gate: minor ? TERMS_GATE.BLOCKED : TERMS_GATE.ACCEPT, step, minor };
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
