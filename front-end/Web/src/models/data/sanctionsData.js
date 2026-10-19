// ============================================================
//  FaceAttend EDU — Sanctions Data Model
//
//  Modelo de datos para el registro de sanciones y notificaciones
//  de estudiantes en riesgo.
//
//  Estructura de una sanción:
//  - id: Identificador único de la sanción
//  - studentId: ID del estudiante sancionado
//  - studentName: Nombre del estudiante
//  - studentCode: Código del estudiante
//  - reason: Razón de la sanción (baja asistencia, etc.)
//  - attendanceRate: Porcentaje de asistencia al momento
//  - notificationDate: Fecha de notificación
//  - status: Estado (pending, notified, resolved)
//  - details: Detalles adicionales
// ============================================================

import { getFromLocalStorage, saveToLocalStorage } from '../../core/utils/storage';

const SANCTIONS_STORAGE_KEY = 'faceattend_sanctions';

/**
 * Obtener todas las sanciones almacenadas
 * @returns {Array} Lista de sanciones
 */
export function getSanctions() {
    const sanctions = getFromLocalStorage(SANCTIONS_STORAGE_KEY);
    return sanctions || [];
}

/**
 * Crear una nueva sanción/notificación
 * @param {Object} sanctionData - Datos de la sanción
 * @returns {Object} Sanción creada con ID
 */
export function createSanction(sanctionData) {
    const sanctions = getSanctions();
    
    const newSanction = {
        id: `sanction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        studentId: sanctionData.studentId,
        studentName: sanctionData.studentName,
        studentCode: sanctionData.studentCode,
        fichaId: sanctionData.fichaId,
        fichaName: sanctionData.fichaName,
        reason: sanctionData.reason || 'Baja asistencia',
        attendanceRate: sanctionData.attendanceRate,
        totalAbsences: sanctionData.totalAbsences || 0,
        consecutiveAbsences: sanctionData.consecutiveAbsences || 0,
        notificationDate: new Date().toISOString(),
        status: 'notified', // pending, notified, resolved
        details: sanctionData.details || {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    
    sanctions.push(newSanction);
    saveToLocalStorage(SANCTIONS_STORAGE_KEY, sanctions);
    
    return newSanction;
}

/**
 * Crear múltiples sanciones en lote
 * @param {Array} studentsData - Array de datos de estudiantes
 * @returns {Array} Sanciones creadas
 */
export function createBulkSanctions(studentsData) {
    const sanctions = getSanctions();
    const timestamp = Date.now();
    
    const newSanctions = studentsData.map((student, index) => ({
        id: `sanction_${timestamp}_${index}_${Math.random().toString(36).substr(2, 9)}`,
        studentId: student.id || student.studentId,
        studentName: student.name,
        studentCode: student.code,
        fichaId: student.fichaId || student.course,
        fichaName: student.fichaName || student.courseName,
        reason: 'Baja asistencia',
        attendanceRate: student.attendance || student.attendanceRate,
        totalAbsences: student.totalAbsences || 0,
        consecutiveAbsences: student.consecutiveAbsences || 0,
        riskLevel: student.riskLevel,
        notificationDate: new Date().toISOString(),
        status: 'notified',
        details: {
            daysUntilSanction: student.daysUntilSanction,
            lastAttendance: student.lastAttendance,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    }));
    
    const updatedSanctions = [...sanctions, ...newSanctions];
    saveToLocalStorage(SANCTIONS_STORAGE_KEY, updatedSanctions);
    
    return newSanctions;
}

/**
 * Obtener sanciones de un estudiante específico
 * @param {string} studentId - ID del estudiante
 * @returns {Array} Sanciones del estudiante
 */
export function getStudentSanctions(studentId) {
    const sanctions = getSanctions();
    return sanctions.filter(s => s.studentId === studentId);
}

/**
 * Verificar si un estudiante tiene sanciones activas
 * @param {string} studentId - ID del estudiante
 * @returns {boolean} True si tiene sanciones activas
 */
export function hasActiveSanctions(studentId) {
    const sanctions = getStudentSanctions(studentId);
    return sanctions.some(s => s.status === 'notified' || s.status === 'pending');
}

/**
 * Actualizar el estado de una sanción
 * @param {string} sanctionId - ID de la sanción
 * @param {string} newStatus - Nuevo estado
 * @returns {Object|null} Sanción actualizada o null
 */
export function updateSanctionStatus(sanctionId, newStatus) {
    const sanctions = getSanctions();
    const index = sanctions.findIndex(s => s.id === sanctionId);
    
    if (index === -1) return null;
    
    sanctions[index].status = newStatus;
    sanctions[index].updatedAt = new Date().toISOString();
    
    saveToLocalStorage(SANCTIONS_STORAGE_KEY, sanctions);
    
    return sanctions[index];
}

/**
 * Eliminar una sanción
 * @param {string} sanctionId - ID de la sanción
 * @returns {boolean} True si se eliminó correctamente
 */
export function deleteSanction(sanctionId) {
    const sanctions = getSanctions();
    const filtered = sanctions.filter(s => s.id !== sanctionId);
    
    if (filtered.length === sanctions.length) return false;
    
    saveToLocalStorage(SANCTIONS_STORAGE_KEY, filtered);
    return true;
}

/**
 * Obtener estadísticas de sanciones
 * @returns {Object} Estadísticas
 */
export function getSanctionsStats() {
    const sanctions = getSanctions();
    
    return {
        total: sanctions.length,
        pending: sanctions.filter(s => s.status === 'pending').length,
        notified: sanctions.filter(s => s.status === 'notified').length,
        resolved: sanctions.filter(s => s.status === 'resolved').length,
        byRiskLevel: {
            high: sanctions.filter(s => s.riskLevel === 'high').length,
            medium: sanctions.filter(s => s.riskLevel === 'medium').length,
            low: sanctions.filter(s => s.riskLevel === 'low').length,
        },
    };
}

/**
 * Limpiar todas las sanciones (usar con precaución)
 */
export function clearAllSanctions() {
    saveToLocalStorage(SANCTIONS_STORAGE_KEY, []);
}
