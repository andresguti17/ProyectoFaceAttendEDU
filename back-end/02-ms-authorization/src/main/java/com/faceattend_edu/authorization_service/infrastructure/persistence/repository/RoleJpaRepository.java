package com.faceattend_edu.authorization_service.infrastructure.persistence.repository;

import com.faceattend_edu.authorization_service.infrastructure.persistence.entity.RoleJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface RoleJpaRepository extends JpaRepository<RoleJpaEntity, Integer> {
    Optional<RoleJpaEntity> findByRoleName(String roleName);
}
