// ============================================================
//  Configuración Institucional
// ============================================================
//  Sistema de configuración persistente para la institución.
//  Se almacena en localStorage y se sincroniza con Settings.
// ============================================================

/**
 * Clave de localStorage para la configuración institucional
 */
const INSTITUTION_CONFIG_KEY = "faceattend_institution_config";

/**
 * Período académico por defecto del sistema
 */
export const DEFAULT_ACADEMIC_PERIOD = "trimestral";

/**
 * Migrar accentColor antiguo a customColors nuevo
 * Esta función se ejecuta automáticamente para mantener compatibilidad
 * 
 * @param {Object} config - Configuración institucional
 * @returns {Object} Configuración migrada
 */
function migrateAccentColorToCustomColors(config) {
    // Si ya tiene customColors, no migrar
    if (config.customColors) {
        return config;
    }
    
    // Si tiene accentColor antiguo, migrar a customColors
    if (config.accentColor && config.accentColor !== "#3B82F6") {
        const visionMode = config.visionMode || "base";
        
        const customColors = {
            [visionMode]: {
                primary: config.accentColor,
                // Los demás colores usan defaults del tema
            }
        };
        
        return {
            ...config,
            customColors,
        };
    }
    
    return config;
}

/**
 * Configuración por defecto de la institución
 */
const DEFAULT_INSTITUTION_CONFIG = {
    // Información básica
    institutionName: "Universidad Nacional",
    institutionSlug: "universidad-nacional",
    semester: "2024-2",
    
    // Períodos académicos
    academicPeriodType: DEFAULT_ACADEMIC_PERIOD,
    
    // Configuración del período actual
    periodStartDate: null, // Fecha inicio del período actual (YYYY-MM-DD)
    periodEndDate: null,   // Fecha fin del período actual (YYYY-MM-DD)
    isAutomaticPeriod: true, // Si es true, calcula automáticamente el próximo período
    
    // Asistencia
    minAttendance: 80,
    daysUntilSanction: 15,
    consecutiveDaysForSanction: 3, // Días consecutivos de inasistencia para sanción (1-5)
    
    // Idioma
    language: "es",
    
    // Formato de fecha y hora (SIMPLIFICADO)
    dateFormat: "DD/MM/YYYY", // DD/MM/YYYY | MM/DD/YYYY | YYYY-MM-DD
    timeFormat24h: true,      // true = 24h (militar) | false = 12h (AM/PM)
    
    // Reconocimiento facial
    confidenceThreshold: 85,
    autoRegister: true,
    savePhotos: false,
    
    // Notificaciones
    emailAlert: true,
    weeklyReport: true,
    atRiskAlert: true,
    dailySummary: false,
    pushNotifications: true, // Activadas por defecto
    pushDuration: 4, // Valor por defecto: 4 segundos (configuración global)
    pushNotificationLimit: 15, // Límite total mostrado: 15 notificaciones
    pushNotificationLimitByType: 5, // Límite por tipo: 5 notificaciones del mismo tipo
    
    // Seguridad
    twoFactor: false,
    sessionTime: 60,           // Minutos de timeout de sesión
    sessionWarningTime: 5,     // Minutos de advertencia antes del logout
    
    // Apariencia
    theme: "light",
    visionMode: "base",
    
    // Colores personalizados por modo de visión
    // Estructura: { visionMode: { primary, success, warning, error, text } }
    customColors: null, // null = usar defaults, objeto = colores personalizados
    
    // DEPRECADO: Mantener por compatibilidad con versiones antiguas
    accentColor: "#3B82F6",
};

/**
 * Obtener la configuración institucional desde localStorage
 * 
 * @returns {Object} Configuración institucional
 */
export function getInstitutionConfig() {
    try {
        const stored = localStorage.getItem(INSTITUTION_CONFIG_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            // Merge con defaults para agregar nuevas propiedades si se agregan después
            const merged = { ...DEFAULT_INSTITUTION_CONFIG, ...parsed };
            
            // Migrar automáticamente accentColor antiguo a customColors
            const migrated = migrateAccentColorToCustomColors(merged);
            
            // Si hubo migración, guardar para persistir
            if (migrated !== merged) {
                saveInstitutionConfig(migrated);
            }
            
            return migrated;
        }
    } catch (error) {
        console.warn("Error loading institution config from localStorage:", error);
    }
    return DEFAULT_INSTITUTION_CONFIG;
}

/**
 * Guardar la configuración institucional en localStorage
 * 
 * @param {Object} config - Configuración a guardar
 * @returns {boolean} True si se guardó exitosamente
 */
export function saveInstitutionConfig(config) {
    try {
        const toSave = { ...DEFAULT_INSTITUTION_CONFIG, ...config };
        localStorage.setItem(INSTITUTION_CONFIG_KEY, JSON.stringify(toSave));
        
        // Emitir evento custom para notificar a otros componentes
        window.dispatchEvent(new CustomEvent("institutionConfigUpdated", { 
            detail: toSave 
        }));
        
        return true;
    } catch (error) {
        console.error("Error saving institution config to localStorage:", error);
        return false;
    }
}

/**
 * Actualizar una propiedad específica de la configuración
 * 
 * @param {string} key - Clave de la propiedad
 * @param {any} value - Valor a actualizar
 * @returns {boolean} True si se actualizó exitosamente
 */
export function updateInstitutionConfigField(key, value) {
    const config = getInstitutionConfig();
    config[key] = value;
    return saveInstitutionConfig(config);
}

/**
 * Actualizar múltiples propiedades de la configuración
 * Si se detecta un cambio de período (fecha final cambiada y expirada), 
 * también limpia los horarios de los ambientes
 * 
 * @param {Object} updates - Objeto con las propiedades a actualizar
 * @returns {boolean} True si se actualizó exitosamente
 */
export function updateInstitutionConfig(updates) {
    const config = getInstitutionConfig();
    const newConfig = { ...config, ...updates };
    
    // Detectar si cambió el período y si ya expiró
    const periodChanged = 
        updates.periodEndDate && 
        updates.periodEndDate !== config.periodEndDate;
    
    if (periodChanged) {
        const newEndDate = new Date(updates.periodEndDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        newEndDate.setHours(0, 0, 0, 0);
        
        // Si el nuevo período ya expiró, limpiar horarios
        if (newEndDate < today) {
            console.log("[Config] Período ya expirado detectado al actualizar configuración. Limpiando horarios...");
            
            // Limpiar horarios de forma asíncrona (no bloqueante)
            clearAllSchedules().then(success => {
                if (success) {
                    console.log("[Config] ✅ Horarios limpiados exitosamente");
                } else {
                    console.warn("[Config] ⚠️ Error al limpiar horarios");
                }
            });
        }
    }
    
    return saveInstitutionConfig(newConfig);
}

/**
 * Guardar la configuración de tema en institutionConfig
 * Sincroniza theme, customColors y visionMode desde ThemeContext
 * 
 * @param {Object} themeConfig - { theme, customColors, visionMode }
 * @returns {boolean} True si se guardó exitosamente
 */
export function saveThemeConfigToInstitution({ theme, customColors, visionMode }) {
    const config = getInstitutionConfig();
    const updates = {};
    
    if (theme !== undefined) updates.theme = theme;
    if (customColors !== undefined) updates.customColors = customColors;
    if (visionMode !== undefined) updates.visionMode = visionMode;
    
    const newConfig = { ...config, ...updates };
    return saveInstitutionConfig(newConfig);
}

/**
 * Resetear la configuración a los valores por defecto
 * 
 * @returns {boolean} True si se reseteó exitosamente
 */
export function resetInstitutionConfig() {
    return saveInstitutionConfig(DEFAULT_INSTITUTION_CONFIG);
}

/**
 * Hook para escuchar cambios en la configuración institucional
 * Útil para que componentes se actualicen cuando cambia la config
 * 
 * @param {Function} callback - Callback a ejecutar cuando cambia la config
 */
export function onInstitutionConfigChange(callback) {
    const handler = (event) => {
        callback(event.detail);
    };
    
    window.addEventListener("institutionConfigUpdated", handler);
    
    // Retornar función de cleanup
    return () => {
        window.removeEventListener("institutionConfigUpdated", handler);
    };
}

/**
 * Exportar configuración para debugging
 */
export function exportInstitutionConfig() {
    const config = getInstitutionConfig();
    const json = JSON.stringify(config, null, 2);
    console.log("Institution Config:", json);
    return json;
}

/**
 * Importar configuración desde JSON
 * 
 * @param {string} jsonString - String JSON con la configuración
 * @returns {boolean} True si se importó exitosamente
 */
export function importInstitutionConfig(jsonString) {
    try {
        const config = JSON.parse(jsonString);
        return saveInstitutionConfig(config);
    } catch (error) {
        console.error("Error importing institution config:", error);
        return false;
    }
}

/**
 * Verificar si el período actual ha expirado
 * 
 * @returns {Object} { hasExpired: boolean, daysRemaining: number }
 */
export function checkPeriodExpiration() {
    const config = getInstitutionConfig();
    
    if (!config.periodEndDate) {
        return { hasExpired: false, daysRemaining: null, message: "No hay período configurado" };
    }
    
    const today = new Date();
    const endDate = new Date(config.periodEndDate);
    
    // Normalizar fechas a medianoche para comparar solo días
    today.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);
    
    const diffTime = endDate.getTime() - today.getTime();
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (daysRemaining < 0) {
        return {
            hasExpired: true,
            daysRemaining: 0,
            daysOverdue: Math.abs(daysRemaining),
            message: `El período expiró hace ${Math.abs(daysRemaining)} días`,
        };
    }
    
    if (daysRemaining <= 7) {
        return {
            hasExpired: false,
            daysRemaining,
            isExpiringSoon: true,
            message: `El período expira en ${daysRemaining} días`,
        };
    }
    
    return {
        hasExpired: false,
        daysRemaining,
        isExpiringSoon: false,
        message: `Quedan ${daysRemaining} días del período`,
    };
}

/**
 * Calcular la duración del período actual en días
 * 
 * @returns {number|null} Duración en días o null si no hay fechas configuradas
 */
export function getCurrentPeriodDuration() {
    const config = getInstitutionConfig();
    
    if (!config.periodStartDate || !config.periodEndDate) {
        return null;
    }
    
    const start = new Date(config.periodStartDate);
    const end = new Date(config.periodEndDate);
    
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Calcular automáticamente el próximo período basándose en la duración del actual
 * 
 * @returns {Object|null} { periodStartDate, periodEndDate } o null si no se puede calcular
 */
export function calculateNextPeriod() {
    const config = getInstitutionConfig();
    
    if (!config.periodStartDate || !config.periodEndDate) {
        return null;
    }
    
    const currentEnd = new Date(config.periodEndDate);
    const duration = getCurrentPeriodDuration();
    
    if (!duration) {
        return null;
    }
    
    // El próximo período comienza al día siguiente del fin del actual
    const nextStart = new Date(currentEnd);
    nextStart.setDate(nextStart.getDate() + 1);
    
    // El fin del próximo período es: inicio + duración - 1 día
    const nextEnd = new Date(nextStart);
    nextEnd.setDate(nextEnd.getDate() + duration - 1);
    
    return {
        periodStartDate: nextStart.toISOString().split('T')[0],
        periodEndDate: nextEnd.toISOString().split('T')[0],
        duration,
    };
}

/**
 * Borrar todos los horarios de todos los ambientes al finalizar un período
 * Esto NO elimina los ambientes ni los cursos, solo limpia los horarios asignados
 * 
 * @returns {Promise<boolean>} True si se borraron exitosamente
 */
export async function clearAllSchedules() {
    try {
        // Importar dinámicamente para evitar dependencias circulares
        const { loadEnvironments, saveEnvironments } = await import("../../models/data/EnvironmentStorage");
        
        const environments = await loadEnvironments();
        
        // Limpiar los horarios de cada ambiente
        const updatedEnvironments = environments.map(env => ({
            ...env,
            schedules: [] // Vaciar el array de horarios
        }));
        
        await saveEnvironments(updatedEnvironments);
        
        console.log(`[PeriodAdvance] ✅ Horarios borrados: ${environments.length} ambientes limpiados`);
        return true;
    } catch (error) {
        console.error("[PeriodAdvance] ❌ Error al borrar horarios:", error);
        return false;
    }
}

/**
 * Avanzar automáticamente al próximo período (solo si isAutomaticPeriod es true)
 * Al avanzar, borra todos los horarios asignados a los ambientes
 * 
 * @returns {Promise<boolean>} True si se avanzó exitosamente
 */
export async function advanceToNextPeriod() {
    const config = getInstitutionConfig();
    
    if (!config.isAutomaticPeriod) {
        console.warn("Cannot advance to next period: automatic period is disabled");
        return false;
    }
    
    const nextPeriod = calculateNextPeriod();
    
    if (!nextPeriod) {
        console.warn("Cannot calculate next period: missing start/end dates");
        return false;
    }
    
    // Borrar todos los horarios antes de avanzar el período
    const schedulesCleared = await clearAllSchedules();
    
    if (!schedulesCleared) {
        console.warn("[PeriodAdvance] ⚠️ No se pudieron borrar los horarios, pero se continuará con el avance del período");
    }
    
    // Actualizar las fechas del período
    const configUpdated = updateInstitutionConfig({
        periodStartDate: nextPeriod.periodStartDate,
        periodEndDate: nextPeriod.periodEndDate,
    });
    
    return configUpdated && schedulesCleared;
}

/**
 * Sincronizar configuración institucional con ThemeContext
 * Útil para cargar tema al iniciar la app
 * 
 * @returns {Object} { theme, visionMode, customColors }
 */
export function getThemeConfigFromInstitution() {
    const config = getInstitutionConfig();
    
    return {
        theme: config.theme || "light",
        visionMode: config.visionMode || "base",
        customColors: config.customColors || null,
    };
}
