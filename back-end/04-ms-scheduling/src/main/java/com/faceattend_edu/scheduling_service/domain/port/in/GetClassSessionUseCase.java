package com.faceattend_edu.scheduling_service.domain.port.in;

import com.faceattend_edu.scheduling_service.domain.model.ClassSession;

public interface GetClassSessionUseCase {
    ClassSession getById(Long id);
}
