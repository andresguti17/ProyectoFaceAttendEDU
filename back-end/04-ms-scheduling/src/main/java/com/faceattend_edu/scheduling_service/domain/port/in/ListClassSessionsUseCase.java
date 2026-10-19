package com.faceattend_edu.scheduling_service.domain.port.in;

import com.faceattend_edu.scheduling_service.domain.model.ClassSession;
import java.util.List;

public interface ListClassSessionsUseCase {
    List<ClassSession> list();
}
