package com.faceattend_edu.authorization_service.infrastructure.persistence.mapper;

import com.faceattend_edu.authorization_service.domain.model.Role;
import com.faceattend_edu.authorization_service.infrastructure.persistence.entity.RoleJpaEntity;
import org.springframework.stereotype.Component;

@Component
public class RolePersistenceMapper {
    public Role toDomain(RoleJpaEntity e) {
        if (e == null) return null;
        Role r = new Role();
        r.setRoleId(e.getRoleId());
        r.setRoleName(e.getRoleName());
        r.setDescription(e.getDescription());
        r.setCreatedAt(e.getCreatedAt());
        r.setUpdatedAt(e.getUpdatedAt());
        r.setDeletedAt(e.getDeletedAt());
        r.setCreatedBy(e.getCreatedBy());
        r.setUpdatedBy(e.getUpdatedBy());
        r.setDeletedBy(e.getDeletedBy());
        r.setRowVersion(e.getRowVersion());
        return r;
    }
    public RoleJpaEntity toEntity(Role d) {
        if (d == null) return null;
        RoleJpaEntity e = new RoleJpaEntity();
        e.setRoleId(d.getRoleId());
        e.setRoleName(d.getRoleName());
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
