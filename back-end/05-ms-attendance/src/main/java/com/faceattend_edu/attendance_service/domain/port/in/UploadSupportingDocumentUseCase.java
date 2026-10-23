package com.faceattend_edu.attendance_service.domain.port.in;

import com.faceattend_edu.attendance_service.domain.model.SupportingDocument;

public interface UploadSupportingDocumentUseCase {
    /** Stores the file in object storage and records it for the justification. */
    SupportingDocument upload(Long justificationId, String originalFileName, byte[] content);
}
