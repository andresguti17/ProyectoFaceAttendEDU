// ============================================================
//  Calculadora de Períodos Académicos para Estudiantes
// ============================================================
//  RESPONSABILIDAD: Calcular el período académico vigente de
//  un estudiante basándose en las fechas del curso
//
//  Este módulo determina:
//  ✓ En qué período (semestre/trimestre/etc.) se encuentra
//  ✓ Si está en el último período
//  ✓ El label formateado correctamente (1er, 2do, 3er, 4to, etc.)
// ============================================================

import { getConfiguredAcademicPeriodType } from '../constants/academicPeriods';

/**
 * Obtener el ordinal correcto en español para un número
 * 
 * @param {number} num - Número del período
 * @param {boolean} isLast - Si es el último período
 * @returns {string} Ordinal formateado (1er, 2do, 3er, 4to, etc.)
 * 
 * @example
 * getOrdinal(1) => "1er"
 * getOrdinal(2) => "2do"
 * getOrdinal(3) => "3er"
 * getOrdinal(4) => "4to"
 * getOrdinal(5, true) => "Último"
 */
export function getOrdinal(num, isLast = false) {
    if (isLast) {
        return 'Último';
    }
    
    // Casos especiales
    if (num === 1) return '1er';
    if (num === 2) return '2do';
    if (num === 3) return '3er';
    
    // Para números mayores a 3
    return `${num}to`;
}

/**
 * Obtener el abreviativo del tipo de período en singular
 * 
 * @param {string} periodType - Tipo de período académico
 * @returns {string} Nombre del período en singular
 * 
 * @example
 * getPeriodName('semestral') => "semestre"
 * getPeriodName('trimestral') => "trimestre"
 */
export function getPeriodName(periodType) {
    switch (periodType) {
        case 'anual':
            return 'año';
        case 'semestral':
            return 'semestre';
        case 'cuatrimestral':
            return 'cuatrimestre';
        case 'trimestral':
            return 'trimestre';
        default:
            return 'período';
    }
}

/**
 * Calcular la duración en meses de un tipo de período
 * 
 * @param {string} periodType - Tipo de período académico
 * @returns {number} Duración en meses
 */
export function getPeriodDurationMonths(periodType) {
    switch (periodType) {
        case 'anual':
            return 12;
        case 'semestral':
            return 6;
        case 'cuatrimestral':
            return 4;
        case 'trimestral':
            return 3;
        default:
            return 6; // Default: semestral
    }
}

/**
 * Calcular en qué período se encuentra actualmente un estudiante
 * basándose en las fechas de inicio y fin de su curso
 * 
 * @param {string|Date} courseStartDate - Fecha de inicio del curso
 * @param {string|Date} courseEndDate - Fecha de fin del curso
 * @param {string} periodType - Tipo de período académico (opcional, lee de config si no se provee)
 * @param {Date} currentDate - Fecha actual (opcional, default: hoy)
 * @returns {Object} Información del período actual del estudiante
 * 
 * @example
 * // Curso que inició el 2025-02-10 y termina el 2027-04-11
 * // En modo trimestral, a octubre 2026
 * calculateStudentCurrentPeriod('2025-02-10', '2027-04-11', 'trimestral')
 * // => { periodNumber: 7, totalPeriods: 8, isLastPeriod: false, label: "7mo trimestre", ... }
 */
export function calculateStudentCurrentPeriod(
    courseStartDate,
    courseEndDate,
    periodType = null,
    currentDate = new Date()
) {
    // Si no se provee periodType, leerlo de la configuración
    const effectivePeriodType = periodType || getConfiguredAcademicPeriodType();
    
    // Convertir strings a Date si es necesario
    const startDate = typeof courseStartDate === 'string' ? new Date(courseStartDate) : courseStartDate;
    const endDate = typeof courseEndDate === 'string' ? new Date(courseEndDate) : courseEndDate;
    const current = currentDate instanceof Date ? currentDate : new Date();
    
    // Validar fechas
    if (!startDate || !endDate || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return {
            periodNumber: null,
            totalPeriods: null,
            isLastPeriod: false,
            label: '—',
            shortLabel: '—',
            error: 'Fechas inválidas',
        };
    }
    
    // Si el curso aún no ha iniciado
    if (current < startDate) {
        return {
            periodNumber: 0,
            totalPeriods: null,
            isLastPeriod: false,
            label: 'No iniciado',
            shortLabel: 'No iniciado',
            status: 'not-started',
        };
    }
    
    // Si el curso ya finalizó
    if (current > endDate) {
        const periodName = getPeriodName(effectivePeriodType);
        return {
            periodNumber: null,
            totalPeriods: null,
            isLastPeriod: false,
            label: `Finalizado`,
            shortLabel: `Finalizado`,
            status: 'finished',
        };
    }
    
    // Calcular duración total del curso en meses
    const totalMonths = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24 * 30.44)); // Promedio días por mes
    
    // Obtener duración de cada período
    const periodDurationMonths = getPeriodDurationMonths(effectivePeriodType);
    
    // Calcular número total de períodos en el curso
    const totalPeriods = Math.ceil(totalMonths / periodDurationMonths);
    
    // Calcular cuántos meses han transcurrido desde el inicio
    const elapsedMonths = Math.ceil((current - startDate) / (1000 * 60 * 60 * 24 * 30.44));
    
    // Calcular en qué período estamos actualmente (1-indexed)
    const currentPeriodNumber = Math.min(
        Math.ceil(elapsedMonths / periodDurationMonths),
        totalPeriods
    );
    
    // Determinar si estamos en el último período
    const isLastPeriod = currentPeriodNumber === totalPeriods;
    
    // Obtener nombre del tipo de período
    const periodName = getPeriodName(effectivePeriodType);
    
    // Generar label formateado
    const ordinal = getOrdinal(currentPeriodNumber, isLastPeriod);
    const label = isLastPeriod 
        ? `${ordinal} ${periodName}` 
        : `${ordinal} ${periodName}`;
    
    // Label corto (solo el ordinal con abreviatura)
    const shortLabel = isLastPeriod
        ? `Último`
        : ordinal;
    
    return {
        periodNumber: currentPeriodNumber,
        totalPeriods,
        isLastPeriod,
        label,
        shortLabel,
        periodType: effectivePeriodType,
        periodName,
        status: 'active',
        // Información adicional útil
        startDate,
        endDate,
        currentDate: current,
        elapsedMonths,
        totalMonths,
        periodDurationMonths,
    };
}

/**
 * Obtener el período actual de un estudiante desde su objeto de datos
 * Busca el curso asociado y calcula el período
 * 
 * @param {Object} student - Objeto estudiante con al menos { course, ... }
 * @param {Array} courses - Array de cursos disponibles
 * @param {string} periodType - Tipo de período académico (opcional)
 * @param {Date} currentDate - Fecha actual (opcional)
 * @returns {Object} Información del período actual
 * 
 * @example
 * const student = { name: "Juan", course: "ADSO" };
 * const courses = [{ name: "ADSO", startDate: "2025-02-10", endDate: "2027-04-11" }];
 * getStudentPeriodFromData(student, courses, 'trimestral')
 * // => { periodNumber: 7, label: "7mo trimestre", ... }
 */
export function getStudentPeriodFromData(student, courses, periodType = null, currentDate = new Date()) {
    // Buscar el curso del estudiante
    const course = courses.find(c => 
        c.name === student.course || 
        c.code === student.course ||
        c.id === student.courseId
    );
    
    // Si no se encuentra el curso, retornar información por defecto
    if (!course || !course.startDate || !course.endDate) {
        return {
            periodNumber: null,
            totalPeriods: null,
            isLastPeriod: false,
            label: student.grade || '—', // Usar el valor original si existe
            shortLabel: student.grade || '—',
            error: 'Curso no encontrado o sin fechas',
        };
    }
    
    // Calcular el período actual
    return calculateStudentCurrentPeriod(
        course.startDate,
        course.endDate,
        periodType,
        currentDate
    );
}

/**
 * Formatear el período de un estudiante para mostrar en UI
 * Acepta tanto un objeto de período calculado como fechas directas
 * 
 * @param {Object|string} periodOrStartDate - Objeto de período o fecha de inicio
 * @param {string} endDate - Fecha de fin (si el primer parámetro es fecha)
 * @param {string} periodType - Tipo de período académico
 * @returns {string} Label formateado para mostrar
 * 
 * @example
 * formatStudentPeriod({ periodNumber: 4, isLastPeriod: false, periodName: "semestre" })
 * // => "4to semestre"
 * 
 * formatStudentPeriod('2025-02-10', '2027-04-11', 'trimestral')
 * // => "7mo trimestre"
 */
export function formatStudentPeriod(periodOrStartDate, endDate = null, periodType = null) {
    // Si es un objeto de período ya calculado
    if (typeof periodOrStartDate === 'object' && periodOrStartDate.label) {
        return periodOrStartDate.label;
    }
    
    // Si son fechas, calcular el período
    if (typeof periodOrStartDate === 'string' && endDate) {
        const period = calculateStudentCurrentPeriod(periodOrStartDate, endDate, periodType);
        return period.label;
    }
    
    // Fallback
    return '—';
}

export default {
    getOrdinal,
    getPeriodName,
    getPeriodDurationMonths,
    calculateStudentCurrentPeriod,
    getStudentPeriodFromData,
    formatStudentPeriod,
};
