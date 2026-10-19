package com.faceattend_edu.attendance_service.domain.port.in;

import com.faceattend_edu.attendance_service.domain.model.SupportingDocument;

public interface CreateSupportingDocumentUseCase {
    SupportingDocument create(SupportingDocument doc);
}
