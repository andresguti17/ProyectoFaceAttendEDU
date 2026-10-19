/**
 * SIDEBAR_CONSTANTS - Constantes compartidas del sistema Sidebar
 * 
 * Centraliza valores por defecto para mantener consistencia
 * y facilitar cambios globales.
 */

export const SIDEBAR_CONSTANTS = {
    // Dimensiones
    WIDTH: 240,
    COLLAPSED_WIDTH: 60,
    TAB_WIDTH: 36,
    TAB_HEIGHT: 52,
    
    // Animaciones
    ANIMATION_DURATION: 250,
    SPRING_CONFIG: {
        friction: 9,
        tension: 60,
    },
    
    // Spacing
    HEADER_PADDING: 20, // Volver a 20 para coincidir con PageHeader
    ITEM_PADDING: 16,
    DIVIDER_MARGIN_V: 8,
    DIVIDER_MARGIN_H: 16,
    
    // Swipe
    SWIPE_THRESHOLD_FACTOR: 0.3,
    SWIPE_VELOCITY_THRESHOLD: 0.5,
    
    // Overlay
    OVERLAY_OPACITY: 0.5,
};

/**
 * getVariantColors - Obtener colores según variante y estado
 * 
 * @param {object} params
 * @param {string} params.variant - "default" | "danger" | "success" | "warning"
 * @param {boolean} params.active - Si está activo
 * @param {boolean} params.disabled - Si está deshabilitado
 * @param {object} params.colors - theme.colors
 * @returns {object} Colores { bg, text, icon, border }
 */
export function getVariantColors({ variant = "default", active = false, disabled = false, colors }) {
    const c = colors;

    if (disabled) {
        return {
            bg: "transparent",
            text: c.text.disabled,
            icon: c.text.disabled,
            border: "transparent",
        };
    }

    if (active) {
        return {
            bg: c.brand.primaryLight,
            text: c.brand.primary,
            icon: c.brand.primary,
            border: c.brand.primary,
        };
    }

    switch (variant) {
        case "danger":
            return {
                bg: "transparent",
                text: c.status.error,
                icon: c.status.error,
                border: "transparent",
            };
        case "success":
            return {
                bg: "transparent",
                text: c.status.success,
                icon: c.status.success,
                border: "transparent",
            };
        case "warning":
            return {
                bg: "transparent",
                text: c.status.warning,
                icon: c.status.warning,
                border: "transparent",
            };
        case "default":
        default:
            return {
                bg: "transparent",
                text: c.text.primary,
                icon: c.text.primary,
                border: "transparent",
            };
    }
}
