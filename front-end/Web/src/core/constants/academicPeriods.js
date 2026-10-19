// ============================================================
//  Configuración de Períodos Académicos
// ============================================================
//  Define los tipos de períodos académicos disponibles en el
//  sistema y sus características (semanas hábiles, etc.)
//
//  Estos valores pueden ser configurados desde Settings
// ============================================================

import { getInstitutionConfig, DEFAULT_ACADEMIC_PERIOD } from "../config/institutionConfig";
import { formatDate } from "./dateFormats";

/**
 * Tipos de períodos académicos soportados
 */
export const ACADEMIC_PERIOD_TYPES = {
    ANNUAL: 'anual',           // Anual
    SEMESTRAL: 'semestral',     // Semestral
    QUARTERLY: 'cuatrimestral',      // Cuatrimestral
    TRIMESTRAL: 'trimestral',   // Trimestral
};

/**
 * Configuración de semanas hábiles por tipo de período
 */
export const ACADEMIC_PERIOD_CONFIG = {
    [ACADEMIC_PERIOD_TYPES.ANNUAL]: {
        labelKey: 'Anual',
        minWeeks: 30,
        maxWeeks: 34,
        defaultWeeks: 32,
        descriptionKey: 'Período académico completo de un año',
        durationMonths: 12,
    },
    [ACADEMIC_PERIOD_TYPES.SEMESTRAL]: {
        labelKey: 'Semestral',
        minWeeks: 16,
        maxWeeks: 18,
        defaultWeeks: 17,
        descriptionKey: 'Período académico de medio año',
        durationMonths: 6,
    },
    [ACADEMIC_PERIOD_TYPES.QUARTERLY]: {
        labelKey: 'Cuatrimestral',
        minWeeks: 14,
        maxWeeks: 15,
        defaultWeeks: 14,
        descriptionKey: 'Período académico de cuatro meses',
        durationMonths: 4,
    },
    [ACADEMIC_PERIOD_TYPES.TRIMESTRAL]: {
        labelKey: 'Trimestral',
        minWeeks: 10,
        maxWeeks: 12,
        defaultWeeks: 11,
        descriptionKey: 'Período académico de tres meses',
        durationMonths: 3,
    },
};

/**
 * Re-exportar DEFAULT_ACADEMIC_PERIOD para compatibilidad
 */
export { DEFAULT_ACADEMIC_PERIOD };

/**
 * Obtener el tipo de período académico configurado
 * Lee desde localStorage (Settings)
 * 
 * @returns {string} Tipo de período académico
 */
export function getConfiguredAcademicPeriodType() {
    try {
        const config = getInstitutionConfig();
        return config.academicPeriodType || DEFAULT_ACADEMIC_PERIOD;
    } catch (error) {
        return DEFAULT_ACADEMIC_PERIOD;
    }
}

/**
 * Obtener las fechas del período actual configurado
 * 
 * @returns {Object} { startDate, endDate, isAutomatic } o valores null si no están configurados
 */
export function getConfiguredPeriodDates() {
    try {
        const config = getInstitutionConfig();
        return {
            startDate: config.periodStartDate,
            endDate: config.periodEndDate,
            isAutomatic: config.isAutomaticPeriod,
        };
    } catch (error) {
        return {
            startDate: null,
            endDate: null,
            isAutomatic: true,
        };
    }
}

/**
 * Obtener configuración de período académico
 * 
 * @param {string} periodType - Tipo de período (annual, semestral, quarterly, trimestral)
 * @returns {Object} Configuración del período
 */
export function getAcademicPeriodConfig(periodType = DEFAULT_ACADEMIC_PERIOD) {
    return ACADEMIC_PERIOD_CONFIG[periodType] || ACADEMIC_PERIOD_CONFIG[DEFAULT_ACADEMIC_PERIOD];
}

/**
 * Obtener número de semanas para un período académico
 * 
 * @param {string} periodType - Tipo de período
 * @returns {number} Número de semanas hábiles
 */
export function getAcademicPeriodWeeks(periodType = DEFAULT_ACADEMIC_PERIOD) {
    const config = getAcademicPeriodConfig(periodType);
    return config.defaultWeeks;
}

/**
 * Validar si un número de semanas es válido para un período
 * 
 * @param {number} weeks - Número de semanas
 * @param {string} periodType - Tipo de período
 * @returns {boolean} True si es válido
 */
export function isValidWeekCount(weeks, periodType = DEFAULT_ACADEMIC_PERIOD) {
    const config = getAcademicPeriodConfig(periodType);
    return weeks >= config.minWeeks && weeks <= config.maxWeeks;
}

/**
 * Calcular semana actual del período académico
 * 
 * @param {Date} startDate - Fecha de inicio del período
 * @param {Date} currentDate - Fecha actual (default: hoy)
 * @returns {number} Número de semana actual (1-indexed, mínimo 1)
 */
export function getCurrentAcademicWeek(startDate, currentDate = new Date()) {
    const diffTime = currentDate - startDate;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const weekNumber = Math.floor(diffDays / 7) + 1; // +1 para que empiece en semana 1
    return Math.max(1, weekNumber); // Asegurar que siempre sea al menos 1
}

/**
 * Generar labels de semanas para un período académico
 * 
 * @param {number} totalWeeks - Total de semanas del período
 * @param {number} startWeek - Semana de inicio (default: 1)
 * @returns {Array<string>} Array de labels ["Sem 1", "Sem 2", ...]
 */
export function generateWeekLabels(totalWeeks, startWeek = 1) {
    return Array.from(
        { length: totalWeeks },
        (_, i) => `Sem ${startWeek + i}`
    );
}

/**
 * Calcular en qué período del año nos encontramos actualmente
 * basándose en la división del año según el tipo de período
 * 
 * @param {string} periodType - Tipo de período académico
 * @param {Date} referenceDate - Fecha de referencia (default: hoy)
 * @returns {Object} { periodNumber, label, startMonth, endMonth, startDate, endDate }
 */
export function calculateCurrentPeriodByYear(periodType = DEFAULT_ACADEMIC_PERIOD, referenceDate = new Date()) {
    const year = referenceDate.getFullYear();
    const currentMonth = referenceDate.getMonth(); // 0-11
    
    let periodsPerYear;
    let monthsPerPeriod;
    let periodNames;
    
    switch (periodType) {
        case ACADEMIC_PERIOD_TYPES.ANNUAL:
            periodsPerYear = 1;
            monthsPerPeriod = 12;
            periodNames = ['Año Académico'];
            break;
        case ACADEMIC_PERIOD_TYPES.SEMESTRAL:
            periodsPerYear = 2;
            monthsPerPeriod = 6;
            periodNames = ['Primer Semestre', 'Segundo Semestre'];
            break;
        case ACADEMIC_PERIOD_TYPES.QUARTERLY:
            periodsPerYear = 3;
            monthsPerPeriod = 4;
            periodNames = ['Primer Cuatrimestre', 'Segundo Cuatrimestre', 'Tercer Cuatrimestre'];
            break;
        case ACADEMIC_PERIOD_TYPES.TRIMESTRAL:
            periodsPerYear = 4;
            monthsPerPeriod = 3;
            periodNames = ['Primer Trimestre', 'Segundo Trimestre', 'Tercer Trimestre', 'Cuarto Trimestre'];
            break;
        default:
            periodsPerYear = 4;
            monthsPerPeriod = 3;
            periodNames = ['Primer Trimestre', 'Segundo Trimestre', 'Tercer Trimestre', 'Cuarto Trimestre'];
    }
    
    // Calcular en qué período estamos basándose en el mes actual
    const periodNumber = Math.floor(currentMonth / monthsPerPeriod) + 1;
    
    // Calcular meses de inicio y fin del período
    const startMonth = (periodNumber - 1) * monthsPerPeriod;
    const endMonth = startMonth + monthsPerPeriod - 1;
    
    // Calcular fechas exactas (primer día del mes de inicio, último día del mes de fin)
    const startDate = new Date(year, startMonth, 1);
    const endDate = new Date(year, endMonth + 1, 0); // Día 0 del siguiente mes = último día del mes actual
    
    return {
        periodNumber,
        label: periodNames[periodNumber - 1] || `Período ${periodNumber}`,
        startMonth,
        endMonth,
        startDate,
        endDate,
        year,
        monthsPerPeriod,
    };
}

/**
 * Calcular todos los períodos del año basándose en división por meses
 * 
 * @param {string} periodType - Tipo de período académico
 * @param {number} year - Año de referencia (default: año actual)
 * @returns {Array<Object>} Array de períodos con sus fechas y semanas
 */
export function getYearAcademicPeriodsByMonth(periodType = DEFAULT_ACADEMIC_PERIOD, year = new Date().getFullYear()) {
    let periodsPerYear;
    let monthsPerPeriod;
    let periodNames;
    
    switch (periodType) {
        case ACADEMIC_PERIOD_TYPES.ANNUAL:
            periodsPerYear = 1;
            monthsPerPeriod = 12;
            periodNames = ['Año Académico'];
            break;
        case ACADEMIC_PERIOD_TYPES.SEMESTRAL:
            periodsPerYear = 2;
            monthsPerPeriod = 6;
            periodNames = ['Primer Semestre', 'Segundo Semestre'];
            break;
        case ACADEMIC_PERIOD_TYPES.QUARTERLY:
            periodsPerYear = 3;
            monthsPerPeriod = 4;
            periodNames = ['Primer Cuatrimestre', 'Segundo Cuatrimestre', 'Tercer Cuatrimestre'];
            break;
        case ACADEMIC_PERIOD_TYPES.TRIMESTRAL:
            periodsPerYear = 4;
            monthsPerPeriod = 3;
            periodNames = ['Primer Trimestre', 'Segundo Trimestre', 'Tercer Trimestre', 'Cuarto Trimestre'];
            break;
        default:
            periodsPerYear = 4;
            monthsPerPeriod = 3;
            periodNames = ['Primer Trimestre', 'Segundo Trimestre', 'Tercer Trimestre', 'Cuarto Trimestre'];
    }
    
    const today = new Date();
    const periods = [];
    
    // Calcular semana del año para inicio de año
    const startOfYear = new Date(year, 0, 1);
    
    for (let i = 0; i < periodsPerYear; i++) {
        const startMonth = i * monthsPerPeriod;
        const endMonth = startMonth + monthsPerPeriod - 1;
        
        const startDate = new Date(year, startMonth, 1);
        const endDate = new Date(year, endMonth + 1, 0);
        
        const isCurrent = today >= startDate && today <= endDate;
        const isFuture = today < startDate;
        
        // Calcular número de semana del año para startDate y endDate
        const startWeek = getCurrentAcademicWeek(startOfYear, startDate);
        const endWeek = getCurrentAcademicWeek(startOfYear, endDate);
        const totalWeeks = endWeek - startWeek + 1;
        
        periods.push({
            id: `${periodType}-${year}-${i + 1}`,
            label: periodNames[i],
            periodNumber: i + 1,
            startDate,
            endDate,
            startMonth,
            endMonth,
            monthsPerPeriod,
            startWeek,
            endWeek,
            totalWeeks,
            isCurrent,
            isFuture,
            isPast: !isCurrent && !isFuture,
            year,
        });
    }
    
    return periods;
}

/**
 * Obtener el período académico actual
 * Prioriza las fechas configuradas manualmente, sino calcula automáticamente por año
 * 
 * @param {string} periodType - Tipo de período académico (opcional, lee de config si no se provee)
 * @returns {Object|null} Período actual con toda su información
 */
export function getCurrentPeriod(periodType) {
    // Si no se provee periodType, leerlo de la configuración
    const effectivePeriodType = periodType || getConfiguredAcademicPeriodType();
    
    // Obtener fechas configuradas (pueden ser null si no están configuradas)
    const configuredDates = getConfiguredPeriodDates();
    
    // Si hay fechas configuradas manualmente, usarlas
    if (configuredDates.startDate && configuredDates.endDate) {
        const startDate = new Date(configuredDates.startDate);
        const endDate = new Date(configuredDates.endDate);
        const today = new Date();
        
        // Calcular cuál período del año sería según la división estándar
        const yearPeriod = calculateCurrentPeriodByYear(effectivePeriodType, startDate);
        
        // Calcular semanas del año para las fechas configuradas
        const startOfYear = new Date(startDate.getFullYear(), 0, 1);
        const startWeek = getCurrentAcademicWeek(startOfYear, startDate);
        const endWeek = getCurrentAcademicWeek(startOfYear, endDate);
        const totalWeeks = endWeek - startWeek + 1;
        
        return {
            id: `${effectivePeriodType}-custom-${startDate.getFullYear()}`,
            label: yearPeriod.label,
            periodNumber: yearPeriod.periodNumber,
            startDate,
            endDate,
            startWeek,
            endWeek,
            totalWeeks,
            isCurrent: today >= startDate && today <= endDate,
            isFuture: today < startDate,
            isPast: today > endDate,
            isManual: !configuredDates.isAutomatic,
            isAutomatic: configuredDates.isAutomatic,
            year: startDate.getFullYear(),
        };
    }
    
    // Si no hay fechas configuradas, calcular automáticamente por división del año
    const yearPeriod = calculateCurrentPeriodByYear(effectivePeriodType);
    
    // Calcular semanas para el período automático
    const startOfYear = new Date(yearPeriod.year, 0, 1);
    const startWeek = getCurrentAcademicWeek(startOfYear, yearPeriod.startDate);
    const endWeek = getCurrentAcademicWeek(startOfYear, yearPeriod.endDate);
    const totalWeeks = endWeek - startWeek + 1;
    
    return {
        id: `${effectivePeriodType}-${yearPeriod.year}-${yearPeriod.periodNumber}`,
        label: yearPeriod.label,
        periodNumber: yearPeriod.periodNumber,
        startDate: yearPeriod.startDate,
        endDate: yearPeriod.endDate,
        startWeek,
        endWeek,
        totalWeeks,
        isCurrent: true, // Por definición, calculateCurrentPeriodByYear retorna el período actual
        isFuture: false,
        isPast: false,
        isManual: false,
        isAutomatic: true,
        year: yearPeriod.year,
        isCalculatedByYear: true, // Flag para indicar que fue calculado por división del año
    };
}

/**
 * Formatear label de período para UI
 * 
 * @param {Object} period - Objeto de período
 * @param {string} periodType - Tipo de período
 * @returns {string} Label formateado para mostrar
 */
export function formatPeriodLabel(period, periodType) {
    return period.label;
}

/**
 * Formatear rango de fechas del período
 * 
 * @param {Object} period - Objeto de período con startDate y endDate
 * @param {string} locale - Código de locale (default: 'es-ES')
 * @returns {string} Rango formateado "15 ene 2024 - 30 jun 2024"
 */
export function formatPeriodDateRange(period, locale = 'es-ES') {
    if (!period || !period.startDate || !period.endDate) {
        return '';
    }
    
    // Usar el formato de fecha configurado
    const config = getInstitutionConfig();
    const dateFormat = config.dateFormat || "DD/MM/YYYY";
    
    const startStr = formatDate(period.startDate, dateFormat);
    const endStr = formatDate(period.endDate, dateFormat);
    
    return `${startStr} - ${endStr}`;
}

/**
 * Obtener label completo del período con fechas
 * 
 * @param {Object} period - Objeto de período
 * @param {string} locale - Código de locale (default: 'es-ES')
 * @returns {string} Label completo "Primer Semestre (15 ene - 30 jun 2024)"
 */
export function getFullPeriodLabel(period, locale = 'es-ES') {
    if (!period) {
        return '';
    }
    
    const dateRange = formatPeriodDateRange(period, locale);
    return dateRange ? `${period.label} (${dateRange})` : period.label;
}

/**
 * Calcular el próximo período basándose en el período actual y su tipo
 * Útil para modo automático
 * 
 * @param {Object} currentPeriod - Período actual
 * @param {string} periodType - Tipo de período
 * @returns {Object} Próximo período con startDate y endDate
 */
export function getNextPeriod(currentPeriod, periodType) {
    if (!currentPeriod || !currentPeriod.startDate || !currentPeriod.endDate) {
        return null;
    }
    
    const currentEnd = new Date(currentPeriod.endDate);
    const currentStart = new Date(currentPeriod.startDate);
    
    // Calcular duración del período actual en días
    const duration = Math.ceil((currentEnd - currentStart) / (1000 * 60 * 60 * 24)) + 1;
    
    // El próximo período comienza al día siguiente del fin del actual
    const nextStart = new Date(currentEnd);
    nextStart.setDate(nextStart.getDate() + 1);
    
    // El fin del próximo período es: inicio + duración - 1 día
    const nextEnd = new Date(nextStart);
    nextEnd.setDate(nextEnd.getDate() + duration - 1);
    
    // Calcular cuál sería el número de período según la división del año
    const yearPeriod = calculateCurrentPeriodByYear(periodType, nextStart);
    
    return {
        id: `${periodType}-${nextStart.getFullYear()}-${yearPeriod.periodNumber}`,
        label: yearPeriod.label,
        periodNumber: yearPeriod.periodNumber,
        startDate: nextStart,
        endDate: nextEnd,
        year: nextStart.getFullYear(),
        duration,
    };
}

export default {
    ACADEMIC_PERIOD_TYPES,
    ACADEMIC_PERIOD_CONFIG,
    DEFAULT_ACADEMIC_PERIOD,
    getAcademicPeriodConfig,
    getAcademicPeriodWeeks,
    isValidWeekCount,
    getCurrentAcademicWeek,
    generateWeekLabels,
    getConfiguredAcademicPeriodType,
    getConfiguredPeriodDates,
    calculateCurrentPeriodByYear,
    getYearAcademicPeriodsByMonth,
    getCurrentPeriod,
    formatPeriodLabel,
    formatPeriodDateRange,
    getFullPeriodLabel,
    getNextPeriod,
};
