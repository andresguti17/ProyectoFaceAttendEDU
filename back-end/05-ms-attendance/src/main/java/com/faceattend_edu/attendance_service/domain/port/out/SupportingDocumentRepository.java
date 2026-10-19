package com.faceattend_edu.attendance_service.domain.port.out;

import com.faceattend_edu.attendance_service.domain.model.SupportingDocument;
import java.util.List;
import java.util.Optional;

public interface SupportingDocumentRepository {
    SupportingDocument save(SupportingDocument d);
    Optional<SupportingDocument> findById(Long id);
    List<SupportingDocument> findAll();
    List<SupportingDocument> findByJustificationId(Long justificationId);
    void deleteById(Long id);
    boolean existsById(Long id);
}
