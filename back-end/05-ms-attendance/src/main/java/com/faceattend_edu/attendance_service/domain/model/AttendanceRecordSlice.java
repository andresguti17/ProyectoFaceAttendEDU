package com.faceattend_edu.attendance_service.domain.model;

import java.util.List;

/** Tramo de una consulta paginada y el total de filas que cumplen el filtro. */
public record AttendanceRecordSlice(List<AttendanceRecord> items, long total) {}
