import { getInstitutionConfig } from "../../core/config/institutionConfig";

/**
 * Obtiene la configuración de asistencia actual - Sistema simplificado de 3 niveles
 * @returns {Object} Configuración de umbrales de asistencia
 */
export function getAttendanceThresholds() {
    const config = getInstitutionConfig();
    const minAttendance = config.minAttendance ?? 80;
    const consecutiveDaysForSanction = config.consecutiveDaysForSanction ?? 3;
    
    // Sistema simplificado de 3 niveles coherente:
    // 1. EXCELLENT (SUCCESS): >= minAttendance (ej: >= 80%)
    // 2. WARNING (WARNING): >= (minAttendance - 10%) pero < minAttendance (ej: 70-79%)
    // 3. DANGER (DANGER): < (minAttendance - 10%) (ej: < 70%)
    
    const excellent = minAttendance; // >= 80% → SUCCESS (verde)
    const warning = minAttendance - 10; // >= 70% → WARNING (ámbar) 
    const danger = warning; // < 70% → DANGER (rojo)
    
    return {
        minAttendance,
        consecutiveDaysForSanction,
        excellent,
        warning,
        danger: Math.max(danger, 0),
    };
}

/**
 * Calcula la lista de estudiantes en riesgo desde la lista de estudiantes
 * USA CONFIGURACIÓN DINÁMICA Y DATOS TEMPORALES REALES
 * 
 * @param {Array} students - Lista de estudiantes con lastAttendanceDate
 * @param {number} minAttendanceThreshold - Umbral mínimo de asistencia desde configuración
 * @returns {Array} Lista de estudiantes en riesgo con metadata adicional
 */
export function getAtRiskStudents(students, minAttendanceThreshold = 80) {
    if (!students || students.length === 0) return [];
    
    // Obtener configuración REAL
    const config = getInstitutionConfig();
    const daysUntilSanction = config.daysUntilSanction || 15;
    const consecutiveDaysForSanction = config.consecutiveDaysForSanction ?? 3;
    const thresholds = getAttendanceThresholds();
    
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalizar a medianoche
    
    // Primero calculamos TODOS los datos para todos los estudiantes activos
    const studentsWithRiskData = students
        .filter(student => student.status === "active")
        .map(student => {
            const attendance = student.attendance || 0;
            const attendanceRate = Math.max(0, Math.min(100, attendance));
            const absenceRate = 100 - attendanceRate;
            
            // ══════════════════════════════════════════════════════
            // CÁLCULO REAL DE DÍAS DESDE ÚLTIMA ASISTENCIA
            // ══════════════════════════════════════════════════════
            let daysSinceLastAttendance = 0;
            let lastAttendance = "Hoy";
            
            if (student.lastAttendanceDate) {
                const lastDate = new Date(student.lastAttendanceDate);
                lastDate.setHours(0, 0, 0, 0);
                
                const diffTime = today.getTime() - lastDate.getTime();
                daysSinceLastAttendance = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                
                if (daysSinceLastAttendance === 0) {
                    lastAttendance = "Hoy";
                } else if (daysSinceLastAttendance === 1) {
                    lastAttendance = "Hace 1 día";
                } else {
                    lastAttendance = `Hace ${daysSinceLastAttendance} días`;
                }
            }
            
            // ══════════════════════════════════════════════════════
            // CÁLCULO REAL DE AUSENCIAS CONSECUTIVAS
            // ══════════════════════════════════════════════════════
            let consecutiveAbsences = 0;
            
            if (student.attendanceHistory && Array.isArray(student.attendanceHistory)) {
                // Recorrer desde el final (más reciente) hacia atrás
                for (let i = student.attendanceHistory.length - 1; i >= 0; i--) {
                    const record = student.attendanceHistory[i];
                    if (record.present) {
                        break; // Romper racha al encontrar una asistencia
                    }
                    consecutiveAbsences++;
                }
            }
            // Sin historial no se inventan faltas consecutivas a partir de días de
            // calendario: fines de semana y festivos sin clase marcaban como
            // reportable a alguien que cumple la asistencia mínima configurada.
            
            // ══════════════════════════════════════════════════════
            // CÁLCULO DE ESTADÍSTICAS
            // ══════════════════════════════════════════════════════
            // Conteos reales del resumen de asistencia; la estimación (45 clases, 15 %
            // de tardanzas) queda solo para registros sin resumen (altas locales, mock).
            const counts = student.attendanceCounts;
            const estimatedTotalClasses = student.attendanceHistory?.length || 45;
            const totalAbsences = counts
                ? counts.absent ?? 0
                : Math.round((absenceRate / 100) * estimatedTotalClasses);

            let lateCount = 0;
            if (counts) {
                lateCount = counts.late ?? 0;
            } else if (student.attendanceHistory) {
                lateCount = student.attendanceHistory.filter(r => r.late).length;
            } else {
                lateCount = Math.round(totalAbsences * 0.15);
            }
            
            // ══════════════════════════════════════════════════════
            // DÍAS HASTA SANCIÓN (LÓGICA REAL)
            // ══════════════════════════════════════════════════════
            // Calcular cuántos días faltan para alcanzar el umbral de días totales
            // Los días corridos desde la última asistencia solo cuentan si hay una
            // señal real de inasistencia: asistencia bajo el mínimo configurado o
            // faltas consecutivas en el historial. Quien cumple el mínimo y no
            // acumula faltas no corre hacia la sanción por un período sin clases.
            const hasAbsenceSignal =
                attendanceRate < minAttendanceThreshold || consecutiveAbsences > 0;
            const daysRemaining = hasAbsenceSignal
                ? Math.max(0, daysUntilSanction - daysSinceLastAttendance)
                : daysUntilSanction;
            
            // Verificar si ha superado el umbral de días consecutivos
            const hasExceededConsecutiveDays = consecutiveAbsences >= consecutiveDaysForSanction;
            
            // ══════════════════════════════════════════════════════
            // NIVEL DE RIESGO (DINÁMICO)
            // ══════════════════════════════════════════════════════
            let riskLevel = "low";
            
            // Alto riesgo si:
            // 1. Asistencia por debajo del umbral de peligro
            // 2. Ausencias consecutivas >= umbral configurado (¡SANCIÓN INMEDIATA!)
            // 3. Días hasta sanción = 0 (ya alcanzó el límite de días totales)
            // 4. Días restantes <= mitad del período configurado
            const criticalDaysThreshold = Math.ceil(daysUntilSanction / 2);
            
            if (
                attendanceRate < thresholds.danger ||
                hasExceededConsecutiveDays ||
                (hasAbsenceSignal &&
                    (daysRemaining === 0 || (daysRemaining > 0 && daysRemaining <= criticalDaysThreshold)))
            ) {
                riskLevel = "high";
            } else if (attendanceRate < thresholds.warning) {
                riskLevel = "medium";
            }
            
            return {
                id: `ars_${student.id}`,
                studentId: student.id,
                name: student.name,
                code: student.code,
                ficha: student.ficha || "N/A",
                fichaName: student.course || "N/A",
                attendanceRate,
                totalAbsences,
                consecutiveAbsences,
                lateCount,
                riskLevel,
                daysUntilSanction: daysRemaining,
                hasExceededConsecutiveDays, // ← NUEVO: flag para UI
                lastAttendance,
                // Metadata para debugging/auditoría
                _realData: {
                    lastAttendanceDate: student.lastAttendanceDate,
                    daysSinceLastAttendance,
                    hasRealHistory: !!student.attendanceHistory,
                    totalClassesInHistory: student.attendanceHistory?.length || 0,
                },
                _config: {
                    daysUntilSanction,
                    consecutiveDaysForSanction,
                    criticalDaysThreshold,
                },
            };
        });
    
    // ══════════════════════════════════════════════════════════
    // FILTRO FINAL: Solo incluir estudiantes que cumplan AL MENOS
    // UNO de estos criterios de riesgo:
    // 1. Asistencia < umbral mínimo configurado
    // 2. Ausencias consecutivas >= umbral configurado
    // 3. Días sin asistir >= umbral configurado (daysRemaining = 0)
    // ══════════════════════════════════════════════════════════
    const filteredStudents = studentsWithRiskData.filter(student => {
        const belowAttendanceThreshold = student.attendanceRate < minAttendanceThreshold;
        const exceededConsecutiveDays = student.hasExceededConsecutiveDays;
        const exceededTotalDays = student.daysUntilSanction === 0;
        
        return belowAttendanceThreshold || exceededConsecutiveDays || exceededTotalDays;
    });
    
    // Ordenar por nivel de riesgo y asistencia
    return filteredStudents.sort((a, b) => {
            // Ordenar por nivel de riesgo primero, luego por asistencia
            const riskOrder = { high: 0, medium: 1, low: 2 };
            const riskDiff = riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
            if (riskDiff !== 0) return riskDiff;
            return a.attendanceRate - b.attendanceRate;
        });
}

/**
 * Calcula la lista de estudiantes con asistencia perfecta/destacada
 * 
 * @param {Array} students - Lista de estudiantes
 * @param {number} minAttendanceThreshold - Umbral mínimo de asistencia desde configuración
 * @returns {Array} Lista de estudiantes destacados con metadata adicional
 */
export function getPerfectAttendanceStudents(students, minAttendanceThreshold = 80) {
    if (!students || students.length === 0) return [];
    
    // Asistencia perfecta si está por encima del 95% O por encima del umbral + 10%
    const perfectThreshold = Math.max(95, minAttendanceThreshold + 10);
    
    return students
        .filter(student => {
            const attendance = student.attendance || 0;
            const isActive = student.status === "active";
            return isActive && attendance >= perfectThreshold;
        })
        .map(student => {
            // Clases asistidas sobre registradas, del resumen real. Antes se mostraba
            // una "racha" de asistencia × 0,45 días sobre 45 clases supuestas.
            const counts = student.attendanceCounts;
            const attended = counts ? (counts.present ?? 0) + (counts.late ?? 0) + (counts.justified ?? 0) : null;
            return {
                id: `pas_${student.id}`,
                studentId: student.id,
                name: student.name,
                code: student.code,
                ficha: student.ficha || "N/A",
                fichaName: student.course || "N/A",
                attendanceRate: student.attendance || 0,
                totalClasses: counts?.total ?? null,
                streak: counts ? `${attended}/${counts.total} clases` : `${student.attendance || 0}%`,
            };
        })
        .sort((a, b) => b.attendanceRate - a.attendanceRate); // Mayor a menor
}

/**
 * Calcula la lista de asistencia de instructores desde la lista de profesores
 * 
 * @param {Array} teachers - Lista de profesores
 * @returns {Array} Lista de asistencia de instructores con metadata adicional
 */
export function getInstructorAttendance(teachers, classCounts = new Map()) {
    if (!teachers || teachers.length === 0) return [];

    // Obtener umbrales dinámicos
    const thresholds = getAttendanceThresholds();

    return teachers.map(teacher => {
        // Clases dictadas frente a programadas, desde las sesiones reales
        // (instructorClassCounts). Sin sesiones no hay cifra: se muestra 0 y no
        // se estima. Las tardanzas no existen para instructores: no se inventan.
        const counts = classCounts.get(String(teacher.actorId ?? "")) ?? null;
        const totalClasses = counts?.scheduled ?? 0;
        const attendedClasses = counts?.taught ?? 0;
        const missedClasses = Math.max(0, totalClasses - attendedClasses);
        const attendanceRate = totalClasses > 0 ? Math.round((attendedClasses / totalClasses) * 100) : 0;
        const lateClasses = 0;

        // Determinar status según umbrales dinámicos
        let status = "excellent";
        if (totalClasses === 0) {
            status = "nodata";
        } else if (attendanceRate < thresholds.warning) {
            status = "warning";
        } else if (attendanceRate < thresholds.excellent) {
            status = "good";
        }

        return {
            id: `ia_${teacher.id}`,
            instructorId: teacher.id,
            instructorName: teacher.name,
            department: teacher.course || teacher.department || "N/A",
            totalClasses,
            attendedClasses,
            attendanceRate,
            lateClasses,
            missedClasses,
            status,
        };
    }).sort((a, b) => b.attendanceRate - a.attendanceRate); // Mayor a menor
}

/**
 * Obtiene todos los datos derivados de usuarios en un solo objeto
 * Útil para el dashboard que necesita múltiples listas
 * 
 * @param {Array} students - Lista de estudiantes
 * @param {Array} teachers - Lista de profesores
 * @param {number} minAttendanceThreshold - Umbral mínimo desde configuración (opcional)
 * @returns {Object} Objeto con todas las listas derivadas
 */
export function getAllDerivedUserData(students, teachers, minAttendanceThreshold) {
    // Si no se proporciona umbral, obtenerlo de la configuración
    const threshold = minAttendanceThreshold ?? getAttendanceThresholds().minAttendance;
    
    return {
        atRiskStudents: getAtRiskStudents(students, threshold),
        perfectAttendanceStudents: getPerfectAttendanceStudents(students, threshold),
        instructorAttendance: getInstructorAttendance(teachers),
        thresholds: getAttendanceThresholds(),
    };
}
