// ============================================================
//  FaceAttend EDU — Generador de contraseñas temporales
// ============================================================
//  Para altas masivas: cada usuario recibe una contraseña propia que
//  cumple la política (mayúscula, minúscula, número y símbolo) y viaja
//  solo por correo. Reemplaza la contraseña compartida por defecto.
// ============================================================

const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnopqrstuvwxyz";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%&*?";
const ALL = UPPER + LOWER + DIGITS + SYMBOLS;

// Índice aleatorio en [0, max): criptográfico si el entorno lo ofrece.
function randomIndex(max) {
    const webCrypto = globalThis.crypto;
    if (webCrypto?.getRandomValues) {
        const limit = Math.floor(0x100000000 / max) * max;
        const buffer = new Uint32Array(1);
        do {
            webCrypto.getRandomValues(buffer);
        } while (buffer[0] >= limit);
        return buffer[0] % max;
    }
    return Math.floor(Math.random() * max);
}

const pick = (chars) => chars[randomIndex(chars.length)];

/**
 * Contraseña temporal de `length` caracteres (mínimo 8) con al menos una
 * mayúscula, una minúscula, un número y un símbolo. Se excluyen los
 * caracteres ambiguos (0/O, 1/l/I) para que sea fácil de teclear.
 */
export function generateTemporaryPassword(length = 12) {
    const size = Math.max(8, length);
    const chars = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SYMBOLS)];
    while (chars.length < size) chars.push(pick(ALL));
    // Fisher-Yates: los cuatro obligatorios no quedan siempre al principio.
    for (let i = chars.length - 1; i > 0; i -= 1) {
        const j = randomIndex(i + 1);
        [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join("");
}
