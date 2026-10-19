// ============================================================
//  useDurationInput - Hook para manejar inputs de duración con unidades
//
//  Parsea y valida duraciones en formato flexible: "900s", "15min", "0.5min"
//  Convierte todo a segundos internamente para validación consistente.
//
//  @param {object} config - Configuración
//  @param {number} config.minSeconds - Mínimo en segundos (default: 1)
//  @param {number} config.maxSeconds - Máximo en segundos (default: 900)
//  @param {number} config.defaultValue - Valor por defecto (default: 0)
//  @param {function} config.onChange - Callback al cambiar valor válido
//  @param {function} config.t - Función de traducción
//
//  @returns {object} {
//    value: string - valor del input,
//    setValue: function - setter del input,
//    error: string - mensaje de error,
//    contextualMessage: object - mensaje contextual { text, color },
//    seconds: number - valor en segundos,
//    handleBlur: function,
//    cleanInput: function - limpia caracteres no permitidos
//  }
// ============================================================

import { useState, useCallback, useMemo } from "react";

/**
 * Parsea un string de duración a segundos
 * Soporta: "900s", "15min", "0.5min", "60"
 */
function parseDurationToSeconds(input) {
    if (!input || input.trim() === "") return null;
    
    const cleaned = input.trim().toLowerCase();
    
    // Detectar unidad
    if (cleaned.endsWith("min")) {
        const num = parseFloat(cleaned.slice(0, -3));
        if (isNaN(num)) return null;
        return num * 60; // convertir minutos a segundos
    } else if (cleaned.endsWith("s")) {
        const num = parseFloat(cleaned.slice(0, -1));
        if (isNaN(num)) return null;
        return num;
    } else {
        // Sin unidad, asumir segundos
        const num = parseFloat(cleaned);
        if (isNaN(num)) return null;
        return num;
    }
}

/**
 * Formatea segundos a la mejor unidad para mostrar
 */
function formatDuration(seconds) {
    if (seconds >= 60 && seconds % 60 === 0) {
        return `${seconds / 60}min`;
    }
    return `${seconds}s`;
}

export function useDurationInput(config = {}) {
    const {
        minSeconds = 1,
        maxSeconds = 900,
        defaultValue = 0,
        onChange,
        t = (key) => key, // función de traducción por defecto
        colors = {}, // colores del tema
    } = config;

    const [inputValue, setInputValue] = useState("");
    const [error, setError] = useState("");

    /**
     * Limpia el input manteniendo solo caracteres válidos
     */
    const cleanInput = useCallback((text) => {
        // Permitir: números, punto decimal, 's', 'm', 'i', 'n'
        return text.replace(/[^0-9.smin]/gi, "");
    }, []);

    /**
     * Valida y actualiza el valor
     */
    const validateAndUpdate = useCallback((text) => {
        const cleanText = cleanInput(text);
        setInputValue(cleanText);
        setError("");

        // Si está vacío, solo marcar error
        if (!cleanText || cleanText.trim() === "") {
            setError(t("Campo requerido"));
            return;
        }

        // Parsear a segundos
        const seconds = parseDurationToSeconds(cleanText);
        
        if (seconds === null) {
            setError(t("Formato inválido. Usa: 900s, 15min, 0.5min"));
            return;
        }

        // Validar rango mínimo
        if (seconds < minSeconds) {
            setError(t(`Mínimo ${minSeconds} segundo${minSeconds > 1 ? 's' : ''}`));
            return;
        }

        // Validar rango máximo
        if (seconds > maxSeconds) {
            const maxFormatted = formatDuration(maxSeconds);
            setError(t(`Máximo ${maxFormatted}`));
            return;
        }

        // Si todo está bien, notificar cambio
        if (onChange) {
            onChange(seconds);
        }
    }, [cleanInput, minSeconds, maxSeconds, onChange, t]);

    /**
     * Genera mensaje contextual según el valor en segundos
     */
    const getContextualMessage = useCallback(() => {
        if (!inputValue || error) return null;
        
        const seconds = parseDurationToSeconds(inputValue);
        if (seconds === null) return null;

        const c = colors;

        if (seconds <= 3) {
            return {
                color: c?.status?.danger || '#dc2626',
                text: t("Muy rápido — Las notificaciones desaparecerán casi de inmediato")
            };
        }
        if (seconds >= 4 && seconds <= 15) {
            return {
                color: c?.status?.success || '#16a34a',
                text: t("Ideal — Tiempo suficiente para leer sin ser intrusiva")
            };
        }
        if (seconds > 15 && seconds <= 60) {
            return {
                color: c?.brand?.primary || '#3b82f6',
                text: t("Moderado — Bueno para notificaciones importantes")
            };
        }
        if (seconds > 60 && seconds <= 300) {
            return {
                color: c?.brand?.primary || '#3b82f6',
                text: t("Largo — Útil para alertas que requieren atención")
            };
        }
        if (seconds > 300) {
            return {
                color: c?.status?.warning || '#f59e0b',
                text: t("Muy largo — Las notificaciones ocuparán espacio por mucho tiempo")
            };
        }
        
        return null;
    }, [inputValue, error, colors, t]);

    /**
     * Maneja el blur del input
     */
    const handleBlur = useCallback(() => {
        if (!inputValue || inputValue.trim() === "") {
            setError(t("Campo requerido"));
        }
    }, [inputValue, t]);

    // Calcular valor en segundos actual
    const seconds = useMemo(() => {
        if (!inputValue || error) return 0;
        return parseDurationToSeconds(inputValue) || 0;
    }, [inputValue, error]);

    const contextualMessage = getContextualMessage();

    return {
        value: inputValue,
        setValue: validateAndUpdate,
        error,
        contextualMessage,
        seconds,
        handleBlur,
        cleanInput,
    };
}

export default useDurationInput;
