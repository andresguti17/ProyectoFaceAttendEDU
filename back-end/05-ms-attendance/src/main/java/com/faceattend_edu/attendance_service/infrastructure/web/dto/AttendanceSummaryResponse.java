package com.faceattend_edu.attendance_service.infrastructure.web.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Resumen de asistencia de un actor. Se devuelven los conteos y no un porcentaje
 * ya calculado: qué cuenta como asistido es una decisión de la vista, no del API.
 */
@Getter @Setter @AllArgsConstructor @NoArgsConstructor
public class AttendanceSummaryResponse {
    private long present;
    private long late;
    private long absent;
    private long justified;
    private long total;
}
