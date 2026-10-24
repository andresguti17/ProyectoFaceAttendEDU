package com.faceattend_edu.attendance_service.domain.port.in;

import com.faceattend_edu.attendance_service.domain.model.SupportingDocument;

public interface GetSupportingDocumentContentUseCase {

    record DocumentContent(SupportingDocument document, byte[] bytes) {}

    /** The stored file of a supporting document; 404 when the row has no stored object. */
    DocumentContent getContent(Long supportingDocumentId);
}
