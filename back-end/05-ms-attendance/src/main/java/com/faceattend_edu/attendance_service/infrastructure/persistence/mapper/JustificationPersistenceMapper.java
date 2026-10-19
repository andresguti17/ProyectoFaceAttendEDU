package com.faceattend_edu.attendance_service.infrastructure.persistence.mapper;

import com.faceattend_edu.attendance_service.domain.model.Justification;
import com.faceattend_edu.attendance_service.infrastructure.persistence.entity.JustificationJpaEntity;
import org.springframework.stereotype.Component;

@Component
public class JustificationPersistenceMapper {
    public Justification toDomain(JustificationJpaEntity e){
        if(e==null) return null;
        Justification d=new Justification();
        d.setJustificationId(e.getJustificationId());
        d.setAttendanceRecordId(e.getAttendanceRecordId());
        d.setJustificationTypeId(e.getJustificationTypeId());
        d.setReason(e.getReason());
        d.setSubmittedAt(e.getSubmittedAt());
        d.setReviewedBy(e.getReviewedBy());
        d.setReviewedAt(e.getReviewedAt());
        d.setReviewStatus(e.getReviewStatus());
        d.setResolutionNotes(e.getResolutionNotes());
        d.setCreatedAt(e.getCreatedAt());
        d.setUpdatedAt(e.getUpdatedAt());
        d.setDeletedAt(e.getDeletedAt());
        d.setCreatedBy(e.getCreatedBy());
        d.setUpdatedBy(e.getUpdatedBy());
        d.setDeletedBy(e.getDeletedBy());
        d.setRowVersion(e.getRowVersion());
        return d;
    }
    public JustificationJpaEntity toEntity(Justification d){
        if(d==null) return null;
        JustificationJpaEntity e=new JustificationJpaEntity();
        e.setJustificationId(d.getJustificationId());
        e.setAttendanceRecordId(d.getAttendanceRecordId());
        e.setJustificationTypeId(d.getJustificationTypeId());
        e.setReason(d.getReason());
        e.setSubmittedAt(d.getSubmittedAt());
        e.setReviewedBy(d.getReviewedBy());
        e.setReviewedAt(d.getReviewedAt());
        e.setReviewStatus(d.getReviewStatus());
        e.setResolutionNotes(d.getResolutionNotes());
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
