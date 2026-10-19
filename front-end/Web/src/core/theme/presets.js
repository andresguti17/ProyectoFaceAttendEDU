// ============================================================
//  FaceAttend EDU — Sistema de paletas semánticas de accesibilidad
//  
//  Arquitectura:
//  1. SEMANTIC_SLOTS: Define las 5 categorías semánticas genéricas
//  2. VISION_COLOR_MAP: Colores optimizados por tipo de visión
//  3. Funciones de construcción dinámica de paletas
//  4. Estados iniciales y constantes de reset
// ============================================================

// ── 1. DEFINICIÓN DE SLOTS SEMÁNTICOS (genéricos, invariables) ───
export const SEMANTIC_SLOTS = [
    { key: "primary",  label: "Primario",     description: "Color general del aplicativo, botones principales, elementos interactivos" },
    { key: "success",  label: "Correcto",     description: "Éxitos, códigos 200, confirmaciones positivas" },
    { key: "warning",  label: "Advertencias", description: "Avisos, precauciones, estados intermedios" },
    { key: "error",    label: "Errores",      description: "Fallos, zonas de peligro, estados críticos" },
    { key: "text",     label: "Fuentes",      description: "Control de colores de texto y tipografía" },
];

// ── 2. MAPA DE COLORES POR TIPO DE VISIÓN ────────────────────────
// Cada visión tiene colores optimizados para cada slot semántico
const VISION_COLOR_MAP = {
    base: {
        primary: "#1983fc", // Azul
        success: "#4fdd36", // Verde
        warning: "#FFAB00", // Ámbar
        error:   "#F04438", // Rojo
        text:    "#000000", // Negro
    },

    deuteranopia: {
        primary: "#286FE2", // Azul
        success: "#00A6A6", // Turquesa
        warning: "#E6A700", // Ámbar
        error:   "#D81B60", // Magenta
        text:    "#000000", // Negro
    },

    protanopia: {
        primary: "#286FE2", // Azul
        success: "#007F8B", // Teal
        warning: "#F0A000", // Ámbar
        error:   "#7B2CBF", // Violeta
        text:    "#000000", // Negro
    },

    tritanopia: {
        primary: "#7048D8", // Violeta
        success: "#1B9E77", // Verde
        warning: "#E76F00", // Naranja
        error:   "#D73027", // Rojo
        text:    "#000000", // Negro
    },

    achromatopsia: {
        primary: "#5A5A5A", // Gris medio
        success: "#808080", // Gris
        warning: "#B0B0B0", // Gris claro
        error:   "#303030", // Gris oscuro
        text:    "#000000", // Negro
    },
};

// ── 3. CONSTRUCCIÓN DINÁMICA DE PALETAS ───────────────────────────
/**
 * Genera la paleta completa para un tipo de visión específico
 * @param {string} visionMode - "base" | "deuteranopia" | "protanopia" | "tritanopia" | "achromatopsia"
 * @returns {Array} Array de objetos con { key, label, description, color, semantic }
 */
export function buildPaletteForVision(visionMode) {
    const colors = VISION_COLOR_MAP[visionMode];
    return SEMANTIC_SLOTS.map(slot => ({
        key: slot.key,
        label: slot.label,
        description: slot.description,
        color: colors[slot.key],
        semantic: slot.key,
        vision: visionMode,
    }));
}

// ── 4. PALETAS PRECONSTRUIDAS (para acceso rápido) ────────────────
export const VISION_PRESETS = {
    base:        buildPaletteForVision("base"),
    deuteranopia:  buildPaletteForVision("deuteranopia"),
    protanopia:    buildPaletteForVision("protanopia"),
    tritanopia:    buildPaletteForVision("tritanopia"),
    achromatopsia: buildPaletteForVision("achromatopsia"),
};

// ── 5. ESTADOS INICIALES Y CONSTANTES DE RESET ────────────────────
/**
 * Estado inicial de colores customizados (empiezan con los defaults)
 * Estructura: { visionMode: { semantic: hex } }
 * @returns {Object} Objeto con todos los modos de visión y sus colores por defecto
 */
export function getInitialCustomColors() {
    const result = {};
    Object.keys(VISION_COLOR_MAP).forEach(visionMode => {
        result[visionMode] = { ...VISION_COLOR_MAP[visionMode] };
    });
    return result;
}

/**
 * Obtiene los colores por defecto de un modo de visión específico
 * @param {string} visionMode - Modo de visión ("base" | "deuteranopia" | "protanopia" | "tritanopia" | "achromatopsia")
 * @returns {Object} Objeto con slots semánticos y sus colores { semantic: hex }
 */
export function getDefaultColorsForVision(visionMode) {
    return { ...VISION_COLOR_MAP[visionMode] };
}

/**
 * Resetea un slot semántico específico a su valor por defecto
 * @param {Object} customColors - Estado actual de colores customizados
 * @param {string} visionMode - Modo de visión actual ("base" | "deuteranopia" | "protanopia" | "tritanopia" | "achromatopsia")
 * @param {string} semantic - Slot semántico a resetear ("primary" | "success" | "warning" | "error" | "text")
 * @returns {Object} Nuevo objeto de colores con el slot reseteado
 */
export function resetSemanticSlot(customColors, visionMode, semantic) {
    return {
        ...customColors,
        [visionMode]: {
            ...customColors[visionMode],
            [semantic]: VISION_COLOR_MAP[visionMode][semantic],
        },
    };
}

/**
 * Resetea toda la paleta de un modo de visión a sus valores por defecto
 * @param {Object} customColors - Estado actual de colores customizados
 * @param {string} visionMode - Modo de visión a resetear ("base" | "deuteranopia" | "protanopia" | "tritanopia" | "achromatopsia")
 * @returns {Object} Nuevo objeto de colores con la paleta reseteada
 */
export function resetVisionPalette(customColors, visionMode) {
    return {
        ...customColors,
        [visionMode]: getDefaultColorsForVision(visionMode),
    };
}

export const VISION_LABELS = {
    base:        "Base",
    deuteranopia:  "Deuteranopia (rojo/verde)",
    protanopia:    "Protanopia (rojo)",
    tritanopia:    "Tritanopia (azul/amarillo)",
    achromatopsia: "Acromatopsia (sin color)",
};

export const VISION_DESCRIPTIONS = {
    base:        "Paleta base, optimizada para visión estándar.",
    deuteranopia:  "Tipo más común (~6% hombres). Afecta percepción del verde. Usa azul + dorado + violeta.",
    protanopia:    "Afecta percepción del rojo (~1% hombres). Azul + amarillo son los más distinguibles.",
    tritanopia:    "Afecta percepción del azul/amarillo (~0.01%). Rojo + verde son los más distinguibles.",
    achromatopsia: "Sin percepción de color (muy raro). Solo contraste de luminosidad es efectivo.",
};

export const VISION_MODES = [
    "base",
    "deuteranopia",
    "protanopia",
    "tritanopia",
    "achromatopsia",
];

export const DEFAULT_ACCENT = "#286FE2";
export const DEFAULT_MODE = "light";
export const DEFAULT_VISION_MODE = "base";
