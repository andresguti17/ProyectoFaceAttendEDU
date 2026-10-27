package com.faceattend_edu.attendance_service.domain.model;

import java.util.Set;

/**
 * Filtros de la consulta de justificaciones. Un campo null no filtra; {@code actorScope}
 * null significa sin restricción de alcance (administrador), y se aplica por el
 * academic_actor del registro de asistencia justificado.
 */
public record JustificationFilter(String reviewStatus, Long attendanceRecordId, Set<Long> actorScope) {}
