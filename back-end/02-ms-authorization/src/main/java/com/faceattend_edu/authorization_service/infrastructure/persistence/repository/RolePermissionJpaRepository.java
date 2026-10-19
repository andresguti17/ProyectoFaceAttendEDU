package com.faceattend_edu.authorization_service.infrastructure.persistence.repository;

import com.faceattend_edu.authorization_service.infrastructure.persistence.entity.RolePermissionId;
import com.faceattend_edu.authorization_service.infrastructure.persistence.entity.RolePermissionJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RolePermissionJpaRepository extends JpaRepository<RolePermissionJpaEntity, RolePermissionId> {
    List<RolePermissionJpaEntity> findByRoleId(Integer roleId);
    boolean existsByRoleIdAndPermissionId(Integer roleId, Integer permissionId);
}
