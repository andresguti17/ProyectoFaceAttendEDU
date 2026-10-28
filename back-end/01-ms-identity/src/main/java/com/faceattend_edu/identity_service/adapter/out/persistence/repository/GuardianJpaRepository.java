package com.faceattend_edu.identity_service.adapter.out.persistence.repository;

import com.faceattend_edu.identity_service.adapter.out.persistence.entity.GuardianJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface GuardianJpaRepository extends JpaRepository<GuardianJpaEntity, UUID> {

    Optional<GuardianJpaEntity> findFirstByMinorPersonIdAndDeletedAtIsNull(UUID minorPersonId);
}
