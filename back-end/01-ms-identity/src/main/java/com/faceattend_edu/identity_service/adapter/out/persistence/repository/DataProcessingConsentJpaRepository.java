package com.faceattend_edu.identity_service.adapter.out.persistence.repository;

import com.faceattend_edu.identity_service.adapter.out.persistence.entity.DataProcessingConsentJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface DataProcessingConsentJpaRepository extends JpaRepository<DataProcessingConsentJpaEntity, UUID> {

    Optional<DataProcessingConsentJpaEntity> findFirstByPersonIdOrderByAcceptedAtDesc(UUID personId);
}
