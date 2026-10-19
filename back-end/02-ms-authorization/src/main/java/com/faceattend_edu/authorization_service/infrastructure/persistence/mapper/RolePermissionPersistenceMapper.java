package com.faceattend_edu.authorization_service.infrastructure.persistence.mapper;

import com.faceattend_edu.authorization_service.domain.model.RolePermission;
import com.faceattend_edu.authorization_service.infrastructure.persistence.entity.RolePermissionJpaEntity;
import org.springframework.stereotype.Component;

@Component
public class RolePermissionPersistenceMapper {
    public RolePermission toDomain(RolePermissionJpaEntity e) {
        if (e == null) return null;
        RolePermission d = new RolePermission();
        d.setRoleId(e.getRoleId());
        d.setPermissionId(e.getPermissionId());
        d.setAssignmentDate(e.getAssignmentDate());
        d.setCreatedAt(e.getCreatedAt());
        d.setUpdatedAt(e.getUpdatedAt());
        d.setDeletedAt(e.getDeletedAt());
        d.setCreatedBy(e.getCreatedBy());
        d.setUpdatedBy(e.getUpdatedBy());
        d.setDeletedBy(e.getDeletedBy());
        d.setRowVersion(e.getRowVersion());
        return d;
    }
    public RolePermissionJpaEntity toEntity(RolePermission d) {
        if (d == null) return null;
        RolePermissionJpaEntity e = new RolePermissionJpaEntity();
        e.setRoleId(d.getRoleId());
        e.setPermissionId(d.getPermissionId());
        e.setAssignmentDate(d.getAssignmentDate());
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
