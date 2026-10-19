package com.faceattend_edu.scheduling_service.domain.port.in;

import com.faceattend_edu.scheduling_service.domain.model.Environment;
import java.util.List;

public interface ListEnvironmentsUseCase {
    List<Environment> list();
    List<Environment> listBySchoolId(Integer schoolId);
}
