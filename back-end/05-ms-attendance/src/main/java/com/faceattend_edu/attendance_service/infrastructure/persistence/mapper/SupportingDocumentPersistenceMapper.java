package com.faceattend_edu.attendance_service.infrastructure.persistence.mapper;

import com.faceattend_edu.attendance_service.domain.model.SupportingDocument;
import com.faceattend_edu.attendance_service.infrastructure.persistence.entity.SupportingDocumentJpaEntity;
import org.springframework.stereotype.Component;

@Component
public class SupportingDocumentPersistenceMapper {
    public SupportingDocument toDomain(SupportingDocumentJpaEntity e){
        if(e==null) return null;
        SupportingDocument d=new SupportingDocument();
        d.setSupportingDocumentId(e.getSupportingDocumentId());
        d.setJustificationId(e.getJustificationId());
        d.setFileName(e.getFileName());
        d.setStorageUri(e.getStorageUri());
        d.setMimeType(e.getMimeType());
        d.setSizeBytes(e.getSizeBytes());
        d.setCreatedAt(e.getCreatedAt());
        d.setUpdatedAt(e.getUpdatedAt());
        d.setDeletedAt(e.getDeletedAt());
        d.setCreatedBy(e.getCreatedBy());
        d.setUpdatedBy(e.getUpdatedBy());
        d.setDeletedBy(e.getDeletedBy());
        d.setRowVersion(e.getRowVersion());
        return d;
    }
    public SupportingDocumentJpaEntity toEntity(SupportingDocument d){
        if(d==null) return null;
        SupportingDocumentJpaEntity e=new SupportingDocumentJpaEntity();
        e.setSupportingDocumentId(d.getSupportingDocumentId());
        e.setJustificationId(d.getJustificationId());
        e.setFileName(d.getFileName());
        e.setStorageUri(d.getStorageUri());
        e.setMimeType(d.getMimeType());
        e.setSizeBytes(d.getSizeBytes());
        e.setCreatedAt(d.getCreatedAt());
        e.setUpdatedAt(d.getUpdatedAt());
        e.setDeletedAt(d.getDeletedAt());
        e.setCreatedBy(d.getCreatedBy());
        e.setUpdatedBy(d.getUpdatedBy());
        e.setDeletedBy(d.getDeletedBy());
        e.setRowVersion(d.getRowVersion());
        return e;
    }
}
