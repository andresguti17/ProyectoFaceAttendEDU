package com.faceattend_edu.attendance_service.application.usecase;

import com.faceattend_edu.attendance_service.domain.model.SupportingDocument;
import com.faceattend_edu.attendance_service.domain.port.in.CreateSupportingDocumentUseCase;
import com.faceattend_edu.attendance_service.domain.port.out.SupportingDocumentRepository;
import com.faceattend_edu.attendance_service.infrastructure.messaging.DomainEventPublisher;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class CreateSupportingDocumentUseCaseImpl implements CreateSupportingDocumentUseCase {
    private final SupportingDocumentRepository repository;
    private final DomainEventPublisher eventPublisher;
    @Override public SupportingDocument create(SupportingDocument doc){
        doc.validate(); doc.touchCreated();
        SupportingDocument saved = repository.save(doc);
        eventPublisher.publish("document-events", "{\"supportingDocumentId\":" + saved.getSupportingDocumentId() + ",\"justificationId\":" + saved.getJustificationId() + "}");
        return saved;
    }
}
