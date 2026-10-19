package com.faceattend_edu.authorization_service.infrastructure.persistence.repository;

import com.faceattend_edu.authorization_service.infrastructure.persistence.entity.UserRoleId;
import com.faceattend_edu.authorization_service.infrastructure.persistence.entity.UserRoleJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface UserRoleJpaRepository extends JpaRepository<UserRoleJpaEntity, UserRoleId> {
    List<UserRoleJpaEntity> findByUserId(UUID userId);
    boolean existsByUserIdAndRoleId(UUID userId, Integer roleId);

    /** Backs the batch endpoint: one query for every requested user instead of one per user. */
    List<UserRoleJpaEntity> findByUserIdIn(Collection<UUID> userIds);

    @Query("SELECT ur FROM UserRoleJpaEntity ur WHERE ur.userId = :userId")
    List<UserRoleJpaEntity> findAllByUserId(UUID userId);
}
