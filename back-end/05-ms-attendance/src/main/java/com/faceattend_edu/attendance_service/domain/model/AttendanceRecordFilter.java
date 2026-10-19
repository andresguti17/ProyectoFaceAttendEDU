package com.faceattend_edu.attendance_service.domain.model;

import java.util.Set;

/**
 * Filtros de la consulta de registros. Un campo null no filtra; {@code actorScope}
 * null significa sin restricción de alcance (administrador).
 */
public record AttendanceRecordFilter(Long classSessionId, Long academicActorId, String attendanceStatus, Set<Long> actorScope) {

    public static AttendanceRecordFilter bySession(Long classSessionId, Set<Long> actorScope) {
        return new AttendanceRecordFilter(classSessionId, null, null, actorScope);
    }

    public static AttendanceRecordFilter byActor(Long academicActorId) {
        return new AttendanceRecordFilter(null, academicActorId, null, null);
    }
}
