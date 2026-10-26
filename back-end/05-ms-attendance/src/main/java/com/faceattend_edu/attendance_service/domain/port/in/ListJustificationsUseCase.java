package com.faceattend_edu.attendance_service.domain.port.in;

import com.faceattend_edu.attendance_service.domain.model.JustificationFilter;
import com.faceattend_edu.attendance_service.domain.model.JustificationSlice;

public interface ListJustificationsUseCase {
    /** Filtro, alcance y paginación en SQL; {@code limit} null devuelve todas las que cumplen. */
    JustificationSlice search(JustificationFilter filter, int offset, Integer limit);
}
