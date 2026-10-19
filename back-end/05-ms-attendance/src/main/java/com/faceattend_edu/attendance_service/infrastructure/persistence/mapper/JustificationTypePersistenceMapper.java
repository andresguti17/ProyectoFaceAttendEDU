package com.faceattend_edu.attendance_service.infrastructure.persistence.mapper;

import com.faceattend_edu.attendance_service.domain.model.JustificationType;
import com.faceattend_edu.attendance_service.infrastructure.persistence.entity.JustificationTypeJpaEntity;
import org.springframework.stereotype.Component;

@Component
public class JustificationTypePersistenceMapper {
    public JustificationType toDomain(JustificationTypeJpaEntity e){
        if(e==null) return null;
        JustificationType d=new JustificationType();
        d.setJustificationTypeId(e.getJustificationTypeId());
        d.setSchoolId(e.getSchoolId());
        d.setName(e.getName());
        d.setDescription(e.getDescription());
        d.setRequiresAttachment(e.getRequiresAttachment());
        d.setStatus(e.getStatus());
        d.setCreatedAt(e.getCreatedAt());
        d.setUpdatedAt(e.getUpdatedAt());
        d.setDeletedAt(e.getDeletedAt());
        d.setCreatedBy(e.getCreatedBy());
        d.setUpdatedBy(e.getUpdatedBy());
        d.setDeletedBy(e.getDeletedBy());
        d.setRowVersion(e.getRowVersion());
        return d;
    }
    public JustificationTypeJpaEntity toEntity(JustificationType d){
        if(d==null) return null;
        JustificationTypeJpaEntity e=new JustificationTypeJpaEntity();
        e.setJustificationTypeId(d.getJustificationTypeId());
        e.setSchoolId(d.getSchoolId());
        e.setName(d.getName());
        e.setDescription(d.getDescription());
        e.setRequiresAttachment(d.getRequiresAttachment());
        e.setStatus(d.getStatus());
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
