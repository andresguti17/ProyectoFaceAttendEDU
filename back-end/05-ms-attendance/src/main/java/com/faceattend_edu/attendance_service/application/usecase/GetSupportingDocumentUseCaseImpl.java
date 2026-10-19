package com.faceattend_edu.attendance_service.application.usecase;

import com.faceattend_edu.attendance_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.attendance_service.domain.model.SupportingDocument;
import com.faceattend_edu.attendance_service.domain.port.in.GetSupportingDocumentUseCase;
import com.faceattend_edu.attendance_service.domain.port.out.SupportingDocumentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class GetSupportingDocumentUseCaseImpl implements GetSupportingDocumentUseCase {
    private final SupportingDocumentRepository repository;
    @Override public SupportingDocument getById(Long id){ return repository.findById(id).orElseThrow(() -> new EntityNotFoundException("SupportingDocument", id)); }
}
