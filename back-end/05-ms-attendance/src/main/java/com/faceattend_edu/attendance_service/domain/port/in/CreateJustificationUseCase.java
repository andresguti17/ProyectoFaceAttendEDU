package com.faceattend_edu.attendance_service.domain.port.in;

import com.faceattend_edu.attendance_service.domain.model.Justification;

public interface CreateJustificationUseCase {
    Justification create(Justification justification);
}
