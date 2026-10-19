package com.faceattend_edu.attendance_service.domain.port.in;

import com.faceattend_edu.attendance_service.domain.model.JustificationType;
import java.util.List;

public interface ListJustificationTypesUseCase {
    List<JustificationType> list();
}
