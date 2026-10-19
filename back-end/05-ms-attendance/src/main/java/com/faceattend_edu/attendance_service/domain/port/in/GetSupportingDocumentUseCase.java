package com.faceattend_edu.attendance_service.domain.port.in;

import com.faceattend_edu.attendance_service.domain.model.SupportingDocument;

public interface GetSupportingDocumentUseCase {
    SupportingDocument getById(Long id);
}
