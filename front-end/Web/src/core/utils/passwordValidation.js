// ============================================================
//  FaceAttend EDU — Password Validation Utilities
// ============================================================
//  Utilidades reutilizables para validación robusta de contraseñas
//
//  Valida:
//  ✓ Longitud mínima (8 caracteres)
//  ✓ Al menos 1 mayúscula
//  ✓ Al menos 1 minúscula
//  ✓ Al menos 1 número
//  ✓ Al menos 1 carácter especial
//  ✓ No contiene secuencias comunes (123456, qwerty, etc)
//  ✓ No contiene patrones de teclado
//  ✓ No usa información del usuario (nombre, email)
// ============================================================

// ── Patrones comunes y débiles ────────────────────────────────

const COMMON_PASSWORDS = [
    "123456", "password", "12345678", "qwerty", "123456789", "12345",
    "1234", "111111", "1234567", "dragon", "123123", "baseball",
    "iloveyou", "trustno1", "1234567890", "sunshine", "master",
    "welcome", "shadow", "ashley", "football", "jesus", "michael",
    "ninja", "mustang", "password1", "abc123", "letmein", "monkey",
];

const KEYBOARD_PATTERNS = [
    "qwerty", "qwertyuiop", "asdfgh", "asdfghjkl", "zxcvbn", "zxcvbnm",
    "qazwsx", "qweasd", "123qwe", "1qaz2wsx", "zaq1xsw2",
    "qwertz", "azerty", // Teclados europeos
];

const SEQUENTIAL_PATTERNS = [
    "abcdef", "bcdefg", "cdefgh", "defghi", "efghij",
    "012345", "123456", "234567", "345678", "456789",
];

// ── Funciones de validación ───────────────────────────────────

/**
 * Valida si la contraseña cumple con todos los requisitos
 * @param {string} password - Contraseña a validar
 * @param {Object} userInfo - Información del usuario (username, email)
 * @returns {Object} { isValid: boolean, errors: string[] }
 */
export function validatePassword(password, userInfo = {}) {
    const errors = [];

    if (!password) {
        errors.push("La contraseña es requerida");
        return { isValid: false, errors };
    }

    // 1. Longitud mínima
    if (password.length < 8) {
        errors.push("Debe tener al menos 8 caracteres");
    }

    // 2. Al menos una mayúscula
    if (!/[A-Z]/.test(password)) {
        errors.push("Debe contener al menos 1 mayúscula");
    }

    // 3. Al menos una minúscula
    if (!/[a-z]/.test(password)) {
        errors.push("Debe contener al menos 1 minúscula");
    }

    // 4. Al menos un número
    if (!/[0-9]/.test(password)) {
        errors.push("Debe contener al menos 1 número");
    }

    // 5. Al menos un carácter especial
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        errors.push("Debe contener al menos 1 carácter especial");
    }

    // 6. No contiene contraseñas comunes
    const lowerPassword = password.toLowerCase();
    if (COMMON_PASSWORDS.includes(lowerPassword)) {
        errors.push("Esta contraseña es muy común y predecible");
    }

    // 7. No contiene patrones de teclado
    for (const pattern of KEYBOARD_PATTERNS) {
        if (lowerPassword.includes(pattern)) {
            errors.push("No uses patrones de teclado (qwerty, asdf, etc)");
            break;
        }
    }

    // 8. No contiene secuencias
    for (const pattern of SEQUENTIAL_PATTERNS) {
        if (lowerPassword.includes(pattern)) {
            errors.push("No uses secuencias consecutivas (123456, abcdef)");
            break;
        }
    }

    // 9. No contiene información del usuario
    if (userInfo.username && userInfo.username.length >= 3) {
        const username = userInfo.username.toLowerCase();
        if (lowerPassword.includes(username)) {
            errors.push("No uses tu nombre de usuario en la contraseña");
        }
    }

    // 10. No contiene parte del email
    if (userInfo.email && userInfo.email.length >= 3) {
        const emailParts = userInfo.email.toLowerCase().split("@");
        const emailUser = emailParts[0];
        
        // Separar por puntos, guiones, números
        const usernameParts = emailUser.split(/[.\-_0-9]+/).filter(part => part.length >= 3);
        
        for (const part of usernameParts) {
            if (lowerPassword.includes(part)) {
                errors.push("No uses parte de tu correo en la contraseña");
                break;
            }
        }
    }

    return {
        isValid: errors.length === 0,
        errors,
    };
}

/**
 * Calcula la fortaleza de la contraseña (0-100)
 * @param {string} password - Contraseña a evaluar
 * @returns {number} Puntuación de 0 a 100
 */
export function getPasswordStrength(password) {
    if (!password) return 0;

    let score = 0;

    // Longitud (máximo 30 puntos)
    if (password.length >= 8) score += 10;
    if (password.length >= 12) score += 10;
    if (password.length >= 16) score += 10;

    // Variedad de caracteres (máximo 40 puntos)
    if (/[a-z]/.test(password)) score += 10; // Minúsculas
    if (/[A-Z]/.test(password)) score += 10; // Mayúsculas
    if (/[0-9]/.test(password)) score += 10; // Números
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score += 10; // Especiales

    // Complejidad adicional (máximo 30 puntos)
    const uniqueChars = new Set(password).size;
    if (uniqueChars >= 6) score += 10;
    if (uniqueChars >= 10) score += 10;
    if (uniqueChars >= 14) score += 10;

    return Math.min(score, 100);
}

/**
 * Obtiene el nivel de fortaleza textual
 * @param {number} strength - Puntuación de fortaleza (0-100)
 * @returns {Object} { level: string, color: string }
 */
export function getPasswordStrengthLevel(strength) {
    if (strength < 40) {
        return { level: "Débil", color: "#EF4444" };
    } else if (strength < 70) {
        return { level: "Media", color: "#F59E0B" };
    } else if (strength < 90) {
        return { level: "Fuerte", color: "#10B981" };
    } else {
        return { level: "Muy fuerte", color: "#059669" };
    }
}

/**
 * Obtiene sugerencias para mejorar la contraseña
 * @param {string} password - Contraseña a evaluar
 * @returns {string[]} Array de sugerencias
 */
export function getPasswordSuggestions(password) {
    const suggestions = [];

    if (!password) return ["Ingresa una contraseña"];

    if (password.length < 8) {
        suggestions.push("Añade más caracteres (mínimo 8)");
    }

    if (!/[A-Z]/.test(password)) {
        suggestions.push("Añade letras mayúsculas");
    }

    if (!/[a-z]/.test(password)) {
        suggestions.push("Añade letras minúsculas");
    }

    if (!/[0-9]/.test(password)) {
        suggestions.push("Añade números");
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        suggestions.push("Añade caracteres especiales (!@#$%^&*)");
    }

    if (suggestions.length === 0) {
        suggestions.push("¡Contraseña segura!");
    }

    return suggestions;
}
