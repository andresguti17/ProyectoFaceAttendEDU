package com.faceattend_edu.attendance_service.domain.port.in;

import com.faceattend_edu.attendance_service.domain.model.SupportingDocument;
import java.util.List;

public interface ListSupportingDocumentsUseCase {
    List<SupportingDocument> list();
    List<SupportingDocument> listByJustificationId(Long justificationId);
}
