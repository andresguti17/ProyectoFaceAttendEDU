// ============================================================
//  timeParser - Utilidades para parsear y formatear duraciones
//
//  Permite trabajar con formatos flexibles de tiempo:
//  - "900s" o "900" = 900 segundos
//  - "15min" = 15 minutos = 900 segundos
//  - "0.5min" = 0.5 minutos = 30 segundos
// ============================================================

/**
 * Parsea un string de tiempo a segundos
 * @param {string} input - String como "900s", "15min", "0.5min", "30"
 * @returns {object} { seconds: number, isValid: boolean, error: string }
 */
export function parseTimeToSeconds(input) {
    if (!input || typeof input !== "string") {
        return { seconds: 0, isValid: false, error: "Campo requerido" };
    }

    const trimmed = input.trim().toLowerCase();
    
    // Verificar si termina en "min"
    if (trimmed.endsWith("min")) {
        const numStr = trimmed.slice(0, -3).trim();
        const num = parseFloat(numStr);
        
        if (isNaN(num)) {
            return { seconds: 0, isValid: false, error: "Formato inválido" };
        }
        
        const seconds = Math.round(num * 60);
        return { seconds, isValid: true, error: "" };
    }
    
    // Verificar si termina en "s"
    if (trimmed.endsWith("s")) {
        const numStr = trimmed.slice(0, -1).trim();
        const num = parseFloat(numStr);
        
        if (isNaN(num)) {
            return { seconds: 0, isValid: false, error: "Formato inválido" };
        }
        
        return { seconds: Math.round(num), isValid: true, error: "" };
    }
    
    // Solo número (asumir segundos)
    const num = parseFloat(trimmed);
    if (isNaN(num)) {
        return { seconds: 0, isValid: false, error: "Formato inválido" };
    }
    
    return { seconds: Math.round(num), isValid: true, error: "" };
}

/**
 * Valida un valor parseado contra rangos
 * @param {number} seconds - Segundos a validar
 * @param {object} constraints - { min, max }
 * @returns {object} { isValid: boolean, error: string, contextualMessage: object }
 */
export function validateTimeRange(seconds, constraints = {}) {
    const { min = 1, max = 900 } = constraints;
    
    if (seconds < min) {
        return {
            isValid: false,
            error: `Mínimo ${formatSecondsToReadable(min)}`,
            contextualMessage: null,
        };
    }
    
    if (seconds > max) {
        return {
            isValid: false,
            error: `Máximo ${formatSecondsToReadable(max)}`,
            contextualMessage: null,
        };
    }
    
    // Mensajes contextuales según el rango
    let contextualMessage = null;
    
    if (seconds <= 3) {
        contextualMessage = {
            type: "warning",
            text: "Muy rápido — Las notificaciones desaparecerán casi de inmediato",
        };
    } else if (seconds >= 4 && seconds <= 15) {
        contextualMessage = {
            type: "success",
            text: "Ideal — Tiempo suficiente para leer sin ser intrusiva",
        };
    } else if (seconds > 15 && seconds <= 60) {
        contextualMessage = {
            type: "info",
            text: "Moderado — Bueno para notificaciones importantes",
        };
    } else if (seconds > 60 && seconds <= 300) {
        contextualMessage = {
            type: "info",
            text: "Largo — Útil para alertas que requieren atención",
        };
    } else if (seconds > 300) {
        contextualMessage = {
            type: "warning",
            text: "Muy largo — Las notificaciones ocuparán espacio por mucho tiempo",
        };
    }
    
    return {
        isValid: true,
        error: "",
        contextualMessage,
    };
}

/**
 * Formatea segundos a un string legible
 * @param {number} seconds - Segundos a formatear
 * @returns {string} - Formato legible como "900s", "15min", "0.5min"
 */
export function formatSecondsToReadable(seconds) {
    if (seconds === 0) return "0s";
    
    // Si es múltiplo exacto de 60, mostrar en minutos
    if (seconds % 60 === 0) {
        const minutes = seconds / 60;
        return `${minutes}min`;
    }
    
    // Si es mayor a 60, preferir minutos con decimal
    if (seconds >= 60) {
        const minutes = seconds / 60;
        // Si tiene muchos decimales, mostrar en segundos
        if (minutes % 1 !== 0 && minutes.toFixed(1) !== minutes.toString()) {
            return `${seconds}s`;
        }
        return `${minutes.toFixed(1).replace(/\.0$/, "")}min`;
    }
    
    // Menor a 60, mostrar en segundos
    return `${seconds}s`;
}

/**
 * Limpia el input según las reglas de caracteres permitidos
 * @param {string} input - Input del usuario
 * @returns {string} - Input limpio
 */
export function cleanTimeInput(input) {
    // Permitir: números, punto decimal, letras s/m/i/n
    return input.replace(/[^0-9.smin]/gi, "");
}

/**
 * Obtiene el placeholder sugerido según el contexto
 * @param {number} lastValidSeconds - Últimos segundos válidos
 * @returns {string} - Placeholder sugerido
 */
export function getTimePlaceholder(lastValidSeconds = 5) {
    if (lastValidSeconds === 0 || lastValidSeconds === null) {
        return "ej: 5s, 1min";
    }
    return formatSecondsToReadable(lastValidSeconds);
}
