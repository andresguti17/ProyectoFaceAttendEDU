package com.faceattend_edu.authorization_service.infrastructure.persistence.mapper;

import com.faceattend_edu.authorization_service.domain.model.UserRole;
import com.faceattend_edu.authorization_service.infrastructure.persistence.entity.UserRoleJpaEntity;
import org.springframework.stereotype.Component;

@Component
public class UserRolePersistenceMapper {
    public UserRole toDomain(UserRoleJpaEntity e) {
        if (e == null) return null;
        UserRole d = new UserRole();
        d.setUserId(e.getUserId());
        d.setRoleId(e.getRoleId());
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
    public UserRoleJpaEntity toEntity(UserRole d) {
        if (d == null) return null;
        UserRoleJpaEntity e = new UserRoleJpaEntity();
        e.setUserId(d.getUserId());
        e.setRoleId(d.getRoleId());
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
