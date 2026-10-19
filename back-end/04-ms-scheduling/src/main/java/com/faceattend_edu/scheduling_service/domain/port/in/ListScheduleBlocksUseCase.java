package com.faceattend_edu.scheduling_service.domain.port.in;

import com.faceattend_edu.scheduling_service.domain.model.ScheduleBlock;
import java.util.List;

public interface ListScheduleBlocksUseCase {
    List<ScheduleBlock> list();
}
