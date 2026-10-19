package com.faceattend_edu.attendance_service.application.usecase;

import com.faceattend_edu.attendance_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.attendance_service.domain.port.in.DeleteSupportingDocumentUseCase;
import com.faceattend_edu.attendance_service.domain.port.out.SupportingDocumentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class DeleteSupportingDocumentUseCaseImpl implements DeleteSupportingDocumentUseCase {
    private final SupportingDocumentRepository repository;
    @Override public void delete(Long id){ if(!repository.existsById(id)) throw new EntityNotFoundException("SupportingDocument", id); repository.deleteById(id); }
}
