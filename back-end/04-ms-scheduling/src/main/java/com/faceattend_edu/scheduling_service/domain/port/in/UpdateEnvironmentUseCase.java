package com.faceattend_edu.scheduling_service.domain.port.in;

import com.faceattend_edu.scheduling_service.domain.model.Environment;

public interface UpdateEnvironmentUseCase {
    Environment update(Integer id, Environment environment);
}
