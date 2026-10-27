package com.faceattend_edu.attendance_service.domain.model;

import java.util.List;

/** Tramo de una consulta paginada de justificaciones y el total que cumple el filtro. */
public record JustificationSlice(List<Justification> items, long total) {}
