package com.faceattend_edu.attendance_service.infrastructure.persistence.repository;

/** Fila de la agregación por sesión, actor y estado. */
public interface AttendanceGroupCount {
    Long getClassSessionId();
    Long getAcademicActorId();
    String getAttendanceStatus();
    long getTotal();
}
