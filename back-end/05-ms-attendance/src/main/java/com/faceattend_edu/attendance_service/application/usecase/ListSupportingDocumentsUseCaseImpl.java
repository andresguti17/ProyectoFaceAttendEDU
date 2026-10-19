package com.faceattend_edu.attendance_service.application.usecase;

import com.faceattend_edu.attendance_service.domain.model.SupportingDocument;
import com.faceattend_edu.attendance_service.domain.port.in.ListSupportingDocumentsUseCase;
import com.faceattend_edu.attendance_service.domain.port.out.SupportingDocumentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ListSupportingDocumentsUseCaseImpl implements ListSupportingDocumentsUseCase {
    private final SupportingDocumentRepository repository;
    @Override public List<SupportingDocument> list(){ return repository.findAll(); }
    @Override public List<SupportingDocument> listByJustificationId(Long justificationId){ return repository.findByJustificationId(justificationId); }
}
