package com.faceattend_edu.attendance_service.infrastructure.persistence.repository;

/** Fila de la agregación por actor: un conteo por estado. */
public interface ActorAttendanceCount {
    Long getAcademicActorId();
    String getAttendanceStatus();
    long getTotal();
}
