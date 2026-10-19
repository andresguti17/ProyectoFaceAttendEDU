package com.faceattend_edu.authorization_service.infrastructure.persistence.repository;

import com.faceattend_edu.authorization_service.infrastructure.persistence.entity.PermissionJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PermissionJpaRepository extends JpaRepository<PermissionJpaEntity, Integer> {
    Optional<PermissionJpaEntity> findByPermissionName(String permissionName);
}
