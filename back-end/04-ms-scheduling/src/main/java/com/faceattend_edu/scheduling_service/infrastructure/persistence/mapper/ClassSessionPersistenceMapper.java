package com.faceattend_edu.scheduling_service.infrastructure.persistence.mapper;

import com.faceattend_edu.scheduling_service.domain.model.ClassSession;
import com.faceattend_edu.scheduling_service.infrastructure.persistence.entity.ClassSessionJpaEntity;
import org.springframework.stereotype.Component;

@Component
public class ClassSessionPersistenceMapper {
    public ClassSession toDomain(ClassSessionJpaEntity e) {
        if (e == null) return null;
        ClassSession d = new ClassSession();
        d.setClassSessionId(e.getClassSessionId());
        d.setScheduleBlockId(e.getScheduleBlockId());
        d.setSessionDate(e.getSessionDate());
        d.setSessionStatus(e.getSessionStatus());
        d.setOpenedBy(e.getOpenedBy());
        d.setOpenedAt(e.getOpenedAt());
        d.setClosedBy(e.getClosedBy());
        d.setClosedAt(e.getClosedAt());
        d.setCreatedAt(e.getCreatedAt());
        d.setUpdatedAt(e.getUpdatedAt());
        d.setDeletedAt(e.getDeletedAt());
        d.setCreatedBy(e.getCreatedBy());
        d.setUpdatedBy(e.getUpdatedBy());
        d.setDeletedBy(e.getDeletedBy());
        d.setRowVersion(e.getRowVersion());
        return d;
    }
    public ClassSessionJpaEntity toEntity(ClassSession d) {
        if (d == null) return null;
        ClassSessionJpaEntity e = new ClassSessionJpaEntity();
        e.setClassSessionId(d.getClassSessionId());
        e.setScheduleBlockId(d.getScheduleBlockId());
        e.setSessionDate(d.getSessionDate());
        e.setSessionStatus(d.getSessionStatus());
        e.setOpenedBy(d.getOpenedBy());
        e.setOpenedAt(d.getOpenedAt());
        e.setClosedBy(d.getClosedBy());
        e.setClosedAt(d.getClosedAt());
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
