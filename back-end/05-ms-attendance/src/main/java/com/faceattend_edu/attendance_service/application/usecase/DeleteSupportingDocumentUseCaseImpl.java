package com.faceattend_edu.attendance_service.application.usecase;

import com.faceattend_edu.attendance_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.attendance_service.domain.model.SupportingDocument;
import com.faceattend_edu.attendance_service.domain.port.in.DeleteSupportingDocumentUseCase;
import com.faceattend_edu.attendance_service.domain.port.out.DocumentStoragePort;
import com.faceattend_edu.attendance_service.domain.port.out.SupportingDocumentRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class DeleteSupportingDocumentUseCaseImpl implements DeleteSupportingDocumentUseCase {
    private static final Logger log = LoggerFactory.getLogger(DeleteSupportingDocumentUseCaseImpl.class);
    private final SupportingDocumentRepository repository;
    private final DocumentStoragePort storage;

    @Override public void delete(Long id){
        SupportingDocument doc = repository.findById(id).orElseThrow(() -> new EntityNotFoundException("SupportingDocument", id));
        repository.deleteById(id);
        // The row is gone first; a failed object removal only leaves an unreachable file behind.
        try {
            storage.delete(doc.getStorageUri());
        } catch (RuntimeException e) {
            log.warn("Supporting document {} deleted but its object was not: {}", id, e.getMessage());
        }
    }
}
