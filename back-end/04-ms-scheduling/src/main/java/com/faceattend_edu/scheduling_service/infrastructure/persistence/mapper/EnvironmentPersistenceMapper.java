package com.faceattend_edu.scheduling_service.infrastructure.persistence.mapper;

import com.faceattend_edu.scheduling_service.domain.model.Environment;
import com.faceattend_edu.scheduling_service.infrastructure.persistence.entity.EnvironmentJpaEntity;
import org.springframework.stereotype.Component;

@Component
public class EnvironmentPersistenceMapper {
    public Environment toDomain(EnvironmentJpaEntity e) {
        if (e == null) return null;
        Environment d = new Environment();
        d.setEnvironmentId(e.getEnvironmentId());
        d.setSchoolId(e.getSchoolId());
        d.setCode(e.getCode());
        d.setName(e.getName());
        d.setCapacity(e.getCapacity());
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
    public EnvironmentJpaEntity toEntity(Environment d) {
        if (d == null) return null;
        EnvironmentJpaEntity e = new EnvironmentJpaEntity();
        e.setEnvironmentId(d.getEnvironmentId());
        e.setSchoolId(d.getSchoolId());
        e.setCode(d.getCode());
        e.setName(d.getName());
        e.setCapacity(d.getCapacity());
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
