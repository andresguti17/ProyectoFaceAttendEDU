package com.faceattend_edu.attendance_service.domain.port.in;

import com.faceattend_edu.attendance_service.domain.model.Justification;

public interface GetJustificationUseCase {
    Justification getById(Long id);
}
