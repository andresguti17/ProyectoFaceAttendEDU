// ============================================================
//  useDynamicInputWidth - Hook para calcular ancho dinámico de inputs
//
//  Calcula el ancho del input según la cantidad de caracteres,
//  permitiendo que el contenedor crezca de forma fluida.
//
//  @param {string} value - Valor actual del input
//  @param {object} config - Configuración del cálculo
//  @param {number} config.baseWidth - Ancho base en px (default: 20)
//  @param {number} config.pixelsPerChar - Píxeles por caracter (default: 10)
//  @param {number} config.minChars - Mínimo de caracteres para iniciar crecimiento (default: 1)
//  @param {number} config.maxWidth - Ancho máximo en px (default: null = sin límite)
//  @param {string|array} config.charType - Tipo de caracter a contar: 'all' | 'numeric' | 'alpha' | array de caracteres permitidos ['0-9', '.', 's', 'm', 'i', 'n'] (default: 'all')
//
//  @returns {number} Ancho calculado en px
//
//  @example
//  // Uso básico
//  const width = useDynamicInputWidth(inputValue);
//  
//  @example
//  // Uso con configuración personalizada (con límite)
//  const width = useDynamicInputWidth(inputValue, {
//    baseWidth: 30,
//    pixelsPerChar: 12,
//    minChars: 2,
//    maxWidth: 150,
//    charType: 'numeric'
//  });
//
//  @example
//  // Uso sin límite (crecimiento infinito)
//  const width = useDynamicInputWidth(inputValue, {
//    baseWidth: 20,
//    pixelsPerChar: 10,
//    maxWidth: null, // Sin límite
//    charType: 'numeric'
//  });
// ============================================================

import { useMemo } from "react";

export function useDynamicInputWidth(value, config = {}) {
    const {
        baseWidth = 20,
        pixelsPerChar = 10,
        minChars = 1,
        maxWidth = null, // null = sin límite (crecimiento infinito)
        charType = "all",
    } = config;

    const calculatedWidth = useMemo(() => {
        if (!value) return baseWidth;

        // Filtrar caracteres según el tipo
        let filteredValue = value;
        if (Array.isArray(charType)) {
            // Si es un array, construir regex dinámicamente - cada string es un literal permitido
            const allowedChars = charType.join("");
            const regex = new RegExp(`[^${allowedChars}]`, "gi");
            filteredValue = value.replace(regex, "");
        } else if (charType === "numeric") {
            filteredValue = value.replace(/[^0-9]/g, "");
        } else if (charType === "alpha") {
            filteredValue = value.replace(/[^a-zA-Z]/g, "");
        }

        const charCount = filteredValue.length;

        // Si no alcanza el mínimo, retornar base
        if (charCount < minChars) {
            return baseWidth;
        }

        // Calcular ancho: base + (caracteres adicionales * px por char)
        const additionalChars = charCount - minChars;
        const dynamicWidth = baseWidth + (additionalChars * pixelsPerChar);

        // Limitar al máximo solo si maxWidth está definido
        if (maxWidth !== null && maxWidth !== undefined) {
            return Math.min(dynamicWidth, maxWidth);
        }

        // Sin límite, retornar el ancho calculado
        return dynamicWidth;
    }, [value, baseWidth, pixelsPerChar, minChars, maxWidth, charType]);

    return calculatedWidth;
}

// Hook alternativo que retorna un objeto con más información
export function useDynamicInputWidthDetailed(value, config = {}) {
    const width = useDynamicInputWidth(value, config);
    
    const charCount = value ? value.length : 0;
    const maxWidth = config.maxWidth;
    const isAtMax = maxWidth !== null && maxWidth !== undefined ? width >= maxWidth : false;
    const isAtMin = width <= (config.baseWidth || 20);

    return {
        width,
        charCount,
        isAtMax,
        isAtMin,
        hasLimit: maxWidth !== null && maxWidth !== undefined,
    };
}

export default useDynamicInputWidth;
