package com.faceattend_edu.identity_service.adapter.out.persistence.repository;

import com.faceattend_edu.identity_service.adapter.out.persistence.entity.TermsAcceptanceJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface TermsAcceptanceJpaRepository extends JpaRepository<TermsAcceptanceJpaEntity, UUID> {

    Optional<TermsAcceptanceJpaEntity> findFirstByPersonIdOrderByAcceptedAtDesc(UUID personId);
}
