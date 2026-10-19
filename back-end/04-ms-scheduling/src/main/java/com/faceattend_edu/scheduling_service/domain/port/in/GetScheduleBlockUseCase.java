package com.faceattend_edu.scheduling_service.domain.port.in;

import com.faceattend_edu.scheduling_service.domain.model.ScheduleBlock;

public interface GetScheduleBlockUseCase {
    ScheduleBlock getById(Long id);
}
