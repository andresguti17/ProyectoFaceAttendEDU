package com.faceattend_edu.scheduling_service.domain.port.in;

import com.faceattend_edu.scheduling_service.domain.model.Environment;

public interface GetEnvironmentUseCase {
    Environment getById(Integer id);
}
