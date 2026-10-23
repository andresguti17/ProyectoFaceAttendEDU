// Códigos de calidad que reporta el lector DigitalPersona (Fingerprint.QualityCode del SDK,
// public/vendor/fingerprint.sdk.js). 0 = Good; 1..24 = qué falló en la captura.
// Se traducen a una indicación para quien pone el dedo: el servidor solo recibe una
// calidad numérica y responde "quality too low" sin decir el motivo.

const GOOD = 0;

const MESSAGES = {
    1: "El lector no ve la huella. Apoya el dedo sobre el sensor.",
    2: "Huella demasiado clara (dedo seco o poca presión). Presiona un poco más.",
    3: "Huella demasiado oscura (dedo húmedo o mucha presión). Limpia el dedo y presiona suave.",
    4: "La imagen tiene ruido. Limpia el sensor y el dedo e inténtalo de nuevo.",
    5: "Poco contraste. Apoya el dedo completo y firme.",
    6: "No se detectaron suficientes rasgos. Apoya toda la yema del dedo.",
    7: "Dedo mal centrado. Céntralo sobre el sensor.",
    8: "El lector no reconoce un dedo. Usa la yema de un dedo.",
    9: "Dedo demasiado arriba en el sensor. Bájalo un poco.",
    10: "Dedo demasiado abajo en el sensor. Súbelo un poco.",
    11: "Dedo demasiado a la izquierda. Muévelo a la derecha.",
    12: "Dedo demasiado a la derecha. Muévelo a la izquierda.",
    13: "Posición extraña del dedo. Apóyalo de forma natural.",
    14: "Moviste el dedo muy rápido. Apóyalo y espera un momento.",
    15: "Dedo torcido. Apóyalo recto.",
    16: "Contacto demasiado corto. Mantén el dedo apoyado un momento.",
    17: "Contacto demasiado lento. Repite el movimiento.",
    18: "Movimiento en sentido contrario. Repítelo.",
    19: "Presionas muy fuerte. Afloja un poco.",
    20: "Presionas muy suave. Presiona un poco más.",
    21: "Dedo húmedo. Sécalo e inténtalo de nuevo.",
    22: "El lector detectó un dedo falso.",
    23: "Contacto demasiado pequeño. Apoya más superficie del dedo.",
    24: "Dedo muy girado. Apóyalo recto.",
};

/** Código de calidad del evento del SDK, o null si no se puede leer. */
export function fingerprintQualityCode(event) {
    const code = Number(event?.quality ?? event?.code ?? event?.qualityCode ?? event?.value ?? event);
    return Number.isInteger(code) && code >= 0 ? code : null;
}

/** Indicación para el usuario cuando el lector reporta un problema; null si la huella es buena o el código no se conoce. */
export function fingerprintQualityMessage(code) {
    if (code == null || code === GOOD) return null;
    return MESSAGES[code] ?? `El lector reportó un problema con la huella (código ${code}). Inténtalo de nuevo.`;
}
