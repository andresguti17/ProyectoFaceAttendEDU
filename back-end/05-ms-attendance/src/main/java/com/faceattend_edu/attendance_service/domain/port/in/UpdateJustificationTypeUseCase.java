package com.faceattend_edu.attendance_service.domain.port.in;

import com.faceattend_edu.attendance_service.domain.model.JustificationType;

public interface UpdateJustificationTypeUseCase {
    JustificationType update(Integer id, JustificationType type);
}
