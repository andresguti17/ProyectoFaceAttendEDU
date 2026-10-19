package com.faceattend_edu.attendance_service.domain.port.in;

import com.faceattend_edu.attendance_service.domain.model.Justification;
import java.util.List;

public interface ListJustificationsUseCase {
    List<Justification> list();
}
