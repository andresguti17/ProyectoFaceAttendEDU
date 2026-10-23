package com.faceattend_edu.attendance_service.application.usecase;

import com.faceattend_edu.attendance_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.attendance_service.domain.model.SupportingDocument;
import com.faceattend_edu.attendance_service.domain.port.in.GetSupportingDocumentContentUseCase;
import com.faceattend_edu.attendance_service.domain.port.in.GetSupportingDocumentUseCase;
import com.faceattend_edu.attendance_service.domain.port.out.DocumentStoragePort;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class GetSupportingDocumentContentUseCaseImpl implements GetSupportingDocumentContentUseCase {

    private final GetSupportingDocumentUseCase documentUseCase;
    private final DocumentStoragePort storage;

    @Override
    public DocumentContent getContent(Long supportingDocumentId) {
        SupportingDocument document = documentUseCase.getById(supportingDocumentId);
        // Rows created before uploads existed carry a path the client invented: no object behind it.
        byte[] bytes = storage.get(document.getStorageUri())
                .orElseThrow(() -> new EntityNotFoundException("SupportingDocument content", supportingDocumentId));
        return new DocumentContent(document, bytes);
    }
}
