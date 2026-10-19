// ============================================================
//  FaceAttend EDU — Attendance Utilities
// ============================================================
//  Funciones auxiliares para cálculos de asistencia
//  Listas para usar con datos reales del backend
// ============================================================

/**
 * Calcula los días desde la última asistencia
 * 
 * @param {string} lastAttendanceDate - Fecha en formato YYYY-MM-DD
 * @param {Date} referenceDate - Fecha de referencia (default: hoy)
 * @returns {number} Días transcurridos
 */
export function calculateDaysSinceLastAttendance(lastAttendanceDate, referenceDate = new Date()) {
    if (!lastAttendanceDate) return 0;
    
    const lastDate = new Date(lastAttendanceDate);
    const today = referenceDate;
    
    // Normalizar a medianoche para comparar solo días
    lastDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    
    const diffTime = today.getTime() - lastDate.getTime();
    return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
}

/**
 * Calcula ausencias consecutivas desde el historial de asistencia
 * 
 * @param {Array} attendanceHistory - Array de registros de asistencia
 * @returns {number} Número de ausencias consecutivas
 * 
 * @example
 * const history = [
 *   { date: "2024-10-01", present: true },
 *   { date: "2024-10-02", present: false },
 *   { date: "2024-10-03", present: false },
 * ];
 * calculateConsecutiveAbsences(history) // → 2
 */
export function calculateConsecutiveAbsences(attendanceHistory) {
    if (!attendanceHistory || !Array.isArray(attendanceHistory) || attendanceHistory.length === 0) {
        return 0;
    }
    
    let consecutive = 0;
    
    // Recorrer desde el final (más reciente) hacia atrás
    for (let i = attendanceHistory.length - 1; i >= 0; i--) {
        const record = attendanceHistory[i];
        
        if (record.present) {
            break; // Romper la racha al encontrar una asistencia
        }
        
        consecutive++;
    }
    
    return consecutive;
}

/**
 * Calcula el total de tardanzas desde el historial
 * 
 * @param {Array} attendanceHistory - Array de registros de asistencia
 * @returns {number} Total de tardanzas
 */
export function calculateTotalLate(attendanceHistory) {
    if (!attendanceHistory || !Array.isArray(attendanceHistory)) {
        return 0;
    }
    
    return attendanceHistory.filter(record => record.late === true).length;
}

/**
 * Calcula el total de ausencias desde el historial
 * 
 * @param {Array} attendanceHistory - Array de registros de asistencia
 * @returns {number} Total de ausencias
 */
export function calculateTotalAbsences(attendanceHistory) {
    if (!attendanceHistory || !Array.isArray(attendanceHistory)) {
        return 0;
    }
    
    return attendanceHistory.filter(record => !record.present).length;
}

/**
 * Formatea los días transcurridos en texto legible
 * 
 * @param {number} days - Número de días
 * @returns {string} Texto formateado ("Hoy", "Hace 1 día", "Hace X días")
 */
export function formatDaysAgo(days) {
    if (days === 0) {
        return "Hoy";
    } else if (days === 1) {
        return "Hace 1 día";
    } else {
        return `Hace ${days} días`;
    }
}

/**
 * Determina si un estudiante está en riesgo de sanción por ausencias consecutivas
 * 
 * @param {number} consecutiveAbsences - Ausencias consecutivas actuales
 * @param {number} threshold - Umbral configurado
 * @returns {boolean} True si está en riesgo
 */
export function isAtRiskForConsecutiveAbsences(consecutiveAbsences, threshold) {
    return consecutiveAbsences >= threshold;
}

/**
 * Determina si un estudiante está en riesgo de sanción por días sin asistir
 * 
 * @param {number} daysSinceLastAttendance - Días desde la última asistencia
 * @param {number} daysUntilSanction - Umbral de días configurado
 * @returns {boolean} True si está en riesgo crítico
 */
export function isAtRiskForDaysSanction(daysSinceLastAttendance, daysUntilSanction) {
    return daysSinceLastAttendance >= daysUntilSanction;
}

/**
 * Calcula los días restantes hasta la sanción
 * 
 * @param {number} daysSinceLastAttendance - Días desde la última asistencia
 * @param {number} daysUntilSanction - Umbral de días configurado
 * @returns {number} Días restantes (0 si ya alcanzó el umbral)
 */
export function calculateDaysUntilSanction(daysSinceLastAttendance, daysUntilSanction) {
    return Math.max(0, daysUntilSanction - daysSinceLastAttendance);
}

/**
 * Calcula estadísticas completas de asistencia desde el historial
 * 
 * @param {Array} attendanceHistory - Array de registros de asistencia
 * @returns {Object} Objeto con estadísticas completas
 */
export function calculateAttendanceStats(attendanceHistory) {
    if (!attendanceHistory || !Array.isArray(attendanceHistory)) {
        return {
            totalClasses: 0,
            attendedClasses: 0,
            absences: 0,
            lateArrivals: 0,
            attendanceRate: 0,
            consecutiveAbsences: 0,
        };
    }
    
    const totalClasses = attendanceHistory.length;
    const attendedClasses = attendanceHistory.filter(r => r.present).length;
    const absences = totalClasses - attendedClasses;
    const lateArrivals = attendanceHistory.filter(r => r.late).length;
    const attendanceRate = totalClasses > 0 ? (attendedClasses / totalClasses) * 100 : 0;
    const consecutiveAbsences = calculateConsecutiveAbsences(attendanceHistory);
    
    return {
        totalClasses,
        attendedClasses,
        absences,
        lateArrivals,
        attendanceRate: Math.round(attendanceRate * 10) / 10, // Redondear a 1 decimal
        consecutiveAbsences,
    };
}

/**
 * PARA BACKEND: Validar si un registro de asistencia es válido
 * 
 * @param {Object} record - Registro de asistencia
 * @returns {boolean} True si es válido
 */
export function isValidAttendanceRecord(record) {
    return (
        record &&
        typeof record === 'object' &&
        'date' in record &&
        'present' in record &&
        typeof record.present === 'boolean'
    );
}
