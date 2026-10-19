package com.faceattend_edu.scheduling_service.domain.port.in;

import com.faceattend_edu.scheduling_service.domain.model.ClassSession;

public interface CancelClassSessionUseCase {
    ClassSession cancel(Long id);
}
