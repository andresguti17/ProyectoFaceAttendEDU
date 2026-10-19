package com.faceattend_edu.attendance_service.domain.port.in;

import com.faceattend_edu.attendance_service.domain.model.Justification;
import java.util.UUID;

public interface ReviewJustificationUseCase {
    Justification review(Long id, String reviewStatus, UUID reviewedBy, String resolutionNotes);
}
