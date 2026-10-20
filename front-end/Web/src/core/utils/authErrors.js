// ============================================================
//  FaceAttend EDU — Mensajes de error de autenticación
// ============================================================
//  Traduce el error del login a un mensaje para el usuario. Un fallo del
//  servidor o del gateway (502/503/504) nunca debe mostrar el texto crudo
//  del proxy ("An invalid response was received from the upstream server").
// ============================================================

export const LOGIN_MESSAGES = {
    invalidCredentials: "Credenciales incorrectas",
    locked: "Cuenta bloqueada temporalmente por demasiados intentos. Inténtalo más tarde.",
    tooManyRequests: "Demasiados intentos. Espera un minuto e inténtalo de nuevo.",
    serverUnavailable: "El servidor no está disponible en este momento. Inténtalo de nuevo en unos segundos.",
    generic: "No se pudo iniciar sesión",
};

export function loginErrorMessage(err) {
    const status = err?.status;
    if (status === 400 || status === 401) return LOGIN_MESSAGES.invalidCredentials;
    if (status === 423) return LOGIN_MESSAGES.locked;
    if (status === 429) return LOGIN_MESSAGES.tooManyRequests;
    if (status === 0) return err.message || LOGIN_MESSAGES.serverUnavailable; // red / timeout
    if (typeof status === "number" && status >= 500) return LOGIN_MESSAGES.serverUnavailable;
    return err?.message || LOGIN_MESSAGES.generic;
}
