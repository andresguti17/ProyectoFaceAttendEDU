package com.faceattend_edu.attendance_service.infrastructure.web.mapper;

import com.faceattend_edu.attendance_service.domain.model.SupportingDocument;
import com.faceattend_edu.attendance_service.infrastructure.web.dto.CreateSupportingDocumentRequest;
import com.faceattend_edu.attendance_service.infrastructure.web.dto.SupportingDocumentResponse;
import org.springframework.stereotype.Component;

@Component
public class SupportingDocumentWebMapper {
    public SupportingDocument toDomain(CreateSupportingDocumentRequest req){
        if(req==null) return null;
        SupportingDocument d=new SupportingDocument();
        d.setJustificationId(req.getJustificationId());
        d.setFileName(req.getFileName());
        d.setStorageUri(req.getStorageUri());
        d.setMimeType(req.getMimeType());
        d.setSizeBytes(req.getSizeBytes());
        return d;
    }
    public SupportingDocumentResponse toResponse(SupportingDocument d){
        if(d==null) return null;
        SupportingDocumentResponse r=new SupportingDocumentResponse();
        r.setSupportingDocumentId(d.getSupportingDocumentId());
        r.setJustificationId(d.getJustificationId());
        r.setFileName(d.getFileName());
        r.setStorageUri(d.getStorageUri());
        r.setMimeType(d.getMimeType());
        r.setSizeBytes(d.getSizeBytes());
        r.setCreatedAt(d.getCreatedAt());
        r.setRowVersion(d.getRowVersion());
        return r;
    }
}
