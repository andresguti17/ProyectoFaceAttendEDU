package com.faceattend_edu.authorization_service.infrastructure.persistence.mapper;

import com.faceattend_edu.authorization_service.domain.model.Permission;
import com.faceattend_edu.authorization_service.infrastructure.persistence.entity.PermissionJpaEntity;
import org.springframework.stereotype.Component;

@Component
public class PermissionPersistenceMapper {
    public Permission toDomain(PermissionJpaEntity e) {
        if (e == null) return null;
        Permission p = new Permission();
        p.setPermissionId(e.getPermissionId());
        p.setPermissionName(e.getPermissionName());
        p.setDescription(e.getDescription());
        p.setCreatedAt(e.getCreatedAt());
        p.setUpdatedAt(e.getUpdatedAt());
        p.setDeletedAt(e.getDeletedAt());
        p.setCreatedBy(e.getCreatedBy());
        p.setUpdatedBy(e.getUpdatedBy());
        p.setDeletedBy(e.getDeletedBy());
        p.setRowVersion(e.getRowVersion());
        return p;
    }
    public PermissionJpaEntity toEntity(Permission d) {
        if (d == null) return null;
        PermissionJpaEntity e = new PermissionJpaEntity();
        e.setPermissionId(d.getPermissionId());
        e.setPermissionName(d.getPermissionName());
        e.setDescription(d.getDescription());
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
