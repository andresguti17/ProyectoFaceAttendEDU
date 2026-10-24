package com.faceattend_edu.attendance_service.application.usecase;

import com.faceattend_edu.attendance_service.domain.exception.ValidationException;
import com.faceattend_edu.attendance_service.domain.model.SupportingDocument;
import com.faceattend_edu.attendance_service.domain.model.SupportingDocumentType;
import com.faceattend_edu.attendance_service.domain.port.in.GetJustificationUseCase;
import com.faceattend_edu.attendance_service.domain.port.in.UploadSupportingDocumentUseCase;
import com.faceattend_edu.attendance_service.domain.port.out.DocumentStoragePort;
import com.faceattend_edu.attendance_service.domain.port.out.SupportingDocumentRepository;
import com.faceattend_edu.attendance_service.infrastructure.messaging.DomainEventPublisher;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class UploadSupportingDocumentUseCaseImpl implements UploadSupportingDocumentUseCase {

    private static final Logger log = LoggerFactory.getLogger(UploadSupportingDocumentUseCaseImpl.class);
    static final long MAX_SIZE_BYTES = 5L * 1024 * 1024;

    private final GetJustificationUseCase justificationUseCase;
    private final SupportingDocumentRepository repository;
    private final DocumentStoragePort storage;
    private final DomainEventPublisher eventPublisher;

    @Override
    public SupportingDocument upload(Long justificationId, String originalFileName, byte[] content) {
        if (content == null || content.length == 0) throw new ValidationException("file is required");
        if (content.length > MAX_SIZE_BYTES) throw new ValidationException("file must be at most 5 MB");
        SupportingDocumentType type = SupportingDocumentType.detect(content)
                .orElseThrow(() -> new ValidationException("file must be a PDF, JPG or PNG document"));
        justificationUseCase.getById(justificationId); // 404 before storing anything

        // The key is generated here: nothing the client sends ends up in the object path.
        ZonedDateTime now = ZonedDateTime.now(ZoneOffset.UTC);
        String objectKey = String.format("%d/%02d/%s.%s",
                now.getYear(), now.getMonthValue(), UUID.randomUUID(), type.extension());
        String storageUri = storage.put(objectKey, content, type.mimeType());

        SupportingDocument doc = new SupportingDocument();
        doc.setJustificationId(justificationId);
        doc.setFileName(safeFileName(originalFileName, type));
        doc.setStorageUri(storageUri);
        doc.setMimeType(type.mimeType());
        doc.setSizeBytes((long) content.length);
        SupportingDocument saved;
        try {
            doc.validate();
            doc.touchCreated();
            saved = repository.save(doc);
        } catch (RuntimeException e) {
            // No row points at the object: remove it so storage does not keep orphans.
            try {
                storage.delete(storageUri);
            } catch (RuntimeException cleanup) {
                log.warn("Could not remove orphan supporting document {}: {}", storageUri, cleanup.getMessage());
            }
            throw e;
        }
        eventPublisher.publish("document-events", "{\"supportingDocumentId\":" + saved.getSupportingDocumentId()
                + ",\"justificationId\":" + saved.getJustificationId() + "}");
        return saved;
    }

    /** Display name only: no path, no control characters or quotes, at most 255 characters. */
    static String safeFileName(String original, SupportingDocumentType type) {
        String name = original == null ? "" : original.replace('\\', '/');
        name = name.substring(name.lastIndexOf('/') + 1).replaceAll("[\\p{Cntrl}\"]", "").trim();
        if (name.isEmpty()) name = "soporte." + type.extension();
        return name.length() > 255 ? name.substring(name.length() - 255) : name;
    }
}
