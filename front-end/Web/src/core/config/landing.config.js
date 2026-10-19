/**
 * Configuración de personalización de la Landing (Runtime-Ready)
 * 
 * Este archivo permite personalizar la apariencia de la landing page
 * para adaptarla a cada institución educativa.
 * 
 * Las imágenes se cargan dinámicamente desde el usuario (URI), no desde assets.
 */

/**
 * Configuración de fondos personalizados para las secciones
 * 
 * Cada sección puede tener:
 * - enabled: Activar/desactivar fondo personalizado
 * - source: URI de la imagen { uri: "https://..." } o null
 * - blur: Nivel de desenfoque (0-10)
 * - opacity: Opacidad de la imagen (0-1)
 * - pattern: Patrón de overlay ('none', 'grid', 'circle')
 * - flipHorizontal: Voltear imagen horizontalmente
 * - flipVertical: Voltear imagen verticalmente
 * - position: Posición de la imagen ('center', 'top', 'bottom', 'left', 'right')
 * - overlayOpacity: Opacidad del gradiente de mezcla (0-1)
 */
export const LANDING_BACKGROUNDS = {
    hero: {
        enabled: false, // Por defecto desactivado
        source: null,   // Usuario cargará URI: { uri: "https://..." }
        blur: 3,
        opacity: 0.15,
        pattern: "circle",
        flipHorizontal: false,
        flipVertical: false,
        position: "center",
        overlayOpacity: 0.7,
    },
    testimonials: {
        enabled: false, // Por defecto desactivado
        source: null,   // Usuario cargará URI: { uri: "https://..." }
        blur: 5,
        opacity: 0.1,
        pattern: "grid",
        flipHorizontal: false,
        flipVertical: false,
        position: "center",
        overlayOpacity: 0.8,
    },
};

/**
 * Configuración de la imagen institucional (círculo en Hero)
 * 
 * - enabled: Activar/desactivar imagen personalizada
 * - source: URI de la imagen { uri: "https://..." } o null
 * - fallback: require() de la imagen por defecto (splash-icon.png)
 */
export const INSTITUTIONAL_IMAGE = {
    enabled: false, // Por defecto desactivado
    source: null,   // Usuario cargará URI: { uri: "https://..." }
    // fallback se maneja en getInstitutionalImage()
};

/**
 * Función helper para obtener la imagen institucional
 * Retorna la imagen personalizada o el fallback
 */
export function getInstitutionalImage() {
    if (INSTITUTIONAL_IMAGE.enabled && INSTITUTIONAL_IMAGE.source) {
        return INSTITUTIONAL_IMAGE.source;
    }
    // Fallback por defecto
    return require("../../assets/images/splash-icon.png");
}

/**
 * Función helper para obtener configuración de fondo de sección
 * Retorna la configuración si está habilitada, null si no
 */
export function getSectionBackground(sectionName) {
    const config = LANDING_BACKGROUNDS[sectionName];
    if (!config || !config.enabled || !config.source) {
        return null;
    }
    return config;
}

/**
 * Función para actualizar configuración en runtime
 * Esta función permite que otra vista/pantalla actualice la configuración
 * 
 * @param {string} section - Sección a actualizar: 'hero', 'testimonials', 'institutional'
 * @param {object} config - Configuración a aplicar
 * 
 * @example
 * updateLandingConfig('hero', {
 *   enabled: true,
 *   source: { uri: 'https://mi-institucion.edu/imagen.jpg' },
 *   blur: 3,
 *   pattern: 'grid'
 * });
 */
export function updateLandingConfig(section, config) {
    if (section === "institutional") {
        Object.assign(INSTITUTIONAL_IMAGE, config);
    } else if (LANDING_BACKGROUNDS[section]) {
        Object.assign(LANDING_BACKGROUNDS[section], config);
    }
}

/**
 * Función para resetear a valores por defecto
 */
export function resetLandingConfig() {
    LANDING_BACKGROUNDS.hero.enabled = false;
    LANDING_BACKGROUNDS.hero.source = null;
    LANDING_BACKGROUNDS.testimonials.enabled = false;
    LANDING_BACKGROUNDS.testimonials.source = null;
    INSTITUTIONAL_IMAGE.enabled = false;
    INSTITUTIONAL_IMAGE.source = null;
}

export default {
    LANDING_BACKGROUNDS,
    INSTITUTIONAL_IMAGE,
    getInstitutionalImage,
    getSectionBackground,
    updateLandingConfig,
    resetLandingConfig,
};

